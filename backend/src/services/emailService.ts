import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  },
  connectionTimeout: 10000,
  greetingTimeout: 5000,
  socketTimeout: 15000
});

// Vérification silencieuse du transporteur SMTP, invoquée par le bootstrap
// (server.ts) avant d'accepter des requêtes : l'échec est journalisé sans
// bruit, le succès n'émet rien (hygiène des logs). L'import du module reste
// sans effet de bord (l'usage du secret ne doit pas bloquer les tests).
export async function verifySmtpTransport(): Promise<void> {
  try {
    await transporter.verify();
  } catch (err) {
    console.error('[EmailService] Gmail SMTP transporter verification failed:', err instanceof Error ? err.message : String(err));
  }
}

const FROM_ADDRESS = process.env.GMAIL_USER || 'noreply@gmail.com';

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<boolean> {
  const subject = 'Réinitialisation de votre mot de passe — ARSII CRM';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #005596; margin: 0 0 16px 0;">Réinitialisation de mot de passe</h2>
      <p style="font-size: 14px; color: #333; line-height: 1.6;">
        Vous avez demandé la réinitialisation de votre mot de passe.
      </p>
      <p style="font-size: 14px; color: #333; line-height: 1.6;">
        Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe.
        Ce lien expire dans <strong>1 heure</strong>.
      </p>
      <p style="text-align: center; margin: 32px 0;">
        <a href="${resetUrl}"
           style="background-color: #005596; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block;">
          Réinitialiser mon mot de passe
        </a>
      </p>
      <p style="font-size: 13px; color: #666; line-height: 1.5;">
        Si vous n'avez pas demandé cette réinitialisation, ignorez cet e-mail.
        Votre mot de passe restera inchangé.
      </p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
      <p style="font-size: 12px; color: #999; text-align: center; margin: 0;">
        ARSII CRM — Automate &amp; Research Solutions International Institute
      </p>
    </div>
  `;
  const text = [
    'Réinitialisation de mot de passe',
    '',
    'Vous avez demandé la réinitialisation de votre mot de passe.',
    `Cliquez sur le lien ci-dessous pour créer un nouveau mot de passe. Ce lien expire dans 1 heure.`,
    '',
    resetUrl,
    '',
    'Si vous n\'avez pas demandé cette réinitialisation, ignorez cet e-mail.',
    '',
    'ARSII CRM — Automate & Research Solutions International Institute'
  ].join('\n');

  try {
    await transporter.sendMail({ from: FROM_ADDRESS, to, subject, html, text });
    return true;
  } catch (err) {
    console.error('[EmailService] Failed to send password reset email:', err);
    return false;
  }
}

export async function sendUserCreatedEmail(to: string, name: string, temporaryPassword: string): Promise<boolean> {
  // Le lien d'invitation pointe vers la page de connexion avec le marqueur
  // ?invite=1 : si une session est déjà active, elle est fermée pour que
  // l'invité puisse se connecter avec ses propres identifiants.
  const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?invite=1`;
  const subject = 'Votre compte ARSII CRM a été créé — ARSII CRM';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #005596; margin: 0 0 16px 0;">Bienvenue sur ARSII CRM</h2>
      <p style="font-size: 14px; color: #333; line-height: 1.6;">
        Bonjour <strong>${name}</strong>,
      </p>
      <p style="font-size: 14px; color: #333; line-height: 1.6;">
        Un administrateur a créé votre compte. Voici vos identifiants de connexion :
      </p>
      <div style="background: #f4f6f8; border-radius: 8px; padding: 16px; margin: 20px 0; border: 1px solid #e2e8f0;">
        <p style="margin: 0 0 8px 0; font-size: 13px; color: #55636b;"><strong>E-mail :</strong></p>
        <p style="margin: 0 0 12px 0; font-size: 14px; color: #1c2529; font-family: monospace;">${to}</p>
        <p style="margin: 0 0 8px 0; font-size: 13px; color: #55636b;"><strong>Mot de passe temporaire :</strong></p>
        <p style="margin: 0; font-size: 14px; color: #1c2529; font-family: monospace;">${temporaryPassword}</p>
      </div>
      <p style="font-size: 13px; color: #666; line-height: 1.5;">
        À votre première connexion, vous serez invité à modifier votre mot de passe.
      </p>
      <p style="text-align: center; margin: 28px 0;">
        <a href="${loginUrl}"
           style="background-color: #005596; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block;">
          Se connecter
        </a>
      </p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
      <p style="font-size: 12px; color: #999; text-align: center; margin: 0;">
        ARSII CRM — Automate &amp; Research Solutions International Institute
      </p>
    </div>
  `;
  const text = [
    `Bienvenue sur ARSII CRM`,
    '',
    `Bonjour ${name},`,
    '',
    `Un administrateur a créé votre compte. Voici vos identifiants de connexion :`,
    '',
    `E-mail : ${to}`,
    `Mot de passe temporaire : ${temporaryPassword}`,
    '',
    `À votre première connexion, vous serez invité à modifier votre mot de passe.`,
    '',
    `Se connecter : ${loginUrl}`,
    '',
    'ARSII CRM — Automate & Research Solutions International Institute'
  ].join('\n');

  try {
    await transporter.sendMail({ from: FROM_ADDRESS, to, subject, html, text });
    return true;
  } catch (err) {
    console.error('[EmailService] Failed to send user created email:', err);
    return false;
  }
}
