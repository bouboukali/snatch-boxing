const https = require('https');

const FROM_NAME  = 'Snatch Boxing Academy';
const FROM_EMAIL = process.env.BREVO_FROM || 'bchr1307@gmail.com';

async function send({ to, subject, text }) {
  if (!process.env.BREVO_API_KEY) {
    console.log('\n📧 EMAIL (mode dev — configurez BREVO_API_KEY pour l\'envoyer vraiment)');
    console.log(`   À      : ${to}`);
    console.log(`   Sujet  : ${subject}`);
    console.log(`   Corps  :\n${text}\n`);
    return;
  }

  const body = JSON.stringify({
    sender: { name: FROM_NAME, email: FROM_EMAIL },
    to: [{ email: to }],
    subject,
    textContent: text,
  });

  await new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.brevo.com',
      path: '/v3/smtp/email',
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 400) reject(new Error(`Brevo ${res.statusCode}: ${data}`));
        else resolve();
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

const EVENT_TYPE_FR = {
  boxe: 'Boxe anglaise',
  condition: 'Condition physique',
  muscu: 'Musculation',
  sparring: 'Sparring',
  cardio: 'Cardio',
  combat: 'Combat officiel',
  recreant: 'Entraînement récréant'
};

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

async function sendEventInvitation(to, event) {
  const type = EVENT_TYPE_FR[event.type] || event.type;
  const sameDay = event.start_date === event.end_date;
  const dates = sameDay
    ? `Le ${formatDate(event.start_date)}`
    : `Du ${formatDate(event.start_date)} au ${formatDate(event.end_date)}`;

  await send({
    to,
    subject: `[Snatch Boxing Academy] Invitation — ${event.title}`,
    text: `Bonjour,

Vous êtes invité(e) à un événement organisé par votre coach à la Snatch Boxing Academy.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ${event.title.toUpperCase()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Type      : ${type}
  Date      : ${dates}
  Lieu      : ${event.location || 'Non précisé'}
${event.description ? `  Détails   : ${event.description}\n` : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Connectez-vous à votre espace sur la plateforme Snatch Boxing Academy pour consulter les détails.

À bientôt sur le ring !
L'équipe Snatch Boxing Academy
`,
  });
}

const MONTHS_FR = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];

async function sendPaymentReminder(to, { first_name, month, year }) {
  const monthLabel = MONTHS_FR[month - 1];
  const name = first_name ? `Bonjour ${first_name},` : 'Bonjour,';

  await send({
    to,
    subject: `[Snatch Boxing Academy] Rappel de paiement — ${monthLabel} ${year}`,
    text: `${name}

Nous vous contactons car votre cotisation du mois de ${monthLabel} ${year} n'a pas encore été réglée.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  RAPPEL DE PAIEMENT
  Mois : ${monthLabel} ${year}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Merci de régulariser votre situation dans les plus brefs délais.
En cas de doute, n'hésitez pas à contacter votre coach directement.

À bientôt sur le ring !
L'équipe Snatch Boxing Academy
`,
  });
}

async function sendEmailConfirmation(toEmail, firstName, confirmUrl) {
  const name = firstName || toEmail;

  await send({
    to: toEmail,
    subject: '[Snatch Boxing Academy] Confirmez votre nouvelle adresse email',
    text: `Bonjour ${name},

Vous avez demandé à changer votre adresse email sur Snatch Boxing Academy.

Cliquez sur le lien ci-dessous pour confirmer :
${confirmUrl}

Ce lien est valable 1 heure. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.

L'équipe Snatch Boxing Academy
`,
  });
}

const RSVP_FR = { accepted: 'accepté', declined: 'décliné' };

async function sendRsvpNotification(toEmail, { boxerName, eventTitle, status, eventDate }) {
  const statusFr = RSVP_FR[status] || status;

  await send({
    to: toEmail,
    subject: `[Snatch Boxing] ${boxerName} a ${statusFr} — ${eventTitle}`,
    text: `Bonjour,

${boxerName} a ${statusFr} l'invitation à l'événement suivant :

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ${eventTitle.toUpperCase()}
  Date : ${eventDate}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Connectez-vous à votre espace coach pour consulter l'état des réponses.

L'équipe Snatch Boxing Academy
`,
  });
}

module.exports = { sendEventInvitation, sendPaymentReminder, sendRsvpNotification, sendEmailConfirmation };
