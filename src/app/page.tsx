import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export default async function LandingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect('/dashboard')
  }

  return (
    <div className="flex flex-col min-h-full">
      {/* Nav */}
      <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">⛳</span>
            <span className="text-xl font-bold tracking-tight">GolfSync</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className={cn(buttonVariants({ variant: 'ghost' }))}
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className={cn(buttonVariants({ variant: 'default' }))}
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col">
        <section className="flex-1 flex flex-col items-center justify-center text-center px-4 py-20 sm:py-32 bg-gradient-to-b from-background to-muted/40">
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-1.5 text-sm text-muted-foreground">
              <span className="text-green-600 font-medium">New</span>
              Tee time coordination, simplified
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-tight">
              Keep your golf group{' '}
              <span className="text-green-600">in sync</span>
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              GolfSync helps golf groups coordinate tee times, manage RSVPs, and
              fill open slots automatically — so your foursome is always full.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Link
                href="/register"
                className={cn(
                  buttonVariants({ size: 'lg' }),
                  'w-full sm:w-auto',
                )}
              >
                Get Started Free
              </Link>
              <Link
                href="/login"
                className={cn(
                  buttonVariants({ variant: 'outline', size: 'lg' }),
                  'w-full sm:w-auto',
                )}
              >
                Sign In
              </Link>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-20 px-4 bg-muted/30">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold text-center mb-12">
              Everything your golf group needs
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
              <div className="flex flex-col items-center text-center gap-3 p-6 rounded-xl bg-background border border-border">
                <div className="text-4xl">📅</div>
                <h3 className="font-semibold text-lg">Easy Scheduling</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Post tee times in seconds. Your group gets notified instantly
                  and can RSVP with one tap.
                </p>
              </div>
<div className="flex flex-col items-center text-center gap-3 p-6 rounded-xl bg-background border border-border">
                <div className="text-4xl">📊</div>
                <h3 className="font-semibold text-lg">Group Insights</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Track attendance history and RSVP patterns to keep your group
                  organized all season.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} GolfSync. All rights reserved.</p>
      </footer>
    </div>
  )
}
