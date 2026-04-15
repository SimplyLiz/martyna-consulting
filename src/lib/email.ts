import { Resend } from 'resend';
import { marked } from 'marked';

marked.setOptions({ gfm: true, breaks: true });

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM_EMAIL = 'Claritas AI Consulting <noreply@claritas-ai.de>';
const ADMIN_EMAIL = 'martyna@tastehub.io';

function esc(s: string | undefined | null): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface Appointment {
  id: string;
  date: string;
  time: string;
  name: string;
  email: string;
  company?: string;
  topic?: string;
  status: string;
  adminMessage?: string;
}

function formatDateGerman(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${d}.${m}.${y}`;
}

export async function sendConfirmationEmail(appt: Appointment): Promise<void> {
  if (!resend) return;
  await resend.emails.send({
    from: FROM_EMAIL,
    to: appt.email,
    subject: 'Ihr Termin bei Claritas AI Consulting – Bestätigt',
    html: `
      <div style="font-family: Georgia, serif; max-width: 500px; margin: 0 auto; padding: 2rem;">
        <h2 style="color: #c89b4a; font-weight: 400;">Hallo ${esc(appt.name)},</h2>
        <p>Ihre Terminanfrage wurde bestätigt.</p>
        <div style="background: #f5f5f5; padding: 1.5rem; margin: 1.5rem 0; border-left: 3px solid #c89b4a;">
          <p style="margin: 0;"><strong>Datum:</strong> ${formatDateGerman(appt.date)}</p>
          <p style="margin: 0.5rem 0 0;"><strong>Uhrzeit:</strong> ${appt.time} Uhr</p>
        </div>
        ${appt.topic ? `<p style="font-style: italic;">${esc(appt.topic)}</p>` : ''}
        <p><a href="https://claritas-ai.de/kontakt" style="color: #c89b4a;">Kontakt bei Fragen</a></p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 2rem 0;">
        <p style="font-size: 0.8rem; color: #888;">Claritas AI Consulting</p>
      </div>
    `,
  });
}

export async function sendRejectionEmail(appt: Appointment): Promise<void> {
  if (!resend) return;
  await resend.emails.send({
    from: FROM_EMAIL,
    to: appt.email,
    subject: 'Ihr Termin bei Claritas AI Consulting – Absage',
    html: `
      <div style="font-family: Georgia, serif; max-width: 500px; margin: 0 auto; padding: 2rem;">
        <h2 style="color: #c89b4a; font-weight: 400;">Hallo ${esc(appt.name)},</h2>
        <p>leider können wir Ihren Terminwunsch nicht erfüllen.</p>
        <div style="background: #f5f5f5; padding: 1.5rem; margin: 1.5rem 0; border-left: 3px solid #eb5757;">
          <p style="margin: 0;">${formatDateGerman(appt.date)} · ${appt.time} Uhr</p>
        </div>
        <p><a href="https://claritas-ai.de/termin" style="color: #c89b4a;">Neuen Termin vereinbaren</a></p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 2rem 0;">
        <p style="font-size: 0.8rem; color: #888;">Claritas AI Consulting</p>
      </div>
    `,
  });
}

export async function sendRescheduleEmail(appt: Appointment, newDate: string, newTime: string): Promise<void> {
  if (!resend) return;
  await resend.emails.send({
    from: FROM_EMAIL,
    to: appt.email,
    subject: 'Ihr Termin bei Claritas AI Consulting – Neuer Termin',
    html: `
      <div style="font-family: Georgia, serif; max-width: 500px; margin: 0 auto; padding: 2rem;">
        <h2 style="color: #c89b4a; font-weight: 400;">Hallo ${esc(appt.name)},</h2>
        <p>Ihr Termin wurde auf einen neuen Termin verschoben.</p>
        <div style="background: #f5f5f5; padding: 1.5rem; margin: 1.5rem 0; border-left: 3px solid #c89b4a;">
          <p style="margin: 0;"><strong>Neues Datum:</strong> ${formatDateGerman(newDate)}</p>
          <p style="margin: 0.5rem 0 0;"><strong>Neue Uhrzeit:</strong> ${newTime} Uhr</p>
        </div>
        <p><a href="https://claritas-ai.de/kontakt" style="color: #c89b4a;">Kontakt bei Fragen</a></p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 2rem 0;">
        <p style="font-size: 0.8rem; color: #888;">Claritas AI Consulting</p>
      </div>
    `,
  });
}

export async function sendMessageEmail(appt: Appointment): Promise<void> {
  if (!resend || !appt.adminMessage) return;
  await resend.emails.send({
    from: FROM_EMAIL,
    to: appt.email,
    subject: 'Nachricht von Claritas AI Consulting',
    html: `
      <div style="font-family: Georgia, serif; max-width: 500px; margin: 0 auto; padding: 2rem;">
        <h2 style="color: #c89b4a; font-weight: 400;">Hallo ${esc(appt.name)},</h2>
        <div style="background: #f5f5f5; padding: 1.5rem; margin: 1.5rem 0;">
          <p style="margin: 0; white-space: pre-wrap;">${esc(appt.adminMessage)}</p>
        </div>
        <p><a href="https://claritas-ai.de/kontakt" style="color: #c89b4a;">Rückfragen</a></p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 2rem 0;">
        <p style="font-size: 0.8rem; color: #888;">Claritas AI Consulting</p>
      </div>
    `,
  });
}

type Lang = 'de' | 'en' | 'pl';

interface Subscriber {
  id: string;
  email: string;
  language: Lang;
  token: string;
}

interface Newsletter {
  id: string;
  subject: { de: string; en: string; pl: string };
  body: { de: string; en: string; pl: string };
}

const SITE_URL = process.env.PUBLIC_SITE_URL || 'https://claritas-ai.de';

const UNSUBSCRIBE_LABEL: Record<Lang, string> = {
  de: 'Abmelden',
  en: 'Unsubscribe',
  pl: 'Wypisz się',
};

function renderNewsletterHtml(subject: string, body: string, lang: Lang, token: string): string {
  // Markdown body is authored by the admin (trusted). Subject + unsubscribe URL
  // carry untrusted/variable data — escape them.
  const rendered = marked.parse(body, { async: false }) as string;
  const url = `${SITE_URL}/newsletter/unsubscribe?token=${encodeURIComponent(token)}`;
  return `
    <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 2rem; color: #222;">
      <h1 style="font-family: Georgia, serif; color: #c89b4a; font-weight: 400; font-size: 1.6rem; margin: 0 0 1.5rem;">${esc(subject)}</h1>
      <div class="nl-content" style="font-size: 1rem; line-height: 1.7;">${rendered}</div>
      <hr style="border: none; border-top: 1px solid #eee; margin: 2.5rem 0 1rem;">
      <p style="font-size: 0.75rem; color: #888;">
        Claritas AI Consulting ·
        <a href="${url}" style="color: #888;">${UNSUBSCRIBE_LABEL[lang]}</a>
      </p>
    </div>
  `;
}

export async function sendNewsletterToSubscriber(sub: Subscriber, nl: Newsletter): Promise<void> {
  if (!resend) return;
  const lang = sub.language;
  const subject = nl.subject[lang] || nl.subject.de;
  const body = nl.body[lang] || nl.body.de;
  await resend.emails.send({
    from: FROM_EMAIL,
    to: sub.email,
    subject,
    html: renderNewsletterHtml(subject, body, lang, sub.token),
  });
}

const CONFIRM_LABEL: Record<Lang, { subject: string; heading: string; body: string }> = {
  de: {
    subject: 'Willkommen beim Claritas Newsletter',
    heading: 'Willkommen,',
    body: 'vielen Dank für Ihr Abonnement. Sie erhalten künftig unseren Newsletter zu EU AI Act, DSGVO und KI-Governance.',
  },
  en: {
    subject: 'Welcome to the Claritas Newsletter',
    heading: 'Welcome,',
    body: 'thank you for subscribing. You will receive our newsletter on EU AI Act, GDPR and AI governance.',
  },
  pl: {
    subject: 'Witamy w newsletterze Claritas',
    heading: 'Witamy,',
    body: 'dziękujemy za subskrypcję. Będziesz otrzymywać nasz newsletter o AI Act, RODO i zarządzaniu AI.',
  },
};

export async function sendSubscriberWelcome(sub: Subscriber): Promise<void> {
  if (!resend) return;
  const l = CONFIRM_LABEL[sub.language];
  const url = `${SITE_URL}/newsletter/unsubscribe?token=${encodeURIComponent(sub.token)}`;
  await resend.emails.send({
    from: FROM_EMAIL,
    to: sub.email,
    subject: l.subject,
    html: `
      <div style="font-family: Georgia, serif; max-width: 500px; margin: 0 auto; padding: 2rem;">
        <h2 style="color: #c89b4a; font-weight: 400;">${l.heading}</h2>
        <p>${l.body}</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 2rem 0;">
        <p style="font-size: 0.75rem; color: #888;">
          Claritas AI Consulting ·
          <a href="${url}" style="color: #888;">${UNSUBSCRIBE_LABEL[sub.language]}</a>
        </p>
      </div>
    `,
  });
}

const OPTIN_LABEL: Record<Lang, { subject: string; heading: string; body: string; button: string }> = {
  de: {
    subject: 'Bitte bestätigen Sie Ihre Newsletter-Anmeldung',
    heading: 'Anmeldung bestätigen',
    body: 'Klicken Sie auf den Button, um Ihre Anmeldung zum Claritas Newsletter zu bestätigen. Falls Sie sich nicht angemeldet haben, ignorieren Sie diese E-Mail.',
    button: 'Anmeldung bestätigen',
  },
  en: {
    subject: 'Please confirm your newsletter subscription',
    heading: 'Confirm your subscription',
    body: 'Click the button below to confirm your subscription to the Claritas newsletter. If you did not subscribe, simply ignore this email.',
    button: 'Confirm subscription',
  },
  pl: {
    subject: 'Potwierdź subskrypcję newslettera',
    heading: 'Potwierdź subskrypcję',
    body: 'Kliknij poniższy przycisk, aby potwierdzić subskrypcję newslettera Claritas. Jeśli nie zapisywałeś się, zignoruj tę wiadomość.',
    button: 'Potwierdź subskrypcję',
  },
};

export async function sendSubscriberConfirm(sub: Subscriber & { confirmToken?: string }): Promise<void> {
  if (!resend || !sub.confirmToken) return;
  const l = OPTIN_LABEL[sub.language];
  const url = `${SITE_URL}/newsletter/confirm?token=${encodeURIComponent(sub.confirmToken)}`;
  await resend.emails.send({
    from: FROM_EMAIL,
    to: sub.email,
    subject: l.subject,
    html: `
      <div style="font-family: Georgia, serif; max-width: 500px; margin: 0 auto; padding: 2rem;">
        <h2 style="color: #c89b4a; font-weight: 400;">${l.heading}</h2>
        <p>${l.body}</p>
        <p style="margin: 2rem 0;">
          <a href="${url}" style="display:inline-block;background:#c89b4a;color:#fff;padding:0.75rem 1.5rem;text-decoration:none;border-radius:2px;">${l.button}</a>
        </p>
        <p style="font-size: 0.75rem; color: #888;">
          ${url}
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 2rem 0;">
        <p style="font-size: 0.75rem; color: #888;">Claritas AI Consulting</p>
      </div>
    `,
  });
}

export async function sendAdminDailyDigest(pendingAppts: Appointment[]): Promise<void> {
  if (!resend) return;
  const count = pendingAppts.length;
  if (count === 0) {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject: 'Claritas Tagesreport – Keine offenen Anfragen',
      html: `<p style="font-family: Georgia, serif;">Keine offenen Terminanfragen.</p>`,
    });
    return;
  }

  const rows = pendingAppts.map(a => `
    <tr>
      <td style="padding: 0.5rem; border-bottom: 1px solid #eee;">${formatDateGerman(a.date)}</td>
      <td style="padding: 0.5rem; border-bottom: 1px solid #eee;">${esc(a.time)}</td>
      <td style="padding: 0.5rem; border-bottom: 1px solid #eee;">${esc(a.name)}</td>
      <td style="padding: 0.5rem; border-bottom: 1px solid #eee;">${esc(a.email)}</td>
      <td style="padding: 0.5rem; border-bottom: 1px solid #eee;">${esc(a.company) || '–'}</td>
    </tr>
  `).join('');

  await resend.emails.send({
    from: FROM_EMAIL,
    to: ADMIN_EMAIL,
    subject: `Claritas Tagesreport – ${count} offene Anfrage${count > 1 ? 'n' : ''}`,
    html: `
      <div style="font-family: Georgia, serif; max-width: 600px;">
        <h2 style="color: #c89b4a; font-weight: 400;">Offene Terminanfragen (${count})</h2>
        <table style="width: 100%; border-collapse: collapse; margin: 1rem 0;">
          <thead>
            <tr>
              <th style="text-align: left; padding: 0.5rem; border-bottom: 2px solid #c89b4a;">Datum</th>
              <th style="text-align: left; padding: 0.5rem; border-bottom: 2px solid #c89b4a;">Zeit</th>
              <th style="text-align: left; padding: 0.5rem; border-bottom: 2px solid #c89b4a;">Name</th>
              <th style="text-align: left; padding: 0.5rem; border-bottom: 2px solid #c89b4a;">E-Mail</th>
              <th style="text-align: left; padding: 0.5rem; border-bottom: 2px solid #c89b4a;">Unternehmen</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="margin-top: 1rem;"><a href="https://claritas-ai.de/admin" style="color: #c89b4a;">Zum Admin-Bereich</a></p>
      </div>
    `,
  });
}