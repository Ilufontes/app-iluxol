import { createClient } from '@/lib/supabase/server'
import NotasExplorer, { type NotaListado } from './NotasExplorer'

export default async function NotasPage() {
  const supabase = await createClient()

  const [
    { data: notas },
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
      `)
      .order('creado_en', { ascending: false })
      .limit(50),
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

  return (
    <NotasExplorer
      notasIniciales={notasNormalizadas}
      tiposNota={tiposNota ?? []}
      asignados={asignados ?? []}
      llevarOpciones={llevarOpciones ?? []}
      municipios={municipios ?? []}
    />
  )
}
