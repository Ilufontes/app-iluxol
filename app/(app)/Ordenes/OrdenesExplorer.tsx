'use client'

import { useState } from 'react'
import type { OrdenTrabajo, LineaOrden } from './actions'
import type { Tipologia, VariableClave } from '../tipologias/actions'
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

const ETIQ_VAR: Record<VariableClave, string> = {
  ancho_total: 'Ancho', alto_total: 'Alto', alto_izquierda: 'Alto Izq.', alto_derecha: 'Alto Der.',
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

// ─── LÍNEA DE ORDEN (editor) ─────────────────────────────────────────────────

function EditorLinea({
  linea, tipologias, colores, onChange, onEliminar,
}: {
  linea: Omit<LineaOrden, 'id' | 'tipologia' | 'color_nombre'>
  tipologias: Tipologia[]
  colores: { id: number; nombre: string; activo: boolean }[]
  onChange: (l: Omit<LineaOrden, 'id' | 'tipologia' | 'color_nombre'>) => void
  onEliminar: () => void
}) {
  const tipologia = tipologias.find(t => t.id === linea.tipologia_id) ?? null
  const variables = tipologia?.tipologia_filas.filter(f => f.tipo === 'variable') ?? []
  const perfiles  = tipologia?.tipologia_filas.filter(f => f.tipo === 'perfil')  ?? []
  const coloresActivos = colores.filter(c => c.activo)

  const medidas: Record<string, number> = {
    ancho_total:    linea.ancho_total    ?? 0,
    alto_total:     linea.alto_total     ?? 0,
    alto_izquierda: linea.alto_izquierda ?? 0,
    alto_derecha:   linea.alto_derecha   ?? 0,
  }

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, background: '#f8fafc' }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        {/* Tipología */}
        <div style={{ flex: '2 1 200px' }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 3 }}>TIPOLOGÍA</label>
          <select
            value={linea.tipologia_id || ''}
            onChange={e => onChange({ ...linea, tipologia_id: Number(e.target.value) })}
            style={inp}
          >
            <option value="">Selecciona tipología…</option>
            {tipologias.filter(t => t.activo).map(t => (
              <option key={t.id} value={t.id}>{t.nombre}</option>
            ))}
          </select>
        </div>

        {/* Color */}
        <div style={{ flex: '1 1 120px' }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 3 }}>COLOR</label>
          <select
            value={linea.color_id ?? ''}
            onChange={e => onChange({ ...linea, color_id: e.target.value ? Number(e.target.value) : null })}
            style={inp}
          >
            <option value="">—</option>
            {coloresActivos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>

        {/* Unidades */}
        <div style={{ flex: '0 0 80px' }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 3 }}>UNIDADES</label>
          <input
            type="number" min={1} value={linea.unidades_totales}
            onChange={e => onChange({ ...linea, unidades_totales: Number(e.target.value) })}
            style={inp}
          />
        </div>

        {/* Referencia */}
        <div style={{ flex: '2 1 150px' }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 3 }}>REFERENCIA</label>
          <input
            value={linea.referencia}
            onChange={e => onChange({ ...linea, referencia: e.target.value })}
            placeholder="Ej: Hueco salón, dormitorio…"
            style={inp}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button onClick={onEliminar} style={{ ...btn('#fee2e2', '#dc2626'), padding: '6px 10px' }}>✕</button>
        </div>
      </div>

      {/* Medidas dinámicas según variables de la tipología */}
      {variables.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {variables.map((v, i) => {
            if (v.tipo !== 'variable') return null
            const clave = v.variable_clave as VariableClave
            return (
              <label key={i} style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11 }}>
                <span style={{ fontWeight: 600, color: '#374151' }}>{ETIQ_VAR[clave]} (mm)</span>
                <input
                  type="number" min={0}
                  value={medidas[clave] || ''}
                  onChange={e => onChange({ ...linea, [clave]: e.target.value ? Number(e.target.value) : null })}
                  style={{ ...inp, width: 100 }}
                />
              </label>
            )
          })}
        </div>
      )}

      {/* Vista previa de cortes */}
      {perfiles.length > 0 && tipologia && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#1c2230', color: '#fff' }}>
              <th style={{ padding: '5px 8px', textAlign: 'left' }}>Perfil</th>
              <th style={{ padding: '5px 8px', textAlign: 'left', fontFamily: 'monospace' }}>Fórmula</th>
              <th style={{ padding: '5px 8px', textAlign: 'center' }}>Ud.</th>
              <th style={{ padding: '5px 8px', textAlign: 'right' }}>Corte (mm)</th>
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

// ─── FORMULARIO DE ORDEN ─────────────────────────────────────────────────────

function FormularioOrden({
  inicial, tipologias, colores, onGuardada, onCancelar,
}: {
  inicial?: OrdenTrabajo
  tipologias: Tipologia[]
  colores: { id: number; nombre: string; activo: boolean }[]
  onGuardada: (o: OrdenTrabajo) => void
  onCancelar: () => void
}) {
  // Enlace opcional a nota
  const [busquedaNota, setBusquedaNota]     = useState('')
  const [notaEncontrada, setNotaEncontrada] = useState<any>(inicial?.nota ?? null)
  const [notaId, setNotaId]                 = useState<number | null>(inicial?.nota_id ?? null)
  const [buscandoNota, setBuscandoNota]     = useState(false)
  const [errorNota, setErrorNota]           = useState('')

  // Enlace opcional a cliente
  const [busquedaCliente, setBusquedaCliente]     = useState('')
  const [clienteEncontrado, setClienteEncontrado] = useState<any>(inicial?.cliente ?? null)
  const [clienteId, setClienteId]                 = useState<number | null>(inicial?.cliente_id ?? null)
  const [resultadosCliente, setResultadosCliente] = useState<any[]>([])
  const [buscandoCliente, setBuscandoCliente]     = useState(false)

  // Notas de la orden
  const [notas, setNotas] = useState(inicial?.notas ?? '')

  // Líneas
  const [lineas, setLineas] = useState<Omit<LineaOrden, 'id' | 'tipologia' | 'color_nombre'>[]>(
    inicial?.orden_lineas.map(l => ({
      tipologia_id:    l.tipologia_id,
      color_id:        l.color_id,
      ancho_total:     l.ancho_total,
      alto_total:      l.alto_total,
      alto_izquierda:  l.alto_izquierda,
      alto_derecha:    l.alto_derecha,
      unidades_totales: l.unidades_totales,
      referencia:      l.referencia,
      posicion:        l.posicion,
    })) ?? []
  )

  const [guardando, setGuardando] = useState(false)
  const [error, setError]         = useState('')

  async function buscarNota() {
    const num = parseInt(busquedaNota)
    if (!num) { setErrorNota('Escribe un número de nota.'); return }
    setBuscandoNota(true); setErrorNota('')
    try {
      const n = await buscarNotaParaOrden(num)
      if (!n) { setErrorNota('No se encontró esa nota.'); return }
      setNotaEncontrada(n)
      setNotaId(n.id)
      // Auto-rellenar cliente si no hay uno
      if (!clienteId && n.clientes) {
        setClienteEncontrado(n.clientes)
        setClienteId(n.cliente_id)
      }
    } catch { setErrorNota('Error al buscar la nota.') }
    finally   { setBuscandoNota(false) }
  }

  async function buscarClientes() {
    if (!busquedaCliente.trim()) return
    setBuscandoCliente(true)
    const res = await buscarClientesParaOrden(busquedaCliente)
    setResultadosCliente(res)
    setBuscandoCliente(false)
  }

  function añadirLinea() {
    setLineas(prev => [...prev, {
      tipologia_id: tipologias.find(t => t.activo)?.id ?? 0,
      color_id: null, ancho_total: null, alto_total: null,
      alto_izquierda: null, alto_derecha: null,
      unidades_totales: 1, referencia: '', posicion: prev.length,
    }])
  }

  function actualizarLinea(idx: number, l: Omit<LineaOrden, 'id' | 'tipologia' | 'color_nombre'>) {
    setLineas(prev => prev.map((x, i) => i === idx ? l : x))
  }

  function eliminarLinea(idx: number) {
    setLineas(prev => prev.filter((_, i) => i !== idx).map((l, i) => ({ ...l, posicion: i })))
  }

  async function guardar() {
    if (lineas.length === 0) { setError('Añade al menos una línea a la orden.'); return }
    if (lineas.some(l => !l.tipologia_id)) { setError('Todas las líneas deben tener tipología.'); return }
    setGuardando(true); setError('')
    try {
      const datos = { nota_id: notaId, cliente_id: clienteId, notas, lineas }
      if (inicial) {
        await actualizarOrden(inicial.id, datos)
        onGuardada({ ...inicial, ...datos, orden_lineas: lineas as any })
      } else {
        const nueva = await crearOrden(datos)
        onGuardada({ id: nueva.id, numero_orden: null, ...datos, creado_en: new Date().toISOString(), orden_lineas: lineas as any })
      }
    } catch (e: any) { setError(e.message ?? 'Error al guardar.') }
    finally         { setGuardando(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Enlace a nota (opcional) */}
      <div style={{ ...card, padding: 16 }}>
        <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 600, color: '#374151' }}>NOTA RELACIONADA (opcional)</p>
        {notaEncontrada ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, flex: 1 }}>
              Nota <strong>#{notaEncontrada.numero_nota}</strong>
              {notaEncontrada.tipo_notas?.nombre ? ` — ${notaEncontrada.tipo_notas.nombre}` : ''}
            </span>
            <button onClick={() => { setNotaEncontrada(null); setNotaId(null); setBusquedaNota('') }} style={btn('#f3f4f6', '#374151')}>
              Quitar
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={busquedaNota}
              onChange={e => setBusquedaNota(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && buscarNota()}
              placeholder="Número de nota…"
              style={{ ...inp, flex: 1 }}
              type="number"
            />
            <button onClick={buscarNota} disabled={buscandoNota} style={btn('#1c2230')}>
              {buscandoNota ? '…' : 'Buscar'}
            </button>
          </div>
        )}
        {errorNota && <p style={{ color: '#dc2626', fontSize: 12, margin: '6px 0 0' }}>{errorNota}</p>}
      </div>

      {/* Enlace a cliente (opcional) */}
      <div style={{ ...card, padding: 16 }}>
        <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 600, color: '#374151' }}>CLIENTE (opcional)</p>
        {clienteEncontrado ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, flex: 1 }}>
              <strong>{clienteEncontrado.nombre}</strong>
              {clienteEncontrado.telefono ? ` — ${clienteEncontrado.telefono}` : ''}
            </span>
            <button onClick={() => { setClienteEncontrado(null); setClienteId(null); setBusquedaCliente('') }} style={btn('#f3f4f6', '#374151')}>
              Quitar
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
              <input
                value={busquedaCliente}
                onChange={e => setBusquedaCliente(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && buscarClientes()}
                placeholder="Nombre o teléfono…"
                style={{ ...inp, flex: 1 }}
              />
              <button onClick={buscarClientes} disabled={buscandoCliente} style={btn('#1c2230')}>
                {buscandoCliente ? '…' : 'Buscar'}
              </button>
            </div>
            {resultadosCliente.length > 0 && (
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
                {resultadosCliente.map(c => (
                  <div
                    key={c.id}
                    onClick={() => { setClienteEncontrado(c); setClienteId(c.id); setResultadosCliente([]) }}
                    style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid #f3f4f6' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                  >
                    <strong>{c.nombre}</strong> {c.telefono ? `— ${c.telefono}` : ''}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Notas */}
      <div>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>NOTAS DE LA ORDEN</label>
        <textarea
          value={notas} onChange={e => setNotas(e.target.value)} rows={2}
          placeholder="Observaciones generales de esta orden…"
          style={{ ...inp, height: 'auto', resize: 'vertical' }}
        />
      </div>

      {/* Líneas */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>LÍNEAS DE LA ORDEN</label>
          <button onClick={añadirLinea} style={btn('#1c2230')}>+ Añadir línea</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {lineas.length === 0 && (
            <p style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: 20 }}>
              Añade la primera línea con el botón de arriba.
            </p>
          )}
          {lineas.map((l, i) => (
            <EditorLinea
              key={i} linea={l} tipologias={tipologias} colores={colores}
              onChange={nl => actualizarLinea(i, nl)}
              onEliminar={() => eliminarLinea(i)}
            />
          ))}
        </div>
      </div>

      {error && <p style={{ color: '#dc2626', fontSize: 13, margin: 0 }}>{error}</p>}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onCancelar} style={btn('#f3f4f6', '#374151')}>Cancelar</button>
        <button onClick={guardar} disabled={guardando} style={btn('#1c2230')}>
          {guardando ? 'Guardando…' : inicial ? 'Guardar cambios' : 'Crear orden'}
        </button>
      </div>
    </div>
  )
}

// ─── VISTA DE ORDEN ───────────────────────────────────────────────────────────

function VistaOrden({ orden }: { orden: OrdenTrabajo }) {
  return (
    <div>
      {/* Cabecera */}
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 16, fontSize: 13 }}>
        {orden.cliente && (
          <span><strong>Cliente:</strong> {orden.cliente.nombre}{orden.cliente.telefono ? ` — ${orden.cliente.telefono}` : ''}</span>
        )}
        {orden.nota && (
          <span><strong>Nota:</strong> #{orden.nota.numero_nota}{(orden.nota as any).tipo_notas?.nombre ? ` — ${(orden.nota as any).tipo_notas.nombre}` : ''}</span>
        )}
        {orden.notas && (
          <span style={{ color: '#6b7280', fontStyle: 'italic' }}>{orden.notas}</span>
        )}
      </div>

      {/* Líneas */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {orden.orden_lineas.map((linea, i) => {
          const tip = linea.tipologia
          const perfiles = tip?.tipologia_filas.filter(f => f.tipo === 'perfil') ?? []
          const medidas: Record<string, number> = {
            ancho_total:    linea.ancho_total    ?? 0,
            alto_total:     linea.alto_total     ?? 0,
            alto_izquierda: linea.alto_izquierda ?? 0,
            alto_derecha:   linea.alto_derecha   ?? 0,
          }
          return (
            <div key={i} style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
              {/* Cabecera de línea */}
              <div style={{ background: '#1c2230', color: '#fff', padding: '8px 14px', display: 'flex', gap: 16, fontSize: 13, flexWrap: 'wrap' }}>
                <strong>{tip?.nombre ?? '—'}</strong>
                {linea.color_nombre && <span>Color: <strong>{linea.color_nombre}</strong></span>}
                <span>Unidades: <strong>{linea.unidades_totales}</strong></span>
                {linea.referencia && <span style={{ color: '#aab1c0' }}>{linea.referencia}</span>}
                {/* Medidas */}
                {linea.ancho_total    != null && <span>A: <strong>{linea.ancho_total}</strong></span>}
                {linea.alto_total     != null && <span>H: <strong>{linea.alto_total}</strong></span>}
                {linea.alto_izquierda != null && <span>H.Izq: <strong>{linea.alto_izquierda}</strong></span>}
                {linea.alto_derecha   != null && <span>H.Der: <strong>{linea.alto_derecha}</strong></span>}
              </div>
              {/* Tabla de cortes */}
              {perfiles.length > 0 && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={{ padding: '6px 12px', textAlign: 'left', color: '#374151' }}>Perfil</th>
                      <th style={{ padding: '6px 12px', textAlign: 'left', color: '#6b7280', fontFamily: 'monospace', fontWeight: 400 }}>Fórmula</th>
                      <th style={{ padding: '6px 12px', textAlign: 'center', color: '#374151' }}>Ud.</th>
                      <th style={{ padding: '6px 12px', textAlign: 'right', color: '#374151' }}>Corte (mm)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perfiles.map((p, j) => {
                      if (p.tipo !== 'perfil') return null
                      return (
                        <tr key={j} style={{ borderTop: '1px solid #f3f4f6', background: j % 2 ? '#fafafa' : '#fff' }}>
                          <td style={{ padding: '6px 12px' }}>{p.nombre_perfil}</td>
                          <td style={{ padding: '6px 12px', fontFamily: 'monospace', color: '#9ca3af', fontSize: 12 }}>{p.formula}</td>
                          <td style={{ padding: '6px 12px', textAlign: 'center' }}>{p.unidades}</td>
                          <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 700, fontSize: 14, color: '#1c2230' }}>
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
        })}
      </div>
    </div>
  )
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────

export default function OrdenesExplorer({
  ordenesIniciales,
  tipologias,
  colores,
}: {
  ordenesIniciales: OrdenTrabajo[]
  tipologias: Tipologia[]
  colores: { id: number; nombre: string; activo: boolean }[]
}) {
  const [ordenes,  setOrdenes]  = useState<OrdenTrabajo[]>(ordenesIniciales)
  const [modo,     setModo]     = useState<'lista' | 'nueva' | 'editar'>('lista')
  const [editando, setEditando] = useState<OrdenTrabajo | null>(null)
  const [expandida, setExpandida] = useState<number | null>(null)
  const [eliminando, setEliminando] = useState<number | null>(null)

  function onGuardada(o: OrdenTrabajo) {
    setOrdenes(prev => {
      const existe = prev.find(x => x.id === o.id)
      return existe ? prev.map(x => x.id === o.id ? o : x) : [o, ...prev]
    })
    setModo('lista'); setEditando(null)
  }

  async function onEliminar(id: number) {
    if (!confirm('¿Eliminar esta orden?')) return
    setEliminando(id)
    await eliminarOrden(id)
    setOrdenes(prev => prev.filter(o => o.id !== id))
    setEliminando(null)
  }

  if (modo === 'nueva' || modo === 'editar') {
    return (
      <div>
        <h2 style={{ fontSize: 17, fontWeight: 600, color: '#1c2230', margin: '0 0 20px' }}>
          {modo === 'nueva' ? 'Nueva orden de trabajo' : `Editar orden #${editando?.numero_orden ?? editando?.id}`}
        </h2>
        <div style={{ ...card, padding: 24 }}>
          <FormularioOrden
            inicial={modo === 'editar' ? editando! : undefined}
            tipologias={tipologias} colores={colores}
            onGuardada={onGuardada}
            onCancelar={() => { setModo('lista'); setEditando(null) }}
          />
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: '#1c2230' }}>Órdenes de trabajo</h2>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: '#6b7280' }}>{ordenes.length} órdenes</p>
        </div>
        <button onClick={() => setModo('nueva')} style={btn('#1c2230')}>+ Nueva orden</button>
      </div>

      {ordenes.length === 0 && (
        <p style={{ color: '#9ca3af', textAlign: 'center', padding: 40 }}>
          No hay órdenes. Crea la primera con el botón de arriba.
        </p>
      )}

      {ordenes.map(o => (
        <div key={o.id} style={card}>
          {/* Cabecera */}
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer' }}
            onClick={() => setExpandida(expandida === o.id ? null : o.id)}
          >
            <span style={{ fontSize: 14, color: '#9ca3af' }}>{expandida === o.id ? '▾' : '▸'}</span>
            <div style={{ flex: 1 }}>
              <span style={{ fontWeight: 600, fontSize: 15, color: '#1c2230' }}>
                Orden #{o.numero_orden ?? o.id}
              </span>
              {o.cliente && (
                <span style={{ marginLeft: 10, fontSize: 13, color: '#6b7280' }}>{o.cliente.nombre}</span>
              )}
              <span style={{ marginLeft: 10, fontSize: 12, color: '#9ca3af' }}>
                {o.orden_lineas.length} {o.orden_lineas.length === 1 ? 'línea' : 'líneas'}
              </span>
              {o.notas && (
                <span style={{ marginLeft: 10, fontSize: 12, color: '#9ca3af', fontStyle: 'italic' }}>· {o.notas}</span>
              )}
            </div>
            <span style={{ fontSize: 12, color: '#9ca3af' }}>
              {new Date(o.creado_en).toLocaleDateString('es-ES')}
            </span>
            <button
              onClick={e => { e.stopPropagation(); setEditando(o); setModo('editar') }}
              style={btn('#f3f4f6', '#374151')}
            >Editar</button>
            <button
              onClick={e => { e.stopPropagation(); onEliminar(o.id) }}
              disabled={eliminando === o.id}
              style={btn('#fee2e2', '#dc2626')}
            >{eliminando === o.id ? '…' : 'Eliminar'}</button>
          </div>

          {expandida === o.id && (
            <div style={{ borderTop: '1px solid #f3f4f6', padding: '14px 16px' }}>
              <VistaOrden orden={o} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
