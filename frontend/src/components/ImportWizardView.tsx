import React, { useState, useRef, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Contact, Gender, ResearchCareerStage, CAREER_STAGE_LABELS } from '../types';
import { splitFullName } from '../utils/format';
import { apiFetch } from '../services/api';
import { predictAllMappings } from '../utils/importMapping';
import { parseFile } from '../utils/fileParsing';
import { OcrImportTab } from './OcrImportTab';
import { 
  Check, 
  Upload, 
  AlertTriangle, 
  Eye, 
  FileSpreadsheet, 
  ArrowRight, 
  ArrowLeft,
  RotateCw, 
  CheckCircle2,
  Copy,
  Download,
  Info,
  RefreshCw,
  Trash2,
  XCircle,
  Layers,
  FileCheck,
  X,
  Camera
} from 'lucide-react';

export interface ImportResult {
  ok: boolean;
  httpStatus: number;
  status: string;
  errorMessage: string;
  data: { createdCount: number; updatedCount: number; errors: Array<{ row: number; message: string }> } | null;
}

interface ImportWizardViewProps {
  onImportContacts: (newContacts: Contact[], updatedContacts?: Contact[]) => Promise<ImportResult>;
  existingContacts: Contact[];
}

export interface RawRowData {
  rowIndex: number;
  originalData: Record<string, string>;
}

export interface ParsedContactCandidate {
  id: string;
  rowIndex: number;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  gender: Gender;
  countryOfOrigin: string;
  city: string;
  phone: string;
  affiliation: string;
  function: string;
  experience: string;
  facultyDepartment: string;
  researchCareerStage: ResearchCareerStage;
  tags: string[];

  // Validation and Conflict Status
  status: 'valid' | 'duplicate' | 'invalid';
  errorReason?: string;
  duplicateMatch?: Contact;
  resolutionAction: 'import' | 'overwrite' | 'skip';
}

interface SystemFieldDef {
  key: string;
  label: string;
  description: string;
  required?: boolean;
}

const SYSTEM_FIELDS: SystemFieldDef[] = [
  { key: '__ignore__', label: '❌ Ne pas importer (Ignorer)', description: 'Ne sera pas enregistré' },
  { key: 'email', label: '✉️ E-mail', description: 'Recommandé pour identification unique', required: true },
  { key: 'firstName', label: '👤 Prénom', description: 'Prénom' },
  { key: 'lastName', label: '👤 Nom de famille', description: 'Nom de famille' },
  { key: 'fullName', label: '👥 Nom Complet', description: 'Prénom + Nom sur une colonne' },
  { key: 'gender', label: '⚧️ Genre', description: 'MALE, FEMALE ou NOT_SPECIFIED' },
  { key: 'countryOfOrigin', label: '🌍 Pays d\'origine', description: 'Pays d\'origine du chercheur' },
  { key: 'city', label: '🏙️ Ville', description: 'Ville de résidence' },
  { key: 'phone', label: '📞 Téléphone', description: 'Numéro de contact' },
  { key: 'affiliation', label: '🏢 Affiliation', description: 'Nom de l\'organisme / institution' },
  { key: 'function', label: '💼 Fonction', description: 'Intitulé de poste' },
  { key: 'experience', label: '🎯 Expérience', description: 'Expérience professionnelle (années, domaine)' },
  { key: 'facultyDepartment', label: '🏛️ Faculté / Département', description: 'Faculté ou département de rattachement' },
  { key: 'researchCareerStage', label: '🎓 Stade de carrière', description: 'R1, R2, R3 ou R4 (classement EURAXESS)' },
  { key: 'tags', label: '🏷️ Tags / Mots-clés', description: 'Mots-clés de classification' }
];

const buildServerPreviewRows = (rawRows: RawRowData[], columnMapping: Record<string, string>) =>
  rawRows.map(row => {
    const getVal = (sysKey: string): string => {
      const headerMatch = Object.keys(columnMapping).find(h => columnMapping[h] === sysKey);
      return headerMatch ? row.originalData[headerMatch] || '' : '';
    };
    return {
      email: getVal('email').trim(),
      firstName: getVal('firstName').trim(),
      lastName: getVal('lastName').trim(),
      fullName: getVal('fullName').trim()
    };
  }).filter(r => r.email || r.firstName || r.lastName || r.fullName);

const isValidEmailAddress = (candidate: string): boolean => {
  const value = candidate.trim();
  if (!value) return true;
  if (value.includes(' ') || !value.includes('@')) return false;
  const atIndex = value.indexOf('@');
  if (atIndex <= 0 || atIndex !== value.lastIndexOf('@')) return false;
  const localPart = value.slice(0, atIndex);
  const domainPart = value.slice(atIndex + 1);
  if (!localPart || !domainPart) return false;
  const dotIndex = domainPart.lastIndexOf('.');
  if (dotIndex <= 0 || dotIndex === domainPart.length - 1) return false;
  return true;
};

const collectServerDataDuplicates = async (serverRows: ReturnType<typeof buildServerPreviewRows>, existingContacts: Contact[]): Promise<Set<string>> => {
  const duplicateEmails = new Set<string>();
  try {
    const preview = await apiFetch('/api/contacts/bulk/preview', {
      method: 'POST',
      suppressGlobalError: true,
      body: JSON.stringify({ rows: serverRows })
    });
    if (preview?.data?.preview) {
      preview.data.preview.forEach((p: any) => {
        if (p.status === 'DUPLICATE' && p.existingContactId && p.inputData?.email) {
          duplicateEmails.add(p.inputData.email.toLowerCase());
        }
      });
    }
  } catch {
    existingContacts.forEach(c => {
      if (c.email) duplicateEmails.add(c.email.toLowerCase());
    });
  }
  return duplicateEmails;
};

interface AnalyzeRowDeps {
  autoGenerateEmails: boolean;
  duplicateEmails: Set<string>;
  existingContacts: Contact[];
  normalizeGenderInput: (raw: string) => Gender;
  normalizeCountry: (raw: string) => string;
  parseCareerStage: (raw: string) => ResearchCareerStage;
}

const splitNameFields = (row: RawRowData, columnMapping: Record<string, string>) => {
  const getVal = (sysKey: string): string => {
    const headerMatch = Object.keys(columnMapping).find(h => columnMapping[h] === sysKey);
    return headerMatch ? row.originalData[headerMatch] || '' : '';
  };
  const firstName = getVal('firstName').trim();
  const lastName = getVal('lastName').trim();
  const fullNameVal = getVal('fullName').trim();

  let resolvedFirstName = firstName;
  let resolvedLastName = lastName;
  if (!firstName && !lastName && fullNameVal) {
    const split = splitFullName(fullNameVal);
    resolvedFirstName = split.firstName;
    resolvedLastName = split.lastName;
  }
  return { firstName: resolvedFirstName, lastName: resolvedLastName, fullNameVal };
};

const resolveRowEmail = (rawEmail: string, rowIndex: number, autoGenerateEmails: boolean): string => {
  if (rawEmail.includes('@')) return rawEmail;
  if (!autoGenerateEmails) return rawEmail;
  return `import_${rowIndex}_${crypto.randomUUID().replaceAll('-', '').slice(0, 8)}@euraxess.africa`;
};

const resolveFinalFullName = (fullNameVal: string, firstName: string, lastName: string, email: string, rowIndex: number): string => {
  let finalFullName = fullNameVal;
  if (!finalFullName) {
    finalFullName = [firstName, lastName].filter(Boolean).join(' ');
  }
  if (!finalFullName) {
    finalFullName = email.split('@')[0] || `Contact #${rowIndex}`;
  }
  return finalFullName.trim();
};

const classifyRowStatus = (
  email: string,
  firstName: string,
  lastName: string,
  fullNameVal: string,
  deps: AnalyzeRowDeps
): { status: 'valid' | 'duplicate' | 'invalid'; errorReason?: string; duplicateMatch?: Contact } => {
  const cleanEmail = email.toLowerCase();
  const isDuplicate = Boolean(cleanEmail && deps.duplicateEmails.has(cleanEmail));
  const duplicateMatch: Contact | undefined = isDuplicate
    ? (deps.existingContacts.find(c => c.email.toLowerCase() === cleanEmail) || { id: 'server-match', email: cleanEmail } as Contact)
    : undefined;

  if (!isValidEmailAddress(email) && email.length > 0) {
    return { status: 'invalid', errorReason: 'Format e-mail invalide', duplicateMatch };
  }
  if (!email && !firstName && !lastName && !fullNameVal) {
    return { status: 'invalid', errorReason: 'Identifiant manquant (E-mail ou Nom absent)', duplicateMatch };
  }
  if (isDuplicate) {
    return { status: 'duplicate', duplicateMatch };
  }
  return { status: 'valid', duplicateMatch };
};

const analyzeSingleRow = (
  row: RawRowData,
  columnMapping: Record<string, string>,
  deps: AnalyzeRowDeps
): ParsedContactCandidate => {
  const getVal = (sysKey: string): string => {
    const headerMatch = Object.keys(columnMapping).find(h => columnMapping[h] === sysKey);
    return headerMatch ? row.originalData[headerMatch] || '' : '';
  };

  const rawEmail = getVal('email').trim();
  const email = resolveRowEmail(rawEmail, row.rowIndex, deps.autoGenerateEmails);
  const { firstName, lastName, fullNameVal } = splitNameFields(row, columnMapping);

  const genderRaw = getVal('gender').trim();
  const gender: Gender = genderRaw ? deps.normalizeGenderInput(genderRaw) : 'NOT_SPECIFIED';
  const countryOfOrigin = deps.normalizeCountry(getVal('countryOfOrigin').trim());
  const city = getVal('city').trim();
  const phone = getVal('phone').trim() || '';
  const affiliation = getVal('affiliation').trim() || '';
  const fonction = getVal('function').trim() || '';
  const experience = getVal('experience').trim() || '';
  const facultyDepartment = getVal('facultyDepartment').trim() || '';
  const researchCareerStage = deps.parseCareerStage(getVal('researchCareerStage'));

  const rawTags = getVal('tags');
  const tags = rawTags ? rawTags.split(/[,;|/]/).map(s => s.trim()).filter(Boolean) : ['Importation'];

  const finalFullName = resolveFinalFullName(fullNameVal, firstName, lastName, email, row.rowIndex);

  const classification = classifyRowStatus(email, firstName, lastName, fullNameVal, deps);

  let resolutionAction: 'import' | 'overwrite' | 'skip';
  if (classification.status === 'duplicate') resolutionAction = 'overwrite';
  else if (classification.status === 'invalid') resolutionAction = 'skip';
  else resolutionAction = 'import';

  return {
    id: `candidate-${row.rowIndex}-${Date.now()}`,
    rowIndex: row.rowIndex,
    firstName, lastName, fullName: finalFullName, email, gender,
    countryOfOrigin, city, phone, affiliation,
    function: fonction, experience, facultyDepartment,
    researchCareerStage, tags, status: classification.status, errorReason: classification.errorReason,
    duplicateMatch: classification.duplicateMatch, resolutionAction
  };
};

const partitionCandidates = (candidates: ParsedContactCandidate[]) => {
  const newContactsToAdd: Contact[] = [];
  const updatedContactsToMerge: Contact[] = [];
  const skippedList: ParsedContactCandidate[] = [];
  let countNew = 0;
  let countMerged = 0;
  candidates.forEach(cand => {
    if (cand.resolutionAction === 'skip' || cand.status === 'invalid') {
      skippedList.push(cand);
      return;
    }
    if (cand.resolutionAction === 'overwrite' && cand.duplicateMatch) {
      updatedContactsToMerge.push({ ...cand.duplicateMatch, ...buildCandidatePayload(cand, 'merged') } as Contact);
      countMerged++;
    } else {
      newContactsToAdd.push(buildCandidatePayload(cand, 'new') as Contact);
      countNew++;
    }
  });
  return { newContactsToAdd, updatedContactsToMerge, skippedList, countNew, countMerged };
};

const buildImportOutcome = (result: ImportResult, parts: ReturnType<typeof partitionCandidates>) => {
  const serverErrors = result.data?.errors || [];
  return {
    failed: !result.ok || result.status !== 'SUCCESS',
    errorMessage: result.errorMessage || 'Erreur inconnue lors de l\'importation.',
    summary: {
      importedNew: result.data?.createdCount ?? parts.countNew,
      updatedMerged: result.data?.updatedCount ?? parts.countMerged,
      skippedIgnored: parts.skippedList.length + serverErrors.length,
      errors: buildErrorReportEntries(parts.skippedList, serverErrors)
    }
  };
};

const toFileErrorMessage = (err: any): string => err?.message || 'Erreur lors de la lecture du fichier.';

const applyColumnMappingChange = (columnMapping: Record<string, string>, header: string, newKey: string): Record<string, string> => {
  const oldKey = columnMapping[header] || '__ignore__';
  if (oldKey === newKey) return columnMapping;

  const updated = { ...columnMapping, [header]: newKey };

  if (newKey !== '__ignore__') {
    Object.entries(updated).forEach(([h, f]) => {
      if (h !== header && f === newKey) {
        updated[h] = '__ignore__';
      }
    });
  }

  const nameFields = new Set(['firstName', 'lastName']);
  if (newKey === 'fullName') {
    Object.entries(updated).forEach(([h, f]) => {
      if (h !== header && nameFields.has(f)) {
        updated[h] = '__ignore__';
      }
    });
  } else if (nameFields.has(newKey)) {
    Object.entries(updated).forEach(([h, f]) => {
      if (h !== header && f === 'fullName') {
        updated[h] = '__ignore__';
      }
    });
  }

  return updated;
};

const updateCandidateInline = (c: ParsedContactCandidate, id: string, field: 'email' | 'fullName' | 'affiliation', val: string, serverDuplicateEmails: Set<string>): ParsedContactCandidate => {
  if (c.id !== id) return c;
  const updated = { ...c, [field]: val };

  if (field === 'fullName') {
    updated.fullName = val.trim();
    const split = splitFullName(val);
    updated.firstName = split.firstName;
    updated.lastName = split.lastName;
  }

  const emailValid = isValidEmailAddress(updated.email);
  const cleanEmail = updated.email.toLowerCase();
  const isServerDuplicate = Boolean(cleanEmail && serverDuplicateEmails.has(cleanEmail));

  if (!emailValid) {
    updated.status = 'invalid';
    updated.errorReason = 'Format e-mail invalide';
    updated.resolutionAction = 'skip';
  } else if (!updated.email && !updated.fullName) {
    updated.status = 'invalid';
    updated.errorReason = 'Identifiant manquant';
    updated.resolutionAction = 'skip';
  } else if (isServerDuplicate) {
    updated.status = 'duplicate';
    updated.duplicateMatch = updated.duplicateMatch || { id: 'server-match', email: cleanEmail } as Contact;
    updated.errorReason = undefined;
    if (updated.resolutionAction === 'skip') updated.resolutionAction = 'overwrite';
  } else {
    updated.status = 'valid';
    updated.errorReason = undefined;
    updated.duplicateMatch = undefined;
    updated.resolutionAction = 'import';
  }

  return updated;
};

const setCandidateResolution = (c: ParsedContactCandidate, id: string, action: 'import' | 'overwrite' | 'skip'): ParsedContactCandidate =>
  c.id === id ? { ...c, resolutionAction: action } : c;

const applyBulkCandidateAction = (c: ParsedContactCandidate, action: 'overwrite' | 'skip'): ParsedContactCandidate =>
  c.status === 'duplicate' ? { ...c, resolutionAction: action } : c;

const filterCandidatesByStatus = (candidates: ParsedContactCandidate[], filterStatus: 'all' | 'valid' | 'duplicate' | 'invalid'): ParsedContactCandidate[] => {
  if (filterStatus === 'valid') return candidates.filter(c => c.status === 'valid');
  if (filterStatus === 'duplicate') return candidates.filter(c => c.status === 'duplicate');
  if (filterStatus === 'invalid') return candidates.filter(c => c.status === 'invalid');
  return candidates;
};

const stepCircleClass = (currentStep: number, stepIndex: number): string => {
  if (currentStep === stepIndex) {
    return 'bg-[#005596] text-white ring-4 ring-[#005596]/30 scale-105 shadow-md';
  }
  if (currentStep > stepIndex) {
    return 'bg-[#005596] text-white';
  }
  return 'bg-slate-200 text-slate-500';
};

const detectFileExtension = (fileName: string | undefined): string => {
  if (!fileName) return '.csv';
  if (fileName.endsWith('.xlsx')) return '.xlsx';
  if (fileName.endsWith('.xls')) return '.xls';
  if (fileName.endsWith('.json')) return '.json';
  return '.csv';
};

const reportHasEntries = (r: { importedNew: number; updatedMerged: number; skippedIgnored: number }): boolean =>
  r.importedNew > 0 || r.updatedMerged > 0 || r.skippedIgnored > 0;

const pickDropFile = (e: React.DragEvent): File | undefined => e.dataTransfer.files?.[0];

const handlePickerKeyDown = (e: React.KeyboardEvent, onOpen: () => void) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    onOpen();
  }
};

const buildCandidatePayload = (cand: ParsedContactCandidate, mode: 'new' | 'merged') => {
  if (mode === 'merged') {
    return {
      name: cand.fullName || cand.duplicateMatch!.name,
      firstName: cand.firstName || cand.duplicateMatch!.firstName,
      lastName: cand.lastName || cand.duplicateMatch!.lastName,
      email: cand.email || cand.duplicateMatch!.email,
      phone: cand.phone || cand.duplicateMatch!.phone,
      gender: cand.gender,
      countryOfOrigin: cand.countryOfOrigin || cand.duplicateMatch!.countryOfOrigin,
      city: cand.city || cand.duplicateMatch!.city,
      affiliation: cand.affiliation || cand.duplicateMatch!.affiliation,
      function: cand.function || cand.duplicateMatch!.function,
      experience: cand.experience || cand.duplicateMatch!.experience,
      facultyDepartment: cand.facultyDepartment || cand.duplicateMatch!.facultyDepartment,
      researchCareerStage: cand.researchCareerStage,
      tags: Array.from(new Set([...(cand.duplicateMatch!.tags || []), ...cand.tags, 'Importé', 'Mis à jour']))
    };
  }
  return {
    id: `imp-${cand.rowIndex}-${Date.now()}`,
    name: cand.fullName,
    initials: cand.fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'NC',
    firstName: cand.firstName,
    lastName: cand.lastName,
    email: cand.email,
    phone: cand.phone,
    gender: cand.gender,
    countryOfOrigin: cand.countryOfOrigin,
    city: cand.city,
    affiliation: cand.affiliation,
    function: cand.function || undefined,
    experience: cand.experience || undefined,
    facultyDepartment: cand.facultyDepartment || undefined,
    researchCareerStage: cand.researchCareerStage,
    tags: cand.tags
  };
};

const buildErrorReportEntries = (skipped: ParsedContactCandidate[], serverErrors: Array<{ row: number; message: string }>) => {
  if (skipped.length > 0) return skipped;
  return serverErrors.map((e: { row: number; message: string }) => ({
    id: `err-${e.row}`,
    rowIndex: e.row,
    fullName: '', firstName: '', lastName: '', email: '',
    gender: 'NOT_SPECIFIED' as const, phone: '', affiliation: '',
    countryOfOrigin: '', city: '', function: '', experience: '',
    facultyDepartment: '', researchCareerStage: 'R1_FIRST_STAGE' as const,
    tags: [], status: 'invalid' as const,
    errorReason: e.message, resolutionAction: 'skip' as const, originalData: {}
  }));
};

const StepBadgeView = (p: { index: number; currentStep: number; canHover: boolean }) => {
  const visited = p.currentStep > p.index;
  const content = visited ? <Check className="w-5 h-5" /> : p.index;
  return (
    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all ${stepCircleClass(p.currentStep, p.index)}${p.canHover ? ' group-hover:scale-105' : ''}`}>
      {content}
    </div>
  );
};

const StepLabelView = (p: { index: number; currentStep: number; label: string }) => {
  const active = p.currentStep === p.index;
  return (
    <span className={`text-[11px] font-extrabold uppercase tracking-wider transition-colors ${active ? 'text-[#005596]' : 'text-slate-500 group-hover:text-[#005596]'}`}>
      {p.label}
    </span>
  );
};

const TabBarView = ({ activeTab, onSelect }: { activeTab: 'file' | 'ocr'; onSelect: (tab: 'file' | 'ocr') => void }) => {
  const fileActive = activeTab === 'file';
  const ocrActive = activeTab === 'ocr';
  return (
    <div className="flex items-center bg-[#E8F1F8] p-1.5 rounded-xl border border-[#C9D4DE]/40">
      <button
        onClick={() => onSelect('file')}
        className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold transition-all ${fileActive ? 'bg-[#005596] text-white shadow' : 'text-[#55636B] hover:text-[#005596]'}`}
      >
        <FileSpreadsheet className="w-4 h-4" />
        Importer un fichier
      </button>
      <button
        onClick={() => onSelect('ocr')}
        className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold transition-all ${ocrActive ? 'bg-[#005596] text-white shadow' : 'text-[#55636B] hover:text-[#005596]'}`}
      >
        <Camera className="w-4 h-4" />
        Scanner une carte de visite
      </button>
    </div>
  );
};

const StepperBarView = (p: {
  currentStep: number;
  hasLoadedFile: boolean;
  hasRows: boolean;
  hasCandidates: boolean;
  isAnalyzing: boolean;
  hasReport: boolean;
  isEmailMapped: boolean;
  autoGenerateEmails: boolean;
  onGotoStep1: () => void;
  onGotoStep2: () => void;
  onGotoStep3: () => void;
  onGotoStep4: () => void;
  onAnalyze: () => void;
  onWarnEmail: () => void;
}) => {
  const handleStep2Click = () => {
    if (p.hasLoadedFile) p.onGotoStep2();
  };
  const handleStep3Click = () => {
    if (p.hasCandidates) { p.onGotoStep3(); return; }
    if (p.isEmailMapped || p.autoGenerateEmails) p.onAnalyze();
    else p.onWarnEmail();
  };
  const handleStep4Click = () => {
    if (p.hasReport) p.onGotoStep4();
  };
  return (
    <div className="px-2 py-4 bg-white rounded-2xl border border-[#C9D4DE]/50 shadow-sm overflow-x-auto scrollbar-none">
      <div className="flex items-center w-full justify-between relative min-w-[360px] max-w-4xl mx-auto px-4">
        <button
          type="button"
          onClick={p.onGotoStep1}
          className="flex flex-col items-center gap-1.5 z-10 cursor-pointer group bg-transparent border-0 outline-none"
          title="Aller à l'étape 1 (Chargement du fichier)"
        >
          <StepBadgeView index={1} currentStep={p.currentStep} canHover />
          <StepLabelView index={1} currentStep={p.currentStep} label="1. Chargement" />
        </button>

        <div className={`flex-grow h-[3px] mx-2 transition-colors ${p.currentStep >= 2 ? 'bg-[#005596]' : 'bg-slate-200'}`} />

        <button
          type="button"
          disabled={!p.hasLoadedFile}
          onClick={handleStep2Click}
          className={`flex flex-col items-center gap-1.5 z-10 bg-transparent border-0 outline-none ${p.hasLoadedFile ? 'cursor-pointer group' : 'cursor-not-allowed opacity-50'}`}
          title={p.hasLoadedFile ? "Aller à l'étape 2 (Mappage des colonnes)" : "Chargez d'abord un fichier valide"}
        >
          <StepBadgeView index={2} currentStep={p.currentStep} canHover={p.hasLoadedFile} />
          <StepLabelView index={2} currentStep={p.currentStep} label="2. Mappage" />
        </button>

        <div className={`flex-grow h-[3px] mx-2 transition-colors ${p.currentStep >= 3 ? 'bg-[#005596]' : 'bg-slate-200'}`} />

        <button
          type="button"
          disabled={!p.hasRows || p.isAnalyzing}
          onClick={handleStep3Click}
          className={`flex flex-col items-center gap-1.5 z-10 bg-transparent border-0 outline-none ${p.hasRows ? 'cursor-pointer group' : 'cursor-not-allowed opacity-50'}`}
          title={p.hasRows ? "Aller à l'étape 3 (Analyse et résolution des conflits)" : "Mappez d'abord les colonnes d'un fichier"}
        >
          <StepBadgeView index={3} currentStep={p.currentStep} canHover={p.hasRows} />
          <StepLabelView index={3} currentStep={p.currentStep} label="3. Analyse & Conflits" />
        </button>

        <div className={`flex-grow h-[3px] mx-2 transition-colors ${p.currentStep >= 4 ? 'bg-[#005596]' : 'bg-slate-200'}`} />

        <button
          type="button"
          disabled={!p.hasReport}
          onClick={handleStep4Click}
          className={`flex flex-col items-center gap-1.5 z-10 bg-transparent border-0 outline-none ${p.hasReport ? 'cursor-pointer group' : 'cursor-not-allowed opacity-50'}`}
          title="Rapport d'importation final"
        >
          <StepBadgeView index={4} currentStep={p.currentStep} canHover={p.hasReport} />
          <StepLabelView index={4} currentStep={p.currentStep} label="4. Rapport Final" />
        </button>
      </div>
    </div>
  );
};

const FileInfoCardView = (p: {
  file: File;
  rawRows: RawRowData[];
  headers: string[];
  sheetInfo: { sheetCount: number; sheetName: string; headerRowIndex: number } | null;
  fileExtension: string;
  onResetFile: () => void;
  onContinueToMapping: () => void;
}) => {
  const multiSheet = p.sheetInfo && p.sheetInfo.sheetCount > 1;
  const headerRow = p.sheetInfo && p.sheetInfo.headerRowIndex > 0;
  return (
    <div className="p-5 bg-emerald-50/90 border border-emerald-200 rounded-2xl space-y-4 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3">
          <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl shrink-0 mt-0.5 sm:mt-0">
            <FileCheck className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold text-sm text-emerald-950">{p.file.name}</p>
              <span className="px-2 py-0.5 bg-emerald-200/80 text-emerald-900 text-[10px] font-extrabold rounded-md uppercase">
                {p.fileExtension}
              </span>
              <span className="text-xs text-emerald-700 font-semibold">
                ({(p.file.size / 1024).toFixed(1)} KB)
              </span>
            </div>
            <p className="text-xs text-emerald-800 font-medium flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              {p.rawRows.length} lignes valides détectées • {p.headers.length} colonnes identifiées
              {multiSheet && (
                <span className="ml-2 px-1.5 py-0.5 bg-emerald-200/60 text-emerald-900 text-[10px] font-bold rounded">
                  {p.sheetInfo!.sheetCount} feuilles • "{p.sheetInfo!.sheetName}"
                </span>
              )}
              {headerRow && (
                <span className="ml-2 px-1.5 py-0.5 bg-amber-200/60 text-amber-900 text-[10px] font-bold rounded">
                  En-têtes ligne {p.sheetInfo!.headerRowIndex + 1}
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
          <button
            type="button"
            onClick={p.onResetFile}
            className="px-3.5 py-2.5 bg-white hover:bg-red-50 text-red-600 border border-red-200 font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Supprimer ou remplacer le fichier"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Remplacer</span>
          </button>

          <button
            type="button"
            onClick={p.onContinueToMapping}
            className="px-5 py-2.5 bg-[#005596] hover:bg-[#004275] text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2 transition-all cursor-pointer"
          >
            <span>Continuer vers Mappage</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

const FileStepView = (p: {
  fileError: string | null;
  file: File | null;
  rawRows: RawRowData[];
  headers: string[];
  sheetInfo: { sheetCount: number; sheetName: string; headerRowIndex: number } | null;
  fileExtension: string;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onDrop: (e: React.DragEvent) => void;
  onFileSelect: (f: File) => void;
  onOpenFilePicker: () => void;
  onResetFile: () => void;
  onContinueToMapping: () => void;
}) => {
  const hasLoadedFile = p.file && !p.fileError && p.rawRows.length > 0;
  return (
    <div className="bg-white rounded-2xl border border-[#C9D4DE]/60 p-4 sm:p-6 lg:p-8 shadow-[0_6px_18px_rgba(0,0,0,0.06)] max-w-4xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-extrabold text-[#1C2529]">Étape 1 : Sélectionner le fichier de contacts</h2>
        <p className="text-xs text-[#55636B]">
          Formats supportés : <strong className="text-[#005596]">.csv, .json, .xlsx, .xls</strong>. Assurez-vous que la première ligne contient les en-têtes de colonnes.
        </p>
      </div>

      {p.fileError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-800 text-xs animate-shake">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-red-900">Fichier invalide ou corrompu</p>
            <p className="mt-0.5">{p.fileError}</p>
          </div>
        </div>
      )}

      {/* Drag & Drop Box */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={p.onDrop}
        onClick={p.onOpenFilePicker}
        onKeyDown={(e) => handlePickerKeyDown(e, p.onOpenFilePicker)}
        role="button" /* NOSONAR — zone de dépôt accessible (clic + clavier + drag & drop) */
        tabIndex={0}
        aria-label="Choisir un fichier de contacts"
        className={`border-3 border-dashed rounded-2xl p-6 sm:p-10 text-center cursor-pointer transition-all space-y-4 group ${
          p.file && !p.fileError
            ? 'border-[#005596] bg-[#E8F1F8]/40'
            : 'border-[#005596]/50 hover:border-[#005596] bg-slate-50/50 hover:bg-[#E8F1F8]/30'
        }`}
      >
        <input
          type="file"
          ref={p.fileInputRef}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) p.onFileSelect(f); }}
          accept=".csv,.xlsx,.xls,.json,.txt"
          className="hidden"
        />

        <div className="w-16 h-16 bg-[#005596] text-white rounded-2xl flex items-center justify-center mx-auto shadow-md group-hover:scale-110 transition-transform">
          <Upload className="w-8 h-8" />
        </div>

        <div>
          <p className="font-bold text-sm text-[#1C2529]">
            Glissez-déposez votre fichier ici ou <span className="text-[#005596] underline">parcourez vos fichiers</span>
          </p>
          <p className="text-xs text-[#55636B] mt-1">Accepte les fichiers .csv, .json et Excel (.xlsx, .xls)</p>
        </div>
      </div>

      {hasLoadedFile && p.file && (
        <FileInfoCardView
          file={p.file}
          rawRows={p.rawRows}
          headers={p.headers}
          sheetInfo={p.sheetInfo}
          fileExtension={p.fileExtension}
          onResetFile={p.onResetFile}
          onContinueToMapping={p.onContinueToMapping}
        />
      )}
    </div>
  );
};

const MappingRowView = (p: {
  header: string;
  rawRows: RawRowData[];
  columnMapping: Record<string, string>;
  onMappingChange: (header: string, key: string) => void;
  isFieldTakenByOther: (header: string, key: string) => boolean;
}) => {
  const sampleValues = p.rawRows
    .map(r => r.originalData[p.header])
    .filter(v => v?.trim())
    .slice(0, 3);
  const display = sampleValues.length > 0 ? sampleValues : [p.rawRows[0]?.originalData[p.header] || '—'];
  const currentMappedKey = p.columnMapping[p.header] || '__ignore__';
  const isMapped = currentMappedKey !== '__ignore__';
  return (
    <div
      className={`p-4 rounded-xl border transition-all flex flex-col min-[1380px]:flex-row min-[1380px]:items-center justify-between gap-3 ${isMapped ? 'bg-slate-50 border-[#005596]/40 shadow-2xs' : 'bg-white border-slate-200'}`}
    >
      <div className="space-y-1 w-full min-[1380px]:max-w-md">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-extrabold text-sm text-[#1C2529] break-words">{p.header}</span>
          {isMapped && (
            <span className="px-2 py-0.5 bg-[#BCD7EE] text-[#005596] text-[10px] font-bold rounded-md shrink-0">
              Auto-associé
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 truncate" title={display.join(' | ')}>
          Aperçu: <span className="italic font-mono text-slate-700">
            {display.map((v, i) => (
              <span key={v}>{i > 0 && <span className="text-slate-400 not-italic"> / </span>}"{v}"</span>
            ))}
          </span>
        </p>
      </div>

      <div className="flex items-center gap-2 w-full min-[1380px]:w-auto min-[1380px]:min-w-[280px]">
        <span className="text-xs font-bold text-slate-400 hidden min-[1380px]:inline shrink-0">➡️</span>
        <select
          value={currentMappedKey}
          onChange={(e) => p.onMappingChange(p.header, e.target.value)}
          className="w-full max-w-full bg-white border border-[#C9D4DE] text-[#1C2529] font-semibold text-xs rounded-xl p-2.5 focus:ring-2 focus:ring-[#005596] outline-none cursor-pointer truncate"
        >
          {SYSTEM_FIELDS.map(sys => {
            const disabled = p.isFieldTakenByOther(p.header, sys.key);
            return (
              <option key={sys.key} value={sys.key} className="truncate" disabled={disabled}>
                {sys.label}{disabled ? ' ✖ (utilisé)' : ''}
              </option>
            );
          })}
        </select>
      </div>
    </div>
  );
};

const MappingSidebarView = (p: {
  showEmailWarning: boolean;
  isEmailMapped: boolean;
  autoGenerateEmails: boolean;
  isAnalyzing: boolean;
  onAutoGenerateEmails: () => void;
  onDismissEmailWarning: () => void;
  onRunAnalysis: () => void;
  onWarnEmail: () => void;
  onBackToFile: () => void;
}) => {
  const handleRunAnalysis = () => {
    if (p.isAnalyzing) return;
    if (!p.isEmailMapped && !p.autoGenerateEmails) { p.onWarnEmail(); return; }
    p.onRunAnalysis();
  };
  return (
    <aside className="col-span-12 min-[1380px]:col-span-4 space-y-6">
      <div className="bg-white rounded-2xl border border-[#C9D4DE]/50 p-6 shadow-sm text-xs space-y-4">
        <h3 className="text-base font-bold text-[#1C2529]">Instructions de Mappage</h3>

        <ul className="space-y-2 text-[#55636B] leading-relaxed">
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#005596] shrink-0 mt-0.5" />
            <span><strong>E-mail :</strong> Utilisé pour détecter automatiquement les doublons avec votre base existante.</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#005596] shrink-0 mt-0.5" />
            <span><strong>Champs optionnels :</strong> S'ils sont absents, ils seront enregistrés avec une valeur vide.</span>
          </li>
        </ul>

        <div className="pt-4 border-t border-slate-100 space-y-2">
          {p.showEmailWarning && !p.isEmailMapped && (
            <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl space-y-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900">
                  <p className="font-bold">Aucune colonne e-mail détectée</p>
                  <p className="mt-1">Des adresses e-mail temporaires seront générées automatiquement pour chaque contact (<code className="bg-amber-100 px-1 rounded">import_[ligne]_[id]@euraxess.africa</code>).</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={p.onAutoGenerateEmails}
                  className="flex-1 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  Générer automatiquement
                </button>
                <button
                  onClick={p.onDismissEmailWarning}
                  className="flex-1 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  Revenir au mapping
                </button>
              </div>
            </div>
          )}
          <button
            disabled={p.isAnalyzing}
            onClick={handleRunAnalysis}
            className="w-full py-3.5 bg-[#005596] hover:bg-[#004275] text-white rounded-xl font-bold text-sm shadow hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {p.isAnalyzing ? 'Analyse en cours…' : "Lancer l'Analyse des Lignes (Étape 3)"}
            {!p.isAnalyzing && <ArrowRight className="w-4 h-4" />}
          </button>

          <button
            onClick={p.onBackToFile}
            className="w-full py-2.5 text-slate-600 hover:text-slate-900 font-bold text-xs rounded-xl hover:bg-slate-100 transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Changer de fichier
          </button>
        </div>
      </div>
    </aside>
  );
};

const MappingStepView = (p: {
  headers: string[];
  rawRows: RawRowData[];
  columnMapping: Record<string, string>;
  fileName: string | undefined;
  isEmailMapped: boolean;
  isNameMapped: boolean;
  onMappingChange: (header: string, key: string) => void;
  isFieldTakenByOther: (header: string, key: string) => boolean;
  sidebar: React.ReactNode;
}) => {
  const warnMissing = !p.isEmailMapped || !p.isNameMapped;
  return (
    <div className="grid grid-cols-12 gap-6">
      <div className="col-span-12 min-[1380px]:col-span-8 space-y-6">
        <div className="bg-white rounded-2xl border border-[#C9D4DE]/50 shadow-sm p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-[#1C2529]">Associer les colonnes du fichier aux champs système</h2>
              <p className="text-xs text-[#55636B] mt-0.5">
                Sélectionnez le champ équivalent pour chaque colonne extraite de <strong className="text-[#005596]">{p.fileName}</strong>.
              </p>
            </div>

            <span className="text-xs font-bold bg-[#E8F1F8] text-[#005596] px-3 py-1.5 rounded-full border border-[#005596]/30">
              {Object.values(p.columnMapping).filter(v => v !== '__ignore__').length} / {p.headers.length} Mappées
            </span>
          </div>

          {warnMissing && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 text-xs text-amber-900">
              <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Avertissement sur les champs recommandés</p>
                <p className="mt-0.5">
                  {!p.isEmailMapped && "• La colonne E-mail n'est actuellement pas associée. "}
                  {!p.isNameMapped && "• Aucune colonne Nom/Prénom n'est associée. "}
                  Les lignes dépourvues d'identifiants seront signalées comme invalides à l'étape suivante.
                </p>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {p.headers.map(header => (
              <MappingRowView
                key={header}
                header={header}
                rawRows={p.rawRows}
                columnMapping={p.columnMapping}
                onMappingChange={p.onMappingChange}
                isFieldTakenByOther={p.isFieldTakenByOther}
              />
            ))}
          </div>
        </div>
      </div>

      {p.sidebar}
    </div>
  );
};

const ACTION_OPTIONS: Record<'valid' | 'duplicate' | 'invalid', Array<{ value: string; label: string }>> = {
  duplicate: [
    { value: 'overwrite', label: 'Mettre à jour' },
    { value: 'skip', label: 'Ignorer' }
  ],
  invalid: [
    { value: 'skip', label: 'Ignorer' },
    { value: 'import', label: 'Importer' }
  ],
  valid: [
    { value: 'import', label: 'Importer' },
    { value: 'skip', label: 'Ignorer' }
  ]
};

const CandidateStatusBadgeView = ({ cand }: { cand: ParsedContactCandidate }) => {
  if (cand.status === 'valid') {
    return (
      <span className="px-1.5 sm:px-2.5 py-0.5 sm:py-1 bg-emerald-100 text-emerald-800 rounded-full font-bold text-[9px] sm:text-[10px] flex items-center gap-0.5 sm:gap-1 w-fit">
        <CheckCircle2 className="w-3 h-3" /> <span className="hidden sm:inline">Valide</span>
      </span>
    );
  }
  if (cand.status === 'duplicate') {
    return (
      <div className="space-y-0.5">
        <span className="px-1.5 sm:px-2.5 py-0.5 sm:py-1 bg-amber-100 text-amber-900 rounded-full font-bold text-[9px] sm:text-[10px] flex items-center gap-0.5 sm:gap-1 w-fit">
          <Copy className="w-3 h-3" /> <span className="hidden sm:inline">Doublon</span>
        </span>
        {cand.duplicateMatch && (
          <p className="text-[9px] sm:text-[10px] text-amber-800 italic hidden sm:block">
            → {cand.duplicateMatch.name}
          </p>
        )}
      </div>
    );
  }
  return (
    <span className="px-1.5 sm:px-2.5 py-0.5 sm:py-1 bg-red-100 text-red-900 rounded-full font-bold text-[9px] sm:text-[10px] flex items-center gap-0.5 sm:gap-1 w-fit" title={cand.errorReason}>
      <AlertTriangle className="w-3 h-3" /> <span className="hidden sm:inline">{cand.errorReason || 'Invalide'}</span>
    </span>
  );
};

const CandidateRowView = (p: {
  cand: ParsedContactCandidate;
  onUpdateField: (id: string, field: 'email' | 'fullName' | 'affiliation', val: string) => void;
  onResolutionChange: (id: string, action: 'import' | 'overwrite' | 'skip') => void;
}) => {
  let rowClass = 'hover:bg-slate-50';
  if (p.cand.status === 'duplicate') rowClass = 'bg-amber-50/40 hover:bg-amber-50/80';
  else if (p.cand.status === 'invalid') rowClass = 'bg-red-50/40 hover:bg-red-50/80';
  return (
    <tr className={`transition-colors ${rowClass}`}>
      <td className="px-2 sm:px-4 py-2 sm:py-3 text-slate-400 font-mono font-bold text-[10px] sm:text-xs">#{p.cand.rowIndex}</td>

      <td className="px-2 sm:px-4 py-2 sm:py-3">
        <input
          type="text"
          value={p.cand.fullName}
          onChange={(e) => p.onUpdateField(p.cand.id, 'fullName', e.target.value)}
          className="font-bold text-[#1C2529] bg-transparent border-b border-transparent hover:border-slate-300 focus:border-[#005596] focus:bg-white outline-none px-0.5 sm:px-1 rounded transition-all w-full min-w-0 text-xs sm:text-sm"
        />
        <p className="text-[10px] sm:text-[11px] text-slate-500 px-0.5 sm:px-1 hidden sm:block">{CAREER_STAGE_LABELS[p.cand.researchCareerStage]} • {p.cand.countryOfOrigin}</p>
      </td>

      <td className="px-2 sm:px-4 py-2 sm:py-3">
        <input
          type="text"
          value={p.cand.email}
          onChange={(e) => p.onUpdateField(p.cand.id, 'email', e.target.value)}
          placeholder="email@domaine.org"
          className={`font-mono font-semibold bg-transparent border-b hover:border-slate-300 focus:bg-white outline-none px-0.5 sm:px-1 rounded transition-all w-full min-w-0 text-[10px] sm:text-xs ${
            p.cand.status === 'invalid' ? 'border-red-400 text-red-700' : 'border-transparent text-[#55636B] focus:border-[#005596]'
          }`}
        />
      </td>

      <td className="px-2 sm:px-4 py-2 sm:py-3 hidden lg:table-cell">
        <input
          type="text"
          value={p.cand.affiliation}
          onChange={(e) => p.onUpdateField(p.cand.id, 'affiliation', e.target.value)}
          className="text-[#55636B] bg-transparent border-b border-transparent hover:border-slate-300 focus:border-[#005596] focus:bg-white outline-none px-0.5 sm:px-1 rounded transition-all w-full min-w-0 text-xs"
        />
      </td>

      <td className="px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap">
        <CandidateStatusBadgeView cand={p.cand} />
      </td>

      <td className="px-2 sm:px-4 py-2 sm:py-3 text-center">
        <select
          value={p.cand.resolutionAction}
          onChange={(e) => p.onResolutionChange(p.cand.id, e.target.value as any)}
          className="bg-white border border-[#C9D4DE] font-bold text-[10px] sm:text-xs rounded-lg sm:rounded-xl px-1.5 sm:px-3 py-1 sm:py-1.5 focus:ring-2 focus:ring-[#005596] outline-none cursor-pointer shadow-sm max-w-full"
        >
          {ACTION_OPTIONS[p.cand.status].map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </td>
    </tr>
  );
};

const ConflictStepView = (p: {
  candidates: ParsedContactCandidate[];
  filteredCandidates: ParsedContactCandidate[];
  filterStatus: 'all' | 'valid' | 'duplicate' | 'invalid';
  validCount: number;
  duplicateCount: number;
  invalidCount: number;
  isExecuting: boolean;
  importError: string | null;
  onFilterChange: (f: 'all' | 'valid' | 'duplicate' | 'invalid') => void;
  onBulkAction: (a: 'overwrite' | 'skip') => void;
  onUpdateField: (id: string, field: 'email' | 'fullName' | 'affiliation', val: string) => void;
  onResolutionChange: (id: string, action: 'import' | 'overwrite' | 'skip') => void;
  onBackToMapping: () => void;
  onExecute: () => void;
  onCloseError: () => void;
}) => {
  const allActive = p.filterStatus === 'all';
  const validActive = p.filterStatus === 'valid';
  const dupActive = p.filterStatus === 'duplicate';
  const invActive = p.filterStatus === 'invalid';
  const canExecute = !p.isExecuting && !p.candidates.every(c => c.resolutionAction === 'skip');
  const nonSkipped = p.candidates.filter(c => c.resolutionAction !== 'skip').length;
  return (
    <div className="space-y-4 max-w-[1440px] mx-auto">
      {/* Top Status Summary Bar */}
      <div className="bg-white rounded-2xl border border-[#C9D4DE]/50 p-3 sm:p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            onClick={() => p.onFilterChange('all')}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-[10px] sm:text-xs font-bold transition-all cursor-pointer ${allActive ? 'bg-[#005596] text-white shadow' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
          >
            Tous les contacts ({p.candidates.length})
          </button>

          <button
            onClick={() => p.onFilterChange('valid')}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-[10px] sm:text-xs font-bold transition-all cursor-pointer flex items-center gap-1 sm:gap-1.5 ${validActive ? 'bg-emerald-700 text-white shadow' : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'}`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span className="hidden sm:inline">Valides</span> ({p.validCount})
          </button>

          <button
            onClick={() => p.onFilterChange('duplicate')}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-[10px] sm:text-xs font-bold transition-all cursor-pointer flex items-center gap-1 sm:gap-1.5 ${dupActive ? 'bg-amber-600 text-white shadow' : 'bg-amber-50 text-amber-900 hover:bg-amber-100'}`}
          >
            <Copy className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span className="hidden sm:inline">Doublons</span> ({p.duplicateCount})
          </button>

          <button
            onClick={() => p.onFilterChange('invalid')}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-[10px] sm:text-xs font-bold transition-all cursor-pointer flex items-center gap-1 sm:gap-1.5 ${invActive ? 'bg-red-600 text-white shadow' : 'bg-red-50 text-red-900 hover:bg-red-100'}`}
          >
            <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span className="hidden sm:inline">Invalides</span> ({p.invalidCount})
          </button>
        </div>

        {p.duplicateCount > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-xs bg-amber-50 border border-amber-200 p-2 rounded-xl mt-2">
            <span className="font-bold text-amber-900 text-[10px] sm:text-xs">Doublons :</span>
            <button
              onClick={() => p.onBulkAction('overwrite')}
              className="px-2 sm:px-2.5 py-1 bg-amber-600 text-white rounded-lg font-bold hover:bg-amber-700 cursor-pointer text-[10px] sm:text-[11px]"
            >
              Tout Mettre à jour
            </button>
            <button
              onClick={() => p.onBulkAction('skip')}
              className="px-2 sm:px-2.5 py-1 bg-slate-600 text-white rounded-lg font-bold hover:bg-slate-700 cursor-pointer text-[10px] sm:text-[11px]"
            >
              Tout Ignorer
            </button>
          </div>
        )}
      </div>

      {/* Table of Candidates */}
      <div className="bg-white rounded-2xl border border-[#C9D4DE]/50 shadow-sm overflow-hidden">
        <div className="overflow-x-auto text-xs border rounded-lg max-h-[60vh]">
          <table className="w-full text-left font-medium">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[#E8F1F8]/60 text-[#55636B] border-b border-[#C9D4DE]/40 text-[10px] sm:text-[11px] font-bold uppercase">
                <th className="px-2 sm:px-4 py-2 sm:py-3 w-[40px]">#</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3">NOM COMPLET</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3">E-MAIL</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 hidden lg:table-cell">AFFILIATION</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3">STATUT</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-center">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {p.filteredCandidates.map(cand => (
                <CandidateRowView
                  key={cand.id}
                  cand={cand}
                  onUpdateField={p.onUpdateField}
                  onResolutionChange={p.onResolutionChange}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Action CTA */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 bg-white p-3 sm:p-6 rounded-2xl border border-[#C9D4DE]/50 shadow-sm">
        <button
          onClick={p.onBackToMapping}
          className="px-5 py-2.5 text-slate-600 hover:text-slate-900 font-bold text-xs rounded-xl hover:bg-slate-100 transition-colors cursor-pointer flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" /> Modifier le mappage des colonnes
        </button>

        <button
          onClick={p.onExecute}
          disabled={!canExecute}
          className="px-8 py-3.5 bg-[#005596] hover:bg-[#004275] text-white font-extrabold text-sm rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center gap-3 cursor-pointer disabled:opacity-50"
        >
          {p.isExecuting ? (
            <>
              <RotateCw className="w-5 h-5 animate-spin" /> Traitement en cours...
            </>
          ) : (
            <>
              Confirmer et Exécuter l'Importation ({nonSkipped})
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>

      {p.importError && (
        <div className="bg-rose-50 border border-rose-300 rounded-2xl p-6 flex flex-col sm:flex-row items-start gap-4 animate-fade-in">
          <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center shrink-0">
            <XCircle className="w-7 h-7" />
          </div>
          <div className="flex-1 text-left space-y-1.5">
            <p className="font-black text-rose-900 text-sm">Échec de l'importation</p>
            <p className="text-xs text-rose-700">{p.importError}</p>
            <p className="text-[11px] text-rose-500">
              Aucune modification n'a été enregistrée. Corrigez le problème puis réessayez.
            </p>
          </div>
          <button
            onClick={p.onCloseError}
            className="text-rose-400 hover:text-rose-600 cursor-pointer p-1"
            title="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
};

const ReportStepView = (p: {
  summaryReport: { importedNew: number; updatedMerged: number; skippedIgnored: number; errors: ParsedContactCandidate[] };
  onResetAll: () => void;
  onDownloadErrorLog: () => void;
}) => {
  return (
    <div className="bg-white rounded-2xl border border-[#C9D4DE]/60 p-8 shadow-sm max-w-4xl mx-auto space-y-8 animate-fade-in text-center">
      <div className="w-20 h-20 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto shadow-inner">
        <CheckCircle2 className="w-12 h-12" />
      </div>

      <div className="space-y-2">
        <h2 className="text-2xl font-black text-[#1C2529]">Importation Terminée avec Succès !</h2>
        <p className="text-xs text-[#55636B]">
          Les enregistrements ont été synchronisés et intégrés dans votre annuaire de contacts EURAXESS Africa.
        </p>
      </div>

      {/* Report Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
        <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-2xl space-y-1">
          <p className="text-3xl font-black text-emerald-800">{p.summaryReport.importedNew}</p>
          <p className="text-xs font-bold text-emerald-950 uppercase tracking-wider">Nouveaux Contacts Créés</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 p-5 rounded-2xl space-y-1">
          <p className="text-3xl font-black text-amber-800">{p.summaryReport.updatedMerged}</p>
          <p className="text-xs font-bold text-amber-950 uppercase tracking-wider">Doublons Mis à jour</p>
        </div>
        <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-1">
          <p className="text-3xl font-black text-slate-700">{p.summaryReport.skippedIgnored}</p>
          <p className="text-xs font-bold text-slate-800 uppercase tracking-wider">Lignes Ignorées / Erreurs</p>
        </div>
      </div>

      {/* Action Call-to-Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6 border-t border-slate-100">
        <Link
          to="/contacts"
          className="w-full sm:w-auto px-8 py-3.5 bg-[#005596] hover:bg-[#004275] text-white font-extrabold text-sm rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <Eye className="w-4 h-4" /> Voir les contacts importés
        </Link>

        {p.summaryReport.errors.length > 0 && (
          <button
            onClick={p.onDownloadErrorLog}
            className="w-full sm:w-auto px-6 py-3.5 bg-slate-100 text-slate-700 hover:bg-slate-200 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-600" /> Télécharger le rapport des erreurs (.csv)
          </button>
        )}

        <button
          onClick={p.onResetAll}
          className="w-full sm:w-auto px-6 py-3.5 border border-slate-300 text-slate-600 hover:text-slate-900 font-bold text-xs rounded-xl hover:bg-slate-50 transition-all cursor-pointer flex items-center justify-center gap-2"
        >
          <RefreshCw className="w-4 h-4" /> Importer un nouveau fichier
        </button>
      </div>
    </div>
  );
};

export const ImportWizardView: React.FC<ImportWizardViewProps> = ({
  onImportContacts,
  existingContacts
}) => {
  // Tab State
  const [activeTab, setActiveTab] = useState<'file' | 'ocr'>('file');

  // Wizard Step State
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  
  // File & Parser State
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<RawRowData[]>([]);
  
  // Column Mapping State: File Header -> System Field Key
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  
  // Row Analysis & Candidates State
  const [candidates, setCandidates] = useState<ParsedContactCandidate[]>([]);
  const [filterStatus, setFilterStatus] = useState<'all' | 'valid' | 'duplicate' | 'invalid'>('all');
  
  // Step 4 Final State
  const [isExecuting, setIsExecuting] = useState(false);
  const [summaryReport, setSummaryReport] = useState<{
    importedNew: number;
    updatedMerged: number;
    skippedIgnored: number;
    errors: ParsedContactCandidate[];
  }>({ importedNew: 0, updatedMerged: 0, skippedIgnored: 0, errors: [] });
  const [importError, setImportError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showEmailWarning, setShowEmailWarning] = useState(false);
  const [autoGenerateEmails, setAutoGenerateEmails] = useState(false);
  const [sheetInfo, setSheetInfo] = useState<{ sheetCount: number; sheetName: string; headerRowIndex: number } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const serverDuplicateEmailsRef = useRef<Set<string>>(new Set());

  // Reset file handler
  const handleResetFile = () => {
    setFile(null);
    setRawRows([]);
    setHeaders([]);
    setColumnMapping({});
    setCandidates([]);
    setFileError(null);
    setImportError(null);
    setIsAnalyzing(false);
    setShowEmailWarning(false);
    setAutoGenerateEmails(false);
    setSheetInfo(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Complete reset to initial clean slate state
  const handleResetAll = () => {
    setFile(null);
    setFileError(null);
    setHeaders([]);
    setRawRows([]);
    setColumnMapping({});
    setCandidates([]);
    setFilterStatus('all');
    setIsExecuting(false);
    setIsAnalyzing(false);
    setShowEmailWarning(false);
    setAutoGenerateEmails(false);
    setImportError(null);
    setSheetInfo(null);
    setSummaryReport({ importedNew: 0, updatedMerged: 0, skippedIgnored: 0, errors: [] });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setCurrentStep(1);
  };

  // ── Normalization helpers ──────────────────────────────────────────

  const normalizeGenderInput = (raw: string): Gender => {
    const v = raw.toLowerCase().trim();
    if (['f', 'femme', 'female', 'woman', 'féminin', 'feminin'].some(k => v === k || v.startsWith(k))) return 'FEMALE';
    if (['m', 'homme', 'male', 'man', 'masculin'].some(k => v === k || v.startsWith(k))) return 'MALE';
    return 'NOT_SPECIFIED';
  };

  const COUNTRY_CODE_MAP: Record<string, string> = {
    AF: 'Afghanistan', AL: 'Albanie', DZ: 'Algérie', AD: 'Andorre', AO: 'Angola',
    AG: 'Antigua-et-Barbude', AR: 'Argentine', AM: 'Arménie', AU: 'Australie', AT: 'Autriche',
    AZ: 'Azerbaïdjan', BS: 'Bahamas', BH: 'Bahreïn', BD: 'Bangladesh', BB: 'Barbade',
    BY: 'Biélorussie', BE: 'Belgique', BZ: 'Belize', BJ: 'Bénin', BT: 'Bhoutan',
    BO: 'Bolivie', BA: 'Bosnie-Herzégovine', BW: 'Botswana', BR: 'Brésil', BN: 'Brunei',
    BG: 'Bulgarie', BF: 'Burkina Faso', BI: 'Burundi', CV: 'Cap-Vert', KH: 'Cambodge',
    CM: 'Cameroun', CA: 'Canada', CF: 'République centrafricaine', TD: 'Tchad', CL: 'Chili',
    CN: 'Chine', CO: 'Colombie', KM: 'Comores', CG: 'Congo', CD: 'Rép. dém. du Congo',
    CR: 'Costa Rica', CI: 'Côte d\'Ivoire', HR: 'Croatie', CU: 'Cuba', CY: 'Chypre',
    CZ: 'République tchèque', DK: 'Danemark', DJ: 'Djibouti', DM: 'Dominique', DO: 'Rép. dominicaine',
    EC: 'Équateur', EG: 'Égypte', SV: 'Salvador', GQ: 'Guinée équatoriale', ER: 'Érythrée',
    EE: 'Estonie', SZ: 'Eswatini', ET: 'Éthiopie', FJ: 'Fidji', FI: 'Finlande',
    FR: 'France', GA: 'Gamie', GM: 'Gambie', GE: 'Géorgie', DE: 'Allemagne',
    GH: 'Ghana', GR: 'Grèce', GD: 'Grenade', GT: 'Guatemala', GN: 'Guinée',
    GW: 'Guinée-Bissau', GY: 'Guyana', HT: 'Haïti', HN: 'Honduras', HU: 'Hongrie',
    IS: 'Islande', IN: 'Inde', ID: 'Indonésie', IR: 'Iran', IQ: 'Irak',
    IE: 'Irlande', IL: 'Israël', IT: 'Italie', JM: 'Jamaïque', JP: 'Japon',
    JO: 'Jordanie', KZ: 'Kazakhstan', KE: 'Kenya', KI: 'Kiribati', KP: 'Corée du Nord',
    KR: 'Corée du Sud', KW: 'Koweït', KG: 'Kirghizistan', LA: 'Laos', LV: 'Lettonie',
    LB: 'Liban', LS: 'Lesotho', LR: 'Libéria', LY: 'Libye', LI: 'Liechtenstein',
    LT: 'Lituanie', LU: 'Luxembourg', MG: 'Madagascar', MW: 'Malawi', MY: 'Malaisie',
    MV: 'Maldives', ML: 'Mali', MT: 'Malte', MH: 'Îles Marshall', MR: 'Mauritanie',
    MU: 'Maurice', MX: 'Mexique', FM: 'Micronésie', MD: 'Moldavie', MC: 'Monaco',
    MN: 'Mongolie', ME: 'Monténégro', MA: 'Maroc', MZ: 'Mozambique', MM: 'Myanmar',
    NA: 'Namibie', NR: 'Nauru', NP: 'Népal', NL: 'Pays-Bas', NZ: 'Nouvelle-Zélande',
    NI: 'Nicaragua', NE: 'Niger', NG: 'Nigeria', MK: 'Macédoine du Nord', NO: 'Norvège',
    OM: 'Oman', PK: 'Pakistan', PW: 'Palaos', PS: 'Palestine', PA: 'Panama',
    PG: 'Papouasie-Nouvelle-Guinée', PY: 'Paraguay', PE: 'Pérou', PH: 'Philippines',
    PL: 'Pologne', PT: 'Portugal', QA: 'Qatar', RO: 'Roumanie', RU: 'Russie',
    RW: 'Rwanda', KN: 'Saint-Christophe-et-Niévès', LC: 'Sainte-Lucie', VC: 'Saint-Vincent-et-les-Grenadines',
    WS: 'Samoa', SM: 'San Marin', ST: 'São Tomé-et-Principe', SA: 'Arabie saoudite',
    SN: 'Sénégal', RS: 'Serbie', SC: 'Seychelles', SL: 'Sierra Leone', SG: 'Singapour',
    SK: 'Slovaquie', SI: 'Slovénie', SB: 'Îles Salomon', SO: 'Somalie', ZA: 'Afrique du Sud',
    SS: 'Soudan du Sud', ES: 'Espagne', LK: 'Sri Lanka', SD: 'Soudan', SR: 'Suriname',
    SE: 'Suède', CH: 'Suisse', SY: 'Syrie', TW: 'Taïwan', TJ: 'Tadjikistan',
    TZ: 'Tanzanie', TH: 'Thaïlande', TL: 'Timor oriental', TG: 'Togo', TO: 'Tonga',
    TT: 'Trinité-et-Tobago', TN: 'Tunisie', TR: 'Turquie', TM: 'Turkménistan', TV: 'Tuvalu',
    UG: 'Ouganda', UA: 'Ukraine', AE: 'Émirats arabes unis', GB: 'Royaume-Uni',
    US: 'États-Unis', UY: 'Uruguay', UZ: 'Ouzbékistan', VU: 'Vanuatu', VE: 'Venezuela',
    VN: 'Vietnam', YE: 'Yémen', ZM: 'Zambie', ZW: 'Zimbabwe'
  };

  const normalizeCountry = (raw: string): string => {
    const trimmed = raw.trim();
    if (!trimmed) return '';
    const upper = trimmed.toUpperCase();
    if (upper.length === 2 && COUNTRY_CODE_MAP[upper]) return COUNTRY_CODE_MAP[upper];
    return trimmed;
  };

  // Unified file load + auto-mapping pipeline
  const loadAndMapFile = async (selectedFile: File) => {
    setFileError(null);
    setFile(selectedFile);
    try {
      const parsed = await parseFile(selectedFile);
      const fieldMap = predictAllMappings(parsed.headers);
      setHeaders(parsed.headers);
      setRawRows(parsed.rows);
      setColumnMapping(fieldMap);
      setSheetInfo({ sheetCount: parsed.sheetCount, sheetName: parsed.sheetName, headerRowIndex: parsed.headerRowIndex });
      setCandidates([]);
      setSummaryReport({ importedNew: 0, updatedMerged: 0, skippedIgnored: 0, errors: [] });
      setFilterStatus('all');
      setAutoGenerateEmails(false);
      setShowEmailWarning(false);
      setCurrentStep(1);
      setFileError(null);
    } catch (err: any) {
      setFileError(toFileErrorMessage(err));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = pickDropFile(e);
    if (droppedFile) loadAndMapFile(droppedFile);
  };

  // Parse raw career stage string to enum value
  const parseCareerStage = (raw: string): ResearchCareerStage => {
    const clean = raw.toLowerCase().trim();
    if (!clean) return 'R1_FIRST_STAGE';
    if (['r1', 'r1_first_stage', 'r1 —', '1', 'debutant', 'débutant', 'first stage'].some(k => clean.includes(k))) return 'R1_FIRST_STAGE';
    if (['r2', 'r2_recognized', 'r2 —', '2', 'reconnu', 'recognised', 'recognized'].some(k => clean.includes(k))) return 'R2_RECOGNIZED';
    if (['r3', 'r3_established', 'r3 —', '3', 'établi', 'etabli', 'established'].some(k => clean.includes(k))) return 'R3_ESTABLISHED';
    if (['r4', 'r4_leading', 'r4 —', '4', 'leader', 'leading'].some(k => clean.includes(k))) return 'R4_LEADING';
    return 'R1_FIRST_STAGE';
  };

  // Check if required fields mapped in Step 2
  const isEmailMapped = Object.values(columnMapping).includes('email');
  const isNameMapped = Object.values(columnMapping).some(k => ['lastName', 'firstName', 'fullName'].includes(k as string));

  // Set of fields currently taken by other columns (for disabling in dropdown)
  const takenFields = useMemo(() => {
    const set = new Set<string>();
    Object.entries(columnMapping).forEach(([header, field]) => {
      if (field !== '__ignore__') set.add(field);
    });
    return set;
  }, [columnMapping]);

  // Handles mapping change with mutual exclusion rules:
  // - Two columns cannot map to the same system field
  // - fullName and firstName/lastName are mutually exclusive
  const handleColumnMappingChange = (header: string, newKey: string) => {
    setColumnMapping(prev => applyColumnMappingChange(prev, header, newKey));
    setAutoGenerateEmails(false);
    setShowEmailWarning(false);
    if (candidates.length > 0) setCandidates([]);
  };

  // Which fields are disabled (taken by another column) for a given header
  const isFieldTakenByOther = (header: string, fieldKey: string) => {
    if (fieldKey === '__ignore__') return false;
    if (columnMapping[header] === fieldKey) return false;
    return takenFields.has(fieldKey);
  };

  // Step 2 -> Step 3: Execute Row-by-Row Analysis & Conflict Resolution
  const analyzeRowsAndProceedToStep3 = useCallback(async () => {
    setIsAnalyzing(true);
    try {
      const serverRows = buildServerPreviewRows(rawRows, columnMapping);
      const duplicateEmails = await collectServerDataDuplicates(serverRows, existingContacts);
      serverDuplicateEmailsRef.current = duplicateEmails;

      const deps: AnalyzeRowDeps = {
        autoGenerateEmails,
        duplicateEmails,
        existingContacts,
        normalizeGenderInput,
        normalizeCountry,
        parseCareerStage
      };

      const analyzed = rawRows.map(row => analyzeSingleRow(row, columnMapping, deps));

      setCandidates(analyzed);
      setCurrentStep(3);
    } finally {
      setIsAnalyzing(false);
    }
  }, [rawRows, columnMapping, existingContacts, autoGenerateEmails]);

  // Resolution action change for a candidate in Step 3
  const handleCandidateResolutionChange = (id: string, action: 'import' | 'overwrite' | 'skip') => {
    setCandidates(prev => prev.map(c => setCandidateResolution(c, id, action)));
  };

  // Inline edit handler for candidate fields
  const handleUpdateCandidateField = (id: string, field: 'email' | 'fullName' | 'affiliation', val: string) => {
    setCandidates(prev => prev.map(c => updateCandidateInline(c, id, field, val, serverDuplicateEmailsRef.current)));
  };

  // Bulk duplicate resolution actions
  const handleBulkDuplicateAction = (action: 'overwrite' | 'skip') => {
    setCandidates(prev => prev.map(c => applyBulkCandidateAction(c, action)));
  };

  // Step 3 -> Step 4: Execute Final Import
  const handleExecuteImport = async () => {
    setIsExecuting(true);

    const parts = partitionCandidates(candidates);
    const result = await onImportContacts(parts.newContactsToAdd, parts.updatedContactsToMerge);

    setIsExecuting(false);

    const outcome = buildImportOutcome(result, parts);
    if (outcome.failed) {
      setImportError(outcome.errorMessage);
      return;
    }

    setImportError(null);
    setSummaryReport(outcome.summary);

    setCurrentStep(4);
  };

  // Generate & Download CSV Error Log
  const handleDownloadErrorLog = async () => {
    if (summaryReport.errors.length === 0) return;

    const errorRows = summaryReport.errors.map(err => ({
      'Ligne': err.rowIndex,
      'Nom': err.fullName,
      'Email': err.email,
      'Affiliation': err.affiliation,
      'Statut': err.status.toUpperCase(),
      'Motif': err.errorReason || 'Ignoré par l\'utilisateur',
      'Action': err.resolutionAction
    }));

    const Papa = (await import('papaparse')).default;
    const csvContent = Papa.unparse(errorRows);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `rapport_erreurs_import_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  // Candidates count by status
  const validCount = candidates.filter(c => c.status === 'valid').length;
  const duplicateCount = candidates.filter(c => c.status === 'duplicate').length;
  const invalidCount = candidates.filter(c => c.status === 'invalid').length;

  const filteredCandidates = useMemo(() => filterCandidatesByStatus(candidates, filterStatus), [candidates, filterStatus]);

  const fileExtension = detectFileExtension(file?.name);

  const handleWarnEmail = () => setShowEmailWarning(true);
  const handleAnalyze = () => analyzeRowsAndProceedToStep3();
  const handleAutoGenerateEmails = () => {
    setAutoGenerateEmails(true);
    setShowEmailWarning(false);
    analyzeRowsAndProceedToStep3();
  };

  const hasReport = reportHasEntries(summaryReport);
  const stepViews: Record<number, React.ReactNode> = {
    1: (
      <FileStepView
        fileError={fileError}
        file={file}
        rawRows={rawRows}
        headers={headers}
        sheetInfo={sheetInfo}
        fileExtension={fileExtension}
        fileInputRef={fileInputRef}
        onDrop={handleDrop}
        onFileSelect={loadAndMapFile}
        onOpenFilePicker={() => fileInputRef.current?.click()}
        onResetFile={handleResetFile}
        onContinueToMapping={() => setCurrentStep(2)}
      />
    ),
    2: (
      <MappingStepView
        headers={headers}
        rawRows={rawRows}
        columnMapping={columnMapping}
        fileName={file?.name}
        isEmailMapped={isEmailMapped}
        isNameMapped={isNameMapped}
        onMappingChange={handleColumnMappingChange}
        isFieldTakenByOther={isFieldTakenByOther}
        sidebar={
          <MappingSidebarView
            showEmailWarning={showEmailWarning}
            isEmailMapped={isEmailMapped}
            autoGenerateEmails={autoGenerateEmails}
            isAnalyzing={isAnalyzing}
            onAutoGenerateEmails={handleAutoGenerateEmails}
            onDismissEmailWarning={() => setShowEmailWarning(false)}
            onRunAnalysis={handleAnalyze}
            onWarnEmail={handleWarnEmail}
            onBackToFile={() => setCurrentStep(1)}
          />
        }
      />
    ),
    3: (
      <ConflictStepView
        candidates={candidates}
        filteredCandidates={filteredCandidates}
        filterStatus={filterStatus}
        validCount={validCount}
        duplicateCount={duplicateCount}
        invalidCount={invalidCount}
        isExecuting={isExecuting}
        importError={importError}
        onFilterChange={setFilterStatus}
        onBulkAction={handleBulkDuplicateAction}
        onUpdateField={handleUpdateCandidateField}
        onResolutionChange={handleCandidateResolutionChange}
        onBackToMapping={() => setCurrentStep(2)}
        onExecute={handleExecuteImport}
        onCloseError={() => setImportError(null)}
      />
    ),
    4: (
      <ReportStepView summaryReport={summaryReport} onDownloadErrorLog={handleDownloadErrorLog} onResetAll={handleResetAll} />
    )
  };

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-8 space-y-8 animate-fade-in">
      
      {/* Header Title */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#005596] uppercase tracking-wider mb-1">
            <Layers className="w-4 h-4" /> Assistant d'Importation Pro
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1C2529]">
            Importation & Synchronisation des Contacts
          </h1>
          <p className="text-sm text-[#55636B] mt-1">
            Intégrez vos fichiers CSV ou XLSX dans la base réseau EURAXESS Africa avec détection intelligente des doublons.
          </p>
        </div>

        {file && (
          <div className="bg-[#E8F1F8] text-[#005596] border border-[#005596]/40 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm">
            <FileSpreadsheet className="w-4 h-4 text-[#005596]" />
            <span>{file.name} ({rawRows.length} lignes décelées)</span>
          </div>
        )}
      </header>

      {/* Tab Bar */}
      <div className="flex items-center bg-[#E8F1F8] p-1.5 rounded-xl border border-[#C9D4DE]/40">
        <button
          onClick={() => setActiveTab('file')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'file'
              ? 'bg-[#005596] text-white shadow'
              : 'text-[#55636B] hover:text-[#005596]'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          Importer un fichier
        </button>
        <button
          onClick={() => setActiveTab('ocr')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'ocr'
              ? 'bg-[#005596] text-white shadow'
              : 'text-[#55636B] hover:text-[#005596]'
          }`}
        >
          <Camera className="w-4 h-4" />
          Scanner une carte de visite
        </button>
      </div>

      {/* FILE TAB */}
      {activeTab === 'file' && (<>
      {/* 4-Step Stepper Progress Bar */}
      <StepperBarView
        currentStep={currentStep}
        hasLoadedFile={Boolean(file && rawRows.length > 0)}
        hasRows={rawRows.length > 0}
        hasCandidates={candidates.length > 0}
        isAnalyzing={isAnalyzing}
        hasReport={hasReport}
        isEmailMapped={isEmailMapped}
        autoGenerateEmails={autoGenerateEmails}
        onGotoStep1={() => setCurrentStep(1)}
        onGotoStep2={() => setCurrentStep(2)}
        onGotoStep3={() => setCurrentStep(3)}
        onGotoStep4={() => setCurrentStep(4)}
        onAnalyze={handleAnalyze}
        onWarnEmail={handleWarnEmail}
      />

      {/* STEP 1: FILE VALIDATION & PARSING */}
      {currentStep === 1 && stepViews[1]}

      {/* STEP 2: COLUMN MAPPING ENGINE */}
      {currentStep === 2 && stepViews[2]}

      {/* STEP 3: ROW-BY-ROW ANALYSIS & CONFLICT RESOLUTION */}
      {currentStep === 3 && stepViews[3]}

      {/* STEP 4: IMPORT EXECUTION & REPORT SUMMARY */}
      {currentStep === 4 && stepViews[4]}
      </>)}

      {/* OCR TAB */}
      {activeTab === 'ocr' && (
        <div className="bg-white rounded-2xl border border-[#C9D4DE]/60 p-8 shadow-[0_6px_18px_rgba(0,0,0,0.06)] max-w-4xl mx-auto">
          <div className="text-center space-y-2 mb-6">
            <h2 className="text-xl font-extrabold text-[#1C2529]">Scanner une carte de visite</h2>
            <p className="text-xs text-[#55636B]">
              Uploadez une photo d'une carte de visite — l'IA extraira automatiquement les informations du contact.
            </p>
          </div>
          <OcrImportTab onSaveContact={onImportContacts} />
        </div>
      )}

    </div>
  );
};
