'use client'
import { useState } from 'react'
import type { PerfilCatalogo } from '../catalogo-perfiles/actions'
import type { Color } from '../ordenes/actions'
import {
  crearReglaStockMinimo, actualizarUnidadesStockMinimo, eliminarReglaStockMinimo,
  cargarReglasStockMinimo, type ReglaStockMinimo,
} from './actions'

const inp: React.CSSProperties = {
  padding: '6px 10px', borderRadius: 7, border: '1px solid #d1d5db',
  fontSize: 13, outline: 'none', background: '#fff', width: '100%', boxSizing: 'border-box',
}
const btn = (bg: string, txt = '#fff'): React.CSSProperties => ({
  padding: '6px 14px', borderRadius: 8, border: 'none', background: bg,
  color: txt, fontSize: 13, cursor: 'pointer', fontWeight: 500,
})
const card: React.CSSProperties = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }
const lbl: React.CSSProperties = { fontSize: 12, color: '#6b7280', marginBottom: 4, display: 'block' }

export default function StockMinimoExplorer({ reglasIniciales, catalogo, colores }: {
  reglasIniciales: ReglaStockMinimo[]
  catalogo: PerfilCatalogo[]
  colores: Color[]
}) {
  const [reglas, setReglas] = useState(reglasIniciales)
  const [perfil, setPerfil] = useState('')
  const [color, setColor] = useState('')
  const [unidades, setUnidades] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [edicion, setEdicion] = useState<Record<number, string>>({})

  async function recargar() { setReglas(await cargarReglasStockMinimo()) }

  async function añadir() {
    setError('')
    if (!perfil || !color || !unidades) { setError('Elige perfil, color y unidades mínimas.'); return }
    setGuardando(true)
    try {
      await crearReglaStockMinimo({ catalogo_perfil_id: Number(perfil), color_id: Number(color), unidades_minimas: Number(unidades) })
      await recargar()
      setPerfil(''); setColor(''); setUnidades('')
    } catch (e: any) { setError(e.message) }
    setGuardando(false)
  }

  async function guardarUnidades(r: ReglaStockMinimo) {
    const valor = edicion[r.id]
    if (valor === undefined || Number(valor) === r.unidades_minimas) return
    setError('')
    try {
      await actualizarUnidadesStockMinimo(r.id, Number(valor))
      await recargar()
      setEdicion(p => { const n = { ...p }; delete n[r.id]; return n })
    } catch (e: any) { setError(e.message) }
  }

  async function quitar(r: ReglaStockMinimo) {
    if (!confirm(`¿Dejar de avisar de ${r.referencia} en ${r.color_nombre}?`)) return
    setError('')
    try { await eliminarReglaStockMinimo(r.id); setReglas(p => p.filter(x => x.id !== r.id)) }
    catch (e: any) { setError(e.message) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={card}>
        <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 600, color: '#1c2230' }}>Añadir aviso</h3>
        <p style={{ margin: '0 0 14px', fontSize: 12, color: '#6b7280' }}>
          Solo se avisa de los perfiles y colores que añadas aquí. Se cuentan las <strong>barras enteras</strong> (6000 y 6500 mm);
          los retales no cuentan.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '3 1 260px' }}>
            <label style={lbl}>Ref.</label>
            <select value={perfil} onChange={e => setPerfil(e.target.value)} style={inp}>
              <option value="">Elige un perfil…</option>
              {catalogo.map(c => <option key={c.id} value={c.id}>{c.referencia} — {c.descripcion}</option>)}
            </select>
          </div>
          <div style={{ flex: '1 1 140px' }}>
            <label style={lbl}>Color</label>
            <select value={color} onChange={e => setColor(e.target.value)} style={inp}>
              <option value="">Elige un color…</option>
              {colores.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div style={{ flex: '0 1 130px' }}>
            <label style={lbl}>Unidades mínimas</label>
            <input type="number" min={1} step={1} value={unidades} onChange={e => setUnidades(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && añadir()} style={inp} />
          </div>
          <button onClick={añadir} disabled={guardando} style={btn('#1c2230')}>Añadir</button>
        </div>
        {error && <p style={{ color: '#dc2626', fontSize: 12, margin: '10px 0 0' }}>{error}</p>}
      </div>

      <div style={card}>
        <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 600, color: '#1c2230' }}>Barras vigiladas</h3>
        {reglas.length === 0 && <p style={{ color: '#9ca3af', fontSize: 13, margin: 0 }}>Todavía no hay ningún aviso.</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {reglas.map(r => {
            const bajo = r.barras_actuales < r.unidades_minimas
            return (
              <div key={r.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                background: bajo ? '#fef2f2' : '#f8fafc', border: `1px solid ${bajo ? '#fca5a5' : '#e2e8f0'}`,
                borderRadius: 8, padding: '8px 12px',
              }}>
                <span style={{ flex: '1 1 240px', fontSize: 14, color: '#1c2230' }}>
                  <strong>{r.referencia}</strong> — {r.descripcion} · <strong>{r.color_nombre}</strong>
                </span>
                <span style={{ fontSize: 13, color: bajo ? '#b91c1c' : '#166534', fontWeight: 600 }}>
                  {r.barras_actuales} {r.barras_actuales === 1 ? 'barra' : 'barras'} {bajo ? '· por debajo' : '· correcto'}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6b7280' }}>
                  Mínimo
                  <input type="number" min={1} step={1}
                    value={edicion[r.id] ?? String(r.unidades_minimas)}
                    onChange={e => setEdicion(p => ({ ...p, [r.id]: e.target.value }))}
                    onBlur={() => guardarUnidades(r)}
                    onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                    style={{ ...inp, width: 70 }} />
                </span>
                <button onClick={() => quitar(r)} style={btn('#fee2e2', '#dc2626')}>Quitar</button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
