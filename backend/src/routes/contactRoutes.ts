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
