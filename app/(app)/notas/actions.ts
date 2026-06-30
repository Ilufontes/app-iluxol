'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function buscarNotaPorNumero(numero: number) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('notas')
    .select(`
      id, numero_nota, fecha_entrada, observaciones, dia_cita, hora_cita,
      cliente_id, domicilio_id, tipo_nota_id, asignado_id, llevar_id,
      clientes ( id, nombre, telefono, telefono2, email ),
      domicilios ( id, direccion, zona, municipio_id, municipios ( nombre ) ),
      tipo_notas ( nombre ),
      asignados ( nombre, color ),
      llevar_opciones ( nombre )
    `)
    .eq('numero_nota', numero)
    .maybeSingle()

  if (error) return null
  return data
}

export async function buscarClientes(termino: string) {
  const supabase = await createClient()
  const t = termino.trim()
  if (!t) return []

  const { data, error } = await supabase
    .from('clientes')
    .select('id, nombre, telefono, telefono2, email, lpd_firmado, domicilios ( id, direccion, zona, municipios ( nombre ) )')
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
    .select('id, nombre, telefono, telefono2, email, otros_datos, lpd_firmado')
    .single()

  if (error) throw new Error('No se pudo crear el cliente.')
  revalidatePath('/clientes')
  return { ...data, domicilios: [] }
}

export async function crearDomicilioRapido(datos: {
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
    .select('id, direccion, zona, datos_vivienda, municipios ( nombre )')
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
      asignados ( nombre, color ),
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
      asignados ( nombre, color ),
      llevar_opciones ( nombre )
    `)
    .single()

  if (error) throw new Error('No se pudo actualizar la nota.')

  revalidatePath('/notas')
  return data
}

export async function enviarNotaACalendarioAction(notaId: number) {
  const { enviarNotaAlCalendario } = await import('@/lib/googleCalendar')
  const { generarPdfNota } = await import('@/lib/generarPdfNota')

  const supabase = await createClient()

  const { data: nota, error } = await supabase
    .from('notas')
    .select(`
      id, numero_nota, fecha_entrada, observaciones, dia_cita, hora_cita,
      clientes ( nombre, telefono, telefono2, email ),
      domicilios ( direccion, zona, municipios ( nombre ) ),
      tipo_notas ( nombre ),
      asignados ( nombre, color ),
      llevar_opciones ( nombre )
    `)
    .eq('id', notaId)
    .single()

  if (error || !nota) throw new Error('No se pudo cargar la nota.')

  function unoOnulo(valor: any) {
    return Array.isArray(valor) ? (valor[0] ?? null) : valor
  }

  const cliente = unoOnulo(nota.clientes)
  const domicilio = unoOnulo(nota.domicilios)
  const municipio = domicilio ? unoOnulo(domicilio.municipios) : null
  const tipoNota = unoOnulo(nota.tipo_notas)
  const asignado = unoOnulo(nota.asignados)
  const llevar = unoOnulo(nota.llevar_opciones)

  if (!nota.dia_cita || !nota.hora_cita) {
    throw new Error('Esta nota no tiene fecha y hora de cita, así que no se puede enviar al calendario.')
  }

  const notaParaPdf = {
    ...nota,
    clientes: cliente,
    tipo_notas: tipoNota,
    asignados: asignado,
    llevar_opciones: llevar,
    domicilios: domicilio ? { ...domicilio, municipios: municipio } : null,
  }

  // Intenta cargar el logo desde el propio sitio público para incluirlo en el PDF.
  let logoBytes: Uint8Array | undefined
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || ''
    if (baseUrl) {
      const resp = await fetch(`${baseUrl}/logo-iluxol.png`)
      if (resp.ok) logoBytes = new Uint8Array(await resp.arrayBuffer())
    }
  } catch {
    logoBytes = undefined
  }

  const pdfBytes = await generarPdfNota(notaParaPdf, logoBytes)

  const numero = nota.numero_nota ?? nota.id
  const nombreClienteLimpio = (cliente?.nombre ?? 'Sin cliente').replace(/[\\/:*?"<>|]+/g, ' ').trim()
  const pdfNombreArchivo = `${numero} - ${nombreClienteLimpio}.pdf`

  const resultado = await enviarNotaAlCalendario({
    numeroNota: numero,
    tipoNota: tipoNota?.nombre ?? '',
    fechaCitaISO: nota.dia_cita,
    horaCitaHHMM: nota.hora_cita.slice(0, 5),
    duracionMinutos: 30,
    direccion: domicilio
      ? `${domicilio.direccion}${municipio?.nombre ? ', ' + municipio.nombre : ''}`
      : '',
    nombreCliente: cliente?.nombre ?? '—',
    telefonoCliente: cliente?.telefono ?? '',
    observaciones: nota.observaciones ?? '',
    colorAsignado: asignado?.color ?? null,
    pdfBytes,
    pdfNombreArchivo,
  })

  return resultado
}
