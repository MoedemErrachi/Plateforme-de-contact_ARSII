import { Router, Request, Response, NextFunction } from 'express';
import { ContactService } from '../services/contactService';
import { LogService } from '../services/logService';

const router = Router();
const contactService = new ContactService();
const logService = new LogService();

// POST /api/import/preview
router.post('/preview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows } = req.body;
    const result = await contactService.importContactsPreview(rows || []);
    res.status(200).json({ status: 'success', data: result });
  } catch (error) {
    next(error);
  }
});

// POST /api/import/execute
router.post('/execute', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { contacts, fileName, format } = req.body;
    const inserted = [];

    if (Array.isArray(contacts)) {
      for (const row of contacts) {
        if (row.email) {
          try {
            const newContact = await contactService.createContact(row);
            inserted.push(newContact);
          } catch {
            // Ignore single row creation errors during bulk import
          }
        }
      }
    }

    const log = await logService.createLog({
      type: 'IMPORT',
      format: format || 'CSV',
      fileName: fileName || 'import_contacts.csv',
      recordCount: inserted.length,
      status: 'SUCCESS'
    });

    res.status(200).json({ status: 'success', data: { importedCount: inserted.length, log } });
  } catch (error) {
    next(error);
  }
});

// GET /api/import/logs
router.get('/logs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const logs = await logService.getLogs('IMPORT');
    res.status(200).json({ status: 'success', data: { logs } });
  } catch (error) {
    next(error);
  }
});

export default router;
