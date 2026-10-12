import nodemailer from "nodemailer"
import { Resend } from "resend"
import { env } from "../env.js"

interface SendEmailInput {
  to: string
  subject: string
  html: string
}

/**
 * Dual email transport:
 * 1. SMTP (Mailpit on localhost:1025 for local testing / production SMTP)
 * 2. Resend API (production fallback when configured)
 * 3. Non-prod console logging fallback when neither is supplied.
 */
const smtpTransport = env.SMTP_HOST
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    })
  : null

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null

export async function sendEmail({ to, subject, html }: SendEmailInput): Promise<void> {
  if (smtpTransport) {
    await smtpTransport.sendMail({
      from: env.RESEND_FROM_EMAIL,
      to,
      subject,
      html,
    })
    return
  }

  if (resend) {
    const { error } = await resend.emails.send({
      from: env.RESEND_FROM_EMAIL,
      to,
      subject,
      html,
    })
    if (error) {
      throw new Error(`Failed to send email via Resend: ${error.message}`)
    }
    return
  }

  console.log(`📧 [EMAIL DISABLED] Would send "${subject}" to ${to}:\n${html}`)
}
