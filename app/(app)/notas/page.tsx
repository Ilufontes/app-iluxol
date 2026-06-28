import { createClient } from '@/lib/supabase/server'
import NotasExplorer, { type NotaListado } from './NotasExplorer'

const POR_PAGINA = 40

export default async function NotasPage({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string }>
}) {
  const { pagina } = await searchParams
  const paginaActual = Math.max(1, Number(pagina) || 1)
  const desde = (paginaActual - 1) * POR_PAGINA
  const hasta = desde + POR_PAGINA - 1

  const supabase = await createClient()

  const [
    { data: notas, count: totalNotas },
    { data: tiposNota },
    { data: asignados },
    { data: llevarOpciones },
    { data: municipios },
  ] = await Promise.all([
    supabase
      .from('notas')
      .select(`
        id, numero_nota, fecha_entrada, observaciones, dia_cita, hora_cita,
        cliente_id, domicilio_id, tipo_nota_id, asignado_id, llevar_id,
        clientes ( id, nombre, telefono, telefono2, email ),
        domicilios ( id, direccion, zona, municipio_id, municipios ( nombre ) ),
        tipo_notas ( nombre ),
        asignados ( nombre ),
        llevar_opciones ( nombre )
      `, { count: 'exact' })
      .order('numero_nota', { ascending: false })
      .range(desde, hasta),
    supabase.from('tipo_notas').select('id, nombre').eq('activo', true).order('nombre'),
    supabase.from('asignados').select('id, nombre').eq('activo', true).order('nombre'),
    supabase.from('llevar_opciones').select('id, nombre').eq('activo', true).order('nombre'),
    supabase.from('municipios').select('id, nombre').eq('activo', true).order('nombre'),
  ])

  function unoOnulo(valor: any) {
    return Array.isArray(valor) ? (valor[0] ?? null) : valor
  }

  const notasNormalizadas: NotaListado[] = (notas ?? []).map((n: any) => {
    const domicilio = unoOnulo(n.domicilios)
    return {
      ...n,
      clientes: unoOnulo(n.clientes),
      tipo_notas: unoOnulo(n.tipo_notas),
      asignados: unoOnulo(n.asignados),
      llevar_opciones: unoOnulo(n.llevar_opciones),
      domicilios: domicilio
        ? { ...domicilio, municipios: unoOnulo(domicilio.municipios) }
        : null,
    }
  })

  const totalPaginas = Math.max(1, Math.ceil((totalNotas ?? 0) / POR_PAGINA))

  return (
    <NotasExplorer
      notasIniciales={notasNormalizadas}
      tiposNota={tiposNota ?? []}
      asignados={asignados ?? []}
      llevarOpciones={llevarOpciones ?? []}
      municipios={municipios ?? []}
      paginaActual={paginaActual}
      totalPaginas={totalPaginas}
      totalNotas={totalNotas ?? 0}
    />
  )
}
