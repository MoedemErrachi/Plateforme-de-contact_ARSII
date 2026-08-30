import { Router } from 'express';
import {
  getContacts,
  getContactById,
  getDistinctCountries,
  countContactsByEmailPattern,
  createContact,
  updateContact,
  deleteContact,
  bulkDeleteContacts,
  bulkSaveContacts,
  exportContacts,
  importContacts
} from '../controllers/contactController';
import { validate } from '../middleware/validate';
import { authenticateJWT } from '../middleware/authenticateJWT';
import { requirePrivilege } from '../middleware/authorizeRole';
import { importRateLimiter } from '../middleware/security';
import { validateBulkImportPayload } from '../middleware/fileValidation';
import {
  createContactSchema,
  updateContactSchema,
  deleteContactSchema,
  bulkDeleteContactsSchema,
  getContactByIdSchema,
  queryContactSchema,
  exportQuerySchema,
  countContactsQuerySchema,
  bulkSaveContactsSchema,
  importContactsSchema
} from '../validators/contactValidator';

/**
 * @openapi
 * /api/contacts:
 *   get:
 *     tags: [Contacts]
 *     summary: Liste les contacts (paginé, filtrable)
 *     description: Retourne une page de contacts. `careerStage` est l'ancien alias de `researchCareerStage`.
 *     parameters:
 *       - name: page
 *         in: query
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - name: limit
 *         in: query
 *         schema: { type: integer, minimum: 1, maximum: 10000, default: 20 }
 *       - name: search
 *         in: query
 *         schema:
 *           type: string
 *           description: Recherche plein texte (nom, email, affiliation…)
 *       - name: countryOfOrigin
 *         in: query
 *         schema:
 *           oneOf:
 *             - { type: string }
 *             - { type: array, items: { type: string } }
 *         style: form
 *         explode: false
 *         description: "Filtre par pays d'origine (répétable: countryOfOrigin=Sénégal&countryOfOrigin=Mali)"
 *       - name: gender
 *         in: query
 *         schema:
 *           oneOf:
 *             - $ref: '#/components/schemas/Gender'
 *             - { type: array, items: { $ref: '#/components/schemas/Gender' } }
 *         style: form
 *         explode: false
 *       - name: researchCareerStage
 *         in: query
 *         description: Filtre par stade de carrière (alias `careerStage`).
 *         schema:
 *           oneOf:
 *             - $ref: '#/components/schemas/CareerStage'
 *             - { type: array, items: { $ref: '#/components/schemas/CareerStage' } }
 *         style: form
 *         explode: false
 *       - name: careerStage
 *         in: query
 *         description: Alias legacy de `researchCareerStage`.
 *         schema:
 *           oneOf:
 *             - $ref: '#/components/schemas/CareerStage'
 *             - { type: array, items: { $ref: '#/components/schemas/CareerStage' } }
 *         style: form
 *         explode: false
 *       - name: affiliation
 *         in: query
 *         schema: { type: string }
 *       - name: facultyDepartment
 *         in: query
 *         schema: { type: string }
 *       - name: tagId
 *         in: query
 *         schema:
 *           oneOf:
 *             - { type: string, format: uuid }
 *             - { type: array, items: { type: string, format: uuid } }
 *         style: form
 *         explode: false
 *         description: Filtre par étiquette.
 *       - name: segmentId
 *         in: query
 *         schema: { type: string, format: uuid }
 *         description: Filtre par segment.
 *     responses:
 *       '200':
 *         description: Page de contacts.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ContactListResponse'
 *       '401':
 *         description: Jeton manquant ou invalide.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   post:
 *     tags: [Contacts]
 *     summary: Crée un contact
 *     description: Nécessite le privilège `READ_WRITE`. Email unique (409 si déjà existant).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ContactWrite'
 *     responses:
 *       '201':
 *         description: Contact créé.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ContactSingleResponse'
 *       '400':
 *         description: Validation échouée (nom ou email requis).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       '409':
 *         description: Un contact avec cet email existe déjà.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 * /api/contacts/bulk:
 *   post:
 *     tags: [Contacts]
 *     summary: Crée et/ou met à jour des contacts en masse (import)
 *     description: Requiert `READ_WRITE`. Limité à 10 requêtes/heure/IP. Max 10 000 contacts par opération.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               newContacts:
 *                 type: array
 *                 items: { $ref: '#/components/schemas/ContactWrite' }
 *                 description: Contacts à créer (identifiés par email unique).
 *               updatedContacts:
 *                 type: array
 *                 description: Contacts à mettre à jour (le champ `id` est requis).
 *                 items:
 *                   allOf:
 *                     - { type: object, required: [id], properties: { id: { type: string, format: uuid } } }
 *                     - $ref: '#/components/schemas/ContactWrite'
 *     responses:
 *       '200':
 *         description: Traitement terminé. Consultez la réponse pour le détail créé/mis à jour/ignoré.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, enum: [success] }
 *                 data:
 *                   type: object
 *                   properties:
 *                     createdCount: { type: integer }
 *                     updatedCount: { type: integer }
 *                     skippedCount: { type: integer }
 *                     errors: { type: array, items: { type: object } }
 *       '400':
 *         description: Payload invalide (aucun contact fourni).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   delete:
 *     tags: [Contacts]
 *     summary: Supprime plusieurs contacts (max 500)
 *     description: Requiert le privilège `FULL_ACCESS`.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ids]
 *             properties:
 *               ids:
 *                 type: array
 *                 maxItems: 500
 *                 items: { type: string, format: uuid }
 *     responses:
 *       '200':
 *         description: Contacts supprimés.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, enum: [success] }
 *                 data:
 *                   type: object
 *                   properties:
 *                     deletedCount: { type: integer }
 * /api/contacts/bulk/preview:
 *   post:
 *     tags: [Contacts]
 *     summary: Prévisualise un import (détection nouveau / doublon / erreur)
 *     description: Validation asynchrone des lignes avant import réel. Requiert `READ_WRITE`.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rows]
 *             properties:
 *               rows:
 *                 type: array
 *                 items: { $ref: '#/components/schemas/ContactWrite' }
 *     responses:
 *       '200':
 *         description: Résultat du préview.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, enum: [success] }
 *                 data:
 *                   type: object
 *                   properties:
 *                     newCount: { type: integer }
 *                     duplicateCount: { type: integer }
 *                     errorCount: { type: integer }
 *                     preview: { type: array, items: { type: object } }
 * /api/contacts/export:
 *   get:
 *     tags: [Contacts]
 *     summary: Exporte les contacts (CSV / JSON / XLSX)
 *     description: Filtres identiques à `GET /api/contacts`. CSV/XLSX renvoient un téléchargement, JSON un objet.
 *     parameters:
 *       - name: format
 *         in: query
 *         schema: { type: string, enum: [csv, json, xlsx], default: csv }
 *       - name: ids
 *         in: query
 *         schema:
 *           oneOf:
 *             - { type: string }
 *             - { type: array, items: { type: string } }
 *         style: form
 *         explode: false
 *         description: Identifiants précis à exporter (sélection).
 *       - name: fields
 *         in: query
 *         schema:
 *           oneOf:
 *             - { type: string }
 *             - { type: array, items: { type: string } }
 *         style: form
 *         explode: false
 *         description: Colonnes à inclure (email, firstName, lastName, gender, countryOfOrigin, city, phone, affiliation, function, experience, facultyDepartment, researchCareerStage).
 *       - name: includeTags
 *         in: query
 *         schema: { type: string, enum: ['true', 'false'] }
 *         description: Ajoute une colonne `tags`.
 *     responses:
 *       '200':
 *         description: Fichier exporté (CSV/XLSX) ou JSON.
 *         headers:
 *           X-Export-Count:
 *             schema: { type: integer }
 *       '401':
 *         description: Jeton manquant ou invalide.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 * /api/contacts/countries:
 *   get:
 *     tags: [Contacts]
 *     summary: Liste les pays d'origine distincts
 *     responses:
 *       '200':
 *         description: Pays distincts.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, enum: [success] }
 *                 data:
 *                   type: object
 *                   properties:
 *                     countries:
 *                       type: array
 *                       items: { type: string }
 * /api/contacts/count:
 *   get:
 *     tags: [Contacts]
 *     summary: Compte les contacts correspondant à un motif d'email
 *     parameters:
 *       - name: email_pattern
 *         in: query
 *         required: true
 *         schema: { type: string, description: 'Sous-chaîne de l''email à rechercher (ex: ucad.sn)' }
 *     responses:
 *       '200':
 *         description: Nombre de correspondances.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, enum: [success] }
 *                 data:
 *                   type: object
 *                   properties:
 *                     count: { type: integer }
 * /api/contacts/{id}:
 *   get:
 *     tags: [Contacts]
 *     summary: Récupère un contact par son identifiant
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       '200':
 *         description: Contact.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ContactSingleResponse'
 *       '404':
 *         description: Contact introuvable.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   put:
 *     tags: [Contacts]
 *     summary: Met à jour un contact
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
 *             $ref: '#/components/schemas/ContactWrite'
 *     responses:
 *       '200':
 *         description: Contact mis à jour.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ContactSingleResponse'
 *       '400':
 *         description: Email invalide.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       '409':
 *         description: Email déjà utilisé par un autre contact.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   delete:
 *     tags: [Contacts]
 *     summary: Supprime un contact
 *     description: Nécessite `FULL_ACCESS`.
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       '200':
 *         description: Contact supprimé.
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
 *         description: Contact introuvable.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

const router = Router();

router.get('/', validate(queryContactSchema), getContacts);
router.post('/', requirePrivilege('READ_WRITE'), validate(createContactSchema), createContact);
router.post('/bulk', authenticateJWT, importRateLimiter, requirePrivilege('READ_WRITE'), validateBulkImportPayload, validate(bulkSaveContactsSchema), bulkSaveContacts);
router.post('/bulk/preview', authenticateJWT, importRateLimiter, requirePrivilege('READ_WRITE'), validate(importContactsSchema), importContacts);
// La route /bulk (DELETE) doit être déclarée avant /:id pour éviter toute capture.
router.delete('/bulk', authenticateJWT, requirePrivilege('FULL_ACCESS'), validate(bulkDeleteContactsSchema), bulkDeleteContacts);
router.get('/export', authenticateJWT, validate(exportQuerySchema), exportContacts);
router.get('/countries', getDistinctCountries);
router.get('/count', validate(countContactsQuerySchema), countContactsByEmailPattern);
router.get('/:id', validate(getContactByIdSchema), getContactById);
router.put('/:id', requirePrivilege('READ_WRITE'), validate(updateContactSchema), updateContact);
router.delete('/:id', requirePrivilege('FULL_ACCESS'), validate(deleteContactSchema), deleteContact);

export default router;
