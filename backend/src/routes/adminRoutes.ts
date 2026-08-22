import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/prisma';
import { authenticateJWT } from '../middleware/authenticateJWT';
import { authorizeRole } from '../middleware/authorizeRole';
import { AuthenticatedRequest } from '../middleware/authenticateJWT';
import { sendUserCreatedEmail } from '../services/emailService';

const router = Router();

// All admin routes require authentication + admin role
router.use(authenticateJWT, authorizeRole('admin'));

// GET /api/admin/users — List all users
router.get('/users', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        privilege: true,
        avatarUrl: true,
        mustChangePassword: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { createdAt: 'desc' }
    });
    // Normalisation : le rôle est sérialisé en minuscules (même convention que
    // /api/auth/login) pour que les filtres côté client fonctionnent directement.
    return res.json({
      users: users.map(u => ({
        ...u,
        role: String(u.role).toLowerCase(),
        privilege: u.privilege || 'FULL_ACCESS'
      }))
    });
  } catch (err) {
    console.error('Error listing users:', err);
    return res.status(500).json({ error: 'Erreur lors de la récupération des utilisateurs.' });
  }
});

const VALID_PRIVILEGES = ['READ', 'READ_WRITE', 'FULL_ACCESS'] as const;

function normalizePrivilege(input: unknown): 'READ' | 'READ_WRITE' | 'FULL_ACCESS' | null {
  const raw = String(input || '').trim().toUpperCase();
  return (VALID_PRIVILEGES as readonly string[]).includes(raw)
    ? (raw as 'READ' | 'READ_WRITE' | 'FULL_ACCESS')
    : null;
}

// POST /api/admin/users — Create a new user
router.post('/users', async (req: AuthenticatedRequest, res: Response) => {
  const { name, email, role, privilege } = req.body || {};

  if (!name || !email) {
    return res.status(400).json({ error: 'Nom et email requis.' });
  }

  const emailClean = email.toLowerCase().trim();
  if (!emailClean.includes('@')) {
    return res.status(400).json({ error: 'Adresse e-mail invalide.' });
  }

  // Pré-validation explicite : un doublon d'email renvoie un 400 métier clair
  // (le catch P2002 reste en filet de sécurité pour les courses concurrentes).
  try {
    const existing = await prisma.user.findUnique({ where: { email: emailClean }, select: { id: true } });
    if (existing) {
      return res.status(400).json({ error: 'Un compte avec cet email existe déjà' });
    }
  } catch (err) {
    console.error('Error checking duplicate email:', err);
    return res.status(500).json({ error: 'Erreur lors de la vérification de l\'e-mail.' });
  }

  const userRole = role === 'admin' ? 'ADMIN' : 'USER';
  const userPrivilege = userRole === 'ADMIN'
    ? 'FULL_ACCESS'
    : (privilege !== undefined ? normalizePrivilege(privilege) : 'FULL_ACCESS');

  if (privilege !== undefined && userRole !== 'ADMIN' && !userPrivilege) {
    return res.status(400).json({ error: 'Privilège invalide. Valeurs acceptées : READ, READ_WRITE, FULL_ACCESS.' });
  }

  // Generate a temporary password
  const tempPassword = `Temp${Math.random().toString(36).slice(2, 10)}!`;
  const passwordHash = bcrypt.hashSync(tempPassword, 10);

  try {
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: emailClean,
        passwordHash,
        role: userRole,
        privilege: userPrivilege || undefined,
        mustChangePassword: true
      },
      select: { id: true, email: true, name: true, role: true, privilege: true, createdAt: true }
    });

    // Send credentials email (best-effort)
    const emailSent = await sendUserCreatedEmail(user.email, user.name, tempPassword);
    if (!emailSent) {
      console.warn('[Admin] Failed to send credentials email to:', user.email, '. Temporary password:', tempPassword);
    }

    return res.status(201).json({
      user,
      temporaryPassword: tempPassword,
      message: 'Utilisateur créé. Un e-mail avec les identifiants a été envoyé.'
    });
  } catch (err: any) {
    if (err?.code === 'P2002') {
      return res.status(400).json({ error: 'Un compte avec cet email existe déjà' });
    }
    console.error('Error creating user:', err);
    return res.status(500).json({ error: 'Erreur lors de la création de l\'utilisateur.' });
  }
});

// PUT /api/admin/users/:id — Update privilege / role of an existing user
router.put('/users/:id', async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { privilege, role } = req.body || {};

  if (privilege === undefined && role === undefined) {
    return res.status(400).json({ error: 'Aucune modification fournie.' });
  }

  const data: { privilege?: 'READ' | 'READ_WRITE' | 'FULL_ACCESS'; role?: 'ADMIN' | 'USER' } = {};

  if (privilege !== undefined) {
    const normalized = normalizePrivilege(privilege);
    if (!normalized) {
      return res.status(400).json({ error: 'Privilège invalide. Valeurs acceptées : READ, READ_WRITE, FULL_ACCESS.' });
    }
    data.privilege = normalized;
  }

  if (role !== undefined) {
    if (role !== 'admin' && role !== 'user') {
      return res.status(400).json({ error: 'Rôle invalide. Valeurs acceptées : admin, user.' });
    }
    if (id === req.user!.id && role !== 'admin') {
      return res.status(400).json({ error: 'Vous ne pouvez pas retirer votre propre rôle administrateur.' });
    }
    data.role = role === 'admin' ? 'ADMIN' : 'USER';
  }

  try {
    const updated = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, email: true, name: true, role: true, privilege: true, mustChangePassword: true, lastLogin: true, createdAt: true, updatedAt: true }
    });
    return res.json({
      user: { ...updated, role: String(updated.role).toLowerCase(), privilege: updated.privilege || 'FULL_ACCESS' },
      message: 'Utilisateur mis à jour.'
    });
  } catch (err: any) {
    if (err?.code === 'P2025') {
      return res.status(404).json({ error: 'Utilisateur introuvable.' });
    }
    console.error('Error updating user:', err);
    return res.status(500).json({ error: 'Erreur lors de la mise à jour de l\'utilisateur.' });
  }
});

// DELETE /api/admin/users/:id — Delete a user (cannot delete yourself)
router.delete('/users/:id', async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  if (id === req.user!.id) {
    return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte.' });
  }

  try {
    await prisma.user.delete({ where: { id } });
    return res.json({ success: true, deletedId: id });
  } catch (err: any) {
    if (err?.code === 'P2025') {
      return res.status(404).json({ error: 'Utilisateur introuvable.' });
    }
    console.error('Error deleting user:', err);
    return res.status(500).json({ error: 'Erreur lors de la suppression.' });
  }
});

export default router;
