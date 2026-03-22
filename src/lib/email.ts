import { Resend } from 'resend'

function getResend() {
  return new Resend(process.env.RESEND_API_KEY)
}

const FROM = 'GolfSync <notifications@golfsync.app>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

function isConfigured() {
  return process.env.RESEND_API_KEY && !process.env.RESEND_API_KEY.startsWith('re_placeholder')
}

function formatDate(date: string) {
  return new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })
}

function formatTime(time: string) {
  const [h, m] = time.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`
}

interface TeeTimeEmailData {
  teeTimeId: string
  date: string
  startTime: string
  course: string
  groupName: string
}

interface Recipient {
  name: string
  email: string
}

// ── New tee time posted ────────────────────────────────────────────────────

export async function sendTeeTimePostedEmails(
  recipients: Recipient[],
  data: TeeTimeEmailData
) {
  if (!isConfigured()) {
    console.log('[email] RESEND_API_KEY not set — skipping tee_time_posted emails')
    return
  }

  const rsvpUrl = `${APP_URL}/tee-time/${data.teeTimeId}`

  const results = await Promise.allSettled(
    recipients.map(({ name, email }) =>
      getResend().emails.send({
        from: FROM,
        to: email,
        subject: `⛳ New tee time: ${formatDate(data.date)} at ${data.course}`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
            <h2 style="margin-bottom:4px">⛳ New Tee Time</h2>
            <p style="color:#666;margin-top:0">${data.groupName}</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0">
              <tr><td style="padding:8px 0;color:#666;width:80px">Date</td><td style="padding:8px 0;font-weight:600">${formatDate(data.date)}</td></tr>
              <tr><td style="padding:8px 0;color:#666">Time</td><td style="padding:8px 0;font-weight:600">${formatTime(data.startTime)}</td></tr>
              <tr><td style="padding:8px 0;color:#666">Course</td><td style="padding:8px 0;font-weight:600">${data.course}</td></tr>
            </table>
            <a href="${rsvpUrl}" style="display:inline-block;background:#18181b;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">RSVP Now</a>
            <p style="color:#999;font-size:12px;margin-top:24px">You're receiving this because you're a member of ${data.groupName} on GolfSync.</p>
          </div>
        `,
      })
    )
  )
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      console.error(`[email] Failed to send tee_time_posted to ${recipients[i].email}:`, r.reason)
    } else if (r.value.error) {
      console.error(`[email] Resend error for ${recipients[i].email}:`, r.value.error.message)
    }
  })
}

// ── Tee time cancelled ─────────────────────────────────────────────────────

export async function sendTeeTimeCancelledEmails(
  recipients: Recipient[],
  data: TeeTimeEmailData
) {
  if (!isConfigured()) {
    console.log('[email] RESEND_API_KEY not set — skipping tee_time_deleted emails')
    return
  }

  await Promise.allSettled(
    recipients.map(({ name, email }) =>
      getResend().emails.send({
        from: FROM,
        to: email,
        subject: `Cancelled: ${formatDate(data.date)} at ${data.course}`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
            <h2 style="margin-bottom:4px">❌ Tee Time Cancelled</h2>
            <p style="color:#666;margin-top:0">${data.groupName}</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0">
              <tr><td style="padding:8px 0;color:#666;width:80px">Date</td><td style="padding:8px 0">${formatDate(data.date)}</td></tr>
              <tr><td style="padding:8px 0;color:#666">Time</td><td style="padding:8px 0">${formatTime(data.startTime)}</td></tr>
              <tr><td style="padding:8px 0;color:#666">Course</td><td style="padding:8px 0">${data.course}</td></tr>
            </table>
            <p>This tee time has been cancelled. No action needed.</p>
          </div>
        `,
      })
    )
  )
}

// ── Admin: 48-hour deadline alert ─────────────────────────────────────────

export async function sendDeadlineAlert(
  admin: Recipient,
  data: TeeTimeEmailData,
  openSlots: number
) {
  if (!isConfigured()) {
    console.log('[email] RESEND_API_KEY not set — skipping deadline_alert email')
    return
  }

  const dashboardUrl = `${APP_URL}/dashboard`

  await getResend().emails.send({
    from: FROM,
    to: admin.email,
    subject: `⚠️ 48-hour deadline: ${openSlots} open slot${openSlots > 1 ? 's' : ''} on ${formatDate(data.date)}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="margin-bottom:4px">⚠️ Cancellation Deadline Approaching</h2>
        <p style="color:#666;margin-top:0">${data.groupName}</p>
        <p>You have <strong>${openSlots} unfilled slot${openSlots > 1 ? 's' : ''}</strong> with less than 48 hours until tee time.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:8px 0;color:#666;width:80px">Date</td><td style="padding:8px 0;font-weight:600">${formatDate(data.date)}</td></tr>
          <tr><td style="padding:8px 0;color:#666">Time</td><td style="padding:8px 0;font-weight:600">${formatTime(data.startTime)}</td></tr>
          <tr><td style="padding:8px 0;color:#666">Course</td><td style="padding:8px 0;font-weight:600">${data.course}</td></tr>
        </table>
        <p>If you can't fill the slot, contact the course to cancel it before the deadline.</p>
        <a href="${dashboardUrl}" style="display:inline-block;background:#18181b;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Open Dashboard</a>
      </div>
    `,
  })
}

// ── RSVP change alert to admin ────────────────────────────────────────────

export async function sendRsvpChangeAlert(
  admin: Recipient,
  player: Recipient,
  data: TeeTimeEmailData,
  newStatus: 'in' | 'out'
) {
  if (!isConfigured()) {
    console.log('[email] RESEND_API_KEY not set — skipping rsvp_change email')
    return
  }

  const dashboardUrl = `${APP_URL}/dashboard`

  await getResend().emails.send({
    from: FROM,
    to: admin.email,
    subject: `${player.name} changed their RSVP to ${newStatus.toUpperCase()} — ${formatDate(data.date)}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="margin-bottom:4px">RSVP Update</h2>
        <p><strong>${player.name}</strong> changed their response to <strong>${newStatus === 'in' ? '✅ IN' : '❌ OUT'}</strong> for:</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:8px 0;color:#666;width:80px">Date</td><td style="padding:8px 0">${formatDate(data.date)}</td></tr>
          <tr><td style="padding:8px 0;color:#666">Time</td><td style="padding:8px 0">${formatTime(data.startTime)}</td></tr>
          <tr><td style="padding:8px 0;color:#666">Course</td><td style="padding:8px 0">${data.course}</td></tr>
        </table>
        <a href="${dashboardUrl}" style="display:inline-block;background:#18181b;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Open Dashboard</a>
      </div>
    `,
  })
}
