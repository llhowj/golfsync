import { scrapeTeeTimes } from './scraper'

const WEBHOOK_URL = process.env.GOLFSYNC_WEBHOOK_URL
const SCRAPER_SECRET = process.env.SCRAPER_SECRET

async function run() {
  if (!WEBHOOK_URL || !SCRAPER_SECRET) {
    console.error('[scraper] Missing GOLFSYNC_WEBHOOK_URL or SCRAPER_SECRET env vars')
    process.exit(1)
  }

  console.log(`[scraper] Starting scrape at ${new Date().toISOString()}`)

  let slots
  try {
    slots = await scrapeTeeTimes()
    console.log(`[scraper] Found ${slots.length} available slots`)
  } catch (err) {
    console.error('[scraper] Scrape failed:', err instanceof Error ? err.message : err)
    process.exit(1)
  }

  try {
    const res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SCRAPER_SECRET}`,
      },
      body: JSON.stringify({ slots }),
    })

    if (!res.ok) {
      const body = await res.text()
      console.error(`[scraper] Webhook returned ${res.status}: ${body}`)
      process.exit(1)
    }

    const result = await res.json() as { newAlerts: number; goneAlerts: number }
    console.log(`[scraper] Webhook OK — new alerts: ${result.newAlerts}, gone: ${result.goneAlerts}`)
  } catch (err) {
    console.error('[scraper] Webhook call failed:', err instanceof Error ? err.message : err)
    process.exit(1)
  }
}

run()
