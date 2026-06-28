// Lógica de comparación de nombres — se ejecuta en el navegador (sin 'use server'),
// porque es pura comparación de texto y no necesita tocar la base de datos.

export type ClienteParaMatch = { id: number; nombre: string }

export type ResultadoMatch =
  | { tipo: 'exacto'; clienteId: number; clienteNombre: string }
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

  // Coincidencia donde uno "contiene" al otro (para casos como "FRANJUPLA S.L EMMA" vs "FRANJUPLA SL")
  const contenidos = clientes.filter((c) => {
    const n = normalizar(c.nombre)
    return n.length > 4 && (n.includes(base) || base.includes(n))
  })
  if (contenidos.length === 1) {
    return { tipo: 'exacto', clienteId: contenidos[0].id, clienteNombre: contenidos[0].nombre }
  }
  if (contenidos.length > 1) {
    return { tipo: 'multiple', opciones: contenidos.map((c) => ({ id: c.id, nombre: c.nombre })) }
  }

  return { tipo: 'sin_coincidencia' }
}
