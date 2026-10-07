// Planificador de cortes de perfiles. Módulo PURO: no accede a la base de datos
// ni a Next, solo calcula. Así se puede probar de forma aislada y se reutiliza
// tanto para la vista previa como para confirmar el descuento de stock.
//
// Reglas de taller (si cambian, se tocan solo aquí):
//  - Barra entera (6000 o 6500): pierde 50 mm de despunte en el primer corte.
//  - Cada corte de sierra quita 4 mm.
//  - Un resto por debajo de 350 mm no se guarda (se descarta).

export const MEDIDA_MINIMA_STOCK = 350
export const DESPUNTE_BARRA_ENTERA = 50
export const GROSOR_CORTE = 4
export const LARGOS_BARRA_ENTERA = [6000, 6500]

export type NecesidadPlan = {
  orden_linea_id: number
  tipologia_fila_id: number
  catalogo_perfil_id: number
  color_id: number | null
  medida_necesaria: number
}

export type PiezaStockPlan = {
  id: number
  catalogo_perfil_id: number
  color_id: number | null
  codigo: string
  medida: number
  estante_id: number | null
  creado_en: string
}

export type AsignacionPlan = {
  necesidad: NecesidadPlan
  encontrado: boolean
  pieza: PiezaStockPlan | null   // pieza de stock original (medida sin tocar)
  medida_anterior: number | null // medida de la pieza justo antes de ESTE corte
  medida_nueva: number | null    // lo que queda tras este corte (null si se descarta)
  agotada: boolean               // este corte deja un resto < 350 que se descarta
  barra_entera: boolean          // este corte abre una barra entera (con despunte)
  resto_descartado: number       // mm que se tiran en este corte (0 si no se agota)
}

export type EstrategiaPlan = 'ajuste' | 'sin_resto_inutil' | 'retales_primero'

export type MetricasPlan = {
  sin_material: number        // cortes que no encontraron pieza
  perdida_mm: number          // despunte + restos descartados (el kerf es igual en todos los planes)
  perdida_descartes_mm: number
  perdida_despunte_mm: number
  barras_enteras_abiertas: number
  piezas_tocadas: number
  material_util_mm: number    // suma de las medidas cortadas
  material_consumido_mm: number // lo que sale del stock (corte útil + kerf + despunte + descartes)
  aprovechamiento_pct: number
}

export type ResultadoPlan = {
  estrategia: EstrategiaPlan
  asignaciones: AsignacionPlan[] // en el orden en que se cortan (mayor a menor)
  metricas: MetricasPlan
}

type PiezaTrabajo = {
  original: PiezaStockPlan
  actual: number
  agotada: boolean
  abierta: boolean // ya se le ha hecho al menos un corte en este plan
}

const esEntera = (medida: number) => LARGOS_BARRA_ENTERA.includes(medida)

function claveGrupo(perfil: number, color: number | null) {
  return `${perfil}|${color ?? 'null'}`
}

function simular(necesidades: NecesidadPlan[], stock: PiezaStockPlan[], estrategia: EstrategiaPlan): ResultadoPlan {
  // Mayores primero; en empate, por línea para que el resultado sea estable.
  const ordenadas = [...necesidades].sort(
    (a, b) => b.medida_necesaria - a.medida_necesaria || a.orden_linea_id - b.orden_linea_id,
  )

  const grupos = new Map<string, PiezaTrabajo[]>()
  for (const p of stock) {
    const k = claveGrupo(p.catalogo_perfil_id, p.color_id)
    if (!grupos.has(k)) grupos.set(k, [])
    grupos.get(k)!.push({ original: p, actual: p.medida, agotada: false, abierta: false })
  }

  const asignaciones: AsignacionPlan[] = []

  for (const nec of ordenadas) {
    const candidatas = (grupos.get(claveGrupo(nec.catalogo_perfil_id, nec.color_id)) ?? [])
      .filter(p => !p.agotada)
      .map(p => {
        // Una pieza que ya cortamos en este plan nunca vuelve a ser "entera",
        // aunque su resto coincida justo con 6000 o 6500.
        const entera = !p.abierta && esEntera(p.actual)
        const nueva = p.actual - (entera ? DESPUNTE_BARRA_ENTERA : 0) - nec.medida_necesaria - GROSOR_CORTE
        return { p, entera, nueva }
      })
      .filter(c => c.nueva >= 0)

    if (candidatas.length === 0) {
      asignaciones.push({
        necesidad: nec, encontrado: false, pieza: null, medida_anterior: null, medida_nueva: null,
        agotada: false, barra_entera: false, resto_descartado: 0,
      })
      continue
    }

    const inutil = (nueva: number) => nueva > 0 && nueva < MEDIDA_MINIMA_STOCK // resto que se tiraría
    const puntuar = (c: { p: PiezaTrabajo; entera: boolean; nueva: number }): number[] => {
      const antiguedad = new Date(c.p.original.creado_en).getTime()
      if (estrategia === 'sin_resto_inutil') return [inutil(c.nueva) ? c.nueva : 0, c.nueva, antiguedad, c.p.original.id]
      if (estrategia === 'retales_primero')  return [c.entera ? 1 : 0, c.nueva, antiguedad, c.p.original.id]
      return [c.nueva, antiguedad, c.p.original.id] // 'ajuste': la más justa; empate → la más antigua
    }
    const mejor = candidatas.reduce((a, b) => {
      const pa = puntuar(a), pb = puntuar(b)
      for (let i = 0; i < pa.length; i++) if (pa[i] !== pb[i]) return pa[i] < pb[i] ? a : b
      return a
    })

    const agotada = mejor.nueva < MEDIDA_MINIMA_STOCK
    asignaciones.push({
      necesidad: nec, encontrado: true, pieza: mejor.p.original,
      medida_anterior: mejor.p.actual, medida_nueva: agotada ? null : mejor.nueva,
      agotada, barra_entera: mejor.entera, resto_descartado: agotada ? mejor.nueva : 0,
    })
    mejor.p.abierta = true
    mejor.p.actual = mejor.nueva
    if (agotada) mejor.p.agotada = true
  }

  return { estrategia, asignaciones, metricas: calcularMetricas(asignaciones, grupos) }
}

function calcularMetricas(asignaciones: AsignacionPlan[], grupos: Map<string, PiezaTrabajo[]>): MetricasPlan {
  let sin = 0, descartes = 0, enteras = 0, util = 0
  for (const a of asignaciones) {
    if (!a.encontrado) { sin++; continue }
    util += a.necesidad.medida_necesaria
    descartes += a.resto_descartado
    if (a.barra_entera) enteras++
  }
  let tocadas = 0, consumido = 0
  grupos.forEach(lista => {
    for (const p of lista) {
      if (!p.abierta) continue
      tocadas++
      consumido += p.original.medida - (p.agotada ? 0 : p.actual)
    }
  })
  const despunte = enteras * DESPUNTE_BARRA_ENTERA
  return {
    sin_material: sin,
    perdida_mm: despunte + descartes,
    perdida_descartes_mm: descartes,
    perdida_despunte_mm: despunte,
    barras_enteras_abiertas: enteras,
    piezas_tocadas: tocadas,
    material_util_mm: util,
    material_consumido_mm: consumido,
    aprovechamiento_pct: consumido > 0 ? Math.round((util / consumido) * 1000) / 10 : 0,
  }
}

function esMejor(a: MetricasPlan, b: MetricasPlan): boolean {
  // 1º que falte el menor número de cortes, 2º menos material perdido,
  // 3º menos piezas que sacar de la estantería.
  if (a.sin_material !== b.sin_material) return a.sin_material < b.sin_material
  if (a.perdida_mm !== b.perdida_mm) return a.perdida_mm < b.perdida_mm
  return a.piezas_tocadas < b.piezas_tocadas
}

/** Prueba varias estrategias y devuelve la que pierde menos material. */
export function planificarCortes(necesidades: NecesidadPlan[], stock: PiezaStockPlan[]): ResultadoPlan {
  const estrategias: EstrategiaPlan[] = ['ajuste', 'sin_resto_inutil', 'retales_primero']
  let mejor: ResultadoPlan | null = null
  for (const e of estrategias) {
    const r = simular(necesidades, stock, e)
    if (!mejor || esMejor(r.metricas, mejor.metricas)) mejor = r
  }
  return mejor!
}
