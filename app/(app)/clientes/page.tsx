import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import ClientesExplorer, { type Cliente } from './ClientesExplorer'

const POR_PAGINA = 40

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string }>
}) {
  const { pagina } = await searchParams
  const paginaActual = Math.max(1, Number(pagina) || 1)
  const desde = (paginaActual - 1) * POR_PAGINA
  const hasta = desde + POR_PAGINA - 1

  const supabase = await createClient()

  const [{ data: clientes, count: totalClientes }, { data: municipios }] = await Promise.all([
    supabase
      .from('clientes')
      .select(`
        id, nombre, telefono, telefono2, email, otros_datos, dni, lpd_firmado,
        domicilios ( id, direccion, municipio_id, zona, datos_vivienda, municipios ( nombre ) )
      `, { count: 'exact' })
      .order('id', { ascending: false })
      .range(desde, hasta),
    supabase.from('municipios').select('id, nombre').eq('activo', true).order('nombre'),
  ])

  const clientesNormalizados: Cliente[] = (clientes ?? []).map((c: any) => ({
    ...c,
    domicilios: (c.domicilios ?? []).map((d: any) => ({
      ...d,
      municipios: Array.isArray(d.municipios) ? (d.municipios[0] ?? null) : d.municipios,
    })),
  }))

  const totalPaginas = Math.max(1, Math.ceil((totalClientes ?? 0) / POR_PAGINA))

  return (
    <Suspense fallback={null}>
      <ClientesExplorer
        clientesIniciales={clientesNormalizados}
        municipios={municipios ?? []}
        paginaActual={paginaActual}
        totalPaginas={totalPaginas}
        totalClientes={totalClientes ?? 0}
      />
    </Suspense>
  )
}
