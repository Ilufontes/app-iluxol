'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ─── CONSTANTES DE NEGOCIO ─────────────────────────────────────────────────────
// Estas reglas salen de cómo se corta realmente el material en el taller.
// Si cambian con el tiempo (otra máquina, otro margen…), se tocan solo aquí.

const MEDIDA_MINIMA_STOCK = 350          // mm — por debajo de esto no se guarda el retal
const DESPUNTE_BARRA_ENTERA = 50         // mm — desperdicio de un extremo en una barra entera
const GROSOR_CORTE = 4                   // mm — lo que quita la sierra en cada corte
const LARGOS_BARRA_ENTERA = [6000, 6500] // mm — medidas que indican "barra sin cortar todavía"

function evalFormula(formula: string, vars: Record<string, number>): number | null {
  if (!formula?.trim()) return null
  try {
    const expr = formula.replace(/[a-z_]+/gi, m => (vars[m] !== undefined ? String(vars[m]) : 'NaN'))
    // eslint-disable-next-line no-new-func
    const r = new Function(`"use strict"; return (${expr})`)()
    if (typeof r !== 'number' || isNaN(r)) return null
    return Math.round(r)
  } catch {
    return null
  }
}

export type NecesidadPerfil = {
  orden_linea_id: number
  tipologia_fila_id: number
  catalogo_perfil_id: number
  color_id: number | null
  medida_necesaria: number
}

export type LineaInformeMaterial = {
  encontrado: boolean
  codigo_pieza: string | null
  referencia: string
  descripcion: string
  medida_necesaria: number
  estante_nombre: string | null
  color_nombre: string | null
}

// ─── 1. CALCULAR LA DEMANDA DE UNA ORDEN ──────────────────────────────────────

async function calcularNecesidades(ordenId: number): Promise<NecesidadPerfil[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('orden_lineas')
    .select(`
      id, color_id,
      ancho_total, alto_total, alto_izquierda, alto_derecha, unidades_totales,
      tipologias ( tipologia_filas ( id, tipo, formula, unidades, catalogo_perfil_id ) )
    `)
    .eq('orden_id', ordenId)
  if (error) throw new Error('No se pudieron cargar las líneas de la orden.')

  const necesidades: NecesidadPerfil[] = []
  for (const linea of (data ?? []) as any[]) {
    const tip = Array.isArray(linea.tipologias) ? linea.tipologias[0] : linea.tipologias
    const filas = (tip?.tipologia_filas ?? []).filter((f: any) => f.tipo === 'perfil' && f.catalogo_perfil_id)
    const vars: Record<string, number> = {
      ancho_total: linea.ancho_total ?? 0, alto_total: linea.alto_total ?? 0,
      alto_izquierda: linea.alto_izquierda ?? 0, alto_derecha: linea.alto_derecha ?? 0,
    }
    for (const fila of filas) {
      const medida = evalFormula(fila.formula, vars)
      if (medida === null || medida <= 0) continue
      const vecesPorUnidad = fila.unidades ?? 1
      const total = vecesPorUnidad * (linea.unidades_totales ?? 1)
      for (let i = 0; i < total; i++) {
        necesidades.push({
          orden_linea_id: linea.id,
          tipologia_fila_id: fila.id,
          catalogo_perfil_id: fila.catalogo_perfil_id,
          color_id: linea.color_id ?? null,
          medida_necesaria: medida,
        })
      }
    }
  }
  return necesidades
}

// ─── 2. GENERAR EL INFORME: buscar y descontar stock ──────────────────────────

export async function generarInformeMaterial(ordenId: number): Promise<LineaInformeMaterial[]> {
  const supabase = await createClient()

  const { data: orden } = await supabase.from('ordenes_trabajo').select('id, material_generado').eq('id', ordenId).single()
  if (!orden) throw new Error('Orden no encontrada.')
  if (orden.material_generado) throw new Error('El material de esta orden ya se generó. Deshazlo antes de volver a generarlo.')

  const necesidades = await calcularNecesidades(ordenId)
  // Optimización: mayores medidas primero (best-fit-decreasing) agrupadas por
  // referencia+color, para minimizar el desperdicio total del pedido.
  necesidades.sort((a, b) => b.medida_necesaria - a.medida_necesaria)

  const [{ data: catalogo }, { data: coloresData }, { data: estantesData }] = await Promise.all([
    supabase.from('catalogo_perfiles').select('id, referencia, descripcion'),
    supabase.from('colores').select('id, nombre'),
    supabase.from('estantes').select('id, nombre'),
  ])
  const mapaCatalogo = new Map((catalogo ?? []).map((c: any) => [c.id, c]))
  const mapaColores  = new Map((coloresData ?? []).map((c: any) => [c.id, c.nombre]))
  const mapaEstantes = new Map((estantesData ?? []).map((e: any) => [e.id, e.nombre]))

  const filasLog: any[] = []
  const informe: LineaInformeMaterial[] = []

  for (const nec of necesidades) {
    const cat = mapaCatalogo.get(nec.catalogo_perfil_id)
    const refTexto  = cat?.referencia ?? '—'
    const descTexto = cat?.descripcion ?? '—'
    const colorTexto = nec.color_id ? mapaColores.get(nec.color_id) ?? null : null

    // Buscar la pieza más ajustada por arriba, y entre empates la más antigua.
    let query = supabase
      .from('stock_perfiles')
      .select('id, codigo, medida, estante_id')
      .eq('catalogo_perfil_id', nec.catalogo_perfil_id)
      .gte('medida', nec.medida_necesaria + GROSOR_CORTE)

    query = nec.color_id ? query.eq('color_id', nec.color_id) : query.is('color_id', null)

    const { data: candidatos } = await query.order('medida', { ascending: true }).order('creado_en', { ascending: true }).limit(1)
    const pieza = candidatos?.[0]

    if (!pieza) {
      filasLog.push({
        orden_id: ordenId, orden_linea_id: nec.orden_linea_id, tipologia_fila_id: nec.tipologia_fila_id,
        catalogo_perfil_id: nec.catalogo_perfil_id, color_id: nec.color_id,
        medida_necesaria: nec.medida_necesaria, stock_perfil_id: null, codigo_pieza: null,
        estante_id: null, medida_anterior: null, medida_nueva: null,
        pieza_agotada: false, encontrado: false,
      })
      informe.push({
        encontrado: false, codigo_pieza: null, referencia: refTexto, descripcion: descTexto,
        medida_necesaria: nec.medida_necesaria, estante_nombre: null, color_nombre: colorTexto,
      })
      continue
    }

    const esBarraEntera = LARGOS_BARRA_ENTERA.includes(pieza.medida)
    const despunte = esBarraEntera ? DESPUNTE_BARRA_ENTERA : 0
    const medidaNueva = pieza.medida - despunte - nec.medida_necesaria - GROSOR_CORTE
    const seAgota = medidaNueva < MEDIDA_MINIMA_STOCK

    if (seAgota) {
      await supabase.from('stock_perfiles').delete().eq('id', pieza.id)
    } else {
      await supabase.from('stock_perfiles').update({ medida: medidaNueva, actualizado_en: new Date().toISOString() }).eq('id', pieza.id)
    }

    filasLog.push({
      orden_id: ordenId, orden_linea_id: nec.orden_linea_id, tipologia_fila_id: nec.tipologia_fila_id,
      catalogo_perfil_id: nec.catalogo_perfil_id, color_id: nec.color_id,
      medida_necesaria: nec.medida_necesaria, stock_perfil_id: seAgota ? null : pieza.id,
      codigo_pieza: pieza.codigo, estante_id: pieza.estante_id,
      medida_anterior: pieza.medida, medida_nueva: seAgota ? null : medidaNueva,
      pieza_agotada: seAgota, encontrado: true,
    })
    informe.push({
      encontrado: true, codigo_pieza: pieza.codigo, referencia: refTexto, descripcion: descTexto,
      medida_necesaria: nec.medida_necesaria,
      estante_nombre: pieza.estante_id ? mapaEstantes.get(pieza.estante_id) ?? null : null,
      color_nombre: colorTexto,
    })
  }

  if (filasLog.length > 0) {
    await supabase.from('orden_perfiles_uso').insert(filasLog)
  }
  await supabase.from('ordenes_trabajo').update({
    material_generado: true, material_generado_en: new Date().toISOString(),
  }).eq('id', ordenId)

  revalidatePath('/ordenes')
  revalidatePath('/inventario-mosquiteros')
  return informe
}

// ─── 3. CONSULTAR EL INFORME YA GENERADO ──────────────────────────────────────

export async function cargarInformeMaterial(ordenId: number): Promise<LineaInformeMaterial[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('orden_perfiles_uso')
    .select('encontrado, codigo_pieza, medida_necesaria, estante_id, color_id, catalogo_perfil_id')
    .eq('orden_id', ordenId)
    .eq('revertido', false)
    .order('id', { ascending: true })
  if (!data || data.length === 0) return []

  const [{ data: catalogo }, { data: coloresData }, { data: estantesData }] = await Promise.all([
    supabase.from('catalogo_perfiles').select('id, referencia, descripcion'),
    supabase.from('colores').select('id, nombre'),
    supabase.from('estantes').select('id, nombre'),
  ])
  const mapaCatalogo = new Map((catalogo ?? []).map((c: any) => [c.id, c]))
  const mapaColores  = new Map((coloresData ?? []).map((c: any) => [c.id, c.nombre]))
  const mapaEstantes = new Map((estantesData ?? []).map((e: any) => [e.id, e.nombre]))

  return data.map((f: any) => {
    const cat = mapaCatalogo.get(f.catalogo_perfil_id)
    return {
      encontrado: f.encontrado,
      codigo_pieza: f.codigo_pieza,
      referencia: cat?.referencia ?? '—',
      descripcion: cat?.descripcion ?? '—',
      medida_necesaria: f.medida_necesaria,
      estante_nombre: f.estante_id ? mapaEstantes.get(f.estante_id) ?? null : null,
      color_nombre: f.color_id ? mapaColores.get(f.color_id) ?? null : null,
    }
  })
}

// ─── 4. DESHACER: restaurar el stock afectado por esta orden ──────────────────

export async function deshacerInformeMaterial(ordenId: number): Promise<void> {
  const supabase = await createClient()

  const { data: orden } = await supabase.from('ordenes_trabajo').select('id, material_generado').eq('id', ordenId).single()
  if (!orden) throw new Error('Orden no encontrada.')
  if (!orden.material_generado) throw new Error('Esta orden no tiene material generado.')

  const { data: usos } = await supabase
    .from('orden_perfiles_uso')
    .select('*')
    .eq('orden_id', ordenId)
    .eq('revertido', false)
    .eq('encontrado', true)
    .order('id', { ascending: false }) // deshacer en orden inverso al que se aplicó

  // 1º pasada de validación: si alguna pieza se ha usado en otro pedido
  // después (su medida actual ya no coincide con lo que dejamos), no tocamos
  // nada y avisamos, para no descuadrar el trabajo de otra orden posterior.
  const conflictos: string[] = []
  for (const uso of usos ?? []) {
    if (uso.pieza_agotada) continue // se recreará, no hay conflicto posible
    const { data: piezaActual } = await supabase.from('stock_perfiles').select('id, medida').eq('id', uso.stock_perfil_id).maybeSingle()
    if (!piezaActual) {
      conflictos.push(`La pieza ${uso.codigo_pieza} ya no existe en el inventario (puede que se haya borrado a mano).`)
    } else if (piezaActual.medida !== uso.medida_nueva) {
      conflictos.push(`La pieza ${uso.codigo_pieza} se ha vuelto a usar en otro pedido después de esta orden; no se puede deshacer automáticamente.`)
    }
  }
  if (conflictos.length > 0) {
    throw new Error(conflictos.join(' '))
  }

  for (const uso of usos ?? []) {
    if (uso.pieza_agotada) {
      await supabase.from('stock_perfiles').insert({
        catalogo_perfil_id: uso.catalogo_perfil_id,
        codigo: uso.codigo_pieza,
        medida: uso.medida_anterior,
        color_id: uso.color_id,
        estante_id: uso.estante_id,
      })
    } else {
      await supabase.from('stock_perfiles').update({
        medida: uso.medida_anterior, actualizado_en: new Date().toISOString(),
      }).eq('id', uso.stock_perfil_id)
    }
  }

  await supabase.from('orden_perfiles_uso').update({ revertido: true }).eq('orden_id', ordenId).eq('revertido', false)
  await supabase.from('ordenes_trabajo').update({ material_generado: false, material_generado_en: null }).eq('id', ordenId)

  revalidatePath('/ordenes')
  revalidatePath('/inventario-mosquiteros')
}
