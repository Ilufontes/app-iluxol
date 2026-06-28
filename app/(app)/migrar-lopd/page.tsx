'use client'

import { useState, useRef } from 'react'
import CabeceraSeccion from '@/components/CabeceraSeccion'
import {
  cargarClientesParaMatch,
  subirDocumentoLopdMasivo,
} from './actions'
import { emparejarNombreArchivo, type ClienteParaMatch } from './emparejar'

type EstadoArchivo = 'pendiente' | 'subiendo' | 'subido' | 'sin_coincidencia' | 'multiple' | 'error'

type ItemArchivo = {
  archivo: File
  estado: EstadoArchivo
  clienteId?: number
  clienteNombre?: string
  opciones?: { id: number; nombre: string }[]
  mensajeError?: string
}

export default function MigrarLopdPage() {
  const [items, setItems] = useState<ItemArchivo[]>([])
  const [procesando, setProcesando] = useState(false)
  const [analizando, setAnalizando] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleSeleccionarCarpeta(e: React.ChangeEvent<HTMLInputElement>) {
    const archivos = Array.from(e.target.files ?? [])
    const pdfs = archivos.filter((a) => a.name.toLowerCase().endsWith('.pdf') || a.type.startsWith('image/'))
    if (pdfs.length === 0) return

    setAnalizando(true)
    const clientes = await cargarClientesParaMatch()

    const resultado: ItemArchivo[] = []
    for (const archivo of pdfs) {
      const match = emparejarNombreArchivo(archivo.name, clientes)
      if (match.tipo === 'exacto') {
        resultado.push({ archivo, estado: 'pendiente', clienteId: match.clienteId, clienteNombre: match.clienteNombre })
      } else if (match.tipo === 'multiple') {
        resultado.push({ archivo, estado: 'multiple', opciones: match.opciones })
      } else {
        resultado.push({ archivo, estado: 'sin_coincidencia' })
      }
    }
    setItems(resultado)
    setAnalizando(false)
  }

  async function subirTodosLosListos() {
    setProcesando(true)
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.estado !== 'pendiente' || !item.clienteId) continue
      setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, estado: 'subiendo' } : it)))
      try {
        const formData = new FormData()
        formData.append('archivo', item.archivo)
        await subirDocumentoLopdMasivo(item.clienteId, item.archivo.name, formData)
        setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, estado: 'subido' } : it)))
      } catch (err: any) {
        setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, estado: 'error', mensajeError: err?.message } : it)))
      }
    }
    setProcesando(false)
  }

  function asignarManualmente(index: number, clienteId: number, clienteNombre: string) {
    setItems((prev) => prev.map((it, idx) => (idx === index ? { ...it, estado: 'pendiente', clienteId, clienteNombre } : it)))
  }

  const listos = items.filter((i) => i.estado === 'pendiente').length
  const subidos = items.filter((i) => i.estado === 'subido').length
  const conProblema = items.filter((i) => i.estado === 'sin_coincidencia' || i.estado === 'multiple' || i.estado === 'error').length

  return (
    <div>
      <CabeceraSeccion
        color="verde"
        titulo="Migrar documentos LOPD"
        subtitulo="Herramienta puntual para subir en bloque los PDF escaneados desde una carpeta"
      />

      {items.length === 0 && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '2rem', textAlign: 'center' }}>
          <p style={{ fontSize: 14, color: '#374151', margin: '0 0 16px' }}>
            Selecciona la carpeta que contiene los PDF escaneados (cada archivo nombrado como el cliente).
          </p>
          <input
            ref={inputRef}
            type="file"
            // @ts-ignore — atributo no estándar pero soportado por todos los navegadores modernos
            webkitdirectory="true"
            directory="true"
            multiple
            onChange={handleSeleccionarCarpeta}
            style={{ display: 'none' }}
          />
          <button
            onClick={() => inputRef.current?.click()}
            disabled={analizando}
            style={{
              height: 40, padding: '0 20px', borderRadius: 8, border: 'none',
              background: '#1D9E75', color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer',
            }}
          >
            {analizando ? 'Analizando archivos...' : 'Seleccionar carpeta'}
          </button>
        </div>
      )}

      {items.length > 0 && (
        <>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <Metrica etiqueta="Listos para subir" valor={listos} color="#1D9E75" />
            <Metrica etiqueta="Subidos" valor={subidos} color="#2230B8" />
            <Metrica etiqueta="Necesitan revisión" valor={conProblema} color="#854F0B" />
          </div>

          {listos > 0 && (
            <button
              onClick={subirTodosLosListos}
              disabled={procesando}
              style={{
                height: 40, padding: '0 20px', borderRadius: 8, border: 'none', marginBottom: 16,
                background: procesando ? '#9ca3af' : '#1D9E75', color: '#fff', fontSize: 14, fontWeight: 500,
                cursor: procesando ? 'default' : 'pointer',
              }}
            >
              {procesando ? 'Subiendo...' : `Subir ${listos} documento${listos === 1 ? '' : 's'}`}
            </button>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {items.map((item, idx) => (
              <FilaArchivo key={idx} item={item} onAsignar={(id, nombre) => asignarManualmente(idx, id, nombre)} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function Metrica({ etiqueta, valor, color }: { etiqueta: string; valor: number; color: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '0.75rem 1rem', flex: 1 }}>
      <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 2px' }}>{etiqueta}</p>
      <p style={{ fontSize: 20, fontWeight: 500, margin: 0, color }}>{valor}</p>
    </div>
  )
}

function FilaArchivo({
  item, onAsignar,
}: {
  item: ItemArchivo
  onAsignar: (clienteId: number, clienteNombre: string) => void
}) {
  const colores: Record<EstadoArchivo, { borde: string; fondo: string; texto: string }> = {
    pendiente: { borde: '#D6DAF8', fondo: '#EEF0FD', texto: '#2230B8' },
    subiendo: { borde: '#D6DAF8', fondo: '#EEF0FD', texto: '#2230B8' },
    subido: { borde: '#CDE9DC', fondo: '#E9F5EF', texto: '#0F6E56' },
    sin_coincidencia: { borde: '#F0DFB9', fondo: '#FBF3E6', texto: '#854F0B' },
    multiple: { borde: '#F0DFB9', fondo: '#FBF3E6', texto: '#854F0B' },
    error: { borde: '#F09595', fondo: '#FCEBEB', texto: '#791F1F' },
  }
  const c = colores[item.estado]

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: `1px solid ${c.borde}`, background: c.fondo, borderRadius: 8, padding: '8px 12px', gap: 12 }}>
      <span style={{ fontSize: 13, color: '#1c2230', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
        {item.archivo.name}
      </span>

      {item.estado === 'pendiente' && <span style={{ fontSize: 12, color: c.texto }}>→ {item.clienteNombre}</span>}
      {item.estado === 'subiendo' && <span style={{ fontSize: 12, color: c.texto }}>Subiendo...</span>}
      {item.estado === 'subido' && <span style={{ fontSize: 12, color: c.texto }}>✓ Subido a {item.clienteNombre}</span>}
      {item.estado === 'error' && <span style={{ fontSize: 12, color: c.texto }}>{item.mensajeError ?? 'Error'}</span>}

      {item.estado === 'sin_coincidencia' && (
        <span style={{ fontSize: 12, color: c.texto }}>Sin coincidencia — revisar a mano</span>
      )}

      {item.estado === 'multiple' && item.opciones && (
        <select
          onChange={(e) => {
            const op = item.opciones!.find((o) => o.id === Number(e.target.value))
            if (op) onAsignar(op.id, op.nombre)
          }}
          defaultValue=""
          style={{ fontSize: 12, height: 28, borderRadius: 6, border: `1px solid ${c.borde}` }}
        >
          <option value="" disabled>Elige cuál es...</option>
          {item.opciones.map((o) => (
            <option key={o.id} value={o.id}>{o.nombre}</option>
          ))}
        </select>
      )}
    </div>
  )
}
