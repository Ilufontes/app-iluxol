'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { LARGOS_BARRA_ENTERA } from '@/lib/planificadorPerfiles'

export type ReglaStockMinimo = {
  id: number
  catalogo_perfil_id: number
  color_id: number
  unidades_minimas: number
  referencia: string
  descripcion: string
  color_nombre: string
  barras_actuales: number
}

export type AvisoStockMinimo = Pick<ReglaStockMinimo,
  'id' | 'referencia' | 'descripcion' | 'color_nombre' | 'unidades_minimas' | 'barras_actuales'>

// Una «barra» es una pieza entera (6000 o 6500 mm). Los retales no cuentan.
async function contarBarras(supabase: Awaited<ReturnType<typeof createClient>>, perfilId: number, colorId: number) {
  const { count } = await supabase
    .from('stock_perfiles')
    .select('id', { count: 'exact', head: true })
    .eq('catalogo_perfil_id', perfilId)
    .eq('color_id', colorId)
    .in('medida', LARGOS_BARRA_ENTERA)
  return count ?? 0
}

export async function cargarReglasStockMinimo(): Promise<ReglaStockMinimo[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('stock_minimo_perfiles')
    .select('id, catalogo_perfil_id, color_id, unidades_minimas, catalogo:catalogo_perfiles(referencia, descripcion), color:colores(nombre)')
    .order('id')
  if (error) { console.error('[cargarReglasStockMinimo]', error.message); return [] }
  const filas = (data ?? []) as any[]
  const cantidades = await Promise.all(filas.map(r => contarBarras(supabase, r.catalogo_perfil_id, r.color_id)))
  return filas.map((r, i) => {
    const cat = Array.isArray(r.catalogo) ? r.catalogo[0] : r.catalogo
    const col = Array.isArray(r.color) ? r.color[0] : r.color
    return {
      id: r.id, catalogo_perfil_id: r.catalogo_perfil_id, color_id: r.color_id,
      unidades_minimas: r.unidades_minimas,
      referencia: cat?.referencia ?? '?', descripcion: cat?.descripcion ?? '',
      color_nombre: col?.nombre ?? '?', barras_actuales: cantidades[i],
    }
  })
}

/** Reglas cuyo número de barras ha bajado del mínimo. Solo avisa de lo que está en la lista. */
export async function cargarAvisosStockMinimo(): Promise<AvisoStockMinimo[]> {
  const reglas = await cargarReglasStockMinimo()
  return reglas
    .filter(r => r.barras_actuales < r.unidades_minimas)
    .map(({ id, referencia, descripcion, color_nombre, unidades_minimas, barras_actuales }) =>
      ({ id, referencia, descripcion, color_nombre, unidades_minimas, barras_actuales }))
}

export async function crearReglaStockMinimo(datos: {
  catalogo_perfil_id: number; color_id: number; unidades_minimas: number
}): Promise<void> {
  if (!Number.isInteger(datos.unidades_minimas) || datos.unidades_minimas < 1)
    throw new Error('Las unidades mínimas deben ser un número entero de 1 o más.')
  const supabase = await createClient()
  const { error } = await supabase.from('stock_minimo_perfiles').insert(datos)
  if (error) throw new Error(error.code === '23505'
    ? 'Ya existe un aviso para ese perfil y color. Edita sus unidades en la lista.'
    : 'No se pudo guardar el aviso.')
  revalidatePath('/stock-minimo'); revalidatePath('/')
}

export async function actualizarUnidadesStockMinimo(id: number, unidades: number): Promise<void> {
  if (!Number.isInteger(unidades) || unidades < 1)
    throw new Error('Las unidades mínimas deben ser un número entero de 1 o más.')
  const supabase = await createClient()
  const { error } = await supabase.from('stock_minimo_perfiles').update({ unidades_minimas: unidades }).eq('id', id)
  if (error) throw new Error('No se pudo actualizar.')
  revalidatePath('/stock-minimo'); revalidatePath('/')
}

export async function eliminarReglaStockMinimo(id: number): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('stock_minimo_perfiles').delete().eq('id', id)
  if (error) throw new Error('No se pudo eliminar.')
  revalidatePath('/stock-minimo'); revalidatePath('/')
}
