'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const ENLACES = [
  { href: '/', etiqueta: 'Inicio', color: '#9CA3AF' },
  { href: '/notas', etiqueta: 'Notas', color: '#5B7FFF' },
  { href: '/clientes', etiqueta: 'Clientes', color: '#3DCB9A' },
  { href: '/buscar', etiqueta: 'Buscador', color: '#A89BF0' },
  { href: '/ajustes', etiqueta: 'Ajustes', color: '#9CA3AF' },
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
      <div style={{
        background: '#ffffff', borderRadius: 10, padding: '8px 12px',
        display: 'inline-flex', alignItems: 'center', marginBottom: '2rem', width: 'fit-content',
      }}>
        <Image src="/logo-iluxol-nuevo.png" alt="Iluxol" width={120} height={56} style={{ height: 28, width: 'auto' }} priority />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
        {ENLACES.map((enlace) => {
          const activo = pathname === enlace.href
          return (
            <Link
              key={enlace.href}
              href={enlace.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: activo ? 500 : 400,
                color: activo ? '#ffffff' : '#aab1c0',
                background: activo ? `${enlace.color}26` : 'transparent',
                textDecoration: 'none',
              }}
            >
              <span style={{
                width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                background: enlace.color,
              }} />
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
