'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type VariableClave = 'ancho_total' | 'alto_total' | 'alto_izquierda' | 'alto_derecha'
export type TuboLado = 'superior' | 'inferior' | 'izquierda' | 'derecha'
export type FilaVariable   = { id?: number; tipo: 'variable'; variable_clave: VariableClave; posicion: number }
export type FilaPerfil     = { id?: number; tipo: 'perfil'; nombre_perfil: string; formula: string; unidades: number; posicion: number }
export type FilaTubo       = { id?: number; tipo: 'tubo'; tubo_lado: TuboLado; unidades: number; posicion: number }
export type FilaTipologia  = FilaVariable | FilaPerfil | FilaTubo

export type TipoTubo = { id: number; nombre: string; descuento: number; activo: boolean }

export type Tipologia = {
  id: number; nombre: string; activo: boolean
  imagen_url: string | null
  tipo_tubo_id: number | null
  tipo_tubo: TipoTubo | null
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
  // Tubos opcionales
  tubo_superior:   boolean
  tubo_inferior:   boolean
  tubo_izquierda:  boolean
  tubo_derecha:    boolean
  tipo_tubo_id:    number | null
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

function uno(v: any) { return Array.isArray(v) ? (v[0] ?? null) : v }

const SELECT_LINEAS = `
  id, tipologia_id, color_id,
  ancho_total, alto_total, alto_izquierda, alto_derecha,
  unidades_totales, referencia, posicion,
  tubo_superior, tubo_inferior, tubo_izquierda, tubo_derecha, tipo_tubo_id,
  tipologias (
    id, nombre, activo, imagen_url, tipo_tubo_id,
    tipos_tubo ( id, nombre, descuento, activo ),
    tipologia_filas ( id, tipo, variable_clave, nombre_perfil, formula, unidades, posicion )
  ),
  colores ( nombre )
`

function normalizarLineas(lineas: any[]): LineaOrden[] {
  return [...lineas].sort((a, b) => a.posicion - b.posicion).map(l => {
    const tip     = uno(l.tipologias)
    const tipoTub = tip ? uno(tip.tipos_tubo) : null
    return {
      id: l.id, tipologia_id: l.tipologia_id,
      color_id: l.color_id, color_nombre: uno(l.colores)?.nombre ?? null,
      ancho_total: l.ancho_total, alto_total: l.alto_total,
      alto_izquierda: l.alto_izquierda, alto_derecha: l.alto_derecha,
      unidades_totales: l.unidades_totales,
      referencia: l.referencia ?? '', posicion: l.posicion,
      tubo_superior:  l.tubo_superior  ?? false,
      tubo_inferior:  l.tubo_inferior  ?? false,
      tubo_izquierda: l.tubo_izquierda ?? false,
      tubo_derecha:   l.tubo_derecha   ?? false,
      tipo_tubo_id:   l.tipo_tubo_id   ?? null,
      tipologia: tip ? {
        ...tip,
        imagen_url:   tip.imagen_url   ?? null,
        tipo_tubo_id: tip.tipo_tubo_id ?? null,
        tipo_tubo:    tipoTub,
        tipologia_filas: [...(tip.tipologia_filas ?? [])].sort((a: any, b: any) => a.posicion - b.posicion),
      } : null,
    }
  })
}

// ─── CATÁLOGO ─────────────────────────────────────────────────────────────────

export async function cargarTipologiasParaOrdenes(): Promise<Tipologia[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('tipologias')
    .select('id, nombre, activo, imagen_url, tipo_tubo_id, tipos_tubo ( id, nombre, descuento, activo ), tipologia_filas ( id, tipo, variable_clave, nombre_perfil, formula, unidades, posicion, tubo_lado, tubo_unidades )')
    .order('nombre')
  return (data ?? []).map((t: any) => ({
    ...t, imagen_url: t.imagen_url ?? null,
    tipo_tubo_id: t.tipo_tubo_id ?? null,
    tipo_tubo: uno(t.tipos_tubo),
    tipologia_filas: [...(t.tipologia_filas ?? [])].sort((a: any, b: any) => a.posicion - b.posicion),
  }))
}

export async function cargarColoresParaOrdenes(): Promise<Color[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('colores').select('id, nombre, activo').order('nombre')
  return data ?? []
}

export async function cargarTiposTuboParaOrdenes(): Promise<TipoTubo[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('tipos_tubo').select('id, nombre, descuento, activo').order('nombre')
  return (data ?? []) as TipoTubo[]
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
      id: o.id, numero_orden: o.numero_orden, nota_id: o.nota_id, numero_nota_rel: null,
      cliente_id: o.cliente_id, cliente_nombre: cliente?.nombre ?? null,
      cliente_telefono: cliente?.telefono ?? null,
      observaciones: o.notas, creado_en: o.creado_en,
      orden_lineas: normalizarLineas(o.orden_lineas ?? []),
    }
  })
}

// ─── CREAR / ACTUALIZAR / ELIMINAR ────────────────────────────────────────────

type DatosLinea = Omit<LineaOrden, 'id' | 'tipologia' | 'color_nombre'>

export async function crearOrden(datos: {
  nota_id: number | null; cliente_id: number | null
  observaciones: string; lineas: DatosLinea[]
}): Promise<{ id: number }> {
  const supabase = await createClient()
  const { data: orden, error } = await supabase
    .from('ordenes_trabajo')
    .insert({ nota_id: datos.nota_id, cliente_id: datos.cliente_id, notas: datos.observaciones.trim() || null })
    .select('id').single()
  if (error || !orden) throw new Error('No se pudo crear la orden.')
  if (datos.lineas.length > 0) {
    await supabase.from('orden_lineas').insert(
      datos.lineas.map((l, i) => ({
        orden_id: orden.id, posicion: i,
        tipologia_id: l.tipologia_id, color_id: l.color_id,
        ancho_total: l.ancho_total, alto_total: l.alto_total,
        alto_izquierda: l.alto_izquierda, alto_derecha: l.alto_derecha,
        unidades_totales: l.unidades_totales, referencia: l.referencia,
        tubo_superior: l.tubo_superior, tubo_inferior: l.tubo_inferior,
        tubo_izquierda: l.tubo_izquierda, tubo_derecha: l.tubo_derecha,
        tipo_tubo_id: l.tipo_tubo_id ?? null,
      }))
    )
  }
  revalidatePath('/ordenes')
  return orden
}

export async function actualizarOrden(id: number, datos: {
  nota_id: number | null; cliente_id: number | null
  observaciones: string; lineas: DatosLinea[]
}): Promise<void> {
  const supabase = await createClient()
  await supabase.from('ordenes_trabajo').update({
    nota_id: datos.nota_id, cliente_id: datos.cliente_id,
    notas: datos.observaciones.trim() || null,
    actualizado_en: new Date().toISOString(),
  }).eq('id', id)
  await supabase.from('orden_lineas').delete().eq('orden_id', id)
  if (datos.lineas.length > 0) {
    const { error: errLineas } = await supabase.from('orden_lineas').insert(
      datos.lineas.map((l, i) => ({
        orden_id: id, posicion: i,
        tipologia_id: l.tipologia_id, color_id: l.color_id,
        ancho_total: l.ancho_total, alto_total: l.alto_total,
        alto_izquierda: l.alto_izquierda, alto_derecha: l.alto_derecha,
        unidades_totales: l.unidades_totales, referencia: l.referencia,
        tubo_superior: l.tubo_superior, tubo_inferior: l.tubo_inferior,
        tubo_izquierda: l.tubo_izquierda, tubo_derecha: l.tubo_derecha,
        tipo_tubo_id: l.tipo_tubo_id ?? null,
      }))
    )
    if (errLineas) {
      console.error('[actualizarOrden] Error insertando líneas:', errLineas.message)
      throw new Error('No se pudieron guardar las líneas de la orden.')
    }
  }
  revalidatePath('/ordenes')
  revalidatePath('/ordenes-imprimir')
}

export async function eliminarOrden(id: number): Promise<void> {
  const supabase = await createClient()
  await supabase.from('orden_lineas').delete().eq('orden_id', id)
  await supabase.from('ordenes_trabajo').delete().eq('id', id)
  revalidatePath('/ordenes')
}

export async function buscarNotaParaOrden(numero: number) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('notas')
    .select('id, numero_nota, cliente_id, clientes ( nombre, telefono ), tipo_notas ( nombre )')
    .eq('numero_nota', numero).single()
  if (!data) return null
  return { id: data.id, numero_nota: data.numero_nota, cliente_id: data.cliente_id, clientes: uno((data as any).clientes), tipo_notas: uno((data as any).tipo_notas) }
}

export async function buscarClientesParaOrden(termino: string) {
  const supabase = await createClient()
  const t = termino.trim()
  if (t.length < 2) return []
  const { data } = await supabase.from('clientes').select('id, nombre, telefono')
    .or(`nombre.ilike.%${t}%,telefono.ilike.%${t}%`).limit(8)
  return data ?? []
}

// ─── AJUSTES: TIPOS DE TUBO ───────────────────────────────────────────────────

export async function cargarTiposTubo(): Promise<TipoTubo[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('tipos_tubo').select('id, nombre, descuento, activo').order('nombre')
  return (data ?? []) as TipoTubo[]
}

export async function crearTipoTubo(nombre: string, descuento: number): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('tipos_tubo').insert({ nombre: nombre.trim().toUpperCase(), descuento })
  if (error) throw new Error(error.code === '23505' ? 'Ese tipo de tubo ya existe.' : 'No se pudo crear.')
  revalidatePath('/ordenes/ajustes')
}

export async function toggleActivoTipoTubo(id: number, activo: boolean): Promise<void> {
  const supabase = await createClient()
  await supabase.from('tipos_tubo').update({ activo }).eq('id', id)
  revalidatePath('/ordenes/ajustes')
}

export async function crearColor(nombre: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('colores').insert({ nombre: nombre.trim().toUpperCase() })
  if (error) throw new Error(error.code === '23505' ? 'Ese color ya existe.' : 'No se pudo crear.')
  revalidatePath('/ordenes/ajustes')
  revalidatePath('/tipologias')
}

export async function toggleActivoColor(id: number, activo: boolean): Promise<void> {
  const supabase = await createClient()
  await supabase.from('colores').update({ activo }).eq('id', id)
  revalidatePath('/ordenes/ajustes')
  revalidatePath('/tipologias')
}
