const nodemailer = require('nodemailer');

let transporter;

function getTransporter() {
  if (transporter) return transporter;

  if (process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
  } else {
    // Dev mode: log to console
    transporter = {
      sendMail: async (opts) => {
        console.log('\n📧 EMAIL (mode dev — configurez SMTP dans .env pour l\'envoyer vraiment)');
        console.log(`   À      : ${opts.to}`);
        console.log(`   Sujet  : ${opts.subject}`);
        console.log(`   Corps  :\n${opts.text}\n`);
        return { messageId: 'dev-' + Date.now() };
      }
    };
  }
  return transporter;
}

const FROM = process.env.SMTP_FROM || '"Snatch Boxing Academy" <noreply@snatch-boxing.fr>';

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

  const subject = `[Snatch Boxing Academy] Invitation — ${event.title}`;
  const text = `Bonjour,

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
`;

  await getTransporter().sendMail({ from: FROM, to, subject, text });
}

const MONTHS_FR = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];

async function sendPaymentReminder(to, { first_name, month, year }) {
  const monthLabel = MONTHS_FR[month - 1];
  const name = first_name ? `Bonjour ${first_name},` : 'Bonjour,';

  const subject = `[Snatch Boxing Academy] Rappel de paiement — ${monthLabel} ${year}`;
  const text = `${name}

Nous vous contactons car votre cotisation du mois de ${monthLabel} ${year} n'a pas encore été réglée.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  RAPPEL DE PAIEMENT
  Mois : ${monthLabel} ${year}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Merci de régulariser votre situation dans les plus brefs délais.
En cas de doute, n'hésitez pas à contacter votre coach directement.

À bientôt sur le ring !
L'équipe Snatch Boxing Academy
`;

  await getTransporter().sendMail({ from: FROM, to, subject, text });
}

module.exports = { sendEventInvitation, sendPaymentReminder };
