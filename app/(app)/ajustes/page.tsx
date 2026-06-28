import { createClient } from '@/lib/supabase/server'
import GestorLista from '@/components/GestorLista'

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
  const { data: items } = await supabase
    .from(pestañaActiva.tabla)
    .select('id, nombre, activo')
    .order('nombre')

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 500, margin: '0 0 4px', color: '#1c2230' }}>
        Ajustes
      </h1>
      <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 24px' }}>
        Activa o desactiva las opciones de los desplegables. Desactivar no borra nada ni afecta a notas ya creadas.
      </p>

      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid #e5e7eb' }}>
        {PESTAÑAS.map((p) => (
          <a
            key={p.tabla}
            href={`/ajustes?tab=${p.tabla}`}
            style={{
              padding: '8px 14px',
              fontSize: 14,
              textDecoration: 'none',
              color: p.tabla === pestañaActiva.tabla ? '#2563eb' : '#374151',
              borderBottom: p.tabla === pestañaActiva.tabla ? '2px solid #2563eb' : '2px solid transparent',
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
    </div>
  )
}
