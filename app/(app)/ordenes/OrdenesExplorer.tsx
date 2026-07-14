'use client'

import { useState, useEffect, useRef } from 'react'
import type {
  OrdenTrabajo, LineaOrden, Tipologia, Color, VariableClave,
} from './actions'
import {
  crearOrden, actualizarOrden, eliminarOrden,
  buscarNotaParaOrden, buscarClientesParaOrden,
} from './actions'

// ─── EVALUADOR ────────────────────────────────────────────────────────────────

function evalFormula(formula: string, vars: Record<string, number>): string {
  if (!formula.trim()) return '—'
  try {
    const expr = formula.replace(/[a-z_]+/gi, m => vars[m] !== undefined ? String(vars[m]) : 'NaN')
    // eslint-disable-next-line no-new-func
    const r = new Function(`"use strict"; return (${expr})`)()
    return typeof r === 'number' && !isNaN(r) ? String(Math.round(r * 100) / 100) : '?'
  } catch { return '?' }
}

const ETIQ: Record<VariableClave, string> = {
  ancho_total: 'Ancho', alto_total: 'Alto',
  alto_izquierda: 'Alto Izq.', alto_derecha: 'Alto Der.',
}

// ─── ESTILOS ──────────────────────────────────────────────────────────────────

const inp: React.CSSProperties = {
  padding: '6px 10px', borderRadius: 7, border: '1px solid #d1d5db',
  fontSize: 13, outline: 'none', background: '#fff', width: '100%', boxSizing: 'border-box',
}
const btn = (bg: string, txt = '#fff'): React.CSSProperties => ({
  padding: '6px 14px', borderRadius: 8, border: 'none', background: bg,
  color: txt, fontSize: 13, cursor: 'pointer', fontWeight: 500,
})
const card: React.CSSProperties = {
  background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden',
}

// ─── EDITOR DE LÍNEA ─────────────────────────────────────────────────────────

function EditorLinea({ linea, tipologias, colores, onChange, onEliminar }: {
  linea: Omit<LineaOrden, 'id' | 'tipologia' | 'color_nombre'>
  tipologias: Tipologia[]
  colores: Color[]
  onChange: (l: Omit<LineaOrden, 'id' | 'tipologia' | 'color_nombre'>) => void
  onEliminar: () => void
}) {
  const tip = tipologias.find(t => t.id === linea.tipologia_id) ?? null
  const variables = tip?.tipologia_filas.filter(f => f.tipo === 'variable') ?? []
  const perfiles  = tip?.tipologia_filas.filter(f => f.tipo === 'perfil')  ?? []
  const medidas: Record<string, number> = {
    ancho_total:    linea.ancho_total    ?? 0,
    alto_total:     linea.alto_total     ?? 0,
    alto_izquierda: linea.alto_izquierda ?? 0,
    alto_derecha:   linea.alto_derecha   ?? 0,
  }

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, background: '#f8fafc' }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <div style={{ flex: '2 1 180px' }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 3 }}>TIPOLOGÍA</label>
          <select value={linea.tipologia_id || ''} onChange={e => onChange({ ...linea, tipologia_id: Number(e.target.value) })} style={inp}>
            <option value="">Selecciona…</option>
            {tipologias.filter(t => t.activo).map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
        </div>
        <div style={{ flex: '1 1 110px' }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 3 }}>COLOR</label>
          <select value={linea.color_id ?? ''} onChange={e => onChange({ ...linea, color_id: e.target.value ? Number(e.target.value) : null })} style={inp}>
            <option value="">—</option>
            {colores.filter(c => c.activo).map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
        <div style={{ flex: '0 0 75px' }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 3 }}>UNID.</label>
          <input type="number" min={1} value={linea.unidades_totales} onChange={e => onChange({ ...linea, unidades_totales: Number(e.target.value) })} style={inp} />
        </div>
        <div style={{ flex: '2 1 130px' }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 3 }}>REFERENCIA</label>
          <input value={linea.referencia} onChange={e => onChange({ ...linea, referencia: e.target.value })} placeholder="Hueco salón…" style={inp} />
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button onClick={onEliminar} style={{ ...btn('#fee2e2', '#dc2626'), padding: '6px 10px' }}>✕</button>
        </div>
      </div>

      {variables.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          {variables.map((v, i) => {
            if (v.tipo !== 'variable') return null
            const clave = v.variable_clave
            return (
              <label key={i} style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11 }}>
                <span style={{ fontWeight: 600, color: '#374151' }}>{ETIQ[clave]} (mm)</span>
                <input type="number" min={0} value={medidas[clave] || ''}
                  onChange={e => onChange({ ...linea, [clave]: e.target.value ? Number(e.target.value) : null })}
                  style={{ ...inp, width: 95 }} />
              </label>
            )
          })}
        </div>
      )}

      {perfiles.length > 0 && tip && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#1c2230', color: '#fff' }}>
              <th style={{ padding: '5px 8px', textAlign: 'left' }}>Perfil</th>
              <th style={{ padding: '5px 8px', textAlign: 'left', fontFamily: 'monospace', fontWeight: 400 }}>Fórmula</th>
              <th style={{ padding: '5px 8px', textAlign: 'center' }}>Ud.</th>
              <th style={{ padding: '5px 8px', textAlign: 'right' }}>Corte mm</th>
            </tr>
          </thead>
          <tbody>
            {perfiles.map((p, i) => {
              if (p.tipo !== 'perfil') return null
              return (
                <tr key={i} style={{ borderBottom: '1px solid #e2e8f0', background: i % 2 ? '#fafafa' : '#fff' }}>
                  <td style={{ padding: '4px 8px' }}>{p.nombre_perfil}</td>
                  <td style={{ padding: '4px 8px', fontFamily: 'monospace', color: '#6b7280' }}>{p.formula}</td>
                  <td style={{ padding: '4px 8px', textAlign: 'center' }}>{p.unidades}</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 700, color: '#1c2230' }}>
                    {evalFormula(p.formula, medidas)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ─── FORMULARIO ───────────────────────────────────────────────────────────────

function FormularioOrden({ inicial, tipologias, colores, onGuardada, onCancelar }: {
  inicial?: OrdenTrabajo
  tipologias: Tipologia[]
  colores: Color[]
  onGuardada: (o: OrdenTrabajo) => void
  onCancelar: () => void
}) {
  const [busNota,    setBusNota]    = useState('')
  const [notaInfo,   setNotaInfo]   = useState<any>(inicial?.nota_id ? { id: inicial.nota_id, numero_nota: inicial.numero_nota_rel } : null)
  const [notaId,     setNotaId]     = useState<number | null>(inicial?.nota_id ?? null)
  const [cargNota,   setCargNota]   = useState(false)
  const [errNota,    setErrNota]    = useState('')

  const [busCli,     setBusCli]     = useState('')
  const [cliInfo,    setCliInfo]    = useState<any>(inicial?.cliente_id ? { id: inicial.cliente_id, nombre: inicial.cliente_nombre, telefono: inicial.cliente_telefono } : null)
  const [cliId,      setCliId]      = useState<number | null>(inicial?.cliente_id ?? null)
  const [resCli,     setResCli]     = useState<any[]>([])
  const [cargCli,    setCargCli]    = useState(false)

  const [obs,  setObs]  = useState(inicial?.observaciones ?? '')
  const [lineas, setLineas] = useState<Omit<LineaOrden, 'id' | 'tipologia' | 'color_nombre'>[]>(
    inicial?.orden_lineas.map(l => ({
      tipologia_id: l.tipologia_id, color_id: l.color_id,
      ancho_total: l.ancho_total, alto_total: l.alto_total,
      alto_izquierda: l.alto_izquierda, alto_derecha: l.alto_derecha,
      unidades_totales: l.unidades_totales, referencia: l.referencia, posicion: l.posicion,
    })) ?? []
  )
  const [guardando, setGuardando] = useState(false)
  const [err,       setErr]       = useState('')

  async function buscarNota() {
    const n = parseInt(busNota); if (!n) { setErrNota('Número inválido.'); return }
    setCargNota(true); setErrNota('')
    try {
      const r = await buscarNotaParaOrden(n)
      if (!r) { setErrNota('No encontrada.'); return }
      setNotaInfo(r); setNotaId(r.id)
      if (!cliId && r.clientes) { setCliInfo(r.clientes); setCliId(r.cliente_id) }
    } catch { setErrNota('Error.') } finally { setCargNota(false) }
  }

  async function buscarCli(termino: string) {
    if (termino.trim().length < 2) { setResCli([]); return }
    setCargCli(true)
    const r = await buscarClientesParaOrden(termino); setResCli(r); setCargCli(false)
  }

  // Live search para cliente
  useEffect(() => {
    const t = setTimeout(() => buscarCli(busCli), 300)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busCli])

  function añadirLinea() {
    const p = tipologias.find(t => t.activo)
    setLineas(prev => [...prev, { tipologia_id: p?.id ?? 0, color_id: null, ancho_total: null, alto_total: null, alto_izquierda: null, alto_derecha: null, unidades_totales: 1, referencia: '', posicion: prev.length }])
  }

  async function guardar() {
    if (!lineas.length)             { setErr('Añade al menos una línea.'); return }
    if (lineas.some(l => !l.tipologia_id)) { setErr('Todas las líneas necesitan tipología.'); return }
    setGuardando(true); setErr('')
    try {
      const datos = { nota_id: notaId, cliente_id: cliId, observaciones: obs, lineas }
      if (inicial) {
        await actualizarOrden(inicial.id, datos)
        onGuardada({ ...inicial, nota_id: notaId, numero_nota_rel: notaInfo?.numero_nota ?? null, cliente_id: cliId, cliente_nombre: cliInfo?.nombre ?? null, cliente_telefono: cliInfo?.telefono ?? null, observaciones: obs, orden_lineas: lineas as any })
      } else {
        const nueva = await crearOrden(datos)
        onGuardada({ id: nueva.id, numero_orden: null, nota_id: notaId, numero_nota_rel: notaInfo?.numero_nota ?? null, cliente_id: cliId, cliente_nombre: cliInfo?.nombre ?? null, cliente_telefono: cliInfo?.telefono ?? null, observaciones: obs, creado_en: new Date().toISOString(), orden_lineas: lineas as any })
      }
    } catch (e: any) { setErr(e.message ?? 'Error.') } finally { setGuardando(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Nota */}
      <div style={{ ...card, padding: 14 }}>
        <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 600, color: '#374151' }}>NOTA RELACIONADA (opcional)</p>
        {notaInfo ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, flex: 1 }}>Nota <strong>#{notaInfo.numero_nota}</strong></span>
            <button onClick={() => { setNotaInfo(null); setNotaId(null); setBusNota('') }} style={btn('#f3f4f6', '#374151')}>Quitar</button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="number" value={busNota} onChange={e => setBusNota(e.target.value)} onKeyDown={e => e.key === 'Enter' && buscarNota()} placeholder="Nº nota…" style={{ ...inp, flex: 1 }} />
            <button onClick={buscarNota} disabled={cargNota} style={btn('#1c2230')}>{cargNota ? '…' : 'Buscar'}</button>
          </div>
        )}
        {errNota && <p style={{ color: '#dc2626', fontSize: 12, margin: '5px 0 0' }}>{errNota}</p>}
      </div>

      {/* Cliente */}
      <div style={{ ...card, padding: 14 }}>
        <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 600, color: '#374151' }}>CLIENTE (opcional)</p>
        {cliInfo ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, flex: 1 }}><strong>{cliInfo.nombre}</strong>{cliInfo.telefono ? ` — ${cliInfo.telefono}` : ''}</span>
            <button onClick={() => { setCliInfo(null); setCliId(null); setBusCli('') }} style={btn('#f3f4f6', '#374151')}>Quitar</button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
              <input value={busCli} onChange={e => setBusCli(e.target.value)} onKeyDown={e => e.key === 'Enter' && buscarCli(busCli)} placeholder="Nombre o teléfono…" style={{ ...inp, flex: 1 }} />

            </div>
            {resCli.length > 0 && (
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
                {resCli.map(c => (
                  <div key={c.id} onClick={() => { setCliInfo(c); setCliId(c.id); setResCli([]) }}
                    style={{ padding: '7px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid #f3f4f6' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}>
                    <strong>{c.nombre}</strong>{c.telefono ? ` — ${c.telefono}` : ''}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Observaciones */}
      <div>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>OBSERVACIONES</label>
        <textarea value={obs} onChange={e => setObs(e.target.value)} rows={2} placeholder="Observaciones…" style={{ ...inp, height: 'auto', resize: 'vertical' }} />
      </div>

      {/* Líneas */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>LÍNEAS</label>
          <button onClick={añadirLinea} style={btn('#1c2230')}>+ Añadir línea</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {lineas.length === 0 && <p style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: 20, margin: 0 }}>Añade la primera línea.</p>}
          {lineas.map((l, i) => (
            <EditorLinea key={i} linea={l} tipologias={tipologias} colores={colores}
              onChange={nl => setLineas(prev => prev.map((x, j) => j === i ? nl : x))}
              onEliminar={() => setLineas(prev => prev.filter((_, j) => j !== i).map((x, j) => ({ ...x, posicion: j })))} />
          ))}
        </div>
      </div>

      {err && <p style={{ color: '#dc2626', fontSize: 13, margin: 0 }}>{err}</p>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onCancelar} style={btn('#f3f4f6', '#374151')}>Cancelar</button>
        <button onClick={guardar} disabled={guardando} style={btn('#1c2230')}>{guardando ? 'Guardando…' : inicial ? 'Guardar cambios' : 'Crear orden'}</button>
      </div>
    </div>
  )
}

// ─── VISTA EXPANDIDA ─────────────────────────────────────────────────────────

function VistaOrden({ orden }: { orden: OrdenTrabajo }) {
  return (
    <div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 14, fontSize: 13 }}>
        {orden.cliente_nombre && <span><strong>Cliente:</strong> {orden.cliente_nombre}{orden.cliente_telefono ? ` — ${orden.cliente_telefono}` : ''}</span>}
        {orden.nota_id && <span><strong>Nota:</strong> #{orden.numero_nota_rel ?? orden.nota_id}</span>}
        {orden.observaciones && <span style={{ color: '#6b7280', fontStyle: 'italic' }}>{orden.observaciones}</span>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {orden.orden_lineas.map((linea, i) => {
          const tip = linea.tipologia
          const perfiles = tip?.tipologia_filas.filter(f => f.tipo === 'perfil') ?? []
          const medidas: Record<string, number> = { ancho_total: linea.ancho_total ?? 0, alto_total: linea.alto_total ?? 0, alto_izquierda: linea.alto_izquierda ?? 0, alto_derecha: linea.alto_derecha ?? 0 }
          return (
            <div key={i} style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ background: '#1c2230', color: '#fff', padding: '8px 12px', display: 'flex', gap: 14, fontSize: 13, flexWrap: 'wrap' }}>
                <strong>{tip?.nombre ?? '—'}</strong>
                {linea.color_nombre && <span>Color: <strong>{linea.color_nombre}</strong></span>}
                <span>Uds: <strong>{linea.unidades_totales}</strong></span>
                {linea.referencia && <span style={{ color: '#aab1c0' }}>{linea.referencia}</span>}
                {linea.ancho_total    != null && <span>A:{linea.ancho_total}</span>}
                {linea.alto_total     != null && <span>H:{linea.alto_total}</span>}
                {linea.alto_izquierda != null && <span>H.Izq:{linea.alto_izquierda}</span>}
                {linea.alto_derecha   != null && <span>H.Der:{linea.alto_derecha}</span>}
              </div>
              {perfiles.length > 0 && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={{ padding: '5px 10px', textAlign: 'left', color: '#374151' }}>Perfil</th>
                      <th style={{ padding: '5px 10px', textAlign: 'left', color: '#9ca3af', fontFamily: 'monospace', fontWeight: 400, fontSize: 12 }}>Fórmula</th>
                      <th style={{ padding: '5px 10px', textAlign: 'center', color: '#374151' }}>Ud.</th>
                      <th style={{ padding: '5px 10px', textAlign: 'right', color: '#374151' }}>Corte mm</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perfiles.map((p, j) => {
                      if (p.tipo !== 'perfil') return null
                      return (
                        <tr key={j} style={{ borderTop: '1px solid #f3f4f6', background: j % 2 ? '#fafafa' : '#fff' }}>
                          <td style={{ padding: '5px 10px' }}>{p.nombre_perfil}</td>
                          <td style={{ padding: '5px 10px', fontFamily: 'monospace', color: '#9ca3af', fontSize: 12 }}>{p.formula}</td>
                          <td style={{ padding: '5px 10px', textAlign: 'center' }}>{p.unidades}</td>
                          <td style={{ padding: '5px 10px', textAlign: 'right', fontWeight: 700, fontSize: 14, color: '#1c2230' }}>{evalFormula(p.formula, medidas)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── PRINCIPAL ────────────────────────────────────────────────────────────────

export default function OrdenesExplorer({ ordenesIniciales, tipologias, colores }: {
  ordenesIniciales: OrdenTrabajo[]
  tipologias: Tipologia[]
  colores: Color[]
}) {
  const [ordenes,    setOrdenes]    = useState<OrdenTrabajo[]>(ordenesIniciales)
  const [modo,       setModo]       = useState<'lista' | 'nueva' | 'editar'>('lista')
  const [editando,   setEditando]   = useState<OrdenTrabajo | null>(null)
  const [expandida,  setExpandida]  = useState<number | null>(null)
  const [eliminando, setEliminando] = useState<number | null>(null)

  function onGuardada(o: OrdenTrabajo) {
    setOrdenes(prev => { const e = prev.find(x => x.id === o.id); return e ? prev.map(x => x.id === o.id ? o : x) : [o, ...prev] })
    setModo('lista'); setEditando(null)
  }

  async function onEliminar(id: number) {
    if (!confirm('¿Eliminar esta orden?')) return
    setEliminando(id); await eliminarOrden(id)
    setOrdenes(prev => prev.filter(o => o.id !== id)); setEliminando(null)
  }

  if (modo === 'nueva' || modo === 'editar') {
    return (
      <div>
        <h2 style={{ fontSize: 17, fontWeight: 600, color: '#1c2230', margin: '0 0 18px' }}>
          {modo === 'nueva' ? 'Nueva orden de trabajo' : `Editar orden #${editando?.numero_orden ?? editando?.id}`}
        </h2>
        <div style={{ ...card, padding: 22 }}>
          <FormularioOrden inicial={modo === 'editar' ? editando! : undefined} tipologias={tipologias} colores={colores} onGuardada={onGuardada} onCancelar={() => { setModo('lista'); setEditando(null) }} />
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: '#1c2230' }}>Órdenes de trabajo</h2>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: '#6b7280' }}>{ordenes.length} órdenes</p>
        </div>
        <button onClick={() => setModo('nueva')} style={btn('#1c2230')}>+ Nueva orden</button>
      </div>

      {ordenes.length === 0 && <p style={{ color: '#9ca3af', textAlign: 'center', padding: 40 }}>No hay órdenes. Crea la primera.</p>}

      {ordenes.map(o => (
        <div key={o.id} style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer' }} onClick={() => setExpandida(expandida === o.id ? null : o.id)}>
            <span style={{ fontSize: 13, color: '#9ca3af' }}>{expandida === o.id ? '▾' : '▸'}</span>
            <div style={{ flex: 1 }}>
              <span style={{ fontWeight: 600, fontSize: 15, color: '#1c2230' }}>Orden #{o.numero_orden ?? o.id}</span>
              {o.cliente_nombre && <span style={{ marginLeft: 10, fontSize: 13, color: '#6b7280' }}>{o.cliente_nombre}</span>}
              <span style={{ marginLeft: 10, fontSize: 12, color: '#9ca3af' }}>{o.orden_lineas.length} {o.orden_lineas.length === 1 ? 'línea' : 'líneas'}</span>
              {o.observaciones && <span style={{ marginLeft: 10, fontSize: 12, color: '#9ca3af', fontStyle: 'italic' }}>· {o.observaciones}</span>}
            </div>
            <span style={{ fontSize: 12, color: '#9ca3af' }}>{new Date(o.creado_en).toLocaleDateString('es-ES')}</span>
            <a
              href={`/ordenes-imprimir/${o.id}`} target="_blank" rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              style={{ ...btn('#f0fdf4', '#16a34a'), display: 'inline-flex', alignItems: 'center', textDecoration: 'none', gap: 4 }}
            >🖨 Imprimir</a>
            <button onClick={e => { e.stopPropagation(); setEditando(o); setModo('editar') }} style={btn('#f3f4f6', '#374151')}>Editar</button>
            <button onClick={e => { e.stopPropagation(); onEliminar(o.id) }} disabled={eliminando === o.id} style={btn('#fee2e2', '#dc2626')}>{eliminando === o.id ? '…' : 'Eliminar'}</button>
          </div>
          {expandida === o.id && <div style={{ borderTop: '1px solid #f3f4f6', padding: '12px 16px' }}><VistaOrden orden={o} /></div>}
        </div>
      ))}
    </div>
  )
}
