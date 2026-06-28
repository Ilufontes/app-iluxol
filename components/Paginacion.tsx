'use client'

import Link from 'next/link'

export default function Paginacion({
  paginaActual,
  totalPaginas,
  baseHref,
  color,
}: {
  paginaActual: number
  totalPaginas: number
  baseHref: string
  color: string
}) {
  if (totalPaginas <= 1) return null

  function hrefPagina(p: number) {
    return p <= 1 ? baseHref : `${baseHref}?pagina=${p}`
  }

  // Construye un rango corto de páginas alrededor de la actual, con elipsis.
  const paginas: (number | '...')[] = []
  const rango = 1
  for (let p = 1; p <= totalPaginas; p++) {
    if (p === 1 || p === totalPaginas || (p >= paginaActual - rango && p <= paginaActual + rango)) {
      paginas.push(p)
    } else if (paginas[paginas.length - 1] !== '...') {
      paginas.push('...')
    }
  }

  const botonBase: React.CSSProperties = {
    minWidth: 32, height: 32, padding: '0 8px', borderRadius: 8, fontSize: 13,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    textDecoration: 'none', border: '1px solid #e5e7eb', color: '#374151', background: '#fff',
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 16, flexWrap: 'wrap' }}>
      {paginaActual > 1 ? (
        <Link href={hrefPagina(paginaActual - 1)} style={botonBase}>‹ Anterior</Link>
      ) : (
        <span style={{ ...botonBase, opacity: 0.4, cursor: 'default' }}>‹ Anterior</span>
      )}

      {paginas.map((p, i) =>
        p === '...' ? (
          <span key={`puntos-${i}`} style={{ padding: '0 4px', color: '#9ca3af', fontSize: 13 }}>…</span>
        ) : (
          <Link
            key={p}
            href={hrefPagina(p)}
            style={{
              ...botonBase,
              background: p === paginaActual ? color : '#fff',
              color: p === paginaActual ? '#fff' : '#374151',
              border: p === paginaActual ? 'none' : '1px solid #e5e7eb',
              fontWeight: p === paginaActual ? 500 : 400,
            }}
          >
            {p}
          </Link>
        )
      )}

      {paginaActual < totalPaginas ? (
        <Link href={hrefPagina(paginaActual + 1)} style={botonBase}>Siguiente ›</Link>
      ) : (
        <span style={{ ...botonBase, opacity: 0.4, cursor: 'default' }}>Siguiente ›</span>
      )}
    </div>
  )
}
