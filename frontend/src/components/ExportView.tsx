import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Contact, ContactSelection, Tag } from '../types';
import { FieldKey, FIELD_LABELS, FIELD_HEADERS } from '../utils/exportCsv';
import { apiFetch, isServiceUnreachable } from '../services/api';
import { mapContactFromApi } from '../utils/mapContact';
import {
  buildContactsListQuery,
  buildContactsExportQuery,
  emptyFilterState,
  isEmptyFilterState,
  ExportFormat
} from '../utils/contactQuery';
import { downloadFromEndpoint } from '../utils/download';
import { useToast } from './Toast';
import {
  ChevronRight,
  FileText,
  Table,
  Code,
  CheckCircle2,
  Download,
  Info,
  RotateCw,
  Filter,
  Users
} from 'lucide-react';

interface ExportViewProps {
  selection: ContactSelection;
  tags: Tag[];
}

export const ExportView: React.FC<ExportViewProps> = ({ selection, tags = [] }) => {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('csv');

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
  const [targetCount, setTargetCount] = useState<number | null>(null);
  const [previewContacts, setPreviewContacts] = useState<Contact[]>([]);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const { showToast } = useToast();

  // Périmètre effectif : ids (partial/page) | filtres (all-filtered)
  const target = useMemo(() => {
    if (selection.mode === 'partial' || selection.mode === 'page') {
      return { ids: selection.ids, filters: emptyFilterState(), isIds: true as const };
    }
    if (selection.mode === 'all-filtered') {
      return { ids: undefined as string[] | undefined, filters: selection.filters, isIds: false as const };
    }
    return { ids: [] as string[], filters: emptyFilterState(), isIds: true as const };
  }, [selection]);

  useEffect(() => {
    setPreviewContacts([]);
    setTargetCount(null);
    setPreviewError(null);

    if (target.isIds) {
      setTargetCount(target.ids.length);
      return;
    }

    let cancelled = false;
    const resolveCountAndPreview = async () => {
      try {
        const url = buildContactsListQuery(target.filters, tags, 1, 5);
        const json = await apiFetch(url);
        if (cancelled) return;
        setTargetCount(json.pagination?.totalRecords ?? 0);
        setPreviewContacts((json.data?.contacts || []).map(mapContactFromApi));
      } catch (err: any) {
        if (!cancelled) {
          setTargetCount(0);
          setPreviewError(err?.message || 'Impossible de charger l\'aperçu et le nombre de contacts.');
        }
      }
    };
    resolveCountAndPreview();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection]);

  const activeFieldKeys = FIELD_LABELS.filter(f => fields[f.key]).map(f => f.key);

  const toggleAllFields = () => {
    const allChecked = Object.values(fields).every(Boolean);
    const next = {} as Record<FieldKey, boolean>;
    (Object.keys(fields) as FieldKey[]).forEach(k => { next[k] = !allChecked; });
    setFields(next);
  };

  const recordExportLog = async (recordCount: number, fileName: string, format: string) => {
    try {
      await apiFetch('/api/export/log', {
        method: 'POST',
        body: JSON.stringify({ recordCount, fileName, format: format.toUpperCase() })
      });
    } catch {
      // journalisation non bloquante
    }
  };

  const handleStartExport = async () => {
    setIsExporting(true);
    try {
      const query = buildContactsExportQuery(target.filters, tags, target.ids, {
        format: selectedFormat,
        fields: activeFieldKeys,
        includeTags
      });
      const result = await downloadFromEndpoint(query, `export.${selectedFormat}`);
      const count = result.count ?? targetCount ?? 0;
      showToast(
        `Exportation générée : ${result.fileName} (${count} enregistrement${count > 1 ? 's' : ''}).`,
        'success'
      );
      await recordExportLog(count, result.fileName, selectedFormat);
    } catch (err: any) {
      console.error('Failed to export data:', err);
      // Service injoignable : le toast global a déjà notifié l'utilisateur.
      if (!isServiceUnreachable(err)) {
        showToast(`Échec de l'export : ${err?.message || 'erreur inconnue'}`, 'error');
      }
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
          Exporter les contacts ({targetCount ?? '…'})
        </h1>
        <p className="text-xs text-[#55636B] mt-1">
          Extraction en temps réel générée par le serveur à partir de vos filtres et sélections de l'annuaire EURAXESS Africa.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* Left Column: Settings */}
        <div className="lg:col-span-8 space-y-6">

          {/* Scope info */}
          <section className="bg-white rounded-2xl p-6 shadow-[0_6px_18px_rgba(0,0,0,0.06)] border border-[#C9D4DE]/50 space-y-4">
            <h2 className="text-base font-bold text-[#1C2529] flex items-center gap-2">
              <Users className="w-5 h-5 text-[#005596]" />
              Périmètre d'extraction
            </h2>

            <div className="p-4 rounded-xl border-2 border-[#005596] bg-[#E8F1F8]/60">
              <div>
                <p className="text-xs text-[#1C2529] font-bold">
                  {targetCount !== null && selection.ids.length > 0 && selection.ids.length >= targetCount
                    ? 'Tous les contacts'
                    : selection.mode === 'all-filtered'
                      ? 'Tous les contacts des filtres actifs'
                      : 'Contacts cochés'
                  }
                </p>
                <p className="text-[11px] text-[#55636B] mt-0.5 font-semibold">
                  {selection.mode === 'all-filtered'
                    ? `${targetCount ?? '…'} contact(s) correspondant aux filtres`
                    : `${selection.ids.length} contact(s) sélectionné(s)`
                  }
                </p>
              </div>
            </div>

            {selection.mode !== 'all-filtered' && selection.ids.length === 0 && (
              <div className="flex items-center gap-2.5 p-3.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs font-medium">
                <Info className="w-4 h-4 shrink-0 text-amber-600" />
                <span>
                  Aucun contact n'est actuellement coché dans l'annuaire.{' '}
                  <Link
                    to="/contacts"
                    className="underline font-bold hover:text-amber-900 cursor-pointer"
                  >
                    Sélectionner des contacts dans l'annuaire
                  </Link>
                </span>
              </div>
            )}
          </section>

          {/* Format Selection */}
          <section className="bg-white rounded-2xl p-6 shadow-[0_6px_18px_rgba(0,0,0,0.06)] border border-[#C9D4DE]/50 space-y-4">
            <h2 className="text-base font-bold text-[#1C2529]">Format d'exportation</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {([
                { key: 'csv', label: 'CSV', sub: 'Données brutes standard', icon: FileText, color: 'text-[#005596]' },
                { key: 'xlsx', label: 'Excel (XLSX)', sub: 'Optimisé pour Microsoft Excel', icon: Table, color: 'text-[#005596]' },
                { key: 'json', label: 'JSON', sub: 'Fichier API structuré', icon: Code, color: 'text-slate-700' }
              ] as const).map(card => {
                const Icon = card.icon;
                return (
                  <button
                    key={card.key}
                    type="button"
                    onClick={() => setSelectedFormat(card.key)}
                    className={`relative flex flex-col items-center p-5 rounded-2xl border-2 transition-all cursor-pointer text-center ${
                      selectedFormat === card.key
                        ? 'border-[#005596] bg-[#E8F1F8]'
                        : 'border-[#C9D4DE]/60 hover:border-[#005596] bg-white'
                    }`}
                  >
                    <Icon className={`w-10 h-10 ${card.color} mb-2`} />
                    <span className="font-bold text-xs text-[#1C2529]">{card.label}</span>
                    <span className="text-[10px] text-[#55636B] mt-0.5">{card.sub}</span>
                    {selectedFormat === card.key && (
                      <CheckCircle2 className="w-5 h-5 text-[#005596] absolute top-2 right-2" />
                    )}
                  </button>
                );
              })}
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

          {/* Real Preview Table (mode filtres uniquement) */}
          {!target.isIds && (
            <section className="bg-white rounded-2xl p-6 shadow-[0_6px_18px_rgba(0,0,0,0.06)] border border-[#C9D4DE]/50 space-y-4 overflow-hidden">
              <h2 className="text-base font-bold text-[#1C2529]">
                Aperçu du contenu d'exportation ({previewContacts.length} fiches sur {targetCount ?? '…'})
              </h2>

              {previewError && (
                <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 font-medium">
                  {previewError}
                </p>
              )}

              {previewContacts.length === 0 ? (
                <p className="text-xs text-[#55636B] py-3">
                  {targetCount === null ? 'Chargement de l\'aperçu…' : 'Aucun contact ne correspond à ce périmètre.'}
                </p>
              ) : (
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
                      {previewContacts.map(c => (
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
                  {targetCount !== null && targetCount > previewContacts.length && (
                    <p className="text-[11px] text-slate-500 mt-2 text-center">... et {targetCount - previewContacts.length} autres contacts seront inclus dans le fichier final.</p>
                  )}
                </div>
              )}
            </section>
          )}

          {target.isIds && (
            <section className="bg-white rounded-2xl p-6 shadow-[0_6px_18px_rgba(0,0,0,0.06)] border border-[#C9D4DE]/50 space-y-4">
              <h2 className="text-base font-bold text-[#1C2529]">
                Aperçu du contenu d'exportation ({target.ids.length} fiches)
              </h2>
              <p className="text-xs text-[#55636B]">
                L'aperçu détaillé n'est pas disponible pour une sélection individuelle : le fichier final contiendra les {target.ids.length} contact(s) cochés.
              </p>
            </section>
          )}

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
              <span className="text-2xl font-black text-[#1C2529]">{targetCount ?? '…'}</span>
            </div>

            {selection.mode === 'all-filtered' && !isEmptyFilterState(target.filters) && (
              <p className="text-[11px] text-[#005596]/80 border-t border-[#005596]/20 pt-3">
                Filtres actifs : {describeFilters(target.filters)}
              </p>
            )}
          </div>

          <div className="bg-white/85 backdrop-blur-md border border-[#C9D4DE]/60 rounded-2xl p-6 space-y-4 text-xs">
            <button
              onClick={handleStartExport}
              disabled={isExporting || targetCount === null || targetCount === 0 || activeFieldKeys.length === 0}
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
                  Lancer l'exportation ({targetCount ?? '…'})
                </>
              )}
            </button>

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

function getCellValue(c: Contact, key: FieldKey): string {
  switch (key) {
    case 'gender':
      return c.gender === 'FEMALE' ? 'Femme' : c.gender === 'MALE' ? 'Homme' : 'Non spécifié';
    case 'researchCareerStage':
      return c.researchCareerStage || '';
    case 'firstName':
      return c.firstName || '';
    case 'lastName':
      return c.lastName || '';
    default:
      return String((c as unknown as Record<string, unknown>)[key] || '');
  }
}

function describeFilters(filters: { search: string; countries: string[]; genders: string[]; careerStages: string[]; tags: string[] }): string {
  const parts: string[] = [];
  if (filters.search.trim()) parts.push(`recherche « ${filters.search.trim()} »`);
  if (filters.countries.length) parts.push(`${filters.countries.length} pays`);
  if (filters.genders.length) parts.push(`${filters.genders.length} genre(s)`);
  if (filters.careerStages.length) parts.push(`${filters.careerStages.length} stade(s)`);
  if (filters.tags.length) parts.push(`${filters.tags.length} tag(s)`);
  return parts.join(', ') || 'aucun';
}
