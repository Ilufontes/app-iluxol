// Lógica de comparación de nombres — se ejecuta en el navegador (sin 'use server'),
// porque es pura comparación de texto y no necesita tocar la base de datos.

export type ClienteParaMatch = { id: number; nombre: string }

export type ResultadoMatch =
  | { tipo: 'exacto'; clienteId: number; clienteNombre: string }
  | { tipo: 'sugerencia'; clienteId: number; clienteNombre: string; similitud: number }
  | { tipo: 'sin_coincidencia' }
  | { tipo: 'multiple'; opciones: { id: number; nombre: string }[] }

function normalizar(texto: string) {
  return texto
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quita acentos/tildes
    .replace(/\.[a-z0-9]+$/i, '') // quita extensión si la hubiera
    .replace(/\(\d+\)/g, '') // quita sufijos tipo (2), (3)
    .replace(/[^A-Z0-9]+/g, ' ') // cualquier símbolo raro a espacio
    .trim()
    .replace(/\s+/g, ' ')
}

function palabras(texto: string): string[] {
  return normalizar(texto).split(' ').filter((p) => p.length > 0)
}

// Distancia de Levenshtein: cuántos caracteres hay que cambiar/añadir/quitar
// para convertir un texto en otro. Cuanto más baja, más se parecen.
function distanciaLevenshtein(a: string, b: string): number {
  const filas = a.length + 1
  const columnas = b.length + 1
  const matriz: number[][] = Array.from({ length: filas }, () => new Array(columnas).fill(0))

  for (let i = 0; i < filas; i++) matriz[i][0] = i
  for (let j = 0; j < columnas; j++) matriz[0][j] = j

  for (let i = 1; i < filas; i++) {
    for (let j = 1; j < columnas; j++) {
      if (a[i - 1] === b[j - 1]) {
        matriz[i][j] = matriz[i - 1][j - 1]
      } else {
        matriz[i][j] = Math.min(
          matriz[i - 1][j] + 1,    // borrar
          matriz[i][j - 1] + 1,    // insertar
          matriz[i - 1][j - 1] + 1 // sustituir
        )
      }
    }
  }
  return matriz[a.length][b.length]
}

function similitudTexto(a: string, b: string): number {
  if (a === b) return 1
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 1
  return 1 - distanciaLevenshtein(a, b) / maxLen
}

// Compara dos nombres palabra por palabra (no como una sola cadena larga), para que
// dos personas que comparten solo el nombre de pila ("MARIA ISABEL X" vs "MARIA ISABEL Y")
// no salgan como muy parecidas: lo que de verdad distingue a una persona de otra son
// TODAS sus palabras, no solo las primeras.
function similitudPorPalabras(nombreA: string, nombreB: string): number {
  const palabrasA = palabras(nombreA)
  const palabrasB = palabras(nombreB)
  if (palabrasA.length === 0 || palabrasB.length === 0) return 0

  // Para cada palabra de A, busca su mejor pareja en B (por similitud de texto).
  const usadasEnB = new Set<number>()
  let sumaSimilitudes = 0
  for (const pa of palabrasA) {
    let mejorIdx = -1
    let mejorSim = 0
    palabrasB.forEach((pb, idx) => {
      if (usadasEnB.has(idx)) return
      const sim = similitudTexto(pa, pb)
      if (sim > mejorSim) {
        mejorSim = sim
        mejorIdx = idx
      }
    })
    if (mejorIdx >= 0) usadasEnB.add(mejorIdx)
    sumaSimilitudes += mejorSim
  }

  // Promedio sobre el número total de palabras distintas entre ambos nombres,
  // para penalizar tanto palabras que faltan como palabras de más.
  const totalPalabras = Math.max(palabrasA.length, palabrasB.length)
  return sumaSimilitudes / totalPalabras
}

const UMBRAL_SUGERENCIA = 0.82 // alto a propósito: prioriza dejar "sin coincidencia" antes que sugerir mal

export function emparejarNombreArchivo(
  nombreArchivo: string,
  clientes: ClienteParaMatch[]
): ResultadoMatch {
  const base = normalizar(nombreArchivo)

  const exactos = clientes.filter((c) => normalizar(c.nombre) === base)
  if (exactos.length === 1) {
    return { tipo: 'exacto', clienteId: exactos[0].id, clienteNombre: exactos[0].nombre }
  }
  if (exactos.length > 1) {
    return { tipo: 'multiple', opciones: exactos.map((c) => ({ id: c.id, nombre: c.nombre })) }
  }

  // Coincidencia donde el conjunto de palabras de uno está completamente
  // contenido en el otro (ej. "FRANJUPLA SL" dentro de "FRANJUPLA S.L EMMA").
  // Exige que TODAS las palabras del más corto aparezcan en el más largo,
  // no solo un fragmento de texto suelto.
  const palabrasBase = new Set(palabras(base))
  const contenidos = clientes.filter((c) => {
    const palabrasCliente = new Set(palabras(c.nombre))
    const [chico, grande] = palabrasBase.size <= palabrasCliente.size
      ? [palabrasBase, palabrasCliente]
      : [palabrasCliente, palabrasBase]
    if (chico.size === 0) return false
    return [...chico].every((p) => grande.has(p))
  })
  if (contenidos.length === 1) {
    return { tipo: 'exacto', clienteId: contenidos[0].id, clienteNombre: contenidos[0].nombre }
  }
  if (contenidos.length > 1) {
    return { tipo: 'multiple', opciones: contenidos.map((c) => ({ id: c.id, nombre: c.nombre })) }
  }

  // Sin coincidencia exacta ni de contención: comparamos por palabras para encontrar
  // al cliente más parecido, sin dejar que solo el nombre de pila compartido confunda.
  let mejor: { cliente: ClienteParaMatch; similitud: number } | null = null
  for (const c of clientes) {
    const similitud = similitudPorPalabras(base, c.nombre)
    if (!mejor || similitud > mejor.similitud) {
      mejor = { cliente: c, similitud }
    }
  }
  if (mejor && mejor.similitud >= UMBRAL_SUGERENCIA) {
    return {
      tipo: 'sugerencia',
      clienteId: mejor.cliente.id,
      clienteNombre: mejor.cliente.nombre,
      similitud: mejor.similitud,
    }
  }

  return { tipo: 'sin_coincidencia' }
}
