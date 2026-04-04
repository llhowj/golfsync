import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/get-user'
import { Resend } from 'resend'

function getResend() {
  return new Resend(process.env.RESEND_API_KEY)
}

function isConfigured() {
  return process.env.RESEND_API_KEY && !process.env.RESEND_API_KEY.startsWith('re_placeholder')
}

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let message: string
  try {
    const body = await request.json()
    message = (body?.message ?? '').trim()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  if (!message) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 })
  }

  if (!isConfigured()) {
    console.log('\n📧 [FEEDBACK — not sent locally]')
    console.log(`   From: ${user.email}`)
    console.log(`   Message: ${message}`)
    return NextResponse.json({ ok: true })
  }

  const { error } = await getResend().emails.send({
    from: 'GolfSync <notifications@golfsync.app>',
    to: 'hrosenberg@gmail.com',
    replyTo: user.email,
    subject: `GolfSync feedback from ${user.email}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="margin-bottom:4px">GolfSync Feedback</h2>
        <p style="color:#666;margin-top:0">From: ${user.email}</p>
        <div style="background:#f5f5f5;border-radius:6px;padding:14px 16px;margin:16px 0;white-space:pre-wrap;font-size:14px;color:#333">${message}</div>
      </div>
    `,
  })

  if (error) {
    console.error('[feedback] Resend error:', error.message)
    return NextResponse.json({ error: 'Failed to send feedback' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
