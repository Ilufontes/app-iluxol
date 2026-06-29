'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export type ItemLista = {
  id: number
  nombre: string
  activo: boolean
  color?: string | null
}

const PALETA_COLORES = [
  { nombre: 'Azul', valor: '#3441E0' },
  { nombre: 'Verde', valor: '#1D9E75' },
  { nombre: 'Naranja', valor: '#BA7517' },
  { nombre: 'Morado', valor: '#7F77DD' },
  { nombre: 'Rojo', valor: '#D63B3B' },
  { nombre: 'Rosa', valor: '#D6418F' },
  { nombre: 'Turquesa', valor: '#1B9E9E' },
  { nombre: 'Marrón', valor: '#8B5E34' },
]

export default function GestorLista({
  tabla,
  placeholder,
  itemsIniciales,
}: {
  tabla: 'tipo_notas' | 'asignados' | 'llevar_opciones' | 'municipios'
  placeholder: string
  itemsIniciales: ItemLista[]
}) {
  const [items, setItems] = useState<ItemLista[]>(itemsIniciales)
  const [nuevoValor, setNuevoValor] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [selectorAbiertoId, setSelectorAbiertoId] = useState<number | null>(null)
  const supabase = createClient()
  const conColor = tabla === 'asignados'

  async function anadir() {
    const valor = nuevoValor.trim().toUpperCase()
    if (!valor) return
    setError(null)

    const { data, error } = await supabase
      .from(tabla)
      .insert({ nombre: valor })
      .select(conColor ? 'id, nombre, activo, color' : 'id, nombre, activo')
      .single()

    if (error) {
      setError(error.code === '23505' ? 'Ese valor ya existe.' : 'No se pudo añadir. Inténtalo de nuevo.')
      return
    }

    setItems((prev) => [...prev, data as ItemLista].sort((a, b) => a.nombre.localeCompare(b.nombre)))
    setNuevoValor('')
  }

  async function alternarActivo(item: ItemLista) {
    const { error } = await supabase
      .from(tabla)
      .update({ activo: !item.activo })
      .eq('id', item.id)

    if (error) return

    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, activo: !i.activo } : i))
    )
  }

  async function renombrar(item: ItemLista, nuevoNombre: string) {
    const valor = nuevoNombre.trim().toUpperCase()
    if (!valor || valor === item.nombre) return

    const { error } = await supabase
      .from(tabla)
      .update({ nombre: valor })
      .eq('id', item.id)

    if (error) return

    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, nombre: valor } : i)))
  }

  async function cambiarColor(item: ItemLista, color: string | null) {
    const { error } = await supabase
      .from(tabla)
      .update({ color })
      .eq('id', item.id)

    if (error) return

    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, color } : i)))
    setSelectorAbiertoId(null)
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          type="text"
          value={nuevoValor}
          onChange={(e) => setNuevoValor(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && anadir()}
          placeholder={placeholder}
          style={{ flex: 1, height: 36, borderRadius: 8, border: '1px solid #d1d5db', padding: '0 12px', fontSize: 13 }}
        />
        <button
          onClick={anadir}
          style={{ height: 36, padding: '0 14px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', fontSize: 13, cursor: 'pointer' }}
        >
          Añadir
        </button>
      </div>

      {error && <p style={{ fontSize: 12, color: '#b42318', margin: '0 0 12px' }}>{error}</p>}

      <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 8px' }}>
        {items.filter((i) => i.activo).length} de {items.length} activos
      </p>

      <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
        {items.length === 0 && (
          <div style={{ padding: '1.5rem', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
            Sin valores todavía. Añade el primero arriba.
          </div>
        )}
        {items.map((item, idx) => (
          <div
            key={item.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              borderBottom: idx < items.length - 1 ? '1px solid #e5e7eb' : 'none',
              background: item.activo ? '#ffffff' : '#f9fafb',
            }}
          >
            <input
              type="text"
              defaultValue={item.nombre}
              disabled={!item.activo}
              onBlur={(e) => renombrar(item, e.target.value)}
              style={{
                flex: 1,
                height: 30,
                fontSize: 13,
                border: '1px solid transparent',
                background: 'transparent',
                color: item.activo ? '#1c2230' : '#9ca3af',
              }}
            />

            {conColor && (
              <div style={{ position: 'relative', marginLeft: 8, flexShrink: 0 }}>
                <button
                  onClick={() => setSelectorAbiertoId(selectorAbiertoId === item.id ? null : item.id)}
                  title="Color de las notas de este asignado"
                  style={{
                    width: 22, height: 22, borderRadius: '50%', cursor: 'pointer',
                    border: item.color ? '1px solid rgba(0,0,0,0.1)' : '1px dashed #d1d5db',
                    background: item.color ?? '#fff',
                  }}
                />
                {selectorAbiertoId === item.id && (
                  <div style={{
                    position: 'absolute', top: 28, right: 0, zIndex: 20, background: '#fff',
                    border: '1px solid #e5e7eb', borderRadius: 8, padding: 10,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)', width: 168,
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 8 }}>
                      {PALETA_COLORES.map((c) => (
                        <button
                          key={c.valor}
                          title={c.nombre}
                          onClick={() => cambiarColor(item, c.valor)}
                          style={{
                            width: 28, height: 28, borderRadius: '50%', cursor: 'pointer',
                            background: c.valor,
                            border: item.color === c.valor ? '2px solid #1c2230' : '1px solid rgba(0,0,0,0.1)',
                          }}
                        />
                      ))}
                    </div>
                    <button
                      onClick={() => cambiarColor(item, null)}
                      style={{
                        width: '100%', height: 26, borderRadius: 6, border: '1px solid #d1d5db',
                        background: '#fff', fontSize: 11, color: '#6b7280', cursor: 'pointer',
                      }}
                    >
                      Sin color
                    </button>
                  </div>
                )}
              </div>
            )}

            <label style={{ position: 'relative', width: 36, height: 20, flexShrink: 0, marginLeft: 12, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={item.activo}
                onChange={() => alternarActivo(item)}
                style={{ opacity: 0, width: 0, height: 0 }}
              />
              <span
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 10,
                  background: item.activo ? '#16a34a' : '#d1d5db',
                  transition: 'background 0.15s',
                }}
              />
              <span
                style={{
                  position: 'absolute',
                  top: 2,
                  left: item.activo ? 18 : 2,
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  background: '#ffffff',
                  transition: 'left 0.15s',
                }}
              />
            </label>
          </div>
        ))}
      </div>
    </div>
  )
}
