import { SUPPORTED_LOCALES } from '../users/dto/update-settings.dto';
import type { OutgoingMail } from './mail.service';

export type MailLocale = (typeof SUPPORTED_LOCALES)[number];

/** Mirrors the `UserSettings.locale` column default, and the SPA's own default. */
const FALLBACK_LOCALE: MailLocale = 'fr';

export function resolveMailLocale(value: unknown): MailLocale {
  return typeof value === 'string' &&
    (SUPPORTED_LOCALES as readonly string[]).includes(value)
    ? (value as MailLocale)
    : FALLBACK_LOCALE;
}

interface Copy {
  subject: string;
  heading: string;
  intro: string;
  cta: string;
  /** Reads "This link expires in <duration> …" — duration is formatted by ICU. */
  expiry: (duration: string) => string;
  fallback: string;
  ignore: string;
  signature: string;
}

const PASSWORD_RESET: Record<MailLocale, Copy> = {
  fr: {
    subject: 'Réinitialiser votre mot de passe',
    heading: 'Réinitialisation de votre mot de passe',
    intro:
      'Vous avez demandé à réinitialiser le mot de passe de votre compte JobQuest.',
    cta: 'Choisir un nouveau mot de passe',
    expiry: (d) =>
      `Ce lien expire dans ${d} et ne peut servir qu'une seule fois.`,
    fallback:
      'Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :',
    ignore:
      "Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail : votre mot de passe reste inchangé.",
    signature: "L'équipe JobQuest",
  },
  en: {
    subject: 'Reset your password',
    heading: 'Reset your password',
    intro: 'You asked to reset the password on your JobQuest account.',
    cta: 'Choose a new password',
    expiry: (d) => `This link expires in ${d} and can only be used once.`,
    fallback: "If the button doesn't work, copy this link into your browser:",
    ignore:
      'If you did not request this, ignore this e-mail — your password stays unchanged.',
    signature: 'The JobQuest team',
  },
  de: {
    subject: 'Passwort zurücksetzen',
    heading: 'Passwort zurücksetzen',
    intro:
      'Sie haben angefordert, das Passwort Ihres JobQuest-Kontos zurückzusetzen.',
    cta: 'Neues Passwort wählen',
    expiry: (d) =>
      `Dieser Link läuft in ${d} ab und kann nur einmal verwendet werden.`,
    fallback:
      'Falls die Schaltfläche nicht funktioniert, kopieren Sie diesen Link in Ihren Browser:',
    ignore:
      'Wenn Sie das nicht angefordert haben, ignorieren Sie diese E-Mail — Ihr Passwort bleibt unverändert.',
    signature: 'Ihr JobQuest-Team',
  },
  es: {
    subject: 'Restablecer tu contraseña',
    heading: 'Restablecer tu contraseña',
    intro: 'Has solicitado restablecer la contraseña de tu cuenta de JobQuest.',
    cta: 'Elegir una contraseña nueva',
    expiry: (d) => `Este enlace caduca en ${d} y solo puede usarse una vez.`,
    fallback: 'Si el botón no funciona, copia este enlace en tu navegador:',
    ignore:
      'Si no has hecho esta solicitud, ignora este correo: tu contraseña no cambiará.',
    signature: 'El equipo de JobQuest',
  },
};

const EMAIL_VERIFICATION: Record<MailLocale, Copy> = {
  fr: {
    subject: 'Confirmez votre adresse e-mail',
    heading: 'Confirmez votre adresse',
    intro:
      'Confirmez cette adresse pour pouvoir récupérer votre compte JobQuest si vous perdez votre mot de passe.',
    cta: 'Confirmer mon adresse',
    expiry: (d) => `Ce lien expire dans ${d}.`,
    fallback:
      'Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :',
    ignore: "Si vous n'avez pas créé de compte JobQuest, ignorez cet e-mail.",
    signature: "L'équipe JobQuest",
  },
  en: {
    subject: 'Confirm your e-mail address',
    heading: 'Confirm your address',
    intro:
      'Confirm this address so you can recover your JobQuest account if you ever lose your password.',
    cta: 'Confirm my address',
    expiry: (d) => `This link expires in ${d}.`,
    fallback: "If the button doesn't work, copy this link into your browser:",
    ignore: 'If you did not create a JobQuest account, ignore this e-mail.',
    signature: 'The JobQuest team',
  },
  de: {
    subject: 'Bestätigen Sie Ihre E-Mail-Adresse',
    heading: 'Adresse bestätigen',
    intro:
      'Bestätigen Sie diese Adresse, damit Sie Ihr JobQuest-Konto wiederherstellen können, falls Sie Ihr Passwort verlieren.',
    cta: 'Adresse bestätigen',
    expiry: (d) => `Dieser Link läuft in ${d} ab.`,
    fallback:
      'Falls die Schaltfläche nicht funktioniert, kopieren Sie diesen Link in Ihren Browser:',
    ignore:
      'Wenn Sie kein JobQuest-Konto erstellt haben, ignorieren Sie diese E-Mail.',
    signature: 'Ihr JobQuest-Team',
  },
  es: {
    subject: 'Confirma tu dirección de correo',
    heading: 'Confirma tu dirección',
    intro:
      'Confirma esta dirección para poder recuperar tu cuenta de JobQuest si alguna vez pierdes la contraseña.',
    cta: 'Confirmar mi dirección',
    expiry: (d) => `Este enlace caduca en ${d}.`,
    fallback: 'Si el botón no funciona, copia este enlace en tu navegador:',
    ignore: 'Si no has creado una cuenta de JobQuest, ignora este correo.',
    signature: 'El equipo de JobQuest',
  },
};

/**
 * "30 minutes" / "30 Minuten" / "30 minutos" — plural rules and unit names come
 * from ICU, so no locale needs a hand-written plural table here.
 */
function formatDuration(
  locale: MailLocale,
  value: number,
  unit: 'minute' | 'hour',
): string {
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit,
    unitDisplay: 'long',
  }).format(value);
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escapes for both text nodes and quoted attribute values. */
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

function render(
  copy: Copy,
  to: string,
  url: string,
  duration: string,
): OutgoingMail {
  const expiry = copy.expiry(duration);
  const safeUrl = escapeHtml(url);

  const text = [
    copy.heading,
    '',
    copy.intro,
    '',
    `${copy.cta}: ${url}`,
    '',
    expiry,
    copy.ignore,
    '',
    copy.signature,
  ].join('\n');

  // Inline styles and a table-free layout: mail clients strip <style> blocks,
  // and the link is repeated in full because many of them do not render the
  // button at all.
  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f4f4f5;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#18181b;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;">
      <h1 style="margin:0 0 16px;font-size:20px;">${escapeHtml(copy.heading)}</h1>
      <p style="margin:0 0 24px;line-height:1.6;">${escapeHtml(copy.intro)}</p>
      <p style="margin:0 0 24px;">
        <a href="${safeUrl}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#4f46e5;color:#ffffff;text-decoration:none;font-weight:600;">${escapeHtml(copy.cta)}</a>
      </p>
      <p style="margin:0 0 8px;font-size:13px;color:#52525b;">${escapeHtml(copy.fallback)}</p>
      <p style="margin:0 0 24px;font-size:13px;word-break:break-all;"><a href="${safeUrl}" style="color:#4f46e5;">${safeUrl}</a></p>
      <p style="margin:0 0 8px;font-size:13px;color:#52525b;">${escapeHtml(expiry)}</p>
      <p style="margin:0 0 24px;font-size:13px;color:#52525b;">${escapeHtml(copy.ignore)}</p>
      <p style="margin:0;font-size:13px;color:#52525b;">${escapeHtml(copy.signature)}</p>
    </div>
  </body>
</html>`;

  return { to, subject: copy.subject, text, html };
}

export function passwordResetMail(
  to: string,
  locale: MailLocale,
  url: string,
  ttlMinutes: number,
): OutgoingMail {
  return render(
    PASSWORD_RESET[locale],
    to,
    url,
    formatDuration(locale, ttlMinutes, 'minute'),
  );
}

export function emailVerificationMail(
  to: string,
  locale: MailLocale,
  url: string,
  ttlHours: number,
): OutgoingMail {
  return render(
    EMAIL_VERIFICATION[locale],
    to,
    url,
    formatDuration(locale, ttlHours, 'hour'),
  );
}
