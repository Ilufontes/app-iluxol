import { cargarOrdenes } from './actions'
import { cargarTipologias, cargarColores } from '../tipologias/actions'
import OrdenesExplorer from './OrdenesExplorer'
import CabeceraSeccion from '@/components/CabeceraSeccion'

export default async function OrdenesPage() {
  const [ordenes, tipologias, colores] = await Promise.all([
    cargarOrdenes(),
    cargarTipologias(),
    cargarColores(),
  ])

  return (
    <div>
      <CabeceraSeccion
        color="naranja"
        titulo="Órdenes de trabajo"
        subtitulo="Despiece calculado a partir de tipologías y medidas"
      />
      <OrdenesExplorer
        ordenesIniciales={ordenes}
        tipologias={tipologias}
        colores={colores}
      />
    </div>
  )
}
