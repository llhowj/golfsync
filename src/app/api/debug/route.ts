import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'not authenticated', userError })
  }

  const { data: member, error: memberError } = await supabase
    .from('group_members')
    .select('id, group_id, is_admin, player_type')
    .eq('user_id', user.id)
    .maybeSingle()

  return NextResponse.json({ userId: user.id, member, memberError })
}
