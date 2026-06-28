'use client'

import { useState } from 'react'
import { contarCitasDelDia } from './actions'

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

export default function TarjetaCitasDia({ citasIniciales }: { citasIniciales: number }) {
  const hoy = new Date()
  const [fecha, setFecha] = useState(hoy)
  const [citas, setCitas] = useState(citasIniciales)
  const [cargando, setCargando] = useState(false)

  async function cambiarDia(delta: number) {
    const nuevaFecha = new Date(fecha)
    nuevaFecha.setDate(nuevaFecha.getDate() + delta)
    setFecha(nuevaFecha)
    setCargando(true)
    const n = await contarCitasDelDia(formatearFechaISO(nuevaFecha))
    setCitas(n)
    setCargando(false)
  }

  return (
    <div style={{ background: '#ffffff', borderRadius: 12, padding: '1rem', border: '1px solid #e5e7eb' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>{formatearEtiquetaDia(fecha, hoy)}</p>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => cambiarDia(-1)}
            aria-label="Día anterior"
            style={{ width: 22, height: 22, borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12, color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            ‹
          </button>
          <button
            onClick={() => cambiarDia(1)}
            aria-label="Día siguiente"
            style={{ width: 22, height: 22, borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12, color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            ›
          </button>
        </div>
      </div>
      <p style={{ fontSize: 24, fontWeight: 500, margin: 0, color: '#1c2230', opacity: cargando ? 0.4 : 1 }}>
        {citas}
      </p>
    </div>
  )
}
