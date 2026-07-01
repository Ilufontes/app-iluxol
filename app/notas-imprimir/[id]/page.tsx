import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

function unoOnulo(valor: any) {
  return Array.isArray(valor) ? (valor[0] ?? null) : valor
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

function contarLineasAproximadas(texto: string, caracteresPorLinea: number): number {
  if (!texto) return 1
  const lineas = texto.split('\n')
  let total = 0
  for (const linea of lineas) {
    total += Math.max(1, Math.ceil(linea.length / caracteresPorLinea))
  }
  return total
}

// Devuelve el cliente adecuado según el contexto:
// - Si hay SERVICE_ROLE_KEY disponible, usa el cliente admin (bypasea RLS,
//   funciona tanto para usuarios logueados como para el enlace de Calendar).
// - Si no, usa el cliente normal con sesión (solo funciona para logueados).
async function crearClienteParaImprimir() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!

  if (serviceKey) {
    return createSupabaseClient(url, serviceKey, {
      auth: { persistSession: false },
    })
  }

  // Fallback: cliente normal con sesión de usuario
  return await createClient()
}

async function cargarNota(id: string) {
  const supabase = await crearClienteParaImprimir()

  const { data: notaCruda, error } = await supabase
    .from('notas')
    .select(`
      id, numero_nota, fecha_entrada, observaciones, dia_cita, hora_cita,
      clientes ( nombre, telefono, telefono2, email ),
      domicilios ( direccion, zona, municipios ( nombre ) ),
      tipo_notas ( nombre ),
      asignados ( nombre ),
      llevar_opciones ( nombre )
    `)
    .eq('id', id)
    .single()

  if (error || !notaCruda) return null

  return {
    ...notaCruda,
    clientes:        unoOnulo(notaCruda.clientes),
    tipo_notas:      unoOnulo(notaCruda.tipo_notas),
    asignados:       unoOnulo(notaCruda.asignados),
    llevar_opciones: unoOnulo(notaCruda.llevar_opciones),
    domicilios: (() => {
      const d = unoOnulo(notaCruda.domicilios)
      return d ? { ...d, municipios: unoOnulo(d.municipios) } : null
    })(),
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const nota = await cargarNota(id)
  if (!nota) return { title: 'Orden de trabajo - Iluxol' }

  const numero = nota.numero_nota ?? nota.id
  const nombreCliente = nota.clientes?.nombre ?? 'Cliente'
  return { title: `${numero} - ${nombreCliente}` }
}

export default async function ImprimirNotaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const nota = await cargarNota(id)

  if (!nota) notFound()

  const nombreAsignado = nota.asignados?.nombre ?? ''
  const mostrarAsignado = nombreAsignado.trim().toUpperCase() !== 'M.B'

  const CARACTERES_POR_LINEA = 90
  const ALTURA_LINEA_MM = 4.2
  const ALTURA_BASE_MM = 17
  const ALTURA_MAXIMA_OBSERVACIONES_MM = 60

  const lineasObservaciones = contarLineasAproximadas(nota.observaciones ?? '', CARACTERES_POR_LINEA)
  const alturaObservacionesMm = Math.min(
    ALTURA_MAXIMA_OBSERVACIONES_MM,
    Math.max(ALTURA_BASE_MM, lineasObservaciones * ALTURA_LINEA_MM + 6)
  )
  const excesoObservaciones = Math.max(0, alturaObservacionesMm - ALTURA_BASE_MM)

  const CARACTERES_POR_LINEA_MEDIA_FILA = 42
  const ALTURA_BASE_FILA_SIMPLE_MM = 8
  const ALTURA_MAXIMA_ZONA_MM = 30
  const lineasZona = contarLineasAproximadas(nota.domicilios?.zona ?? '', CARACTERES_POR_LINEA_MEDIA_FILA)
  const alturaFilaMunicipioZonaMm = Math.min(
    ALTURA_MAXIMA_ZONA_MM,
    Math.max(ALTURA_BASE_FILA_SIMPLE_MM, lineasZona * ALTURA_LINEA_MM + 4)
  )
  const excesoZona = Math.max(0, alturaFilaMunicipioZonaMm - ALTURA_BASE_FILA_SIMPLE_MM)

  const excesoTotal = excesoObservaciones + excesoZona
  const ALTURA_RECUADRO_APUNTES_BASE_MM = 148
  const alturaRecuadroApuntesMm = ALTURA_RECUADRO_APUNTES_BASE_MM - excesoTotal

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        .pagina-imprimir { width: 720px; margin: 24px auto; font-family: system-ui, -apple-system, sans-serif; color: #1c2230; background: #fff; padding: 18px; }
        @media screen { body { background: #f4f5f7; } }
        .barra-acciones { display: flex; justify-content: flex-end; gap: 8px; margin-bottom: 16px; }
        .barra-acciones button {
          height: 34px; padding: 0 14px; border-radius: 8px; border: 1px solid #d1d5db;
          background: #fff; font-size: 13px; cursor: pointer;
        }
        table.orden { width: 100%; border-collapse: collapse; border: 2px solid #1c2230; page-break-inside: avoid; }
        table.orden td { border: 1.2px solid #1c2230; padding: 6px 12px; font-size: 12.5px; vertical-align: top; }
        td.etiqueta, .etiqueta { font-weight: 600; font-size: 10.5px; background: #eaecef; white-space: nowrap; width: 125px; }
        .cabecera { background: #eceef1; padding: 14px 20px; display: flex; justify-content: space-between; align-items: center; border: 1px solid #1c2230; border-bottom: none; }
        td.etiqueta, .etiqueta, .cabecera, .titulo-apuntes {
          -webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact;
        }
        .titulo-cabecera { font-size: 20px; font-weight: 300; letter-spacing: 4px; margin: 0; }
        .logo-cabecera { height: 30px; object-fit: contain; }
        @media print {
          .barra-acciones { display: none; }
          .pagina-imprimir { width: 100%; margin: 0; padding: 0; }
          @page { size: A4; margin: 12mm; }
        }
      `}</style>

      <div className="pagina-imprimir">
        <div className="barra-acciones">
          <span style={{ fontSize: 12, color: '#9ca3af', alignSelf: 'center' }}>
            Al guardar, desactiva &quot;Encabezados y pies de página&quot;. El nombre del archivo ya viene puesto: solo elige la carpeta.
          </span>
          <button id="btn-imprimir">Imprimir / Guardar PDF</button>
        </div>

        <div className="cabecera">
          <p className="titulo-cabecera">ORDEN DE TRABAJO</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-iluxol.png" alt="Iluxol" className="logo-cabecera" />
        </div>

        <table className="orden">
          <tbody>
            <tr>
              <td className="etiqueta">F. ENTRADA</td>
              <td colSpan={3}>{formatearFecha(nota.fecha_entrada)}</td>
            </tr>
            <tr>
              <td className="etiqueta">NUM. NOTA</td>
              <td>{nota.numero_nota ?? nota.id}</td>
              <td className="etiqueta">TIPO NOTA</td>
              <td>{nota.tipo_notas?.nombre ?? '—'}</td>
            </tr>
            <tr>
              <td className="etiqueta">CLIENTE</td>
              <td colSpan={3}>{nota.clientes?.nombre ?? '—'}</td>
            </tr>
            <tr>
              <td className="etiqueta">TELEFONO</td>
              <td>{formatearTelefono(nota.clientes?.telefono)}</td>
              <td className="etiqueta">TELEFONO 2</td>
              <td>{formatearTelefono(nota.clientes?.telefono2)}</td>
            </tr>
            <tr>
              <td className="etiqueta">E-MAIL</td>
              <td colSpan={3}>{nota.clientes?.email ?? '—'}</td>
            </tr>
            <tr style={{ height: `${alturaFilaMunicipioZonaMm}mm` }}>
              <td className="etiqueta">MUNICIPIO</td>
              <td>{nota.domicilios?.municipios?.nombre ?? '—'}</td>
              <td className="etiqueta" style={{ verticalAlign: 'top' }}>ZONA</td>
              <td style={{ whiteSpace: 'pre-wrap', verticalAlign: 'top' }}>{nota.domicilios?.zona || '—'}</td>
            </tr>
            <tr>
              <td className="etiqueta">DIRECCION</td>
              <td colSpan={3}>{nota.domicilios?.direccion ?? '—'}</td>
            </tr>
            <tr>
              <td className="etiqueta" style={{ verticalAlign: 'top' }}>OBSERVACIONES</td>
              <td colSpan={3} style={{ padding: 0 }}>
                <div style={{
                  minHeight: `${alturaObservacionesMm}mm`, padding: '6px 12px', fontSize: '12.5px',
                  whiteSpace: 'pre-wrap',
                }}>
                  {nota.observaciones || '—'}
                </div>
              </td>
            </tr>
            <tr>
              <td className="etiqueta">FECHA CITA / HORA</td>
              <td>
                {formatearFecha(nota.dia_cita)}{nota.hora_cita ? ` · ${nota.hora_cita.slice(0, 5)}` : ''}
              </td>
              <td className="etiqueta">LLEVAR</td>
              <td>{nota.llevar_opciones?.nombre ?? '—'}</td>
            </tr>
            <tr>
              <td className="etiqueta">PARA</td>
              <td colSpan={3}>{mostrarAsignado ? (nombreAsignado || '—') : ''}</td>
            </tr>
            <tr>
              <td colSpan={4} style={{ padding: 0 }}>
                <div className="titulo-apuntes" style={{
                  width: '100%', fontWeight: 600, fontSize: '10.5px', background: '#f3f4f6',
                  borderBottom: '1.2px solid #1c2230', padding: '6px 12px', boxSizing: 'border-box',
                }}>
                  APUNTES Y MEDICIONES
                </div>
                <div style={{ height: `${alturaRecuadroApuntesMm}mm` }} />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <script
        dangerouslySetInnerHTML={{
          __html: `document.getElementById('btn-imprimir').addEventListener('click', function(){ window.print(); });`,
        }}
      />
    </>
  )
}
