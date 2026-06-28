'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function buscarClientesGlobal(termino: string) {
  const supabase = await createClient()
  const t = termino.trim()
  if (!t) return []

  const { data, error } = await supabase
    .from('clientes')
    .select(`
      id, nombre, telefono, telefono2, email, otros_datos, dni, lpd_firmado,
      domicilios ( id, direccion, municipio_id, zona, datos_vivienda, municipios ( nombre ) )
    `)
    .or(`nombre.ilike.%${t}%,telefono.ilike.%${t}%,telefono2.ilike.%${t}%,email.ilike.%${t}%`)
    .order('id', { ascending: false })
    .limit(100)

  if (error) return []
  return data
}

export async function crearCliente(datos: {
  nombre: string
  telefono: string
  telefono2: string
  email: string
  otros_datos: string
}) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('clientes')
    .insert(datos)
    .select('id, nombre, telefono, telefono2, email, otros_datos, dni, lpd_firmado')
    .single()

  if (error) throw new Error('No se pudo crear el cliente.')

  revalidatePath('/clientes')
  return data
}

export async function actualizarCliente(
  id: number,
  datos: {
    nombre: string
    telefono: string
    telefono2: string
    email: string
    otros_datos: string
    dni: string
    lpd_firmado: boolean
  }
) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('clientes')
    .update({ ...datos, actualizado_en: new Date().toISOString() })
    .eq('id', id)

  if (error) throw new Error('No se pudo actualizar el cliente.')

  revalidatePath('/clientes')
}

export async function crearDomicilio(datos: {
  cliente_id: number
  direccion: string
  municipio_id: number
  zona?: string
  datos_vivienda?: string
}) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('domicilios')
    .insert(datos)
    .select('id, direccion, municipio_id, zona, datos_vivienda, municipios(nombre)')
    .single()

  if (error) throw new Error('No se pudo crear el domicilio.')

  revalidatePath('/clientes')
  return data
}

export async function actualizarDomicilio(
  id: number,
  datos: {
    direccion: string
    municipio_id: number
    zona: string
    datos_vivienda: string
  }
) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('domicilios')
    .update(datos)
    .eq('id', id)
    .select('id, direccion, municipio_id, zona, datos_vivienda, municipios(nombre)')
    .single()

  if (error) throw new Error('No se pudo actualizar el domicilio.')

  revalidatePath('/clientes')
  return data
}

export async function listarFotosDomicilio(domicilioId: number) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('domicilios_fotos')
    .select('id, ruta_storage, descripcion, subido_en')
    .eq('domicilio_id', domicilioId)
    .order('subido_en', { ascending: false })

  if (error) return []

  const conUrl = await Promise.all(
    data.map(async (foto) => {
      const { data: firmada } = await supabase.storage
        .from('domicilios-fotos')
        .createSignedUrl(foto.ruta_storage, 3600)
      return { ...foto, url: firmada?.signedUrl ?? null }
    })
  )
  return conUrl
}

export async function subirFotoDomicilio(domicilioId: number, formData: FormData) {
  const archivo = formData.get('archivo') as File | null
  if (!archivo) throw new Error('No se recibió ningún archivo.')

  const supabase = await createClient()
  const extension = archivo.name.split('.').pop() || 'jpg'
  const ruta = `domicilio-${domicilioId}/${Date.now()}.${extension}`

  const { error: errorSubida } = await supabase.storage
    .from('domicilios-fotos')
    .upload(ruta, archivo)

  if (errorSubida) throw new Error('No se pudo subir la foto.')

  const { error: errorInsert } = await supabase
    .from('domicilios_fotos')
    .insert({ domicilio_id: domicilioId, ruta_storage: ruta })

  if (errorInsert) throw new Error('No se pudo registrar la foto.')

  revalidatePath('/clientes')
}

export async function borrarFotoDomicilio(fotoId: number, rutaStorage: string) {
  const supabase = await createClient()

  await supabase.storage.from('domicilios-fotos').remove([rutaStorage])

  const { error } = await supabase.from('domicilios_fotos').delete().eq('id', fotoId)
  if (error) throw new Error('No se pudo borrar la foto.')

  revalidatePath('/clientes')
}

export async function listarDocumentosCliente(clienteId: number) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('clientes_documentos')
    .select('id, nombre_archivo, ruta_storage, tipo, subido_en')
    .eq('cliente_id', clienteId)
    .order('subido_en', { ascending: false })

  if (error) return []

  const conUrl = await Promise.all(
    data.map(async (doc) => {
      const { data: firmada } = await supabase.storage
        .from('clientes-documentos')
        .createSignedUrl(doc.ruta_storage, 3600)
      return { ...doc, url: firmada?.signedUrl ?? null }
    })
  )
  return conUrl
}

export async function subirDocumentoCliente(clienteId: number, formData: FormData) {
  const archivo = formData.get('archivo') as File | null
  if (!archivo) throw new Error('No se recibió ningún archivo.')

  const supabase = await createClient()
  const extension = archivo.name.split('.').pop() || 'pdf'
  const ruta = `cliente-${clienteId}/${Date.now()}.${extension}`

  const { error: errorSubida } = await supabase.storage
    .from('clientes-documentos')
    .upload(ruta, archivo)

  if (errorSubida) throw new Error('No se pudo subir el documento.')

  const { error: errorInsert } = await supabase
    .from('clientes_documentos')
    .insert({
      cliente_id: clienteId,
      nombre_archivo: archivo.name,
      ruta_storage: ruta,
      tipo: 'LOPD',
    })

  if (errorInsert) throw new Error('No se pudo registrar el documento.')

  // Subir el LOPD firmado implica que ya está firmado: lo marcamos automáticamente.
  await supabase.from('clientes').update({ lpd_firmado: true }).eq('id', clienteId)

  revalidatePath('/clientes')
}

export async function borrarDocumentoCliente(documentoId: number, rutaStorage: string) {
  const supabase = await createClient()

  await supabase.storage.from('clientes-documentos').remove([rutaStorage])

  const { error } = await supabase.from('clientes_documentos').delete().eq('id', documentoId)
  if (error) throw new Error('No se pudo borrar el documento.')

  revalidatePath('/clientes')
}
