'use client'

import { useMemo, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  crearCliente,
  actualizarCliente,
  crearDomicilio,
  actualizarDomicilio,
  listarFotosDomicilio,
  subirFotoDomicilio,
  borrarFotoDomicilio,
} from './actions'
import CabeceraSeccion from '@/components/CabeceraSeccion'

type Domicilio = {
  id: number
  direccion: string
  municipio_id: number | null
  zona: string | null
  datos_vivienda: string | null
  municipios: { nombre: string } | null
}

export type Cliente = {
  id: number
  nombre: string
  telefono: string | null
  telefono2: string | null
  email: string | null
  otros_datos: string | null
  dni: string | null
  lpd_firmado: boolean
  domicilios: Domicilio[]
}

type Municipio = { id: number; nombre: string }

function unoOnulo(valor: any) {
  return Array.isArray(valor) ? (valor[0] ?? null) : valor
}

export default function ClientesExplorer({
  clientesIniciales,
  municipios,
}: {
  clientesIniciales: Cliente[]
  municipios: Municipio[]
}) {
  const searchParams = useSearchParams()
  const [clientes, setClientes] = useState<Cliente[]>(clientesIniciales)
  const [busqueda, setBusqueda] = useState(searchParams.get('buscar') ?? '')
  const [modalAbierto, setModalAbierto] = useState(false)
  const [clienteEditando, setClienteEditando] = useState<Cliente | null>(null)

  const filtrados = useMemo(() => {
    const t = busqueda.trim().toLowerCase()
    if (!t) return clientes
    return clientes.filter((c) => {
      const campos = [
        c.nombre,
        c.telefono,
        c.telefono2,
        c.email,
        c.dni,
        ...c.domicilios.map((d) => `${d.direccion} ${d.municipios?.nombre ?? ''}`),
      ]
        .join(' ')
        .toLowerCase()
      return campos.includes(t)
    })
  }, [clientes, busqueda])

  function abrirNuevo() {
    setClienteEditando(null)
    setModalAbierto(true)
  }

  function abrirEdicion(cliente: Cliente) {
    setClienteEditando(cliente)
    setModalAbierto(true)
  }

  function alGuardarCliente(cliente: Cliente, esNuevo: boolean) {
    setClientes((prev) =>
      esNuevo ? [cliente, ...prev] : prev.map((c) => (c.id === cliente.id ? cliente : c))
    )
  }

  return (
    <div>
      <CabeceraSeccion
        color="verde"
        titulo="Clientes"
        subtitulo={`${clientes.length} clientes en total${busqueda ? ` · ${filtrados.length} coinciden` : ''}`}
        accion={<button onClick={abrirNuevo} style={botonPrimario}>+ Nuevo cliente</button>}
      />

      <input
        type="text"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar por nombre, teléfono, dirección o email"
        style={{ ...inputBase, width: '100%', marginBottom: 16 }}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtrados.length === 0 && (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af', fontSize: 14, border: '1px solid #e5e7eb', borderRadius: 12, background: '#fff' }}>
            No se encontraron clientes con ese criterio.
          </div>
        )}
        {filtrados.map((c) => (
          <TarjetaCliente key={c.id} cliente={c} onEditar={() => abrirEdicion(c)} />
        ))}
      </div>

      {modalAbierto && (
        <ModalCliente
          cliente={clienteEditando}
          municipios={municipios}
          onCerrar={() => setModalAbierto(false)}
          onGuardado={alGuardarCliente}
        />
      )}
    </div>
  )
}

function TarjetaCliente({ cliente, onEditar }: { cliente: Cliente; onEditar: () => void }) {
  const iniciales = cliente.nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '1rem 1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%', background: '#e6f1fb', color: '#0c447c',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 500, flexShrink: 0,
          }}>
            {iniciales}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 500, fontSize: 15, color: '#1c2230' }}>{cliente.nombre}</span>
              <span style={{
                fontSize: 11, padding: '2px 8px', borderRadius: 6,
                background: cliente.lpd_firmado ? '#eaf3de' : '#faeeda',
                color: cliente.lpd_firmado ? '#27500a' : '#854f0b',
              }}>
                {cliente.lpd_firmado ? 'LPD firmado' : 'LPD pendiente'}
              </span>
            </div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
              {cliente.dni ? `DNI ${cliente.dni}` : 'DNI sin registrar'}
            </div>
          </div>
        </div>
        <button onClick={onEditar} style={botonSecundario}>Editar</button>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 6,
        marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #e5e7eb', fontSize: 13, color: '#374151',
      }}>
        <span>{cliente.telefono || <span style={{ color: '#9ca3af' }}>Sin teléfono</span>}</span>
        <span>{cliente.telefono2 || <span style={{ color: '#9ca3af' }}>Sin teléfono 2</span>}</span>
        <span>{cliente.email || <span style={{ color: '#9ca3af' }}>Sin email</span>}</span>
        <span>{cliente.otros_datos || <span style={{ color: '#9ca3af' }}>Sin notas</span>}</span>
      </div>

      <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 6px' }}>
        {cliente.domicilios.length} {cliente.domicilios.length === 1 ? 'domicilio' : 'domicilios'}
      </p>
      {cliente.domicilios.length === 0 ? (
        <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>Sin domicilios registrados.</p>
      ) : (
        cliente.domicilios.map((d) => (
          <div key={d.id} style={{ fontSize: 13, color: '#374151' }}>
            {d.direccion} — {d.municipios?.nombre ?? 'sin municipio'}
          </div>
        ))
      )}
    </div>
  )
}

function ModalCliente({
  cliente,
  municipios,
  onCerrar,
  onGuardado,
}: {
  cliente: Cliente | null
  municipios: Municipio[]
  onCerrar: () => void
  onGuardado: (cliente: Cliente, esNuevo: boolean) => void
}) {
  const [nombre, setNombre] = useState(cliente?.nombre ?? '')
  const [telefono, setTelefono] = useState(cliente?.telefono ?? '')
  const [telefono2, setTelefono2] = useState(cliente?.telefono2 ?? '')
  const [email, setEmail] = useState(cliente?.email ?? '')
  const [otros, setOtros] = useState(cliente?.otros_datos ?? '')
  const [dni, setDni] = useState(cliente?.dni ?? '')
  const [lpd, setLpd] = useState(cliente?.lpd_firmado ?? false)
  const [domicilios, setDomicilios] = useState<Domicilio[]>(cliente?.domicilios ?? [])
  const [domicilioSeleccionadoId, setDomicilioSeleccionadoId] = useState<number | null>(null)
  const [creandoDomicilioNuevo, setCreandoDomicilioNuevo] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [clienteIdActual, setClienteIdActual] = useState<number | null>(cliente?.id ?? null)

  async function handleGuardarCliente() {
    if (!nombre.trim()) return
    setGuardando(true)
    setError(null)
    try {
      if (clienteIdActual) {
        await actualizarCliente(clienteIdActual, {
          nombre: nombre.trim(),
          telefono: telefono.trim(),
          telefono2: telefono2.trim(),
          email: email.trim(),
          otros_datos: otros.trim(),
          dni: dni.trim(),
          lpd_firmado: lpd,
        })
        onGuardado(
          { id: clienteIdActual, nombre, telefono, telefono2, email, otros_datos: otros, dni, lpd_firmado: lpd, domicilios },
          false
        )
      } else {
        const creado = await crearCliente({
          nombre: nombre.trim(),
          telefono: telefono.trim(),
          telefono2: telefono2.trim(),
          email: email.trim(),
          otros_datos: otros.trim(),
        })
        setClienteIdActual(creado.id)
        const clienteNuevo: Cliente = { ...creado, domicilios: [] as Domicilio[] }
        onGuardado(clienteNuevo, true)
      }
    } catch {
      setError('No se pudo guardar el cliente. Inténtalo de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  function alGuardarDomicilioNuevo(domicilio: Domicilio) {
    setDomicilios((prev) => [...prev, domicilio])
    setCreandoDomicilioNuevo(false)
    setDomicilioSeleccionadoId(domicilio.id)
  }

  function alActualizarDomicilio(domicilio: Domicilio) {
    setDomicilios((prev) => prev.map((d) => (d.id === domicilio.id ? domicilio : d)))
  }

  const domicilioSeleccionado = domicilios.find((d) => d.id === domicilioSeleccionadoId) ?? null

  return (
    <div style={overlayStyle}>
      <div style={modalStylePartido}>
        {/* Columna izquierda: datos del cliente */}
        <div style={{ flex: '1 1 360px', minWidth: 320, display: 'flex', flexDirection: 'column', borderRight: '1px solid #e5e7eb' }}>
          <div style={{
            background: 'linear-gradient(135deg, #1D9E75 0%, #0F6E56 100%)',
            padding: '18px 1.5rem', position: 'relative', flexShrink: 0,
          }}>
            <div style={{ display: 'flex', gap: 8, position: 'absolute', top: 12, right: 14 }}>
              {clienteIdActual && (
                <a
                  href={`/clientes-lopd/${clienteIdActual}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ height: 26, padding: '0 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 12, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}
                >
                  LOPD
                </a>
              )}
              <button onClick={onCerrar} style={{ ...botonCerrar, color: '#fff', background: 'rgba(255,255,255,0.15)', borderRadius: '50%' }}>×</button>
            </div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 500, color: '#fff' }}>
              {clienteIdActual ? 'Editar cliente' : 'Nuevo cliente'}
            </h2>
          </div>

          <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Campo etiqueta="Nombre">
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre y apellidos" style={inputBase} />
            </Campo>
            <div style={{ display: 'flex', gap: 10 }}>
              <Campo etiqueta="Teléfono" flex>
                <input value={telefono ?? ''} onChange={(e) => setTelefono(e.target.value)} placeholder="600 000 000" style={inputBase} />
              </Campo>
              <Campo etiqueta="Teléfono 2" flex>
                <input value={telefono2 ?? ''} onChange={(e) => setTelefono2(e.target.value)} placeholder="Opcional" style={inputBase} />
              </Campo>
            </div>
            <Campo etiqueta="Email">
              <input value={email ?? ''} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@correo.com" style={inputBase} />
            </Campo>
            <Campo etiqueta="DNI">
              <input value={dni ?? ''} onChange={(e) => setDni(e.target.value)} placeholder="00000000A" style={inputBase} />
            </Campo>
            <Campo etiqueta="Otros datos">
              <input value={otros ?? ''} onChange={(e) => setOtros(e.target.value)} placeholder="Notas adicionales" style={inputBase} />
            </Campo>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <input type="checkbox" checked={lpd} onChange={(e) => setLpd(e.target.checked)} />
              LPD firmado
            </label>

            <div style={{ borderTop: '1px solid #e5e7eb', marginTop: 8, paddingTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: '#374151' }}>Domicilios</span>
                <button
                  onClick={() => {
                    if (!clienteIdActual) { setError('Guarda primero los datos del cliente.'); return }
                    setDomicilioSeleccionadoId(null)
                    setCreandoDomicilioNuevo(true)
                  }}
                  style={botonSecundario}
                >
                  + Añadir
                </button>
              </div>

              {domicilios.length === 0 && (
                <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>Sin domicilios añadidos todavía.</p>
              )}

              {domicilios.map((d) => {
                const seleccionado = d.id === domicilioSeleccionadoId
                return (
                  <div
                    key={d.id}
                    onClick={() => { setCreandoDomicilioNuevo(false); setDomicilioSeleccionadoId(d.id) }}
                    style={{
                      padding: '8px 10px', borderRadius: 8, cursor: 'pointer', marginBottom: 4,
                      background: seleccionado ? '#e6f1fb' : 'transparent',
                      border: seleccionado ? '1px solid #93c5fd' : '1px solid transparent',
                    }}
                  >
                    <div style={{ fontSize: 13, color: '#1c2230', fontWeight: seleccionado ? 500 : 400 }}>
                      {d.direccion}
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>{d.municipios?.nombre ?? ''}</div>
                  </div>
                )
              })}
            </div>
          </div>

          {error && <p style={{ color: '#b42318', fontSize: 13, marginTop: 12 }}>{error}</p>}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '16px 1.5rem', borderTop: '1px solid #e5e7eb', flexShrink: 0 }}>
            <button onClick={onCerrar} style={botonSecundario}>Cerrar</button>
            <button onClick={handleGuardarCliente} disabled={guardando} style={botonPrimario}>
              {guardando ? 'Guardando...' : 'Guardar cliente'}
            </button>
          </div>
        </div>

        {/* Columna derecha: domicilio seleccionado, editable */}
        <div style={{ flex: '1 1 360px', minWidth: 320, display: 'flex', flexDirection: 'column', background: '#fafafa' }}>
          <div style={{
            background: 'linear-gradient(135deg, #BA7517 0%, #854F0B 100%)',
            padding: '18px 1.5rem', flexShrink: 0,
          }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 500, color: '#fff' }}>
              {creandoDomicilioNuevo ? 'Nuevo domicilio' : domicilioSeleccionado ? 'Editar domicilio' : 'Domicilio'}
            </h2>
          </div>
          <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
          {creandoDomicilioNuevo && clienteIdActual && (
            <PanelDomicilioNuevo
              clienteId={clienteIdActual}
              municipios={municipios}
              onCancelar={() => setCreandoDomicilioNuevo(false)}
              onGuardado={alGuardarDomicilioNuevo}
            />
          )}

          {!creandoDomicilioNuevo && domicilioSeleccionado && (
            <PanelDomicilioEdicion
              domicilio={domicilioSeleccionado}
              municipios={municipios}
              onActualizado={alActualizarDomicilio}
            />
          )}

          {!creandoDomicilioNuevo && !domicilioSeleccionado && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: '2rem' }}>
              Selecciona un domicilio de la lista para ver y editar sus datos,<br />o añade uno nuevo.
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  )
}

function PanelDomicilioNuevo({
  clienteId,
  municipios,
  onCancelar,
  onGuardado,
}: {
  clienteId: number
  municipios: Municipio[]
  onCancelar: () => void
  onGuardado: (domicilio: Domicilio) => void
}) {
  const [direccion, setDireccion] = useState('')
  const [municipioId, setMunicipioId] = useState<number | ''>('')
  const [zona, setZona] = useState('')
  const [datosVivienda, setDatosVivienda] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleGuardar() {
    if (!direccion.trim() || !municipioId) { setError('Dirección y municipio son obligatorios.'); return }
    setGuardando(true)
    setError(null)
    try {
      const creado: any = await crearDomicilio({
        cliente_id: clienteId,
        direccion: direccion.trim(),
        municipio_id: Number(municipioId),
        zona: zona.trim(),
        datos_vivienda: datosVivienda.trim(),
      })
      onGuardado({
        id: creado.id,
        direccion: creado.direccion,
        municipio_id: creado.municipio_id,
        zona: creado.zona,
        datos_vivienda: creado.datos_vivienda,
        municipios: unoOnulo(creado.municipios),
      })
    } catch {
      setError('No se pudo crear el domicilio.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Campo etiqueta="Dirección">
          <input value={direccion} onChange={(e) => setDireccion(e.target.value)} placeholder="Calle, número, piso..." style={inputBase} />
        </Campo>
        <Campo etiqueta="Municipio">
          <select value={municipioId} onChange={(e) => setMunicipioId(e.target.value ? Number(e.target.value) : '')} style={inputBase}>
            <option value="">Selecciona...</option>
            {municipios.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
          </select>
        </Campo>
        <Campo etiqueta="Zona">
          <input value={zona} onChange={(e) => setZona(e.target.value)} placeholder="Opcional" style={inputBase} />
        </Campo>
        <Campo etiqueta="Datos de la vivienda">
          <textarea
            value={datosVivienda}
            onChange={(e) => setDatosVivienda(e.target.value)}
            rows={3}
            placeholder="Notas sobre la vivienda (acceso, planta, observaciones...)"
            style={{ ...inputBase, height: 'auto', padding: 8, resize: 'vertical' }}
          />
        </Campo>
      </div>
      {error && <p style={{ color: '#b42318', fontSize: 13, marginTop: 10 }}>{error}</p>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <button onClick={onCancelar} style={botonSecundario}>Cancelar</button>
        <button onClick={handleGuardar} disabled={guardando} style={botonNaranja}>
          {guardando ? 'Guardando...' : 'Guardar domicilio'}
        </button>
      </div>
    </div>
  )
}

function PanelDomicilioEdicion({
  domicilio,
  municipios,
  onActualizado,
}: {
  domicilio: Domicilio
  municipios: Municipio[]
  onActualizado: (domicilio: Domicilio) => void
}) {
  const [direccion, setDireccion] = useState(domicilio.direccion)
  const [municipioId, setMunicipioId] = useState<number | ''>(domicilio.municipio_id ?? '')
  const [zona, setZona] = useState(domicilio.zona ?? '')
  const [datosVivienda, setDatosVivienda] = useState(domicilio.datos_vivienda ?? '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [guardadoOk, setGuardadoOk] = useState(false)

  async function handleGuardar() {
    if (!direccion.trim() || !municipioId) { setError('Dirección y municipio son obligatorios.'); return }
    setGuardando(true)
    setError(null)
    setGuardadoOk(false)
    try {
      const actualizado: any = await actualizarDomicilio(domicilio.id, {
        direccion: direccion.trim(),
        municipio_id: Number(municipioId),
        zona: zona.trim(),
        datos_vivienda: datosVivienda.trim(),
      })
      onActualizado({
        id: actualizado.id,
        direccion: actualizado.direccion,
        municipio_id: actualizado.municipio_id,
        zona: actualizado.zona,
        datos_vivienda: actualizado.datos_vivienda,
        municipios: unoOnulo(actualizado.municipios),
      })
      setGuardadoOk(true)
      setTimeout(() => setGuardadoOk(false), 2000)
    } catch {
      setError('No se pudo actualizar el domicilio.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Campo etiqueta="Dirección">
          <input value={direccion} onChange={(e) => setDireccion(e.target.value)} style={inputBase} />
        </Campo>
        <Campo etiqueta="Municipio">
          <select value={municipioId} onChange={(e) => setMunicipioId(e.target.value ? Number(e.target.value) : '')} style={inputBase}>
            <option value="">Selecciona...</option>
            {municipios.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
          </select>
        </Campo>
        <Campo etiqueta="Zona">
          <input value={zona} onChange={(e) => setZona(e.target.value)} placeholder="Opcional" style={inputBase} />
        </Campo>
        <Campo etiqueta="Datos de la vivienda">
          <textarea
            value={datosVivienda}
            onChange={(e) => setDatosVivienda(e.target.value)}
            rows={3}
            placeholder="Notas sobre la vivienda (acceso, planta, observaciones...)"
            style={{ ...inputBase, height: 'auto', padding: 8, resize: 'vertical' }}
          />
        </Campo>
      </div>

      {error && <p style={{ color: '#b42318', fontSize: 13, marginTop: 10 }}>{error}</p>}
      {guardadoOk && <p style={{ color: '#16a34a', fontSize: 13, marginTop: 10 }}>Guardado.</p>}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16, marginBottom: 20 }}>
        <button onClick={handleGuardar} disabled={guardando} style={botonNaranja}>
          {guardando ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>

      <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 16 }}>
        <SeccionFotos domicilioId={domicilio.id} />
      </div>
    </div>
  )
}

type FotoDomicilio = { id: number; ruta_storage: string; url: string | null }

function SeccionFotos({ domicilioId }: { domicilioId: number }) {
  const [fotos, setFotos] = useState<FotoDomicilio[]>([])
  const [cargando, setCargando] = useState(true)
  const [subiendo, setSubiendo] = useState(false)

  useEffect(() => {
    let activo = true
    setCargando(true)
    listarFotosDomicilio(domicilioId).then((r) => {
      if (activo) {
        setFotos(r as FotoDomicilio[])
        setCargando(false)
      }
    })
    return () => { activo = false }
  }, [domicilioId])

  async function handleSubirArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0]
    if (!archivo) return
    setSubiendo(true)
    try {
      const formData = new FormData()
      formData.append('archivo', archivo)
      await subirFotoDomicilio(domicilioId, formData)
      const r = await listarFotosDomicilio(domicilioId)
      setFotos(r as FotoDomicilio[])
    } catch {
      // Si falla, el usuario puede reintentar; no se añade nada a la lista.
    } finally {
      setSubiendo(false)
      e.target.value = ''
    }
  }

  async function handleBorrar(foto: FotoDomicilio) {
    await borrarFotoDomicilio(foto.id, foto.ruta_storage)
    setFotos((prev) => prev.filter((f) => f.id !== foto.id))
  }

  return (
    <div>
      <p style={{ fontSize: 13, color: '#374151', margin: '0 0 8px', fontWeight: 500 }}>Fotos de trabajos anteriores</p>

      {cargando && <p style={{ fontSize: 12, color: '#9ca3af' }}>Cargando fotos...</p>}
      {!cargando && fotos.length === 0 && (
        <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 8px' }}>Sin fotos todavía.</p>
      )}

      {fotos.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 8, marginBottom: 8 }}>
          {fotos.map((f) => (
            <div key={f.id} style={{ position: 'relative' }}>
              {f.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={f.url}
                  alt="Foto del domicilio"
                  style={{ width: '100%', height: 90, objectFit: 'cover', borderRadius: 6, border: '1px solid #e5e7eb' }}
                />
              ) : (
                <div style={{ width: '100%', height: 90, background: '#f3f4f6', borderRadius: 6 }} />
              )}
              <button
                onClick={() => handleBorrar(f)}
                aria-label="Borrar foto"
                style={{
                  position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: '50%',
                  border: 'none', background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 13, cursor: 'pointer', lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <label style={{ display: 'inline-block' }}>
        <input
          type="file"
          accept="image/*"
          onChange={handleSubirArchivo}
          disabled={subiendo}
          style={{ display: 'none' }}
        />
        <span style={{ ...botonSecundario, display: 'inline-flex', cursor: subiendo ? 'default' : 'pointer' }}>
          {subiendo ? 'Subiendo...' : '+ Añadir foto'}
        </span>
      </label>
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
  height: 36, padding: '0 16px', borderRadius: 8, border: 'none', background: '#1D9E75', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer',
}
const botonNaranja: React.CSSProperties = {
  height: 36, padding: '0 16px', borderRadius: 8, border: 'none', background: '#BA7517', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer',
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
  background: '#fff', borderRadius: 12, width: 480, maxWidth: '92vw', maxHeight: '88vh', overflowY: 'auto', padding: '1.5rem',
}
const modalStylePartido: React.CSSProperties = {
  background: '#fff', borderRadius: 12, width: 920, maxWidth: '95vw', maxHeight: '90vh', display: 'flex', overflow: 'hidden',
}
