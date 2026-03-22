import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import { Navbar } from '@/components/layout/Navbar'
import { ProfileForm } from '@/components/profile/ProfileForm'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?redirectTo=/profile')
  }

  const adminSupabase = createAdminClient()
  const { data: profile } = await adminSupabase
    .from('profiles')
    .select('name, email, phone')
    .eq('id', user.id)
    .single()

  return (
    <div className="flex flex-col min-h-full">
      <Navbar user={user} />
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 sm:px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">My Profile</h1>
          <p className="text-sm text-muted-foreground">Update your name and contact info.</p>
        </div>
        <ProfileForm
          name={profile?.name ?? ''}
          email={profile?.email ?? user.email ?? ''}
          phone={profile?.phone ?? null}
        />
      </main>
    </div>
  )
}
