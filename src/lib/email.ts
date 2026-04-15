import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM_EMAIL = 'Claritas AI Consulting <noreply@claritas-ai.de>';
const ADMIN_EMAIL = 'martyna@tastehub.io';

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
        <h2 style="color: #c89b4a; font-weight: 400;">Hallo ${appt.name},</h2>
        <p>Ihre Terminanfrage wurde bestätigt.</p>
        <div style="background: #f5f5f5; padding: 1.5rem; margin: 1.5rem 0; border-left: 3px solid #c89b4a;">
          <p style="margin: 0;"><strong>Datum:</strong> ${formatDateGerman(appt.date)}</p>
          <p style="margin: 0.5rem 0 0;"><strong>Uhrzeit:</strong> ${appt.time} Uhr</p>
        </div>
        ${appt.topic ? `<p style="font-style: italic;">${appt.topic}</p>` : ''}
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
        <h2 style="color: #c89b4a; font-weight: 400;">Hallo ${appt.name},</h2>
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
        <h2 style="color: #c89b4a; font-weight: 400;">Hallo ${appt.name},</h2>
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
        <h2 style="color: #c89b4a; font-weight: 400;">Hallo ${appt.name},</h2>
        <div style="background: #f5f5f5; padding: 1.5rem; margin: 1.5rem 0;">
          <p style="margin: 0; white-space: pre-wrap;">${appt.adminMessage}</p>
        </div>
        <p><a href="https://claritas-ai.de/kontakt" style="color: #c89b4a;">Rückfragen</a></p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 2rem 0;">
        <p style="font-size: 0.8rem; color: #888;">Claritas AI Consulting</p>
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
      <td style="padding: 0.5rem; border-bottom: 1px solid #eee;">${a.time}</td>
      <td style="padding: 0.5rem; border-bottom: 1px solid #eee;">${a.name}</td>
      <td style="padding: 0.5rem; border-bottom: 1px solid #eee;">${a.email}</td>
      <td style="padding: 0.5rem; border-bottom: 1px solid #eee;">${a.company || '–'}</td>
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