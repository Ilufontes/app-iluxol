'use client'

import { useState } from 'react'
import {
  buscarClientes,
  crearClienteRapido,
  crearDomicilioRapido,
  crearNota,
  actualizarNota,
} from './actions'

type Opcion = { id: number; nombre: string }

type DomicilioCliente = { id: number; direccion: string; zona?: string | null; municipios: { nombre: string } | null }
type ClienteResultado = {
  id: number
  nombre: string
  telefono: string | null
  telefono2?: string | null
  email?: string | null
  domicilios: DomicilioCliente[]
}

export type NotaListado = {
  id: number
  numero_nota: number | null
  fecha_entrada: string
  observaciones: string | null
  dia_cita: string | null
  hora_cita: string | null
  cliente_id?: number
  domicilio_id?: number | null
  tipo_nota_id?: number | null
  asignado_id?: number | null
  llevar_id?: number | null
  clientes: { id?: number; nombre: string; telefono?: string | null; telefono2?: string | null; email?: string | null } | null
  domicilios: { id?: number; direccion: string; zona?: string | null; municipio_id?: number | null; municipios: { nombre: string } | null } | null
  tipo_notas: { nombre: string } | null
  asignados: { nombre: string } | null
  llevar_opciones?: { nombre: string } | null
}

export default function NotasExplorer({
  notasIniciales,
  tiposNota,
  asignados,
  llevarOpciones,
  municipios,
}: {
  notasIniciales: NotaListado[]
  tiposNota: Opcion[]
  asignados: Opcion[]
  llevarOpciones: Opcion[]
  municipios: Opcion[]
}) {
  const [notas, setNotas] = useState<NotaListado[]>(notasIniciales)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [notaEditando, setNotaEditando] = useState<NotaListado | null>(null)
  const [notaDetalle, setNotaDetalle] = useState<NotaListado | null>(null)

  function abrirNueva() {
    setNotaEditando(null)
    setModalAbierto(true)
  }

  function abrirEdicion(nota: NotaListado) {
    setNotaEditando(nota)
    setNotaDetalle(null)
    setModalAbierto(true)
  }

  function alGuardar(nota: NotaListado, esNueva: boolean) {
    setNotas((prev) => (esNueva ? [nota, ...prev] : prev.map((n) => (n.id === nota.id ? nota : n))))
    setModalAbierto(false)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 500, margin: 0, color: '#1c2230' }}>Notas</h1>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>{notas.length} notas registradas</p>
        </div>
        <button onClick={abrirNueva} style={botonPrimario}>+ Nueva nota</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {notas.length === 0 && (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af', fontSize: 14, border: '1px solid #e5e7eb', borderRadius: 12, background: '#fff' }}>
            Todavía no hay notas registradas.
          </div>
        )}
        {notas.map((n) => <TarjetaNota key={n.id} nota={n} onClick={() => setNotaDetalle(n)} />)}
      </div>

      {modalAbierto && (
        <ModalNota
          notaEditando={notaEditando}
          tiposNota={tiposNota}
          asignados={asignados}
          llevarOpciones={llevarOpciones}
          municipios={municipios}
          onCerrar={() => setModalAbierto(false)}
          onGuardada={alGuardar}
        />
      )}

      {notaDetalle && (
        <PanelDetalleNota
          nota={notaDetalle}
          onCerrar={() => setNotaDetalle(null)}
          onEditar={() => abrirEdicion(notaDetalle)}
        />
      )}
    </div>
  )
}

function formatearFecha(iso: string | null) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function TarjetaNota({ nota, onClick }: { nota: NotaListado; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '0.9rem 1.1rem', cursor: 'pointer' }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#9ca3af')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#e5e7eb')}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: '#9ca3af' }}>Nota {nota.numero_nota ?? nota.id}</span>
            {nota.tipo_notas && (
              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: '#e6f1fb', color: '#0c447c' }}>
                {nota.tipo_notas.nombre}
              </span>
            )}
          </div>
          <div style={{ fontWeight: 500, fontSize: 15, color: '#1c2230', marginTop: 4 }}>
            {nota.clientes?.nombre ?? 'Cliente eliminado'}
          </div>
          {nota.domicilios && (
            <div style={{ fontSize: 13, color: '#374151' }}>
              {nota.domicilios.direccion} — {nota.domicilios.municipios?.nombre ?? ''}
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500 }}>
            {formatearFecha(nota.dia_cita)} {nota.hora_cita ? `· ${nota.hora_cita.slice(0, 5)}` : ''}
          </div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{nota.asignados?.nombre ?? ''}</div>
        </div>
      </div>
      {nota.observaciones && (
        <div style={{ fontSize: 13, color: '#374151', borderTop: '1px solid #e5e7eb', paddingTop: 8, marginTop: 4 }}>
          {nota.observaciones}
        </div>
      )}
    </div>
  )
}

function normalizarCliente(c: any): ClienteResultado {
  return {
    id: c.id,
    nombre: c.nombre,
    telefono: c.telefono,
    telefono2: c.telefono2 ?? null,
    email: c.email ?? null,
    domicilios: (c.domicilios ?? []).map((d: any) => ({
      id: d.id,
      direccion: d.direccion,
      zona: d.zona ?? null,
      municipios: Array.isArray(d.municipios) ? (d.municipios[0] ?? null) : d.municipios,
    })),
  }
}

function unoOnulo(valor: any) {
  return Array.isArray(valor) ? (valor[0] ?? null) : valor
}

function normalizarNotaGuardada(nota: any): NotaListado {
  const domicilioCrudo = unoOnulo(nota.domicilios)
  return {
    id: nota.id,
    numero_nota: nota.numero_nota,
    fecha_entrada: nota.fecha_entrada,
    observaciones: nota.observaciones,
    dia_cita: nota.dia_cita,
    hora_cita: nota.hora_cita,
    cliente_id: nota.cliente_id,
    domicilio_id: nota.domicilio_id,
    tipo_nota_id: nota.tipo_nota_id,
    asignado_id: nota.asignado_id,
    llevar_id: nota.llevar_id,
    clientes: unoOnulo(nota.clientes),
    domicilios: domicilioCrudo
      ? {
          id: domicilioCrudo.id,
          direccion: domicilioCrudo.direccion,
          zona: domicilioCrudo.zona ?? null,
          municipio_id: domicilioCrudo.municipio_id,
          municipios: unoOnulo(domicilioCrudo.municipios),
        }
      : null,
    tipo_notas: unoOnulo(nota.tipo_notas),
    asignados: unoOnulo(nota.asignados),
    llevar_opciones: unoOnulo(nota.llevar_opciones),
  }
}

function ModalNota({
  notaEditando,
  tiposNota,
  asignados,
  llevarOpciones,
  municipios,
  onCerrar,
  onGuardada,
}: {
  notaEditando: NotaListado | null
  tiposNota: Opcion[]
  asignados: Opcion[]
  llevarOpciones: Opcion[]
  municipios: Opcion[]
  onCerrar: () => void
  onGuardada: (nota: NotaListado, esNueva: boolean) => void
}) {
  const esEdicion = !!notaEditando

  const [clienteSeleccionado, setClienteSeleccionado] = useState<ClienteResultado | null>(
    notaEditando?.clientes && notaEditando.cliente_id
      ? {
          id: notaEditando.cliente_id,
          nombre: notaEditando.clientes.nombre,
          telefono: notaEditando.clientes.telefono ?? null,
          telefono2: notaEditando.clientes.telefono2 ?? null,
          email: notaEditando.clientes.email ?? null,
          domicilios: notaEditando.domicilios
            ? [{
                id: notaEditando.domicilio_id ?? notaEditando.domicilios.id ?? 0,
                direccion: notaEditando.domicilios.direccion,
                zona: notaEditando.domicilios.zona ?? null,
                municipios: notaEditando.domicilios.municipios,
              }]
            : [],
        }
      : null
  )
  const [terminoBusqueda, setTerminoBusqueda] = useState('')
  const [resultados, setResultados] = useState<ClienteResultado[]>([])
  const [buscando, setBuscando] = useState(false)

  const [domicilioId, setDomicilioId] = useState<number | ''>(notaEditando?.domicilio_id ?? '')
  const [mostrandoFormDomicilio, setMostrandoFormDomicilio] = useState(false)
  const [nuevaDireccion, setNuevaDireccion] = useState('')
  const [nuevoMunicipioId, setNuevoMunicipioId] = useState<number | ''>('')

  const [mostrandoFormCliente, setMostrandoFormCliente] = useState(false)
  const [ncNombre, setNcNombre] = useState('')
  const [ncTelefono, setNcTelefono] = useState('')
  const [ncTelefono2, setNcTelefono2] = useState('')
  const [ncEmail, setNcEmail] = useState('')
  const [ncOtros, setNcOtros] = useState('')

  const [tipoNotaId, setTipoNotaId] = useState<number | ''>(notaEditando?.tipo_nota_id ?? '')
  const [asignadoId, setAsignadoId] = useState<number | ''>(notaEditando?.asignado_id ?? '')
  const [llevarId, setLlevarId] = useState<number | ''>(notaEditando?.llevar_id ?? '')
  const [fechaEntrada, setFechaEntrada] = useState(notaEditando?.fecha_entrada ?? new Date().toISOString().slice(0, 10))
  const [observaciones, setObservaciones] = useState(notaEditando?.observaciones ?? '')
  const [diaCita, setDiaCita] = useState(notaEditando?.dia_cita ?? '')
  const [horaCita, setHoraCita] = useState(notaEditando?.hora_cita?.slice(0, 5) ?? '')

  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  let temporizadorBusqueda: ReturnType<typeof setTimeout>

  function manejarBusqueda(valor: string) {
    setTerminoBusqueda(valor)
    clearTimeout(temporizadorBusqueda)
    if (!valor.trim()) {
      setResultados([])
      return
    }
    temporizadorBusqueda = setTimeout(async () => {
      setBuscando(true)
      const r = await buscarClientes(valor)
      setResultados((r as any[]).map(normalizarCliente))
      setBuscando(false)
    }, 300)
  }

  function seleccionarCliente(c: ClienteResultado) {
    setClienteSeleccionado(c)
    setResultados([])
    setDomicilioId(c.domicilios[0]?.id ?? '')
    setMostrandoFormDomicilio(false)
  }

  async function handleCrearClienteRapido() {
    if (!ncNombre.trim()) return
    try {
      const creado = await crearClienteRapido({
        nombre: ncNombre.trim(),
        telefono: ncTelefono.trim(),
        telefono2: ncTelefono2.trim(),
        email: ncEmail.trim(),
        otros_datos: ncOtros.trim(),
      })
      seleccionarCliente(normalizarCliente(creado))
      setMostrandoFormCliente(false)
      setNcNombre('')
      setNcTelefono('')
      setNcTelefono2('')
      setNcEmail('')
      setNcOtros('')
    } catch {
      setError('No se pudo crear el cliente.')
    }
  }

  async function handleCrearDomicilio() {
    if (!clienteSeleccionado || !nuevaDireccion.trim() || !nuevoMunicipioId) return
    try {
      const creado: any = await crearDomicilioRapido({
        cliente_id: clienteSeleccionado.id,
        direccion: nuevaDireccion.trim(),
        municipio_id: Number(nuevoMunicipioId),
      })
      const nuevoDomicilio: DomicilioCliente = {
        id: creado.id,
        direccion: creado.direccion,
        zona: creado.zona ?? null,
        municipios: unoOnulo(creado.municipios),
      }
      setClienteSeleccionado({ ...clienteSeleccionado, domicilios: [...clienteSeleccionado.domicilios, nuevoDomicilio] })
      setDomicilioId(nuevoDomicilio.id)
      setNuevaDireccion('')
      setNuevoMunicipioId('')
      setMostrandoFormDomicilio(false)
    } catch {
      setError('No se pudo añadir el domicilio.')
    }
  }

  async function handleGuardarNota() {
    setError(null)
    if (!clienteSeleccionado) { setError('Selecciona o crea un cliente primero.'); return }
    if (!tipoNotaId) { setError('Elige un tipo de nota.'); return }

    setGuardando(true)
    const payload = {
      cliente_id: clienteSeleccionado.id,
      domicilio_id: domicilioId ? Number(domicilioId) : null,
      tipo_nota_id: Number(tipoNotaId),
      asignado_id: asignadoId ? Number(asignadoId) : null,
      fecha_entrada: fechaEntrada,
      observaciones: observaciones.trim(),
      llevar_id: llevarId ? Number(llevarId) : null,
      dia_cita: diaCita || null,
      hora_cita: horaCita || null,
    }

    try {
      const nota = esEdicion
        ? await actualizarNota(notaEditando!.id, payload)
        : await crearNota(payload)
      onGuardada(normalizarNotaGuardada(nota), !esEdicion)
    } catch {
      setError(`No se pudo ${esEdicion ? 'actualizar' : 'guardar'} la nota. Inténtalo de nuevo.`)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 500 }}>{esEdicion ? `Editar nota ${notaEditando!.numero_nota ?? notaEditando!.id}` : 'Nueva nota'}</h2>
          <button onClick={onCerrar} style={botonCerrar}>×</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          <Campo etiqueta="Cliente">
            {clienteSeleccionado ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 10px', background: '#f9fafb' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{clienteSeleccionado.nombre}</div>
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>{clienteSeleccionado.telefono || 'Sin teléfono'}</div>
                </div>
                <button
                  onClick={() => { setClienteSeleccionado(null); setDomicilioId(''); }}
                  style={botonSecundario}
                >
                  Cambiar
                </button>
              </div>
            ) : (
              <div>
                <input
                  value={terminoBusqueda}
                  onChange={(e) => manejarBusqueda(e.target.value)}
                  placeholder="Buscar cliente por nombre o teléfono"
                  style={inputBase}
                />
                {buscando && <p style={{ fontSize: 12, color: '#9ca3af', margin: '6px 0 0' }}>Buscando...</p>}
                {resultados.length > 0 && (
                  <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, marginTop: 6, maxHeight: 160, overflowY: 'auto' }}>
                    {resultados.map((c) => (
                      <div
                        key={c.id}
                        onClick={() => seleccionarCliente(c)}
                        style={{ padding: '8px 10px', fontSize: 13, cursor: 'pointer', borderBottom: '1px solid #f0f0f0' }}
                      >
                        <strong>{c.nombre}</strong> · {c.telefono}
                      </div>
                    ))}
                  </div>
                )}

                {!mostrandoFormCliente ? (
                  <button onClick={() => setMostrandoFormCliente(true)} style={{ ...botonSecundario, width: '100%', marginTop: 6 }}>
                    + Crear cliente nuevo
                  </button>
                ) : (
                  <div style={{ background: '#f9fafb', borderRadius: 8, padding: 10, marginTop: 6 }}>
                    <input
                      value={ncNombre}
                      onChange={(e) => setNcNombre(e.target.value)}
                      placeholder="Nombre y apellidos"
                      style={{ ...inputBase, marginBottom: 6 }}
                    />
                    <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                      <input
                        value={ncTelefono}
                        onChange={(e) => setNcTelefono(e.target.value)}
                        placeholder="Teléfono"
                        style={{ ...inputBase, flex: 1 }}
                      />
                      <input
                        value={ncTelefono2}
                        onChange={(e) => setNcTelefono2(e.target.value)}
                        placeholder="Teléfono 2 (opcional)"
                        style={{ ...inputBase, flex: 1 }}
                      />
                    </div>
                    <input
                      value={ncEmail}
                      onChange={(e) => setNcEmail(e.target.value)}
                      placeholder="Email (opcional)"
                      style={{ ...inputBase, marginBottom: 6 }}
                    />
                    <input
                      value={ncOtros}
                      onChange={(e) => setNcOtros(e.target.value)}
                      placeholder="Otros datos (opcional)"
                      style={{ ...inputBase, marginBottom: 8 }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      <button onClick={() => setMostrandoFormCliente(false)} style={botonSecundario}>Cancelar</button>
                      <button onClick={handleCrearClienteRapido} style={botonPrimario}>Crear y usar en esta nota</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Campo>

          <Campo etiqueta="Domicilio">
            <select
              value={domicilioId}
              onChange={(e) => setDomicilioId(e.target.value ? Number(e.target.value) : '')}
              disabled={!clienteSeleccionado}
              style={inputBase}
            >
              <option value="">{clienteSeleccionado ? 'Sin domicilio seleccionado' : 'Selecciona un cliente primero'}</option>
              {clienteSeleccionado?.domicilios.map((d) => (
                <option key={d.id} value={d.id}>{d.direccion} — {d.municipios?.nombre ?? ''}</option>
              ))}
            </select>
            <button
              onClick={() => setMostrandoFormDomicilio((v) => !v)}
              disabled={!clienteSeleccionado}
              style={{ ...botonSecundario, marginTop: 6 }}
            >
              + Añadir otro domicilio a este cliente
            </button>

            {mostrandoFormDomicilio && (
              <div style={{ background: '#f9fafb', borderRadius: 8, padding: 10, marginTop: 8 }}>
                <input
                  value={nuevaDireccion}
                  onChange={(e) => setNuevaDireccion(e.target.value)}
                  placeholder="Dirección"
                  style={{ ...inputBase, marginBottom: 6 }}
                />
                <select
                  value={nuevoMunicipioId}
                  onChange={(e) => setNuevoMunicipioId(e.target.value ? Number(e.target.value) : '')}
                  style={{ ...inputBase, marginBottom: 8 }}
                >
                  <option value="">Selecciona municipio...</option>
                  {municipios.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                </select>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button onClick={() => setMostrandoFormDomicilio(false)} style={botonSecundario}>Cancelar</button>
                  <button onClick={handleCrearDomicilio} style={botonPrimario}>Guardar domicilio</button>
                </div>
              </div>
            )}
          </Campo>

          <div style={{ display: 'flex', gap: 10 }}>
            <Campo etiqueta="Tipo de nota" flex>
              <select value={tipoNotaId} onChange={(e) => setTipoNotaId(e.target.value ? Number(e.target.value) : '')} style={inputBase}>
                <option value="">Selecciona...</option>
                {tiposNota.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
              </select>
            </Campo>
            <Campo etiqueta="Asignada" flex>
              <select value={asignadoId} onChange={(e) => setAsignadoId(e.target.value ? Number(e.target.value) : '')} style={inputBase}>
                <option value="">Selecciona...</option>
                {asignados.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
              </select>
            </Campo>
          </div>

          <Campo etiqueta="Fecha de entrada">
            <input type="date" value={fechaEntrada} onChange={(e) => setFechaEntrada(e.target.value)} style={inputBase} />
          </Campo>

          <Campo etiqueta="Observaciones">
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={3}
              placeholder="Describe el trabajo o aviso"
              style={{ ...inputBase, height: 'auto', padding: 8, resize: 'vertical' }}
            />
          </Campo>

          <Campo etiqueta="Llevar">
            <select value={llevarId} onChange={(e) => setLlevarId(e.target.value ? Number(e.target.value) : '')} style={inputBase}>
              <option value="">Selecciona...</option>
              {llevarOpciones.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
            </select>
          </Campo>

          <div style={{ display: 'flex', gap: 10 }}>
            <Campo etiqueta="Día de cita" flex>
              <input type="date" value={diaCita} onChange={(e) => setDiaCita(e.target.value)} style={inputBase} />
            </Campo>
            <Campo etiqueta="Hora" flex>
              <input type="time" value={horaCita} onChange={(e) => setHoraCita(e.target.value)} style={inputBase} />
            </Campo>
          </div>
        </div>

        {error && <p style={{ color: '#b42318', fontSize: 13, marginTop: 12 }}>{error}</p>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20, borderTop: '1px solid #e5e7eb', paddingTop: 16 }}>
          <button onClick={onCerrar} style={botonSecundario}>Cancelar</button>
          <button onClick={handleGuardarNota} disabled={guardando} style={botonPrimario}>
            {guardando ? 'Guardando...' : esEdicion ? 'Guardar cambios' : 'Guardar nota'}
          </button>
        </div>
      </div>
    </div>
  )
}

function formatearFechaDetalle(iso: string | null) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function FilaResumen({ etiqueta, valor }: { etiqueta: string; valor: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f0f0f0', fontSize: 13 }}>
      <span style={{ color: '#6b7280' }}>{etiqueta}</span>
      <span style={{ color: '#1c2230', fontWeight: 500, textAlign: 'right' }}>{valor || '—'}</span>
    </div>
  )
}

function PanelDetalleNota({
  nota,
  onCerrar,
  onEditar,
}: {
  nota: NotaListado
  onCerrar: () => void
  onEditar: () => void
}) {
  return (
    <div style={overlayStyle}>
      <div style={{ ...modalStyle, width: 480 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 500 }}>Nota {nota.numero_nota ?? nota.id}</h2>
          <button onClick={onCerrar} style={botonCerrar}>×</button>
        </div>
        <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 16px' }}>
          {nota.tipo_notas?.nombre ?? 'Sin tipo'}
        </p>

        <div>
          <FilaResumen etiqueta="Cliente" valor={nota.clientes?.nombre} />
          <FilaResumen
            etiqueta="Domicilio"
            valor={nota.domicilios ? `${nota.domicilios.direccion} — ${nota.domicilios.municipios?.nombre ?? ''}` : '—'}
          />
          <FilaResumen etiqueta="Asignada" valor={nota.asignados?.nombre} />
          <FilaResumen etiqueta="Llevar" valor={nota.llevar_opciones?.nombre} />
          <FilaResumen
            etiqueta="Fecha cita"
            valor={`${formatearFechaDetalle(nota.dia_cita)}${nota.hora_cita ? ' · ' + nota.hora_cita.slice(0, 5) : ''}`}
          />
        </div>

        {nota.observaciones && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #e5e7eb' }}>
            <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 4px' }}>Observaciones</p>
            <p style={{ fontSize: 13, color: '#1c2230', margin: 0, whiteSpace: 'pre-wrap' }}>{nota.observaciones}</p>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20, borderTop: '1px solid #e5e7eb', paddingTop: 16 }}>
          <button onClick={onEditar} style={botonSecundario}>Editar</button>
          <a
            href={`/notas-imprimir/${nota.id}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ ...botonPrimario, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}
          >
            Ver Nota
          </a>
        </div>
      </div>
    </div>
  )
}

function Campo({ etiqueta, children, flex }: { etiqueta: string; children: React.ReactNode; flex?: boolean }) {
  return (
    <div style={flex ? { flex: 1 } : undefined}>
      <label style={{ fontSize: 13, color: '#6b7280', display: 'block', marginBottom: 4 }}>{etiqueta}</label>
      {children}
    </div>
  )
}

const inputBase: React.CSSProperties = {
  width: '100%', height: 36, borderRadius: 8, border: '1px solid #d1d5db', padding: '0 10px', fontSize: 13, boxSizing: 'border-box',
}
const botonPrimario: React.CSSProperties = {
  height: 36, padding: '0 16px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer',
}
const botonSecundario: React.CSSProperties = {
  height: 30, padding: '0 12px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', fontSize: 12, cursor: 'pointer',
}
const botonCerrar: React.CSSProperties = {
  border: 'none', background: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280', width: 28, height: 28,
}
const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
}
const modalStyle: React.CSSProperties = {
  background: '#fff', borderRadius: 12, width: 560, maxWidth: '92vw', maxHeight: '88vh', overflowY: 'auto', padding: '1.5rem',
}
