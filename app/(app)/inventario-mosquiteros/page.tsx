import { cargarStockPerfiles, cargarCatalogoParaInventario, cargarColoresParaInventario, cargarEstantesParaInventario } from './actions'
import InventarioMosquiterosExplorer from './InventarioMosquiterosExplorer'
import CabeceraSeccion from '@/components/CabeceraSeccion'

export default async function InventarioMosquiterosPage() {
  const [stock, catalogo, colores, estantes] = await Promise.all([
    cargarStockPerfiles(),
    cargarCatalogoParaInventario(),
    cargarColoresParaInventario(),
    cargarEstantesParaInventario(),
  ])

  return (
    <div>
      <CabeceraSeccion
        color="naranja"
        titulo="Inventario Mosquiteros"
        subtitulo="Stock físico de perfiles (barras y retales) para optimizar el material de las órdenes"
      />
      <InventarioMosquiterosExplorer
        stockInicial={stock}
        catalogo={catalogo}
        colores={colores}
        estantes={estantes}
      />
    </div>
  )
}
