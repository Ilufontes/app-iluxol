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
    scopes: [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/drive.file',
    ],
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
  pdfBytes: Uint8Array
  pdfNombreArchivo: string
}

export type ResultadoEnvioCalendario = {
  eventoId: string
  eventoUrl: string
  driveArchivoId: string
}

export async function enviarNotaAlCalendario(datos: DatosEventoNota): Promise<ResultadoEnvioCalendario> {
  const calendarioId = process.env.GOOGLE_CALENDAR_ID
  const carpetaDriveId = process.env.GOOGLE_DRIVE_FOLDER_ID

  if (!calendarioId || !carpetaDriveId) {
    throw new Error('Falta configurar el ID del calendario o de la carpeta de Drive.')
  }

  const auth = obtenerCredenciales()
  const drive = google.drive({ version: 'v3', auth })
  const calendar = google.calendar({ version: 'v3', auth })

  // 1. Subir el PDF a la carpeta de Drive compartida.
  const subida = await drive.files.create({
    requestBody: {
      name: datos.pdfNombreArchivo,
      parents: [carpetaDriveId],
    },
    media: {
      mimeType: 'application/pdf',
      body: Buffer.from(datos.pdfBytes),
    },
    fields: 'id, webViewLink',
  })

  const archivoId = subida.data.id
  if (!archivoId) throw new Error('No se pudo subir el PDF a Drive.')

  // El adjunto de un evento de Calendar necesita que el archivo de Drive
  // sea al menos visible por cualquiera con el enlace (si no, el adjunto
  // aparece roto para quien abra el evento sin haber sido invitado).
  await drive.permissions.create({
    fileId: archivoId,
    requestBody: { role: 'reader', type: 'anyone' },
  })

  // 2. Construir fecha/hora de inicio y fin del evento, en hora local de
  // Canarias. Se evita pasar por Date/UTC para no desplazar la hora: se
  // calcula el fin sumando minutos directamente sobre el texto HH:MM.
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
  ].filter(Boolean).join('\n')

  // 3. Crear el evento, con el PDF como adjunto enlazado.
  const evento = await calendar.events.insert({
    calendarId: calendarioId,
    supportsAttachments: true,
    requestBody: {
      summary: `NT ${datos.numeroNota} ${datos.tipoNota}`.trim(),
      location: datos.direccion || undefined,
      description: descripcion,
      colorId: obtenerColorIdGoogle(datos.colorAsignado),
      start: { dateTime: inicioTexto, timeZone: 'Atlantic/Canary' },
      end: { dateTime: finTexto, timeZone: 'Atlantic/Canary' },
      attachments: [
        {
          fileId: archivoId,
          fileUrl: subida.data.webViewLink ?? `https://drive.google.com/file/d/${archivoId}/view`,
          title: datos.pdfNombreArchivo,
          mimeType: 'application/pdf',
        },
      ],
    },
  })

  if (!evento.data.id) throw new Error('No se pudo crear el evento en el calendario.')

  return {
    eventoId: evento.data.id,
    eventoUrl: evento.data.htmlLink ?? '',
    driveArchivoId: archivoId,
  }
}
