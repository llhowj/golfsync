import { type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Gets the authenticated user from a request. Checks the Authorization header
 * first (Bearer token), then falls back to cookies. Returns null if not authenticated.
 */
export async function getUserFromRequest(request: NextRequest) {
  const supabase = await createClient()

  const authHeader = request.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const { data: { user } } = await supabase.auth.getUser(token)
    if (user) return user
  }

  const { data: { user } } = await supabase.auth.getUser()
  return user ?? null
}
