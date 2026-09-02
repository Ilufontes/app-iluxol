'use client'

import { useState } from 'react'
import type { PerfilCatalogo } from './actions'
import { crearPerfilCatalogo, actualizarPerfilCatalogo, toggleActivoPerfilCatalogo } from './actions'

const inp: React.CSSProperties = {
  padding: '6px 10px', borderRadius: 7, border: '1px solid #d1d5db',
  fontSize: 13, outline: 'none', background: '#fff', width: '100%', boxSizing: 'border-box',
}
const btn = (bg: string, txt = '#fff'): React.CSSProperties => ({
  padding: '6px 14px', borderRadius: 8, border: 'none', background: bg,
  color: txt, fontSize: 13, cursor: 'pointer', fontWeight: 500,
})
const card: React.CSSProperties = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }

function FormularioPerfil({ inicial, onGuardado, onCancelar }: {
  inicial?: PerfilCatalogo
  onGuardado: (p: PerfilCatalogo) => void
  onCancelar: () => void
}) {
  const [referencia, setReferencia]   = useState(inicial?.referencia ?? '')
  const [descripcion, setDescripcion] = useState(inicial?.descripcion ?? '')
  const [guardando, setGuardando]     = useState(false)
  const [error, setError]             = useState('')

  async function guardar() {
    if (!referencia.trim())  { setError('La referencia es obligatoria.');  return }
    if (!descripcion.trim()) { setError('La descripción es obligatoria.'); return }
    setGuardando(true); setError('')
    try {
      if (inicial) {
        await actualizarPerfilCatalogo(inicial.id, { referencia, descripcion })
        onGuardado({ ...inicial, referencia: referencia.trim(), descripcion: descripcion.trim() })
      } else {
        const nuevo = await crearPerfilCatalogo({ referencia, descripcion })
        onGuardado(nuevo)
      }
    } catch (e: any) {
      setError(e.message ?? 'Error al guardar.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div style={{ ...card, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 140px' }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 3 }}>REFERENCIA</label>
          <input value={referencia} onChange={e => setReferencia(e.target.value)} placeholder="Ej: 00154" style={inp} />
        </div>
        <div style={{ flex: '2 1 260px' }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 3 }}>DESCRIPCIÓN</label>
          <input value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Ej: Guía mosquitera Saxun" style={inp} />
        </div>
      </div>
      {error && <p style={{ color: '#dc2626', fontSize: 12, margin: 0 }}>{error}</p>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onCancelar} style={btn('#f3f4f6', '#374151')}>Cancelar</button>
        <button onClick={guardar} disabled={guardando} style={btn('#1c2230')}>
          {guardando ? 'Guardando…' : inicial ? 'Guardar cambios' : 'Crear perfil'}
        </button>
      </div>
    </div>
  )
}

export default function CatalogoPerfilesExplorer({ perfilesIniciales }: { perfilesIniciales: PerfilCatalogo[] }) {
  const [perfiles, setPerfiles] = useState<PerfilCatalogo[]>(perfilesIniciales)
  const [modo, setModo]         = useState<'lista' | 'nuevo' | 'editar'>('lista')
  const [editando, setEditando] = useState<PerfilCatalogo | null>(null)

  function onGuardado(p: PerfilCatalogo) {
    setPerfiles(prev => {
      const existe = prev.find(x => x.id === p.id)
      const lista = existe ? prev.map(x => x.id === p.id ? p : x) : [...prev, p]
      return [...lista].sort((a, b) => a.referencia.localeCompare(b.referencia))
    })
    setModo('lista'); setEditando(null)
  }

  async function toggleActivo(id: number, activo: boolean) {
    await toggleActivoPerfilCatalogo(id, activo)
    setPerfiles(prev => prev.map(p => p.id === id ? { ...p, activo } : p))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: '#1c2230' }}>Perfiles</h2>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: '#6b7280' }}>
            {perfiles.filter(p => p.activo).length} activos · {perfiles.length} total
          </p>
        </div>
        {modo === 'lista' && <button onClick={() => setModo('nuevo')} style={btn('#1c2230')}>+ Nuevo perfil</button>}
      </div>

      {modo === 'nuevo' && (
        <FormularioPerfil onGuardado={onGuardado} onCancelar={() => setModo('lista')} />
      )}
      {modo === 'editar' && editando && (
        <FormularioPerfil inicial={editando} onGuardado={onGuardado} onCancelar={() => { setModo('lista'); setEditando(null) }} />
      )}

      <div style={card}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              <th style={{ padding: '8px 14px', textAlign: 'left', color: '#374151' }}>Referencia</th>
              <th style={{ padding: '8px 14px', textAlign: 'left', color: '#374151' }}>Descripción</th>
              <th style={{ padding: '8px 14px', textAlign: 'right', color: '#374151' }}></th>
            </tr>
          </thead>
          <tbody>
            {perfiles.length === 0 && (
              <tr><td colSpan={3} style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>Sin perfiles todavía.</td></tr>
            )}
            {perfiles.map((p, i) => (
              <tr key={p.id} style={{ borderTop: '1px solid #f3f4f6', background: p.activo ? (i % 2 ? '#fafafa' : '#fff') : '#f9fafb', opacity: p.activo ? 1 : 0.6 }}>
                <td style={{ padding: '8px 14px', fontWeight: 600 }}>{p.referencia}</td>
                <td style={{ padding: '8px 14px' }}>{p.descripcion}</td>
                <td style={{ padding: '8px 14px', textAlign: 'right', display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <button onClick={() => { setEditando(p); setModo('editar') }} style={btn('#f3f4f6', '#374151')}>Editar</button>
                  <button onClick={() => toggleActivo(p.id, !p.activo)} style={btn(p.activo ? '#fee2e2' : '#f0fdf4', p.activo ? '#dc2626' : '#16a34a')}>
                    {p.activo ? 'Desactivar' : 'Activar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
