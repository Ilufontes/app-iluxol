'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  buscarClientes,
  crearClienteRapido,
  crearDomicilioRapido,
  crearNota,
  actualizarNota,
  buscarNotaPorNumero,
  enviarNotaACalendarioAction,
} from './actions'
import { comprobarDuplicados as comprobarDuplicadosCliente } from '../clientes/actions'
import CabeceraSeccion from '@/components/CabeceraSeccion'
import Paginacion from '@/components/Paginacion'

type Opcion = { id: number; nombre: string }

type DomicilioCliente = { id: number; direccion: string; zona?: string | null; datos_vivienda?: string | null; municipios: { nombre: string } | null }
type ClienteResultado = {
  id: number
  nombre: string
  telefono: string | null
  telefono2?: string | null
  email?: string | null
  lpd_firmado?: boolean | null
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
  asignados: { nombre: string; color?: string | null } | null
  llevar_opciones?: { nombre: string } | null
}

export default function NotasExplorer({
  notasIniciales,
  tiposNota,
  asignados,
  llevarOpciones,
  municipios,
  paginaActual,
  totalPaginas,
  totalNotas,
  filtroFecha,
  filtroClienteNombre,
  filtroAsignadoId,
}: {
  notasIniciales: NotaListado[]
  tiposNota: Opcion[]
  asignados: Opcion[]
  llevarOpciones: Opcion[]
  municipios: Opcion[]
  paginaActual: number
  totalPaginas: number
  totalNotas: number
  filtroFecha?: string | null
  filtroClienteNombre?: string | null
  filtroAsignadoId?: number | null
}) {
  const [notas, setNotas] = useState<NotaListado[]>(notasIniciales)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [notaEditando, setNotaEditando] = useState<NotaListado | null>(null)
  const [notaDetalle, setNotaDetalle] = useState<NotaListado | null>(null)
  const [avisoLopdCliente, setAvisoLopdCliente] = useState<{ id: number; nombre: string } | null>(null)

  const searchParams = useSearchParams()
  const router = useRouter()

  // Si se llega con ?nota=NUMERO (por ejemplo desde "Volver a la nota" en Clientes),
  // se abre directamente su panel de detalle, sin que haya que buscarla a mano.
  useEffect(() => {
    const numeroParam = searchParams.get('nota')
    if (!numeroParam) return
    const numero = Number(numeroParam)
    if (!Number.isInteger(numero) || numero <= 0) return

    const yaEnLista = notas.find((n) => n.numero_nota === numero)
    if (yaEnLista) {
      setNotaDetalle(yaEnLista)
      return
    }
    buscarNotaPorNumero(numero).then((r: any) => {
      if (!r) return
      const normalizada: NotaListado = {
        ...r,
        clientes: unoOnulo(r.clientes),
        tipo_notas: unoOnulo(r.tipo_notas),
        asignados: unoOnulo(r.asignados),
        llevar_opciones: unoOnulo(r.llevar_opciones),
        domicilios: (() => {
          const d = unoOnulo(r.domicilios)
          return d ? { ...d, municipios: unoOnulo(d.municipios) } : null
        })(),
      }
      setNotaDetalle(normalizada)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [busquedaNumero, setBusquedaNumero] = useState('')
  const [resultadoBusqueda, setResultadoBusqueda] = useState<NotaListado[] | null>(null)
  const [buscandoNumero, setBuscandoNumero] = useState(false)

  useEffect(() => {
    const t = busquedaNumero.trim()
    if (!t) {
      setResultadoBusqueda(null)
      setBuscandoNumero(false)
      return
    }
    const numero = Number(t)
    if (!Number.isInteger(numero) || numero <= 0) {
      setResultadoBusqueda([])
      setBuscandoNumero(false)
      return
    }
    setBuscandoNumero(true)
    const temporizador = setTimeout(async () => {
      const r: any = await buscarNotaPorNumero(numero)
      if (!r) {
        setResultadoBusqueda([])
      } else {
        const normalizada: NotaListado = {
          ...r,
          clientes: unoOnulo(r.clientes),
          tipo_notas: unoOnulo(r.tipo_notas),
          asignados: unoOnulo(r.asignados),
          llevar_opciones: unoOnulo(r.llevar_opciones),
          domicilios: (() => {
            const d = unoOnulo(r.domicilios)
            return d ? { ...d, municipios: unoOnulo(d.municipios) } : null
          })(),
        }
        setResultadoBusqueda([normalizada])
      }
      setBuscandoNumero(false)
    }, 350)
    return () => clearTimeout(temporizador)
  }, [busquedaNumero])

  const enBusquedaNumero = busquedaNumero.trim().length > 0
  const notasVisibles = enBusquedaNumero ? (resultadoBusqueda ?? []) : notas

  function abrirNueva() {
    setNotaEditando(null)
    setModalAbierto(true)
  }

  function abrirEdicion(nota: NotaListado) {
    setNotaEditando(nota)
    setNotaDetalle(null)
    setModalAbierto(true)
  }

  function alGuardar(nota: NotaListado, esNueva: boolean, cliente: ClienteResultado) {
    if (esNueva) {
      // Solo insertamos en caliente si estamos viendo la primera página
      // (las notas nuevas son siempre las de número más alto, que aparecen ahí).
      if (paginaActual === 1) {
        setNotas((prev) => [nota, ...prev].slice(0, 40))
      }
    } else {
      setNotas((prev) => prev.map((n) => (n.id === nota.id ? nota : n)))
    }
    setModalAbierto(false)
    router.refresh()

    if (!cliente.lpd_firmado) {
      setAvisoLopdCliente({ id: cliente.id, nombre: cliente.nombre })
    }
  }

  const asignadoActivo = asignados.find((a) => a.id === filtroAsignadoId)

  return (
    <div>
      <CabeceraSeccion
        color="azul"
        titulo="Notas"
        subtitulo={
          filtroClienteNombre
            ? `Mostrando ${totalNotas} ${totalNotas === 1 ? 'nota' : 'notas'} de ${filtroClienteNombre}`
            : filtroFecha
            ? `Mostrando ${totalNotas} ${totalNotas === 1 ? 'nota' : 'notas'} con cita el ${formatearFechaDetalle(filtroFecha)}`
            : asignadoActivo
            ? `Mostrando ${totalNotas} ${totalNotas === 1 ? 'nota' : 'notas'} de ${asignadoActivo.nombre}`
            : `${totalNotas} notas registradas — página ${paginaActual} de ${totalPaginas}`
        }
        extra={
          filtroClienteNombre ? (
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <a
                href={`/clientes?buscar=${encodeURIComponent(filtroClienteNombre)}`}
                style={{ fontSize: 12, color: '#2230B8', textDecoration: 'underline' }}
              >
                ← Volver al cliente
              </a>
              <a href="/notas" style={{ fontSize: 12, color: '#2230B8', textDecoration: 'underline' }}>
                Quitar filtro y ver todas
              </a>
            </div>
          ) : filtroFecha ? (
            <a href="/notas" style={{ fontSize: 12, color: '#2230B8', textDecoration: 'underline' }}>
              Quitar filtro y ver todas
            </a>
          ) : asignadoActivo ? (
            <a href="/notas" style={{ fontSize: 12, color: '#2230B8', textDecoration: 'underline' }}>
              Quitar filtro y ver todas
            </a>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                inputMode="numeric"
                value={busquedaNumero}
                onChange={(e) => setBusquedaNumero(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="Buscar por número de nota..."
                style={{
                  flex: 1, height: 36, borderRadius: 8, border: '1px solid #d6daf8',
                  padding: '0 12px', fontSize: 13, boxSizing: 'border-box', background: '#fff',
                }}
              />
              <select
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) window.location.href = `/notas?asignado=${e.target.value}`
                }}
                style={{
                  height: 36, borderRadius: 8, border: '1px solid #d6daf8',
                  padding: '0 8px', fontSize: 13, background: '#fff', flexShrink: 0,
                }}
              >
                <option value="">Filtrar por asignado...</option>
                {asignados.map((a) => (
                  <option key={a.id} value={a.id}>{a.nombre}</option>
                ))}
              </select>
            </div>
          )
        }
        accion={<button onClick={abrirNueva} style={botonPrimario}>+ Nueva nota</button>}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {enBusquedaNumero && buscandoNumero && (
          <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>Buscando...</p>
        )}
        {enBusquedaNumero && !buscandoNumero && notasVisibles.length === 0 && (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af', fontSize: 14, border: '1px solid #e5e7eb', borderRadius: 12, background: '#fff' }}>
            No se encontró ninguna nota con el número "{busquedaNumero}".
          </div>
        )}
        {!enBusquedaNumero && notas.length === 0 && (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af', fontSize: 14, border: '1px solid #e5e7eb', borderRadius: 12, background: '#fff' }}>
            Todavía no hay notas registradas.
          </div>
        )}
        {notasVisibles.map((n) => <TarjetaNota key={n.id} nota={n} onClick={() => setNotaDetalle(n)} />)}
      </div>

      {!enBusquedaNumero && (
        <Paginacion paginaActual={paginaActual} totalPaginas={totalPaginas} baseHref="/notas" color="#3441E0" />
      )}

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

      {avisoLopdCliente && (
        <div style={overlayStyle}>
          <div style={{ background: '#fff', borderRadius: 12, width: 380, maxWidth: '90vw', padding: '1.5rem' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 500, color: '#1c2230' }}>
              LOPD pendiente
            </h3>
            <p style={{ fontSize: 13, color: '#374151', margin: '0 0 20px' }}>
              <strong>{avisoLopdCliente.nombre}</strong> todavía no tiene el documento de protección de
              datos firmado. ¿Quieres imprimirlo ahora o lo dejas para más adelante?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setAvisoLopdCliente(null)} style={botonSecundario}>
                Descartar
              </button>
              <a
                href={`/clientes-lopd/${avisoLopdCliente.id}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setAvisoLopdCliente(null)}
                style={{ ...botonPrimario, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}
              >
                Imprimir LOPD
              </a>
            </div>
          </div>
        </div>
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
  const colorAsignado = nota.asignados?.color
  const fondoTarjeta = colorAsignado ? `${colorAsignado}14` : '#fff' // ~8% opacidad: tinte muy suave
  const bordeTarjeta = colorAsignado ? `${colorAsignado}40` : '#e5e7eb' // ~25% opacidad

  return (
    <div
      onClick={onClick}
      style={{ background: fondoTarjeta, border: `1px solid ${bordeTarjeta}`, borderRadius: 12, padding: '0.9rem 1.1rem', cursor: 'pointer' }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = colorAsignado ? `${colorAsignado}80` : '#9ca3af')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = bordeTarjeta)}
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
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2, display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end' }}>
            {colorAsignado && <span style={{ width: 7, height: 7, borderRadius: '50%', background: colorAsignado, flexShrink: 0 }} />}
            {nota.asignados?.nombre ?? ''}
          </div>
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

// Formatea un número de 9 dígitos al estilo "634 404 119" mientras se escribe,
// igual que en la ficha de Clientes — así ambos formularios guardan el
// teléfono de forma consistente y la comparación de duplicados funciona bien.
function formatearTelefono(valor: string): string {
  const limpio = valor.replace(/\D/g, '')
  if (limpio.length !== 9) return valor
  return `${limpio.slice(0, 3)} ${limpio.slice(3, 6)} ${limpio.slice(6, 9)}`
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
  onGuardada: (nota: NotaListado, esNueva: boolean, cliente: ClienteResultado) => void
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
  const [nuevaZona, setNuevaZona] = useState('')
  const [nuevosDatosVivienda, setNuevosDatosVivienda] = useState('')

  const [mostrandoFormCliente, setMostrandoFormCliente] = useState(false)
  const [ncNombre, setNcNombre] = useState('')
  const [ncTelefono, setNcTelefono] = useState('')
  const [ncTelefono2, setNcTelefono2] = useState('')
  const [ncEmail, setNcEmail] = useState('')
  const [ncOtros, setNcOtros] = useState('')
  const [ncAvisoNombre, setNcAvisoNombre] = useState<{ id: number; nombre: string } | null>(null)
  const [ncAvisoTelefono, setNcAvisoTelefono] = useState<{ id: number; nombre: string; campo: string } | null>(null)

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!ncNombre.trim() && !ncTelefono.trim() && !ncTelefono2.trim()) {
        setNcAvisoNombre(null)
        setNcAvisoTelefono(null)
        return
      }
      const r = await comprobarDuplicadosCliente(ncNombre.trim(), ncTelefono.trim(), ncTelefono2.trim())
      setNcAvisoNombre(r.nombreDuplicado)
      setNcAvisoTelefono(r.telefonoDuplicado)
    }, 450)
    return () => clearTimeout(t)
  }, [ncNombre, ncTelefono, ncTelefono2])

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
        zona: nuevaZona.trim(),
        datos_vivienda: nuevosDatosVivienda.trim(),
      })
      const nuevoDomicilio: DomicilioCliente = {
        id: creado.id,
        direccion: creado.direccion,
        zona: creado.zona ?? null,
        datos_vivienda: creado.datos_vivienda ?? null,
        municipios: unoOnulo(creado.municipios),
      }
      setClienteSeleccionado({ ...clienteSeleccionado, domicilios: [...clienteSeleccionado.domicilios, nuevoDomicilio] })
      setDomicilioId(nuevoDomicilio.id)
      setNuevaDireccion('')
      setNuevoMunicipioId('')
      setNuevaZona('')
      setNuevosDatosVivienda('')
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
      onGuardada(normalizarNotaGuardada(nota), !esEdicion, clienteSeleccionado)
    } catch {
      setError(`No se pudo ${esEdicion ? 'actualizar' : 'guardar'} la nota. Inténtalo de nuevo.`)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div style={overlayStyle}>
      <div style={{ ...modalStyle, padding: 0, overflowY: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{
          background: 'linear-gradient(135deg, #3441E0 0%, #2230B8 100%)',
          padding: '18px 1.5rem', position: 'relative', flexShrink: 0,
        }}>
          <div style={{ position: 'absolute', top: 12, right: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            {esEdicion && notaEditando?.clientes?.nombre && (
              <a
                href={`/clientes?buscar=${encodeURIComponent(notaEditando.clientes.nombre)}${notaEditando.numero_nota ? `&nota=${notaEditando.numero_nota}` : ''}`}
                style={{
                  height: 26, padding: '0 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.4)',
                  background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 12,
                  display: 'inline-flex', alignItems: 'center', textDecoration: 'none',
                }}
              >
                Ver cliente
              </a>
            )}
            <button onClick={onCerrar} style={{ ...botonCerrar, color: '#fff', background: 'rgba(255,255,255,0.15)', borderRadius: '50%' }}>×</button>
          </div>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 500, color: '#fff' }}>{esEdicion ? `Editar nota ${notaEditando!.numero_nota ?? notaEditando!.id}` : 'Nueva nota'}</h2>
        </div>
        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          <div style={bloqueColor.verde}>
          <Campo etiqueta="Cliente">
            {clienteSeleccionado ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #cfe8db', borderRadius: 8, padding: '8px 10px', background: '#fff' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{clienteSeleccionado.nombre}</div>
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>{clienteSeleccionado.telefono ? formatearTelefono(clienteSeleccionado.telefono) : 'Sin teléfono'}</div>
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
                  style={{ ...inputBase, border: '1px solid #cfe8db', background: '#fff' }}
                />
                {buscando && <p style={{ fontSize: 12, color: '#9ca3af', margin: '6px 0 0' }}>Buscando...</p>}
                {resultados.length > 0 && (
                  <div style={{ border: '1px solid #cfe8db', borderRadius: 8, marginTop: 6, maxHeight: 160, overflowY: 'auto', background: '#fff' }}>
                    {resultados.map((c) => (
                      <div
                        key={c.id}
                        onClick={() => seleccionarCliente(c)}
                        style={{ padding: '8px 10px', fontSize: 13, cursor: 'pointer', borderBottom: '1px solid #f0f0f0' }}
                      >
                        <strong>{c.nombre}</strong> · {c.telefono ? formatearTelefono(c.telefono) : 'Sin teléfono'}
                      </div>
                    ))}
                  </div>
                )}

                {!mostrandoFormCliente ? (
                  <button
                    onClick={() => {
                      // Si lo que se buscó parece un nombre (no solo números, como un teléfono),
                      // se precarga en el formulario para no tener que volver a escribirlo.
                      const pareceNombre = terminoBusqueda.trim() && !/^\d+$/.test(terminoBusqueda.trim())
                      if (pareceNombre) setNcNombre(terminoBusqueda.trim())
                      setMostrandoFormCliente(true)
                    }}
                    style={{ ...botonSecundarioVerde, width: '100%', marginTop: 6 }}
                  >
                    + Crear cliente nuevo
                  </button>
                ) : (
                  <div style={{ background: '#fff', border: '1px solid #cfe8db', borderRadius: 8, padding: 10, marginTop: 6 }}>
                    <input
                      value={ncNombre}
                      onChange={(e) => setNcNombre(e.target.value)}
                      placeholder="Nombre y apellidos"
                      style={{ ...inputBase, marginBottom: 6 }}
                    />
                    {ncAvisoNombre && (
                      <p style={{ fontSize: 11, color: '#854F0B', margin: '-2px 0 6px' }}>
                        Ya existe un cliente con este nombre: {ncAvisoNombre.nombre}.
                      </p>
                    )}
                    <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                      <input
                        value={ncTelefono}
                        onChange={(e) => setNcTelefono(formatearTelefono(e.target.value))}
                        placeholder="Teléfono"
                        maxLength={11}
                        style={{ ...inputBase, flex: 1 }}
                      />
                      <input
                        value={ncTelefono2}
                        onChange={(e) => setNcTelefono2(formatearTelefono(e.target.value))}
                        placeholder="Teléfono 2 (opcional)"
                        maxLength={11}
                        style={{ ...inputBase, flex: 1 }}
                      />
                    </div>
                    {ncAvisoTelefono && (
                      <p style={{
                        fontSize: 11, color: '#854F0B', margin: '-2px 0 6px', background: '#FBF3E6',
                        border: '1px solid #F0DFB9', borderRadius: 6, padding: '5px 8px',
                      }}>
                        Ese teléfono ya está registrado a <strong>{ncAvisoTelefono.nombre}</strong> ({ncAvisoTelefono.campo}). Puedes continuar igual si es un familiar.
                      </p>
                    )}
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
                      <button onClick={handleCrearClienteRapido} style={botonVerde}>Crear y usar en esta nota</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Campo>
          </div>

          <div style={bloqueColor.naranja}>
          <Campo etiqueta="Domicilio">
            <select
              value={domicilioId}
              onChange={(e) => setDomicilioId(e.target.value ? Number(e.target.value) : '')}
              disabled={!clienteSeleccionado}
              style={{ ...inputBase, border: '1px solid #efd9b3', background: '#fff' }}
            >
              <option value="">{clienteSeleccionado ? 'Sin domicilio seleccionado' : 'Selecciona un cliente primero'}</option>
              {clienteSeleccionado?.domicilios.map((d) => (
                <option key={d.id} value={d.id}>{d.direccion} — {d.municipios?.nombre ?? ''}</option>
              ))}
            </select>
            {/* Datos de la vivienda del domicilio seleccionado (solo lectura) */}
            {(() => {
              const domSeleccionado = clienteSeleccionado?.domicilios.find(d => d.id === domicilioId)
              if (!domSeleccionado?.datos_vivienda) return null
              return (
                <div style={{ marginTop: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#92611a', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Datos de la vivienda
                  </span>
                  <textarea
                    readOnly
                    value={domSeleccionado.datos_vivienda}
                    rows={3}
                    style={{
                      ...inputBase,
                      marginTop: 4,
                      height: 'auto',
                      padding: 8,
                      resize: 'vertical',
                      background: '#fffbf3',
                      border: '1px solid #efd9b3',
                      color: '#374151',
                      cursor: 'default',
                    }}
                  />
                </div>
              )
            })()}

            <button
              onClick={() => setMostrandoFormDomicilio((v) => !v)}
              disabled={!clienteSeleccionado}
              style={{ ...botonSecundarioNaranja, marginTop: 6 }}
            >
              + Añadir otro domicilio a este cliente
            </button>

            {mostrandoFormDomicilio && (
              <div style={{ background: '#fff', border: '1px solid #efd9b3', borderRadius: 8, padding: 10, marginTop: 8 }}>
                <input
                  value={nuevaDireccion}
                  onChange={(e) => setNuevaDireccion(e.target.value)}
                  placeholder="Dirección"
                  style={{ ...inputBase, marginBottom: 6 }}
                />
                <select
                  value={nuevoMunicipioId}
                  onChange={(e) => setNuevoMunicipioId(e.target.value ? Number(e.target.value) : '')}
                  style={{ ...inputBase, marginBottom: 6 }}
                >
                  <option value="">Selecciona municipio...</option>
                  {municipios.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                </select>
                <input
                  value={nuevaZona}
                  onChange={(e) => setNuevaZona(e.target.value)}
                  placeholder="Zona (opcional)"
                  style={{ ...inputBase, marginBottom: 6 }}
                />
                <textarea
                  value={nuevosDatosVivienda}
                  onChange={(e) => setNuevosDatosVivienda(e.target.value)}
                  rows={2}
                  placeholder="Datos de la vivienda: acceso, planta, observaciones... (opcional)"
                  style={{ ...inputBase, height: 'auto', padding: 8, resize: 'vertical', marginBottom: 8 }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button onClick={() => setMostrandoFormDomicilio(false)} style={botonSecundario}>Cancelar</button>
                  <button onClick={handleCrearDomicilio} style={botonNaranja}>Guardar domicilio</button>
                </div>
              </div>
            )}
          </Campo>
          </div>

          <div style={bloqueColor.azul}>
          <div style={{ display: 'flex', gap: 10 }}>
            <Campo etiqueta="Tipo de nota" flex>
              <SelectorConBusqueda opciones={tiposNota} valor={tipoNotaId} onChange={setTipoNotaId} borderColor="#c9cef7" />
            </Campo>
            <Campo etiqueta="Asignada" flex>
              <SelectorConBusqueda opciones={asignados} valor={asignadoId} onChange={setAsignadoId} borderColor="#c9cef7" />
            </Campo>
          </div>

          <Campo etiqueta="Fecha de entrada">
            <input type="date" value={fechaEntrada} onChange={(e) => setFechaEntrada(e.target.value)} style={{ ...inputBase, border: '1px solid #c9cef7', background: '#fff' }} />
          </Campo>

          <Campo etiqueta="Observaciones">
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={3}
              placeholder="Describe el trabajo o aviso"
              style={{ ...inputBase, height: 'auto', padding: 8, resize: 'vertical', border: '1px solid #c9cef7', background: '#fff' }}
            />
          </Campo>

          <Campo etiqueta="Llevar">
            <SelectorConBusqueda opciones={llevarOpciones} valor={llevarId} onChange={setLlevarId} borderColor="#c9cef7" />
          </Campo>

          <div style={{ display: 'flex', gap: 10 }}>
            <Campo etiqueta="Día de cita" flex>
              <input type="date" value={diaCita} onChange={(e) => setDiaCita(e.target.value)} style={{ ...inputBase, border: '1px solid #c9cef7', background: '#fff' }} />
            </Campo>
            <Campo etiqueta="Hora" flex>
              <input type="time" value={horaCita} onChange={(e) => setHoraCita(e.target.value)} style={{ ...inputBase, border: '1px solid #c9cef7', background: '#fff' }} />
            </Campo>
          </div>
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
    </div>
  )
}

function formatearFechaDetalle(iso: string | null) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function FilaResumen({ etiqueta, valor, resaltada }: { etiqueta: string; valor: React.ReactNode; resaltada?: boolean }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', padding: '10px 8px', borderBottom: '1px solid #EEF0FB',
      fontSize: 13, background: resaltada ? '#F6F7FE' : 'transparent', borderRadius: 6,
    }}>
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
  const [enviandoCalendario, setEnviandoCalendario] = useState(false)
  const [avisoCalendario, setAvisoCalendario] = useState<{ tipo: 'ok' | 'error'; mensaje: string } | null>(null)

  async function handleEnviarCalendario() {
    setEnviandoCalendario(true)
    setAvisoCalendario(null)
    try {
      await enviarNotaACalendarioAction(nota.id)
      setAvisoCalendario({ tipo: 'ok', mensaje: 'Enviado al calendario correctamente, con el PDF adjunto.' })
    } catch (err: any) {
      setAvisoCalendario({ tipo: 'error', mensaje: err?.message || 'No se pudo enviar al calendario. Inténtalo de nuevo.' })
    } finally {
      setEnviandoCalendario(false)
    }
  }

  return (
    <div style={overlayStyle}>
      <div style={{ ...modalStyle, width: 480, padding: 0, overflowY: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{
          background: 'linear-gradient(135deg, #3441E0 0%, #2230B8 100%)',
          padding: '20px 24px', position: 'relative', flexShrink: 0,
        }}>
          <div style={{ position: 'absolute', top: 12, right: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            {nota.clientes?.nombre && (
              <a
                href={`/clientes?buscar=${encodeURIComponent(nota.clientes.nombre)}${nota.numero_nota ? `&nota=${nota.numero_nota}` : ''}`}
                style={{
                  height: 26, padding: '0 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.4)',
                  background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 12,
                  display: 'inline-flex', alignItems: 'center', textDecoration: 'none',
                }}
              >
                Ver cliente
              </a>
            )}
            <button onClick={onCerrar} style={{ ...botonCerrar, color: '#fff', background: 'rgba(255,255,255,0.15)', borderRadius: '50%' }}>×</button>
          </div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 500, color: '#fff' }}>Nota {nota.numero_nota ?? nota.id}</h2>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', margin: '4px 0 0', letterSpacing: '0.5px' }}>
            {nota.tipo_notas?.nombre ?? 'Sin tipo'}
          </p>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
        <div style={{ padding: '8px 24px 0' }}>
          <FilaResumen etiqueta="Cliente" valor={nota.clientes?.nombre} resaltada />
          <FilaResumen
            etiqueta="Domicilio"
            valor={nota.domicilios ? `${nota.domicilios.direccion} — ${nota.domicilios.municipios?.nombre ?? ''}` : '—'}
          />
          <FilaResumen etiqueta="Asignada" valor={nota.asignados?.nombre} resaltada />
          <FilaResumen etiqueta="Llevar" valor={nota.llevar_opciones?.nombre} />
          <FilaResumen
            etiqueta="Fecha cita"
            valor={`${formatearFechaDetalle(nota.dia_cita)}${nota.hora_cita ? ' · ' + nota.hora_cita.slice(0, 5) : ''}`}
            resaltada
          />
        </div>

        {nota.observaciones && (
          <div style={{ margin: '0 24px', paddingTop: 12, borderTop: '1px solid #e5e7eb' }}>
            <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 4px' }}>Observaciones</p>
            <p style={{ fontSize: 13, color: '#1c2230', margin: '0 0 12px', whiteSpace: 'pre-wrap' }}>{nota.observaciones}</p>
          </div>
        )}
        </div>

        {avisoCalendario && (
          <div style={{
            margin: '0 24px 12px', padding: '8px 12px', borderRadius: 8, fontSize: 12,
            background: avisoCalendario.tipo === 'error' ? '#FCEBEB' : '#E9F5EF',
            border: `1px solid ${avisoCalendario.tipo === 'error' ? '#F09595' : '#CDE9DC'}`,
            color: avisoCalendario.tipo === 'error' ? '#791F1F' : '#0F6E56',
          }}>
            {avisoCalendario.mensaje}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '16px 24px', borderTop: '1px solid #e5e7eb', flexShrink: 0 }}>
          {nota.dia_cita && nota.hora_cita && (
            <button onClick={handleEnviarCalendario} disabled={enviandoCalendario} style={botonSecundario}>
              {enviandoCalendario ? 'Enviando...' : '📅 Enviar al calendario'}
            </button>
          )}
          <button onClick={onEditar} style={botonPrimario}>Editar</button>
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

// Combobox simple: un input de texto que filtra la lista de opciones mientras
// se escribe, en vez de un <select> nativo largo sin buscador. Al elegir una
// opción (clic o Enter sobre la única que queda), se cierra y queda fijada.
function SelectorConBusqueda({
  opciones, valor, onChange, placeholder, borderColor,
}: {
  opciones: Opcion[]
  valor: number | ''
  onChange: (id: number | '') => void
  placeholder?: string
  borderColor?: string
}) {
  const opcionActual = opciones.find((o) => o.id === valor)
  const [abierto, setAbierto] = useState(false)
  const [texto, setTexto] = useState('')
  const contenedorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function alClicFuera(e: MouseEvent) {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) {
        setAbierto(false)
        setTexto('')
      }
    }
    document.addEventListener('mousedown', alClicFuera)
    return () => document.removeEventListener('mousedown', alClicFuera)
  }, [])

  const filtradas = texto.trim()
    ? opciones.filter((o) => o.nombre.toLowerCase().includes(texto.trim().toLowerCase()))
    : opciones

  return (
    <div ref={contenedorRef} style={{ position: 'relative' }}>
      <input
        type="text"
        value={abierto ? texto : (opcionActual?.nombre ?? '')}
        onChange={(e) => { setTexto(e.target.value); setAbierto(true) }}
        onFocus={() => { setTexto(''); setAbierto(true) }}
        placeholder={placeholder ?? 'Selecciona...'}
        style={{
          width: '100%', height: 36, borderRadius: 8, border: `1px solid ${borderColor ?? '#d1d5db'}`,
          padding: '0 10px', fontSize: 13, boxSizing: 'border-box', background: '#fff',
        }}
      />
      {abierto && (
        <div style={{
          position: 'absolute', zIndex: 30, top: 38, left: 0, right: 0, background: '#fff',
          border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          maxHeight: 220, overflowY: 'auto',
        }}>
          {valor !== '' && (
            <div
              onClick={() => { onChange(''); setAbierto(false); setTexto('') }}
              style={{ padding: '8px 10px', fontSize: 13, cursor: 'pointer', color: '#9ca3af', borderBottom: '1px solid #f0f0f0' }}
            >
              Sin selección
            </div>
          )}
          {filtradas.length === 0 && (
            <div style={{ padding: '8px 10px', fontSize: 13, color: '#9ca3af' }}>Sin resultados</div>
          )}
          {filtradas.map((o) => (
            <div
              key={o.id}
              onClick={() => { onChange(o.id); setAbierto(false); setTexto('') }}
              style={{
                padding: '8px 10px', fontSize: 13, cursor: 'pointer',
                background: o.id === valor ? '#f0f2fd' : 'transparent',
              }}
            >
              {o.nombre}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const inputBase: React.CSSProperties = {
  width: '100%', height: 36, borderRadius: 8, border: '1px solid #d1d5db', padding: '0 10px', fontSize: 13, boxSizing: 'border-box',
}
const botonPrimario: React.CSSProperties = {
  height: 36, padding: '0 16px', borderRadius: 8, border: 'none', background: '#3441E0', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer',
}
const botonVerde: React.CSSProperties = {
  height: 36, padding: '0 16px', borderRadius: 8, border: 'none', background: '#1D9E75', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer',
}
const botonNaranja: React.CSSProperties = {
  height: 36, padding: '0 16px', borderRadius: 8, border: 'none', background: '#BA7517', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer',
}
const botonSecundario: React.CSSProperties = {
  height: 30, padding: '0 12px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', fontSize: 12, cursor: 'pointer',
}
const botonSecundarioVerde: React.CSSProperties = {
  height: 30, padding: '0 12px', borderRadius: 8, border: '1px solid #1D9E75', background: '#fff', color: '#0F6E56', fontSize: 12, cursor: 'pointer',
}
const botonSecundarioNaranja: React.CSSProperties = {
  height: 30, padding: '0 12px', borderRadius: 8, border: '1px solid #BA7517', background: '#fff', color: '#854F0B', fontSize: 12, cursor: 'pointer',
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
const bloqueColor = {
  verde: { borderLeft: '3px solid #1D9E75', background: '#F2FAF6', borderRadius: 8, padding: '12px' } as React.CSSProperties,
  naranja: { borderLeft: '3px solid #BA7517', background: '#FBF3E6', borderRadius: 8, padding: '12px' } as React.CSSProperties,
  azul: { borderLeft: '3px solid #3441E0', background: '#F0F2FD', borderRadius: 8, padding: '12px', display: 'flex', flexDirection: 'column', gap: 10 } as React.CSSProperties,
}
