import React, { useState, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Contact, Gender, ResearchCareerStage, CAREER_STAGE_LABELS } from '../types';
import { splitFullName } from '../utils/format';
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
  data: { createdCount: number; updatedCount: number } | null;
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
  resolutionAction: 'import' | 'overwrite' | 'skip' | 'create_new';
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

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset file handler
  const handleResetFile = () => {
    setFile(null);
    setRawRows([]);
    setHeaders([]);
    setColumnMapping({});
    setCandidates([]);
    setFileError(null);
    setImportError(null);
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
    setImportError(null);
    setSummaryReport({ importedNew: 0, updatedMerged: 0, skippedIgnored: 0, errors: [] });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setCurrentStep(1);
  };

  // Auto-matching algorithm for standard headers
  const autoMatchHeader = (header: string): string => {
    const clean = header.toLowerCase().trim();
    if (['email', 'e-mail', 'courriel', 'mail', 'adresse email'].some(k => clean.includes(k))) return 'email';
    if (clean === 'prénom' || clean === 'prenom' || clean === 'first name' || clean === 'firstname') return 'firstName';
    if (clean === 'nom' || clean === 'last name' || clean === 'lastname' || clean === 'family name') return 'lastName';
    if (['nom complet', 'nom & prénom', 'nom et prénom', 'contact', 'full name', 'fullname'].some(k => clean.includes(k))) return 'fullName';
    if (['pays d\'origine', 'pays', 'pays de provenance', 'country of origin', 'country'].some(k => clean.includes(k))) return 'countryOfOrigin';
    if (['ville', 'city', 'town'].some(k => clean.includes(k))) return 'city';
    if (['téléphone', 'telephone', 'tél', 'tel', 'phone', 'mobile', 'cell'].some(k => clean.includes(k))) return 'phone';
    if (['affiliation', 'organisation', 'organisme', 'société', 'societe', 'entreprise', 'institution', 'company', 'company name'].some(k => clean.includes(k))) return 'affiliation';
    if (['fonction', 'poste', 'titre', 'job', 'position', 'role', 'rôle'].some(k => clean.includes(k))) return 'function';
    if (['expérience', 'experience', 'années d\'expérience', 'ans d\'expérience'].some(k => clean.includes(k))) return 'experience';
    if (['faculté', 'faculte', 'département', 'departement', 'faculty', 'department', 'faculty/department', 'faculté / département'].some(k => clean.includes(k))) return 'facultyDepartment';
    if (['stade de carrière', 'stade de carriere', 'carrière', 'career stage', 'career', 'research career stage'].some(k => clean.includes(k))) return 'researchCareerStage';
    if (['tags', 'mots-clés', 'mots clés', 'keywords'].some(k => clean.includes(k))) return 'tags';
    return '__ignore__';
  };

  // Helper to process parsed 2D array of rows
  const processParsedData = (rowsMatrix: any[][]) => {
    if (!rowsMatrix || rowsMatrix.length < 2) {
      setFileError("Impossible de lire ce fichier. Veuillez vérifier le format (.csv ou .xlsx) et vous assurer qu'il contient des données.");
      return;
    }

    // Header extraction
    const rawHeaders = rowsMatrix[0].map((h, i) => String(h || `Colonne_${i + 1}`).trim());
    const validHeaders = rawHeaders.filter(h => h.length > 0);

    if (validHeaders.length === 0) {
      setFileError("Impossible de lire ce fichier. Veuillez vérifier le format (.csv ou .xlsx) et vous assurer qu'il contient des données.");
      return;
    }

    // Build raw row objects
    const dataRows: RawRowData[] = [];
    for (let r = 1; r < rowsMatrix.length; r++) {
      const rowArr = rowsMatrix[r];
      if (!rowArr || rowArr.every(cell => cell === null || cell === undefined || String(cell).trim() === '')) {
        continue; // Skip completely empty rows
      }

      const rowObj: Record<string, string> = {};
      rawHeaders.forEach((h, colIdx) => {
        rowObj[h] = rowArr[colIdx] !== undefined && rowArr[colIdx] !== null ? String(rowArr[colIdx]).trim() : '';
      });
      dataRows.push({ rowIndex: r + 1, originalData: rowObj });
    }

    if (dataRows.length === 0) {
      setFileError("Impossible de lire ce fichier. Veuillez vérifier le format (.csv ou .xlsx) et vous assurer qu'il contient des données.");
      return;
    }

    // Auto mapping
    const initialMapping: Record<string, string> = {};
    rawHeaders.forEach(h => {
      initialMapping[h] = autoMatchHeader(h);
    });

    setHeaders(rawHeaders);
    setRawRows(dataRows);
    setColumnMapping(initialMapping);
    setFileError(null);
  };

  // Parse Excel file (.xlsx, .xls)
  // exceljs est chargé dynamiquement : il ne pèse dans le bundle initial que
  // lorsqu'un fichier Excel est réellement analysé (code splitting).
  const parseExcelFile = async (fileObj: File) => {
    try {
      const ExcelJS = (await import('exceljs')).default;
      const arrayBuffer = await fileObj.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await (workbook.xlsx as any).load(arrayBuffer);

      const worksheet = workbook.worksheets[0];
      if (!worksheet) {
        throw new Error('Aucune feuille de calcul trouvée.');
      }

      const matrix: any[][] = [];
      worksheet.eachRow({ includeEmpty: false }, (row) => {
        const rowValues = Array.isArray(row.values) ? row.values.slice(1) : [];
        const cleanedValues = rowValues.map(cell => {
          if (cell === null || cell === undefined) return '';
          if (typeof cell === 'object' && !(cell instanceof Date)) {
            const cellObj = cell as any;
            if ('result' in cellObj) return cellObj.result ?? '';
            if ('text' in cellObj) return cellObj.text ?? '';
            if ('richText' in cellObj && Array.isArray(cellObj.richText)) {
              return cellObj.richText.map((rt: any) => rt.text || '').join('');
            }
            if ('hyperlink' in cellObj) return cellObj.text || cellObj.hyperlink || '';
          }
          return String(cell);
        });
        matrix.push(cleanedValues);
      });

      processParsedData(matrix);
    } catch (err) {
      setFileError("Impossible de lire ce fichier. Veuillez vérifier le format (.csv ou .xlsx) et vous assurer qu'il contient des données.");
    }
  };

  // Parse CSV file (.csv) — papaparse chargé à la demande (code splitting).
  const parseCSVFile = async (fileObj: File) => {
    const Papa = (await import('papaparse')).default;
    Papa.parse(fileObj, {
      skipEmptyLines: 'greedy',
      complete: (results) => {
        if (results.errors && results.errors.length > 0 && results.data.length === 0) {
          setFileError("Impossible de lire ce fichier. Veuillez vérifier le format (.csv ou .xlsx) et vous assurer qu'il contient des données.");
          return;
        }
        processParsedData(results.data as any[][]);
      },
      error: () => {
        setFileError("Impossible de lire ce fichier. Veuillez vérifier le format (.csv ou .xlsx) et vous assurer qu'il contient des données.");
      }
    });
  };

  // File selection handler
  const handleFileSelect = (selectedFile: File) => {
    setFileError(null);
    setFile(selectedFile);
    
    const nameLower = selectedFile.name.toLowerCase();
    if (nameLower.endsWith('.xlsx') || nameLower.endsWith('.xls')) {
      parseExcelFile(selectedFile);
    } else if (nameLower.endsWith('.csv') || nameLower.endsWith('.txt')) {
      parseCSVFile(selectedFile);
    } else {
      setFileError("Format non supporté. Veuillez sélectionner un fichier .csv, .xlsx ou .xls.");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  // Parse raw career stage string to enum value
  const parseCareerStage = (raw: string): ResearchCareerStage => {
    const clean = raw.toLowerCase().trim();
    if (['r1', 'r1_first_stage', 'r1 —', '1', 'debutant', 'débutant', 'first stage'].some(k => clean.includes(k))) return 'R1_FIRST_STAGE';
    if (['r2', 'r2_recognized', 'r2 —', '2', 'reconnu', 'recognised', 'recognized'].some(k => clean.includes(k))) return 'R2_RECOGNIZED';
    if (['r3', 'r3_established', 'r3 —', '3', 'établi', 'etabli', 'established'].some(k => clean.includes(k))) return 'R3_ESTABLISHED';
    if (['r4', 'r4_leading', 'r4 —', '4', 'leader', 'leading'].some(k => clean.includes(k))) return 'R4_LEADING';
    return 'R1_FIRST_STAGE';
  };

  // Check if required fields mapped in Step 2
  const isEmailMapped = Object.values(columnMapping).includes('email');
  const isNameMapped = Object.values(columnMapping).some(k => ['lastName', 'firstName', 'fullName'].includes(k as string));

  // Step 2 -> Step 3: Execute Row-by-Row Analysis & Conflict Resolution
  const analyzeRowsAndProceedToStep3 = () => {
    const analyzed: ParsedContactCandidate[] = rawRows.map(row => {
      const getVal = (sysKey: string): string => {
        const headerMatch = Object.keys(columnMapping).find(h => columnMapping[h] === sysKey);
        return headerMatch ? row.originalData[headerMatch] || '' : '';
      };

      const email = getVal('email').trim();
      let firstName = getVal('firstName').trim();
      let lastName = getVal('lastName').trim();
      const fullNameVal = getVal('fullName').trim();

      // Split the "Nom complet" column into firstName / lastName when
      // individual name columns are not mapped.
      if (!firstName && !lastName && fullNameVal) {
        const split = splitFullName(fullNameVal);
        firstName = split.firstName;
        lastName = split.lastName;
      }

      const gender: Gender = 'NOT_SPECIFIED';
      const countryOfOrigin = getVal('countryOfOrigin').trim() || 'Sénégal';
      const city = getVal('city').trim();
      const phone = getVal('phone').trim() || '';
      const affiliation = getVal('affiliation').trim() || '';
      const fonction = getVal('function').trim() || '';
      const experience = getVal('experience').trim() || '';
      const facultyDepartment = getVal('facultyDepartment').trim() || '';
      const researchCareerStage = parseCareerStage(getVal('researchCareerStage'));

      const rawTags = getVal('tags');
      const tags = rawTags ? rawTags.split(/[,;/]/).map(s => s.trim()).filter(Boolean) : ['Importation'];

      // Derive fullName
      let finalFullName = fullNameVal;
      if (!finalFullName) {
        finalFullName = [firstName, lastName].filter(Boolean).join(' ');
      }
      if (!finalFullName) {
        finalFullName = email.split('@')[0] || `Contact #${row.rowIndex}`;
      }
      finalFullName = finalFullName.trim();

      // Validate email & required identity
      const isValidEmailFormat = !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      const cleanEmail = email.toLowerCase();

      // Check duplicate against existing contacts
      const duplicateMatch = existingContacts.find(c =>
        (cleanEmail && c.email.toLowerCase() === cleanEmail) ||
        (finalFullName.toLowerCase() === c.name.toLowerCase() && affiliation.toLowerCase() === c.affiliation.toLowerCase())
      );

      let status: 'valid' | 'duplicate' | 'invalid' = 'valid';
      let errorReason: string | undefined = undefined;

      if (!isValidEmailFormat && email.length > 0) {
        status = 'invalid';
        errorReason = 'Format e-mail invalide';
      } else if (!email && !firstName && !lastName && !fullNameVal) {
        status = 'invalid';
        errorReason = 'Identifiant manquant (E-mail ou Nom absent)';
      } else if (duplicateMatch) {
        status = 'duplicate';
      }

      const defaultAction = status === 'duplicate' ? 'overwrite' : status === 'invalid' ? 'skip' : 'import';

      return {
        id: `candidate-${row.rowIndex}-${Date.now()}`,
        rowIndex: row.rowIndex,
        firstName,
        lastName,
        fullName: finalFullName,
        email,
        gender,
        countryOfOrigin,
        city,
        phone,
        affiliation,
        function: fonction,
        experience,
        facultyDepartment,
        researchCareerStage,
        tags,
        status,
        errorReason,
        duplicateMatch,
        resolutionAction: defaultAction
      };
    });

    setCandidates(analyzed);
    setCurrentStep(3);
  };

  // Resolution action change for a candidate in Step 3
  const handleCandidateResolutionChange = (id: string, action: 'import' | 'overwrite' | 'skip' | 'create_new') => {
    setCandidates(prev => prev.map(c => c.id === id ? { ...c, resolutionAction: action } : c));
  };

  // Inline edit handler for candidate fields
  const handleUpdateCandidateField = (id: string, field: 'email' | 'fullName' | 'affiliation', val: string) => {
    setCandidates(prev => prev.map(c => {
      if (c.id !== id) return c;
      const updated = { ...c, [field]: val };

      // When "Nom complet" is edited inline, re-split into firstName / lastName.
      if (field === 'fullName') {
        updated.fullName = val.trim();
        const split = splitFullName(val);
        updated.firstName = split.firstName;
        updated.lastName = split.lastName;
      }
      
      // Re-evaluate validity
      const emailValid = !updated.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updated.email);
      const cleanEmail = updated.email.toLowerCase();
      
      const duplicateMatch = existingContacts.find(ex => 
        (cleanEmail && ex.email.toLowerCase() === cleanEmail)
      );

      if (!emailValid) {
        updated.status = 'invalid';
        updated.errorReason = 'Format e-mail invalide';
        updated.resolutionAction = 'skip';
      } else if (!updated.email && !updated.fullName) {
        updated.status = 'invalid';
        updated.errorReason = 'Identifiant manquant';
        updated.resolutionAction = 'skip';
      } else if (duplicateMatch) {
        updated.status = 'duplicate';
        updated.duplicateMatch = duplicateMatch;
        updated.errorReason = undefined;
        if (updated.resolutionAction === 'skip') updated.resolutionAction = 'overwrite';
      } else {
        updated.status = 'valid';
        updated.errorReason = undefined;
        updated.duplicateMatch = undefined;
        updated.resolutionAction = 'import';
      }

      return updated;
    }));
  };

  // Bulk duplicate resolution actions
  const handleBulkDuplicateAction = (action: 'overwrite' | 'skip' | 'create_new') => {
    setCandidates(prev => prev.map(c => c.status === 'duplicate' ? { ...c, resolutionAction: action } : c));
  };

  // Step 3 -> Step 4: Execute Final Import
  const handleExecuteImport = async () => {
    setIsExecuting(true);

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
        const merged: Contact = {
          ...cand.duplicateMatch,
          name: cand.fullName || cand.duplicateMatch.name,
          firstName: cand.firstName || cand.duplicateMatch.firstName,
          lastName: cand.lastName || cand.duplicateMatch.lastName,
          email: cand.email || cand.duplicateMatch.email,
          phone: cand.phone || cand.duplicateMatch.phone,
          gender: cand.gender,
          countryOfOrigin: cand.countryOfOrigin || cand.duplicateMatch.countryOfOrigin,
          city: cand.city || cand.duplicateMatch.city,
          affiliation: cand.affiliation || cand.duplicateMatch.affiliation,
          function: cand.function || cand.duplicateMatch.function,
          experience: cand.experience || cand.duplicateMatch.experience,
          facultyDepartment: cand.facultyDepartment || cand.duplicateMatch.facultyDepartment,
          researchCareerStage: cand.researchCareerStage,
          tags: Array.from(new Set([...(cand.duplicateMatch.tags || []), ...cand.tags, 'Importé', 'Mis à jour']))
        };
        updatedContactsToMerge.push(merged);
        countMerged++;
      } else {
        const initials = cand.fullName
          .split(' ')
          .map(n => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2) || 'NC';

        const newContact: Contact = {
          id: `imp-${cand.rowIndex}-${Date.now()}`,
          name: cand.fullName,
          initials: initials,
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
        newContactsToAdd.push(newContact);
        countNew++;
      }
    });

    const result = await onImportContacts(newContactsToAdd, updatedContactsToMerge);

    setIsExecuting(false);

    if (!result.ok || result.status !== 'SUCCESS') {
      setImportError(result.errorMessage || 'Erreur inconnue lors de l\'importation.');
      return;
    }

    setImportError(null);
    setSummaryReport({
      importedNew: countNew,
      updatedMerged: countMerged,
      skippedIgnored: skippedList.length,
      errors: skippedList
    });

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
    document.body.removeChild(link);
  };

  // Candidates count by status
  const validCount = candidates.filter(c => c.status === 'valid').length;
  const duplicateCount = candidates.filter(c => c.status === 'duplicate').length;
  const invalidCount = candidates.filter(c => c.status === 'invalid').length;

  const filteredCandidates = useMemo(() => {
    if (filterStatus === 'valid') return candidates.filter(c => c.status === 'valid');
    if (filterStatus === 'duplicate') return candidates.filter(c => c.status === 'duplicate');
    if (filterStatus === 'invalid') return candidates.filter(c => c.status === 'invalid');
    return candidates;
  }, [candidates, filterStatus]);

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
            Intégrez vos fichiers CSV, XLSX ou XLS dans la base réseau EURAXESS Africa avec détection intelligente des doublons.
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
      <div className="px-2 py-4 bg-white rounded-2xl border border-[#C9D4DE]/50 shadow-sm overflow-x-auto scrollbar-none">
        <div className="flex items-center w-full justify-between relative min-w-[500px] max-w-4xl mx-auto px-4">
          
          {/* Step 1 */}
          <button 
            type="button"
            onClick={() => setCurrentStep(1)}
            className="flex flex-col items-center gap-1.5 z-10 cursor-pointer group bg-transparent border-0 outline-none"
            title="Aller à l'étape 1 (Chargement du fichier)"
          >
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all group-hover:scale-105 ${
              currentStep === 1 
                ? 'bg-[#005596] text-white ring-4 ring-[#005596]/30 scale-105 shadow-md' 
                : currentStep > 1 ? 'bg-[#005596] text-white' : 'bg-slate-200 text-slate-500'
            }`}>
              {currentStep > 1 ? <Check className="w-5 h-5" /> : '1'}
            </div>
            <span className={`text-[11px] font-extrabold uppercase tracking-wider transition-colors ${
              currentStep === 1 ? 'text-[#005596]' : 'text-slate-500 group-hover:text-[#005596]'
            }`}>
              1. Chargement
            </span>
          </button>

          <div className={`flex-grow h-[3px] mx-2 transition-colors ${currentStep >= 2 ? 'bg-[#005596]' : 'bg-slate-200'}`} />

          {/* Step 2 */}
          <button 
            type="button"
            disabled={!file || rawRows.length === 0}
            onClick={() => {
              if (file && rawRows.length > 0) {
                setCurrentStep(2);
              }
            }}
            className={`flex flex-col items-center gap-1.5 z-10 bg-transparent border-0 outline-none ${
              file && rawRows.length > 0 ? 'cursor-pointer group' : 'cursor-not-allowed opacity-50'
            }`}
            title={file && rawRows.length > 0 ? "Aller à l'étape 2 (Mappage des colonnes)" : "Chargez d'abord un fichier valide"}
          >
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
              currentStep === 2 
                ? 'bg-[#005596] text-white ring-4 ring-[#005596]/30 scale-105 shadow-md' 
                : currentStep > 2 ? 'bg-[#005596] text-white' : 'bg-slate-200 text-slate-500'
            } ${file && rawRows.length > 0 ? 'group-hover:scale-105' : ''}`}>
              {currentStep > 2 ? <Check className="w-5 h-5" /> : '2'}
            </div>
            <span className={`text-[11px] font-extrabold uppercase tracking-wider transition-colors ${
              currentStep === 2 ? 'text-[#005596]' : 'text-slate-500 group-hover:text-[#005596]'
            }`}>
              2. Mappage
            </span>
          </button>

          <div className={`flex-grow h-[3px] mx-2 transition-colors ${currentStep >= 3 ? 'bg-[#005596]' : 'bg-slate-200'}`} />

          {/* Step 3 */}
          <button 
            type="button"
            disabled={rawRows.length === 0}
            onClick={() => {
              if (rawRows.length > 0) {
                if (candidates.length === 0) {
                  analyzeRowsAndProceedToStep3();
                } else {
                  setCurrentStep(3);
                }
              }
            }}
            className={`flex flex-col items-center gap-1.5 z-10 bg-transparent border-0 outline-none ${
              rawRows.length > 0 ? 'cursor-pointer group' : 'cursor-not-allowed opacity-50'
            }`}
            title={rawRows.length > 0 ? "Aller à l'étape 3 (Analyse et résolution des conflits)" : "Mappez d'abord les colonnes d'un fichier"}
          >
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
              currentStep === 3 
                ? 'bg-[#005596] text-white ring-4 ring-[#005596]/30 scale-105 shadow-md' 
                : currentStep > 3 ? 'bg-[#005596] text-white' : 'bg-slate-200 text-slate-500'
            } ${rawRows.length > 0 ? 'group-hover:scale-105' : ''}`}>
              {currentStep > 3 ? <Check className="w-5 h-5" /> : '3'}
            </div>
            <span className={`text-[11px] font-extrabold uppercase tracking-wider transition-colors ${
              currentStep === 3 ? 'text-[#005596]' : 'text-slate-500 group-hover:text-[#005596]'
            }`}>
              3. Analyse & Conflits
            </span>
          </button>

          <div className={`flex-grow h-[3px] mx-2 transition-colors ${currentStep >= 4 ? 'bg-[#005596]' : 'bg-slate-200'}`} />

          {/* Step 4 */}
          <button 
            type="button"
            disabled={summaryReport.importedNew === 0 && summaryReport.updatedMerged === 0 && summaryReport.skippedIgnored === 0}
            onClick={() => {
              if (summaryReport.importedNew > 0 || summaryReport.updatedMerged > 0 || summaryReport.skippedIgnored > 0) {
                setCurrentStep(4);
              }
            }}
            className={`flex flex-col items-center gap-1.5 z-10 bg-transparent border-0 outline-none ${
              (summaryReport.importedNew > 0 || summaryReport.updatedMerged > 0 || summaryReport.skippedIgnored > 0) ? 'cursor-pointer group' : 'cursor-not-allowed opacity-50'
            }`}
            title="Rapport d'importation final"
          >
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
              currentStep === 4 
                ? 'bg-[#005596] text-white ring-4 ring-[#005596]/30 scale-105 shadow-md' 
                : 'bg-slate-200 text-slate-500'
            } ${(summaryReport.importedNew > 0 || summaryReport.updatedMerged > 0 || summaryReport.skippedIgnored > 0) ? 'group-hover:scale-105' : ''}`}>
              4
            </div>
            <span className={`text-[11px] font-extrabold uppercase tracking-wider transition-colors ${
              currentStep === 4 ? 'text-[#005596]' : 'text-slate-500 group-hover:text-[#005596]'
            }`}>
              4. Rapport Final
            </span>
          </button>

        </div>
      </div>

      {/* STEP 1: FILE VALIDATION & PARSING */}
      {currentStep === 1 && (
        <div className="bg-white rounded-2xl border border-[#C9D4DE]/60 p-8 shadow-[0_6px_18px_rgba(0,0,0,0.06)] max-w-4xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-xl font-extrabold text-[#1C2529]">Étape 1 : Sélectionner le fichier de contacts</h2>
            <p className="text-xs text-[#55636B]">
              Formats supportés : <strong className="text-[#005596]">.csv, .xlsx, .xls</strong>. Assurez-vous que la première ligne contient les en-têtes de colonnes.
            </p>
          </div>

          {/* Error Banner */}
          {fileError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-800 text-xs animate-shake">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-red-900">Fichier invalide ou corrompu</p>
                <p className="mt-0.5">{fileError}</p>
              </div>
            </div>
          )}

          {/* Drag & Drop Box */}
          <div 
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-3 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all space-y-4 group ${
              file && !fileError
                ? 'border-[#005596] bg-[#E8F1F8]/40'
                : 'border-[#005596]/50 hover:border-[#005596] bg-slate-50/50 hover:bg-[#E8F1F8]/30'
            }`}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])} 
              accept=".csv,.xlsx,.xls,.txt" 
              className="hidden" 
            />
            
            <div className="w-16 h-16 bg-[#005596] text-white rounded-2xl flex items-center justify-center mx-auto shadow-md group-hover:scale-110 transition-transform">
              <Upload className="w-8 h-8" />
            </div>

            <div>
              <p className="font-bold text-sm text-[#1C2529]">
                Glissez-déposez votre fichier ici ou <span className="text-[#005596] underline">parcourez vos fichiers</span>
              </p>
              <p className="text-xs text-[#55636B] mt-1">Accepte les fichiers .csv et Excel (.xlsx, .xls)</p>
            </div>
          </div>

          {/* Loaded File Info Card */}
          {file && !fileError && rawRows.length > 0 && (
            <div className="p-5 bg-emerald-50/90 border border-emerald-200 rounded-2xl space-y-4 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start sm:items-center gap-3">
                  <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl shrink-0 mt-0.5 sm:mt-0">
                    <FileCheck className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-sm text-emerald-950">{file.name}</p>
                      <span className="px-2 py-0.5 bg-emerald-200/80 text-emerald-900 text-[10px] font-extrabold rounded-md uppercase">
                        {file.name.endsWith('.xlsx') || file.name.endsWith('.xls') ? '.xlsx / excel' : '.csv'}
                      </span>
                      <span className="text-xs text-emerald-700 font-semibold">
                        ({(file.size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                    <p className="text-xs text-emerald-800 font-medium flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      {rawRows.length} lignes valides détectées • {headers.length} colonnes identifiées
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <button
                    type="button"
                    onClick={handleResetFile}
                    className="px-3.5 py-2.5 bg-white hover:bg-red-50 text-red-600 border border-red-200 font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                    title="Supprimer ou remplacer le fichier"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remplacer</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="px-5 py-2.5 bg-[#005596] hover:bg-[#004275] text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2 transition-all cursor-pointer"
                  >
                    <span>Continuer vers Mappage</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* STEP 2: COLUMN MAPPING ENGINE */}
      {currentStep === 2 && (
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 min-[1380px]:col-span-8 space-y-6">
            <div className="bg-white rounded-2xl border border-[#C9D4DE]/50 shadow-sm p-6 space-y-6">
              
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-[#1C2529]">Associer les colonnes du fichier aux champs système</h2>
                  <p className="text-xs text-[#55636B] mt-0.5">
                    Sélectionnez le champ équivalent pour chaque colonne extraite de <strong className="text-[#005596]">{file?.name}</strong>.
                  </p>
                </div>
                
                <span className="text-xs font-bold bg-[#E8F1F8] text-[#005596] px-3 py-1.5 rounded-full border border-[#005596]/30">
                  {Object.values(columnMapping).filter(v => v !== '__ignore__').length} / {headers.length} Mappées
                </span>
              </div>

              {/* Warning if email or name missing */}
              {(!isEmailMapped || !isNameMapped) && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 text-xs text-amber-900">
                  <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Avertissement sur les champs recommandés</p>
                    <p className="mt-0.5">
                      {!isEmailMapped && "• La colonne E-mail n'est actuellement pas associée. "}
                      {!isNameMapped && "• Aucune colonne Nom/Prénom n'est associée. "}
                      Les lignes dépourvues d'identifiants seront signalées comme invalides à l'étape suivante.
                    </p>
                  </div>
                </div>
              )}

              {/* Header Mapping Table */}
              <div className="space-y-3">
                {headers.map((header) => {
                  const sampleValue = rawRows[0]?.originalData[header] || 'Exemple de donnée';
                  const currentMappedKey = columnMapping[header] || '__ignore__';

                  return (
                    <div 
                      key={header}
                      className={`p-4 rounded-xl border transition-all flex flex-col min-[1380px]:flex-row min-[1380px]:items-center justify-between gap-3 ${
                        currentMappedKey !== '__ignore__' ? 'bg-slate-50 border-[#005596]/40 shadow-2xs' : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="space-y-1 w-full min-[1380px]:max-w-md">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-sm text-[#1C2529] break-words">{header}</span>
                          {currentMappedKey !== '__ignore__' && (
                            <span className="px-2 py-0.5 bg-[#BCD7EE] text-[#005596] text-[10px] font-bold rounded-md shrink-0">
                              Auto-associé
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 truncate" title={sampleValue}>
                          Aperçu Ligne 1: <span className="italic font-mono text-slate-700">"{sampleValue}"</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-2 w-full min-[1380px]:w-auto min-[1380px]:min-w-[280px]">
                        <span className="text-xs font-bold text-slate-400 hidden min-[1380px]:inline shrink-0">➡️</span>
                        <select
                          value={currentMappedKey}
                          onChange={(e) => setColumnMapping(prev => ({ ...prev, [header]: e.target.value }))}
                          className="w-full max-w-full bg-white border border-[#C9D4DE] text-[#1C2529] font-semibold text-xs rounded-xl p-2.5 focus:ring-2 focus:ring-[#005596] outline-none cursor-pointer truncate"
                        >
                          {SYSTEM_FIELDS.map(sys => (
                            <option key={sys.key} value={sys.key} className="truncate">
                              {sys.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          </div>

          {/* Sidebar Step 2 Controls */}
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
                <button
                  onClick={analyzeRowsAndProceedToStep3}
                  className="w-full py-3.5 bg-[#005596] hover:bg-[#004275] text-white rounded-xl font-bold text-sm shadow hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  Lancer l'Analyse des Lignes (Étape 3)
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  onClick={() => setCurrentStep(1)}
                  className="w-full py-2.5 text-slate-600 hover:text-slate-900 font-bold text-xs rounded-xl hover:bg-slate-100 transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Changer de fichier
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* STEP 3: ROW-BY-ROW ANALYSIS & CONFLICT RESOLUTION */}
      {currentStep === 3 && (
        <div className="space-y-6">
          
          {/* Top Status Summary Bar */}
          <div className="bg-white rounded-2xl border border-[#C9D4DE]/50 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  filterStatus === 'all' ? 'bg-[#005596] text-white shadow' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Tous les contacts ({candidates.length})
              </button>
              
              <button
                onClick={() => setFilterStatus('valid')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  filterStatus === 'valid' ? 'bg-emerald-700 text-white shadow' : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" /> Valides ({validCount})
              </button>

              <button
                onClick={() => setFilterStatus('duplicate')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  filterStatus === 'duplicate' ? 'bg-amber-600 text-white shadow' : 'bg-amber-50 text-amber-900 hover:bg-amber-100'
                }`}
              >
                <Copy className="w-4 h-4" /> Doublons ({duplicateCount})
              </button>

              <button
                onClick={() => setFilterStatus('invalid')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  filterStatus === 'invalid' ? 'bg-red-600 text-white shadow' : 'bg-red-50 text-red-900 hover:bg-red-100'
                }`}
              >
                <AlertTriangle className="w-4 h-4" /> Invalides ({invalidCount})
              </button>
            </div>

            {duplicateCount > 0 && (
              <div className="flex items-center gap-2 text-xs bg-amber-50 border border-amber-200 p-2 rounded-xl">
                <span className="font-bold text-amber-900">Action groupée sur les doublons :</span>
                <button
                  onClick={() => handleBulkDuplicateAction('overwrite')}
                  className="px-2.5 py-1 bg-amber-600 text-white rounded-lg font-bold hover:bg-amber-700 cursor-pointer text-[11px]"
                >
                  Tout Mettre à jour
                </button>
                <button
                  onClick={() => handleBulkDuplicateAction('skip')}
                  className="px-2.5 py-1 bg-slate-600 text-white rounded-lg font-bold hover:bg-slate-700 cursor-pointer text-[11px]"
                >
                  Tout Ignorer
                </button>
              </div>
            )}
          </div>

          {/* Table of Candidates */}
          <div className="bg-white rounded-2xl border border-[#C9D4DE]/50 shadow-sm overflow-hidden">
            <div className="overflow-x-auto text-xs border rounded-lg">
              <table className="w-full text-left font-medium min-w-[800px]">
                <thead>
                  <tr className="bg-[#E8F1F8]/60 text-[#55636B] border-b border-[#C9D4DE]/40 text-[11px] font-bold uppercase">
                    <th className="px-4 py-3 min-w-[70px]">LIGNE</th>
                    <th className="px-4 py-3 min-w-[170px]">NOM COMPLET</th>
                    <th className="px-4 py-3 min-w-[190px]">E-MAIL</th>
                    <th className="px-4 py-3 min-w-[150px]">AFFILIATION</th>
                    <th className="px-4 py-3 min-w-[140px]">STATUT</th>
                    <th className="px-4 py-3 text-center min-w-[210px]">DECISION D'IMPORTATION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCandidates.map(cand => (
                    <tr 
                      key={cand.id} 
                      className={`transition-colors ${
                        cand.status === 'duplicate' ? 'bg-amber-50/40 hover:bg-amber-50/80' :
                        cand.status === 'invalid' ? 'bg-red-50/40 hover:bg-red-50/80' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="px-4 py-3 text-slate-400 font-mono font-bold">#{cand.rowIndex}</td>

                      {/* Name Editable */}
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={cand.fullName}
                          onChange={(e) => handleUpdateCandidateField(cand.id, 'fullName', e.target.value)}
                          className="font-bold text-[#1C2529] bg-transparent border-b border-transparent hover:border-slate-300 focus:border-[#005596] focus:bg-white outline-none px-1 rounded transition-all"
                        />
                        <p className="text-[11px] text-slate-500 px-1">{CAREER_STAGE_LABELS[cand.researchCareerStage]} • {cand.countryOfOrigin}</p>
                      </td>

                      {/* Email Editable */}
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={cand.email}
                          onChange={(e) => handleUpdateCandidateField(cand.id, 'email', e.target.value)}
                          placeholder="email@domaine.org"
                          className={`font-mono font-semibold bg-transparent border-b hover:border-slate-300 focus:bg-white outline-none px-1 rounded transition-all ${
                            cand.status === 'invalid' ? 'border-red-400 text-red-700' : 'border-transparent text-[#55636B] focus:border-[#005596]'
                          }`}
                        />
                      </td>

                      {/* Affiliation Editable */}
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={cand.affiliation}
                          onChange={(e) => handleUpdateCandidateField(cand.id, 'affiliation', e.target.value)}
                          className="text-[#55636B] bg-transparent border-b border-transparent hover:border-slate-300 focus:border-[#005596] focus:bg-white outline-none px-1 rounded transition-all"
                        />
                      </td>

                      {/* Status Badge */}
                      <td className="px-4 py-3">
                        {cand.status === 'valid' && (
                          <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full font-bold text-[10px] flex items-center gap-1 w-fit">
                            <CheckCircle2 className="w-3 h-3" /> Valide
                          </span>
                        )}
                        {cand.status === 'duplicate' && (
                          <div className="space-y-0.5">
                            <span className="px-2.5 py-1 bg-amber-100 text-amber-900 rounded-full font-bold text-[10px] flex items-center gap-1 w-fit">
                              <Copy className="w-3 h-3" /> Doublon décelé
                            </span>
                            {cand.duplicateMatch && (
                              <p className="text-[10px] text-amber-800 italic">
                                Existe déjà: {cand.duplicateMatch.name}
                              </p>
                            )}
                          </div>
                        )}
                        {cand.status === 'invalid' && (
                          <span className="px-2.5 py-1 bg-red-100 text-red-900 rounded-full font-bold text-[10px] flex items-center gap-1 w-fit" title={cand.errorReason}>
                            <AlertTriangle className="w-3 h-3" /> {cand.errorReason || 'Invalide'}
                          </span>
                        )}
                      </td>

                      {/* Action Decision Dropdown */}
                      <td className="px-4 py-3 text-center">
                        <select
                          value={cand.resolutionAction}
                          onChange={(e) => handleCandidateResolutionChange(cand.id, e.target.value as any)}
                          className="bg-white border border-[#C9D4DE] font-bold text-xs rounded-xl px-3 py-1.5 focus:ring-2 focus:ring-[#005596] outline-none cursor-pointer shadow-sm"
                        >
                          {cand.status === 'duplicate' ? (
                            <>
                              <option value="overwrite">🔄 Mettre à jour / Fusionner</option>
                              <option value="create_new">➕ Créer nouveau doublon</option>
                              <option value="skip">🚫 Ignorer cette ligne</option>
                            </>
                          ) : cand.status === 'invalid' ? (
                            <>
                              <option value="skip">🚫 Ignorer (Non valide)</option>
                              <option value="import">⚡ Tenter l'importation</option>
                            </>
                          ) : (
                            <>
                              <option value="import">✅ Importer comme nouveau</option>
                              <option value="skip">🚫 Ignorer</option>
                            </>
                          )}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bottom Action CTA */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-[#C9D4DE]/50 shadow-sm">
            <button
              onClick={() => setCurrentStep(2)}
              className="px-5 py-2.5 text-slate-600 hover:text-slate-900 font-bold text-xs rounded-xl hover:bg-slate-100 transition-colors cursor-pointer flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" /> Modifier le mappage des colonnes
            </button>

            <button
              onClick={handleExecuteImport}
              disabled={isExecuting || candidates.every(c => c.resolutionAction === 'skip')}
              className="px-8 py-3.5 bg-[#005596] hover:bg-[#004275] text-white font-extrabold text-sm rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center gap-3 cursor-pointer disabled:opacity-50"
            >
              {isExecuting ? (
                <>
                  <RotateCw className="w-5 h-5 animate-spin" /> Traitement en cours...
                </>
              ) : (
                <>
                  Confirmer et Exécuter l'Importation ({candidates.filter(c => c.resolutionAction !== 'skip').length})
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>

          {importError && (
            <div className="bg-rose-50 border border-rose-300 rounded-2xl p-6 flex flex-col sm:flex-row items-start gap-4 animate-fade-in">
              <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center shrink-0">
                <XCircle className="w-7 h-7" />
              </div>
              <div className="flex-1 text-left space-y-1.5">
                <p className="font-black text-rose-900 text-sm">Échec de l'importation</p>
                <p className="text-xs text-rose-700">{importError}</p>
                <p className="text-[11px] text-rose-500">
                  Aucune modification n'a été enregistrée. Corrigez le problème puis réessayez.
                </p>
              </div>
              <button
                onClick={() => setImportError(null)}
                className="text-rose-400 hover:text-rose-600 cursor-pointer p-1"
                title="Fermer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )}

        </div>
      )}

      {/* STEP 4: IMPORT EXECUTION & REPORT SUMMARY */}
      {currentStep === 4 && (
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
              <p className="text-3xl font-black text-emerald-800">{summaryReport.importedNew}</p>
              <p className="text-xs font-bold text-emerald-950 uppercase tracking-wider">Nouveaux Contacts Créés</p>
            </div>

            <div className="bg-amber-50 border border-amber-200 p-5 rounded-2xl space-y-1">
              <p className="text-3xl font-black text-amber-800">{summaryReport.updatedMerged}</p>
              <p className="text-xs font-bold text-amber-950 uppercase tracking-wider">Doublons Mis à jour</p>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-1">
              <p className="text-3xl font-black text-slate-700">{summaryReport.skippedIgnored}</p>
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

            {summaryReport.errors.length > 0 && (
              <button
                onClick={handleDownloadErrorLog}
                className="w-full sm:w-auto px-6 py-3.5 bg-slate-100 text-slate-700 hover:bg-slate-200 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4 text-slate-600" /> Télécharger le rapport des erreurs (.csv)
              </button>
            )}

            <button
              onClick={handleResetAll}
              className="w-full sm:w-auto px-6 py-3.5 border border-slate-300 text-slate-600 hover:text-slate-900 font-bold text-xs rounded-xl hover:bg-slate-50 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" /> Importer un nouveau fichier
            </button>
          </div>

        </div>
      )}
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
