'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function buscarClientes(termino: string) {
  const supabase = await createClient()
  const t = termino.trim()
  if (!t) return []

  const { data, error } = await supabase
    .from('clientes')
    .select('id, nombre, telefono, telefono2, email, domicilios ( id, direccion, zona, municipios ( nombre ) )')
    .or(`nombre.ilike.%${t}%,telefono.ilike.%${t}%`)
    .limit(10)

  if (error) return []
  return data
}

export async function crearClienteRapido(datos: {
  nombre: string
  telefono: string
  telefono2?: string
  email?: string
  otros_datos?: string
}) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('clientes')
    .insert(datos)
    .select('id, nombre, telefono, telefono2, email, otros_datos')
    .single()

  if (error) throw new Error('No se pudo crear el cliente.')
  revalidatePath('/clientes')
  return { ...data, domicilios: [] }
}

export async function crearDomicilioRapido(datos: {
  cliente_id: number
  direccion: string
  municipio_id: number
}) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('domicilios')
    .insert(datos)
    .select('id, direccion, municipios ( nombre )')
    .single()

  if (error) throw new Error('No se pudo crear el domicilio.')
  revalidatePath('/clientes')
  return data
}

export async function crearNota(datos: {
  cliente_id: number
  domicilio_id: number | null
  tipo_nota_id: number
  asignado_id: number | null
  fecha_entrada: string
  observaciones: string
  llevar_id: number | null
  dia_cita: string | null
  hora_cita: string | null
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('notas')
    .insert({ ...datos, creado_por: user?.id ?? null })
    .select(`
      id, numero_nota, fecha_entrada, observaciones, dia_cita, hora_cita,
      cliente_id, domicilio_id, tipo_nota_id, asignado_id, llevar_id,
      clientes ( id, nombre, telefono, telefono2, email ),
      domicilios ( id, direccion, zona, municipios ( nombre ) ),
      tipo_notas ( nombre ),
      asignados ( nombre ),
      llevar_opciones ( nombre )
    `)
    .single()

  if (error) throw new Error('No se pudo guardar la nota.')

  revalidatePath('/notas')
  return data
}

export async function actualizarNota(
  id: number,
  datos: {
    cliente_id: number
    domicilio_id: number | null
    tipo_nota_id: number
    asignado_id: number | null
    fecha_entrada: string
    observaciones: string
    llevar_id: number | null
    dia_cita: string | null
    hora_cita: string | null
  }
) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('notas')
    .update({ ...datos, actualizado_en: new Date().toISOString() })
    .eq('id', id)
    .select(`
      id, numero_nota, fecha_entrada, observaciones, dia_cita, hora_cita,
      cliente_id, domicilio_id, tipo_nota_id, asignado_id, llevar_id,
      clientes ( id, nombre, telefono, telefono2, email ),
      domicilios ( id, direccion, zona, municipios ( nombre ) ),
      tipo_notas ( nombre ),
      asignados ( nombre ),
      llevar_opciones ( nombre )
    `)
    .single()

  if (error) throw new Error('No se pudo actualizar la nota.')

  revalidatePath('/notas')
  return data
}
