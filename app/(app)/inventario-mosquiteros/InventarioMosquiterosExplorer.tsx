'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import type { PiezaStock, PerfilCatalogoOpcion, ColorOpcion, EstanteOpcion } from './actions'
import { crearPiezaStock, actualizarPiezaStock, eliminarPiezaStock } from './actions'

const inp: React.CSSProperties = {
  padding: '6px 10px', borderRadius: 7, border: '1px solid #d1d5db',
  fontSize: 13, outline: 'none', background: '#fff', width: '100%', boxSizing: 'border-box',
}
const inpDisabled: React.CSSProperties = { ...inp, background: '#f3f4f6', color: '#6b7280' }
const btn = (bg: string, txt = '#fff'): React.CSSProperties => ({
  padding: '6px 14px', borderRadius: 8, border: 'none', background: bg,
  color: txt, fontSize: 13, cursor: 'pointer', fontWeight: 500,
})
const card: React.CSSProperties = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }

function FormularioPieza({ inicial, catalogo, colores, estantes, onGuardado, onCancelar }: {
  inicial?: PiezaStock
  catalogo: PerfilCatalogoOpcion[]
  colores: ColorOpcion[]
  estantes: EstanteOpcion[]
  onGuardado: (p: PiezaStock) => void
  onCancelar: () => void
}) {
  const [catalogoPerfilId, setCatalogoPerfilId] = useState<number | ''>(inicial?.catalogo_perfil_id ?? '')
  const [codigo, setCodigo]     = useState(inicial?.codigo ?? '')
  const [medida, setMedida]     = useState<number | ''>(inicial?.medida ?? '')
  const [colorId, setColorId]   = useState<number | ''>(inicial?.color_id ?? '')
  const [estanteId, setEstanteId] = useState<number | ''>(inicial?.estante_id ?? '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const perfilSeleccionado = catalogo.find(c => c.id === catalogoPerfilId)

  async function guardar() {
    if (!catalogoPerfilId) { setError('Selecciona una referencia.'); return }
    if (!codigo.trim())    { setError('El código es obligatorio.'); return }
    if (!medida || medida <= 0) { setError('La medida debe ser mayor que 0.'); return }
    setGuardando(true); setError('')
    try {
      const datos = {
        catalogo_perfil_id: Number(catalogoPerfilId),
        codigo, medida: Number(medida),
        color_id: colorId ? Number(colorId) : null,
        estante_id: estanteId ? Number(estanteId) : null,
      }
      if (inicial) {
        await actualizarPiezaStock(inicial.id, datos)
        onGuardado({
          ...inicial, ...datos, codigo: codigo.trim(),
          referencia: perfilSeleccionado?.referencia ?? inicial.referencia,
          descripcion: perfilSeleccionado?.descripcion ?? inicial.descripcion,
          color_nombre: colores.find(c => c.id === datos.color_id)?.nombre ?? null,
          estante_nombre: estantes.find(e => e.id === datos.estante_id)?.nombre ?? null,
        })
      } else {
        const nueva = await crearPiezaStock(datos)
        onGuardado(nueva)
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
        <div style={{ flex: '1 1 160px' }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 3 }}>REFERENCIA</label>
          <select value={catalogoPerfilId} onChange={e => setCatalogoPerfilId(e.target.value ? Number(e.target.value) : '')} style={inp}>
            <option value="">Selecciona…</option>
            {catalogo.filter(c => c.activo).map(c => <option key={c.id} value={c.id}>{c.referencia}</option>)}
          </select>
        </div>
        <div style={{ flex: '2 1 220px' }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 3 }}>DESCRIPCIÓN</label>
          <input value={perfilSeleccionado?.descripcion ?? ''} disabled style={inpDisabled} placeholder="Se rellena al elegir la referencia" />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 140px' }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 3 }}>CÓDIGO (etiqueta)</label>
          <input value={codigo} onChange={e => setCodigo(e.target.value)} placeholder="Ej: 00418" style={inp} />
        </div>
        <div style={{ flex: '1 1 120px' }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 3 }}>MEDIDA (mm)</label>
          <input type="number" min={1} value={medida} onChange={e => setMedida(e.target.value ? Number(e.target.value) : '')} style={inp} />
        </div>
        <div style={{ flex: '1 1 140px' }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 3 }}>COLOR</label>
          <select value={colorId} onChange={e => setColorId(e.target.value ? Number(e.target.value) : '')} style={inp}>
            <option value="">—</option>
            {colores.filter(c => c.activo).map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
        <div style={{ flex: '1 1 140px' }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 3 }}>ESTANTE</label>
          <select value={estanteId} onChange={e => setEstanteId(e.target.value ? Number(e.target.value) : '')} style={inp}>
            <option value="">—</option>
            {estantes.filter(e => e.activo).map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
        </div>
      </div>
      {error && <p style={{ color: '#dc2626', fontSize: 12, margin: 0 }}>{error}</p>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onCancelar} style={btn('#f3f4f6', '#374151')}>Cancelar</button>
        <button onClick={guardar} disabled={guardando} style={btn('#1c2230')}>
          {guardando ? 'Guardando…' : inicial ? 'Guardar cambios' : 'Añadir al stock'}
        </button>
      </div>
    </div>
  )
}

export default function InventarioMosquiterosExplorer({ stockInicial, catalogo, colores, estantes }: {
  stockInicial: PiezaStock[]
  catalogo: PerfilCatalogoOpcion[]
  colores: ColorOpcion[]
  estantes: EstanteOpcion[]
}) {
  const [stock, setStock] = useState<PiezaStock[]>(stockInicial)
  const [modo, setModo]   = useState<'lista' | 'nueva' | 'editar'>('lista')
  const [editando, setEditando] = useState<PiezaStock | null>(null)
  const [eliminando, setEliminando] = useState<number | null>(null)
  const [filtroRef, setFiltroRef]     = useState('')
  const [filtroColor, setFiltroColor] = useState<number | ''>('')

  function onGuardado(p: PiezaStock) {
    setStock(prev => {
      const existe = prev.find(x => x.id === p.id)
      return existe ? prev.map(x => x.id === p.id ? p : x) : [p, ...prev]
    })
    setModo('lista'); setEditando(null)
  }

  async function onEliminar(id: number) {
    if (!confirm('¿Eliminar esta pieza del inventario?')) return
    setEliminando(id); await eliminarPiezaStock(id)
    setStock(prev => prev.filter(p => p.id !== id)); setEliminando(null)
  }

  const stockFiltrado = useMemo(() => stock.filter(p =>
    (!filtroRef || p.referencia.toLowerCase().includes(filtroRef.toLowerCase()) || p.codigo.toLowerCase().includes(filtroRef.toLowerCase())) &&
    (!filtroColor || p.color_id === filtroColor)
  ), [stock, filtroRef, filtroColor])

  if (modo === 'nueva' || modo === 'editar') {
    return (
      <div>
        <h2 style={{ fontSize: 17, fontWeight: 600, color: '#1c2230', margin: '0 0 18px' }}>
          {modo === 'nueva' ? 'Nueva pieza de stock' : `Editar pieza ${editando?.codigo}`}
        </h2>
        <FormularioPieza
          inicial={modo === 'editar' ? editando! : undefined}
          catalogo={catalogo} colores={colores} estantes={estantes}
          onGuardado={onGuardado}
          onCancelar={() => { setModo('lista'); setEditando(null) }}
        />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: '#1c2230' }}>Stock de perfiles</h2>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: '#6b7280' }}>{stock.length} piezas en inventario</p>
        </div>
        <button onClick={() => setModo('nueva')} style={btn('#1c2230')}>+ Nueva pieza</button>
      </div>

      <p style={{ margin: 0, fontSize: 12, color: '#9ca3af' }}>
        ¿Faltan colores o estantes en las listas? Añádelos desde{' '}
        <Link href="/ajustes?tab=estantes" style={{ color: '#0F6E56' }}>Ajustes → Estantes</Link>{' '}
        o desde <Link href="/tipologias" style={{ color: '#0F6E56' }}>Tipologías</Link> (colores).
      </p>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input value={filtroRef} onChange={e => setFiltroRef(e.target.value)} placeholder="Buscar por referencia o código…" style={{ ...inp, maxWidth: 260 }} />
        <select value={filtroColor} onChange={e => setFiltroColor(e.target.value ? Number(e.target.value) : '')} style={{ ...inp, maxWidth: 180 }}>
          <option value="">Todos los colores</option>
          {colores.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </div>

      <div style={card}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              <th style={{ padding: '8px 14px', textAlign: 'left', color: '#374151' }}>Código</th>
              <th style={{ padding: '8px 14px', textAlign: 'left', color: '#374151' }}>Referencia</th>
              <th style={{ padding: '8px 14px', textAlign: 'left', color: '#374151' }}>Descripción</th>
              <th style={{ padding: '8px 14px', textAlign: 'right', color: '#374151' }}>Medida</th>
              <th style={{ padding: '8px 14px', textAlign: 'left', color: '#374151' }}>Color</th>
              <th style={{ padding: '8px 14px', textAlign: 'left', color: '#374151' }}>Estante</th>
              <th style={{ padding: '8px 14px', textAlign: 'right', color: '#374151' }}></th>
            </tr>
          </thead>
          <tbody>
            {stockFiltrado.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>Sin piezas que coincidan.</td></tr>
            )}
            {stockFiltrado.map((p, i) => (
              <tr key={p.id} style={{ borderTop: '1px solid #f3f4f6', background: i % 2 ? '#fafafa' : '#fff' }}>
                <td style={{ padding: '8px 14px', fontWeight: 700 }}>{p.codigo}</td>
                <td style={{ padding: '8px 14px' }}>{p.referencia}</td>
                <td style={{ padding: '8px 14px', color: '#6b7280' }}>{p.descripcion}</td>
                <td style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 600 }}>{p.medida} mm</td>
                <td style={{ padding: '8px 14px' }}>{p.color_nombre ?? '—'}</td>
                <td style={{ padding: '8px 14px' }}>{p.estante_nombre ?? '—'}</td>
                <td style={{ padding: '8px 14px', textAlign: 'right', display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <button onClick={() => { setEditando(p); setModo('editar') }} style={btn('#f3f4f6', '#374151')}>Editar</button>
                  <button onClick={() => onEliminar(p.id)} disabled={eliminando === p.id} style={btn('#fee2e2', '#dc2626')}>
                    {eliminando === p.id ? '…' : 'Eliminar'}
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
