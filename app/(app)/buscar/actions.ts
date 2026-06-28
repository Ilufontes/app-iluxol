'use server'

import { createClient } from '@/lib/supabase/server'

export type ResultadoBusqueda = {
  id: number
  nombre: string
  telefono: string | null
  telefono2: string | null
  email: string | null
  domicilios: { direccion: string; municipios: { nombre: string } | null }[]
}

export async function buscarGlobal(termino: string): Promise<ResultadoBusqueda[]> {
  const t = termino.trim()
  if (!t) return []

  const supabase = await createClient()

  // Busca primero por campos directos del cliente (nombre, teléfono, teléfono2, email).
  const { data: porCliente } = await supabase
    .from('clientes')
    .select(`
      id, nombre, telefono, telefono2, email,
      domicilios ( direccion, municipios ( nombre ) )
    `)
    .or(`nombre.ilike.%${t}%,telefono.ilike.%${t}%,telefono2.ilike.%${t}%,email.ilike.%${t}%`)
    .limit(30)

  // Busca también por dirección del domicilio o nombre de municipio,
  // ya que esos campos viven en tablas relacionadas y no admiten "or" directo.
  const { data: domiciliosCoincidentes } = await supabase
    .from('domicilios')
    .select('cliente_id, direccion, municipios ( nombre )')
    .ilike('direccion', `%${t}%`)
    .limit(30)

  const idsPorDireccion = (domiciliosCoincidentes ?? []).map((d: any) => d.cliente_id)

  let porDireccion: any[] = []
  if (idsPorDireccion.length > 0) {
    const { data } = await supabase
      .from('clientes')
      .select(`
        id, nombre, telefono, telefono2, email,
        domicilios ( direccion, municipios ( nombre ) )
      `)
      .in('id', idsPorDireccion)
    porDireccion = data ?? []
  }

  const todos = [...(porCliente ?? []), ...porDireccion]
  const vistos = new Set<number>()
  const unicos: any[] = []
  for (const c of todos) {
    if (!vistos.has(c.id)) {
      vistos.add(c.id)
      unicos.push(c)
    }
  }

  return unicos.map((c) => ({
    id: c.id,
    nombre: c.nombre,
    telefono: c.telefono,
    telefono2: c.telefono2,
    email: c.email,
    domicilios: (c.domicilios ?? []).map((d: any) => ({
      direccion: d.direccion,
      municipios: Array.isArray(d.municipios) ? (d.municipios[0] ?? null) : d.municipios,
    })),
  }))
}
