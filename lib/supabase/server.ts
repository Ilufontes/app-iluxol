import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

type CookieParaEstablecer = {
  name: string
  value: string
  options?: Parameters<Awaited<ReturnType<typeof cookies>>['set']>[2]
}

// Cliente para usar en el servidor: páginas, server actions, rutas de API.
// Next.js no permite escribir cookies desde un Server Component normal,
// así que los errores al hacer "set" dentro de uno se ignoran a propósito;
// el middleware (middleware.ts) es quien realmente refresca la sesión.
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: CookieParaEstablecer[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Se llama desde un Server Component: se ignora,
            // el middleware se encarga de refrescar la sesión.
          }
        },
      },
    }
  )
}
