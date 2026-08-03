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

module.exports = { sendInvitation };
