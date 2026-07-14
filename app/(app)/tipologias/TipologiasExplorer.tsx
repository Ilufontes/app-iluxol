'use client'

import { useState } from 'react'
import type { Tipologia, TipoTubo, FilaTipologia, FilaNueva, FilaVariableNueva, FilaPerfilNueva, FilaTubaNueva, TuboLado, VariableClave } from './actions'
import {
  crearTipologia,
  actualizarTipologia,
  toggleActivoTipologia,
  crearColor,
  toggleActivoColor,
  subirImagenTipologia,
  borrarImagenTipologia,
  cargarTiposTubo,
  actualizarTipoTuboTipologia,
} from './actions'

// ─── EVALUADOR DE FÓRMULAS ────────────────────────────────────────────────────

function evaluarFormula(formula: string, variables: Record<string, number>): string {
  if (!formula.trim()) return '—'
  try {
    const expr = formula.replace(/[a-z_]+/gi, (match) => {
      const val = variables[match]
      return val !== undefined ? String(val) : 'NaN'
    })
    // eslint-disable-next-line no-new-func
    const resultado = new Function(`"use strict"; return (${expr})`)()
    if (typeof resultado !== 'number' || isNaN(resultado)) return '?'
    return String(Math.round(resultado * 100) / 100)
  } catch {
    return '?'
  }
}

// ─── CONSTANTES VISUALES ──────────────────────────────────────────────────────

const VARIABLES_DISPONIBLES: { clave: VariableClave; etiqueta: string }[] = [
  { clave: 'ancho_total',    etiqueta: 'Ancho Total' },
  { clave: 'alto_total',     etiqueta: 'Alto Total' },
  { clave: 'alto_izquierda', etiqueta: 'Alto Izquierda' },
  { clave: 'alto_derecha',   etiqueta: 'Alto Derecha' },
]

const ETIQUETA_VARIABLE: Record<VariableClave, string> = {
  ancho_total:    'Ancho Total',
  alto_total:     'Alto Total',
  alto_izquierda: 'Alto Izq.',
  alto_derecha:   'Alto Der.',
}

const inp: React.CSSProperties = {
  padding: '6px 10px', borderRadius: 7, border: '1px solid #d1d5db',
  fontSize: 13, outline: 'none', background: '#fff', width: '100%', boxSizing: 'border-box',
}
const btn = (color: string, txt = '#fff'): React.CSSProperties => ({
  padding: '6px 14px', borderRadius: 8, border: 'none', background: color,
  color: txt, fontSize: 13, cursor: 'pointer', fontWeight: 500,
})

// ─── EDITOR DE FILAS ──────────────────────────────────────────────────────────

function EditorFilas({ filas, onChange }: {
  filas: FilaNueva[]
  onChange: (filas: FilaNueva[]) => void
}) {
  function añadir(tipo: 'variable' | 'perfil' | 'tubo') {
    const posicion = filas.length
    if (tipo === 'variable') {
      const nueva: FilaVariableNueva = { tipo: 'variable', variable_clave: 'ancho_total', posicion }
      onChange([...filas, nueva])
    } else if (tipo === 'tubo') {
      const nueva: FilaTubaNueva = { tipo: 'tubo', tubo_lado: 'superior', unidades: 1, posicion }
      onChange([...filas, nueva])
    } else {
      const nueva: FilaPerfilNueva = { tipo: 'perfil', nombre_perfil: '', formula: '', unidades: 1, posicion }
      onChange([...filas, nueva])
    }
  }

  function actualizar(idx: number, cambios: Partial<FilaVariableNueva> | Partial<FilaPerfilNueva>) {
    onChange(filas.map((f, i) => i === idx ? { ...f, ...cambios } as FilaNueva : f))
  }

  function eliminar(idx: number) {
    onChange(filas.filter((_, i) => i !== idx).map((f, i) => ({ ...f, posicion: i })))
  }

  function mover(idx: number, dir: -1 | 1) {
    const dest = idx + dir
    if (dest < 0 || dest >= filas.length) return
    const nuevas = [...filas]
    ;[nuevas[idx], nuevas[dest]] = [nuevas[dest], nuevas[idx]]
    onChange(nuevas.map((f, i) => ({ ...f, posicion: i })))
  }

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
        {filas.map((fila, idx) => (
          <div key={idx} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: fila.tipo === 'variable' ? '#f0fdf4' : '#f8fafc',
            border: `1px solid ${fila.tipo === 'variable' ? '#bbf7d0' : '#e2e8f0'}`,
            borderRadius: 8, padding: '7px 10px',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <button onClick={() => mover(idx, -1)} style={{ ...btn('#f3f4f6', '#374151'), padding: '1px 5px', fontSize: 10 }}>▲</button>
              <button onClick={() => mover(idx,  1)} style={{ ...btn('#f3f4f6', '#374151'), padding: '1px 5px', fontSize: 10 }}>▼</button>
            </div>

            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5,
              background: fila.tipo === 'variable' ? '#16a34a' : fila.tipo === 'tubo' ? '#f59e0b' : '#3b82f6',
              color: fila.tipo === 'tubo' ? '#1c2230' : '#fff', whiteSpace: 'nowrap', flexShrink: 0,
            }}>
              {fila.tipo === 'variable' ? 'MEDIDA' : fila.tipo === 'tubo' ? 'TUBO' : 'PERFIL'}
            </span>

            {fila.tipo === 'variable' ? (
              <select
                value={fila.variable_clave}
                onChange={e => actualizar(idx, { variable_clave: e.target.value as VariableClave })}
                style={{ ...inp, flex: 1 }}
              >
                {VARIABLES_DISPONIBLES.map(v => (
                  <option key={v.clave} value={v.clave}>{v.etiqueta}</option>
                ))}
              </select>
            ) : fila.tipo === 'tubo' ? (
              <>
                <select
                  value={fila.tubo_lado}
                  onChange={e => actualizar(idx, { tubo_lado: e.target.value as TuboLado })}
                  style={{ ...inp, flex: 2 }}
                >
                  <option value="superior">Superior</option>
                  <option value="inferior">Inferior</option>
                  <option value="izquierda">Izquierda</option>
                  <option value="derecha">Derecha</option>
                </select>
                <span style={{ fontSize: 11, color: '#6b7280', flex: 2, alignSelf: 'center', paddingLeft: 4 }}>
                  {fila.tubo_lado === 'superior' || fila.tubo_lado === 'inferior'
                    ? 'ancho_total + (laterales × desc)'
                    : fila.tubo_lado === 'izquierda' ? 'alto_izquierda + (horiz × desc)' : 'alto_derecha + (horiz × desc)'}
                </span>
                <input type="number" min={1} value={fila.unidades}
                  onChange={e => actualizar(idx, { unidades: Number(e.target.value) })}
                  style={{ ...inp, width: 60, flexShrink: 0 }} title="Unidades" />
                <span style={{ fontSize: 11, color: '#6b7280', flexShrink: 0 }}>ud</span>
              </>
            ) : (
              <>
                <input
                  value={fila.nombre_perfil}
                  onChange={e => actualizar(idx, { nombre_perfil: e.target.value })}
                  placeholder="Perfil (ej: Cajón 35, Tubo 40x20…)"
                  style={{ ...inp, flex: 2 }}
                />
                <input
                  value={fila.formula}
                  onChange={e => actualizar(idx, { formula: e.target.value })}
                  placeholder="Fórmula (ej: ancho_total - 25)"
                  style={{ ...inp, flex: 2, fontFamily: 'monospace' }}
                />
                <input
                  type="number" min={1}
                  value={fila.unidades}
                  onChange={e => actualizar(idx, { unidades: Number(e.target.value) })}
                  style={{ ...inp, width: 60, flexShrink: 0 }}
                  title="Unidades"
                />
                <span style={{ fontSize: 11, color: '#6b7280', flexShrink: 0 }}>ud</span>
              </>
            )}

            <button onClick={() => eliminar(idx)} style={{ ...btn('#fee2e2', '#dc2626'), padding: '4px 8px', flexShrink: 0 }}>✕</button>
          </div>
        ))}

        {filas.length === 0 && (
          <p style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: '12px 0', margin: 0 }}>
            Aún no hay filas. Usa los botones de abajo para añadir.
          </p>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => añadir('variable')} style={btn('#16a34a')}>+ Medida</button>
        <button onClick={() => añadir('perfil')}   style={btn('#3b82f6')}>+ Perfil</button>
        <button onClick={() => añadir('tubo')}     style={btn('#f59e0b', '#1c2230')}>+ Tubo</button>
      </div>
    </div>
  )
}

// ─── FORMULARIO TIPOLOGÍA ─────────────────────────────────────────────────────

function FormularioTipologia({ inicial, onGuardada, onCancelar }: {
  inicial?: Tipologia
  onGuardada: (t: Tipologia) => void
  onCancelar: () => void
}) {
  const [nombre, setNombre]   = useState(inicial?.nombre ?? '')
  const [notas,  setNotas]    = useState(inicial?.notas ?? '')
  const [filas,  setFilas]    = useState<FilaNueva[]>(inicial?.tipologia_filas ?? [])
  const [guardando,   setGuardando]   = useState(false)
  const [error,       setError]       = useState('')
  const [imagenUrl,   setImagenUrl]   = useState<string | null>(inicial?.imagen_url ?? null)
  const [subiendoImg, setSubiendoImg] = useState(false)
  const [tiposTubo,   setTiposTubo]   = useState<TipoTubo[]>([])
  const [tipoTuboId,  setTipoTuboId]  = useState<number | null>(inicial?.tipo_tubo_id ?? null)
  const [cargandoTubos, setCargandoTubos] = useState(false)

  // Cargar tipos de tubo al montar
  useState(() => {
    cargarTiposTubo().then(setTiposTubo).catch(() => {})
  })

  async function handleImagen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !inicial?.id) return
    setSubiendoImg(true)
    try {
      const fd = new FormData(); fd.append('imagen', file)
      const url = await subirImagenTipologia(inicial.id, fd)
      setImagenUrl(url)
    } catch { setError('Error al subir imagen.') }
    finally  { setSubiendoImg(false) }
  }

  const [prevAncho,  setPrevAncho]  = useState(600)
  const [prevAlto,   setPrevAlto]   = useState(1000)
  const [prevAltIzq, setPrevAltIzq] = useState(1000)
  const [prevAltDer, setPrevAltDer] = useState(1000)

  const variablesPreview: Record<string, number> = {
    ancho_total: prevAncho, alto_total: prevAlto,
    alto_izquierda: prevAltIzq, alto_derecha: prevAltDer,
  }

  async function guardar() {
    if (!nombre.trim()) { setError('El nombre es obligatorio.'); return }
    setGuardando(true); setError('')
    try {
      if (inicial) {
        await actualizarTipologia(inicial.id, { nombre, notas, filas })
        onGuardada({ ...inicial, nombre, notas: notas || null, tipologia_filas: filas as FilaTipologia[] })
      } else {
        const nueva = await crearTipologia({ nombre, notas, filas })
        onGuardada(nueva)
      }
    } catch (e: any) {
      setError(e.message ?? 'Error al guardar.')
    } finally {
      setGuardando(false)
    }
  }

  const filasVariable = filas.filter((f): f is FilaVariableNueva => f.tipo === 'variable')
  const filasPerfil   = filas.filter((f): f is FilaPerfilNueva   => f.tipo === 'perfil')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>NOMBRE</label>
        <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Mosquitero Corredera" style={inp} />
      </div>

      <div>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 8 }}>FILAS</label>
        <EditorFilas filas={filas} onChange={setFilas} />
      </div>

      {filasPerfil.length > 0 && (
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14 }}>
          <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 600, color: '#374151' }}>VISTA PREVIA CON MEDIDAS DE EJEMPLO</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            {filasVariable.map((f, i) => (
              <label key={i} style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 11 }}>
                <span style={{ color: '#6b7280', fontWeight: 600 }}>{ETIQUETA_VARIABLE[f.variable_clave]}</span>
                <input
                  type="number"
                  value={
                    f.variable_clave === 'ancho_total'    ? prevAncho  :
                    f.variable_clave === 'alto_total'     ? prevAlto   :
                    f.variable_clave === 'alto_izquierda' ? prevAltIzq : prevAltDer
                  }
                  onChange={e => {
                    const v = Number(e.target.value)
                    if      (f.variable_clave === 'ancho_total')    setPrevAncho(v)
                    else if (f.variable_clave === 'alto_total')     setPrevAlto(v)
                    else if (f.variable_clave === 'alto_izquierda') setPrevAltIzq(v)
                    else                                             setPrevAltDer(v)
                  }}
                  style={{ ...inp, width: 90 }}
                />
              </label>
            ))}
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#1c2230', color: '#fff' }}>
                <th style={{ padding: '6px 10px', textAlign: 'left' }}>Perfil</th>
                <th style={{ padding: '6px 10px', textAlign: 'left' }}>Fórmula</th>
                <th style={{ padding: '6px 10px', textAlign: 'center' }}>Ud.</th>
                <th style={{ padding: '6px 10px', textAlign: 'right' }}>Resultado</th>
              </tr>
            </thead>
            <tbody>
              {filasPerfil.map((f, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '5px 10px' }}>{f.nombre_perfil || '—'}</td>
                  <td style={{ padding: '5px 10px', fontFamily: 'monospace', color: '#6b7280' }}>{f.formula || '—'}</td>
                  <td style={{ padding: '5px 10px', textAlign: 'center' }}>{f.unidades}</td>
                  <td style={{ padding: '5px 10px', textAlign: 'right', fontWeight: 600 }}>
                    {evaluarFormula(f.formula, variablesPreview)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TIPO DE TUBO */}
      <div>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>TIPO DE TUBO (opcional)</label>
        <p style={{ fontSize: 11, color: '#6b7280', margin: '0 0 6px' }}>
          Si esta tipología puede llevar tubos, selecciona el tipo. Luego en las órdenes aparecerán los checkboxes de lados.
        </p>
        <select
          value={tipoTuboId ?? ''}
          onChange={async e => {
            const val = e.target.value ? Number(e.target.value) : null
            setTipoTuboId(val)
            if (inicial?.id) await actualizarTipoTuboTipologia(inicial.id, val)
          }}
          style={inp}
        >
          <option value="">Sin tubos</option>
          {tiposTubo.filter(t => t.activo).map(t => (
            <option key={t.id} value={t.id}>{t.nombre} ({t.descuento}mm descuento)</option>
          ))}
        </select>
        {!inicial?.id && tipoTuboId === null && (
          <p style={{ fontSize: 11, color: '#9ca3af', margin: '4px 0 0' }}>Guarda primero la tipología para asignar tipo de tubo.</p>
        )}
      </div>

      {/* IMAGEN */}
      <div>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>IMAGEN DE LA TIPOLOGÍA</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {imagenUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imagenUrl} alt="Imagen tipología" style={{ height: 80, width: 120, objectFit: 'contain', border: '1px solid #e5e7eb', borderRadius: 6, background: '#f9fafb' }} />
              <button onClick={async () => { if (inicial?.id) { await borrarImagenTipologia(inicial.id); setImagenUrl(null) } }} style={{ ...btn('#fee2e2', '#dc2626'), padding: '4px 10px', fontSize: 12 }}>Borrar</button>
            </>
          ) : (
            <div style={{ width: 120, height: 80, border: '1px dashed #d1d5db', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 11 }}>
              Sin imagen
            </div>
          )}
          {inicial?.id ? (
            <label style={{ cursor: 'pointer', ...btn('#f3f4f6', '#374151'), padding: '6px 12px', fontSize: 12 }}>
              {subiendoImg ? 'Subiendo…' : '📷 Subir imagen'}
              <input type="file" accept="image/*" onChange={handleImagen} style={{ display: 'none' }} disabled={subiendoImg} />
            </label>
          ) : (
            <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>Guarda primero la tipología para poder añadir imagen.</p>
          )}
        </div>
      </div>

      <div>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>NOTAS</label>
        <textarea
          value={notas} onChange={e => setNotas(e.target.value)} rows={2}
          placeholder="Observaciones sobre esta tipología…"
          style={{ ...inp, height: 'auto', resize: 'vertical' }}
        />
      </div>

      {error && <p style={{ color: '#dc2626', fontSize: 13, margin: 0 }}>{error}</p>}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onCancelar} style={btn('#f3f4f6', '#374151')}>Cancelar</button>
        <button onClick={guardar} disabled={guardando} style={btn('#1c2230')}>
          {guardando ? 'Guardando…' : inicial ? 'Guardar cambios' : 'Crear tipología'}
        </button>
      </div>
    </div>
  )
}

// ─── PANEL DE COLORES ─────────────────────────────────────────────────────────

function PanelColores({ coloresIniciales }: { coloresIniciales: { id: number; nombre: string; activo: boolean }[] }) {
  const [colores,    setColores]    = useState(coloresIniciales)
  const [nuevoColor, setNuevoColor] = useState('')
  const [error,      setError]      = useState('')

  async function añadir() {
    if (!nuevoColor.trim()) return
    setError('')
    try {
      await crearColor(nuevoColor)
      setColores(prev => [...prev, { id: Date.now(), nombre: nuevoColor.trim().toUpperCase(), activo: true }])
      setNuevoColor('')
    } catch (e: any) { setError(e.message) }
  }

  async function toggleColor(id: number, activo: boolean) {
    await toggleActivoColor(id, activo)
    setColores(prev => prev.map(c => c.id === id ? { ...c, activo } : c))
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
      <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 600, color: '#1c2230' }}>Colores</h3>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          value={nuevoColor} onChange={e => setNuevoColor(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && añadir()}
          placeholder="Ej: PLATA, BRONCE, BLANCO…"
          style={{ ...inp, flex: 1 }}
        />
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
            <button
              onClick={() => toggleColor(c.id, !c.activo)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#6b7280', padding: 0 }}
            >
              {c.activo ? '✕' : '↩'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────

export default function TipologiasExplorer({
  tipologiasIniciales,
  coloresIniciales,
}: {
  tipologiasIniciales: Tipologia[]
  coloresIniciales: { id: number; nombre: string; activo: boolean }[]
}) {
  const [tipologias, setTipologias] = useState<Tipologia[]>(tipologiasIniciales)
  const [modo,       setModo]       = useState<'lista' | 'nueva' | 'editar'>('lista')
  const [editando,   setEditando]   = useState<Tipologia | null>(null)
  const [expandida,  setExpandida]  = useState<number | null>(null)

  function onGuardada(t: Tipologia) {
    setTipologias(prev => {
      const existe = prev.find(x => x.id === t.id)
      return existe ? prev.map(x => x.id === t.id ? t : x) : [...prev, t]
    })
    setModo('lista'); setEditando(null)
  }

  async function toggleActivo(id: number, activo: boolean) {
    await toggleActivoTipologia(id, activo)
    setTipologias(prev => prev.map(t => t.id === id ? { ...t, activo } : t))
  }

  if (modo === 'nueva' || modo === 'editar') {
    return (
      <div>
        <h2 style={{ fontSize: 17, fontWeight: 600, color: '#1c2230', margin: '0 0 20px' }}>
          {modo === 'nueva' ? 'Nueva tipología' : `Editar: ${editando?.nombre}`}
        </h2>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 24 }}>
          <FormularioTipologia
            inicial={modo === 'editar' ? editando! : undefined}
            onGuardada={onGuardada}
            onCancelar={() => { setModo('lista'); setEditando(null) }}
          />
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: '#1c2230' }}>Tipologías</h2>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: '#6b7280' }}>
            {tipologias.filter(t => t.activo).length} activas · {tipologias.length} total
          </p>
        </div>
        <button onClick={() => setModo('nueva')} style={btn('#1c2230')}>+ Nueva tipología</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {tipologias.length === 0 && (
          <p style={{ color: '#9ca3af', textAlign: 'center', padding: 40 }}>
            No hay tipologías. Crea la primera con el botón de arriba.
          </p>
        )}
        {tipologias.map(t => (
          <div key={t.id} style={{
            background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12,
            overflow: 'hidden', opacity: t.activo ? 1 : 0.6,
          }}>
            <div
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer' }}
              onClick={() => setExpandida(expandida === t.id ? null : t.id)}
            >
              <span style={{ fontSize: 14, color: '#9ca3af', userSelect: 'none' }}>
                {expandida === t.id ? '▾' : '▸'}
              </span>
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 500, fontSize: 14, color: '#1c2230' }}>{t.nombre}</span>
                <span style={{ marginLeft: 10, fontSize: 12, color: '#9ca3af' }}>
                  {t.tipologia_filas.filter(f => f.tipo === 'perfil').length} perfiles ·{' '}
                  {t.tipologia_filas.filter(f => f.tipo === 'variable').length} medidas
                </span>
              </div>
              {!t.activo && (
                <span style={{ fontSize: 11, background: '#fee2e2', color: '#dc2626', padding: '2px 8px', borderRadius: 6 }}>
                  INACTIVA
                </span>
              )}
              <button
                onClick={e => { e.stopPropagation(); setEditando(t); setModo('editar') }}
                style={btn('#f3f4f6', '#374151')}
              >Editar</button>
              <button
                onClick={e => { e.stopPropagation(); toggleActivo(t.id, !t.activo) }}
                style={btn(t.activo ? '#fee2e2' : '#f0fdf4', t.activo ? '#dc2626' : '#16a34a')}
              >{t.activo ? 'Desactivar' : 'Activar'}</button>
            </div>

            {expandida === t.id && (
              <div style={{ borderTop: '1px solid #f3f4f6', padding: '12px 16px' }}>
                {t.tipologia_filas.length === 0 ? (
                  <p style={{ color: '#9ca3af', fontSize: 13, margin: 0 }}>Sin filas definidas.</p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        <th style={{ padding: '5px 10px', textAlign: 'left', color: '#6b7280', fontWeight: 500 }}>Tipo</th>
                        <th style={{ padding: '5px 10px', textAlign: 'left', color: '#6b7280', fontWeight: 500 }}>Perfil / Variable</th>
                        <th style={{ padding: '5px 10px', textAlign: 'left', color: '#6b7280', fontWeight: 500 }}>Fórmula</th>
                        <th style={{ padding: '5px 10px', textAlign: 'center', color: '#6b7280', fontWeight: 500 }}>Ud.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {t.tipologia_filas.map((f, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '5px 10px' }}>
                            <span style={{
                              fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                              background: f.tipo === 'variable' ? '#dcfce7' : '#dbeafe',
                              color:      f.tipo === 'variable' ? '#16a34a' : '#1d4ed8',
                            }}>
                              {f.tipo === 'variable' ? 'MEDIDA' : 'PERFIL'}
                            </span>
                          </td>
                          <td style={{ padding: '5px 10px' }}>
                            {f.tipo === 'variable' ? ETIQUETA_VARIABLE[f.variable_clave] : f.nombre_perfil}
                          </td>
                          <td style={{ padding: '5px 10px', fontFamily: 'monospace', color: '#6b7280' }}>
                            {f.tipo === 'perfil' ? f.formula : '—'}
                          </td>
                          <td style={{ padding: '5px 10px', textAlign: 'center' }}>
                            {f.tipo === 'perfil' ? f.unidades : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {t.notas && (
                  <p style={{ fontSize: 12, color: '#6b7280', margin: '10px 0 0', fontStyle: 'italic' }}>
                    📝 {t.notas}
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <PanelColores coloresIniciales={coloresIniciales} />
    </div>
  )
}
