export interface Mail {
  to: string;
  subject: string;
  text: string;
}

export interface Mailer {
  send(mail: Mail): Promise<void>;
  /** True when mail only reaches the server log (no SMTP configured). */
  readonly logsOnly: boolean;
}

const sent: Mail[] = [];

/** No SMTP configured: the message goes to the server log (and, in tests, to `outbox`). */
export const logMailer: Mailer = {
  logsOnly: true,
  async send(mail) {
    sent.push(mail);
    console.info(`[mail] to=${mail.to} subject=${mail.subject}\n${mail.text}`);
  },
};

export function outbox(): Mail[] {
  return sent;
}

export function getMailer(): Mailer {
  const url = process.env.SMTP_URL;
  if (!url) return logMailer;
  const from = process.env.SMTP_FROM ?? 'GamaTutor <no-reply@komunitech.id>';
  return {
    logsOnly: false,
    async send(mail) {
      const nodemailer = await import('nodemailer');
      await nodemailer.createTransport(url).sendMail({ from, ...mail });
    },
  };
}
