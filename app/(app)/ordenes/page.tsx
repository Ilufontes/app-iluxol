import { cargarOrdenes, cargarTipologiasParaOrdenes, cargarColoresParaOrdenes } from './actions'
import OrdenesExplorer from './OrdenesExplorer'
import CabeceraSeccion from '@/components/CabeceraSeccion'

export default async function OrdenesPage() {
  const [ordenes, tipologias, colores] = await Promise.all([
    cargarOrdenes(),
    cargarTipologiasParaOrdenes(),
    cargarColoresParaOrdenes(),
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
