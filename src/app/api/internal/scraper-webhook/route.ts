import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendMatchAlertSms, sendGoneAlertSms } from '@/lib/sms'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

interface ScrapedSlot {
  date: string        // 'YYYY-MM-DD'
  time: string        // 'HH:MM'
  course: string
  availableSlots: number
}

function verifyScraperSecret(request: NextRequest): boolean {
  const secret = process.env.SCRAPER_WEBHOOK_SECRET
  if (!secret) return false
  const auth = request.headers.get('authorization') ?? ''
  return auth === `Bearer ${secret}`
}

// POST /api/internal/scraper-webhook
export async function POST(request: NextRequest) {
  if (!verifyScraperSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let slots: ScrapedSlot[]
  try {
    const body = await request.json()
    slots = body.slots ?? []
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // Load all active watches
  const { data: watches } = await db
    .from('tee_time_watches')
    .select('id, group_id, created_by, days_of_week, earliest_time, latest_time, min_slots, mode, repeat')
    .eq('is_active', true)

  if (!watches || watches.length === 0) {
    return NextResponse.json({ processed: 0, newAlerts: 0, goneAlerts: 0 })
  }

  // Load all pending alerts (to detect gone slots)
  const watchIds = watches.map((w: { id: string }) => w.id)
  const { data: pendingAlerts } = await db
    .from('watch_alerts')
    .select('id, watch_id, scraped_date, scraped_time, scraped_course, group_id')
    .in('watch_id', watchIds)
    .eq('status', 'pending')

  // Build a set of currently-live slot keys
  const liveSlotKeys = new Set(slots.map((s) => `${s.date}|${s.time}`))

  let newAlerts = 0
  let goneAlerts = 0

  // 1. Find pending alerts whose slot is no longer live → mark gone
  for (const alert of (pendingAlerts ?? [])) {
    const key = `${alert.scraped_date}|${alert.scraped_time}`
    if (!liveSlotKeys.has(key)) {
      await db
        .from('watch_alerts')
        .update({ status: 'gone', gone_at: new Date().toISOString() })
        .eq('id', alert.id)

      // Send "gone" SMS to the watch creator
      const adminPhone = await getAdminPhone(supabase, alert.group_id, alert.watch_id)
      if (adminPhone) {
        await sendGoneAlertSms(adminPhone, {
          date: alert.scraped_date,
          time: alert.scraped_time,
          course: alert.scraped_course,
        })
      }
      goneAlerts++
    } else {
      // Still live — update last_seen_at
      await db
        .from('watch_alerts')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', alert.id)
    }
  }

  // 2. Check each slot against each watch for new matches
  for (const slot of slots) {
    const slotDayOfWeek = new Date(slot.date + 'T00:00:00').getDay()
    const slotTime = slot.time.slice(0, 5) // 'HH:MM'

    for (const watch of watches) {
      // Day of week match
      if (!watch.days_of_week.includes(slotDayOfWeek)) continue

      // Time window match
      if (slotTime < watch.earliest_time.slice(0, 5)) continue
      if (slotTime > watch.latest_time.slice(0, 5)) continue

      // Min slots match
      if (slot.availableSlots < watch.min_slots) continue

      // Check if an active alert already exists for this watch+date+time
      const alreadyAlerted = (pendingAlerts ?? []).some(
        (a: { watch_id: string; scraped_date: string; scraped_time: string }) =>
          a.watch_id === watch.id &&
          a.scraped_date === slot.date &&
          a.scraped_time === slotTime,
      )
      if (alreadyAlerted) continue

      // Insert new alert
      const { data: newAlert, error: insertError } = await db
        .from('watch_alerts')
        .insert({
          watch_id: watch.id,
          group_id: watch.group_id,
          scraped_date: slot.date,
          scraped_time: slotTime,
          scraped_course: slot.course,
          available_slots: slot.availableSlots,
        })
        .select()
        .single()

      if (insertError) {
        // Unique constraint violation = already exists, skip
        if (insertError.code !== '23505') {
          console.error('[webhook] insert alert error:', insertError.message)
        }
        continue
      }

      // Send match SMS
      const adminPhone = await getAdminPhone(supabase, watch.group_id, watch.id)
      if (adminPhone) {
        const watchPageUrl = `${APP_URL}/watch?g=${watch.group_id}`
        const smsSid = await sendMatchAlertSms(adminPhone, slot, watchPageUrl)
        if (smsSid) {
          await db.from('watch_alerts').update({ sms_sid: smsSid }).eq('id', newAlert.id)
        }
      }

      // Deactivate one-time watches after first match
      if (!watch.repeat) {
        await db.from('tee_time_watches').update({ is_active: false }).eq('id', watch.id)
      }

      newAlerts++
    }
  }

  return NextResponse.json({ processed: slots.length, newAlerts, goneAlerts })
}

async function getAdminPhone(
  supabase: ReturnType<typeof createAdminClient>,
  groupId: string,
  watchId: string,
): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { data: watch } = await db
    .from('tee_time_watches')
    .select('created_by')
    .eq('id', watchId)
    .maybeSingle()

  if (!watch?.created_by) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('phone')
    .eq('id', watch.created_by)
    .maybeSingle()

  return profile?.phone ?? null
}
