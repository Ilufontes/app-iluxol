import { cargarReglasStockMinimo } from './actions'
import { cargarCatalogoPerfiles } from '../catalogo-perfiles/actions'
import { cargarColoresParaOrdenes } from '../ordenes/actions'
import StockMinimoExplorer from './StockMinimoExplorer'
import CabeceraSeccion from '@/components/CabeceraSeccion'

export default async function StockMinimoPage() {
  const [reglas, catalogo, colores] = await Promise.all([
    cargarReglasStockMinimo(), cargarCatalogoPerfiles(), cargarColoresParaOrdenes(),
  ])
  return (
    <div>
      <CabeceraSeccion
        color="naranja"
        titulo="Stock mínimo"
        subtitulo="Elige qué barras quieres vigilar: el menú de inicio avisará cuando bajen del mínimo"
      />
      <StockMinimoExplorer reglasIniciales={reglas} catalogo={catalogo.filter(c => c.activo)} colores={colores.filter(c => c.activo)} />
    </div>
  )
}
