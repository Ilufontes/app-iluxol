export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import { unstable_noStore as noStore } from 'next/cache'

function evalFormula(formula: string, vars: Record<string, number>): string {
  if (!formula?.trim()) return '—'
  try {
    const expr = formula.replace(/[a-z_]+/gi, m => vars[m] !== undefined ? String(vars[m]) : 'NaN')
    // eslint-disable-next-line no-new-func
    const r = new Function(`"use strict"; return (${expr})`)()
    return typeof r === 'number' && !isNaN(r) ? String(Math.round(r * 100) / 100) : '?'
  } catch { return '?' }
}

async function cargarOrden(id: number) {
  noStore() // Desactiva el Data Cache de Next.js para esta función
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const url        = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabase   = serviceKey
    ? createSupabaseClient(url, serviceKey, { auth: { persistSession: false }, global: { fetch: (u: RequestInfo | URL, o?: RequestInit) => fetch(u, { ...o, cache: 'no-store' }) } })
    : await createClient()

  function uno(v: unknown): any { return Array.isArray(v) ? (v[0] ?? null) : v }

  const { data: o, error } = await supabase
    .from('ordenes_trabajo')
    .select(`
      id, numero_orden, nota_id, cliente_id, notas, creado_en,
      clientes ( nombre, telefono ),
      orden_lineas (
        id, tipologia_id, color_id,
        ancho_total, alto_total, alto_izquierda, alto_derecha,
        unidades_totales, referencia, posicion,
        tubo_superior, tubo_inferior, tubo_izquierda, tubo_derecha, tipo_tubo_id,
        tipologias (
          id, nombre, imagen_url, tipo_tubo_id,
          tipos_tubo ( id, nombre, descuento ),
          tipologia_filas ( id, tipo, variable_clave, nombre_perfil, formula, unidades, posicion, tubo_lado, tubo_unidades )
        ),
        colores ( nombre )
      )
    `)
    .eq('id', id)
    .single()

  if (error || !o) { console.error('[cargarOrden]', error?.message); return null }

  const cliente = uno((o as any).clientes)

  let numero_nota = null
  if ((o as any).nota_id) {
    const { data: nota } = await supabase.from('notas').select('numero_nota').eq('id', (o as any).nota_id).single()
    numero_nota = nota?.numero_nota ?? null
  }

  // Cargar tipos de tubo para resolver los de las líneas
  const { data: ttData } = await supabase.from('tipos_tubo').select('id, nombre, descuento')
  const ttMap: Record<number, { id: number; nombre: string; descuento: number }> =
    Object.fromEntries((ttData ?? []).map((t: any) => [t.id, t]))

  const lineasRaw = Array.isArray((o as any).orden_lineas) ? (o as any).orden_lineas : []
  const lineas = [...lineasRaw]
    .sort((a: any, b: any) => (a.posicion ?? 0) - (b.posicion ?? 0))
    .map((l: any) => {
      const tip     = uno(l.tipologias)
      const tipTubo = tip ? uno(tip.tipos_tubo) : null
      const tipoTuboEfectivo = l.tipo_tubo_id ? (ttMap[l.tipo_tubo_id] ?? tipTubo) : tipTubo
      return {
        tipologia_nombre: tip?.nombre ?? '—',
        tipologia_imagen: tip?.imagen_url ?? null,
        tipo_tubo:        tipoTuboEfectivo ?? null,
        tipologia_filas:  Array.isArray(tip?.tipologia_filas)
          ? [...tip.tipologia_filas].sort((a: any, b: any) => (a.posicion ?? 0) - (b.posicion ?? 0))
          : [],
        color_nombre:     uno(l.colores)?.nombre ?? null,
        ancho_total:      Number(l.ancho_total)    || 0,
        alto_total:       Number(l.alto_total)     || 0,
        alto_izquierda:   Number(l.alto_izquierda) || 0,
        alto_derecha:     Number(l.alto_derecha)   || 0,
        unidades_totales: l.unidades_totales ?? 1,
        referencia:       l.referencia ?? '',
        tubo_superior:    Boolean(l.tubo_superior),
        tubo_inferior:    Boolean(l.tubo_inferior),
        tubo_izquierda:   Boolean(l.tubo_izquierda),
        tubo_derecha:     Boolean(l.tubo_derecha),
      }
    })

  console.log(`[cargarOrden] Orden #${id}: ${lineas.length} líneas`)

  return {
    id: (o as any).id,
    numero_orden: (o as any).numero_orden,
    nota_id: (o as any).nota_id,
    numero_nota,
    cliente_nombre:   cliente?.nombre   ?? null,
    cliente_telefono: cliente?.telefono ?? null,
    observaciones:    (o as any).notas  ?? null,
    creado_en:        (o as any).creado_en,
    lineas,
  }
}

export default async function OrdenesImprimirPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const orden = await cargarOrden(Number(id))
  if (!orden) notFound()

  const fecha = new Date(orden.creado_en).toLocaleDateString('es-ES')
  const etiqVar: Record<string, string> = {
    ancho_total: 'Ancho', alto_total: 'Alto',
    alto_izquierda: 'Alto Izq.', alto_derecha: 'Alto Der.'
  }

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: system-ui, -apple-system, sans-serif; background: #f4f5f7; color: #1c2230; }
        .pagina { width: 760px; margin: 24px auto; background: #fff; padding: 20px; }
        .no-print { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
        .no-print span { font-size: 12px; color: #9ca3af; }
        .no-print button { height: 34px; padding: 0 16px; background: #1c2230; color: #fff; border: none; border-radius: 8px; font-size: 13px; cursor: pointer; }
        .cab { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #1c2230; padding-bottom: 12px; margin-bottom: 12px; }
        .cab-titulo { font-size: 22px; font-weight: 300; letter-spacing: 4px; }
        .info-bar { display: flex; gap: 24px; font-size: 13px; margin-bottom: 12px; padding: 10px 14px; background: #f8fafc; border-radius: 8px; border: 1px solid #e5e7eb; flex-wrap: wrap; }
        .bloque { border: 1px solid #d1d5db; border-radius: 8px; margin-bottom: 14px; }
        .bloque-cab { background: #1c2230; color: #fff; padding: 8px 14px; display: flex; align-items: center; gap: 16px; flex-wrap: wrap; font-size: 13px; border-radius: 7px 7px 0 0; }
        .bloque-cuerpo { display: flex; }
        .bloque-img { width: 150px; min-width: 150px; flex-shrink: 0; border-right: 1px solid #e5e7eb; display: flex; align-items: center; justify-content: center; background: #f9fafb; padding: 10px; min-height: 80px; }
        .bloque-img img { max-width: 130px; max-height: 120px; object-fit: contain; }
        .bloque-img-vacia { color: #d1d5db; font-size: 11px; text-align: center; }
        .bloque-datos { flex: 1; min-width: 0; }
        .medidas-bar { display: flex; gap: 18px; padding: 7px 12px; background: #f8fafc; font-size: 12px; border-bottom: 1px solid #e5e7eb; flex-wrap: wrap; }
        table.cortes { width: 100%; border-collapse: collapse; font-size: 12.5px; }
        table.cortes th { padding: 5px 10px; background: #f3f4f6; text-align: left; font-weight: 600; color: #374151; border-bottom: 1px solid #d1d5db; }
        table.cortes td { padding: 5px 10px; border-bottom: 1px solid #f3f4f6; vertical-align: middle; }
        table.cortes .f { font-family: monospace; color: #9ca3af; font-size: 11px; }
        table.cortes .c { text-align: center; }
        table.cortes .r { text-align: right; font-weight: 700; font-size: 14px; color: #1c2230; }
        table.cortes .r-tubo { text-align: right; font-weight: 700; font-size: 14px; color: #92400e; }
        .tubo-sep td { background: #fff8ed; font-size: 11px; font-weight: 600; color: #92400e; padding: 3px 10px; }
        @media print {
          body { background: #fff; }
          .no-print { display: none; }
          .pagina { width: 100%; margin: 0; padding: 4mm; }
          .bloque { page-break-inside: avoid; border-radius: 0; }
          .bloque-cab { border-radius: 0; }
          @page { size: A4; margin: 10mm; }
        }
      `}</style>

      <div className="pagina">
        <div className="no-print">
          <span>Al guardar, desactiva &quot;Encabezados y pies de página&quot;</span>
          <button id="btn-print">Imprimir / Guardar PDF</button>
        </div>

        <div className="cab">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-iluxol.png" alt="Iluxol" style={{ height: 28 }} />
          <span className="cab-titulo">ORDEN DE TRABAJO</span>
          <div style={{ textAlign: 'right', fontSize: 13, color: '#6b7280' }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#1c2230' }}>#{orden.numero_orden ?? orden.id}</div>
            <div>{fecha}</div>
          </div>
        </div>

        {(orden.cliente_nombre || orden.nota_id) && (
          <div className="info-bar">
            {orden.cliente_nombre && <span><strong>Cliente:</strong> {orden.cliente_nombre}{orden.cliente_telefono ? ` · ${orden.cliente_telefono}` : ''}</span>}
            {orden.nota_id && <span><strong>Nota:</strong> #{orden.numero_nota ?? orden.nota_id}</span>}
          </div>
        )}

        {orden.observaciones && (
          <div style={{ margin: '0 0 12px', padding: '8px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, fontSize: 13, color: '#92400e' }}>
            <strong>Observaciones:</strong> {orden.observaciones}
          </div>
        )}

        {orden.lineas.map((linea, i) => {
          // Defensiva total: todos los arrays con ?? []
          const filas      = Array.isArray(linea.tipologia_filas) ? linea.tipologia_filas : []
          const perfiles   = filas.filter((f: any) => f?.tipo === 'perfil')
          const variables  = filas.filter((f: any) => f?.tipo === 'variable')
          const medidas: Record<string, number> = {
            ancho_total:    linea.ancho_total,
            alto_total:     linea.alto_total,
            alto_izquierda: linea.alto_izquierda,
            alto_derecha:   linea.alto_derecha,
          }
          const medidasActivas = variables.filter((v: any) => v && medidas[v.variable_clave] > 0)
          const tt = linea.tipo_tubo
          const d  = tt?.descuento ?? 0
          const lat = (linea.tubo_izquierda ? 1 : 0) + (linea.tubo_derecha  ? 1 : 0)
          const hor = (linea.tubo_superior  ? 1 : 0) + (linea.tubo_inferior ? 1 : 0)
          const hayTubos = linea.tubo_superior || linea.tubo_inferior || linea.tubo_izquierda || linea.tubo_derecha

          const ladosTubo: { lado: string; medida: number }[] = []
          if (tt && hayTubos) {
            if (linea.tubo_superior)  ladosTubo.push({ lado: 'Superior',  medida: medidas.ancho_total    + lat * d })
            if (linea.tubo_inferior)  ladosTubo.push({ lado: 'Inferior',  medida: medidas.ancho_total    + lat * d })
            if (linea.tubo_izquierda) ladosTubo.push({ lado: 'Izquierda', medida: medidas.alto_izquierda + hor * d })
            if (linea.tubo_derecha)   ladosTubo.push({ lado: 'Derecha',   medida: medidas.alto_derecha   + hor * d })
          }

          return (
            <div key={i} className="bloque">
              <div className="bloque-cab">
                <strong style={{ fontSize: 14 }}>{linea.tipologia_nombre}</strong>
                {linea.color_nombre && <span>Color: <strong>{linea.color_nombre}</strong></span>}
                <span>Uds: <strong>{linea.unidades_totales}</strong></span>
                {linea.referencia && <span style={{ opacity: 0.7 }}>Ref: {linea.referencia}</span>}
              </div>

              <div className="bloque-cuerpo">
                <div className="bloque-img">
                  {linea.tipologia_imagen ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={linea.tipologia_imagen} alt={linea.tipologia_nombre} />
                  ) : (
                    <div className="bloque-img-vacia">Sin imagen</div>
                  )}
                </div>

                <div className="bloque-datos">
                  {medidasActivas.length > 0 && (
                    <div className="medidas-bar">
                      {medidasActivas.map((v: any, j: number) => (
                        <span key={j}>
                          <span style={{ color: '#6b7280' }}>{etiqVar[v.variable_clave] ?? v.variable_clave}: </span>
                          <strong>{medidas[v.variable_clave]} mm</strong>
                        </span>
                      ))}
                    </div>
                  )}

                  {(perfiles.length > 0 || ladosTubo.length > 0) && (
                    <table className="cortes">
                      <thead>
                        <tr>
                          <th>Perfil / Tubo</th>
                          <th style={{ fontFamily: 'monospace', fontWeight: 400, color: '#9ca3af' }}>Fórmula</th>
                          <th className="c">Ud.</th>
                          <th className="r" style={{ textAlign: 'right' }}>Corte mm</th>
                        </tr>
                      </thead>
                      <tbody>
                        {perfiles.map((p: any, j: number) => (
                          <tr key={j} style={{ background: j % 2 ? '#fafafa' : '#fff' }}>
                            <td>{p?.nombre_perfil ?? '—'}</td>
                            <td className="f">{p?.formula ?? ''}</td>
                            <td className="c">{p?.unidades ?? 1}</td>
                            <td className="r">{evalFormula(p?.formula ?? '', medidas)}</td>
                          </tr>
                        ))}
                        {ladosTubo.length > 0 && tt && (
                          <>
                            <tr className="tubo-sep"><td colSpan={4}>TUBOS {tt.nombre} ({tt.descuento}mm desc.)</td></tr>
                            {ladosTubo.map((t, j) => (
                              <tr key={j} style={{ background: '#fffbf4' }}>
                                <td style={{ color: '#92400e' }}>{t.lado}</td>
                                <td className="f">{t.lado === 'Superior' || t.lado === 'Inferior' ? `ancho+${lat}×${d}` : `alto+${hor}×${d}`}</td>
                                <td className="c">1</td>
                                <td className="r-tubo">{t.medida}</td>
                              </tr>
                            ))}
                          </>
                        )}
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
