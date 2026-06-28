'use server'

import { createClient } from '@/lib/supabase/server'

export type ClienteParaMatch = { id: number; nombre: string }

export async function cargarClientesParaMatch(): Promise<ClienteParaMatch[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('clientes').select('id, nombre')
  return data ?? []
}

export async function subirDocumentoLopdMasivo(clienteId: number, nombreOriginal: string, formData: FormData) {
  const archivo = formData.get('archivo') as File | null
  if (!archivo) throw new Error('No se recibió ningún archivo.')

  const supabase = await createClient()
  const extension = nombreOriginal.split('.').pop() || 'pdf'
  const ruta = `cliente-${clienteId}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${extension}`

  const { error: errorSubida } = await supabase.storage
    .from('clientes-documentos')
    .upload(ruta, archivo)

  if (errorSubida) throw new Error('No se pudo subir el archivo: ' + errorSubida.message)

  const { data: insertado, error: errorInsert } = await supabase
    .from('clientes_documentos')
    .insert({
      cliente_id: clienteId,
      nombre_archivo: nombreOriginal,
      ruta_storage: ruta,
      tipo: 'LOPD',
    })
    .select('id')
    .single()

  if (errorInsert || !insertado) {
    // El archivo ya se subió a Storage pero el registro en la base de datos no se
    // pudo confirmar (a veces RLS descarta la fila sin devolver un error explícito).
    // Lo borramos del Storage para no dejar un archivo huérfano sin referencia.
    await supabase.storage.from('clientes-documentos').remove([ruta])
    throw new Error(
      errorInsert?.message ?? 'El documento no se pudo registrar en la base de datos (posible bloqueo de permisos).'
    )
  }

  await supabase.from('clientes').update({ lpd_firmado: true }).eq('id', clienteId)

  return { ok: true }
}
