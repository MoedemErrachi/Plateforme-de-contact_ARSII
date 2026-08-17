import { Request, Response, NextFunction } from 'express';
import { ContactService } from '../services/contactService';
import { LogService } from '../services/logService';
import { AuthenticatedRequest } from '../middleware/authenticateJWT';

const contactService = new ContactService();
const logService = new LogService();

function toArray(value: unknown): string[] | undefined {
  if (value == null) return undefined;
  return Array.isArray(value) ? value : [String(value)];
}

export const getContacts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    // `researchCareerStage` (chatbot) est l'alias moderne de `careerStage` (legacy)
    const stages = req.query.researchCareerStage != null ? req.query.researchCareerStage : req.query.careerStage;

    const result = await contactService.getContacts({
      page,
      limit,
      search: req.query.search as string,
      countryOfOrigin: toArray(req.query.countryOfOrigin),
      gender: toArray(req.query.gender),
      careerStage: toArray(stages),
      affiliation: req.query.affiliation as string,
      facultyDepartment: req.query.facultyDepartment as string,
      tagId: toArray(req.query.tagId),
      segmentId: req.query.segmentId as string
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

// ---- Labels alignés sur le frontend (src/utils/exportCsv.ts) ----
function csvCell(value: unknown): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function buildExportFilename(params: Record<string, unknown>, format: string): string {
  const parts: string[] = ['contacts'];
  const search = params.search as string | undefined;
  if (search) parts.push(search.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20));
  const countries = Array.isArray(params.countryOfOrigin) ? params.countryOfOrigin : [];
  if (countries.length) parts.push(String(countries[0]).replace(/[^a-zA-Z0-9]/g, '').slice(0, 15));
  const genders = Array.isArray(params.gender) ? params.gender : [];
  if (genders.length) parts.push(String(genders[0]).toLowerCase());
  const ids = Array.isArray(params.ids) ? params.ids : [];
  if (ids.length === 1) parts.push('selection');
  const slug = parts.join('_') || 'contacts';
  const date = new Date().toISOString().slice(0, 10);
  return `${slug}_${date}.${format}`;
}

export const exportContacts = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const ids = toArray(req.query.ids);
    const format = String(req.query.format || 'csv').toLowerCase();
    const fields = toArray(req.query.fields);
    const includeTags = req.query.includeTags === 'true' || req.query.includeTags === '1';
    const stages = req.query.researchCareerStage != null ? req.query.researchCareerStage : req.query.careerStage;

    const params = {
      ids,
      fields,
      includeTags,
      search: req.query.search as string,
      countryOfOrigin: toArray(req.query.countryOfOrigin),
      gender: toArray(req.query.gender),
      careerStage: toArray(stages),
      affiliation: req.query.affiliation as string,
      facultyDepartment: req.query.facultyDepartment as string,
      tagId: toArray(req.query.tagId),
      segmentId: req.query.segmentId as string
    };

    const totalCount = await contactService.countExport(params);
    if (totalCount > 5000) {
      console.warn(`[contacts/export] Export volumineux (${totalCount} lignes) demandé par ${req.user?.email || 'inconnu'}.`);
    }

    res.setHeader('X-Export-Count', String(totalCount));

    const { keys, headers } = contactService.resolveExportColumns(fields, includeTags);
    const exportFileName = buildExportFilename(params, format);

    if (format === 'json') {
      const rows = await contactService.collectExportRows(params);
      const contacts = fields && fields.length
        ? rows.map(c => {
            const item: Record<string, unknown> = { id: c.id };
            keys.forEach(k => { item[k] = c[k]; });
            if (includeTags) item.tags = contactService.tagNames(c);
            return item;
          })
        : rows;
      res.status(200).json({ status: 'success', data: { contacts, totalCount } });
      return;
    }

    if (format === 'xlsx') {
      const buffer = await contactService.buildXlsxBuffer(params, keys, includeTags);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${exportFileName}"`);
      res.send(buffer);
      return;
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${exportFileName}"`);
    res.write('\uFEFF');
    res.write(`${headers.map(h => csvCell(h)).join(',')}\n`);
    for await (const contact of contactService.streamExport(params)) {
      res.write(`${contactService.exportCsvCells(contact, keys, includeTags).join(',')}\n`);
    }
    res.end();
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

export const getDistinctCountries = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const countries = await contactService.getDistinctCountries();
    res.status(200).json({ status: 'success', data: { countries } });
  } catch (error) {
    next(error);
  }
};

export const countContactsByEmailPattern = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pattern = String(req.query.email_pattern || '').trim();
    if (!pattern) {
      return res.status(400).json({ error: 'Paramètre email_pattern requis.' });
    }
    const count = await contactService.countByEmailPattern(pattern);
    res.status(200).json({ status: 'success', data: { count } });
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
