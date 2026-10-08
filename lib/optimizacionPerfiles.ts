'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { planificarCortes, type NecesidadPlan, type PiezaStockPlan, type AsignacionPlan } from '@/lib/planificadorPerfiles'
import { construirPlan, type FilaPlan, type Mapas, type PlanMaterial } from '@/lib/informeMaterial'

// La pantalla importa estos tipos desde aquí.
export type { BarraPlan, FaltantePlan, ResumenPlan, PlanMaterial } from '@/lib/informeMaterial'

// Las reglas de taller (despunte, sierra, mínimo de retal) viven en
// lib/planificadorPerfiles.ts. Este archivo solo habla con la base de datos.

type Cliente = Awaited<ReturnType<typeof createClient>>

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

async function calcularNecesidades(supabase: Cliente, ordenId: number): Promise<{ necesidades: NecesidadPlan[]; avisos: string[] }> {
  const { data, error } = await supabase
    .from('orden_lineas')
    .select(`
      id, color_id, referencia,
      ancho_total, alto_total, alto_izquierda, alto_derecha, unidades_totales,
      tubo_superior, tubo_inferior, tubo_izquierda, tubo_derecha, tipo_tubo_id,
      tipologias ( nombre, tipo_tubo_id, tubo_catalogo_perfil_id, tipologia_filas ( id, tipo, formula, unidades, catalogo_perfil_id ) )
    `)
    .eq('orden_id', ordenId)
  if (error) throw new Error('No se pudieron cargar las líneas de la orden.')

  const { data: tiposData } = await supabase.from('tipos_tubo').select('id, nombre, descuento, catalogo_perfil_id')
  const tipos = new Map<number, { nombre: string; descuento: number; catalogo_perfil_id: number | null }>(
    (tiposData ?? []).map((t: any) => [t.id, { nombre: t.nombre, descuento: t.descuento ?? 0, catalogo_perfil_id: t.catalogo_perfil_id ?? null }]),
  )

  const necesidades: NecesidadPlan[] = []
  const avisos: string[] = []
  for (const linea of (data ?? []) as any[]) {
    const tip = Array.isArray(linea.tipologias) ? linea.tipologias[0] : linea.tipologias
    const etiqueta = linea.referencia?.trim() || tip?.nombre || `línea ${linea.id}`
    const unidadesLinea = linea.unidades_totales ?? 1
    const filas = (tip?.tipologia_filas ?? []).filter((f: any) => f.tipo === 'perfil' && f.catalogo_perfil_id)
    const vars: Record<string, number> = {
      ancho_total: linea.ancho_total ?? 0, alto_total: linea.alto_total ?? 0,
      alto_izquierda: linea.alto_izquierda ?? 0, alto_derecha: linea.alto_derecha ?? 0,
    }

    // — Perfiles de la tipología —
    for (const fila of filas) {
      const medida = evalFormula(fila.formula, vars)
      if (medida === null || medida <= 0) continue
      const total = (fila.unidades ?? 1) * unidadesLinea
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

    // — Tubos marcados en la línea (mismo cálculo que la pantalla y la hoja impresa) —
    const lados = {
      superior: !!linea.tubo_superior, inferior: !!linea.tubo_inferior,
      izquierda: !!linea.tubo_izquierda, derecha: !!linea.tubo_derecha,
    }
    if (!lados.superior && !lados.inferior && !lados.izquierda && !lados.derecha) continue

    const tipoId: number | null = linea.tipo_tubo_id ?? tip?.tipo_tubo_id ?? null
    const tipo = tipoId ? tipos.get(tipoId) : undefined
    if (!tipo) {
      avisos.push(`Línea «${etiqueta}»: tiene tubos marcados pero no tiene tipo de tubo; no se ha podido calcular su material.`)
      continue
    }
    // La tipología puede imponer su propia referencia solo para SU tipo de tubo por defecto.
    const refPropia = tipoId === tip?.tipo_tubo_id ? (tip?.tubo_catalogo_perfil_id ?? null) : null
    const referencia = refPropia ?? tipo.catalogo_perfil_id
    if (!referencia) {
      avisos.push(`Tubo ${tipo.nombre} (línea «${etiqueta}») sin referencia: asígnala en Ajustes de órdenes → Tipos de tubo, o en la tipología.`)
      continue
    }

    const d = tipo.descuento
    const ancho  = linea.ancho_total || 0
    const altIzq = linea.alto_izquierda || linea.alto_total || 0
    const altDer = linea.alto_derecha   || linea.alto_total || 0
    const laterales    = (lados.izquierda ? 1 : 0) + (lados.derecha ? 1 : 0)
    const horizontales = (lados.superior ? 1 : 0) + (lados.inferior ? 1 : 0)
    const medidas: number[] = []
    if (lados.superior)  medidas.push(ancho  + laterales    * d)
    if (lados.inferior)  medidas.push(ancho  + laterales    * d)
    if (lados.izquierda) medidas.push(altIzq + horizontales * d)
    if (lados.derecha)   medidas.push(altDer + horizontales * d)

    for (const medida of medidas) {
      if (medida <= 0) continue
      for (let i = 0; i < unidadesLinea; i++) {
        necesidades.push({
          orden_linea_id: linea.id,
          tipologia_fila_id: 0, // no viene de una fila de la tipología (se guarda como null)
          catalogo_perfil_id: referencia,
          color_id: linea.color_id ?? null,
          medida_necesaria: medida,
          es_tubo: true,
        })
      }
    }
  }
  return { necesidades, avisos }
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
  const { necesidades, avisos } = await calcularNecesidades(supabase, ordenId)
  const ids = Array.from(new Set(necesidades.map(n => n.catalogo_perfil_id)))
  const stock = await cargarStock(supabase, ids)
  const resultado = planificarCortes(necesidades, stock)
  return { necesidades, resultado, avisos }
}

function filasDesdeAsignaciones(asignaciones: AsignacionPlan[]): FilaPlan[] {
  return asignaciones.map(a => ({
    es_tubo: !!a.necesidad.es_tubo,
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

  const { resultado, avisos } = await calcularPlan(supabase, ordenId)
  const mapas = await cargarMapas(supabase)
  return construirPlan(filasDesdeAsignaciones(resultado.asignaciones), mapas, false, avisos)
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
    const { resultado, avisos } = await calcularPlan(supabase, ordenId)
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
      orden_id: ordenId, orden_linea_id: a.necesidad.orden_linea_id, tipologia_fila_id: a.necesidad.tipologia_fila_id || null,
      catalogo_perfil_id: a.necesidad.catalogo_perfil_id, color_id: a.necesidad.color_id,
      medida_necesaria: a.necesidad.medida_necesaria, es_tubo: !!a.necesidad.es_tubo,
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
    return construirPlan(filasDesdeAsignaciones(asig), mapas, true, avisos)
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
    .select('es_tubo, encontrado, codigo_pieza, catalogo_perfil_id, color_id, estante_id, medida_necesaria, medida_anterior, medida_nueva, pieza_agotada')
    .eq('orden_id', ordenId)
    .eq('revertido', false)
    .order('id', { ascending: true })
  if (!data || data.length === 0) return null

  const filas: FilaPlan[] = data.map((f: any) => ({
    es_tubo: !!f.es_tubo,
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
