import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET() {
  const cookieStore = await cookies()
  const allCookies = cookieStore.getAll()
  const cookieNames = allCookies.map(c => c.name)
  const hasAuthCookie = cookieNames.some(n => n.includes('auth-token'))

  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'not authenticated', userError, cookieNames, hasAuthCookie })
  }

  const { data: member, error: memberError } = await supabase
    .from('group_members')
    .select('id, group_id, is_admin, player_type')
    .eq('user_id', user.id)
    .maybeSingle()

  return NextResponse.json({ userId: user.id, member, memberError, cookieNames })
}
