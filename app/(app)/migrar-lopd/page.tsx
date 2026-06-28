'use client'

import { useState, useRef } from 'react'
import CabeceraSeccion from '@/components/CabeceraSeccion'
import {
  cargarClientesParaMatch,
  subirDocumentoLopdMasivo,
} from './actions'
import { emparejarNombreArchivo, type ClienteParaMatch, type Candidato } from './emparejar'

type EstadoArchivo = 'pendiente' | 'subiendo' | 'subido' | 'elegir' | 'error'

type ItemArchivo = {
  archivo: File
  estado: EstadoArchivo
  clienteId?: number
  clienteNombre?: string
  candidatos?: Candidato[]
  mensajeError?: string
}

export default function MigrarLopdPage() {
  const [items, setItems] = useState<ItemArchivo[]>([])
  const [clientes, setClientes] = useState<ClienteParaMatch[]>([])
  const [procesando, setProcesando] = useState(false)
  const [analizando, setAnalizando] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleSeleccionarCarpeta(e: React.ChangeEvent<HTMLInputElement>) {
    const archivos = Array.from(e.target.files ?? [])
    const pdfs = archivos.filter((a) => a.name.toLowerCase().endsWith('.pdf') || a.type.startsWith('image/'))
    if (pdfs.length === 0) return

    setAnalizando(true)
    const listaClientes = await cargarClientesParaMatch()
    setClientes(listaClientes)

    const resultado: ItemArchivo[] = []
    for (const archivo of pdfs) {
      const match = emparejarNombreArchivo(archivo.name, listaClientes)
      if (match.tipo === 'exacto') {
        resultado.push({ archivo, estado: 'pendiente', clienteId: match.clienteId, clienteNombre: match.clienteNombre })
      } else {
        resultado.push({ archivo, estado: 'elegir', candidatos: match.candidatos })
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

  function elegirCandidato(index: number, clienteId: number, clienteNombre: string) {
    setItems((prev) => prev.map((it, idx) => (idx === index ? { ...it, estado: 'pendiente', clienteId, clienteNombre } : it)))
  }

  function volverAElegir(index: number) {
    setItems((prev) => prev.map((it, idx) => (idx === index ? { ...it, estado: 'elegir', clienteId: undefined, clienteNombre: undefined } : it)))
  }

  const listos = items.filter((i) => i.estado === 'pendiente').length
  const subidos = items.filter((i) => i.estado === 'subido').length
  const porElegir = items.filter((i) => i.estado === 'elegir').length

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
            <Metrica etiqueta="Por elegir" valor={porElegir} color="#854F0B" />
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
              <FilaArchivo
                key={idx}
                item={item}
                clientes={clientes}
                onElegir={(id, nombre) => elegirCandidato(idx, id, nombre)}
                onVolverAElegir={() => volverAElegir(idx)}
              />
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
  item, clientes, onElegir, onVolverAElegir,
}: {
  item: ItemArchivo
  clientes: ClienteParaMatch[]
  onElegir: (clienteId: number, clienteNombre: string) => void
  onVolverAElegir: () => void
}) {
  const colores: Record<EstadoArchivo, { borde: string; fondo: string; texto: string }> = {
    pendiente: { borde: '#D6DAF8', fondo: '#EEF0FD', texto: '#2230B8' },
    subiendo: { borde: '#D6DAF8', fondo: '#EEF0FD', texto: '#2230B8' },
    subido: { borde: '#CDE9DC', fondo: '#E9F5EF', texto: '#0F6E56' },
    elegir: { borde: '#F0DFB9', fondo: '#FBF3E6', texto: '#854F0B' },
    error: { borde: '#F09595', fondo: '#FCEBEB', texto: '#791F1F' },
  }
  const c = colores[item.estado]

  return (
    <div style={{ border: `1px solid ${c.borde}`, background: c.fondo, borderRadius: 8, padding: '8px 12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 13, color: '#1c2230', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {item.archivo.name}
        </span>

        {item.estado === 'pendiente' && (
          <span style={{ fontSize: 12, color: c.texto, display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            → {item.clienteNombre}
            <button onClick={onVolverAElegir} style={{ border: 'none', background: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 11, textDecoration: 'underline' }}>
              cambiar
            </button>
          </span>
        )}
        {item.estado === 'subiendo' && <span style={{ fontSize: 12, color: c.texto, flexShrink: 0 }}>Subiendo...</span>}
        {item.estado === 'subido' && <span style={{ fontSize: 12, color: c.texto, flexShrink: 0 }}>✓ Subido a {item.clienteNombre}</span>}
        {item.estado === 'error' && <span style={{ fontSize: 12, color: c.texto, flexShrink: 0 }}>{item.mensajeError ?? 'Error'}</span>}
      </div>

      {item.estado === 'elegir' && (
        <div style={{ marginTop: 8 }}>
          {item.candidatos && item.candidatos.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {item.candidatos.map((cand) => (
                <button
                  key={cand.id}
                  onClick={() => onElegir(cand.id, cand.nombre)}
                  style={{
                    fontSize: 12, padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
                    border: '1px solid #F0DFB9', background: '#fff', color: '#854F0B',
                  }}
                >
                  {cand.nombre} <span style={{ color: '#A87A2E' }}>({Math.round(cand.similitud * 100)}%)</span>
                </button>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 12, color: c.texto, margin: '0 0 6px' }}>Sin candidatos parecidos.</p>
          )}
          <BuscadorManual clientes={clientes} onElegir={onElegir} />
        </div>
      )}
    </div>
  )
}

function BuscadorManual({
  clientes, onElegir,
}: {
  clientes: ClienteParaMatch[]
  onElegir: (clienteId: number, clienteNombre: string) => void
}) {
  const [texto, setTexto] = useState('')
  const t = texto.trim().toUpperCase()
  const resultados = t.length >= 2
    ? clientes.filter((c) => c.nombre.toUpperCase().includes(t)).slice(0, 8)
    : []

  return (
    <div style={{ marginTop: 6, position: 'relative' }}>
      <input
        type="text"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Buscar cliente manualmente..."
        style={{ fontSize: 12, height: 28, borderRadius: 6, border: '1px solid #F0DFB9', padding: '0 8px', width: 220 }}
      />
      {resultados.length > 0 && (
        <div style={{ position: 'absolute', zIndex: 10, top: 30, left: 0, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.08)', width: 280, maxHeight: 200, overflowY: 'auto' }}>
          {resultados.map((c) => (
            <div
              key={c.id}
              onClick={() => { onElegir(c.id, c.nombre); setTexto('') }}
              style={{ padding: '6px 10px', fontSize: 12, cursor: 'pointer', borderBottom: '1px solid #f0f0f0' }}
            >
              {c.nombre}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
