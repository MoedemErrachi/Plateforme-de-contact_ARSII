import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, Upload, Check, X, Loader2, Info, Crop, Move } from 'lucide-react';
import { Contact, Gender, ResearchCareerStage } from '../types';
import { OcrResultSkeleton } from './Skeletons';
import { apiFetch, OCR_TIMEOUT_MS, isServiceUnreachable } from '../services/api';
import { useToast } from './Toast';
import { uploadImage } from '../utils/upload';

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

function validateExtractedFields(fields: { firstName: string; lastName: string; email: string }): boolean {
  return !!(fields.firstName || fields.lastName || fields.email);
}

function buildEditableFields(extracted: OcrExtractedInfo) {
  return {
    firstName: fieldToEditable(extracted.firstName),
    lastName: fieldToEditable(extracted.lastName),
    email: fieldToEditable(extracted.email),
    phone: fieldToEditable(extracted.phone),
    affiliation: fieldToEditable(extracted.affiliation),
    function: fieldToEditable(extracted.function),
    city: fieldToEditable(extracted.city),
    countryOfOrigin: fieldToEditable(extracted.countryOfOrigin),
  };
}

function buildConfidenceMap(extracted: OcrExtractedInfo): Record<string, string> {
  return {
    firstName: confidenceOf(extracted.firstName),
    lastName: confidenceOf(extracted.lastName),
    email: confidenceOf(extracted.email),
    phone: confidenceOf(extracted.phone),
    affiliation: confidenceOf(extracted.affiliation),
    function: confidenceOf(extracted.function),
    city: confidenceOf(extracted.city),
    countryOfOrigin: confidenceOf(extracted.countryOfOrigin),
  };
}

async function pickProvider(imageFile: File): Promise<OcrExtractionResponse> {
  const formData = new FormData();
  formData.append('image', imageFile, 'ocr-image.jpg');
  return apiFetch(`${CHATBOT_API_PREFIX}/api/ocr/extract`, {
    method: 'POST',
    body: formData,
    timeoutMs: OCR_TIMEOUT_MS
  });
}

async function resolveAvatarUrl(croppedPreview: string | null, photoUrl: string | null): Promise<string | null> {
  if (croppedPreview) {
    try {
      return await uploadImage(croppedPreview);
    } catch {
      return null;
    }
  }
  if (photoUrl) {
    return `${CHATBOT_API_PREFIX}${photoUrl}`;
  }
  return null;
}

function saveButtonLabel(isSaving: boolean, saveResult: 'success' | null): string {
  if (isSaving) return 'Enregistrement...';
  return saveResult === 'success' ? 'Enregistré !' : 'Enregistrer le contact';
}

interface CropFrameProps {
  imagePreview: string | null;
  cropRect: { x: number; y: number; w: number; h: number };
  cropImgRef: React.RefObject<HTMLImageElement>;
  isCropping: boolean;
  onMoveDown: (e: React.MouseEvent) => void;
  onResizeDown: (e: React.MouseEvent) => void;
  onKeyDownMove: (e: React.KeyboardEvent) => void;
  onKeyDownResize: (e: React.KeyboardEvent) => void;
  onApply: () => void;
  onCancel: () => void;
}

const CropFrame: React.FC<CropFrameProps> = (props) => {
  const { imagePreview, cropRect, cropImgRef, isCropping, onMoveDown, onResizeDown, onKeyDownMove, onKeyDownResize, onApply, onCancel } = props;
  const cornerClassByPos: Record<string, string> = {
    'top-left': 'top-0 left-0 border-t-2 border-l-2',
    'top-right': 'top-0 right-0 border-t-2 border-r-2',
    'bottom-left': 'bottom-0 left-0 border-b-2 border-l-2',
  };
  return (
    <div className="space-y-3">
      <p className="text-xs font-bold text-[#55636B] flex items-center gap-1.5"><Move className="w-3.5 h-3.5" /> Déplacez et redimensionnez le cadre de recadrage</p>
      <div className="relative inline-block max-w-full rounded-xl overflow-hidden border border-[#C9D4DE]/50 select-none">
        <img ref={cropImgRef} src={imagePreview || ''} alt="Recadrage" className="block max-h-[50vh] w-full object-contain pointer-events-none" draggable={false} />
        {/* Dark overlay */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: `linear-gradient(to right, rgba(0,0,0,0.55) ${cropRect.x}%, transparent ${cropRect.x}%, transparent ${cropRect.x + cropRect.w}%, rgba(0,0,0,0.55) ${cropRect.x + cropRect.w}%),
            linear-gradient(to bottom, rgba(0,0,0,0.55) ${cropRect.y}%, transparent ${cropRect.y}%, transparent ${cropRect.y + cropRect.h}%, rgba(0,0,0,0.55) ${cropRect.y + cropRect.h}%)`
        }} />
        {/* Crop frame — widget de recadrage personnalisé (déplacement souris/clavier) */}
        <div /* NOSONAR */
          className="absolute border-2 border-white/90 cursor-move shadow-lg"
          style={{ left: `${cropRect.x}%`, top: `${cropRect.y}%`, width: `${cropRect.w}%`, height: `${cropRect.h}%` }}
          onMouseDown={onMoveDown}
          role="button"
          tabIndex={0}
          aria-label="Cadre de recadrage"
          onKeyDown={onKeyDownMove}
        >
          {/* Resize handle (bottom-right corner) */}
          <div /* NOSONAR */
            className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
            onMouseDown={onResizeDown}
            role="button"
            tabIndex={0}
            aria-label="Redimensionner le cadre de recadrage"
            onKeyDown={onKeyDownResize}
          >
            <div className="absolute bottom-1 right-1 w-2.5 h-2.5 border-r-2 border-b-2 border-white/80" />
          </div>
          {/* Corner marks */}
          {['top-left', 'top-right', 'bottom-left'].map(pos => (
            <div key={pos} className={`absolute w-3 h-3 border-white/60 ${cornerClassByPos[pos]}`} />
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={onApply} disabled={isCropping} className="flex items-center gap-2 px-4 py-2 bg-[#005596] text-white text-xs font-bold rounded-lg hover:bg-[#003d6d] disabled:opacity-50">
          {isCropping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crop className="w-4 h-4" />}
          {isCropping ? 'Recadrage...' : 'Appliquer le recadrage'}
        </button>
        <button onClick={onCancel} className="px-3 py-2 text-xs font-bold text-[#55636B] hover:text-red-600 transition-colors">Annuler</button>
      </div>
    </div>
  );
};

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
  const [cropMode, setCropMode] = useState(false);
  const [cropRect, setCropRect] = useState({ x: 10, y: 10, w: 80, h: 80 });
  const [croppedPreview, setCroppedPreview] = useState<string | null>(null);
  const [isCropping, setIsCropping] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const cropImgRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; startRect: typeof cropRect; mode: 'move' | 'resize' } | null>(null);

  const reset = () => {
    setImageFile(null);
    setImagePreview(null);
    setIsExtracting(false);
    setExtracted(null);
    setSourceProvider('');
    setPhotoUrl(null);
    setCropMode(false);
    setCropRect({ x: 10, y: 10, w: 80, h: 80 });
    setCroppedPreview(null);
    setIsCropping(false);
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
      const data = await pickProvider(imageFile);
      setExtracted(data.extracted);
      setSourceProvider(data.sourceProvider);
      setPhotoUrl(data.photoUrl || null);
      setEditable(buildEditableFields(data.extracted));
      setConfidence(buildConfidenceMap(data.extracted));
    } catch (err: any) {
      // apiFetch garantit un message utilisateur en français, quel que soit le
      // mode d'échec (réseau, timeout, 5xx). Les erreurs réseau émettent déjà
      // un toast global ; on notifie uniquement les erreurs métier locales.
      if (isServiceUnreachable(err)) return;
      showToast(err?.message || 'Échec de l\'extraction OCR.', 'error');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSave = async () => {
    if (!validateExtractedFields(editable)) return;
    setIsSaving(true);
    setSaveResult(null);

    const persistentAvatarUrl = await resolveAvatarUrl(croppedPreview, photoUrl);

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
      avatarUrl: persistentAvatarUrl,
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

  // ── Manual crop handlers ──────────────────────────────────
  const clampCrop = (r: typeof cropRect) => ({
    x: Math.max(0, Math.min(100 - r.w, r.x)),
    y: Math.max(0, Math.min(100 - r.h, r.y)),
    w: Math.max(10, Math.min(100, r.w)),
    h: Math.max(10, Math.min(100, r.h)),
  });

  const handleCropMouseDown = useCallback((e: React.MouseEvent, mode: 'move' | 'resize') => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { startX: e.clientX, startY: e.clientY, startRect: { ...cropRect }, mode };
  }, [cropRect]);

  const handleCropKeyDown = useCallback((e: React.KeyboardEvent, mode: 'move' | 'resize') => {
    const step = e.shiftKey ? 5 : 1;
    let dx = 0;
    let dy = 0;
    if (e.key === 'ArrowLeft') { e.preventDefault(); dx = -step; }
    else if (e.key === 'ArrowRight') { e.preventDefault(); dx = step; }
    else if (e.key === 'ArrowUp') { e.preventDefault(); dy = -step; }
    else if (e.key === 'ArrowDown') { e.preventDefault(); dy = step; }
    else return;
    setCropRect(prev => {
      if (mode === 'move') return clampCrop({ ...prev, x: prev.x + dx, y: prev.y + dy });
      return clampCrop({ ...prev, w: prev.w + dx, h: prev.h + dy });
    });
  }, []);

  useEffect(() => {
    if (!cropMode) return;
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current || !cropImgRef.current) return;
      const img = cropImgRef.current;
      const rect = img.getBoundingClientRect();
      const dx = ((e.clientX - dragRef.current.startX) / rect.width) * 100;
      const dy = ((e.clientY - dragRef.current.startY) / rect.height) * 100;
      const s = dragRef.current.startRect;
      if (dragRef.current.mode === 'move') {
        setCropRect(clampCrop({ x: s.x + dx, y: s.y + dy, w: s.w, h: s.h }));
      } else {
        setCropRect(clampCrop({ x: s.x, y: s.y, w: Math.max(10, s.w + dx), h: Math.max(10, s.h + dy) }));
      }
    };
    const onUp = () => { dragRef.current = null; };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [cropMode]);

  const applyCrop = useCallback(async () => {
    if (!imagePreview) return;
    setIsCropping(true);
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = imagePreview;
      });
      const sx = (cropRect.x / 100) * img.naturalWidth;
      const sy = (cropRect.y / 100) * img.naturalHeight;
      const sw = (cropRect.w / 100) * img.naturalWidth;
      const sh = (cropRect.h / 100) * img.naturalHeight;
      const canvas = document.createElement('canvas');
      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      setCroppedPreview(dataUrl);
      setCropMode(false);
      showToast('Photo recadrée avec succès.', 'success');
    } catch {
      showToast('Échec du recadrage.', 'error');
    } finally {
      setIsCropping(false);
    }
  }, [imagePreview, cropRect, showToast]);

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

  const saveButtonText = saveButtonLabel(isSaving, saveResult);

  let photoSection: React.ReactNode;
  if (photoUrl || croppedPreview) {
    photoSection = (
      <div className="p-3 bg-[#E8F1F8]/40 rounded-xl flex items-center gap-3">
        <img src={croppedPreview || `${CHATBOT_API_PREFIX}${photoUrl}`} alt="Visage détecté" className="w-12 h-12 rounded-full object-cover border-2 border-[#005596]/30" />
        <span className="text-xs text-[#55636B] font-medium">
          {croppedPreview ? 'Photo recadrée manuellement' : 'Photo de profil détectée automatiquement'}
        </span>
        {croppedPreview && (
          <button onClick={() => setCroppedPreview(null)} className="text-xs text-[#55636B] hover:text-red-600 underline ml-auto">Annuler le recadrage</button>
        )}
      </div>
    );
  } else if (cropMode) {
    photoSection = (
      <CropFrame
        imagePreview={imagePreview}
        cropRect={cropRect}
        cropImgRef={cropImgRef}
        isCropping={isCropping}
        onMoveDown={e => handleCropMouseDown(e, 'move')}
        onResizeDown={e => handleCropMouseDown(e, 'resize')}
        onKeyDownMove={e => handleCropKeyDown(e, 'move')}
        onKeyDownResize={e => handleCropKeyDown(e, 'resize')}
        onApply={applyCrop}
        onCancel={() => setCropMode(false)}
      />
    );
  } else {
    photoSection = (
      <div className="p-3 bg-slate-50 rounded-xl flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center text-slate-400 text-xs font-bold">N/A</div>
        <span className="text-xs text-[#55636B] font-medium">Aucune photo détectée</span>
        {imagePreview && (
          <button onClick={() => { setCropMode(true); setCropRect({ x: 10, y: 10, w: 80, h: 80 }); }} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-[#005596]/10 text-[#005596] text-xs font-bold rounded-lg hover:bg-[#005596]/20 transition-colors">
            <Crop className="w-3.5 h-3.5" /> Recadrer manuellement
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!imageFile ? (
        <div /* NOSONAR — zone de dépôt accessible (clic + clavier + drag & drop) */
          ref={dropRef}
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          role="button"
          tabIndex={0}
          aria-label="Importer une photo de carte de visite"
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
          {photoSection}

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={isSaving || saveResult === 'success'}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#005596] text-white text-xs font-bold rounded-lg hover:bg-[#003d6d] disabled:opacity-50 transition-colors"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {saveButtonText}
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
