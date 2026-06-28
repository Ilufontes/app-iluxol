'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setCargando(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    setCargando(false)

    if (error) {
      setError('Email o contraseña incorrectos. Inténtalo de nuevo.')
      return
    }

    router.push('/')
    router.refresh()
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f4f5f7',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: 12,
        padding: '2.5rem',
        width: 380,
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      }}>
        <h1 style={{ fontSize: 22, fontWeight: 500, margin: '0 0 4px', color: '#1c2230' }}>
          Iluxol
        </h1>
        <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 24px' }}>
          Inicia sesión para gestionar clientes y notas.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 13, color: '#374151', display: 'block', marginBottom: 4 }}>
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nombre@iluxol.es"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={{ fontSize: 13, color: '#374151', display: 'block', marginBottom: 4 }}>
              Contraseña
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={inputStyle}
            />
          </div>

          {error && (
            <p style={{ fontSize: 13, color: '#b42318', margin: 0 }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={cargando}
            style={{
              marginTop: 8,
              height: 40,
              borderRadius: 8,
              border: 'none',
              background: '#2563eb',
              color: '#ffffff',
              fontSize: 14,
              fontWeight: 500,
              cursor: cargando ? 'default' : 'pointer',
              opacity: cargando ? 0.7 : 1,
            }}
          >
            {cargando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 38,
  borderRadius: 8,
  border: '1px solid #d1d5db',
  padding: '0 12px',
  fontSize: 14,
  boxSizing: 'border-box',
}
