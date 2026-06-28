import { createBrowserClient } from '@supabase/ssr'

// Cliente para usar dentro de componentes que se ejecutan en el navegador
// (cualquier archivo que empiece con 'use client').
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
