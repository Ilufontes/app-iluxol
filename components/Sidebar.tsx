'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const COLOR_ORDENES = '#F59E0B'

export default function Sidebar({ nombreEmpleado }: { nombreEmpleado: string }) {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()

  const enOrdenes = pathname.startsWith('/ordenes') || pathname.startsWith('/tipologias')
  const enAjustesOrdenes = pathname === '/ordenes/ajustes'
  const [submenuAbierto, setSubmenuAbierto] = useState(enOrdenes)

  async function cerrarSesion() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const enlaceStyle = (activo: boolean, color: string): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 12px', borderRadius: 8, fontSize: 14,
    fontWeight: activo ? 500 : 400,
    color: activo ? '#ffffff' : '#aab1c0',
    background: activo ? `${color}26` : 'transparent',
    textDecoration: 'none',
  })

  const subEnlaceStyle = (activo: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '8px 12px 8px 28px', borderRadius: 8, fontSize: 13,
    fontWeight: activo ? 500 : 400,
    color: activo ? '#ffffff' : '#aab1c0',
    background: activo ? `${COLOR_ORDENES}26` : 'transparent',
    textDecoration: 'none',
  })

  return (
    <nav style={{
      width: 220, flexShrink: 0, background: '#1c2230', color: '#ffffff',
      padding: '1.5rem 1rem', display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        background: '#ffffff', borderRadius: 10, padding: '8px 12px',
        display: 'inline-flex', alignItems: 'center', marginBottom: '2rem', width: 'fit-content',
      }}>
        <Image src="/logo-iluxol-nuevo.png" alt="Iluxol" width={120} height={56} style={{ height: 28, width: 'auto' }} priority />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>

        {/* Inicio */}
        <Link href="/" style={enlaceStyle(pathname === '/', '#9CA3AF')}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: '#9CA3AF' }} />
          Inicio
        </Link>

        {/* Notas */}
        <Link href="/notas" style={enlaceStyle(pathname === '/notas', '#5B7FFF')}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: '#5B7FFF' }} />
          Notas
        </Link>

        {/* Clientes */}
        <Link href="/clientes" style={enlaceStyle(pathname === '/clientes', '#3DCB9A')}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: '#3DCB9A' }} />
          Clientes
        </Link>

        {/* Buscador */}
        <Link href="/buscar" style={enlaceStyle(pathname === '/buscar', '#A89BF0')}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: '#A89BF0' }} />
          Buscador
        </Link>

        {/* Órdenes de trabajo — grupo colapsable */}
        <div>
          <button
            onClick={() => setSubmenuAbierto(v => !v)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 8, fontSize: 14,
              fontWeight: enOrdenes ? 500 : 400,
              color: enOrdenes ? '#ffffff' : '#aab1c0',
              background: enOrdenes ? `${COLOR_ORDENES}18` : 'transparent',
              border: 'none', cursor: 'pointer', textAlign: 'left',
            }}
          >
            <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: COLOR_ORDENES }} />
            <span style={{ flex: 1 }}>Órdenes trabajo</span>
            <span style={{ fontSize: 10, color: '#6b7280' }}>{submenuAbierto ? '▾' : '▸'}</span>
          </button>

          {submenuAbierto && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 2 }}>
              <Link href="/ordenes" style={subEnlaceStyle(pathname === '/ordenes')}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', flexShrink: 0, background: COLOR_ORDENES, opacity: 0.7 }} />
                Órdenes
              </Link>
              <Link href="/tipologias" style={subEnlaceStyle(pathname === '/tipologias')}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', flexShrink: 0, background: COLOR_ORDENES, opacity: 0.7 }} />
                Tipologías
              </Link>
              <Link href="/ordenes/ajustes" style={subEnlaceStyle(enAjustesOrdenes)}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', flexShrink: 0, background: COLOR_ORDENES, opacity: 0.7 }} />
                Ajustes
              </Link>
            </div>
          )}
        </div>

        {/* Ajustes */}
        <Link href="/ajustes" style={enlaceStyle(pathname === '/ajustes', '#9CA3AF')}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: '#9CA3AF' }} />
          Ajustes
        </Link>

      </div>

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem', marginTop: '1rem' }}>
        <p style={{ fontSize: 12, color: '#aab1c0', margin: '0 0 8px', padding: '0 0.5rem' }}>
          {nombreEmpleado}
        </p>
        <button
          onClick={cerrarSesion}
          style={{
            width: '100%', background: 'none', border: 'none', color: '#aab1c0',
            fontSize: 13, textAlign: 'left', padding: '8px 12px', cursor: 'pointer', borderRadius: 8,
          }}
        >
          Cerrar sesión
        </button>
      </div>
    </nav>
  )
}
