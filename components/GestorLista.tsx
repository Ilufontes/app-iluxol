'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export type ItemLista = {
  id: number
  nombre: string
  activo: boolean
}

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
  const supabase = createClient()

  async function anadir() {
    const valor = nuevoValor.trim().toUpperCase()
    if (!valor) return
    setError(null)

    const { data, error } = await supabase
      .from(tabla)
      .insert({ nombre: valor })
      .select('id, nombre, activo')
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
