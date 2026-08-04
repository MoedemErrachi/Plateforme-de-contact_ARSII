import { Router } from 'express';
import { 
  getContacts, 
  getContactById, 
  createContact, 
  updateContact, 
  importContacts 
} from '../controllers/contactController';
import { validate } from '../middleware/validate';
import { 
  createContactSchema, 
  updateContactSchema, 
  getContactByIdSchema, 
  queryContactSchema, 
  importContactsSchema 
} from '../validators/contactValidator';
import { importRateLimiter } from '../middleware/security';
import { validateFileUpload } from '../middleware/fileValidation';

const router = Router();

router.get('/', validate(queryContactSchema), getContacts);
router.post('/', validate(createContactSchema), createContact);
router.post('/import', importRateLimiter, validateFileUpload, validate(importContactsSchema), importContacts);
router.get('/:id', validate(getContactByIdSchema), getContactById);
router.put('/:id', validate(updateContactSchema), updateContact);

export default router;
