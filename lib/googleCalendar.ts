import { google } from 'googleapis'

// Mapea el mismo color que ya usamos en la app para cada asignado (hexadecimal)
// a uno de los "colorId" predefinidos que acepta la API de Google Calendar.
// Google solo permite un conjunto cerrado de colores por evento (no admite
// hexadecimales libres), así que se busca el más parecido.
const COLORES_GOOGLE_CALENDAR: Record<string, string> = {
  '#3441E0': '9',  // Azul oscuro (Blueberry)
  '#1D9E75': '10', // Verde (Basil)
  '#BA7517': '6',  // Naranja (Tangerine)
  '#7F77DD': '3',  // Morado (Grape)
  '#D63B3B': '11', // Rojo (Tomato)
  '#D6418F': '4',  // Rosa (Flamingo)
  '#1B9E9E': '7',  // Turquesa (Peacock)
  '#8B5E34': '8',  // Marrón → Grafito (Google no tiene marrón, es el más neutro cercano)
}

function obtenerColorIdGoogle(colorHex: string | null | undefined): string | undefined {
  if (!colorHex) return undefined
  return COLORES_GOOGLE_CALENDAR[colorHex.toUpperCase()] ?? undefined
}

function obtenerCredenciales() {
  const clienteEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const clavePrivada = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY

  if (!clienteEmail || !clavePrivada) {
    throw new Error('Faltan las credenciales de Google (variables de entorno no configuradas).')
  }

  // En Vercel, los saltos de línea de la clave privada se guardan como "\n"
  // literales dentro del valor de la variable de entorno; hay que convertirlos
  // a saltos de línea reales para que la librería de Google los acepte.
  const clavePrivadaFormateada = clavePrivada.replace(/\\n/g, '\n')

  return new google.auth.JWT({
    email: clienteEmail,
    key: clavePrivadaFormateada,
    scopes: ['https://www.googleapis.com/auth/calendar'],
  })
}

export type DatosEventoNota = {
  numeroNota: number
  tipoNota: string
  fechaCitaISO: string // 'YYYY-MM-DD'
  horaCitaHHMM: string // 'HH:MM'
  duracionMinutos: number
  direccion: string
  nombreCliente: string
  telefonoCliente: string
  observaciones: string
  colorAsignado: string | null
  pdfUrl: string
}

export type ResultadoEnvioCalendario = {
  eventoId: string
  eventoUrl: string
}

export async function enviarNotaAlCalendario(datos: DatosEventoNota): Promise<ResultadoEnvioCalendario> {
  const calendarioId = process.env.GOOGLE_CALENDAR_ID
  if (!calendarioId) {
    throw new Error('Falta configurar el ID del calendario.')
  }

  const auth = obtenerCredenciales()
  const calendar = google.calendar({ version: 'v3', auth })

  // Fecha/hora de inicio y fin del evento, en hora local de Canarias. Se evita
  // pasar por Date/UTC para no desplazar la hora: el fin se calcula sumando
  // minutos directamente sobre el texto HH:MM.
  const [horaInicio, minutoInicio] = datos.horaCitaHHMM.split(':').map(Number)
  const totalMinutosFin = horaInicio * 60 + minutoInicio + datos.duracionMinutos
  const horaFin = Math.floor(totalMinutosFin / 60) % 24
  const minutoFin = totalMinutosFin % 60
  const horaFinTexto = `${String(horaFin).padStart(2, '0')}:${String(minutoFin).padStart(2, '0')}`

  const inicioTexto = `${datos.fechaCitaISO}T${datos.horaCitaHHMM}:00`
  const finTexto = `${datos.fechaCitaISO}T${horaFinTexto}:00`

  const descripcion = [
    `Cliente: ${datos.nombreCliente}`,
    datos.telefonoCliente ? `Teléfono: ${datos.telefonoCliente}` : null,
    datos.observaciones ? `Observaciones: ${datos.observaciones}` : null,
    `PDF de la nota: ${datos.pdfUrl}`,
  ].filter(Boolean).join('\n')

  const evento = await calendar.events.insert({
    calendarId: calendarioId,
    requestBody: {
      summary: `NT ${datos.numeroNota} ${datos.tipoNota}`.trim(),
      location: datos.direccion || undefined,
      description: descripcion,
      colorId: obtenerColorIdGoogle(datos.colorAsignado),
      start: { dateTime: inicioTexto, timeZone: 'Atlantic/Canary' },
      end: { dateTime: finTexto, timeZone: 'Atlantic/Canary' },
    },
  })

  if (!evento.data.id) throw new Error('No se pudo crear el evento en el calendario.')

  return {
    eventoId: evento.data.id,
    eventoUrl: evento.data.htmlLink ?? '',
  }
}
