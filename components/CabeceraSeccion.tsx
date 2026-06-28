// Cabecera reutilizable para las páginas de sección (Notas, Clientes, Buscador...).
// Mantiene siempre la misma estructura visual; solo cambia el color según la sección,
// para que la app se vea uniforme aunque cada sección tenga su propia identidad.

export type ColorSeccion = 'azul' | 'verde' | 'naranja' | 'morado' | 'gris'

const PALETA: Record<ColorSeccion, { fondo: string; borde: string; titulo: string; subtitulo: string }> = {
  azul:    { fondo: '#EEF0FD', borde: '#D6DAF8', titulo: '#2230B8', subtitulo: '#5A63C9' },
  verde:   { fondo: '#E9F5EF', borde: '#CDE9DC', titulo: '#0F6E56', subtitulo: '#3D8E73' },
  naranja: { fondo: '#FBF3E6', borde: '#F0DFB9', titulo: '#854F0B', subtitulo: '#A87A2E' },
  morado:  { fondo: '#EEEDFE', borde: '#D9D6FA', titulo: '#3C3489', subtitulo: '#6B63B5' },
  gris:    { fondo: '#F3F4F6', borde: '#E5E7EB', titulo: '#1c2230', subtitulo: '#6b7280' },
}

export function coloresSeccion(color: ColorSeccion) {
  return PALETA[color]
}

export default function CabeceraSeccion({
  color,
  titulo,
  subtitulo,
  extra,
  accion,
}: {
  color: ColorSeccion
  titulo: string
  subtitulo?: string
  extra?: React.ReactNode
  accion?: React.ReactNode
}) {
  const p = PALETA[color]
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      marginBottom: 20, padding: '16px 22px', borderRadius: 12, gap: 16,
      background: p.fondo, border: `1px solid ${p.borde}`,
    }}>
      <div style={{ flexShrink: 0 }}>
        <h1 style={{ fontSize: 18, fontWeight: 500, margin: 0, color: p.titulo }}>{titulo}</h1>
        {subtitulo && <p style={{ fontSize: 12, margin: '2px 0 0', color: p.subtitulo, whiteSpace: 'nowrap' }}>{subtitulo}</p>}
      </div>
      {extra && <div style={{ flex: 1, maxWidth: 320 }}>{extra}</div>}
      {accion && <div style={{ flexShrink: 0 }}>{accion}</div>}
    </div>
  )
}
