import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib'

export type NotaParaPdf = {
  id: number
  numero_nota: number | null
  fecha_entrada: string | null
  observaciones: string | null
  dia_cita: string | null
  hora_cita: string | null
  clientes: { nombre: string; telefono?: string | null; telefono2?: string | null; email?: string | null } | null
  domicilios: { direccion: string; zona?: string | null; municipios?: { nombre: string } | null } | null
  tipo_notas: { nombre: string } | null
  asignados: { nombre: string } | null
  llevar_opciones: { nombre: string } | null
}

function formatearFecha(iso: string | null) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function formatearTelefono(valor: string | null | undefined): string {
  if (!valor) return '—'
  const limpio = valor.replace(/\D/g, '')
  if (limpio.length !== 9) return valor
  return `${limpio.slice(0, 3)} ${limpio.slice(3, 6)} ${limpio.slice(6, 9)}`
}

// 1mm en puntos PDF (72 puntos = 1 pulgada = 25.4mm).
const MM = 72 / 25.4
const ANCHO_PAGINA = 210 * MM
const ALTO_PAGINA = 297 * MM
const MARGEN = 12 * MM

const COLOR_BORDE = rgb(0x1c / 255, 0x22 / 255, 0x30 / 255)
const COLOR_ETIQUETA_FONDO = rgb(0xea / 255, 0xec / 255, 0xef / 255)
const COLOR_CABECERA_FONDO = rgb(0xec / 255, 0xee / 255, 0xf1 / 255)
const COLOR_TEXTO = rgb(0.05, 0.05, 0.08)

function truncarTexto(texto: string, font: PDFFont, tamano: number, anchoMax: number): string {
  if (font.widthOfTextAtSize(texto, tamano) <= anchoMax) return texto
  let recortado = texto
  while (recortado.length > 1 && font.widthOfTextAtSize(recortado + '…', tamano) > anchoMax) {
    recortado = recortado.slice(0, -1)
  }
  return recortado + '…'
}

function partirEnLineas(texto: string, font: PDFFont, tamano: number, anchoMax: number): string[] {
  const lineasOriginales = texto.split('\n')
  const resultado: string[] = []
  for (const linea of lineasOriginales) {
    const palabras = linea.split(' ')
    let actual = ''
    for (const palabra of palabras) {
      const propuesta = actual ? `${actual} ${palabra}` : palabra
      if (font.widthOfTextAtSize(propuesta, tamano) > anchoMax && actual) {
        resultado.push(actual)
        actual = palabra
      } else {
        actual = propuesta
      }
    }
    resultado.push(actual)
  }
  return resultado
}

function contarLineasAproximadas(texto: string, caracteresPorLinea: number): number {
  if (!texto) return 1
  const lineas = texto.split('\n')
  let total = 0
  for (const linea of lineas) {
    total += Math.max(1, Math.ceil(linea.length / caracteresPorLinea))
  }
  return total
}

export async function generarPdfNota(nota: NotaParaPdf, logoBytes?: Uint8Array): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([ANCHO_PAGINA, ALTO_PAGINA])

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const anchoTabla = ANCHO_PAGINA - MARGEN * 2
  const xTabla = MARGEN

  let logoImage = null
  if (logoBytes) {
    try {
      logoImage = await pdfDoc.embedPng(logoBytes)
    } catch {
      logoImage = null
    }
  }

  // El nombre "M.B" se usa como código interno: no debe aparecer en el PDF.
  const nombreAsignado = nota.asignados?.nombre ?? ''
  const mostrarAsignado = nombreAsignado.trim().toUpperCase() !== 'M.B'

  // --- Alturas dinámicas: mismo cálculo que en notas-imprimir/[id]/page.tsx ---
  const ALTURA_LINEA_MM = 4.2
  const lineasObservaciones = contarLineasAproximadas(nota.observaciones ?? '', 90)
  const alturaObservacionesMm = Math.min(60, Math.max(17, lineasObservaciones * ALTURA_LINEA_MM + 6))
  const lineasZona = contarLineasAproximadas(nota.domicilios?.zona ?? '', 42)
  const alturaFilaMunicipioZonaMm = Math.min(30, Math.max(8, lineasZona * ALTURA_LINEA_MM + 4))
  const excesoTotal = Math.max(0, alturaObservacionesMm - 17) + Math.max(0, alturaFilaMunicipioZonaMm - 8)
  const alturaRecuadroApuntesMm = 148 - excesoTotal

  // ---------- Cabecera ----------
  const altoCabecera = 16 * MM
  let yActual = ALTO_PAGINA - MARGEN

  page.drawRectangle({
    x: xTabla, y: yActual - altoCabecera, width: anchoTabla, height: altoCabecera,
    color: COLOR_CABECERA_FONDO, borderColor: COLOR_BORDE, borderWidth: 1,
  })
  page.drawText('ORDEN DE TRABAJO', {
    x: xTabla + 8 * MM, y: yActual - altoCabecera / 2 - 3,
    size: 14, font: fontRegular, color: COLOR_TEXTO,
  })
  if (logoImage) {
    const altoLogo = 8 * MM
    const ratio = logoImage.width / logoImage.height
    const anchoLogo = altoLogo * ratio
    page.drawImage(logoImage, {
      x: xTabla + anchoTabla - anchoLogo - 8 * MM,
      y: yActual - altoCabecera / 2 - altoLogo / 2,
      width: anchoLogo, height: altoLogo,
    })
  }
  yActual -= altoCabecera

  // ---------- Filas ----------
  type Celda = { etiqueta: string; valor: string }
  type Fila = { celdas: Celda[]; alturaMm: number; multilinea?: boolean }

  const municipioNombre = nota.domicilios?.municipios?.nombre ?? '—'
  const horaCitaTexto = nota.hora_cita ? ` · ${nota.hora_cita.slice(0, 5)}` : ''

  const filas: Fila[] = [
    { celdas: [{ etiqueta: 'F. ENTRADA', valor: formatearFecha(nota.fecha_entrada) }], alturaMm: 8 },
    { celdas: [
      { etiqueta: 'NUM. NOTA', valor: String(nota.numero_nota ?? nota.id) },
      { etiqueta: 'TIPO NOTA', valor: nota.tipo_notas?.nombre ?? '—' },
    ], alturaMm: 8 },
    { celdas: [{ etiqueta: 'CLIENTE', valor: nota.clientes?.nombre ?? '—' }], alturaMm: 8 },
    { celdas: [
      { etiqueta: 'TELEFONO', valor: formatearTelefono(nota.clientes?.telefono) },
      { etiqueta: 'TELEFONO 2', valor: formatearTelefono(nota.clientes?.telefono2) },
    ], alturaMm: 8 },
    { celdas: [{ etiqueta: 'E-MAIL', valor: nota.clientes?.email ?? '—' }], alturaMm: 8 },
    { celdas: [
      { etiqueta: 'MUNICIPIO', valor: municipioNombre },
      { etiqueta: 'ZONA', valor: nota.domicilios?.zona || '—' },
    ], alturaMm: alturaFilaMunicipioZonaMm, multilineaSegunda: true } as any,
    { celdas: [{ etiqueta: 'DIRECCION', valor: nota.domicilios?.direccion ?? '—' }], alturaMm: 8 },
    { celdas: [{ etiqueta: 'OBSERVACIONES', valor: nota.observaciones || '—' }], alturaMm: alturaObservacionesMm, multilinea: true },
    { celdas: [
      { etiqueta: 'FECHA CITA / HORA', valor: `${formatearFecha(nota.dia_cita)}${horaCitaTexto}` },
      { etiqueta: 'LLEVAR', valor: nota.llevar_opciones?.nombre ?? '—' },
    ], alturaMm: 8 },
    { celdas: [{ etiqueta: 'PARA', valor: mostrarAsignado ? (nombreAsignado || '—') : '' }], alturaMm: 8 },
  ]

  const anchoEtiqueta = 32 * MM
  const padding = 3 * MM
  const tamanoFuenteEtiqueta = 7.5
  const tamanoFuenteValor = 9

  for (const fila of filas as any[]) {
    const alturaFilaPt = fila.alturaMm * MM
    const numCeldas = fila.celdas.length
    const anchoBloque = anchoTabla / numCeldas

    fila.celdas.forEach((celda: Celda, idx: number) => {
      const xBloque = xTabla + anchoBloque * idx
      const xEtiqueta = xBloque
      const xValor = xBloque + anchoEtiqueta
      const anchoValor = anchoBloque - anchoEtiqueta

      page.drawRectangle({
        x: xEtiqueta, y: yActual - alturaFilaPt, width: anchoEtiqueta, height: alturaFilaPt,
        color: COLOR_ETIQUETA_FONDO, borderColor: COLOR_BORDE, borderWidth: 0.7,
      })
      page.drawText(truncarTexto(celda.etiqueta, fontBold, tamanoFuenteEtiqueta, anchoEtiqueta - padding * 2), {
        x: xEtiqueta + padding, y: yActual - alturaFilaPt / 2 - 2.5,
        size: tamanoFuenteEtiqueta, font: fontBold, color: COLOR_TEXTO,
      })

      page.drawRectangle({
        x: xValor, y: yActual - alturaFilaPt, width: anchoValor, height: alturaFilaPt,
        borderColor: COLOR_BORDE, borderWidth: 0.7,
      })

      const esMultilinea = fila.multilinea || (fila.multilineaSegunda && idx === 1)
      if (esMultilinea) {
        const lineas = partirEnLineas(celda.valor, fontRegular, tamanoFuenteValor, anchoValor - padding * 2).slice(0, 6)
        lineas.forEach((linea, i) => {
          page.drawText(linea, {
            x: xValor + padding, y: yActual - 5 - i * 4.5 * MM,
            size: tamanoFuenteValor, font: fontRegular, color: COLOR_TEXTO,
          })
        })
      } else {
        page.drawText(truncarTexto(celda.valor, fontRegular, tamanoFuenteValor, anchoValor - padding * 2), {
          x: xValor + padding, y: yActual - alturaFilaPt / 2 - 2.5,
          size: tamanoFuenteValor, font: fontRegular, color: COLOR_TEXTO,
        })
      }
    })

    yActual -= alturaFilaPt
  }

  // ---------- Recuadro de Apuntes y Mediciones ----------
  const alturaTituloApuntes = 6 * MM
  page.drawRectangle({
    x: xTabla, y: yActual - alturaTituloApuntes, width: anchoTabla, height: alturaTituloApuntes,
    color: rgb(0xf3 / 255, 0xf4 / 255, 0xf6 / 255), borderColor: COLOR_BORDE, borderWidth: 0.7,
  })
  page.drawText('APUNTES Y MEDICIONES', {
    x: xTabla + padding, y: yActual - alturaTituloApuntes / 2 - 2.5,
    size: 7.5, font: fontBold, color: COLOR_TEXTO,
  })
  yActual -= alturaTituloApuntes

  page.drawRectangle({
    x: xTabla, y: yActual - alturaRecuadroApuntesMm * MM, width: anchoTabla, height: alturaRecuadroApuntesMm * MM,
    borderColor: COLOR_BORDE, borderWidth: 0.7,
  })

  return pdfDoc.save()
}
