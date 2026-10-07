// Informe de material: tipos y construcción. Módulo PURO (sin base de datos ni
// 'use server') para que lo usen tanto la pantalla de órdenes como la hoja impresa.

import { DESPUNTE_BARRA_ENTERA, GROSOR_CORTE, LARGOS_BARRA_ENTERA } from '@/lib/planificadorPerfiles'

export type BarraPlan = {
  codigo: string
  referencia: string
  descripcion: string
  color_nombre: string | null
  estante_nombre: string | null
  medida_inicial: number
  barra_entera: boolean
  cortes: number[]               // medidas a sacar de esta pieza, en orden
  medida_final: number | null    // lo que queda en estantería (null = se agota)
  resto_descartado: number       // mm que se tiran si se agota
}

export type FaltantePlan = {
  referencia: string
  descripcion: string
  color_nombre: string | null
  cortes: number[]
  total_mm: number               // suma de cortes + sierra, para pedir material
}

export type ResumenPlan = {
  total_cortes: number
  cortes_sin_material: number
  barras_usadas: number
  barras_enteras_abiertas: number
  material_util_mm: number
  material_consumido_mm: number
  perdida_mm: number
  perdida_descartes_mm: number
  perdida_despunte_mm: number
  aprovechamiento_pct: number
}

export type PlanMaterial = {
  aplicado: boolean              // false = vista previa, true = ya descontado del stock
  barras: BarraPlan[]
  faltantes: FaltantePlan[]
  resumen: ResumenPlan
}

// Una fila de plan, venga de la simulación (vista previa) o del registro guardado.
export type FilaPlan = {
  encontrado: boolean
  codigo_pieza: string | null
  catalogo_perfil_id: number
  color_id: number | null
  estante_id: number | null
  medida_necesaria: number
  medida_anterior: number | null
  medida_nueva: number | null
  agotada: boolean
}

export type Mapas = {
  catalogo: Map<number, { referencia: string; descripcion: string }>
  colores: Map<number, string>
  estantes: Map<number, string>
}

export function construirPlan(filas: FilaPlan[], mapas: Mapas, aplicado: boolean): PlanMaterial {
  const textoColor = (id: number | null) => (id ? mapas.colores.get(id) ?? null : null)
  const textoEstante = (id: number | null) => (id ? mapas.estantes.get(id) ?? null : null)
  const info = (id: number) => mapas.catalogo.get(id) ?? { referencia: '—', descripcion: '—' }

  const barras = new Map<string, BarraPlan>()
  const faltantes = new Map<string, FaltantePlan>()
  let util = 0, descartes = 0, enteras = 0, sinMaterial = 0

  for (const f of filas) {
    const cat = info(f.catalogo_perfil_id)

    if (!f.encontrado || f.codigo_pieza === null || f.medida_anterior === null) {
      sinMaterial++
      const k = `${f.catalogo_perfil_id}|${f.color_id ?? 'null'}`
      if (!faltantes.has(k)) {
        faltantes.set(k, { referencia: cat.referencia, descripcion: cat.descripcion, color_nombre: textoColor(f.color_id), cortes: [], total_mm: 0 })
      }
      const fl = faltantes.get(k)!
      fl.cortes.push(f.medida_necesaria)
      fl.total_mm += f.medida_necesaria + GROSOR_CORTE
      continue
    }

    const k = `${f.catalogo_perfil_id}|${f.color_id ?? 'null'}|${f.codigo_pieza}`
    let b = barras.get(k)
    if (!b) {
      b = {
        codigo: f.codigo_pieza, referencia: cat.referencia, descripcion: cat.descripcion,
        color_nombre: textoColor(f.color_id), estante_nombre: textoEstante(f.estante_id),
        medida_inicial: f.medida_anterior, barra_entera: LARGOS_BARRA_ENTERA.includes(f.medida_anterior),
        cortes: [], medida_final: f.medida_anterior, resto_descartado: 0,
      }
      barras.set(k, b)
      if (b.barra_entera) enteras++
    }
    b.cortes.push(f.medida_necesaria)
    b.medida_final = f.agotada ? null : f.medida_nueva
    util += f.medida_necesaria
    if (f.agotada) {
      const despunte = b.barra_entera && b.cortes.length === 1 ? DESPUNTE_BARRA_ENTERA : 0
      const resto = f.medida_anterior - despunte - f.medida_necesaria - GROSOR_CORTE
      b.resto_descartado = resto
      descartes += resto
    }
  }

  const lista = Array.from(barras.values()).sort(
    (a, b) => (a.estante_nombre ?? '~').localeCompare(b.estante_nombre ?? '~', 'es', { numeric: true }) ||
              a.codigo.localeCompare(b.codigo, 'es', { numeric: true }),
  )
  const consumido = lista.reduce((s, b) => s + (b.medida_inicial - (b.medida_final ?? 0)), 0)
  const despunteTotal = enteras * DESPUNTE_BARRA_ENTERA

  return {
    aplicado,
    barras: lista,
    faltantes: Array.from(faltantes.values()),
    resumen: {
      total_cortes: filas.length,
      cortes_sin_material: sinMaterial,
      barras_usadas: lista.length,
      barras_enteras_abiertas: enteras,
      material_util_mm: util,
      material_consumido_mm: consumido,
      perdida_mm: despunteTotal + descartes,
      perdida_descartes_mm: descartes,
      perdida_despunte_mm: despunteTotal,
      aprovechamiento_pct: consumido > 0 ? Math.round((util / consumido) * 1000) / 10 : 0,
    },
  }
}

