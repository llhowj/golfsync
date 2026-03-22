'use client'

import { createClient } from '@/lib/supabase/client'

/**
 * Wrapper around fetch that includes the Supabase access token in the
 * Authorization header. Use this for all API calls from client components
 * so the server can authenticate the request reliably.
 */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()

  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
  })
}
