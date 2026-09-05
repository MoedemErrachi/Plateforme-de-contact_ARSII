import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { prisma } from '../config/prisma';
import { authenticateJWT, AuthenticatedRequest } from '../middleware/authenticateJWT';
import { authorizeRole } from '../middleware/authorizeRole';
import { sendUserCreatedEmail } from '../services/emailService';

const router = Router();

// All admin routes require authentication + admin role
router.use(authenticateJWT, authorizeRole('admin'));

/**
 * @openapi
 * /api/admin/users:
 *   get:
 *     tags: [Admin]
 *     summary: Liste tous les utilisateurs
 *     description: Rôle admin requis.
 *     responses:
 *       '200':
 *         description: Liste des utilisateurs.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 users:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/User' }
 *       '403':
 *         description: Accès réservé aux administrateurs.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   post:
 *     tags: [Admin]
 *     summary: Crée un utilisateur (mot de passe temporaire)
 *     description: Rôle admin requis. Envoie un email best-effort avec les identifiants temporaires.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email]
 *             properties:
 *               name: { type: string, example: Amina Traoré }
 *               email: { type: string, format: email }
 *               role: { type: string, enum: [admin, user], default: user }
 *               privilege: { type: string, enum: [READ, READ_WRITE, FULL_ACCESS] }
 *     responses:
 *       '201':
 *         description: Utilisateur créé. `temporaryPassword` n'apparaît qu'en cas d'échec d'envoi d'email de secours.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user: { $ref: '#/components/schemas/User' }
 *                 temporaryPassword:
 *                   type: string
 *                   description: Mot de passe temporaire (message de secours).
 *                 message: { type: string }
 *       '400':
 *         description: Nom/email manquant, email invalide, privilège invalide ou email déjà utilisé.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 * /api/admin/users/{id}:
 *   put:
 *     tags: [Admin]
 *     summary: Met à jour le rôle / privilège d'un utilisateur
 *     description: Rôle admin requis. Il est impossible de retirer votre propre rôle admin.
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               privilege: { type: string, enum: [READ, READ_WRITE, FULL_ACCESS] }
 *               role: { type: string, enum: [admin, user] }
 *     responses:
 *       '200':
 *         description: Utilisateur mis à jour.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user: { $ref: '#/components/schemas/User' }
 *                 message: { type: string }
 *       '400':
 *         description: Aucune modification fournie, valeurs invalides, ou retrait de son propre rôle admin.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       '404':
 *         description: Utilisateur introuvable.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   delete:
 *     tags: [Admin]
 *     summary: Supprime un utilisateur
 *     description: Rôle admin requis. Impossible de supprimer son propre compte.
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       '200':
 *         description: Utilisateur supprimé.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 deletedId: { type: string, format: uuid }
 *       '400':
 *         description: Tentative de suppression de son propre compte.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       '404':
 *         description: Utilisateur introuvable.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

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
  const raw = (typeof input === 'string' ? input : '').trim().toUpperCase();
  return (VALID_PRIVILEGES as readonly string[]).includes(raw)
    ? (raw as 'READ' | 'READ_WRITE' | 'FULL_ACCESS')
    : null;
}

function resolveUserPrivilege(userRole: 'ADMIN' | 'USER', privilege: unknown): 'READ' | 'READ_WRITE' | 'FULL_ACCESS' | null | undefined {
  if (userRole === 'ADMIN') return 'FULL_ACCESS';
  if (privilege !== undefined) return normalizePrivilege(privilege);
  return 'FULL_ACCESS';
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
  const userPrivilege = resolveUserPrivilege(userRole, privilege);

  if (privilege !== undefined && userRole !== 'ADMIN' && !userPrivilege) {
    return res.status(400).json({ error: 'Privilège invalide. Valeurs acceptées : READ, READ_WRITE, FULL_ACCESS.' });
  }

  // Generate a temporary password
  const tempPassword = `Temp${crypto.randomBytes(6).toString('hex')}!`;
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
    sendUserCreatedEmail(user.email, user.name, tempPassword).catch(err =>
      console.warn('[Admin] Failed to send credentials email to:', user.email, '. Temporary password:', tempPassword, err)
    );

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

  const resolved = resolveUpdateData(privilege, role, req.user?.id, id);
  if ('error' in resolved) {
    return res.status(400).json({ error: resolved.error });
  }

  try {
    const updated = await prisma.user.update({
      where: { id },
      data: resolved.data,
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

function resolveUpdateData(
  privilege: unknown,
  role: unknown,
  currentUserId: string | undefined,
  targetId: string
): { ok: true; data: { privilege?: 'READ' | 'READ_WRITE' | 'FULL_ACCESS'; role?: 'ADMIN' | 'USER' } } | { ok: false; error: string } {
  if (privilege === undefined && role === undefined) {
    return { ok: false, error: 'Aucune modification fournie.' };
  }

  const data: { privilege?: 'READ' | 'READ_WRITE' | 'FULL_ACCESS'; role?: 'ADMIN' | 'USER' } = {};

  if (privilege !== undefined) {
    const normalized = normalizePrivilege(privilege);
    if (!normalized) {
      return { ok: false, error: 'Privilège invalide. Valeurs acceptées : READ, READ_WRITE, FULL_ACCESS.' };
    }
    data.privilege = normalized;
  }

  if (role !== undefined) {
    if (role !== 'admin' && role !== 'user') {
      return { ok: false, error: 'Rôle invalide. Valeurs acceptées : admin, user.' };
    }
    if (targetId === currentUserId && role !== 'admin') {
      return { ok: false, error: 'Vous ne pouvez pas retirer votre propre rôle administrateur.' };
    }
    data.role = role === 'admin' ? 'ADMIN' : 'USER';
  }

  return { ok: true, data };
}

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
