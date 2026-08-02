import { Injectable, Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';

export interface OutgoingMail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * SMTP delivery. Deliberately transport-agnostic: SES, Postmark, Resend and
 * Brevo all speak SMTP, so switching provider is a change of environment
 * variables, not of code. In docker-compose this points at Mailpit, which
 * swallows everything — no dev machine can mail a real person by accident.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly from = process.env.MAIL_FROM ?? 'no-reply@jobquest.local';

  private readonly transporter: Transporter = createTransport({
    host: process.env.SMTP_HOST ?? 'localhost',
    port: Number(process.env.SMTP_PORT ?? 1025),
    // Implicit TLS (usually port 465). Everything else negotiates STARTTLS
    // when the server advertises it; certificate verification is never
    // disabled, so a relay with a bad certificate fails loudly.
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD ?? '',
        }
      : undefined,
  });

  /**
   * Never throws: a relay outage must not turn into a 500 that tells the
   * caller whether an address exists, and the flows that send mail all answer
   * generically by design. The failure is logged with the recipient redacted.
   */
  async send(mail: OutgoingMail): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.from,
        to: mail.to,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
      });
    } catch (err) {
      this.logger.error(
        `Failed to deliver "${mail.subject}" to ${redactEmail(mail.to)}: ${
          (err as Error).message
        }`,
      );
    }
  }
}

/** Keeps a failed delivery diagnosable without writing an address to the logs. */
function redactEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at <= 0) return '***';
  return `${email[0]}***${email.slice(at)}`;
}
