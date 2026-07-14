import { cargarColoresParaOrdenes, cargarTiposTubo } from '../actions'
import AjustesOrdenesExplorer from './AjustesOrdenesExplorer'
import CabeceraSeccion from '@/components/CabeceraSeccion'

export default async function AjustesOrdenesPage() {
  const [colores, tiposTubo] = await Promise.all([
    cargarColoresParaOrdenes(),
    cargarTiposTubo(),
  ])
  return (
    <div>
      <CabeceraSeccion
        color="naranja"
        titulo="Ajustes de órdenes"
        subtitulo="Colores y tipos de tubo disponibles"
      />
      <AjustesOrdenesExplorer coloresIniciales={colores} tiposTuboIniciales={tiposTubo} />
    </div>
  )
}
