import { chromium } from 'playwright'
import { ScrapedSlot } from './types'

const BOOKING_URL = 'https://crystalsprings.totaleintegrated.net/web/tee-times'

// Returns all available tee times on the Crystal Springs booking page.
// Navigates forward day-by-day using the chevron_right arrow until it is disabled
// (the site enforces the booking window — ~14 days for members).
// Pure function: no DB calls, no HTTP calls beyond the target site.
export async function scrapeTeeTimes(): Promise<ScrapedSlot[]> {
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  const browser = await chromium.launch({
    headless: true,
    executablePath: executablePath || undefined,
  })
  const slots: ScrapedSlot[] = []

  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    })
    const page = await context.newPage()

    await page.goto(BOOKING_URL, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(4000)

    // The page defaults to today's date. Scrape each available day.
    const maxDays = 21 // safety limit
    for (let day = 0; day < maxDays; day++) {
      // Read the currently-selected date from the input
      const dateLabel = await page.locator('#a-teetime-date-picker').inputValue()
      const dateStr = parseDateLabel(dateLabel)

      if (!dateStr) {
        console.error('[scraper] Could not parse date label:', dateLabel)
        break
      }

      // Click Search and wait for results
      await page.locator('#a-tee-times-search').click()
      await page.waitForTimeout(3000)

      // Extract cards for this date
      const daySlots = await extractSlots(page, dateStr)
      slots.push(...daySlots)
      console.log(`[scraper] ${dateStr}: ${daySlots.length} slot(s)`)

      // Advance to the next day — stop if the right arrow is disabled (end of booking window)
      const nextBtn = page.locator('button.a-date-arrow').last()
      const isDisabled = await nextBtn.evaluate(el => (el as HTMLElement).classList.contains('mat-button-disabled'))
      if (isDisabled) {
        console.log('[scraper] Reached end of booking window.')
        break
      }
      await nextBtn.click()
      await page.waitForTimeout(800)
    }
  } finally {
    await browser.close()
  }

  return slots
}

async function extractSlots(
  page: import('playwright').Page,
  dateStr: string,
): Promise<ScrapedSlot[]> {
  const slots: ScrapedSlot[] = []
  const cards = await page.locator('mat-card.o-card-teetime').all()

  for (const card of cards) {
    try {
      // Time: ".a-teetime-time" contains text like "5:21 PM"
      const timeText = (await card.locator('.a-teetime-time').innerText()).trim()
      const timeMatch = timeText.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i)
      if (!timeMatch) continue

      let hour = parseInt(timeMatch[1], 10)
      const minute = parseInt(timeMatch[2], 10)
      const ampm = timeMatch[3].toUpperCase()
      if (ampm === 'PM' && hour !== 12) hour += 12
      if (ampm === 'AM' && hour === 12) hour = 0
      const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`

      // Players: ".m-tee-time-player-container" text is like "person2-4" or "person4"
      const playerText = (await card.locator('.m-tee-time-player-container').innerText()).trim()
      const playerClean = playerText.replace(/person/gi, '').trim()
      const rangeMatch = playerClean.match(/(\d+)-(\d+)/)
      const singleMatch = playerClean.match(/^(\d+)$/)
      let availableSlots = 4
      if (rangeMatch) {
        availableSlots = parseInt(rangeMatch[2], 10)
      } else if (singleMatch) {
        availableSlots = parseInt(singleMatch[1], 10)
      }

      // Course name: first span in ".a-timetime-course"
      const courseText = (await card.locator('.a-timetime-course span').first().innerText()).trim()
      const course = courseText || 'Crystal Springs'

      // Only Crystal Springs (not Sequoia)
      if (!course.toLowerCase().includes('crystal springs')) continue

      slots.push({ date: dateStr, time, course, availableSlots })
    } catch {
      // Skip cards that don't parse cleanly
    }
  }

  return slots
}

// Parse "Wed, Mar 25, 2026" → "2026-03-25"
function parseDateLabel(label: string): string | null {
  try {
    // Angular date picker value format: "Wed, Mar 25, 2026"
    const date = new Date(label)
    if (isNaN(date.getTime())) return null
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  } catch {
    return null
  }
}
