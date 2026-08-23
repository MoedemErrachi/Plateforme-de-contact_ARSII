import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/prisma';
import { authenticateJWT, setAuthCookie, clearAuthCookie, AuthenticatedRequest } from '../middleware/authenticateJWT';
import { issueCsrfToken, isValidSignedCsrfToken } from '../middleware/security';
import { sendPasswordResetEmail } from '../services/emailService';
import crypto from 'crypto';

const router = Router();

// GET /api/auth/csrf-token (Retrieve or issue CSRF Token)
router.get('/csrf-token', (req, res) => {
  // csrfProtection a déjà validé/émis le cookie : on renvoie exactement sa valeur.
  let token = res.locals?.csrfToken ?? req.cookies?.['XSRF-TOKEN'];
  if (!isValidSignedCsrfToken(token)) {
    token = issueCsrfToken();
    res.cookie('XSRF-TOKEN', token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000
    });
  }
  return res.json({ csrfToken: token });
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password, rememberMe } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis.' });
  }

  let user = null;
  try {
    user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() }
    });
  } catch (err) {
    console.error('Error querying user in login:', err);
    return res.status(500).json({ error: 'Erreur lors de l\'authentification base de données.' });
  }

  if (!user || !user.passwordHash) {
    return res.status(401).json({ error: 'Identifiants invalides (email ou mot de passe incorrect).' });
  }

  const isPasswordValid = bcrypt.compareSync(password, user.passwordHash);
  if (!isPasswordValid) {
    return res.status(401).json({ error: 'Identifiants invalides (email ou mot de passe incorrect).' });
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } }).catch(() => {});

  const userRole = String(user.role).toLowerCase() === 'admin' ? 'admin' : 'user';
  const userPrivilege = user.role === 'ADMIN' ? 'FULL_ACCESS' : String(user.privilege || 'FULL_ACCESS');

  const userPayload = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: userRole,
    privilege: userPrivilege,
    avatarUrl: user.avatarUrl || null
  };

  const token = setAuthCookie(res, { ...userPayload, tokenVersion: user.tokenVersion }, Boolean(rememberMe));

  return res.json({
    success: true,
    user: { ...userPayload, isFirstLogin: user.mustChangePassword },
    token
  });
});

// GET /api/auth/me (Get current session with fresh user data from DB)
router.get('/me', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { id: true, email: true, name: true, role: true, avatarUrl: true, mustChangePassword: true, privilege: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'Utilisateur introuvable.' });
    }

    const userRole = String(user.role).toLowerCase() === 'admin' ? 'admin' : 'user';
    const userPrivilege = user.role === 'ADMIN' ? 'FULL_ACCESS' : String(user.privilege || 'FULL_ACCESS');

    const userPayload = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: userRole,
      privilege: userPrivilege,
      avatarUrl: user.avatarUrl || null
    };

    // Aucune ré-émission de jeton ici : prolonger la session à chaque refresh
    // transformerait une connexion « 8h » en session perpétuelle et dégraderait
    // le cookie « Se souvenir de moi » (7j) en jeton court. Le client conserve
    // son jeton/cookie d'origine jusqu'à leur expiration réelle.
    return res.json({
      authenticated: true,
      user: { ...userPayload },
      mustChangePassword: user.mustChangePassword
    });
  } catch (err) {
    console.error('Error fetching current user:', err);
    return res.status(500).json({ error: 'Erreur lors de la récupération du profil.' });
  }
});

// PUT /api/auth/profile (Update name / email / avatarUrl of current user)
router.put('/profile', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  const { name, email, avatarUrl } = req.body || {};
  const userId = req.user!.id;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Le nom complet est requis.' });
  }

  const dataToUpdate: any = { name: name.trim() };

  if (typeof email === 'string' && email.trim()) {
    const emailClean = email.trim().toLowerCase();
    if (!emailClean.includes('@')) {
      return res.status(400).json({ error: 'Adresse e-mail invalide.' });
    }
    const duplicate = await prisma.user.findFirst({
      where: { email: emailClean, id: { not: userId } }
    });
    if (duplicate) {
      return res.status(409).json({ error: 'Un autre utilisateur utilise déjà cet e-mail.' });
    }
    dataToUpdate.email = emailClean;
  }

  if (typeof avatarUrl === 'string') {
    dataToUpdate.avatarUrl = avatarUrl || null;
  }

  try {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: dataToUpdate,
      select: { id: true, email: true, name: true, role: true, avatarUrl: true }
    });

    const userRole = String(updated.role).toLowerCase() === 'admin' ? 'admin' : 'user';
    const userPayload = {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      role: userRole
    };

    // Ré-émission nécessaire (les claims nom/rôle/email changent) mais on
    // préserve le tokenVersion courant, sinon le nouveau cookie serait rejeté
    // par authenticateJWT (TOKEN_VERSION_MISSING).
    setAuthCookie(res, { ...userPayload, tokenVersion: req.user?.tokenVersion });

    return res.json({
      success: true,
      user: { ...userPayload, avatarUrl: updated.avatarUrl || null }
    });
  } catch (err) {
    console.error('Error updating profile:', err);
    return res.status(500).json({ error: 'Erreur lors de la mise à jour du profil.' });
  }
});

// PUT /api/auth/change-password (Authenticated user changes their own password)
router.put('/change-password', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    const userId = req.user!.id;

    if (!newPassword) {
      return res.status(400).json({ error: 'Nouveau mot de passe requis.' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Le nouveau mot de passe doit contenir au moins 8 caractères.' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.passwordHash) {
      return res.status(404).json({ error: 'Utilisateur introuvable.' });
    }

    // Première connexion : l'utilisateur vient de prouver son identité au login
    // avec le mot de passe temporaire ; exiger de le ressaisir serait redondant.
    const isFirstLogin = user.mustChangePassword === true;
    if (!isFirstLogin || typeof currentPassword === 'string' && currentPassword.length > 0) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Mot de passe actuel et nouveau mot de passe requis.' });
      }
      const isPasswordValid = bcrypt.compareSync(currentPassword, user.passwordHash);
      if (!isPasswordValid) {
        // 400 (et non 401) : la session est valide, c'est la saisie qui est
        // fausse — un 401 déclencherait la purge de session côté client.
        return res.status(400).json({ error: 'Mot de passe actuel incorrect.' });
      }
    }

    const newHash = bcrypt.hashSync(newPassword, 10);
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash, tokenVersion: user.tokenVersion + 1, mustChangePassword: false },
      select: { id: true, email: true, name: true, role: true, privilege: true, avatarUrl: true, tokenVersion: true }
    });

    const userRole = String(updated.role).toLowerCase() === 'admin' ? 'admin' : 'user';
    const userPayload = {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      role: userRole,
      avatarUrl: updated.avatarUrl || null,
      tokenVersion: updated.tokenVersion
    };

    const freshToken = setAuthCookie(res, userPayload);

    // Un nouveau JWT est émis : l'ancien jeton (version précédente) est
    // invalidé côté serveur, le client doit remplacer sa copie locale.
    return res.json({ success: true, message: 'Mot de passe modifié avec succès.', token: freshToken });
  } catch (err) {
    console.error('Error changing password:', err);
    return res.status(500).json({ error: 'Erreur lors du changement de mot de passe.' });
  }
});

// POST /api/auth/first-login/acknowledge (« Passer » sur l'invite de première connexion)
router.post('/first-login/acknowledge', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { mustChangePassword: false }
    });
    return res.json({ success: true });
  } catch (err) {
    console.error('Error acknowledging first login:', err);
    return res.status(500).json({ error: 'Erreur lors de la validation de la première connexion.' });
  }
});

// POST /api/auth/forgot-password (Request a password reset email)
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body || {};

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Adresse e-mail requise.' });
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });

    if (!user) {
      return res.json({ success: true, message: 'Si un compte existe avec cette adresse, un e-mail de réinitialisation a été envoyé.' });
    }

    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, used: false },
      data: { used: true }
    });

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.passwordResetToken.create({
      data: { token, userId: user.id, expiresAt }
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetUrl = `${frontendUrl}/reset-password/${token}`;

    sendPasswordResetEmail(user.email, resetUrl).catch(err =>
      console.error('[Auth] Failed to send password reset email to:', user.email, err)
    );

    return res.json({ success: true, message: 'Si un compte existe avec cette adresse, un e-mail de réinitialisation a été envoyé.' });
  } catch (err) {
    console.error('Error in forgot-password:', err);
    return res.status(500).json({ error: 'Erreur lors de la demande de réinitialisation.' });
  }
});

// POST /api/auth/reset-password (Reset password using token from email)
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body || {};

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token et nouveau mot de passe requis.' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Le nouveau mot de passe doit contenir au moins 8 caractères.' });
    }

    const resetToken = await prisma.passwordResetToken.findUnique({ where: { token } });

    if (!resetToken || resetToken.used || resetToken.expiresAt < new Date()) {
      return res.status(400).json({ error: 'Lien de réinitialisation invalide ou expiré. Veuillez en demander un nouveau.' });
    }

    const newHash = bcrypt.hashSync(newPassword, 10);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash: newHash, tokenVersion: { increment: 1 } }
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { used: true }
      })
    ]);

    return res.json({ success: true, message: 'Mot de passe réinitialisé avec succès. Vous pouvez maintenant vous connecter.' });
  } catch (err) {
    console.error('Error in reset-password:', err);
    return res.status(500).json({ error: 'Erreur lors de la réinitialisation du mot de passe.' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  return res.json({ success: true, message: 'Déconnexion réussie.' });
});

export default router;
