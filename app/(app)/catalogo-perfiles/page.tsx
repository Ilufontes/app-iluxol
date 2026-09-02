import { cargarCatalogoPerfiles } from './actions'
import CatalogoPerfilesExplorer from './CatalogoPerfilesExplorer'
import CabeceraSeccion from '@/components/CabeceraSeccion'

export default async function CatalogoPerfilesPage() {
  const perfiles = await cargarCatalogoPerfiles()

  return (
    <div>
      <CabeceraSeccion
        color="naranja"
        titulo="Catálogo de Perfiles"
        subtitulo="Referencia y descripción de cada perfil. Se usa para vincular las tipologías con el inventario."
      />
      <CatalogoPerfilesExplorer perfilesIniciales={perfiles} />
    </div>
  )
}
