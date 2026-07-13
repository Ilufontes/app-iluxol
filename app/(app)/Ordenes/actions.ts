'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Tipologia } from '../tipologias/actions'

// ─── TIPOS ────────────────────────────────────────────────────────────────────

export type LineaOrden = {
  id?: number
  tipologia_id: number
  tipologia?: Tipologia
  color_id: number | null
  color_nombre?: string | null
  ancho_total: number | null
  alto_total: number | null
  alto_izquierda: number | null
  alto_derecha: number | null
  unidades_totales: number
  referencia: string
  posicion: number
}

export type OrdenTrabajo = {
  id: number
  numero_orden: number | null
  nota_id: number | null
  cliente_id: number | null
  notas: string | null
  creado_en: string
  cliente?: { nombre: string; telefono: string | null } | null
  nota?: { numero_nota: number | null; tipo_notas: { nombre: string } | null } | null
  orden_lineas: LineaOrden[]
}

// ─── LISTADO ──────────────────────────────────────────────────────────────────

export async function cargarOrdenes(): Promise<OrdenTrabajo[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ordenes_trabajo')
    .select(`
      id, numero_orden, nota_id, cliente_id, notas, creado_en,
      clientes ( nombre, telefono ),
      notas ( numero_nota, tipo_notas ( nombre ) ),
      orden_lineas (
        id, tipologia_id, color_id, ancho_total, alto_total,
        alto_izquierda, alto_derecha, unidades_totales, referencia, posicion,
        tipologias ( id, nombre, notas, activo, tipologia_filas ( id, tipo, variable_clave, nombre_perfil, formula, unidades, posicion ) ),
        colores ( nombre )
      )
    `)
    .order('numero_orden', { ascending: false })

  if (error) throw new Error('No se pudieron cargar las órdenes.')

  function unoOnulo(v: any) { return Array.isArray(v) ? (v[0] ?? null) : v }

  return (data ?? []).map((o: any) => ({
    ...o,
    cliente: unoOnulo(o.clientes),
    nota:    unoOnulo(o.notas),
    orden_lineas: [...(o.orden_lineas ?? [])].sort((a: any, b: any) => a.posicion - b.posicion).map((l: any) => ({
      ...l,
      color_nombre: unoOnulo(l.colores)?.nombre ?? null,
      tipologia: l.tipologias
        ? {
            ...unoOnulo(l.tipologias),
            tipologia_filas: [...(unoOnulo(l.tipologias)?.tipologia_filas ?? [])].sort((a: any, b: any) => a.posicion - b.posicion),
          }
        : null,
    })),
  }))
}

// ─── CREAR ────────────────────────────────────────────────────────────────────

export async function crearOrden(datos: {
  nota_id: number | null
  cliente_id: number | null
  notas: string
  lineas: Omit<LineaOrden, 'id' | 'tipologia' | 'color_nombre'>[]
}): Promise<{ id: number }> {
  const supabase = await createClient()

  const { data: orden, error } = await supabase
    .from('ordenes_trabajo')
    .insert({
      nota_id:    datos.nota_id,
      cliente_id: datos.cliente_id,
      notas:      datos.notas.trim() || null,
    })
    .select('id')
    .single()

  if (error || !orden) throw new Error('No se pudo crear la orden.')

  if (datos.lineas.length > 0) {
    await supabase.from('orden_lineas').insert(
      datos.lineas.map((l, i) => ({ ...l, orden_id: orden.id, posicion: i }))
    )
  }

  revalidatePath('/ordenes')
  return orden
}

// ─── ACTUALIZAR ───────────────────────────────────────────────────────────────

export async function actualizarOrden(
  id: number,
  datos: {
    nota_id: number | null
    cliente_id: number | null
    notas: string
    lineas: Omit<LineaOrden, 'id' | 'tipologia' | 'color_nombre'>[]
  }
): Promise<void> {
  const supabase = await createClient()

  await supabase.from('ordenes_trabajo').update({
    nota_id:        datos.nota_id,
    cliente_id:     datos.cliente_id,
    notas:          datos.notas.trim() || null,
    actualizado_en: new Date().toISOString(),
  }).eq('id', id)

  await supabase.from('orden_lineas').delete().eq('orden_id', id)

  if (datos.lineas.length > 0) {
    await supabase.from('orden_lineas').insert(
      datos.lineas.map((l, i) => ({ ...l, orden_id: id, posicion: i }))
    )
  }

  revalidatePath('/ordenes')
}

// ─── ELIMINAR ─────────────────────────────────────────────────────────────────

export async function eliminarOrden(id: number): Promise<void> {
  const supabase = await createClient()
  await supabase.from('orden_lineas').delete().eq('orden_id', id)
  await supabase.from('ordenes_trabajo').delete().eq('id', id)
  revalidatePath('/ordenes')
}

// ─── BUSCAR NOTA POR NÚMERO (para enlazar) ────────────────────────────────────

export async function buscarNotaParaOrden(numero: number) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('notas')
    .select('id, numero_nota, cliente_id, clientes ( nombre, telefono ), tipo_notas ( nombre )')
    .eq('numero_nota', numero)
    .single()
  if (!data) return null
  function unoOnulo(v: any) { return Array.isArray(v) ? (v[0] ?? null) : v }
  return { ...data, clientes: unoOnulo(data.clientes), tipo_notas: unoOnulo(data.tipo_notas) }
}

// ─── BUSCAR CLIENTE (para enlazar) ────────────────────────────────────────────

export async function buscarClientesParaOrden(termino: string) {
  const supabase = await createClient()
  const t = termino.trim()
  if (!t) return []
  const { data } = await supabase
    .from('clientes')
    .select('id, nombre, telefono')
    .or(`nombre.ilike.%${t}%,telefono.ilike.%${t}%`)
    .limit(8)
  return data ?? []
}
