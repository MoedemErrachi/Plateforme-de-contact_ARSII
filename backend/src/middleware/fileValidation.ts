import { Request, Response, NextFunction } from 'express';
import path from 'node:path';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB limit

const ALLOWED_MIME_TYPES = new Set<string>([
  'text/csv',
  'text/plain',
  'application/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/json'
]);

/**
 * Validates magic number signature for XLSX files
 */
function isValidXlsxSignature(buffer: Buffer): boolean {
  if (buffer.length < 4) return false;
  // ZIP signature for XLSX: PK\x03\x04 => 0x50 0x4B 0x03 0x04
  return buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
}

/**
 * Validates text encoding signature for CSV files
 */
function isValidCsvSignature(buffer: Buffer): boolean {
  if (buffer.length === 0) return false;
  // Check that content is printable text or standard UTF-8/BOM
  for (let i = 0; i < Math.min(buffer.length, 512); i++) {
    const byte = buffer[i];
    // Reject binary control characters except tab (9), LF (10), CR (13)
    if (byte < 9 || (byte > 13 && byte < 32)) {
      return false;
    }
  }
  return true;
}

/**
 * Sanitizes file names to prevent Directory Traversal attacks
 */
export function sanitizeFilename(filename: string): string {
  if (!filename) return 'uploaded_file.csv';
  
  // Strip path segments using path.basename
  let safeName = path.basename(filename);
  
  // Remove null bytes, parent dir references, and unsafe characters
  safeName = safeName
    .replaceAll('\0', '')
    .replaceAll('..', '')
    .replace(/[^a-zA-Z0-9_\-.]/g, '_');

  return safeName || 'import_file.csv';
}

/**
 * Middleware for validating file upload request payloads
 */
export const validateFileUpload = (req: Request, res: Response, next: NextFunction) => {
  const { fileName, fileData, mimeType, fileSize, rows } = req.body || {};

  // If rows array provided (JSON-body import), skip file checks
  if (Array.isArray(rows) && rows.length > 0) {
    return next();
  }

  // Otherwise require either fileData or a multipart file
  if (!fileData && !(req as any).file) {
    return res.status(400).json({
      error: "Aucun fichier fourni pour l'importation.",
      code: 'MISSING_FILE'
    });
  }

  // 1. File size check
  const size = fileSize || (fileData ? Buffer.byteLength(fileData, 'utf8') : 0);
  if (size > MAX_FILE_SIZE) {
    return res.status(400).json({
      error: `Fichier trop volumineux. La taille maximale autorisée est de 10 Mo.`,
      code: 'FILE_TOO_LARGE'
    });
  }

  // 2. MIME type check
  if (mimeType && !ALLOWED_MIME_TYPES.has(mimeType)) {
    return res.status(400).json({
      error: 'Type de fichier non autorisé. Formats acceptés : CSV, XLSX, JSON.',
      code: 'INVALID_MIME_TYPE'
    });
  }

  // 3. Magic number verification if file buffer is provided
  const signatureError = fileData ? inspectFileSignature(fileName, fileData) : null;
  if (signatureError) {
    return res.status(400).json({
      error: signatureError,
      code: 'INVALID_FILE_SIGNATURE'
    });
  }

  // 4. Sanitize file name
  if (req.body?.fileName) {
    req.body.fileName = sanitizeFilename(req.body.fileName);
  }

  next();
};

function inspectFileSignature(fileName: string | undefined, fileData: string): string | null {
  try {
    const isBase64 = typeof fileData === 'string' && fileData.includes(';base64,');
    const base64Content = isBase64 ? fileData.split(';base64,')[1] : fileData;
    const buffer = Buffer.from(base64Content, isBase64 ? 'base64' : 'utf8');

    if (fileName?.endsWith('.xlsx')) {
      if (!isValidXlsxSignature(buffer)) {
        return 'Signature binaire du fichier XLSX invalide.';
      }
    } else if (fileName?.endsWith('.csv')) {
      if (!isValidCsvSignature(buffer)) {
        return 'Le fichier CSV contient des caractères binaire non autorisés.';
      }
    }
  } catch (err) {
    console.warn('File signature check warning:', err);
  }
  return null;
}

/**
 * Middleware pour l'import par lot JSON ({ newContacts, updatedContacts }).
 * Le payload de contacts prêts passe directement ; tout autre payload
 * (ex. futur upload de fichier sur ce endpoint) est soumis aux contrôles
 * complets de validateFileUpload. La taille totale reste bornée par la limite
 * express.json de 10 Mo.
 */
export const validateBulkImportPayload = (req: Request, res: Response, next: NextFunction) => {
  const body = req.body || {};
  const hasContactsPayload = Array.isArray(body.newContacts) || Array.isArray(body.updatedContacts);
  if (hasContactsPayload) {
    return next();
  }
  return validateFileUpload(req, res, next);
};
