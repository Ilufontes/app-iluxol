'use client'

import { useState } from 'react'
import { contarCitasDelDia, obtenerCitasDelDia } from './actions'

type CitaDelDia = {
  id: number
  numero_nota: number | null
  hora_cita: string | null
  cliente: string
  direccion: string | null
  asignado: string | null
}

function formatearFechaISO(fecha: Date) {
  return fecha.toISOString().slice(0, 10)
}

function formatearEtiquetaDia(fecha: Date, hoy: Date) {
  const esHoy = formatearFechaISO(fecha) === formatearFechaISO(hoy)
  const ayer = new Date(hoy)
  ayer.setDate(ayer.getDate() - 1)
  const mañana = new Date(hoy)
  mañana.setDate(mañana.getDate() + 1)

  if (esHoy) return 'Citas para hoy'
  if (formatearFechaISO(fecha) === formatearFechaISO(ayer)) return 'Citas de ayer'
  if (formatearFechaISO(fecha) === formatearFechaISO(mañana)) return 'Citas de mañana'

  return `Citas del ${fecha.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`
}

function agruparPorAsignado(citas: CitaDelDia[]) {
  const grupos = new Map<string, CitaDelDia[]>()
  for (const c of citas) {
    const clave = c.asignado ?? '__sin_asignar__'
    if (!grupos.has(clave)) grupos.set(clave, [])
    grupos.get(clave)!.push(c)
  }
  // Sin asignar al final
  return [...grupos.entries()].sort(([a], [b]) => {
    if (a === '__sin_asignar__') return 1
    if (b === '__sin_asignar__') return -1
    return a.localeCompare(b)
  })
}

export default function TarjetaCitasDia({ citasIniciales }: { citasIniciales: number }) {
  const hoy = new Date()
  const [fecha, setFecha] = useState(hoy)
  const [citas, setCitas] = useState(citasIniciales)
  const [cargando, setCargando] = useState(false)
  const [abierto, setAbierto] = useState(false)
  const [detalle, setDetalle] = useState<CitaDelDia[] | null>(null)
  const [cargandoDetalle, setCargandoDetalle] = useState(false)

  async function cambiarDia(delta: number, e: React.MouseEvent) {
    e.stopPropagation()
    const nuevaFecha = new Date(fecha)
    nuevaFecha.setDate(nuevaFecha.getDate() + delta)
    setFecha(nuevaFecha)
    setAbierto(false)
    setDetalle(null)
    setCargando(true)
    const n = await contarCitasDelDia(formatearFechaISO(nuevaFecha))
    setCitas(n)
    setCargando(false)
  }

  async function alternarAbierto() {
    if (citas === 0) return
    const yaAbierto = abierto
    setAbierto(!yaAbierto)
    if (!yaAbierto && !detalle) {
      setCargandoDetalle(true)
      const d = await obtenerCitasDelDia(formatearFechaISO(fecha))
      setDetalle(d)
      setCargandoDetalle(false)
    }
  }

  const grupos = detalle ? agruparPorAsignado(detalle) : []
  const hayConflictoSinAsignar = grupos.some(([clave]) => clave === '__sin_asignar__')

  return (
    <div style={{ background: '#ffffff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
      <div
        onClick={alternarAbierto}
        style={{ padding: '1rem', cursor: citas > 0 ? 'pointer' : 'default' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>{formatearEtiquetaDia(fecha, hoy)}</p>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={(e) => cambiarDia(-1, e)}
              aria-label="Día anterior"
              style={{ width: 22, height: 22, borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12, color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              ‹
            </button>
            <button
              onClick={(e) => cambiarDia(1, e)}
              aria-label="Día siguiente"
              style={{ width: 22, height: 22, borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12, color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              ›
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <p style={{ fontSize: 24, fontWeight: 500, margin: 0, color: '#1c2230', opacity: cargando ? 0.4 : 1 }}>
            {citas}
          </p>
          {citas > 0 && (
            <span style={{ fontSize: 11, color: '#9ca3af' }}>{abierto ? '▲ ocultar' : '▼ ver notas'}</span>
          )}
        </div>
      </div>

      {abierto && (
        <div style={{ borderTop: '1px solid #e5e7eb', padding: '12px 16px', background: '#FAFBFF' }}>
          {cargandoDetalle && <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>Cargando...</p>}

          {!cargandoDetalle && hayConflictoSinAsignar && (
            <div style={{
              background: '#FBF3E6', border: '1px solid #F0DFB9', borderRadius: 8,
              padding: '8px 10px', marginBottom: 10, fontSize: 12, color: '#854F0B',
            }}>
              Hay notas de este día sin nadie asignado todavía.
            </div>
          )}

          {!cargandoDetalle && grupos.map(([asignado, lista]) => (
            <div key={asignado} style={{ marginBottom: 14 }}>
              <p style={{
                fontSize: 12, fontWeight: 500, margin: '0 0 6px',
                color: asignado === '__sin_asignar__' ? '#854F0B' : '#2230B8',
              }}>
                {asignado === '__sin_asignar__' ? 'Sin asignar' : asignado} · {lista.length}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {lista.map((c) => (
                  <div key={c.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: '#1c2230' }}>{c.cliente}</span>
                      {c.hora_cita && <span style={{ fontSize: 12, color: '#6b7280', flexShrink: 0 }}>{c.hora_cita.slice(0, 5)}</span>}
                    </div>
                    {c.direccion && <p style={{ fontSize: 12, color: '#6b7280', margin: '2px 0 0' }}>{c.direccion}</p>}
                  </div>
                ))}
              </div>
            </div>
          ))}

          <a
            href={`/notas?fecha=${formatearFechaISO(fecha)}`}
            style={{ fontSize: 12, color: '#2230B8', textDecoration: 'underline' }}
          >
            Ver todas en Notas →
          </a>
        </div>
      )}
    </div>
  )
}
