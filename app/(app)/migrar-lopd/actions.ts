'use server'

import { createClient } from '@/lib/supabase/server'

export type ClienteParaMatch = { id: number; nombre: string }

export async function cargarClientesParaMatch(): Promise<ClienteParaMatch[]> {
  const supabase = await createClient()

  // Supabase limita a 1000 filas por defecto si no se especifica un rango.
  // Con más de 1700 clientes, hay que paginar explícitamente para traerlos todos.
  const PAGINA = 1000
  let desde = 0
  let todos: ClienteParaMatch[] = []

  while (true) {
    const { data, error } = await supabase
      .from('clientes')
      .select('id, nombre')
      .range(desde, desde + PAGINA - 1)

    if (error || !data || data.length === 0) break
    todos = todos.concat(data)
    if (data.length < PAGINA) break
    desde += PAGINA
  }

  return todos
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
