'use client'

import { useState } from 'react'
import { buscarGlobal, type ResultadoBusqueda } from './actions'
import CabeceraSeccion from '@/components/CabeceraSeccion'

export default function BuscadorExplorer() {
  const [termino, setTermino] = useState('')
  const [resultados, setResultados] = useState<ResultadoBusqueda[]>([])
  const [buscando, setBuscando] = useState(false)
  const [yaBusco, setYaBusco] = useState(false)

  let temporizador: ReturnType<typeof setTimeout>

  function manejarCambio(valor: string) {
    setTermino(valor)
    clearTimeout(temporizador)
    if (!valor.trim()) {
      setResultados([])
      setYaBusco(false)
      return
    }
    temporizador = setTimeout(async () => {
      setBuscando(true)
      const r = await buscarGlobal(valor)
      setResultados(r)
      setBuscando(false)
      setYaBusco(true)
    }, 350)
  }

  return (
    <div>
      <CabeceraSeccion
        color="morado"
        titulo="Buscador"
        subtitulo="Busca por nombre, teléfono, email o dirección"
      />

      <input
        autoFocus
        value={termino}
        onChange={(e) => manejarCambio(e.target.value)}
        placeholder="Escribe para buscar, ej: domingo"
        style={{
          width: '100%', height: 40, borderRadius: 8, border: '1px solid #d9d6fa',
          padding: '0 14px', fontSize: 15, boxSizing: 'border-box', marginBottom: 16,
        }}
      />

      {buscando && <p style={{ fontSize: 13, color: '#9ca3af' }}>Buscando...</p>}

      {!buscando && yaBusco && resultados.length === 0 && (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af', fontSize: 14, border: '1px solid #e5e7eb', borderRadius: 12, background: '#fff' }}>
          Sin coincidencias para "{termino}".
        </div>
      )}

      {resultados.length > 0 && (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
          {resultados.map((r, idx) => (
            <FilaResultado key={r.id} resultado={r} termino={termino} esUltima={idx === resultados.length - 1} />
          ))}
        </div>
      )}
    </div>
  )
}

function resaltar(texto: string, termino: string) {
  if (!termino) return texto
  const idx = texto.toLowerCase().indexOf(termino.toLowerCase())
  if (idx === -1) return texto
  return (
    <>
      {texto.slice(0, idx)}
      <mark style={{ background: '#faeeda', color: '#412402', padding: '0 1px', borderRadius: 2 }}>
        {texto.slice(idx, idx + termino.length)}
      </mark>
      {texto.slice(idx + termino.length)}
    </>
  )
}

function FilaResultado({
  resultado,
  termino,
  esUltima,
}: {
  resultado: ResultadoBusqueda
  termino: string
  esUltima: boolean
}) {
  return (
    <a
      href={`/clientes?buscar=${encodeURIComponent(resultado.nombre)}`}
      style={{
        display: 'block', padding: '12px 16px', textDecoration: 'none', color: 'inherit',
        borderBottom: esUltima ? 'none' : '1px solid #e5e7eb',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = '#f9fafb')}
      onMouseLeave={(e) => (e.currentTarget.style.background = '')}
    >
      <div style={{ fontWeight: 500, fontSize: 14, color: '#1c2230', marginBottom: 4 }}>
        {resaltar(resultado.nombre, termino)}
      </div>
      <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#6b7280', flexWrap: 'wrap' }}>
        {resultado.telefono && <span>{resaltar(resultado.telefono, termino)}</span>}
        {resultado.email && <span>{resaltar(resultado.email, termino)}</span>}
        {resultado.domicilios.map((d, i) => (
          <span key={i}>
            {resaltar(d.direccion, termino)}{d.municipios?.nombre ? ` — ${d.municipios.nombre}` : ''}
          </span>
        ))}
      </div>
    </a>
  )
}
