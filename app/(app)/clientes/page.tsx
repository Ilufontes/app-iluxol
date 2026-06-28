import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import ClientesExplorer, { type Cliente } from './ClientesExplorer'

export default async function ClientesPage() {
  const supabase = await createClient()

  const [{ data: clientes }, { data: municipios }] = await Promise.all([
    supabase
      .from('clientes')
      .select(`
        id, nombre, telefono, telefono2, email, otros_datos, dni, lpd_firmado,
        domicilios ( id, direccion, municipio_id, zona, datos_vivienda, municipios ( nombre ) )
      `)
      .order('creado_en', { ascending: false }),
    supabase.from('municipios').select('id, nombre').eq('activo', true).order('nombre'),
  ])

  const clientesNormalizados: Cliente[] = (clientes ?? []).map((c: any) => ({
    ...c,
    domicilios: (c.domicilios ?? []).map((d: any) => ({
      ...d,
      municipios: Array.isArray(d.municipios) ? (d.municipios[0] ?? null) : d.municipios,
    })),
  }))

  return (
    <Suspense fallback={null}>
      <ClientesExplorer
        clientesIniciales={clientesNormalizados}
        municipios={municipios ?? []}
      />
    </Suspense>
  )
}
