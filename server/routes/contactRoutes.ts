import { Router } from 'express';
import {
  getContacts,
  getContactById,
  getDistinctCountries,
  countContactsByEmailPattern,
  createContact,
  updateContact,
  deleteContact,
  bulkSaveContacts,
  importContacts,
  exportContacts
} from '../controllers/contactController';
import { validate } from '../middleware/validate';
import { authenticateJWT } from '../middleware/authenticateJWT';
import {
  createContactSchema,
  updateContactSchema,
  deleteContactSchema,
  getContactByIdSchema,
  queryContactSchema,
  importContactsSchema,
  exportQuerySchema,
  countContactsQuerySchema
} from '../validators/contactValidator';
import { importRateLimiter } from '../middleware/security';
import { validateFileUpload } from '../middleware/fileValidation';

const router = Router();

router.get('/', validate(queryContactSchema), getContacts);
router.post('/', validate(createContactSchema), createContact);
router.post('/bulk', authenticateJWT, bulkSaveContacts);
router.post('/import', importRateLimiter, validateFileUpload, validate(importContactsSchema), importContacts);
router.get('/export', authenticateJWT, validate(exportQuerySchema), exportContacts);
router.get('/countries', getDistinctCountries);
router.get('/count', validate(countContactsQuerySchema), countContactsByEmailPattern);
router.get('/:id', validate(getContactByIdSchema), getContactById);
router.put('/:id', validate(updateContactSchema), updateContact);
router.delete('/:id', validate(deleteContactSchema), deleteContact);

export default router;
