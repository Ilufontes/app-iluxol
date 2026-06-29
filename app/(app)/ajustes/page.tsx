import { createClient } from '@/lib/supabase/server'
import GestorLista from '@/components/GestorLista'
import CabeceraSeccion from '@/components/CabeceraSeccion'

const PESTAÑAS = [
  { tabla: 'tipo_notas' as const, etiqueta: 'Tipo de nota', placeholder: 'Ej: REPARACION MOSQUITERA' },
  { tabla: 'asignados' as const, etiqueta: 'Asignada', placeholder: 'Ej: DANIEL' },
  { tabla: 'llevar_opciones' as const, etiqueta: 'Llevar', placeholder: 'Ej: MATERIAL' },
  { tabla: 'municipios' as const, etiqueta: 'Municipios', placeholder: 'Ej: SANTA BRIGIDA' },
]

export default async function AjustesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams
  const pestañaActiva = PESTAÑAS.find((p) => p.tabla === tab) ?? PESTAÑAS[0]

  const supabase = await createClient()
  const columnas = pestañaActiva.tabla === 'asignados' ? 'id, nombre, activo, color' : 'id, nombre, activo'
  const { data: items } = await supabase
    .from(pestañaActiva.tabla)
    .select(columnas)
    .order('nombre')

  return (
    <div>
      <CabeceraSeccion
        color="gris"
        titulo="Ajustes"
        subtitulo="Activa o desactiva las opciones de los desplegables. Desactivar no borra nada ni afecta a notas ya creadas."
      />

      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid #e5e7eb' }}>
        {PESTAÑAS.map((p) => (
          <a
            key={p.tabla}
            href={`/ajustes?tab=${p.tabla}`}
            style={{
              padding: '8px 14px',
              fontSize: 14,
              textDecoration: 'none',
              color: p.tabla === pestañaActiva.tabla ? '#1c2230' : '#374151',
              borderBottom: p.tabla === pestañaActiva.tabla ? '2px solid #1c2230' : '2px solid transparent',
              fontWeight: p.tabla === pestañaActiva.tabla ? 500 : 400,
            }}
          >
            {p.etiqueta}
          </a>
        ))}
      </div>

      <GestorLista
        key={pestañaActiva.tabla}
        tabla={pestañaActiva.tabla}
        placeholder={pestañaActiva.placeholder}
        itemsIniciales={items ?? []}
      />

      <div style={{ marginTop: 32, paddingTop: 16, borderTop: '1px solid #e5e7eb' }}>
        <a href="/migrar-lopd" style={{ fontSize: 13, color: '#0F6E56', textDecoration: 'underline' }}>
          Herramienta puntual: migrar documentos LOPD en bloque →
        </a>
      </div>
    </div>
  )
}
