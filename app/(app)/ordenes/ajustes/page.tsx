import { cargarColoresParaOrdenes, cargarTiposTubo } from '../actions'
import { cargarCatalogoPerfiles } from '../../catalogo-perfiles/actions'
import AjustesOrdenesExplorer from './AjustesOrdenesExplorer'
import CabeceraSeccion from '@/components/CabeceraSeccion'

export default async function AjustesOrdenesPage() {
  const [colores, tiposTubo, catalogo] = await Promise.all([
    cargarColoresParaOrdenes(),
    cargarTiposTubo(),
    cargarCatalogoPerfiles(),
  ])
  return (
    <div>
      <CabeceraSeccion
        color="naranja"
        titulo="Ajustes de órdenes"
        subtitulo="Colores y tipos de tubo disponibles (con su referencia de catálogo)"
      />
      <AjustesOrdenesExplorer coloresIniciales={colores} tiposTuboIniciales={tiposTubo} catalogo={catalogo} />
    </div>
  )
}
