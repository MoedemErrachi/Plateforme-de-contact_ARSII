import { Request, Response, NextFunction } from 'express';
import { ContactService } from '../services/contactService';
import { LogService } from '../services/logService';
import { AuthenticatedRequest } from '../middleware/authenticateJWT';

const contactService = new ContactService();
const logService = new LogService();

export const getContacts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const search = req.query.search as string;
    const countryOfOrigin = req.query.countryOfOrigin as string;
    const gender = req.query.gender as string;
    const careerStage = req.query.careerStage as string;
    const affiliation = req.query.affiliation as string;
    const tagId = req.query.tagId as string;
    const segmentId = req.query.segmentId as string;

    const result = await contactService.getContacts({ page, limit, search, countryOfOrigin, gender, careerStage, affiliation, tagId, segmentId });

    res.status(200).json({
      status: 'success',
      data: { contacts: result.contacts },
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
};

export const getContactById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const contact = await contactService.getContactById(id);
    res.status(200).json({ status: 'success', data: { contact } });
  } catch (error) {
    next(error);
  }
};

export const createContact = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const newContact = await contactService.createContact(req.body);
    res.status(201).json({ status: 'success', data: { contact: newContact } });
  } catch (error) {
    next(error);
  }
};

export const updateContact = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const updatedContact = await contactService.updateContact(id, req.body);
    res.status(200).json({ status: 'success', data: { contact: updatedContact } });
  } catch (error) {
    next(error);
  }
};

export const deleteContact = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const result = await contactService.deleteContact(id);
    res.status(200).json({ status: 'success', data: result });
  } catch (error) {
    next(error);
  }
};

export const bulkSaveContacts = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { newContacts = [], updatedContacts = [] } = req.body;
    const result = await contactService.bulkSave(newContacts, updatedContacts);

    await logService.createLog({
      type: 'IMPORT',
      format: 'CSV',
      fileName: 'import_contacts.csv',
      recordCount: result.createdCount,
      performedBy: req.user?.name,
      userId: req.user?.id
    });

    res.status(200).json({ status: 'SUCCESS', data: result });
  } catch (error: any) {
    res.status(500).json({ status: 'FAILED', errorMessage: extractBulkErrorMessage(error) });
  }
};

function extractBulkErrorMessage(error: any): string {
  const raw = error?.message || 'Erreur inconnue lors de l\'enregistrement des contacts.';
  const meaningfulLines = raw
    .split('\n')
    .map(line => line.trim())
    .filter(line =>
      line &&
      !line.startsWith('│') &&
      !line.startsWith('├') &&
      !line.startsWith('└') &&
      !line.startsWith('→') &&
      !line.includes('invocation in') &&
      !/\.ts:\d+/.test(line)
    );
  const reason = meaningfulLines[meaningfulLines.length - 1] || 'Erreur inconnue lors de l\'enregistrement des contacts.';
  return reason.length > 300 ? `${reason.slice(0, 300)}…` : reason;
}

export const importContacts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows } = req.body;
    const previewResult = await contactService.importContactsPreview(rows);
    res.status(200).json({ status: 'success', data: previewResult });
  } catch (error) {
    next(error);
  }
};
