import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import ClientesExplorer, { type Cliente } from './ClientesExplorer'

const POR_PAGINA = 40

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string; lpd?: string; municipio?: string }>
}) {
  const { pagina, lpd, municipio } = await searchParams
  const paginaActual = Math.max(1, Number(pagina) || 1)
  const desde = (paginaActual - 1) * POR_PAGINA
  const hasta = desde + POR_PAGINA - 1
  const filtroLpd = lpd === 'true' ? true : lpd === 'false' ? false : null
  const filtroMunicipioId = municipio && /^\d+$/.test(municipio) ? Number(municipio) : null
  const hayFiltro = filtroLpd !== null || filtroMunicipioId !== null

  const supabase = await createClient()

  // El municipio vive en domicilios, no en clientes: si se filtra por municipio,
  // se usa "!inner" para que solo devuelva clientes que tengan al menos un
  // domicilio en ese municipio concreto.
  const relacionDomicilios = filtroMunicipioId
    ? 'domicilios!inner ( id, direccion, municipio_id, zona, datos_vivienda, municipios ( nombre ) )'
    : 'domicilios ( id, direccion, municipio_id, zona, datos_vivienda, municipios ( nombre ) )'

  let consultaClientes = supabase
    .from('clientes')
    .select(`id, nombre, telefono, telefono2, email, otros_datos, dni, lpd_firmado, ${relacionDomicilios}`, { count: 'exact' })
    .order('id', { ascending: false })

  if (filtroLpd !== null) {
    consultaClientes = consultaClientes.eq('lpd_firmado', filtroLpd)
  }
  if (filtroMunicipioId) {
    consultaClientes = consultaClientes.eq('domicilios.municipio_id', filtroMunicipioId)
  }
  if (!hayFiltro) {
    consultaClientes = consultaClientes.range(desde, hasta)
  }

  const [{ data: clientes, count: totalClientes }, { data: municipios }] = await Promise.all([
    consultaClientes,
    supabase.from('municipios').select('id, nombre').eq('activo', true).order('nombre'),
  ])

  const clientesNormalizados: Cliente[] = (clientes ?? []).map((c: any) => ({
    ...c,
    domicilios: (c.domicilios ?? []).map((d: any) => ({
      ...d,
      municipios: Array.isArray(d.municipios) ? (d.municipios[0] ?? null) : d.municipios,
    })),
  }))

  const totalPaginas = hayFiltro ? 1 : Math.max(1, Math.ceil((totalClientes ?? 0) / POR_PAGINA))

  return (
    <Suspense fallback={null}>
      <ClientesExplorer
        clientesIniciales={clientesNormalizados}
        municipios={municipios ?? []}
        paginaActual={hayFiltro ? 1 : paginaActual}
        totalPaginas={totalPaginas}
        totalClientes={totalClientes ?? 0}
        filtroLpd={filtroLpd}
        filtroMunicipioId={filtroMunicipioId}
      />
    </Suspense>
  )
}
