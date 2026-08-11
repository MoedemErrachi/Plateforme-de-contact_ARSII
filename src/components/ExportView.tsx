import React, { useState } from 'react';
import ExcelJS from 'exceljs';
import { Link } from 'react-router-dom';
import { Contact, GENDER_LABELS, CAREER_STAGE_LABELS } from '../types';
import {
  ChevronRight,
  FileText,
  Table,
  Code,
  FileCheck,
  CheckCircle2,
  Download,
  Info,
  RotateCw,
  Filter,
  Users
} from 'lucide-react';

interface ExportViewProps {
  contacts: Contact[];
  selectedContactIds?: string[];
}

type FieldKey =
  | 'email'
  | 'firstName'
  | 'lastName'
  | 'gender'
  | 'countryOfOrigin'
  | 'city'
  | 'phone'
  | 'affiliation'
  | 'function'
  | 'experience'
  | 'facultyDepartment'
  | 'researchCareerStage';

const FIELD_LABELS: { key: FieldKey; label: string }[] = [
  { key: 'email', label: 'Adresse Email' },
  { key: 'firstName', label: 'Prénom' },
  { key: 'lastName', label: 'Nom' },
  { key: 'gender', label: 'Genre' },
  { key: 'countryOfOrigin', label: 'Pays d\'origine' },
  { key: 'city', label: 'Ville' },
  { key: 'phone', label: 'Téléphone' },
  { key: 'affiliation', label: 'Affiliation' },
  { key: 'function', label: 'Fonction' },
  { key: 'experience', label: 'Expérience' },
  { key: 'facultyDepartment', label: 'Faculté / Département' },
  { key: 'researchCareerStage', label: 'Stade de carrière' }
];

const FIELD_HEADERS: Record<FieldKey, string> = {
  email: 'Email',
  firstName: 'Prénom',
  lastName: 'Nom',
  gender: 'Genre',
  countryOfOrigin: 'Pays d\'origine',
  city: 'Ville',
  phone: 'Téléphone',
  affiliation: 'Affiliation',
  function: 'Fonction',
  experience: 'Expérience',
  facultyDepartment: 'Faculté / Département',
  researchCareerStage: 'Stade de carrière'
};

export const ExportView: React.FC<ExportViewProps> = ({
  contacts = [],
  selectedContactIds = []
}) => {
  const [selectedFormat, setSelectedFormat] = useState<'csv' | 'xlsx' | 'pdf' | 'json'>('csv');
  const [exportScope, setExportScope] = useState<'all' | 'selected'>('selected');

  const [fields, setFields] = useState<Record<FieldKey, boolean>>({
    email: true,
    firstName: true,
    lastName: true,
    gender: true,
    countryOfOrigin: true,
    city: true,
    phone: true,
    affiliation: true,
    function: true,
    experience: true,
    facultyDepartment: true,
    researchCareerStage: true
  });

  const [includeTags, setIncludeTags] = useState(true);

  const [isExporting, setIsExporting] = useState(false);
  const [exportDone, setExportDone] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  // Determine export targets
  const targetContacts = exportScope === 'selected'
    ? contacts.filter(c => selectedContactIds.includes(c.id))
    : contacts;

  const toggleAllFields = () => {
    const allChecked = Object.values(fields).every(Boolean);
    const next = {} as Record<FieldKey, boolean>;
    (Object.keys(fields) as FieldKey[]).forEach(k => { next[k] = !allChecked; });
    setFields(next);
  };

  // Build a single cell value for a contact + field
  const getCellValue = (c: Contact, key: FieldKey): string => {
    switch (key) {
      case 'gender': return GENDER_LABELS[c.gender] || c.gender;
      case 'researchCareerStage': return CAREER_STAGE_LABELS[c.researchCareerStage] || c.researchCareerStage;
      case 'firstName': return c.firstName || '';
      case 'lastName': return c.lastName || '';
      default: return String((c as any)[key] || '');
    }
  };

  // Build export data (CSV, XLSX via ExcelJS, JSON or PDF Text) and generate Blob download URL
  const generateExportData = async (): Promise<string> => {
    const activeHeaders = FIELD_LABELS
      .filter(f => fields[f.key])
      .map(f => FIELD_HEADERS[f.key]);
    if (includeTags) activeHeaders.push('Étiquettes / Tags');

    if (selectedFormat === 'xlsx') {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Contacts EURAXESS Africa');

      const headerRow = worksheet.addRow(activeHeaders);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF005596' }
      };

      targetContacts.forEach(c => {
        const rowCols: string[] = [];
        FIELD_LABELS.forEach(f => {
          if (fields[f.key]) rowCols.push(getCellValue(c, f.key));
        });
        if (includeTags) rowCols.push(c.tags?.join('; ') || '');
        worksheet.addRow(rowCols);
      });

      worksheet.columns.forEach(col => {
        col.width = 22;
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      return URL.createObjectURL(blob);
    }

    if (selectedFormat === 'json') {
      const dataToExport = targetContacts.map(c => {
        const item: Record<string, any> = {};
        FIELD_LABELS.forEach(f => {
          if (fields[f.key]) item[f.key] = getCellValue(c, f.key);
        });
        if (includeTags) item.tags = c.tags || [];
        item.id = c.id;
        return item;
      });

      const jsonStr = JSON.stringify(dataToExport, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      return URL.createObjectURL(blob);
    }

    // CSV format
    const csvRows = [activeHeaders.join(',')];

    targetContacts.forEach(c => {
      const rowCols: string[] = [];
      FIELD_LABELS.forEach(f => {
        if (fields[f.key]) rowCols.push(`"${getCellValue(c, f.key).replace(/"/g, '""')}"`);
      });
      if (includeTags) rowCols.push(`"${((c.tags || []).join('; ')).replace(/"/g, '""')}"`);
      csvRows.push(rowCols.join(','));
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    return URL.createObjectURL(blob);
  };

  const handleStartExport = async () => {
    setIsExporting(true);
    try {
      const url = await generateExportData();
      setDownloadUrl(url);
      setExportDone(true);
    } catch (err) {
      console.error('Failed to export data:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-8 space-y-6 animate-fade-in">

      {/* Header & Breadcrumb */}
      <div>
        <nav className="flex items-center gap-1.5 text-xs text-[#55636B] font-semibold mb-2">
          <Link to="/contacts" className="hover:text-[#005596] cursor-pointer">
            Contacts
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-[#005596] font-bold">Exportation de la base</span>
        </nav>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1C2529]">
          Exporter les contacts ({targetContacts.length})
        </h1>
        <p className="text-xs text-[#55636B] mt-1">
          Extraction en temps réel basée sur vos filtres et sélections de l'annuaire EURAXESS Africa.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* Left Column: Settings */}
        <div className="lg:col-span-8 space-y-6">

          {/* Scope selection */}
          <section className="bg-white rounded-2xl p-6 shadow-[0_6px_18px_rgba(0,0,0,0.06)] border border-[#C9D4DE]/50 space-y-4">
            <h2 className="text-base font-bold text-[#1C2529] flex items-center gap-2">
              <Users className="w-5 h-5 text-[#005596]" />
              Périmètre d'extraction
            </h2>

            <div className="flex flex-col sm:flex-row gap-4">
              <label
                onClick={() => setExportScope('selected')}
                className={`flex-1 p-4 rounded-xl border-2 flex items-center justify-between transition-all cursor-pointer ${
                  exportScope === 'selected'
                    ? 'border-[#005596] bg-[#E8F1F8]/60 font-bold'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div>
                  <p className="text-xs text-[#1C2529]">Contacts cochés uniquement</p>
                  <p className="text-[11px] text-[#55636B] mt-0.5 font-semibold">
                    {selectedContactIds.length > 0
                      ? `${selectedContactIds.length} contact(s) sélectionné(s)`
                      : '0 contact coché'
                    }
                  </p>
                </div>
                <input
                  type="radio"
                  checked={exportScope === 'selected'}
                  onChange={() => setExportScope('selected')}
                  className="text-[#005596]"
                />
              </label>

              <label
                onClick={() => setExportScope('all')}
                className={`flex-1 p-4 rounded-xl border-2 flex items-center justify-between cursor-pointer transition-all ${
                  exportScope === 'all' ? 'border-[#005596] bg-[#E8F1F8]/60 font-bold' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div>
                  <p className="text-xs text-[#1C2529]">Tous les contacts du répertoire</p>
                  <p className="text-[11px] font-bold text-[#005596] mt-0.5">{contacts.length} fiches enregistrées</p>
                </div>
                <input type="radio" checked={exportScope === 'all'} onChange={() => setExportScope('all')} className="text-[#005596]" />
              </label>
            </div>

            {exportScope === 'selected' && selectedContactIds.length === 0 && (
              <div className="flex items-center gap-2.5 p-3.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs font-medium">
                <Info className="w-4 h-4 shrink-0 text-amber-600" />
                <span>
                  Aucun contact n'est actuellement coché dans l'annuaire.{' '}
                  <Link
                    to="/contacts"
                    className="underline font-bold hover:text-amber-900 cursor-pointer"
                  >
                    Sélectionner des contacts dans l'annuaire
                  </Link>{' '}
                  ou basculez sur "Tous les contacts".
                </span>
              </div>
            )}
          </section>

          {/* Format Selection */}
          <section className="bg-white rounded-2xl p-6 shadow-[0_6px_18px_rgba(0,0,0,0.06)] border border-[#C9D4DE]/50 space-y-4">
            <h2 className="text-base font-bold text-[#1C2529]">Format d'exportation</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <button
                type="button"
                onClick={() => setSelectedFormat('csv')}
                className={`relative flex flex-col items-center p-5 rounded-2xl border-2 transition-all cursor-pointer text-center ${
                  selectedFormat === 'csv'
                    ? 'border-[#005596] bg-[#E8F1F8]'
                    : 'border-[#C9D4DE]/60 hover:border-[#005596] bg-white'
                }`}
              >
                <FileText className="w-10 h-10 text-[#005596] mb-2" />
                <span className="font-bold text-xs text-[#1C2529]">CSV</span>
                <span className="text-[10px] text-[#55636B] mt-0.5">Données brutes standard</span>
                {selectedFormat === 'csv' && (
                  <CheckCircle2 className="w-5 h-5 text-[#005596] absolute top-2 right-2" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setSelectedFormat('xlsx')}
                className={`relative flex flex-col items-center p-5 rounded-2xl border-2 transition-all cursor-pointer text-center ${
                  selectedFormat === 'xlsx'
                    ? 'border-[#005596] bg-[#E8F1F8]'
                    : 'border-[#C9D4DE]/60 hover:border-[#005596] bg-white'
                }`}
              >
                <Table className="w-10 h-10 text-[#005596] mb-2" />
                <span className="font-bold text-xs text-[#1C2529]">Excel (XLSX)</span>
                <span className="text-[10px] text-[#55636B] mt-0.5">Optimisé pour Microsoft Excel</span>
                {selectedFormat === 'xlsx' && (
                  <CheckCircle2 className="w-5 h-5 text-[#005596] absolute top-2 right-2" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setSelectedFormat('pdf')}
                className={`relative flex flex-col items-center p-5 rounded-2xl border-2 transition-all cursor-pointer text-center ${
                  selectedFormat === 'pdf'
                    ? 'border-[#005596] bg-[#E8F1F8]'
                    : 'border-[#C9D4DE]/60 hover:border-[#005596] bg-white'
                }`}
              >
                <FileCheck className="w-10 h-10 text-red-600 mb-2" />
                <span className="font-bold text-xs text-[#1C2529]">PDF</span>
                <span className="text-[10px] text-[#55636B] mt-0.5">Rapport imprimable</span>
                {selectedFormat === 'pdf' && (
                  <CheckCircle2 className="w-5 h-5 text-[#005596] absolute top-2 right-2" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setSelectedFormat('json')}
                className={`relative flex flex-col items-center p-5 rounded-2xl border-2 transition-all cursor-pointer text-center ${
                  selectedFormat === 'json'
                    ? 'border-[#005596] bg-[#E8F1F8]'
                    : 'border-[#C9D4DE]/60 hover:border-[#005596] bg-white'
                }`}
              >
                <Code className="w-10 h-10 text-slate-700 mb-2" />
                <span className="font-bold text-xs text-[#1C2529]">JSON</span>
                <span className="text-[10px] text-[#55636B] mt-0.5">Fichier API structuré</span>
                {selectedFormat === 'json' && (
                  <CheckCircle2 className="w-5 h-5 text-[#005596] absolute top-2 right-2" />
                )}
              </button>
            </div>
          </section>

          {/* Fields Selection */}
          <section className="bg-white rounded-2xl p-6 shadow-[0_6px_18px_rgba(0,0,0,0.06)] border border-[#C9D4DE]/50 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-base font-bold text-[#1C2529]">Champs à inclure dans le fichier</h2>
              <button
                type="button"
                onClick={toggleAllFields}
                className="text-xs font-bold text-[#005596] hover:underline cursor-pointer"
              >
                {Object.values(fields).every(Boolean) ? 'Tout désélectionner' : 'Tout sélectionner'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
              {FIELD_LABELS.map(f => (
                <label key={f.key} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fields[f.key]}
                    onChange={(e) => setFields({ ...fields, [f.key]: e.target.checked })}
                    className="rounded border-[#C9D4DE] text-[#005596] focus:ring-[#005596] w-4 h-4"
                  />
                  <span className="font-medium text-[#1C2529]">{f.label}</span>
                </label>
              ))}

              <label className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeTags}
                  onChange={(e) => setIncludeTags(e.target.checked)}
                  className="rounded border-[#C9D4DE] text-[#005596] focus:ring-[#005596] w-4 h-4"
                />
                <span className="font-medium text-[#1C2529]">Étiquettes / Tags</span>
              </label>
            </div>
          </section>

          {/* Real Preview Table */}
          <section className="bg-white rounded-2xl p-6 shadow-[0_6px_18px_rgba(0,0,0,0.06)] border border-[#C9D4DE]/50 space-y-4 overflow-hidden">
            <h2 className="text-base font-bold text-[#1C2529]">Aperçu du contenu d'exportation ({targetContacts.length} fiches)</h2>

            <div className="overflow-x-auto text-xs">
              <table className="w-full text-left font-medium">
                <thead>
                  <tr className="bg-[#D9E6F2]/40 text-[#55636B] border-b border-[#C9D4DE]/40 text-[11px] font-bold uppercase">
                    {FIELD_LABELS.filter(f => fields[f.key]).map(f => (
                      <th key={f.key} className="px-3 py-2">{FIELD_HEADERS[f.key]}</th>
                    ))}
                    {includeTags && <th className="px-3 py-2">TAGS</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {targetContacts.slice(0, 5).map(c => (
                    <tr key={c.id}>
                      {FIELD_LABELS.filter(f => fields[f.key]).map(f => (
                        <td key={f.key} className="px-3 py-2 text-[#55636B]">
                          {f.key === 'firstName' || f.key === 'lastName'
                            ? getCellValue(c, f.key)
                            : getCellValue(c, f.key)}
                        </td>
                      ))}
                      {includeTags && <td className="px-3 py-2 text-[#55636B]">{(c.tags || []).join('; ')}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
              {targetContacts.length > 5 && (
                <p className="text-[11px] text-slate-500 mt-2 text-center">... et {targetContacts.length - 5} autres contacts seront inclus dans le fichier final.</p>
              )}
            </div>
          </section>

        </div>

        {/* Right Column: Filter Summary & Download Action */}
        <div className="lg:col-span-4 space-y-6">

          <div className="bg-[#BCD7EE] rounded-2xl p-6 border border-[#C9D4DE] text-[#005596] space-y-4">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              <h2 className="text-base font-bold">Résumé d'extraction</h2>
            </div>

            <div className="pt-3 border-t border-[#005596]/20 flex justify-between items-center">
              <span className="text-xs">Volume de contacts :</span>
              <span className="text-2xl font-black text-[#1C2529]">{targetContacts.length}</span>
            </div>
          </div>

          <div className="bg-white/85 backdrop-blur-md border border-[#C9D4DE]/60 rounded-2xl p-6 space-y-4 text-xs">
            {exportDone && downloadUrl ? (
              <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-center space-y-3">
                <CheckCircle2 className="w-8 h-8 text-green-600 mx-auto" />
                <p className="font-bold text-sm text-green-800">Exportation générée avec succès !</p>
                <p className="text-slate-600">Le fichier <strong>EURAXESS_Africa_Contacts_Export.{selectedFormat}</strong> contient {targetContacts.length} enregistrements.</p>
                <a
                  href={downloadUrl}
                  download={`EURAXESS_Africa_Contacts_Export.${selectedFormat}`}
                  className="mt-2 inline-flex items-center justify-center gap-2 w-full py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-colors shadow cursor-pointer text-xs"
                >
                  <Download className="w-4 h-4" /> Télécharger le fichier
                </a>
              </div>
            ) : (
              <button
                onClick={handleStartExport}
                disabled={isExporting || targetContacts.length === 0}
                className="w-full py-3.5 px-6 bg-[#005596] hover:bg-[#004275] text-white font-bold rounded-xl shadow-lg hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-75 cursor-pointer text-sm"
              >
                {isExporting ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" />
                    Génération du fichier...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Lancer l'exportation ({targetContacts.length})
                  </>
                )}
              </button>
            )}

            <Link
              to="/contacts"
              className="w-full py-2.5 bg-white border border-[#005596] text-[#005596] font-bold rounded-xl hover:bg-[#E8F1F8] transition-colors cursor-pointer inline-flex items-center justify-center"
            >
              Retour à l'annuaire
            </Link>
          </div>

        </div>

      </div>

    </div>
  );
};
