import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

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
      <h1 style={{ fontSize: 22, fontWeight: 500, margin: '0 0 4px', color: '#1c2230' }}>
        Menú
      </h1>
      <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 28px' }}>
        Resumen rápido y accesos directos.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 32 }}>
        <Metrica etiqueta="Clientes registrados" valor={totalClientes ?? 0} />
        <Metrica etiqueta="Citas para hoy" valor={totalNotasHoy ?? 0} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        <TarjetaAcceso href="/notas" titulo="Notas" descripcion="Crear y consultar avisos de trabajo." />
        <TarjetaAcceso href="/clientes" titulo="Clientes" descripcion="Buscar, crear y editar clientes y domicilios." />
        <TarjetaAcceso href="/ajustes" titulo="Ajustes" descripcion="Tipos de nota, asignados, llevar y municipios." />
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

function TarjetaAcceso({ href, titulo, descripcion }: { href: string; titulo: string; descripcion: string }) {
  return (
    <Link
      href={href}
      style={{
        display: 'block',
        background: '#ffffff',
        borderRadius: 12,
        padding: '1.25rem',
        border: '1px solid #e5e7eb',
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <p style={{ fontSize: 15, fontWeight: 500, margin: '0 0 4px', color: '#1c2230' }}>{titulo}</p>
      <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>{descripcion}</p>
    </Link>
  )
}
