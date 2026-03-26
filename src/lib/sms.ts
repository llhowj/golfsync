const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

function isConfigured() {
  return (
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_PHONE_NUMBER
  )
}

function logSms(to: string, body: string) {
  console.log('\n📱 [SMS — not sent locally]')
  console.log(`   To:   ${to}`)
  console.log(`   Body: ${body}`)
  console.log('')
}

function formatTime(timeStr: string): string {
  const [hourStr, minuteStr] = timeStr.split(':')
  const hour = parseInt(hourStr, 10)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 === 0 ? 12 : hour % 12
  return `${displayHour}:${minuteStr} ${ampm}`
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export async function sendMatchAlertSms(
  to: string,
  slot: { date: string; time: string; course: string; availableSlots: number },
  watchPageUrl: string,
) {
  const body =
    `⛳ Tee Time Available!\n` +
    `${formatDate(slot.date)} at ${formatTime(slot.time)}\n` +
    `${slot.course} — ${slot.availableSlots} slot${slot.availableSlots !== 1 ? 's' : ''} open\n` +
    `Book now: ${watchPageUrl}`

  if (!isConfigured()) {
    logSms(to, body)
    return null
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID!
  const authToken = process.env.TWILIO_AUTH_TOKEN!
  const from = process.env.TWILIO_PHONE_NUMBER!

  const params = new URLSearchParams({ To: to, From: from, Body: body })
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    },
  )

  if (!response.ok) {
    const err = await response.text()
    console.error('[SMS] Twilio error:', err)
    return null
  }

  const data = await response.json() as { sid: string }
  return data.sid
}

export async function sendGoneAlertSms(
  to: string,
  slot: { date: string; time: string; course: string },
) {
  const body =
    `⛳ Tee Time Gone\n` +
    `The ${formatTime(slot.time)} slot on ${formatDate(slot.date)} at ${slot.course} was taken.\n` +
    `${APP_URL}/watch — check for new openings.`

  if (!isConfigured()) {
    logSms(to, body)
    return null
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID!
  const authToken = process.env.TWILIO_AUTH_TOKEN!
  const from = process.env.TWILIO_PHONE_NUMBER!

  const params = new URLSearchParams({ To: to, From: from, Body: body })
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    },
  )

  if (!response.ok) {
    const err = await response.text()
    console.error('[SMS] Twilio error:', err)
    return null
  }

  const data = await response.json() as { sid: string }
  return data.sid
}
