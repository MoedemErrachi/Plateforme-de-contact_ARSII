import React, { useState, useRef } from 'react';
import { Camera, Upload, Check, AlertTriangle, X, Loader2, Info } from 'lucide-react';
import { Contact, Gender, ResearchCareerStage } from '../types';
import { LoadingSpinner } from './Skeletons';

const CHATBOT_API_URL = import.meta.env.VITE_CHATBOT_API_URL || 'http://localhost:8000';

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

export const OcrImportTab: React.FC<OcrImportTabProps> = ({ onSaveContact }) => {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<OcrExtractedInfo | null>(null);
  const [sourceProvider, setSourceProvider] = useState<string>('');
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
  const [saveResult, setSaveResult] = useState<'success' | 'error' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const reset = () => {
    setImageFile(null);
    setImagePreview(null);
    setIsExtracting(false);
    setExtractionError(null);
    setExtracted(null);
    setSourceProvider('');
    setPhotoUrl(null);
    setEditable({ firstName: '', lastName: '', email: '', phone: '', affiliation: '', function: '', city: '', countryOfOrigin: '' });
    setConfidence({});
    setSaveResult(null);
  };

  const handleFileSelect = (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      setExtractionError('Fichier trop volumineux (max 10 Mo)');
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setExtracted(null);
    setExtractionError(null);
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
    setExtractionError(null);
    setExtracted(null);
    setSaveResult(null);

    try {
      const token = localStorage.getItem('euraxess_token');
      const formData = new FormData();
      formData.append('image', imageFile);

      const res = await fetch(`${CHATBOT_API_URL}/api/ocr/extract`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: `Erreur HTTP ${res.status}` }));
        throw new Error(err.detail || `Erreur HTTP ${res.status}`);
      }

      const data: OcrExtractionResponse = await res.json();
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
      setExtractionError(err.message || 'Échec de l\'extraction OCR');
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
      gender: 'NONE' as Gender,
      countryOfOrigin: editable.countryOfOrigin,
      city: editable.city,
      phone: editable.phone,
      affiliation: editable.affiliation,
      function: editable.function,
      experience: '',
      facultyDepartment: '',
      researchCareerStage: 'R1' as ResearchCareerStage,
      avatarUrl: photoUrl,
      tags: [],
    };

    try {
      const result = await onSaveContact([contact]);
      setSaveResult(result.ok ? 'success' : 'error');
    } catch {
      setSaveResult('error');
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
              <img src={imagePreview} alt="Carte de visite" className="w-40 h-28 object-cover rounded-xl border border-[#C9D4DE]/50 shadow-sm" />
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

      {extractionError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <p className="text-sm text-red-800">{extractionError}</p>
        </div>
      )}

      {isExtracting && (
        <LoadingSpinner size="md" text="Analyse de la carte de visite en cours..." />
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

          {photoUrl && (
            <div className="p-3 bg-[#E8F1F8]/40 rounded-xl flex items-center gap-3">
              <img src={`${CHATBOT_API_URL}${photoUrl}`} alt="Photo détectée" className="w-12 h-12 rounded-full object-cover border-2 border-[#005596]/30" />
              <span className="text-xs text-[#55636B] font-medium">Photo de profil détectée automatiquement</span>
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

          {saveResult === 'success' && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600" />
              <span className="text-sm text-emerald-800 font-medium">Contact enregistré avec succès !</span>
            </div>
          )}
          {saveResult === 'error' && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <span className="text-sm text-red-800 font-medium">Erreur lors de l'enregistrement. Vérifiez les champs et réessayez.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
