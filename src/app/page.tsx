import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

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
      <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">⛳</span>
            <span className="text-xl font-bold tracking-tight">GolfSync</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="inline-flex items-center justify-center rounded-lg px-3 h-8 text-sm font-medium hover:bg-muted transition-colors">
              Sign In
            </Link>
            <Link href="/register" className="inline-flex items-center justify-center rounded-lg px-3 h-8 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
              Get Started Free
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        {/* Hero */}
        <section className="flex flex-col items-center justify-center text-center px-4 py-24 sm:py-36 bg-gradient-to-b from-background to-muted/40">
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-1.5 text-sm text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-green-500 inline-block" />
              Free for golf groups of any size
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-tight">
              Stop the group chat chaos.{' '}
              <span className="text-green-600">Sync your tee times.</span>
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              GolfSync gives your golf group one place to post rounds, collect RSVPs, fill open
              slots, and keep everyone on the same page — no more back-and-forth texts.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Link
                href="/register"
                className="inline-flex items-center justify-center rounded-lg px-6 h-11 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors w-full sm:w-auto"
              >
                Start Organizing for Free
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-lg px-6 h-11 text-sm font-medium border border-border bg-background hover:bg-muted transition-colors w-full sm:w-auto"
              >
                Sign In to My Dashboard
              </Link>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-20 px-4 bg-muted/30">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold text-center mb-4">
              Everything your group needs, nothing it doesn&apos;t
            </h2>
            <p className="text-center text-muted-foreground mb-12 max-w-xl mx-auto">
              Designed for the person who organizes the group — and for the players who just want to
              show up.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                {
                  icon: '📅',
                  title: 'Post Tee Times in Seconds',
                  body: 'Add a date, time, and course. Your whole group is notified by email instantly.',
                },
                {
                  icon: '✅',
                  title: 'One-Tap RSVPs',
                  body: 'Players confirm in or out from their email or dashboard. No app download required.',
                },
                {
                  icon: '🔄',
                  title: 'Fill Open Slots',
                  body: "When someone drops out, the admin can invite another player to fill their spot — right up to the group's size limit.",
                },
                {
                  icon: '📣',
                  title: 'Automatic Notifications',
                  body: 'Players hear about new tee times, cancellations, and RSVP changes without the admin lifting a finger.',
                },
                {
                  icon: '🗓️',
                  title: 'Propose Schedule Changes',
                  body: 'Need to move a round? Propose a new time and collect responses from the whole group before committing.',
                },
                {
                  icon: '❌',
                  title: 'Clean Cancellations',
                  body: 'Cancel a tee time with an optional note explaining why. Everyone on the invite list is notified automatically.',
                },
              ].map(({ icon, title, body }) => (
                <div
                  key={title}
                  className="flex flex-col gap-3 p-6 rounded-xl bg-background border border-border"
                >
                  <div className="text-3xl">{icon}</div>
                  <h3 className="font-semibold text-base">{title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="py-20 px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold text-center mb-4">
              Set up your group in minutes
            </h2>
            <p className="text-center text-muted-foreground mb-12 max-w-xl mx-auto">
              GolfSync is built for the organizer. Here&apos;s how to get your group running.
            </p>
            <ol className="space-y-8">
              {[
                {
                  step: '1',
                  title: 'Create a free account',
                  body: 'Sign up in under a minute. No credit card, no setup fees.',
                },
                {
                  step: '2',
                  title: 'Add your players',
                  body: "Enter your group members' names and email addresses. They'll get an invite to join GolfSync.",
                },
                {
                  step: '3',
                  title: 'Post your first tee time',
                  body: 'Choose a date, time, and course. Your players are notified and can RSVP right from their inbox.',
                },
                {
                  step: '4',
                  title: 'Manage from your dashboard',
                  body: 'See who\'s in, who\'s out, and who hasn\'t responded yet. Fill open slots or cancel with a single click.',
                },
              ].map(({ step, title, body }) => (
                <li key={step} className="flex gap-5">
                  <div className="shrink-0 h-9 w-9 rounded-full bg-green-600 text-white flex items-center justify-center font-bold text-sm">
                    {step}
                  </div>
                  <div className="pt-1">
                    <h3 className="font-semibold mb-1">{title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="py-20 px-4 bg-green-600 text-white text-center">
          <div className="max-w-xl mx-auto space-y-5">
            <h2 className="text-2xl sm:text-3xl font-bold">Ready to stop chasing RSVPs?</h2>
            <p className="text-green-100 text-base leading-relaxed">
              Join golf groups already using GolfSync to keep their rounds organized. It&apos;s free
              to get started.
            </p>
            <Link
              href="/register"
              className="inline-flex items-center justify-center rounded-lg bg-white text-green-700 font-semibold px-8 py-3 text-sm hover:bg-green-50 transition-colors"
            >
              Create Your Free Account
            </Link>
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
