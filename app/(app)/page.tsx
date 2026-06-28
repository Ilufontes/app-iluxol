import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import CabeceraSeccion, { coloresSeccion, type ColorSeccion } from '@/components/CabeceraSeccion'
import TarjetaCitasDia from './TarjetaCitasDia'

export default async function InicioPage() {
  const supabase = await createClient()

  const [{ count: totalClientes }, { count: totalNotasHoy }] = await Promise.all([
    supabase.from('clientes').select('*', { count: 'exact', head: true }),
    supabase
      .from('notas')
      .select('*', { count: 'exact', head: true })
      .eq('dia_cita', new Date().toISOString().slice(0, 10)),
  ])

  return (
    <div>
      <CabeceraSeccion color="gris" titulo="Menú" subtitulo="Resumen rápido y accesos directos" />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 32 }}>
        <Metrica etiqueta="Clientes registrados" valor={totalClientes ?? 0} />
        <TarjetaCitasDia citasIniciales={totalNotasHoy ?? 0} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        <TarjetaAcceso href="/notas" titulo="Notas" descripcion="Crear y consultar avisos de trabajo." color="azul" />
        <TarjetaAcceso href="/clientes" titulo="Clientes" descripcion="Buscar, crear y editar clientes y domicilios." color="verde" />
        <TarjetaAcceso href="/ajustes" titulo="Ajustes" descripcion="Tipos de nota, asignados, llevar y municipios." color="gris" />
      </div>
    </div>
  )
}

function Metrica({ etiqueta, valor }: { etiqueta: string; valor: number }) {
  return (
    <div style={{ background: '#ffffff', borderRadius: 12, padding: '1rem', border: '1px solid #e5e7eb' }}>
      <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 4px' }}>{etiqueta}</p>
      <p style={{ fontSize: 24, fontWeight: 500, margin: 0, color: '#1c2230' }}>{valor}</p>
    </div>
  )
}

function TarjetaAcceso({
  href, titulo, descripcion, color,
}: {
  href: string
  titulo: string
  descripcion: string
  color: ColorSeccion
}) {
  const p = coloresSeccion(color)
  return (
    <Link
      href={href}
      style={{
        display: 'block',
        background: p.fondo,
        borderRadius: 12,
        padding: '1.25rem',
        border: `1px solid ${p.borde}`,
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <p style={{ fontSize: 15, fontWeight: 500, margin: '0 0 4px', color: p.titulo }}>{titulo}</p>
      <p style={{ fontSize: 13, margin: 0, color: p.subtitulo }}>{descripcion}</p>
    </Link>
  )
}
