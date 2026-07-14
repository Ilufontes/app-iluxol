'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type VariableClave = 'ancho_total' | 'alto_total' | 'alto_izquierda' | 'alto_derecha'

export type TuboLado = 'superior' | 'inferior' | 'izquierda' | 'derecha'

export type FilaVariable = {
  id?: number; tipo: 'variable'; variable_clave: VariableClave; posicion: number
}
export type FilaPerfil = {
  id?: number; tipo: 'perfil'; nombre_perfil: string; formula: string; unidades: number; posicion: number
}
export type FilaTubo = {
  id?: number; tipo: 'tubo'; tubo_lado: TuboLado; unidades: number; posicion: number
}
export type FilaTipologia = FilaVariable | FilaPerfil | FilaTubo

export type FilaVariableNueva = Omit<FilaVariable, 'id'>
export type FilaPerfilNueva   = Omit<FilaPerfil, 'id'>
export type FilaTubaNueva     = Omit<FilaTubo, 'id'>
export type FilaNueva         = FilaVariableNueva | FilaPerfilNueva | FilaTubaNueva

export type TipoTubo = { id: number; nombre: string; descuento: number; activo: boolean }

export type Tipologia = {
  id: number
  nombre: string
  notas: string | null
  activo: boolean
  imagen_url: string | null
  tipo_tubo_id: number | null
  tipo_tubo: TipoTubo | null
  tipologia_filas: FilaTipologia[]
}

export async function cargarTipologias(): Promise<Tipologia[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('tipologias')
    .select('id, nombre, notas, activo, imagen_url, tipo_tubo_id, tipos_tubo ( id, nombre, descuento, activo ), tipologia_filas ( id, tipo, variable_clave, nombre_perfil, formula, unidades, posicion, tubo_lado, tubo_unidades )')
    .order('nombre')
  if (error) throw new Error('No se pudieron cargar las tipologías.')
  function unoT(v: any) { return Array.isArray(v) ? (v[0] ?? null) : v }
  return (data ?? []).map(t => ({
    ...t,
    imagen_url:   (t as any).imagen_url   ?? null,
    tipo_tubo_id: (t as any).tipo_tubo_id ?? null,
    tipo_tubo:    unoT((t as any).tipos_tubo),
    tipologia_filas: [...((t as any).tipologia_filas as FilaTipologia[])].sort((a, b) => a.posicion - b.posicion),
  }))
}

export async function crearTipologia(datos: {
  nombre: string; notas?: string; filas: FilaNueva[]
}): Promise<Tipologia> {
  const supabase = await createClient()
  const { data: tipologia, error } = await supabase
    .from('tipologias')
    .insert({ nombre: datos.nombre.trim(), notas: datos.notas?.trim() || null })
    .select('id, nombre, notas, activo, imagen_url')
    .single()
  if (error || !tipologia) throw new Error('No se pudo crear la tipología.')
  if (datos.filas.length > 0) {
    await supabase.from('tipologia_filas').insert(datos.filas.map((f, i) => ({
      tipologia_id: tipologia.id, posicion: i, tipo: f.tipo,
      variable_clave: f.tipo === 'variable' ? f.variable_clave : null,
      nombre_perfil:  f.tipo === 'perfil' ? f.nombre_perfil : null,
      formula:        f.tipo === 'perfil' ? f.formula : null,
      unidades:       f.tipo === 'perfil' ? f.unidades : null,
      tubo_lado:      f.tipo === 'tubo' ? f.tubo_lado : null,
      tubo_unidades:  f.tipo === 'tubo' ? f.unidades : null,
    })))
  }
  revalidatePath('/tipologias')
  return { ...(tipologia as any), imagen_url: null, tipologia_filas: datos.filas as FilaTipologia[] }
}

export async function actualizarTipologia(
  id: number,
  datos: { nombre: string; notas?: string; filas: FilaNueva[] }
): Promise<void> {
  const supabase = await createClient()
  await supabase.from('tipologias').update({
    nombre: datos.nombre.trim(), notas: datos.notas?.trim() || null,
  }).eq('id', id)
  await supabase.from('tipologia_filas').delete().eq('tipologia_id', id)
  if (datos.filas.length > 0) {
    await supabase.from('tipologia_filas').insert(datos.filas.map((f, i) => ({
      tipologia_id: id, posicion: i, tipo: f.tipo,
      variable_clave: f.tipo === 'variable' ? f.variable_clave : null,
      nombre_perfil:  f.tipo === 'perfil' ? f.nombre_perfil : null,
      formula:        f.tipo === 'perfil' ? f.formula : null,
      unidades:       f.tipo === 'perfil' ? f.unidades : null,
      tubo_lado:      f.tipo === 'tubo' ? f.tubo_lado : null,
      tubo_unidades:  f.tipo === 'tubo' ? f.unidades : null,
    })))
  }
  revalidatePath('/tipologias')
}

export async function toggleActivoTipologia(id: number, activo: boolean): Promise<void> {
  const supabase = await createClient()
  await supabase.from('tipologias').update({ activo }).eq('id', id)
  revalidatePath('/tipologias')
}

// ─── IMAGEN ───────────────────────────────────────────────────────────────────

export async function subirImagenTipologia(id: number, formData: FormData): Promise<string> {
  const supabase = await createClient()
  const archivo = formData.get('imagen') as File
  if (!archivo) throw new Error('No se recibió archivo.')

  const ext  = archivo.name.split('.').pop()
  const ruta = `tipologia-${id}-${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from('tipologias-imagenes')
    .upload(ruta, archivo, { upsert: true })

  if (error) throw new Error('No se pudo subir la imagen.')

  const { data: urlData } = supabase.storage.from('tipologias-imagenes').getPublicUrl(ruta)
  const url = urlData.publicUrl

  await supabase.from('tipologias').update({ imagen_url: url }).eq('id', id)
  revalidatePath('/tipologias')
  return url
}

export async function borrarImagenTipologia(id: number): Promise<void> {
  const supabase = await createClient()
  await supabase.from('tipologias').update({ imagen_url: null }).eq('id', id)
  revalidatePath('/tipologias')
}

// ─── COLORES ──────────────────────────────────────────────────────────────────

export async function cargarColores() {
  const supabase = await createClient()
  const { data } = await supabase.from('colores').select('id, nombre, activo').order('nombre')
  return data ?? []
}

export async function crearColor(nombre: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('colores').insert({ nombre: nombre.trim().toUpperCase() })
  if (error) throw new Error(error.code === '23505' ? 'Ese color ya existe.' : 'No se pudo crear el color.')
  revalidatePath('/tipologias')
}

export async function toggleActivoColor(id: number, activo: boolean) {
  const supabase = await createClient()
  await supabase.from('colores').update({ activo }).eq('id', id)
  revalidatePath('/tipologias')
}

export async function cargarTiposTubo(): Promise<TipoTubo[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('tipos_tubo').select('id, nombre, descuento, activo').order('nombre')
  return (data ?? []) as TipoTubo[]
}

export async function actualizarTipoTuboTipologia(tipologiaId: number, tipoTuboId: number | null): Promise<void> {
  const supabase = await createClient()
  await supabase.from('tipologias').update({ tipo_tubo_id: tipoTuboId }).eq('id', tipologiaId)
  revalidatePath('/tipologias')
}
