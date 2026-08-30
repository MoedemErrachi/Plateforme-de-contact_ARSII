import { Router, Request, Response, NextFunction } from 'express';
import { getSegments, createSegment, updateSegment, deleteSegment, setTagContacts } from '../controllers/segmentController';
import { prisma } from '../config/prisma';
import { requirePrivilege } from '../middleware/authorizeRole';
import { validate } from '../middleware/validate';
import {
  createSegmentSchema,
  updateSegmentSchema,
  deleteSegmentSchema,
  createTagSchema,
  updateTagSchema,
  deleteTagSchema,
  setTagContactsSchema
} from '../validators/segmentValidator';

/**
 * @openapi
 * /api/segments:
 *   get:
 *     tags: [Segments & Tags]
 *     summary: Liste les segments et les étiquettes
 *     description: Renvoie les segments (avec comptage de membres) et toutes les étiquettes (avec nombre de contacts).
 *     responses:
 *       '200':
 *         description: Segments et étiquettes.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, enum: [success] }
 *                 data:
 *                   type: object
 *                   properties:
 *                     segments:
 *                       type: array
 *                       items:
 *                         allOf:
 *                           - $ref: '#/components/schemas/Segment'
 *                           - type: object
 *                             properties:
 *                               memberCount: { type: integer, description: Nombre réel de contacts du segment }
 *                     tags:
 *                       type: array
 *                       items:
 *                         allOf:
 *                           - $ref: '#/components/schemas/Tag'
 *                           - type: object
 *                             properties:
 *                               _count:
 *                                 type: object
 *                                 properties:
 *                                   contacts: { type: integer }
 *   post:
 *     tags: [Segments & Tags]
 *     summary: Crée un segment
 *     description: Nécessite `READ_WRITE`.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string, example: Chercheurs UCAD }
 *               description: { type: string }
 *               icon: { type: string, default: Filter }
 *               filters:
 *                 type: object
 *                 description: Filtres sauvegardés (search, countries, genders, careerStages, tags).
 *                 additionalProperties: true
 *     responses:
 *       '201':
 *         description: Segment créé.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, enum: [success] }
 *                 data:
 *                   type: object
 *                   properties:
 *                     segment: { $ref: '#/components/schemas/Segment' }
 *       '400':
 *         description: Nom requis.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 * /api/segments/{id}:
 *   put:
 *     tags: [Segments & Tags]
 *     summary: Met à jour un segment
 *     description: Nécessite `READ_WRITE`.
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
 *               name: { type: string }
 *               description: { type: string, nullable: true }
 *               icon: { type: string }
 *               filters: { type: object, additionalProperties: true }
 *     responses:
 *       '200':
 *         description: Segment mis à jour.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, enum: [success] }
 *                 data:
 *                   type: object
 *                   properties:
 *                     segment: { $ref: '#/components/schemas/Segment' }
 *       '404':
 *         description: Segment introuvable.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   delete:
 *     tags: [Segments & Tags]
 *     summary: Supprime un segment
 *     description: Nécessite `FULL_ACCESS`.
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       '200':
 *         description: Segment supprimé.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, enum: [success] }
 *                 data:
 *                   type: object
 *                   properties:
 *                     success: { type: boolean, example: true }
 *       '404':
 *         description: Segment introuvable.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 * /api/segments/tags:
 *   get:
 *     tags: [Segments & Tags]
 *     summary: Liste toutes les étiquettes
 *     responses:
 *       '200':
 *         description: Liste triée par nom.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, enum: [success] }
 *                 data:
 *                   type: object
 *                   properties:
 *                     tags:
 *                       type: array
 *                       items:
 *                         allOf:
 *                           - $ref: '#/components/schemas/Tag'
 *                           - type: object
 *                             properties:
 *                               _count:
 *                                 type: object
 *                                 properties:
 *                                   contacts: { type: integer }
 *   post:
 *     tags: [Segments & Tags]
 *     summary: Crée une étiquette
 *     description: Nécessite `READ_WRITE`. La couleur est attribuée aléatoirement si absente.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string, example: Chercheur invité }
 *               color: { type: string, description: Classe Tailwind de couleur du badge }
 *               description: { type: string, nullable: true }
 *     responses:
 *       '201':
 *         description: Étiquette créée.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, enum: [success] }
 *                 data:
 *                   type: object
 *                   properties:
 *                     tag: { $ref: '#/components/schemas/Tag' }
 * /api/segments/tags/{id}:
 *   put:
 *     tags: [Segments & Tags]
 *     summary: Met à jour une étiquette
 *     description: Nécessite `READ_WRITE`.
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
 *               name: { type: string }
 *               color: { type: string }
 *               description: { type: string, nullable: true }
 *     responses:
 *       '200':
 *         description: Étiquette mise à jour.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, enum: [success] }
 *                 data:
 *                   type: object
 *                   properties:
 *                     tag: { $ref: '#/components/schemas/Tag' }
 *   delete:
 *     tags: [Segments & Tags]
 *     summary: Supprime une étiquette
 *     description: Nécessite `FULL_ACCESS`.
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       '200':
 *         description: Étiquette supprimée.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, enum: [success] }
 *                 data:
 *                   type: object
 *                   properties:
 *                     success: { type: boolean, example: true }
 * /api/segments/tags/{id}/contacts:
 *   put:
 *     tags: [Segments & Tags]
 *     summary: Affecte des contacts à une étiquette (remplace l'existant)
 *     description: Nécessite `READ_WRITE`. La liste donnée remplace intégralement les affectations actuelles.
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Identifiant de l'étiquette.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [contactIds]
 *             properties:
 *               contactIds:
 *                 type: array
 *                 items: { type: string, format: uuid }
 *     responses:
 *       '200':
 *         description: Étiquette avec ses contacts affectés.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, enum: [success] }
 *                 data:
 *                   type: object
 *                   properties:
 *                     tag: { $ref: '#/components/schemas/Tag' }
 *       '400':
 *         description: "`contactIds` doit être un tableau."
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       '404':
 *         description: Étiquette introuvable.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

const router = Router();

const TAG_COLORS = [
  'bg-emerald-100 text-emerald-800 border-emerald-300',
  'bg-[#005596]/15 text-[#005596] border-[#005596]/30',
  'bg-[#B8167C]/15 text-[#B8167C] border-[#B8167C]/30',
  'bg-amber-100 text-amber-800 border-amber-300',
  'bg-rose-100 text-rose-800 border-rose-300',
  'bg-blue-100 text-blue-800 border-blue-300',
  'bg-cyan-100 text-cyan-800 border-cyan-300',
  'bg-purple-100 text-purple-800 border-purple-300',
  'bg-slate-100 text-slate-800 border-slate-300',
];

function randomTagColor(): string {
  return TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
}

// Segment routes
router.get('/', getSegments);
router.post('/', requirePrivilege('READ_WRITE'), validate(createSegmentSchema), createSegment);
router.put('/:id', requirePrivilege('READ_WRITE'), validate(updateSegmentSchema), updateSegment);
router.delete('/:id', requirePrivilege('FULL_ACCESS'), validate(deleteSegmentSchema), deleteSegment);

// Tag CRUD routes under /api/segments/tags
router.get('/tags', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tags = await prisma.tag.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { contacts: true } } }
    });
    res.status(200).json({ status: 'success', data: { tags } });
  } catch (error) { next(error); }
});

router.post('/tags', requirePrivilege('READ_WRITE'), validate(createTagSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, color, description } = req.body;
    const tag = await prisma.tag.create({
      data: { name, color: color || randomTagColor(), description }
    });
    res.status(201).json({ status: 'success', data: { tag } });
  } catch (error) { next(error); }
});

router.put('/tags/:id', requirePrivilege('READ_WRITE'), validate(updateTagSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, color, description } = req.body;
    const tag = await prisma.tag.update({
      where: { id },
      data: { name, color, description }
    });
    res.status(200).json({ status: 'success', data: { tag } });
  } catch (error) { next(error); }
});

router.delete('/tags/:id', requirePrivilege('FULL_ACCESS'), validate(deleteTagSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await prisma.tag.delete({ where: { id } });
    res.status(200).json({ status: 'success', data: { success: true } });
  } catch (error) { next(error); }
});

router.put('/tags/:id/contacts', requirePrivilege('READ_WRITE'), validate(setTagContactsSchema), setTagContacts);

export default router;
