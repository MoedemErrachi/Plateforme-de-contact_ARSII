import { Request, Response, NextFunction } from 'express';
import { ContactService } from '../services/contactService';

const contactService = new ContactService();

export const getContacts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 10;
    const search = req.query.search as string;
    const country = req.query.country as string;
    const typeActeurId = req.query.typeActeurId as string;
    const segmentId = req.query.segmentId as string;

    const result = await contactService.getContacts({
      page,
      limit,
      search,
      country,
      typeActeurId,
      segmentId
    });

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

    res.status(200).json({
      status: 'success',
      data: { contact }
    });
  } catch (error) {
    next(error);
  }
};

export const createContact = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const newContact = await contactService.createContact(req.body);

    res.status(201).json({
      status: 'success',
      data: { contact: newContact }
    });
  } catch (error) {
    next(error);
  }
};

export const updateContact = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const updatedContact = await contactService.updateContact(id, req.body);

    res.status(200).json({
      status: 'success',
      data: { contact: updatedContact }
    });
  } catch (error) {
    next(error);
  }
};

export const importContacts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows } = req.body;
    const previewResult = await contactService.importContactsPreview(rows);

    res.status(200).json({
      status: 'success',
      data: previewResult
    });
  } catch (error) {
    next(error);
  }
};
