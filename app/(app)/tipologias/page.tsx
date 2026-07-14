import { cargarTipologias } from './actions'
import TipologiasExplorer from './TipologiasExplorer'
import CabeceraSeccion from '@/components/CabeceraSeccion'

export default async function TipologiasPage() {
  const tipologias = await cargarTipologias()

  return (
    <div>
      <CabeceraSeccion
        color="naranja"
        titulo="Tipologías"
        subtitulo="Plantillas de productos con perfiles y fórmulas de corte"
      />
      <TipologiasExplorer tipologiasIniciales={tipologias} />
    </div>
  )
}
