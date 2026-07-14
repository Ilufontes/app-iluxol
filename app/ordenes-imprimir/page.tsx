import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import { cargarOrdenParaImprimir } from '../../(app)/ordenes/actions'

function evalFormula(formula: string, vars: Record<string, number>): string {
  if (!formula.trim()) return '—'
  try {
    const expr = formula.replace(/[a-z_]+/gi, m => vars[m] !== undefined ? String(vars[m]) : 'NaN')
    // eslint-disable-next-line no-new-func
    const r = new Function(`"use strict"; return (${expr})`)()
    return typeof r === 'number' && !isNaN(r) ? String(Math.round(r * 100) / 100) : '?'
  } catch { return '?' }
}

async function getCliente(id: number) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const url        = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabase   = serviceKey
    ? createSupabaseClient(url, serviceKey, { auth: { persistSession: false } })
    : await createClient()
  const { data: { user } } = await (serviceKey ? { data: { user: null } } : (await createClient()).auth.getUser())
  void user
  return supabase
}

export default async function OrdenesImprimirPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const orden = await cargarOrdenParaImprimir(Number(id))
  if (!orden) notFound()

  const fecha = new Date(orden.creado_en).toLocaleDateString('es-ES')

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: system-ui, -apple-system, sans-serif; background: #f4f5f7; color: #1c2230; }
        .pagina { width: 760px; margin: 24px auto; background: #fff; padding: 20px; }
        .no-print { display: flex; justify-content: flex-end; margin-bottom: 16px; }
        .no-print button { height: 34px; padding: 0 16px; background: #1c2230; color: #fff; border: none; border-radius: 8px; font-size: 13px; cursor: pointer; }
        .cabecera { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #1c2230; padding-bottom: 12px; margin-bottom: 12px; }
        .cabecera-titulo { font-size: 22px; font-weight: 300; letter-spacing: 4px; }
        .info-orden { display: flex; gap: 20px; font-size: 13px; margin-bottom: 16px; color: #374151; }
        .info-orden strong { color: #1c2230; }
        .linea-bloque { border: 1px solid #d1d5db; border-radius: 8px; overflow: hidden; margin-bottom: 14px; }
        .linea-cabecera { background: #1c2230; color: #fff; padding: 8px 14px; display: flex; align-items: center; gap: 16px; flex-wrap: wrap; font-size: 13px; }
        .linea-cuerpo { display: grid; grid-template-columns: auto 1fr; gap: 0; }
        .linea-imagen { width: 140px; min-height: 100px; border-right: 1px solid #e5e7eb; display: flex; align-items: center; justify-content: center; background: #f9fafb; padding: 8px; }
        .linea-imagen img { max-width: 100%; max-height: 120px; object-fit: contain; }
        .linea-imagen-vacia { color: #d1d5db; font-size: 11px; text-align: center; }
        .linea-tabla-wrap { padding: 0; }
        .medidas { display: flex; gap: 16px; padding: 8px 12px; background: #f8fafc; font-size: 12px; border-bottom: 1px solid #e5e7eb; }
        .medidas span { color: #6b7280; }
        .medidas strong { color: #1c2230; }
        table.cortes { width: 100%; border-collapse: collapse; font-size: 12.5px; }
        table.cortes th { padding: 5px 10px; background: #f3f4f6; text-align: left; font-weight: 600; color: #374151; border-bottom: 1px solid #d1d5db; }
        table.cortes td { padding: 5px 10px; border-bottom: 1px solid #f3f4f6; }
        table.cortes td.formula { font-family: monospace; color: #9ca3af; font-size: 11px; }
        table.cortes td.resultado { text-align: right; font-weight: 700; font-size: 14px; color: #1c2230; }
        table.cortes td.centrado { text-align: center; }
        @media print {
          body { background: #fff; }
          .no-print { display: none; }
          .pagina { width: 100%; margin: 0; padding: 0; }
          @page { size: A4; margin: 12mm; }
        }
      `}</style>

      <div className="pagina">
        <div className="no-print">
          <button id="btn-print">Imprimir / Guardar PDF</button>
        </div>

        <div className="cabecera">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-iluxol.png" alt="Iluxol" style={{ height: 28 }} />
          <span className="cabecera-titulo">ORDEN DE TRABAJO</span>
          <div style={{ textAlign: 'right', fontSize: 13, color: '#6b7280' }}>
            <div><strong style={{ color: '#1c2230' }}>#{orden.numero_orden ?? orden.id}</strong></div>
            <div>{fecha}</div>
          </div>
        </div>

        <div className="info-orden">
          {orden.cliente_nombre && (
            <span><strong>Cliente:</strong> {orden.cliente_nombre}{orden.cliente_telefono ? ` · ${orden.cliente_telefono}` : ''}</span>
          )}
          {orden.nota_id && <span><strong>Nota:</strong> #{orden.numero_nota_rel ?? orden.nota_id}</span>}
          {orden.observaciones && <span style={{ fontStyle: 'italic', color: '#6b7280' }}>{orden.observaciones}</span>}
        </div>

        {orden.orden_lineas.map((linea, i) => {
          const tip = linea.tipologia
          const perfiles  = tip?.tipologia_filas.filter(f => f.tipo === 'perfil')  ?? []
          const variables = tip?.tipologia_filas.filter(f => f.tipo === 'variable') ?? []
          const medidas: Record<string, number> = {
            ancho_total: linea.ancho_total ?? 0, alto_total: linea.alto_total ?? 0,
            alto_izquierda: linea.alto_izquierda ?? 0, alto_derecha: linea.alto_derecha ?? 0,
          }
          const etiqVar: Record<string, string> = {
            ancho_total: 'Ancho', alto_total: 'Alto', alto_izquierda: 'Alto Izq.', alto_derecha: 'Alto Der.'
          }

          return (
            <div key={i} className="linea-bloque">
              <div className="linea-cabecera">
                <strong style={{ fontSize: 14 }}>{tip?.nombre ?? '—'}</strong>
                {linea.color_nombre && <span>Color: <strong>{linea.color_nombre}</strong></span>}
                <span>Uds: <strong>{linea.unidades_totales}</strong></span>
                {linea.referencia && <span style={{ opacity: 0.75 }}>Ref: {linea.referencia}</span>}
              </div>
              <div className="linea-cuerpo">
                <div className="linea-imagen">
                  {tip?.imagen_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={tip.imagen_url} alt={tip.nombre} />
                  ) : (
                    <div className="linea-imagen-vacia">Sin imagen</div>
                  )}
                </div>
                <div className="linea-tabla-wrap">
                  {variables.length > 0 && (
                    <div className="medidas">
                      {variables.map((v, j) => {
                        if (v.tipo !== 'variable') return null
                        const val = medidas[v.variable_clave]
                        return val ? <span key={j}><strong>{etiqVar[v.variable_clave] ?? v.variable_clave}:</strong> {val} mm</span> : null
                      })}
                    </div>
                  )}
                  {perfiles.length > 0 && (
                    <table className="cortes">
                      <thead>
                        <tr>
                          <th>Perfil</th>
                          <th>Fórmula</th>
                          <th style={{ textAlign: 'center' }}>Ud.</th>
                          <th style={{ textAlign: 'right' }}>Corte (mm)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {perfiles.map((p, j) => {
                          if (p.tipo !== 'perfil') return null
                          return (
                            <tr key={j}>
                              <td>{p.nombre_perfil}</td>
                              <td className="formula">{p.formula}</td>
                              <td className="centrado">{p.unidades}</td>
                              <td className="resultado">{evalFormula(p.formula, medidas)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <script dangerouslySetInnerHTML={{ __html: `document.getElementById('btn-print').onclick = () => window.print()` }} />
    </>
  )
}
