'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type PerfilCatalogoOpcion = { id: number; referencia: string; descripcion: string; activo: boolean }
export type ColorOpcion   = { id: number; nombre: string; activo: boolean }
export type EstanteOpcion = { id: number; nombre: string; activo: boolean }

export type PiezaStock = {
  id: number
  catalogo_perfil_id: number
  referencia: string
  descripcion: string
  codigo: string
  medida: number
  color_id: number | null
  color_nombre: string | null
  estante_id: number | null
  estante_nombre: string | null
  creado_en: string
}

function uno(v: any) { return Array.isArray(v) ? (v[0] ?? null) : v }

const SELECT_STOCK = `
  id, catalogo_perfil_id, codigo, medida, color_id, estante_id, creado_en,
  catalogo_perfiles ( referencia, descripcion ),
  colores ( nombre ),
  estantes ( nombre )
`

function normalizar(fila: any): PiezaStock {
  const cat = uno(fila.catalogo_perfiles)
  return {
    id: fila.id, catalogo_perfil_id: fila.catalogo_perfil_id,
    referencia: cat?.referencia ?? '—', descripcion: cat?.descripcion ?? '—',
    codigo: fila.codigo, medida: fila.medida,
    color_id: fila.color_id, color_nombre: uno(fila.colores)?.nombre ?? null,
    estante_id: fila.estante_id, estante_nombre: uno(fila.estantes)?.nombre ?? null,
    creado_en: fila.creado_en,
  }
}

export async function cargarStockPerfiles(): Promise<PiezaStock[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('stock_perfiles')
    .select(SELECT_STOCK)
    .order('creado_en', { ascending: false })
  if (error) { console.error('[cargarStockPerfiles]', error.message); return [] }
  return (data ?? []).map(normalizar)
}

export async function cargarCatalogoParaInventario(): Promise<PerfilCatalogoOpcion[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('catalogo_perfiles').select('id, referencia, descripcion, activo').order('referencia')
  return data ?? []
}

export async function cargarColoresParaInventario(): Promise<ColorOpcion[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('colores').select('id, nombre, activo').order('nombre')
  return data ?? []
}

export async function cargarEstantesParaInventario(): Promise<EstanteOpcion[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('estantes').select('id, nombre, activo').order('nombre')
  return data ?? []
}

export async function crearPiezaStock(datos: {
  catalogo_perfil_id: number; codigo: string; medida: number
  color_id: number | null; estante_id: number | null
}): Promise<PiezaStock> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('stock_perfiles')
    .insert({
      catalogo_perfil_id: datos.catalogo_perfil_id,
      codigo: datos.codigo.trim(),
      medida: datos.medida,
      color_id: datos.color_id,
      estante_id: datos.estante_id,
    })
    .select(SELECT_STOCK)
    .single()
  if (error || !data) throw new Error('No se pudo crear la pieza de stock.')
  revalidatePath('/inventario-mosquiteros')
  return normalizar(data)
}

export async function actualizarPiezaStock(id: number, datos: {
  catalogo_perfil_id: number; codigo: string; medida: number
  color_id: number | null; estante_id: number | null
}): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('stock_perfiles').update({
    catalogo_perfil_id: datos.catalogo_perfil_id,
    codigo: datos.codigo.trim(),
    medida: datos.medida,
    color_id: datos.color_id,
    estante_id: datos.estante_id,
    actualizado_en: new Date().toISOString(),
  }).eq('id', id)
  if (error) throw new Error('No se pudo actualizar la pieza de stock.')
  revalidatePath('/inventario-mosquiteros')
}

export async function eliminarPiezaStock(id: number): Promise<void> {
  const supabase = await createClient()
  await supabase.from('stock_perfiles').delete().eq('id', id)
  revalidatePath('/inventario-mosquiteros')
}
