'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const ENLACES = [
  { href: '/', etiqueta: 'Inicio' },
  { href: '/notas', etiqueta: 'Notas' },
  { href: '/clientes', etiqueta: 'Clientes' },
  { href: '/buscar', etiqueta: 'Buscador' },
  { href: '/ajustes', etiqueta: 'Ajustes' },
]

export default function Sidebar({ nombreEmpleado }: { nombreEmpleado: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function cerrarSesion() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <nav style={{
      width: 220,
      flexShrink: 0,
      background: '#1c2230',
      color: '#ffffff',
      padding: '1.5rem 1rem',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{ fontSize: 18, fontWeight: 500, padding: '0 0.5rem', marginBottom: '2rem' }}>
        Iluxol
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
        {ENLACES.map((enlace) => {
          const activo = pathname === enlace.href
          return (
            <Link
              key={enlace.href}
              href={enlace.href}
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                fontSize: 14,
                color: activo ? '#ffffff' : '#aab1c0',
                background: activo ? 'rgba(255,255,255,0.08)' : 'transparent',
                textDecoration: 'none',
              }}
            >
              {enlace.etiqueta}
            </Link>
          )
        })}
      </div>

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem', marginTop: '1rem' }}>
        <p style={{ fontSize: 12, color: '#aab1c0', margin: '0 0 8px', padding: '0 0.5rem' }}>
          {nombreEmpleado}
        </p>
        <button
          onClick={cerrarSesion}
          style={{
            width: '100%',
            background: 'none',
            border: 'none',
            color: '#aab1c0',
            fontSize: 13,
            textAlign: 'left',
            padding: '8px 12px',
            cursor: 'pointer',
            borderRadius: 8,
          }}
        >
          Cerrar sesión
        </button>
      </div>
    </nav>
  )
}
