// Lógica de comparación de nombres — se ejecuta en el navegador (sin 'use server'),
// porque es pura comparación de texto y no necesita tocar la base de datos.

export type ClienteParaMatch = { id: number; nombre: string }

export type Candidato = { id: number; nombre: string; similitud: number }

export type ResultadoMatch =
  | { tipo: 'exacto'; clienteId: number; clienteNombre: string }
  | { tipo: 'elegir'; candidatos: Candidato[] } // siempre 1 a 3 opciones, ordenadas de mejor a peor

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
// Además penaliza fuerte cuando el número de palabras es muy distinto (p.ej. un
// cliente registrado solo como "ANA" no debe poder competir limpio contra
// "ANA FERNANDEZ FIGUEROA"): cuantas más palabras le falten, más penalización.
function similitudPorPalabras(nombreA: string, nombreB: string): number {
  const palabrasA = palabras(nombreA)
  const palabrasB = palabras(nombreB)
  if (palabrasA.length === 0 || palabrasB.length === 0) return 0

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

  // Promedio sobre el número total de palabras (penaliza palabras que faltan o de más).
  const totalPalabras = Math.max(palabrasA.length, palabrasB.length)
  const base = sumaSimilitudes / totalPalabras

  // Penalización por diferencia de longitud — pero NO simétrica:
  // - Si el ARCHIVO tiene menos palabras que el CLIENTE (p.ej. archivo "ANA FERNANDEZ"
  //   y cliente "ANA FERNANDEZ FIGUEROA"), es un caso legítimo y frecuente
  //   (apellido materno omitido al nombrar el escaneo): penalización suave.
  // - Si el CLIENTE tiene menos palabras que el archivo (p.ej. cliente "ANA" registrado
  //   solo con el nombre de pila), es mucho más sospechoso de ser un registro
  //   genérico/incompleto que no corresponde a este archivo: penalización fuerte.
  const archivoMasCorto = palabrasA.length < palabrasB.length
  const diferenciaPalabras = Math.abs(palabrasA.length - palabrasB.length)
  const factorPorPalabra = archivoMasCorto ? 0.08 : 0.18
  const factorPenalizacion = 1 - diferenciaPalabras * factorPorPalabra
  return base * Math.max(factorPenalizacion, 0.3)
}

const MAX_CANDIDATOS = 3
const SIMILITUD_MINIMA_PARA_LISTAR = 0.35 // por debajo de esto, ni se muestra como opción

export function emparejarNombreArchivo(
  nombreArchivo: string,
  clientes: ClienteParaMatch[]
): ResultadoMatch {
  const base = normalizar(nombreArchivo)

  // Coincidencia exacta de texto completo: si hay una sola, se asigna sola.
  const exactos = clientes.filter((c) => normalizar(c.nombre) === base)
  if (exactos.length === 1) {
    return { tipo: 'exacto', clienteId: exactos[0].id, clienteNombre: exactos[0].nombre }
  }

  // En cualquier otro caso (incluida coincidencia exacta múltiple), se calculan
  // todos los candidatos por similitud y se ofrecen los mejores para elegir.
  const candidatos: Candidato[] = clientes
    .map((c) => ({ id: c.id, nombre: c.nombre, similitud: similitudPorPalabras(base, c.nombre) }))
    .filter((c) => c.similitud >= SIMILITUD_MINIMA_PARA_LISTAR)
    .sort((a, b) => b.similitud - a.similitud)
    .slice(0, MAX_CANDIDATOS)

  return { tipo: 'elegir', candidatos }
}
