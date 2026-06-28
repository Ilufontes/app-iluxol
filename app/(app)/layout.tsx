import Sidebar from '@/components/Sidebar'
import { createClient } from '@/lib/supabase/server'

// Este layout envuelve todas las pantallas internas (Notas, Clientes, Ajustes...).
// El middleware ya garantiza que solo llega aquí un empleado con sesión activa,
// pero leemos sus datos para mostrar su nombre en la barra lateral.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let nombreEmpleado = user?.email ?? ''
  if (user) {
    const { data: perfil } = await supabase
      .from('perfiles')
      .select('nombre_completo')
      .eq('id', user.id)
      .single()
    if (perfil?.nombre_completo) nombreEmpleado = perfil.nombre_completo
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar nombreEmpleado={nombreEmpleado} />
      <main style={{ flex: 1, padding: '2rem 2.5rem', maxWidth: 1100 }}>
        {children}
      </main>
    </div>
  )
}
