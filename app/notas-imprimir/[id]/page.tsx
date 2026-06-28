import { createClient } from '@/lib/supabase/server'
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

async function cargarNota(id: string) {
  const supabase = await createClient()
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
    clientes: unoOnulo(notaCruda.clientes),
    tipo_notas: unoOnulo(notaCruda.tipo_notas),
    asignados: unoOnulo(notaCruda.asignados),
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

  const numero = String(nota.numero_nota ?? nota.id).padStart(4, '0')
  const nombreCliente = nota.clientes?.nombre ?? 'Cliente'
  return { title: `Not${numero} ${nombreCliente}` }
}

export default async function ImprimirNotaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const nota = await cargarNota(id)

  if (!nota) notFound()

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        .pagina-imprimir { width: 720px; margin: 24px auto; font-family: system-ui, -apple-system, sans-serif; color: #1c2230; background: #fff; padding: 18px; }
        @media screen {
          body { background: #f4f5f7; }
        }
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
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          color-adjust: exact;
        }
        .titulo-cabecera { font-size: 20px; font-weight: 300; letter-spacing: 4px; margin: 0; }
        .logo-cabecera { height: 30px; object-fit: contain; }
        .recuadro-apuntes { height: 148mm; }
        @media print {
          .barra-acciones { display: none; }
          .pagina-imprimir { width: 100%; margin: 0; padding: 0; }
          @page { size: A4; margin: 12mm; }
        }
      `}</style>

      <div className="pagina-imprimir">
        <div className="barra-acciones">
          <span style={{ fontSize: 12, color: '#9ca3af', alignSelf: 'center' }}>
            Al imprimir, desactiva &quot;Encabezados y pies de página&quot; en las opciones del navegador
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
              <td>{nota.clientes?.telefono ?? '—'}</td>
              <td className="etiqueta">TELEFONO 2</td>
              <td>{nota.clientes?.telefono2 ?? '—'}</td>
            </tr>
            <tr>
              <td className="etiqueta">E-MAIL</td>
              <td colSpan={3}>{nota.clientes?.email ?? '—'}</td>
            </tr>
            <tr>
              <td className="etiqueta">MUNICIPIO</td>
              <td>{nota.domicilios?.municipios?.nombre ?? '—'}</td>
              <td className="etiqueta">ZONA</td>
              <td>{nota.domicilios?.zona ?? '—'}</td>
            </tr>
            <tr>
              <td className="etiqueta">DIRECCION</td>
              <td colSpan={3}>{nota.domicilios?.direccion ?? '—'}</td>
            </tr>
            <tr>
              <td className="etiqueta" style={{ verticalAlign: 'top' }}>OBSERVACIONES</td>
              <td colSpan={3} style={{ padding: 0 }}>
                <div style={{
                  height: '17mm', padding: '6px 12px', fontSize: '12.5px',
                  whiteSpace: 'pre-wrap', overflow: 'hidden',
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
              <td colSpan={3}>{nota.asignados?.nombre ?? '—'}</td>
            </tr>
            <tr>
              <td colSpan={4} style={{ padding: 0 }}>
                <div className="titulo-apuntes" style={{
                  width: '100%', fontWeight: 600, fontSize: '10.5px', background: '#f3f4f6',
                  borderBottom: '1.2px solid #1c2230', padding: '6px 12px', boxSizing: 'border-box',
                }}>
                  APUNTES Y MEDICIONES
                </div>
                <div className="recuadro-apuntes" />
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
