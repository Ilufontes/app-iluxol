'use client'
import { useState } from 'react'
import type { TipoTubo, Color } from '../actions'
import { crearColor, toggleActivoColor, crearTipoTubo, toggleActivoTipoTubo } from '../actions'

const inp: React.CSSProperties = {
  padding: '6px 10px', borderRadius: 7, border: '1px solid #d1d5db',
  fontSize: 13, outline: 'none', background: '#fff', width: '100%', boxSizing: 'border-box',
}
const btn = (bg: string, txt = '#fff'): React.CSSProperties => ({
  padding: '6px 14px', borderRadius: 8, border: 'none', background: bg,
  color: txt, fontSize: 13, cursor: 'pointer', fontWeight: 500,
})
const card: React.CSSProperties = {
  background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20,
}

// ─── COLORES ──────────────────────────────────────────────────────────────────

function PanelColores({ init }: { init: Color[] }) {
  const [colores,    setColores]    = useState(init)
  const [nuevo,      setNuevo]      = useState('')
  const [error,      setError]      = useState('')

  async function añadir() {
    if (!nuevo.trim()) return; setError('')
    try {
      await crearColor(nuevo)
      setColores(p => [...p, { id: Date.now(), nombre: nuevo.trim().toUpperCase(), activo: true }])
      setNuevo('')
    } catch (e: any) { setError(e.message) }
  }

  async function toggle(id: number, activo: boolean) {
    await toggleActivoColor(id, activo)
    setColores(p => p.map(c => c.id === id ? { ...c, activo } : c))
  }

  return (
    <div style={card}>
      <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 600, color: '#1c2230' }}>Colores</h3>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <input value={nuevo} onChange={e => setNuevo(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && añadir()}
          placeholder="Ej: PLATA, BRONCE…" style={{ ...inp, flex: 1 }} />
        <button onClick={añadir} style={btn('#1c2230')}>Añadir</button>
      </div>
      {error && <p style={{ color: '#dc2626', fontSize: 12, margin: '0 0 8px' }}>{error}</p>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {colores.map(c => (
          <div key={c.id} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: c.activo ? '#f3f4f6' : '#fee2e2',
            border: `1px solid ${c.activo ? '#d1d5db' : '#fca5a5'}`,
            borderRadius: 8, padding: '4px 10px', fontSize: 13,
          }}>
            <span style={{ color: c.activo ? '#1c2230' : '#9ca3af', textDecoration: c.activo ? 'none' : 'line-through' }}>
              {c.nombre}
            </span>
            <button onClick={() => toggle(c.id, !c.activo)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#6b7280', padding: 0 }}>
              {c.activo ? '✕' : '↩'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── TIPOS DE TUBO ────────────────────────────────────────────────────────────

function PanelTiposTubo({ init }: { init: TipoTubo[] }) {
  const [tubos,     setTubos]     = useState(init)
  const [nombre,    setNombre]    = useState('')
  const [descuento, setDescuento] = useState('')
  const [error,     setError]     = useState('')

  async function añadir() {
    if (!nombre.trim() || !descuento) return; setError('')
    try {
      await crearTipoTubo(nombre, Number(descuento))
      setTubos(p => [...p, { id: Date.now(), nombre: nombre.trim().toUpperCase(), descuento: Number(descuento), activo: true }])
      setNombre(''); setDescuento('')
    } catch (e: any) { setError(e.message) }
  }

  async function toggle(id: number, activo: boolean) {
    await toggleActivoTipoTubo(id, activo)
    setTubos(p => p.map(t => t.id === id ? { ...t, activo } : t))
  }

  return (
    <div style={card}>
      <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 600, color: '#1c2230' }}>Tipos de tubo</h3>
      <p style={{ margin: '0 0 14px', fontSize: 12, color: '#6b7280' }}>
        El <strong>descuento</strong> es el mm que se suma al tubo perpendicular por cada tubo activo en ese lado.
        Ejemplo: tubo 60x20 → descuento 20.
      </p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <input value={nombre} onChange={e => setNombre(e.target.value)}
          placeholder="Ej: 60x20, 40x20…" style={{ ...inp, flex: 2 }} />
        <input type="number" min={0} value={descuento} onChange={e => setDescuento(e.target.value)}
          placeholder="Descuento mm" style={{ ...inp, flex: 1 }} />
        <button onClick={añadir} style={btn('#1c2230')}>Añadir</button>
      </div>
      {error && <p style={{ color: '#dc2626', fontSize: 12, margin: '0 0 8px' }}>{error}</p>}
      {tubos.length === 0 && (
        <p style={{ color: '#9ca3af', fontSize: 13 }}>Sin tipos de tubo. Crea el primero.</p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {tubos.map(t => (
          <div key={t.id} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: t.activo ? '#f8fafc' : '#fee2e2',
            border: `1px solid ${t.activo ? '#e2e8f0' : '#fca5a5'}`,
            borderRadius: 8, padding: '8px 12px',
          }}>
            <span style={{ flex: 1, fontWeight: 500, fontSize: 14, color: t.activo ? '#1c2230' : '#9ca3af', textDecoration: t.activo ? 'none' : 'line-through' }}>
              {t.nombre}
            </span>
            <span style={{ fontSize: 12, color: '#6b7280' }}>Descuento: <strong>{t.descuento} mm</strong></span>
            <button onClick={() => toggle(t.id, !t.activo)}
              style={btn(t.activo ? '#fee2e2' : '#f0fdf4', t.activo ? '#dc2626' : '#16a34a')}>
              {t.activo ? 'Desactivar' : 'Activar'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── PRINCIPAL ────────────────────────────────────────────────────────────────

export default function AjustesOrdenesExplorer({ coloresIniciales, tiposTuboIniciales }: {
  coloresIniciales: Color[]
  tiposTuboIniciales: TipoTubo[]
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PanelColores init={coloresIniciales} />
      <PanelTiposTubo init={tiposTuboIniciales} />
    </div>
  )
}
