import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      const adminSupabase = createAdminClient()

      // Ensure a profile row exists
      await adminSupabase.from('profiles').upsert(
        {
          id: data.user.id,
          email: data.user.email!,
          name: data.user.user_metadata?.full_name ?? data.user.email!.split('@')[0],
        },
        { onConflict: 'id', ignoreDuplicates: true }
      )

      // Link any pending group_members records that were invited by this email
      await adminSupabase
        .from('group_members')
        .update({ user_id: data.user.id, invited_email: null })
        .eq('invited_email', data.user.email!)
        .is('user_id', null)

      const redirectPath = next.startsWith('/') ? next : '/dashboard'
      return NextResponse.redirect(`${origin}${redirectPath}`)
    }
  }

  // Auth failed — redirect to login with an error indicator
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
