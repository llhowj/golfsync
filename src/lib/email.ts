import { Resend } from 'resend'

function getResend() {
  return new Resend(process.env.RESEND_API_KEY)
}

const FROM = 'GolfSync <notifications@golfsync.app>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

function isConfigured() {
  return process.env.RESEND_API_KEY && !process.env.RESEND_API_KEY.startsWith('re_placeholder')
}

function logEmail(to: string | string[], subject: string, body: Record<string, unknown>) {
  const recipients = Array.isArray(to) ? to.join(', ') : to
  console.log('\n📧 [EMAIL — not sent locally]')
  console.log(`   To:      ${recipients}`)
  console.log(`   Subject: ${subject}`)
  console.log('   Data:   ', JSON.stringify(body, null, 2))
  console.log('')
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
  notes?: string | null
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
    recipients.forEach(r => logEmail(r.email, `⛳ New tee time: ${formatDate(data.date)} at ${data.course}`, { ...data, recipient: r.name }))
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
            ${data.notes ? `<p style="background:#f4f4f5;border-radius:6px;padding:12px 16px;margin:16px 0;font-size:14px;color:#444"><strong>Note from your admin:</strong><br>${data.notes}</p>` : ''}
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
    recipients.forEach(r => logEmail(r.email, `Cancelled: ${formatDate(data.date)} at ${data.course}`, { ...data, recipient: r.name }))
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
    logEmail(admin.email, `⚠️ 48-hour deadline: ${openSlots} open slot(s) on ${formatDate(data.date)}`, { ...data, openSlots })
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

// ── Player invite ─────────────────────────────────────────────────────────

export async function sendPlayerInviteEmail(
  recipient: Recipient,
  groupName: string,
) {
  if (!isConfigured()) {
    logEmail(recipient.email, `You've been invited to ${groupName} on GolfSync`, { recipient: recipient.name, groupName })
    return
  }

  const signUpUrl = `${APP_URL}/register`

  await getResend().emails.send({
    from: FROM,
    to: recipient.email,
    subject: `You've been invited to ${groupName} on GolfSync`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="margin-bottom:4px">⛳ You're invited!</h2>
        <p>Hi ${recipient.name},</p>
        <p>You've been added to <strong>${groupName}</strong> on GolfSync. Create your free account to RSVP to tee times and stay in sync with your group.</p>
        <a href="${signUpUrl}" style="display:inline-block;background:#18181b;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Create Account</a>
        <p style="color:#999;font-size:12px;margin-top:24px">You're receiving this because a group admin added you to ${groupName} on GolfSync.</p>
      </div>
    `,
  })
}

// ── Proposal notification to players ─────────────────────────────────────

export async function sendProposalNotificationEmails(
  recipients: Recipient[],
  data: ProposalEmailData
) {
  if (!isConfigured()) {
    recipients.forEach(r => logEmail(r.email, `⏳ Proposed change to your tee time on ${formatDate(data.originalDate)}`, { recipient: r.name, ...data }))
    return
  }

  const teeTimeUrl = `${APP_URL}/tee-time/${data.teeTimeId}`

  await Promise.allSettled(
    recipients.map(({ name, email }) =>
      getResend().emails.send({
        from: FROM,
        to: email,
        subject: `⏳ Proposed change to your tee time on ${formatDate(data.originalDate)}`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
            <h2 style="margin-bottom:4px">Proposed Tee Time Change</h2>
            <p style="color:#666;margin-top:0">${data.groupName}</p>
            <p>Hi ${name}, your admin has proposed a change to an upcoming tee time. Please let them know if the new time works for you.</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0">
              <tr><td colspan="2" style="padding:4px 0;color:#666;font-size:12px;text-transform:uppercase;letter-spacing:.05em">Original</td></tr>
              <tr><td style="padding:4px 0;color:#666;width:80px">Date</td><td style="padding:4px 0">${formatDate(data.originalDate)}</td></tr>
              <tr><td style="padding:4px 0;color:#666">Time</td><td style="padding:4px 0">${formatTime(data.originalTime)}</td></tr>
              <tr><td style="padding:4px 0;color:#666">Course</td><td style="padding:4px 0">${data.originalCourse}</td></tr>
              <tr><td colspan="2" style="padding:12px 0 4px;color:#666;font-size:12px;text-transform:uppercase;letter-spacing:.05em">Proposed</td></tr>
              <tr><td style="padding:4px 0;color:#666;width:80px">Date</td><td style="padding:4px 0;font-weight:600">${formatDate(data.proposedDate)}</td></tr>
              <tr><td style="padding:4px 0;color:#666">Time</td><td style="padding:4px 0;font-weight:600">${formatTime(data.proposedTime)}</td></tr>
              <tr><td style="padding:4px 0;color:#666">Course</td><td style="padding:4px 0;font-weight:600">${data.proposedCourse}</td></tr>
            </table>
            <a href="${teeTimeUrl}" style="display:inline-block;background:#18181b;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Respond Now</a>
            <p style="color:#999;font-size:12px;margin-top:24px">You're receiving this because you're confirmed in for this round on GolfSync.</p>
          </div>
        `,
      })
    )
  )
}

// ── Proposal response alerts to admin ────────────────────────────────────

interface ProposalEmailData {
  teeTimeId: string
  originalDate: string
  originalTime: string
  originalCourse: string
  proposedDate: string
  proposedTime: string
  proposedCourse: string
  groupName: string
}

export async function sendProposalDeclinedEmail(
  admin: Recipient,
  player: Recipient,
  data: ProposalEmailData
) {
  if (!isConfigured()) {
    logEmail(admin.email, `❌ ${player.name} can't make the proposed change — ${formatDate(data.proposedDate)}`, { player: player.name, ...data })
    return
  }

  const dashboardUrl = `${APP_URL}/dashboard?g=${data.teeTimeId}`

  await getResend().emails.send({
    from: FROM,
    to: admin.email,
    subject: `❌ ${player.name} can't make the proposed change — ${formatDate(data.proposedDate)}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="margin-bottom:4px">Proposed Change Declined</h2>
        <p><strong>${player.name}</strong> can't make the proposed new time for <strong>${data.groupName}</strong>. The tee time was not changed.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td colspan="2" style="padding:4px 0;color:#666;font-size:12px;text-transform:uppercase;letter-spacing:.05em">Original</td></tr>
          <tr><td style="padding:4px 0;color:#666;width:80px">Date</td><td style="padding:4px 0">${formatDate(data.originalDate)}</td></tr>
          <tr><td style="padding:4px 0;color:#666">Time</td><td style="padding:4px 0">${formatTime(data.originalTime)}</td></tr>
          <tr><td style="padding:4px 0;color:#666">Course</td><td style="padding:4px 0">${data.originalCourse}</td></tr>
          <tr><td colspan="2" style="padding:12px 0 4px;color:#666;font-size:12px;text-transform:uppercase;letter-spacing:.05em">Proposed (not applied)</td></tr>
          <tr><td style="padding:4px 0;color:#666;width:80px">Date</td><td style="padding:4px 0">${formatDate(data.proposedDate)}</td></tr>
          <tr><td style="padding:4px 0;color:#666">Time</td><td style="padding:4px 0">${formatTime(data.proposedTime)}</td></tr>
          <tr><td style="padding:4px 0;color:#666">Course</td><td style="padding:4px 0">${data.proposedCourse}</td></tr>
        </table>
        <a href="${dashboardUrl}" style="display:inline-block;background:#18181b;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Open Dashboard</a>
      </div>
    `,
  })
}

export async function sendProposalAcceptedEmail(
  admin: Recipient,
  data: ProposalEmailData
) {
  if (!isConfigured()) {
    logEmail(admin.email, `✅ Everyone agreed — tee time updated to ${formatDate(data.proposedDate)}`, { ...data })
    return
  }

  const dashboardUrl = `${APP_URL}/dashboard?g=${data.teeTimeId}`

  await getResend().emails.send({
    from: FROM,
    to: admin.email,
    subject: `✅ Everyone agreed — tee time updated to ${formatDate(data.proposedDate)}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="margin-bottom:4px">Proposed Change Accepted</h2>
        <p style="color:#666;margin-top:0">${data.groupName}</p>
        <p>Everyone agreed to the proposed change. The tee time has been updated.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:8px 0;color:#666;width:80px">Date</td><td style="padding:8px 0;font-weight:600">${formatDate(data.proposedDate)}</td></tr>
          <tr><td style="padding:8px 0;color:#666">Time</td><td style="padding:8px 0;font-weight:600">${formatTime(data.proposedTime)}</td></tr>
          <tr><td style="padding:8px 0;color:#666">Course</td><td style="padding:8px 0;font-weight:600">${data.proposedCourse}</td></tr>
        </table>
        <p style="font-size:14px;color:#555">Remember to update your calendar.</p>
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
    logEmail(admin.email, `${player.name} changed their RSVP to ${newStatus.toUpperCase()} — ${formatDate(data.date)}`, { player: player.name, newStatus, ...data })
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
