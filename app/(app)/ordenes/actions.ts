'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type VariableClave = 'ancho_total' | 'alto_total' | 'alto_izquierda' | 'alto_derecha'
export type FilaVariable   = { id?: number; tipo: 'variable'; variable_clave: VariableClave; posicion: number }
export type FilaPerfil     = { id?: number; tipo: 'perfil'; nombre_perfil: string; formula: string; unidades: number; posicion: number }
export type FilaTipologia  = FilaVariable | FilaPerfil

export type Tipologia = {
  id: number; nombre: string; activo: boolean
  imagen_url: string | null
  tipologia_filas: FilaTipologia[]
}
export type Color = { id: number; nombre: string; activo: boolean }

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
  numero_nota_rel: number | null
  cliente_id: number | null
  cliente_nombre: string | null
  cliente_telefono: string | null
  observaciones: string | null
  creado_en: string
  orden_lineas: LineaOrden[]
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const SELECT_LINEAS = `
  id, tipologia_id, color_id,
  ancho_total, alto_total, alto_izquierda, alto_derecha,
  unidades_totales, referencia, posicion,
  tipologias ( id, nombre, activo, imagen_url,
    tipologia_filas ( id, tipo, variable_clave, nombre_perfil, formula, unidades, posicion )
  ),
  colores ( nombre )
`

function uno(v: any) { return Array.isArray(v) ? (v[0] ?? null) : v }

function normalizarLineas(lineas: any[]): LineaOrden[] {
  return [...lineas].sort((a, b) => a.posicion - b.posicion).map(l => {
    const tip = uno(l.tipologias)
    return {
      id: l.id,
      tipologia_id: l.tipologia_id,
      color_id: l.color_id,
      color_nombre: uno(l.colores)?.nombre ?? null,
      ancho_total: l.ancho_total,
      alto_total: l.alto_total,
      alto_izquierda: l.alto_izquierda,
      alto_derecha: l.alto_derecha,
      unidades_totales: l.unidades_totales,
      referencia: l.referencia ?? '',
      posicion: l.posicion,
      tipologia: tip ? {
        ...tip,
        imagen_url: tip.imagen_url ?? null,
        tipologia_filas: [...(tip.tipologia_filas ?? [])].sort((a: any, b: any) => a.posicion - b.posicion),
      } : null,
    }
  })
}

// ─── CARGAR DATOS DE APOYO ────────────────────────────────────────────────────

export async function cargarTipologiasParaOrdenes(): Promise<Tipologia[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('tipologias')
    .select('id, nombre, activo, imagen_url, tipologia_filas ( id, tipo, variable_clave, nombre_perfil, formula, unidades, posicion )')
    .order('nombre')
  return (data ?? []).map((t: any) => ({
    ...t,
    imagen_url: t.imagen_url ?? null,
    tipologia_filas: [...(t.tipologia_filas ?? [])].sort((a: any, b: any) => a.posicion - b.posicion),
  }))
}

export async function cargarColoresParaOrdenes(): Promise<Color[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('colores').select('id, nombre, activo').order('nombre')
  return data ?? []
}

// ─── LISTADO ──────────────────────────────────────────────────────────────────

export async function cargarOrdenes(): Promise<OrdenTrabajo[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ordenes_trabajo')
    .select(`id, numero_orden, nota_id, cliente_id, notas, creado_en, clientes ( nombre, telefono ), orden_lineas (${SELECT_LINEAS})`)
    .order('numero_orden', { ascending: false })
  if (error) { console.error('[cargarOrdenes]', error.message); return [] }
  return (data ?? []).map((o: any) => {
    const cliente = uno(o.clientes)
    return {
      id: o.id, numero_orden: o.numero_orden, nota_id: o.nota_id,
      numero_nota_rel: null,
      cliente_id: o.cliente_id, cliente_nombre: cliente?.nombre ?? null,
      cliente_telefono: cliente?.telefono ?? null,
      observaciones: o.notas, creado_en: o.creado_en,
      orden_lineas: normalizarLineas(o.orden_lineas ?? []),
    }
  })
}

// ─── CARGAR UNA ORDEN PARA IMPRESIÓN ─────────────────────────────────────────

export async function cargarOrdenParaImprimir(id: number): Promise<OrdenTrabajo | null> {
  const supabase = await createClient()
  const { data: o, error } = await supabase
    .from('ordenes_trabajo')
    .select(`id, numero_orden, nota_id, cliente_id, notas, creado_en, clientes ( nombre, telefono ), orden_lineas (${SELECT_LINEAS})`)
    .eq('id', id)
    .single()
  if (error || !o) return null
  const cliente = uno((o as any).clientes)

  // Cargar numero_nota si hay nota_id
  let numero_nota_rel = null
  if ((o as any).nota_id) {
    const { data: nota } = await supabase.from('notas').select('numero_nota').eq('id', (o as any).nota_id).single()
    numero_nota_rel = nota?.numero_nota ?? null
  }

  return {
    id: o.id, numero_orden: (o as any).numero_orden, nota_id: (o as any).nota_id,
    numero_nota_rel,
    cliente_id: (o as any).cliente_id, cliente_nombre: cliente?.nombre ?? null,
    cliente_telefono: cliente?.telefono ?? null,
    observaciones: (o as any).notas, creado_en: (o as any).creado_en,
    orden_lineas: normalizarLineas((o as any).orden_lineas ?? []),
  }
}

// ─── CREAR / ACTUALIZAR / ELIMINAR ────────────────────────────────────────────

export async function crearOrden(datos: {
  nota_id: number | null; cliente_id: number | null
  observaciones: string
  lineas: Omit<LineaOrden, 'id' | 'tipologia' | 'color_nombre'>[]
}): Promise<{ id: number }> {
  const supabase = await createClient()
  const { data: orden, error } = await supabase
    .from('ordenes_trabajo')
    .insert({ nota_id: datos.nota_id, cliente_id: datos.cliente_id, notas: datos.observaciones.trim() || null })
    .select('id').single()
  if (error || !orden) throw new Error('No se pudo crear la orden.')
  if (datos.lineas.length > 0) {
    await supabase.from('orden_lineas').insert(
      datos.lineas.map((l, i) => ({ orden_id: orden.id, posicion: i, tipologia_id: l.tipologia_id, color_id: l.color_id, ancho_total: l.ancho_total, alto_total: l.alto_total, alto_izquierda: l.alto_izquierda, alto_derecha: l.alto_derecha, unidades_totales: l.unidades_totales, referencia: l.referencia }))
    )
  }
  revalidatePath('/ordenes')
  return orden
}

export async function actualizarOrden(id: number, datos: {
  nota_id: number | null; cliente_id: number | null
  observaciones: string
  lineas: Omit<LineaOrden, 'id' | 'tipologia' | 'color_nombre'>[]
}): Promise<void> {
  const supabase = await createClient()
  await supabase.from('ordenes_trabajo').update({ nota_id: datos.nota_id, cliente_id: datos.cliente_id, notas: datos.observaciones.trim() || null, actualizado_en: new Date().toISOString() }).eq('id', id)
  await supabase.from('orden_lineas').delete().eq('orden_id', id)
  if (datos.lineas.length > 0) {
    await supabase.from('orden_lineas').insert(
      datos.lineas.map((l, i) => ({ orden_id: id, posicion: i, tipologia_id: l.tipologia_id, color_id: l.color_id, ancho_total: l.ancho_total, alto_total: l.alto_total, alto_izquierda: l.alto_izquierda, alto_derecha: l.alto_derecha, unidades_totales: l.unidades_totales, referencia: l.referencia }))
    )
  }
  revalidatePath('/ordenes')
}

export async function eliminarOrden(id: number): Promise<void> {
  const supabase = await createClient()
  await supabase.from('orden_lineas').delete().eq('orden_id', id)
  await supabase.from('ordenes_trabajo').delete().eq('id', id)
  revalidatePath('/ordenes')
}

// ─── BÚSQUEDAS ────────────────────────────────────────────────────────────────

export async function buscarNotaParaOrden(numero: number) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('notas')
    .select('id, numero_nota, cliente_id, clientes ( nombre, telefono ), tipo_notas ( nombre )')
    .eq('numero_nota', numero)
    .single()
  if (!data) return null
  return { id: data.id, numero_nota: data.numero_nota, cliente_id: data.cliente_id, clientes: uno((data as any).clientes), tipo_notas: uno((data as any).tipo_notas) }
}

export async function buscarClientesParaOrden(termino: string) {
  const supabase = await createClient()
  const t = termino.trim()
  if (t.length < 2) return []
  const { data } = await supabase
    .from('clientes').select('id, nombre, telefono')
    .or(`nombre.ilike.%${t}%,telefono.ilike.%${t}%`)
    .limit(8)
  return data ?? []
}
