import { cargarOrdenes, cargarTipologiasParaOrdenes, cargarColoresParaOrdenes, cargarTiposTuboParaOrdenes } from './actions'
import OrdenesExplorer from './OrdenesExplorer'
import CabeceraSeccion from '@/components/CabeceraSeccion'

export default async function OrdenesPage() {
  const [ordenes, tipologias, colores, tiposTubo] = await Promise.all([
    cargarOrdenes(),
    cargarTipologiasParaOrdenes(),
    cargarColoresParaOrdenes(),
    cargarTiposTuboParaOrdenes(),
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
        tiposTubo={tiposTubo}
      />
    </div>
  )
}
