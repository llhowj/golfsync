import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getUserFromRequest } from '@/lib/get-user'

// GET /api/watches/[id]/alerts
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: watch } = await (supabase as any)
    .from('tee_time_watches')
    .select('id, group_id')
    .eq('id', id)
    .maybeSingle()

  if (!watch) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: admin } = await supabase
    .from('group_members')
    .select('id')
    .eq('group_id', watch.group_id)
    .eq('user_id', user.id)
    .eq('is_admin', true)
    .maybeSingle()

  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('watch_alerts')
    .select('*')
    .eq('watch_id', id)
    .order('first_seen_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ alerts: data ?? [] })
}
