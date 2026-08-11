const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

async function sendInvitation(toEmail, firstName, tempPassword) {
  const name = firstName || toEmail;
  await transporter.sendMail({
    from: `"Snatch Boxing Academy" <${process.env.MAIL_USER}>`,
    to: toEmail,
    subject: 'Bienvenue à Snatch Boxing Academy',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;background:#080808;color:#fff;padding:32px;border-radius:12px">
        <h2 style="color:#C9A020;margin-bottom:8px">Snatch Boxing Academy</h2>
        <p>Bonjour ${name},</p>
        <p>Votre coach vous a inscrit sur l'application Snatch Boxing Academy.</p>
        <p>Voici vos identifiants de connexion :</p>
        <div style="background:#1a1a1a;border:1px solid #C9A020;border-radius:8px;padding:16px;margin:20px 0">
          <p style="margin:4px 0"><strong>Email :</strong> ${toEmail}</p>
          <p style="margin:4px 0"><strong>Mot de passe temporaire :</strong> <code style="color:#C9A020">${tempPassword}</code></p>
        </div>
        <p>Connectez-vous et changez votre mot de passe dès votre première connexion.</p>
        <p style="color:#888;font-size:12px;margin-top:32px">Snatch Boxing Academy</p>
      </div>
    `,
  });
}

async function sendEmailConfirmation(toEmail, firstName, confirmUrl) {
  const name = firstName || toEmail;
  await transporter.sendMail({
    from: `"Snatch Boxing Academy" <${process.env.MAIL_USER}>`,
    to: toEmail,
    subject: 'Confirmez votre nouvelle adresse email',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;background:#080808;color:#fff;padding:32px;border-radius:12px">
        <h2 style="color:#C9A020;margin-bottom:8px">Snatch Boxing Academy</h2>
        <p>Bonjour ${name},</p>
        <p>Vous avez demandé à changer votre adresse email. Cliquez sur le bouton ci-dessous pour confirmer.</p>
        <a href="${confirmUrl}" style="display:inline-block;margin:20px 0;padding:14px 28px;background:#C9A020;color:#000;font-weight:700;border-radius:8px;text-decoration:none">
          Confirmer mon email
        </a>
        <p style="color:#888;font-size:13px">Ce lien est valable 1 heure. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
        <p style="color:#888;font-size:12px;margin-top:32px">Snatch Boxing Academy</p>
      </div>
    `,
  });
}

module.exports = { sendInvitation, sendEmailConfirmation };
