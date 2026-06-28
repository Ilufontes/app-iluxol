'use server'

import { createClient } from '@/lib/supabase/server'

function normalizar(texto: string) {
  return texto
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quita acentos/tildes
    .replace(/\.[a-z0-9]+$/i, '') // quita extensión si la hubiera
    .replace(/\(\d+\)/g, '') // quita sufijos tipo (2), (3)
    .replace(/[^A-Z0-9]+/g, ' ') // cualquier símbolo raro a espacio
    .trim()
    .replace(/\s+/g, ' ')
}

export type ClienteParaMatch = { id: number; nombre: string }

let cacheClientes: ClienteParaMatch[] | null = null

export async function cargarClientesParaMatch(): Promise<ClienteParaMatch[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('clientes').select('id, nombre')
  cacheClientes = data ?? []
  return cacheClientes
}

export type ResultadoMatch =
  | { tipo: 'exacto'; clienteId: number; clienteNombre: string }
  | { tipo: 'sin_coincidencia' }
  | { tipo: 'multiple'; opciones: { id: number; nombre: string }[] }

export async function emparejarNombreArchivo(
  nombreArchivo: string,
  clientes: ClienteParaMatch[]
): Promise<ResultadoMatch> {
  const base = normalizar(nombreArchivo)

  const exactos = clientes.filter((c) => normalizar(c.nombre) === base)
  if (exactos.length === 1) {
    return { tipo: 'exacto', clienteId: exactos[0].id, clienteNombre: exactos[0].nombre }
  }
  if (exactos.length > 1) {
    return { tipo: 'multiple', opciones: exactos.map((c) => ({ id: c.id, nombre: c.nombre })) }
  }

  // Coincidencia donde uno "contiene" al otro (para casos como "FRANJUPLA S.L EMMA" vs "FRANJUPLA SL")
  const contenidos = clientes.filter((c) => {
    const n = normalizar(c.nombre)
    return n.length > 4 && (n.includes(base) || base.includes(n))
  })
  if (contenidos.length === 1) {
    return { tipo: 'exacto', clienteId: contenidos[0].id, clienteNombre: contenidos[0].nombre }
  }
  if (contenidos.length > 1) {
    return { tipo: 'multiple', opciones: contenidos.map((c) => ({ id: c.id, nombre: c.nombre })) }
  }

  return { tipo: 'sin_coincidencia' }
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

  if (errorSubida) throw new Error('No se pudo subir: ' + errorSubida.message)

  const { error: errorInsert } = await supabase
    .from('clientes_documentos')
    .insert({
      cliente_id: clienteId,
      nombre_archivo: nombreOriginal,
      ruta_storage: ruta,
      tipo: 'LOPD',
    })

  if (errorInsert) throw new Error('No se pudo registrar en la base de datos: ' + errorInsert.message)

  await supabase.from('clientes').update({ lpd_firmado: true }).eq('id', clienteId)

  return { ok: true }
}
