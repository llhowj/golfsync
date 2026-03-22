import { type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

/**
 * Gets the authenticated user from a request via Bearer token in the
 * Authorization header. Uses the admin client so no cookies are needed,
 * which works reliably in Vercel serverless Route Handlers.
 */
export async function getUserFromRequest(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const supabase = createAdminClient()
    const { data: { user } } = await supabase.auth.getUser(token)
    if (user) return user
  }
  return null
}
