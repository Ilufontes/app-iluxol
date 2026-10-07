'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import {
  planificarCortes, DESPUNTE_BARRA_ENTERA, GROSOR_CORTE, LARGOS_BARRA_ENTERA,
  type NecesidadPlan, type PiezaStockPlan, type AsignacionPlan,
} from '@/lib/planificadorPerfiles'

// Las reglas de taller (despunte, sierra, mínimo de retal) viven en
// lib/planificadorPerfiles.ts. Este archivo solo habla con la base de datos.

type Cliente = Awaited<ReturnType<typeof createClient>>

// ─── TIPOS QUE USA LA PANTALLA ────────────────────────────────────────────────

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
type FilaPlan = {
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

type Mapas = {
  catalogo: Map<number, { referencia: string; descripcion: string }>
  colores: Map<number, string>
  estantes: Map<number, string>
}

// ─── UTILIDADES ───────────────────────────────────────────────────────────────

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

async function cargarMapas(supabase: Cliente): Promise<Mapas> {
  const [{ data: catalogo }, { data: colores }, { data: estantes }] = await Promise.all([
    supabase.from('catalogo_perfiles').select('id, referencia, descripcion'),
    supabase.from('colores').select('id, nombre'),
    supabase.from('estantes').select('id, nombre'),
  ])
  return {
    catalogo: new Map((catalogo ?? []).map((c: any) => [c.id, { referencia: c.referencia, descripcion: c.descripcion }])),
    colores:  new Map((colores ?? []).map((c: any) => [c.id, c.nombre])),
    estantes: new Map((estantes ?? []).map((e: any) => [e.id, e.nombre])),
  }
}

// ─── 1. DEMANDA DE UNA ORDEN ──────────────────────────────────────────────────

async function calcularNecesidades(supabase: Cliente, ordenId: number): Promise<NecesidadPlan[]> {
  const { data, error } = await supabase
    .from('orden_lineas')
    .select(`
      id, color_id,
      ancho_total, alto_total, alto_izquierda, alto_derecha, unidades_totales,
      tipologias ( tipologia_filas ( id, tipo, formula, unidades, catalogo_perfil_id ) )
    `)
    .eq('orden_id', ordenId)
  if (error) throw new Error('No se pudieron cargar las líneas de la orden.')

  const necesidades: NecesidadPlan[] = []
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
      const total = (fila.unidades ?? 1) * (linea.unidades_totales ?? 1)
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

// El stock se carga de una vez (por páginas, porque Supabase limita a 1000 filas)
// y se reparte en memoria. Así el plan ve todas las piezas a la vez.
async function cargarStock(supabase: Cliente, perfilIds: number[]): Promise<PiezaStockPlan[]> {
  if (perfilIds.length === 0) return []
  const salida: PiezaStockPlan[] = []
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await supabase
      .from('stock_perfiles')
      .select('id, catalogo_perfil_id, color_id, codigo, medida, estante_id, creado_en')
      .in('catalogo_perfil_id', perfilIds)
      .order('id', { ascending: true })
      .range(desde, desde + 999)
    if (error) throw new Error('No se pudo cargar el inventario.')
    salida.push(...((data ?? []) as PiezaStockPlan[]))
    if (!data || data.length < 1000) break
  }
  return salida
}

async function calcularPlan(supabase: Cliente, ordenId: number) {
  const necesidades = await calcularNecesidades(supabase, ordenId)
  const ids = Array.from(new Set(necesidades.map(n => n.catalogo_perfil_id)))
  const stock = await cargarStock(supabase, ids)
  const resultado = planificarCortes(necesidades, stock)
  return { necesidades, resultado }
}

// ─── 2. CONSTRUIR EL INFORME (misma lógica para vista previa y registro) ──────

function construirPlan(filas: FilaPlan[], mapas: Mapas, aplicado: boolean): PlanMaterial {
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

function filasDesdeAsignaciones(asignaciones: AsignacionPlan[]): FilaPlan[] {
  return asignaciones.map(a => ({
    encontrado: a.encontrado,
    codigo_pieza: a.pieza?.codigo ?? null,
    catalogo_perfil_id: a.necesidad.catalogo_perfil_id,
    color_id: a.necesidad.color_id,
    estante_id: a.pieza?.estante_id ?? null,
    medida_necesaria: a.necesidad.medida_necesaria,
    medida_anterior: a.medida_anterior,
    medida_nueva: a.medida_nueva,
    agotada: a.agotada,
  }))
}

// ─── 3. VISTA PREVIA: calcula qué barras usar SIN tocar el stock ──────────────

export async function previsualizarMaterial(ordenId: number): Promise<PlanMaterial> {
  const supabase = await createClient()
  const { data: orden } = await supabase.from('ordenes_trabajo').select('id, material_generado').eq('id', ordenId).single()
  if (!orden) throw new Error('Orden no encontrada.')
  if (orden.material_generado) throw new Error('El material de esta orden ya se generó. Deshazlo antes de volver a calcularlo.')

  const { resultado } = await calcularPlan(supabase, ordenId)
  const mapas = await cargarMapas(supabase)
  return construirPlan(filasDesdeAsignaciones(resultado.asignaciones), mapas, false)
}

// ─── 4. CONFIRMAR: recalcula con el stock de ahora y descuenta ────────────────

export async function generarInformeMaterial(ordenId: number): Promise<PlanMaterial> {
  const supabase = await createClient()

  // "Reservar" la orden de forma atómica: si dos personas pulsan a la vez, solo una pasa.
  const { data: reservada } = await supabase
    .from('ordenes_trabajo')
    .update({ material_generado: true, material_generado_en: new Date().toISOString() })
    .eq('id', ordenId).eq('material_generado', false)
    .select('id')
  if (!reservada || reservada.length === 0) {
    throw new Error('El material de esta orden ya se generó (o la orden no existe). Recarga la página.')
  }
  const liberar = async () => {
    await supabase.from('ordenes_trabajo').update({ material_generado: false, material_generado_en: null }).eq('id', ordenId)
  }

  const aplicadas: { original: PiezaStockPlan; borrada: boolean }[] = []
  const deshacerStock = async () => {
    for (const a of aplicadas.reverse()) {
      if (a.borrada) {
        await supabase.from('stock_perfiles').insert({
          catalogo_perfil_id: a.original.catalogo_perfil_id, codigo: a.original.codigo, medida: a.original.medida,
          color_id: a.original.color_id, estante_id: a.original.estante_id, creado_en: a.original.creado_en,
        })
      } else {
        await supabase.from('stock_perfiles').update({ medida: a.original.medida }).eq('id', a.original.id)
      }
    }
  }

  try {
    const { resultado } = await calcularPlan(supabase, ordenId)
    const asig = resultado.asignaciones

    // Estado final de cada pieza tocada = el de su último corte.
    const finalPorPieza = new Map<number, AsignacionPlan>()
    for (const a of asig) if (a.encontrado && a.pieza) finalPorPieza.set(a.pieza.id, a)

    for (const a of Array.from(finalPorPieza.values())) {
      const p = a.pieza!
      // La condición .eq('medida', p.medida) detecta si alguien cambió la pieza mientras tanto.
      const q = a.agotada
        ? supabase.from('stock_perfiles').delete().eq('id', p.id).eq('medida', p.medida).select('id')
        : supabase.from('stock_perfiles').update({ medida: a.medida_nueva, actualizado_en: new Date().toISOString() }).eq('id', p.id).eq('medida', p.medida).select('id')
      const { data, error } = await q
      if (error || !data || data.length === 0) {
        throw new Error(`La pieza ${p.codigo} cambió mientras se calculaba el material. No se ha descontado nada; vuelve a intentarlo.`)
      }
      aplicadas.push({ original: p, borrada: a.agotada })
    }

    const agotadasIds = new Set(Array.from(finalPorPieza.values()).filter(a => a.agotada).map(a => a.pieza!.id))
    const filasLog = asig.map(a => ({
      orden_id: ordenId, orden_linea_id: a.necesidad.orden_linea_id, tipologia_fila_id: a.necesidad.tipologia_fila_id,
      catalogo_perfil_id: a.necesidad.catalogo_perfil_id, color_id: a.necesidad.color_id,
      medida_necesaria: a.necesidad.medida_necesaria,
      // Si la pieza se borra al final, su id dejaría de existir: se guarda null (se localiza por código).
      stock_perfil_id: a.pieza && !agotadasIds.has(a.pieza.id) ? a.pieza.id : null,
      codigo_pieza: a.pieza?.codigo ?? null, estante_id: a.pieza?.estante_id ?? null,
      medida_anterior: a.medida_anterior, medida_nueva: a.medida_nueva,
      pieza_agotada: a.agotada, encontrado: a.encontrado,
    }))
    if (filasLog.length > 0) {
      const { error } = await supabase.from('orden_perfiles_uso').insert(filasLog)
      if (error) throw new Error('No se pudo guardar el registro del material.')
    }

    const mapas = await cargarMapas(supabase)
    revalidatePath('/ordenes')
    revalidatePath('/inventario-mosquiteros')
    return construirPlan(filasDesdeAsignaciones(asig), mapas, true)
  } catch (e) {
    await deshacerStock()
    await liberar()
    throw e
  }
}

// ─── 5. CONSULTAR EL INFORME YA GENERADO ──────────────────────────────────────

export async function cargarInformeMaterial(ordenId: number): Promise<PlanMaterial | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('orden_perfiles_uso')
    .select('encontrado, codigo_pieza, catalogo_perfil_id, color_id, estante_id, medida_necesaria, medida_anterior, medida_nueva, pieza_agotada')
    .eq('orden_id', ordenId)
    .eq('revertido', false)
    .order('id', { ascending: true })
  if (!data || data.length === 0) return null

  const filas: FilaPlan[] = data.map((f: any) => ({
    encontrado: f.encontrado, codigo_pieza: f.codigo_pieza, catalogo_perfil_id: f.catalogo_perfil_id,
    color_id: f.color_id, estante_id: f.estante_id, medida_necesaria: f.medida_necesaria,
    medida_anterior: f.medida_anterior, medida_nueva: f.medida_nueva, agotada: f.pieza_agotada,
  }))
  return construirPlan(filas, await cargarMapas(supabase), true)
}

// ─── 6. DESHACER: restaurar el stock afectado por esta orden ──────────────────

export async function deshacerInformeMaterial(ordenId: number): Promise<void> {
  const supabase = await createClient()

  const { data: orden } = await supabase.from('ordenes_trabajo').select('id, material_generado').eq('id', ordenId).single()
  if (!orden) throw new Error('Orden no encontrada.')
  if (!orden.material_generado) throw new Error('Esta orden no tiene material generado.')

  const { data: usos } = await supabase
    .from('orden_perfiles_uso')
    .select('catalogo_perfil_id, color_id, codigo_pieza, estante_id, medida_anterior, medida_nueva, pieza_agotada')
    .eq('orden_id', ordenId).eq('revertido', false).eq('encontrado', true)
    .order('id', { ascending: true })

  // Una pieza puede haberse cortado varias veces en la orden: se agrupan por código
  // y se restaura la medida que tenía ANTES del primer corte.
  const piezas = new Map<string, any[]>()
  for (const u of (usos ?? []) as any[]) {
    const k = `${u.catalogo_perfil_id}|${u.codigo_pieza}`
    if (!piezas.has(k)) piezas.set(k, [])
    piezas.get(k)!.push(u)
  }

  const buscar = async (u: any) => {
    let q = supabase.from('stock_perfiles').select('id, medida').eq('catalogo_perfil_id', u.catalogo_perfil_id).eq('codigo', u.codigo_pieza)
    q = u.color_id ? q.eq('color_id', u.color_id) : q.is('color_id', null)
    const { data } = await q
    return data ?? []
  }

  // 1ª pasada: comprobar que el stock sigue como lo dejó esta orden.
  // Si otra orden posterior usó la pieza, no se toca nada y se avisa.
  const conflictos: string[] = []
  const plan: { filas: any[]; existente: any | null }[] = []
  for (const filas of Array.from(piezas.values())) {
    const ultima = filas[filas.length - 1]
    const actuales = await buscar(ultima)
    if (ultima.pieza_agotada) {
      if (actuales.length > 0) conflictos.push(`El código ${ultima.codigo_pieza} se ha vuelto a dar de alta en el inventario después de esta orden; revísalo antes de deshacer.`)
      plan.push({ filas, existente: null })
    } else if (actuales.length === 0) {
      conflictos.push(`La pieza ${ultima.codigo_pieza} ya no existe en el inventario (puede que se haya borrado a mano).`)
    } else if (actuales[0].medida !== ultima.medida_nueva) {
      conflictos.push(`La pieza ${ultima.codigo_pieza} se ha vuelto a usar o modificado después de esta orden; no se puede deshacer automáticamente.`)
    } else {
      plan.push({ filas, existente: actuales[0] })
    }
  }
  if (conflictos.length > 0) throw new Error(conflictos.join(' '))

  // 2ª pasada: restaurar.
  for (const { filas, existente } of plan) {
    const primera = filas[0]
    if (existente) {
      const { error } = await supabase.from('stock_perfiles').update({ medida: primera.medida_anterior, actualizado_en: new Date().toISOString() }).eq('id', existente.id)
      if (error) throw new Error(`No se pudo restaurar la pieza ${primera.codigo_pieza}.`)
    } else {
      const { error } = await supabase.from('stock_perfiles').insert({
        catalogo_perfil_id: primera.catalogo_perfil_id, codigo: primera.codigo_pieza, medida: primera.medida_anterior,
        color_id: primera.color_id, estante_id: primera.estante_id,
      })
      if (error) throw new Error(`No se pudo restaurar la pieza ${primera.codigo_pieza}.`)
    }
  }

  await supabase.from('orden_perfiles_uso').update({ revertido: true }).eq('orden_id', ordenId).eq('revertido', false)
  await supabase.from('ordenes_trabajo').update({ material_generado: false, material_generado_en: null }).eq('id', ordenId)

  revalidatePath('/ordenes')
  revalidatePath('/inventario-mosquiteros')
}
