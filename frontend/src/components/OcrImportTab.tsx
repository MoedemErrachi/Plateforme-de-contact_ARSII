import React, { useState, useRef } from 'react';
import { Camera, Upload, Check, X, Loader2, Info } from 'lucide-react';
import { Contact, Gender, ResearchCareerStage } from '../types';
import { OcrResultSkeleton } from './Skeletons';
import { apiFetch, OCR_TIMEOUT_MS, isServiceUnreachable } from '../services/api';
import { useToast } from './Toast';

// Le service d'extraction (FastAPI) est appelé via le même origine que le
// frontend : en dev le proxy Vite /chatbot-api relaie vers VITE_CHATBOT_API_URL,
// en production la couche de service fait la même correspondance. Cela élimine
// les erreurs CORS / « Failed to fetch » liées aux appels inter-origines.
const CHATBOT_API_PREFIX = '/chatbot-api';

interface OcrExtractedField {
  value: string | null;
  confidence: 'high' | 'medium' | 'low';
}

interface OcrExtractedInfo {
  firstName?: OcrExtractedField | null;
  lastName?: OcrExtractedField | null;
  email?: OcrExtractedField | null;
  phone?: OcrExtractedField | null;
  affiliation?: OcrExtractedField | null;
  function?: OcrExtractedField | null;
  city?: OcrExtractedField | null;
  countryOfOrigin?: OcrExtractedField | null;
}

interface OcrExtractionResponse {
  extracted: OcrExtractedInfo;
  photoUrl?: string | null;
  sourceProvider: string;
}

interface OcrImportTabProps {
  onSaveContact: (contact: Contact[]) => Promise<{ ok: boolean; httpStatus: number; status: string; errorMessage: string; data: { createdCount: number; updatedCount: number } | null }>;
}

const CONFIDENCE_STYLES: Record<string, string> = {
  high: 'border-emerald-300 bg-emerald-50/50',
  medium: 'border-amber-300 bg-amber-50/50',
  low: 'border-red-300 bg-red-50/50',
};

const CONFIDENCE_LABELS: Record<string, string> = {
  high: 'Fiable',
  medium: 'Incertain',
  low: 'Peu fiable',
};

function fieldToEditable(f: OcrExtractedField | null | undefined): string {
  return f?.value ?? '';
}

function confidenceOf(f: OcrExtractedField | null | undefined): string {
  return f?.confidence ?? 'low';
}

// ──────────────────────────────────────────────
// OcrImportTab
// ──────────────────────────────────────────────
export const OcrImportTab: React.FC<OcrImportTabProps> = ({ onSaveContact }) => {
  const { showToast } = useToast();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extracted, setExtracted] = useState<OcrExtractedInfo | null>(null);
  const [sourceProvider, setSourceProvider] = useState<string>('');
  // Photo de profil détectée automatiquement par le service d'extraction.
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  const [editable, setEditable] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    affiliation: '',
    function: '',
    city: '',
    countryOfOrigin: '',
  });
  const [confidence, setConfidence] = useState<Record<string, string>>({});

  const [isSaving, setIsSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<'success' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const reset = () => {
    setImageFile(null);
    setImagePreview(null);
    setIsExtracting(false);
    setExtracted(null);
    setSourceProvider('');
    setPhotoUrl(null);
    setEditable({ firstName: '', lastName: '', email: '', phone: '', affiliation: '', function: '', city: '', countryOfOrigin: '' });
    setConfidence({});
    setSaveResult(null);
  };

  const handleFileSelect = (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      showToast('Fichier trop volumineux (max 10 Mo).', 'error');
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setExtracted(null);
    setSaveResult(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleExtract = async () => {
    if (!imageFile) return;
    setIsExtracting(true);
    setExtracted(null);
    setSaveResult(null);

    try {
      const formData = new FormData();
      formData.append('image', imageFile, 'ocr-image.jpg');

      // Extraction via la couche API centralisée : timeout 90 s (LLM lent),
      // erreurs réseau/5xx normalisées + toast global automatique. En cas
      // d'échec, l'interface d'upload reste interactive (état préservé).
      const data: OcrExtractionResponse = await apiFetch(`${CHATBOT_API_PREFIX}/api/ocr/extract`, {
        method: 'POST',
        body: formData,
        timeoutMs: OCR_TIMEOUT_MS
      });

      setExtracted(data.extracted);
      setSourceProvider(data.sourceProvider);
      setPhotoUrl(data.photoUrl || null);

      setEditable({
        firstName: fieldToEditable(data.extracted.firstName),
        lastName: fieldToEditable(data.extracted.lastName),
        email: fieldToEditable(data.extracted.email),
        phone: fieldToEditable(data.extracted.phone),
        affiliation: fieldToEditable(data.extracted.affiliation),
        function: fieldToEditable(data.extracted.function),
        city: fieldToEditable(data.extracted.city),
        countryOfOrigin: fieldToEditable(data.extracted.countryOfOrigin),
      });

      setConfidence({
        firstName: confidenceOf(data.extracted.firstName),
        lastName: confidenceOf(data.extracted.lastName),
        email: confidenceOf(data.extracted.email),
        phone: confidenceOf(data.extracted.phone),
        affiliation: confidenceOf(data.extracted.affiliation),
        function: confidenceOf(data.extracted.function),
        city: confidenceOf(data.extracted.city),
        countryOfOrigin: confidenceOf(data.extracted.countryOfOrigin),
      });
    } catch (err: any) {
      // apiFetch garantit un message utilisateur en français, quel que soit le
      // mode d'échec (réseau, timeout, 5xx). Les erreurs réseau émettent déjà
      // un toast global ; on notifie uniquement les erreurs métier locales.
      if (!isServiceUnreachable(err)) {
        showToast(err?.message || 'Échec de l\'extraction OCR.', 'error');
      }
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSave = async () => {
    if (!editable.firstName && !editable.lastName && !editable.email) return;
    setIsSaving(true);
    setSaveResult(null);

    const contact: Contact = {
      id: '',
      firstName: editable.firstName,
      lastName: editable.lastName,
      email: editable.email || '',
      gender: 'NOT_SPECIFIED' as Gender,
      countryOfOrigin: editable.countryOfOrigin || '',
      city: editable.city || '',
      phone: editable.phone || '',
      affiliation: editable.affiliation || '',
      function: editable.function || '',
      experience: '',
      facultyDepartment: '',
      researchCareerStage: 'R1_FIRST_STAGE' as ResearchCareerStage,
      avatarUrl: photoUrl ? `${CHATBOT_API_PREFIX}${photoUrl}` : null,
      tags: [],
    };

    try {
      const result = await onSaveContact([contact]);
      if (result.ok) setSaveResult('success');
    } catch {
      // L'échec est déjà notifié par toast (App ou couche API).
    } finally {
      setIsSaving(false);
    }
  };

  const updateField = (key: keyof typeof editable, value: string) => {
    setEditable(prev => ({ ...prev, [key]: value }));
  };

  const fields: { key: keyof typeof editable; label: string }[] = [
    { key: 'firstName', label: 'Prénom' },
    { key: 'lastName', label: 'Nom' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Téléphone' },
    { key: 'affiliation', label: 'Affiliation' },
    { key: 'function', label: 'Fonction' },
    { key: 'city', label: 'Ville' },
    { key: 'countryOfOrigin', label: 'Pays d\'origine' },
  ];

  return (
    <div className="space-y-6">
      {!imageFile ? (
        <div
          ref={dropRef}
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="border-3 border-dashed border-[#005596]/50 hover:border-[#005596] bg-slate-50/50 hover:bg-[#E8F1F8]/30 rounded-2xl p-10 text-center cursor-pointer transition-all space-y-4 group"
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={e => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
          />
          <div className="w-16 h-16 bg-[#005596] text-white rounded-2xl flex items-center justify-center mx-auto shadow-md group-hover:scale-110 transition-transform">
            <Camera className="w-8 h-8" />
          </div>
          <div>
            <p className="font-bold text-sm text-[#1C2529]">
              Glissez-déposez une photo de carte de visite ou <span className="text-[#005596] underline">parcourez vos fichiers</span>
            </p>
            <p className="text-xs text-[#55636B] mt-1">JPEG, PNG ou WebP — max 10 Mo</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-start gap-4">
            {imagePreview && (
              <img
                src={imagePreview}
                alt="Carte de visite"
                className="w-40 h-28 object-cover rounded-xl border border-[#C9D4DE]/50 shadow-sm"
              />
            )}
            <div className="flex-1 space-y-2">
              <p className="text-sm font-bold text-[#1C2529]">{imageFile.name}</p>
              <p className="text-xs text-[#55636B]">{(imageFile.size / 1024).toFixed(1)} Ko</p>
              <div className="flex gap-2">
                <button
                  onClick={handleExtract}
                  disabled={isExtracting}
                  className="flex items-center gap-2 px-4 py-2 bg-[#005596] text-white text-xs font-bold rounded-lg hover:bg-[#003d6d] disabled:opacity-50"
                >
                  {isExtracting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {isExtracting ? 'Extraction en cours...' : 'Extraire les données'}
                </button>
                <button onClick={reset} className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-[#55636B] hover:text-red-600 transition-colors">
                  <X className="w-4 h-4" /> Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isExtracting && (
        <OcrResultSkeleton />
      )}

      {extracted && !isExtracting && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs text-[#55636B]">
            <Info className="w-4 h-4" />
            <span>Extrait par <strong className="text-[#005596]">{sourceProvider}</strong> — Modifiez les champs si nécessaire avant d'enregistrer.</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {fields.map(({ key, label }) => {
              const conf = confidence[key] || 'low';
              return (
                <div key={key}>
                  <label className="block text-xs font-bold text-[#1C2529] mb-1">{label}</label>
                  <div className={`relative border rounded-lg overflow-hidden ${CONFIDENCE_STYLES[conf]}`}>
                    <input
                      type="text"
                      value={editable[key]}
                      onChange={e => updateField(key, e.target.value)}
                      className="w-full bg-transparent px-3 py-2 text-sm text-[#1C2529] outline-none"
                      placeholder={label}
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-white/70 border border-current/20">
                      {CONFIDENCE_LABELS[conf]}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Photo de profil détectée automatiquement par le service */}
          {photoUrl ? (
            <div className="p-3 bg-[#E8F1F8]/40 rounded-xl flex items-center gap-3">
              <img src={`${CHATBOT_API_PREFIX}${photoUrl}`} alt="Photo détectée" className="w-12 h-12 rounded-full object-cover border-2 border-[#005596]/30" />
              <span className="text-xs text-[#55636B] font-medium">Photo de profil détectée automatiquement</span>
            </div>
          ) : (
            <div className="p-3 bg-slate-50 rounded-xl flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center text-slate-400 text-xs font-bold">N/A</div>
              <span className="text-xs text-[#55636B] font-medium">Aucune photo détectée</span>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={isSaving || saveResult === 'success'}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#005596] text-white text-xs font-bold rounded-lg hover:bg-[#003d6d] disabled:opacity-50 transition-colors"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {isSaving ? 'Enregistrement...' : saveResult === 'success' ? 'Enregistré !' : 'Enregistrer le contact'}
            </button>
            <button onClick={reset} className="px-4 py-2.5 text-xs font-bold text-[#55636B] hover:text-[#005596] transition-colors">
              Scanner une autre carte
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
