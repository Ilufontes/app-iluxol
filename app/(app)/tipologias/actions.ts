'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ─── TIPOS ────────────────────────────────────────────────────────────────────

export type VariableClave = 'ancho_total' | 'alto_total' | 'alto_izquierda' | 'alto_derecha'

// Tipos separados para evitar problemas con Omit sobre uniones discriminadas
export type FilaVariable = {
  id?: number
  tipo: 'variable'
  variable_clave: VariableClave
  posicion: number
}

export type FilaPerfil = {
  id?: number
  tipo: 'perfil'
  nombre_perfil: string
  formula: string
  unidades: number
  posicion: number
}

export type FilaTipologia = FilaVariable | FilaPerfil

// Tipos sin id (para crear/editar)
export type FilaVariableNueva = Omit<FilaVariable, 'id'>
export type FilaPerfilNueva   = Omit<FilaPerfil, 'id'>
export type FilaNueva         = FilaVariableNueva | FilaPerfilNueva

export type Tipologia = {
  id: number
  nombre: string
  notas: string | null
  activo: boolean
  tipologia_filas: FilaTipologia[]
}

// ─── LISTADO ──────────────────────────────────────────────────────────────────

export async function cargarTipologias(): Promise<Tipologia[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('tipologias')
    .select('id, nombre, notas, activo, tipologia_filas ( id, tipo, variable_clave, nombre_perfil, formula, unidades, posicion )')
    .order('nombre')
  if (error) throw new Error('No se pudieron cargar las tipologías.')
  return (data ?? []).map(t => ({
    ...t,
    tipologia_filas: [...(t.tipologia_filas as FilaTipologia[])].sort((a, b) => a.posicion - b.posicion),
  }))
}

// ─── CREAR ────────────────────────────────────────────────────────────────────

export async function crearTipologia(datos: {
  nombre: string
  notas?: string
  filas: FilaNueva[]
}): Promise<Tipologia> {
  const supabase = await createClient()

  const { data: tipologia, error } = await supabase
    .from('tipologias')
    .insert({ nombre: datos.nombre.trim(), notas: datos.notas?.trim() || null })
    .select('id, nombre, notas, activo')
    .single()

  if (error || !tipologia) throw new Error('No se pudo crear la tipología.')

  if (datos.filas.length > 0) {
    const filasParaInsertar = datos.filas.map((f, i) => ({
      tipologia_id: tipologia.id,
      posicion: i,
      tipo: f.tipo,
      variable_clave: f.tipo === 'variable' ? f.variable_clave : null,
      nombre_perfil:  f.tipo === 'perfil'   ? f.nombre_perfil  : null,
      formula:        f.tipo === 'perfil'   ? f.formula        : null,
      unidades:       f.tipo === 'perfil'   ? f.unidades       : null,
    }))
    await supabase.from('tipologia_filas').insert(filasParaInsertar)
  }

  revalidatePath('/tipologias')
  return { ...tipologia, tipologia_filas: datos.filas as FilaTipologia[] }
}

// ─── ACTUALIZAR ───────────────────────────────────────────────────────────────

export async function actualizarTipologia(
  id: number,
  datos: { nombre: string; notas?: string; filas: FilaNueva[] }
): Promise<void> {
  const supabase = await createClient()

  await supabase.from('tipologias').update({
    nombre: datos.nombre.trim(),
    notas: datos.notas?.trim() || null,
  }).eq('id', id)

  // Reemplazar todas las filas
  await supabase.from('tipologia_filas').delete().eq('tipologia_id', id)

  if (datos.filas.length > 0) {
    const filasParaInsertar = datos.filas.map((f, i) => ({
      tipologia_id: id,
      posicion: i,
      tipo: f.tipo,
      variable_clave: f.tipo === 'variable' ? f.variable_clave : null,
      nombre_perfil:  f.tipo === 'perfil'   ? f.nombre_perfil  : null,
      formula:        f.tipo === 'perfil'   ? f.formula        : null,
      unidades:       f.tipo === 'perfil'   ? f.unidades       : null,
    }))
    await supabase.from('tipologia_filas').insert(filasParaInsertar)
  }

  revalidatePath('/tipologias')
}

// ─── ACTIVAR / DESACTIVAR ─────────────────────────────────────────────────────

export async function toggleActivoTipologia(id: number, activo: boolean): Promise<void> {
  const supabase = await createClient()
  await supabase.from('tipologias').update({ activo }).eq('id', id)
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
  revalidatePath('/ajustes')
}

export async function toggleActivoColor(id: number, activo: boolean) {
  const supabase = await createClient()
  await supabase.from('colores').update({ activo }).eq('id', id)
  revalidatePath('/tipologias')
  revalidatePath('/ajustes')
}
