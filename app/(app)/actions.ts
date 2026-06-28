'use server'

import { createClient } from '@/lib/supabase/server'

export async function contarCitasDelDia(fechaISO: string) {
  const supabase = await createClient()
  const { count } = await supabase
    .from('notas')
    .select('*', { count: 'exact', head: true })
    .eq('dia_cita', fechaISO)

  return count ?? 0
}

export async function obtenerCitasDelDia(fechaISO: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('notas')
    .select(`
      id, numero_nota, hora_cita,
      clientes ( nombre ),
      domicilios ( direccion, municipios ( nombre ) ),
      asignados ( id, nombre )
    `)
    .eq('dia_cita', fechaISO)
    .order('hora_cita', { ascending: true, nullsFirst: false })

  if (error || !data) return []

  function unoOnulo(valor: any) {
    return Array.isArray(valor) ? (valor[0] ?? null) : valor
  }

  return data.map((n: any) => ({
    id: n.id,
    numero_nota: n.numero_nota,
    hora_cita: n.hora_cita,
    cliente: unoOnulo(n.clientes)?.nombre ?? 'Cliente eliminado',
    direccion: (() => {
      const d = unoOnulo(n.domicilios)
      const m = d ? unoOnulo(d.municipios) : null
      return d ? `${d.direccion}${m?.nombre ? ' — ' + m.nombre : ''}` : null
    })(),
    asignado: unoOnulo(n.asignados)?.nombre ?? null,
  }))
}
