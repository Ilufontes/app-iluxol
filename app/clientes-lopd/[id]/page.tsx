import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

function unoOnulo(valor: any) {
  return Array.isArray(valor) ? (valor[0] ?? null) : valor
}

async function cargarCliente(id: string) {
  const supabase = await createClient()
  const { data: cliente, error } = await supabase
    .from('clientes')
    .select('nombre, dni, telefono, email, domicilios ( direccion, municipios ( nombre ) )')
    .eq('id', id)
    .single()

  if (error || !cliente) return null
  return cliente
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const cliente = await cargarCliente(id)
  if (!cliente) return { title: 'Tratamiento de datos - Iluxol' }
  return { title: `LOPD ${cliente.nombre}` }
}

export default async function LopdPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const cliente = await cargarCliente(id)

  if (!cliente) notFound()

  const primerDomicilioCrudo = Array.isArray(cliente.domicilios) ? cliente.domicilios[0] : cliente.domicilios
  const direccionPrincipal = primerDomicilioCrudo
    ? `${primerDomicilioCrudo.direccion}${unoOnulo(primerDomicilioCrudo.municipios)?.nombre ? ' — ' + unoOnulo(primerDomicilioCrudo.municipios).nombre : ''}`
    : ''

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        .pagina-lopd { width: 680px; margin: 24px auto; font-family: system-ui, -apple-system, sans-serif; color: #1c2230; font-size: 13px; line-height: 1.6; }
        .barra-acciones { display: flex; justify-content: flex-end; gap: 8px; margin-bottom: 16px; }
        .barra-acciones button {
          height: 34px; padding: 0 14px; border-radius: 8px; border: 1px solid #d1d5db;
          background: #fff; font-size: 13px; cursor: pointer;
        }
        .logo-lopd { display: flex; justify-content: center; margin-bottom: 12px; }
        .logo-lopd img { height: 30px; object-fit: contain; }
        .titulo-lopd { text-align: center; font-size: 16px; font-weight: 500; letter-spacing: 0.5px; margin: 0 0 20px; }
        table.datos-cliente td { padding: 4px 0; }
        table.datos-cliente td:first-child { color: #6b7280; width: 140px; }
        table.datos-cliente td:last-child { border-bottom: 1px solid #d1d5db; }
        .firma-fecha { display: flex; justify-content: space-between; margin-top: 48px; }
        .firma-fecha .linea { margin-top: 28px; border-top: 1px solid #9ca3af; width: 180px; }
        @media print {
          .barra-acciones { display: none; }
          .pagina-lopd { width: 100%; margin: 0; }
          @page { size: A4; margin: 16mm; }
        }
      `}</style>

      <div className="pagina-lopd">
        <div className="barra-acciones">
          <span style={{ fontSize: 12, color: '#9ca3af', alignSelf: 'center' }}>
            Al imprimir, desactiva &quot;Encabezados y pies de página&quot; en las opciones del navegador
          </span>
          <button id="btn-imprimir-lopd">Imprimir / Guardar PDF</button>
        </div>

        <div className="logo-lopd">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-iluxol.png" alt="Iluxol" />
        </div>
        <h1 className="titulo-lopd">TRATAMIENTO DE DATOS DE CLIENTES</h1>

        <p>
          En aras de dar cumplimiento a la Ley 3/2018, de 5 de diciembre, de protección de datos
          personales y garantías digitales, así como del Reglamento (UE) 2016/679 del Parlamento
          Europeo y del Consejo, de 27 de abril de 2016, relativo a la protección de las personas
          físicas, y siguiendo las recomendaciones e instrucciones emitidas por la Agencia Española
          de Protección de Datos,
        </p>

        <p style={{ fontWeight: 500, marginBottom: 6 }}>SE INFORMA,</p>
        <ul style={{ marginTop: 0, paddingLeft: 18 }}>
          <li>Que los datos de carácter personal solicitados y facilitados serán incorporados a un registro de titularidad privada de ALUMINIOS ILUXOL SLU, que se establece como responsable del tratamiento de los mismos.</li>
          <li>Solo serán solicitados los datos estrictamente necesarios para prestar adecuadamente el servicio contratado.</li>
          <li>Todos los datos recogidos cuentan con el compromiso de confidencialidad como profesionales del sector, con las medidas de seguridad establecidas legalmente.</li>
          <li>La base jurídica del tratamiento es el propio consentimiento, el cual podrá ser retirado en cualquier momento.</li>
          <li>En cualquier momento puede ejercer sus derechos de acceso, rectificación, cancelación, oposición, limitación y portabilidad, así como presentar una reclamación ante la Agencia Española de Protección de Datos.</li>
        </ul>

        <p>
          Por ello, la Dirección de esta entidad solicita su autorización expresa para el tratamiento
          de sus datos personales:
        </p>

        <table className="datos-cliente" style={{ width: '100%', marginBottom: 20 }}>
          <tbody>
            <tr><td>Don / Doña</td><td>{cliente.nombre || '—'}</td></tr>
            <tr><td>DNI o NIF</td><td>{cliente.dni || '—'}</td></tr>
            <tr><td>Domicilio</td><td>{direccionPrincipal || '—'}</td></tr>
            <tr><td>N. Teléfono</td><td>{cliente.telefono || '—'}</td></tr>
            <tr><td>Correo electrónico</td><td>{cliente.email || '—'}</td></tr>
          </tbody>
        </table>

        <p style={{ fontWeight: 500, marginBottom: 6 }}>Consiento,</p>
        <p>
          ☐ Que los datos cedidos sean incluidos en el registro de titularidad de ALUMINIOS ILUXOL SLU,
          con la finalidad de gestionar el servicio contratado, emisión de facturas, contacto, entre
          otras gestiones relacionadas con los clientes.
        </p>
        <p>
          ☐ Que se registre mi número de contacto y correo electrónico para el envío de presupuestos,
          datos técnicos requeridos por el cliente y facturas.
        </p>

        <div className="firma-fecha">
          <div>
            <p style={{ margin: 0, color: '#6b7280' }}>Fecha y lugar</p>
            <div className="linea" />
          </div>
          <div>
            <p style={{ margin: 0, color: '#6b7280' }}>Firma cliente</p>
            <div className="linea" />
          </div>
        </div>
      </div>

      <script
        dangerouslySetInnerHTML={{
          __html: `document.getElementById('btn-imprimir-lopd').addEventListener('click', function(){ window.print(); });`,
        }}
      />
    </>
  )
}
