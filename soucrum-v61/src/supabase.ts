import { createClient } from '@supabase/supabase-js'

/**
 * Projeto v6.1 (njlnvcrcoebbednfrzhr). A chave é a *publicável* — feita para
 * viver no navegador. Toda proteção real vem da RLS no banco, não de esconder
 * esta string. A `service_role` nunca entra aqui.
 *
 * Aceita override por env para dar para apontar em outro projeto sem recompilar
 * o código à mão.
 */
export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ?? 'https://njlnvcrcoebbednfrzhr.supabase.co'

export const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'sb_publishable_IgYK8FpeOWNcYdGdiU065w_ibLgOaMu'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})
