'use server'

import { createClient } from '@/lib/supabase/server'

export async function contarCitasDelDia(fechaISO: string) {
  const supabase = await createClient()
  const { count } = await supabase
    .from('notas')
    .select('*', { count: 'exact', head: true })
    .eq('dia_cita', fechaISO)

  return count ?? 0
}
