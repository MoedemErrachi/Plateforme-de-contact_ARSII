import React, { useState } from 'react';
import ExcelJS from 'exceljs';
import { Link } from 'react-router-dom';
import { Contact } from '../types';
import { 
  ChevronRight, 
  FileText, 
  Table, 
  Code, 
  FileCheck, 
  CheckCircle2, 
  Download, 
  Info, 
  Globe, 
  RotateCw,
  Filter,
  Users
} from 'lucide-react';

interface ExportViewProps {
  contacts: Contact[];
  selectedContactIds?: string[];
}

export const ExportView: React.FC<ExportViewProps> = ({ 
  contacts = [],
  selectedContactIds = []
}) => {
  const [selectedFormat, setSelectedFormat] = useState<'csv' | 'xlsx' | 'pdf' | 'json'>('csv');
  const [exportScope, setExportScope] = useState<'all' | 'selected'>('selected');
  
  const [fields, setFields] = useState({
    name: true,
    email: true,
    organization: true,
    role: true,
    zone: true,
    expertise: true,
    phone: true,
    createdDate: true,
    lastInteraction: true
  });

  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [exportNotes, setExporterNotes] = useState(true);

  const [isExporting, setIsExporting] = useState(false);
  const [exportDone, setExportDone] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  // Determine export targets
  const targetContacts = exportScope === 'selected'
    ? contacts.filter(c => selectedContactIds.includes(c.id))
    : contacts;

  const toggleAllFields = () => {
    const allChecked = Object.values(fields).every(Boolean);
    setFields({
      name: !allChecked,
      email: !allChecked,
      organization: !allChecked,
      role: !allChecked,
      zone: !allChecked,
      expertise: !allChecked,
      phone: !allChecked,
      createdDate: !allChecked,
      lastInteraction: !allChecked
    });
  };

  // Build export data (CSV, XLSX via ExcelJS, JSON or PDF Text) and generate Blob download URL
  const generateExportData = async (): Promise<string> => {
    if (selectedFormat === 'xlsx') {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Contacts ARSII');

      const headerCols: string[] = [];
      if (fields.name) headerCols.push('Nom complet');
      if (fields.email) headerCols.push('Email');
      if (fields.organization) headerCols.push('Organisation');
      if (fields.role) headerCols.push('Fonction / Rôle');
      if (fields.zone) headerCols.push('Pays');
      if (fields.phone) headerCols.push('Téléphone');
      if (fields.expertise) headerCols.push('Expertise');
      if (includeMetadata) headerCols.push('Type Acteur', 'Tags');

      const headerRow = worksheet.addRow(headerCols);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF006A66' }
      };

      targetContacts.forEach(c => {
        const rowCols: string[] = [];
        if (fields.name) rowCols.push(c.name || '');
        if (fields.email) rowCols.push(c.email || '');
        if (fields.organization) rowCols.push(c.organization || '');
        if (fields.role) rowCols.push(c.title || '');
        if (fields.zone) rowCols.push(c.country || '');
        if (fields.phone) rowCols.push(c.phone || '');
        if (fields.expertise) rowCols.push(c.expertise?.join('; ') || '');
        if (includeMetadata) {
          rowCols.push(c.actorType || '', c.tags?.join('; ') || '');
        }
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
        if (fields.name) item.name = c.name;
        if (fields.email) item.email = c.email;
        if (fields.organization) item.organization = c.organization;
        if (fields.role) item.title = c.title;
        if (fields.zone) item.country = c.country;
        if (fields.expertise) item.expertise = c.expertise;
        if (fields.phone) item.phone = c.phone;
        if (includeMetadata) {
          item.id = c.id;
          item.actorType = c.actorType;
          item.tags = c.tags;
        }
        if (exportNotes) {
          item.exchangeNotesCount = c.exchangeNotes?.length || 0;
          item.notes = c.exchangeNotes?.map(n => ({ date: n.date, content: n.content }));
        }
        return item;
      });

      const jsonStr = JSON.stringify(dataToExport, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      return URL.createObjectURL(blob);
    } 
    
    // CSV format
    const headerCols: string[] = [];
    if (fields.name) headerCols.push('Nom complet');
    if (fields.email) headerCols.push('Email');
    if (fields.organization) headerCols.push('Organisation');
    if (fields.role) headerCols.push('Fonction / Rôle');
    if (fields.zone) headerCols.push('Pays');
    if (fields.phone) headerCols.push('Téléphone');
    if (fields.expertise) headerCols.push('Expertise');
    if (includeMetadata) headerCols.push('Type Acteur', 'Tags');

    const csvRows = [headerCols.join(',')];

    targetContacts.forEach(c => {
      const rowCols: string[] = [];
      if (fields.name) rowCols.push(`"${(c.name || '').replace(/"/g, '""')}"`);
      if (fields.email) rowCols.push(`"${(c.email || '').replace(/"/g, '""')}"`);
      if (fields.organization) rowCols.push(`"${(c.organization || '').replace(/"/g, '""')}"`);
      if (fields.role) rowCols.push(`"${(c.title || '').replace(/"/g, '""')}"`);
      if (fields.zone) rowCols.push(`"${(c.country || '').replace(/"/g, '""')}"`);
      if (fields.phone) rowCols.push(`"${(c.phone || '').replace(/"/g, '""')}"`);
      if (fields.expertise) rowCols.push(`"${(c.expertise?.join('; ') || '').replace(/"/g, '""')}"`);
      if (includeMetadata) {
        rowCols.push(`"${c.actorType || ''}"`, `"${(c.tags?.join('; ') || '').replace(/"/g, '""')}"`);
      }
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
        <nav className="flex items-center gap-1.5 text-xs text-[#3d4948] font-semibold mb-2">
          <Link to="/contacts" className="hover:text-[#006a66] cursor-pointer">
            Contacts
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-[#006a66] font-bold">Exportation de la base</span>
        </nav>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#071f1f]">
          Exporter les contacts ({targetContacts.length})
        </h1>
        <p className="text-xs text-[#3d4948] mt-1">
          Extraction en temps réel basée sur vos filtres et sélections de l'annuaire ARSII.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Settings */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Scope selection */}
          <section className="bg-white rounded-2xl p-6 shadow-[0_6px_18px_rgba(0,0,0,0.06)] border border-[#bcc9c7]/50 space-y-4">
            <h2 className="text-base font-bold text-[#071f1f] flex items-center gap-2">
              <Users className="w-5 h-5 text-[#006a66]" />
              Périmètre d'extraction
            </h2>

            <div className="flex flex-col sm:flex-row gap-4">
              <label 
                onClick={() => setExportScope('selected')}
                className={`flex-1 p-4 rounded-xl border-2 flex items-center justify-between transition-all cursor-pointer ${
                  exportScope === 'selected'
                    ? 'border-[#006a66] bg-[#dff9f8]/60 font-bold'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div>
                  <p className="text-xs text-[#071f1f]">Contacts cochés uniquement</p>
                  <p className="text-[11px] text-[#3d4948] mt-0.5 font-semibold">
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
                  className="text-[#006a66]" 
                />
              </label>

              <label 
                onClick={() => setExportScope('all')}
                className={`flex-1 p-4 rounded-xl border-2 flex items-center justify-between cursor-pointer transition-all ${
                  exportScope === 'all' ? 'border-[#006a66] bg-[#dff9f8]/60 font-bold' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div>
                  <p className="text-xs text-[#071f1f]">Tous les contacts du répertoire</p>
                  <p className="text-[11px] font-bold text-[#006a66] mt-0.5">{contacts.length} fiches enregistrées</p>
                </div>
                <input type="radio" checked={exportScope === 'all'} onChange={() => setExportScope('all')} className="text-[#006a66]" />
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
          <section className="bg-white rounded-2xl p-6 shadow-[0_6px_18px_rgba(0,0,0,0.06)] border border-[#bcc9c7]/50 space-y-4">
            <h2 className="text-base font-bold text-[#071f1f]">Format d'exportation</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <button
                type="button"
                onClick={() => setSelectedFormat('csv')}
                className={`relative flex flex-col items-center p-5 rounded-2xl border-2 transition-all cursor-pointer text-center ${
                  selectedFormat === 'csv'
                    ? 'border-[#006a66] bg-[#dff9f8]'
                    : 'border-[#bcc9c7]/60 hover:border-[#35b8b2] bg-white'
                }`}
              >
                <FileText className="w-10 h-10 text-[#006a66] mb-2" />
                <span className="font-bold text-xs text-[#071f1f]">CSV</span>
                <span className="text-[10px] text-[#3d4948] mt-0.5">Données brutes standard</span>
                {selectedFormat === 'csv' && (
                  <CheckCircle2 className="w-5 h-5 text-[#006a66] absolute top-2 right-2" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setSelectedFormat('xlsx')}
                className={`relative flex flex-col items-center p-5 rounded-2xl border-2 transition-all cursor-pointer text-center ${
                  selectedFormat === 'xlsx'
                    ? 'border-[#006a66] bg-[#dff9f8]'
                    : 'border-[#bcc9c7]/60 hover:border-[#35b8b2] bg-white'
                }`}
              >
                <Table className="w-10 h-10 text-[#006a66] mb-2" />
                <span className="font-bold text-xs text-[#071f1f]">Excel (XLSX)</span>
                <span className="text-[10px] text-[#3d4948] mt-0.5">Optimisé pour Microsoft Excel</span>
                {selectedFormat === 'xlsx' && (
                  <CheckCircle2 className="w-5 h-5 text-[#006a66] absolute top-2 right-2" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setSelectedFormat('pdf')}
                className={`relative flex flex-col items-center p-5 rounded-2xl border-2 transition-all cursor-pointer text-center ${
                  selectedFormat === 'pdf'
                    ? 'border-[#006a66] bg-[#dff9f8]'
                    : 'border-[#bcc9c7]/60 hover:border-[#35b8b2] bg-white'
                }`}
              >
                <FileCheck className="w-10 h-10 text-red-600 mb-2" />
                <span className="font-bold text-xs text-[#071f1f]">PDF</span>
                <span className="text-[10px] text-[#3d4948] mt-0.5">Rapport imprimable</span>
                {selectedFormat === 'pdf' && (
                  <CheckCircle2 className="w-5 h-5 text-[#006a66] absolute top-2 right-2" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setSelectedFormat('json')}
                className={`relative flex flex-col items-center p-5 rounded-2xl border-2 transition-all cursor-pointer text-center ${
                  selectedFormat === 'json'
                    ? 'border-[#006a66] bg-[#dff9f8]'
                    : 'border-[#bcc9c7]/60 hover:border-[#35b8b2] bg-white'
                }`}
              >
                <Code className="w-10 h-10 text-slate-700 mb-2" />
                <span className="font-bold text-xs text-[#071f1f]">JSON</span>
                <span className="text-[10px] text-[#3d4948] mt-0.5">Fichier API structuré</span>
                {selectedFormat === 'json' && (
                  <CheckCircle2 className="w-5 h-5 text-[#006a66] absolute top-2 right-2" />
                )}
              </button>
            </div>
          </section>

          {/* Fields Selection */}
          <section className="bg-white rounded-2xl p-6 shadow-[0_6px_18px_rgba(0,0,0,0.06)] border border-[#bcc9c7]/50 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-base font-bold text-[#071f1f]">Champs à inclure dans le fichier</h2>
              <button 
                type="button"
                onClick={toggleAllFields}
                className="text-xs font-bold text-[#006a66] hover:underline cursor-pointer"
              >
                {Object.values(fields).every(Boolean) ? 'Tout désélectionner' : 'Tout sélectionner'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
              <label className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={fields.name} 
                  onChange={(e) => setFields({ ...fields, name: e.target.checked })} 
                  className="rounded border-[#bcc9c7] text-[#006a66] focus:ring-[#006a66] w-4 h-4"
                />
                <span className="font-medium text-[#071f1f]">Nom complet</span>
              </label>

              <label className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={fields.email} 
                  onChange={(e) => setFields({ ...fields, email: e.target.checked })} 
                  className="rounded border-[#bcc9c7] text-[#006a66] focus:ring-[#006a66] w-4 h-4"
                />
                <span className="font-medium text-[#071f1f]">Adresse Email</span>
              </label>

              <label className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={fields.organization} 
                  onChange={(e) => setFields({ ...fields, organization: e.target.checked })} 
                  className="rounded border-[#bcc9c7] text-[#006a66] focus:ring-[#006a66] w-4 h-4"
                />
                <span className="font-medium text-[#071f1f]">Organisation</span>
              </label>

              <label className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={fields.role} 
                  onChange={(e) => setFields({ ...fields, role: e.target.checked })} 
                  className="rounded border-[#bcc9c7] text-[#006a66] focus:ring-[#006a66] w-4 h-4"
                />
                <span className="font-medium text-[#071f1f]">Fonction / Intitulé</span>
              </label>

              <label className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={fields.zone} 
                  onChange={(e) => setFields({ ...fields, zone: e.target.checked })} 
                  className="rounded border-[#bcc9c7] text-[#006a66] focus:ring-[#006a66] w-4 h-4"
                />
                <span className="font-medium text-[#071f1f]">Pays</span>
              </label>

              <label className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={fields.expertise} 
                  onChange={(e) => setFields({ ...fields, expertise: e.target.checked })} 
                  className="rounded border-[#bcc9c7] text-[#006a66] focus:ring-[#006a66] w-4 h-4"
                />
                <span className="font-medium text-[#071f1f]">Domaine d'expertise</span>
              </label>

              <label className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={fields.phone} 
                  onChange={(e) => setFields({ ...fields, phone: e.target.checked })} 
                  className="rounded border-[#bcc9c7] text-[#006a66] focus:ring-[#006a66] w-4 h-4"
                />
                <span className="font-medium text-[#071f1f]">Téléphone</span>
              </label>
            </div>
          </section>

          {/* Real Preview Table */}
          <section className="bg-white rounded-2xl p-6 shadow-[0_6px_18px_rgba(0,0,0,0.06)] border border-[#bcc9c7]/50 space-y-4 overflow-hidden">
            <h2 className="text-base font-bold text-[#071f1f]">Aperçu du contenu d'exportation ({targetContacts.length} fiches)</h2>

            <div className="overflow-x-auto text-xs">
              <table className="w-full text-left font-medium">
                <thead>
                  <tr className="bg-[#cee8e7]/40 text-[#3d4948] border-b border-[#bcc9c7]/40 text-[11px] font-bold uppercase">
                    {fields.name && <th className="px-3 py-2">NOM</th>}
                    {fields.email && <th className="px-3 py-2">EMAIL</th>}
                    {fields.organization && <th className="px-3 py-2">ORGANISATION</th>}
                    {fields.zone && <th className="px-3 py-2">PAYS</th>}
                    {fields.expertise && <th className="px-3 py-2">EXPERTISE</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {targetContacts.slice(0, 5).map(c => (
                    <tr key={c.id}>
                      {fields.name && <td className="px-3 py-2 font-bold text-[#071f1f]">{c.name}</td>}
                      {fields.email && <td className="px-3 py-2 font-mono text-[#3d4948]">{c.email}</td>}
                      {fields.organization && <td className="px-3 py-2 text-[#3d4948]">{c.organization}</td>}
                      {fields.zone && <td className="px-3 py-2 text-[#3d4948]">{c.country}</td>}
                      {fields.expertise && <td className="px-3 py-2 text-[#3d4948]">{c.expertise?.join(', ')}</td>}
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
          
          <div className="bg-[#abece7] rounded-2xl p-6 border border-[#bcc9c7] text-[#2b6c6a] space-y-4">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              <h2 className="text-base font-bold">Résumé d'extraction</h2>
            </div>

            <div className="pt-3 border-t border-[#2b6c6a]/20 flex justify-between items-center">
              <span className="text-xs">Volume de contacts :</span>
              <span className="text-2xl font-black text-[#071f1f]">{targetContacts.length}</span>
            </div>
          </div>

          <div className="bg-white/85 backdrop-blur-md border border-[#bcc9c7]/60 rounded-2xl p-6 space-y-4 text-xs">
            {exportDone && downloadUrl ? (
              <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-center space-y-3">
                <CheckCircle2 className="w-8 h-8 text-green-600 mx-auto" />
                <p className="font-bold text-sm text-green-800">Exportation générée avec succès !</p>
                <p className="text-slate-600">Le fichier <strong>ARSII_Contacts_Export.{selectedFormat}</strong> contient {targetContacts.length} enregistrements.</p>
                <a
                  href={downloadUrl}
                  download={`ARSII_Contacts_Export.${selectedFormat}`}
                  className="mt-2 inline-flex items-center justify-center gap-2 w-full py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-colors shadow cursor-pointer text-xs"
                >
                  <Download className="w-4 h-4" /> Télécharger le fichier
                </a>
              </div>
            ) : (
              <button
                onClick={handleStartExport}
                disabled={isExporting || targetContacts.length === 0}
                className="w-full py-3.5 px-6 bg-[#006a66] hover:bg-[#256865] text-white font-bold rounded-xl shadow-lg hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-75 cursor-pointer text-sm"
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
              className="w-full py-2.5 bg-white border border-[#006a66] text-[#006a66] font-bold rounded-xl hover:bg-[#dff9f8] transition-colors cursor-pointer inline-flex items-center justify-center"
            >
              Retour à l'annuaire
            </Link>
          </div>

        </div>

      </div>

    </div>
  );
};
