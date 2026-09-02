'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type PerfilCatalogo = {
  id: number
  referencia: string
  descripcion: string
  activo: boolean
}

export async function cargarCatalogoPerfiles(): Promise<PerfilCatalogo[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('catalogo_perfiles')
    .select('id, referencia, descripcion, activo')
    .order('referencia')
  if (error) throw new Error('No se pudo cargar el catálogo de perfiles.')
  return data ?? []
}

export async function crearPerfilCatalogo(datos: { referencia: string; descripcion: string }): Promise<PerfilCatalogo> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('catalogo_perfiles')
    .insert({ referencia: datos.referencia.trim(), descripcion: datos.descripcion.trim() })
    .select('id, referencia, descripcion, activo')
    .single()
  if (error || !data) throw new Error(error?.code === '23505' ? 'Ya existe un perfil con esa referencia.' : 'No se pudo crear el perfil.')
  revalidatePath('/catalogo-perfiles')
  revalidatePath('/tipologias')
  return data
}

export async function actualizarPerfilCatalogo(id: number, datos: { referencia: string; descripcion: string }): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('catalogo_perfiles')
    .update({ referencia: datos.referencia.trim(), descripcion: datos.descripcion.trim() })
    .eq('id', id)
  if (error) throw new Error(error.code === '23505' ? 'Ya existe un perfil con esa referencia.' : 'No se pudo actualizar el perfil.')
  revalidatePath('/catalogo-perfiles')
  revalidatePath('/tipologias')
}

export async function toggleActivoPerfilCatalogo(id: number, activo: boolean): Promise<void> {
  const supabase = await createClient()
  await supabase.from('catalogo_perfiles').update({ activo }).eq('id', id)
  revalidatePath('/catalogo-perfiles')
  revalidatePath('/tipologias')
}
