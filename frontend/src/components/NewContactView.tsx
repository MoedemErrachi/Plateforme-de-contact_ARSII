import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Contact, Gender, GENDER_LABELS, ResearchCareerStage, Tag, CAREER_STAGE_LABELS } from '../types';
import { formatFullName } from '../utils/format';
import { COUNTRIES } from '../constants/countries';
import {
  ChevronRight,
  User,
  Briefcase,
  MapPin,
  CheckCircle2,
  Lightbulb,
  AlertTriangle,
  Tag as TagIcon,
  Camera,
  Loader2
} from 'lucide-react';
import { useToast } from './Toast';
import { ModalConfirmation } from './ModalConfirmation';
import { isServiceUnreachable } from '../services/api';
import { validateImageFile, uploadImage, readFileAsDataUrl } from '../utils/upload';

interface NewContactViewProps {
  onAddContact: (contact: Contact) => void;
  onUpdateContact?: (updated: Contact) => void;
  existingContacts?: Contact[];
  tags?: Tag[];
}

const INPUT_CLASS =
  'w-full px-3 py-2.5 rounded-lg border border-[#C9D4DE] bg-white focus:border-[#005596] focus:ring-2 focus:ring-[#005596]/20';

const INVALID_INPUT_CLASS = '!border-red-400 !ring-red-400/20 focus:!border-red-400';

// Liste mondiale des pays (libellés FR) : alimente le sélecteur « Pays d'origine ».
const COUNTRY_OPTIONS = COUNTRIES.map(c => c.label);

interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  invalid?: boolean;
}

function SearchableSelect({ value, onChange, options, placeholder, invalid = false }: SearchableSelectProps) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter(o => o.toLowerCase().includes(q)) : options;
  }, [options, query]);

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
        }}
        placeholder={placeholder}
        className={`${INPUT_CLASS} ${invalid ? INVALID_INPUT_CLASS : ''}`}
      />
      {open && filteredOptions.length > 0 && (
        <div className="absolute z-30 mt-1 w-full max-h-56 overflow-y-auto bg-white border border-[#C9D4DE] rounded-lg shadow-xl">
          {filteredOptions.map(opt => (
            <button
              key={opt}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                setQuery(opt);
                onChange(opt);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-xs transition-colors cursor-pointer ${
                opt === value ? 'bg-[#E8F1F8] font-bold text-[#005596]' : 'text-[#1C2529] hover:bg-[#E8F1F8]'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export const NewContactView: React.FC<NewContactViewProps> = ({
  onAddContact,
  onUpdateContact,
  existingContacts = [],
  tags = []
}) => {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const contactToEdit = existingContacts.find(c => c.id === id) ?? null;

  const [firstName, setFirstName] = useState(contactToEdit?.firstName || '');
  const [lastName, setLastName] = useState(contactToEdit?.lastName || '');
  const [email, setEmail] = useState(contactToEdit?.email || '');
  const [phone, setPhone] = useState(contactToEdit?.phone || '');
  const [gender, setGender] = useState<Gender>(contactToEdit?.gender || 'NOT_SPECIFIED');
  const [countryOfOrigin, setCountryOfOrigin] = useState(contactToEdit?.countryOfOrigin || 'Sénégal');
  const [city, setCity] = useState(contactToEdit?.city || '');
  const [affiliation, setAffiliation] = useState(contactToEdit?.affiliation || '');
  const [fonction, setFonction] = useState(contactToEdit?.function || '');
  const [experience, setExperience] = useState(contactToEdit?.experience || '');
  const [facultyDepartment, setFacultyDepartment] = useState(contactToEdit?.facultyDepartment || '');
  const [researchCareerStage, setResearchCareerStage] = useState<ResearchCareerStage>(contactToEdit?.researchCareerStage || 'R1_FIRST_STAGE');

  // Tags & Avatar
  const [selectedTagNames, setSelectedTagNames] = useState<string[]>(contactToEdit?.tags || []);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(contactToEdit?.avatarUrl || null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Validation state
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Confirmation avant enregistrement : récapitulatif des informations clés.
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Sync state if contactToEdit changes
  useEffect(() => {
    if (contactToEdit) {
      setFirstName(contactToEdit.firstName || '');
      setLastName(contactToEdit.lastName || '');
      setEmail(contactToEdit.email || '');
      setPhone(contactToEdit.phone || '');
      setGender(contactToEdit.gender || 'NOT_SPECIFIED');
      setCountryOfOrigin(contactToEdit.countryOfOrigin || 'Sénégal');
      setCity(contactToEdit.city || '');
      setAffiliation(contactToEdit.affiliation || '');
      setFonction(contactToEdit.function || '');
      setExperience(contactToEdit.experience || '');
      setFacultyDepartment(contactToEdit.facultyDepartment || '');
      setResearchCareerStage(contactToEdit.researchCareerStage || 'R1_FIRST_STAGE');
      setSelectedTagNames(contactToEdit.tags || []);
      setAvatarUrl(contactToEdit.avatarUrl || null);
    }
  }, [contactToEdit]);

  // Cascade pays → ville : la ville est une saisie libre, activée uniquement
  // lorsqu'un pays est sélectionné ; changer de pays réinitialise la ville.
  const isCountrySelected = countryOfOrigin.trim().length > 0;
  const handleCountryChange = (next: string) => {
    if (next.trim() !== countryOfOrigin.trim()) {
      setCity('');
    }
    setCountryOfOrigin(next);
  };

  // Duplicate check: exclude the contact currently being edited
  const currentCleanEmail = email.toLowerCase().trim();
  const showDuplicateWarning = currentCleanEmail !== '' && (
    existingContacts && existingContacts.length > 0
      ? existingContacts.some(c => c.id !== contactToEdit?.id && c.email.toLowerCase().trim() === currentCleanEmail)
      : (
          ['a.diallo@research-network.org', 'e.schneider@eu-agri.tech', 'moussa.diop@research-net.org']
            .includes(currentCleanEmail) &&
          (!contactToEdit || contactToEdit.email.toLowerCase().trim() !== currentCleanEmail)
        )
  );

  // Calculate live completion score
  const filledFieldsCount = [
    firstName, lastName, email, phone, countryOfOrigin, city, affiliation, fonction, experience, facultyDepartment, researchCareerStage
  ].filter(Boolean).length;

  const completionScore = Math.min(Math.round((filledFieldsCount / 11) * 100), 100);

  const toggleTag = (tagName: string) => {
    setSelectedTagNames(prev =>
      prev.includes(tagName)
        ? prev.filter(t => t !== tagName)
        : [...prev, tagName]
    );
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const validationError = validateImageFile(file);
    if (validationError) {
      showToast(validationError, 'error');
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const url = await uploadImage(dataUrl);
      setAvatarUrl(url);
      showToast('Photo de profil mise à jour.', 'success');
    } catch (err: any) {
      // Service injoignable : le toast global a déjà notifié l'utilisateur.
      if (!isServiceUnreachable(err)) showToast(`Erreur d'import de la photo : ${err.message}`, 'error');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const clearFieldError = (key: string) => {
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: '' }));
  };

  const validateForm = (): boolean => {
    const next: Record<string, string> = {};
    if (!firstName.trim()) next.firstName = 'Prénom requis';
    if (!lastName.trim()) next.lastName = 'Nom requis';
    if (!email.trim()) next.email = 'Adresse e-mail requise';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = 'Adresse e-mail invalide';

    setErrors(next);
    if (Object.keys(next).length > 0) {
      showToast('Veuillez remplir tous les champs obligatoires avant d\'enregistrer.', 'error');
      const firstKey = (['firstName', 'lastName', 'email'] as const).find(k => next[k]);
      if (firstKey) document.getElementById(`field-${firstKey}`)?.focus();
      return false;
    }
    return true;
  };

  const performSave = async () => {
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      const fullName = formatFullName(firstName, lastName);
      const initials = `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase() || 'NC';

      const basePayload = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        gender: gender || 'NOT_SPECIFIED',
        countryOfOrigin: countryOfOrigin.trim() || 'Sénégal',
        city: city.trim(),
        affiliation: affiliation.trim(),
        function: fonction.trim() || undefined,
        experience: experience.trim() || undefined,
        facultyDepartment: facultyDepartment.trim() || undefined,
        researchCareerStage,
        tags: selectedTagNames,
        avatarUrl: avatarUrl || undefined
      };

      if (contactToEdit && onUpdateContact) {
        const updatedContact: Contact = {
          ...contactToEdit,
          ...basePayload,
          name: fullName,
          initials
        };

        await onUpdateContact(updatedContact);
        navigate('/contacts');
      } else {
        const newContact: Contact = {
          id: '',
          ...basePayload,
          name: fullName,
          initials
        };

        await onAddContact(newContact);
        navigate('/contacts');
      }
    } finally {
      setIsSaving(false);
      setIsConfirmOpen(false);
    }
  };

  // Validation d'abord ; si le formulaire est valide, on demande confirmation
  // avec un récapitulatif avant l'enregistrement effectif.
  const requestSave = () => {
    if (!validateForm()) return;
    setIsConfirmOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    requestSave();
  };

  const fieldClass = (key: string) => `${INPUT_CLASS} ${errors[key] ? INVALID_INPUT_CLASS : ''}`;

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-8 space-y-6 animate-fade-in">

      {/* Header & Breadcrumbs */}
      <div className="flex flex-col gap-1">
        <nav className="flex items-center gap-1.5 text-xs text-[#55636B] font-semibold">
          <Link to="/contacts" className="hover:text-[#005596]">
            Contacts
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-[#005596] font-bold">
            {contactToEdit ? 'Modifier le Contact' : 'Nouveau Contact'}
          </span>
        </nav>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mt-2">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1C2529] tracking-tight">
              {contactToEdit ? `Modifier la fiche de ${contactToEdit.name}` : 'Ajouter un expert au réseau'}
            </h1>
            <p className="text-xs text-[#55636B] mt-1">
              {contactToEdit
                ? 'Mettez à jour les coordonnées et informations R&I du profil.'
                : 'Complétez les informations pour enrichir la base de données EURAXESS Africa.'}
            </p>
          </div>

          <div className="flex gap-3">
            <Link
              to="/contacts"
              className="px-5 py-2.5 rounded-xl border border-[#C9D4DE] text-xs font-bold text-[#005596] hover:bg-[#E8F1F8] transition-colors cursor-pointer"
            >
              Annuler
            </Link>
            <button
              type="button"
              onClick={() => requestSave()}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#005596] to-[#004275] text-white text-xs font-bold shadow hover:shadow-md active:scale-95 transition-all cursor-pointer"
            >
              {contactToEdit ? 'Enregistrer les modifications' : 'Enregistrer le contact'}
            </button>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate className="grid grid-cols-12 gap-6">

        {/* Left Column: Form Sections */}
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">

          {/* Simulated Duplicate Warning */}
          {showDuplicateWarning && (
            <div className="flex items-center gap-3 p-4 bg-[#FFC20C]/15 border border-[#FFC20C] rounded-xl animate-pulse text-xs">
              <AlertTriangle className="w-5 h-5 text-[#FFC20C] shrink-0" />
              <div>
                <p className="text-[#A67C00] font-bold">Un contact avec cet e-mail existe déjà !</p>
                <p className="text-[#A67C00] text-[11px]">Considérez la fusion de fiches dans l'onglet Importation.</p>
              </div>
            </div>
          )}

          <div className="bg-white/90 backdrop-blur-md rounded-2xl p-6 sm:p-8 border border-[#C9D4DE]/50 shadow-[0_6px_18px_rgba(0,0,0,0.06)] space-y-8">

            {/* Section 1: Personal Info */}
            <section className="space-y-4">
              <h2 className="text-base font-bold text-[#005596] border-b border-[#C9D4DE]/40 pb-2 flex items-center gap-2">
                <User className="w-4 h-4 text-[#005596]" /> Informations Personnelles
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-[#55636B] mb-1">Nom *</label>
                  <input
                    id="field-lastName"
                    type="text"
                    value={lastName}
                    onChange={(e) => {
                      setLastName(e.target.value);
                      clearFieldError('lastName');
                    }}
                    placeholder="Ex: Diop"
                    className={fieldClass('lastName')}
                    required
                  />
                  {errors.lastName && <p className="text-[11px] font-semibold text-red-500 mt-1">{errors.lastName}</p>}
                </div>

                <div>
                  <label className="block font-bold text-[#55636B] mb-1">Prénom *</label>
                  <input
                    id="field-firstName"
                    type="text"
                    value={firstName}
                    onChange={(e) => {
                      setFirstName(e.target.value);
                      clearFieldError('firstName');
                    }}
                    placeholder="Ex: Moussa"
                    className={fieldClass('firstName')}
                    required
                  />
                  {errors.firstName && <p className="text-[11px] font-semibold text-red-500 mt-1">{errors.firstName}</p>}
                </div>

                <div>
                  <label className="block font-bold text-[#55636B] mb-1">Email Professionnel *</label>
                  <input
                    id="field-email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      clearFieldError('email');
                    }}
                    placeholder="moussa.diop@research-net.org"
                    className={fieldClass('email')}
                    required
                  />
                  {errors.email && <p className="text-[11px] font-semibold text-red-500 mt-1">{errors.email}</p>}
                </div>

                <div>
                  <label className="block font-bold text-[#55636B] mb-1">Téléphone</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+221 XX XXX XX XX"
                    className={INPUT_CLASS}
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#55636B] mb-1">Genre</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as Gender)}
                    className={`${INPUT_CLASS} bg-white`}
                  >
                    {(Object.keys(GENDER_LABELS) as Gender[]).map(g => (
                      <option key={g} value={g}>{GENDER_LABELS[g]}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#55636B] mb-1">Stade de carrière</label>
                  <select
                    value={researchCareerStage}
                    onChange={(e) => setResearchCareerStage(e.target.value as ResearchCareerStage)}
                    className={`${INPUT_CLASS} bg-white`}
                  >
                    {(Object.keys(CAREER_STAGE_LABELS) as ResearchCareerStage[]).map(s => (
                      <option key={s} value={s}>{CAREER_STAGE_LABELS[s]}</option>
                    ))}
                  </select>
                </div>

                {/* Avatar Upload */}
                <div className="md:col-span-2 flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full overflow-hidden bg-[#D9E6F2] border-2 border-[#005596]/40 flex items-center justify-center shrink-0">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Photo de profil" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-lg font-black text-[#005596]">{(firstName || lastName)[0]?.toUpperCase() || 'NC'}</span>
                    )}
                  </div>
                  <div className="flex flex-col items-start gap-1">
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      disabled={isUploadingAvatar}
                      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#E8F1F8] hover:bg-[#BCD7EE] text-[#005596] font-bold transition-colors cursor-pointer disabled:opacity-75"
                    >
                      {isUploadingAvatar ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                      {avatarUrl ? 'Changer la photo' : 'Ajouter une photo'}
                    </button>
                    <span className="text-[10px] text-slate-400">PNG, JPEG, WebP — 5 Mo max.</span>
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={handleAvatarChange}
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Section 2: Localisation */}
            <section className="space-y-4">
              <h2 className="text-base font-bold text-[#005596] border-b border-[#C9D4DE]/40 pb-2 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#005596]" /> Localisation
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-[#55636B] mb-1">Pays d'origine</label>
                  <SearchableSelect
                    value={countryOfOrigin}
                    onChange={handleCountryChange}
                    options={COUNTRY_OPTIONS}
                    placeholder="Rechercher un pays..."
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#55636B] mb-1">Ville</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    disabled={!isCountrySelected}
                    placeholder={
                      isCountrySelected
                        ? 'Saisir une ville...'
                        : "Sélectionnez d'abord un pays"
                    }
                    className={`${INPUT_CLASS} disabled:bg-[#E8F1F8]/60 disabled:cursor-not-allowed disabled:text-slate-400`}
                  />
                </div>
              </div>
            </section>

            {/* Section 3: Affiliation R&I */}
            <section className="space-y-4">
              <h2 className="text-base font-bold text-[#005596] border-b border-[#C9D4DE]/40 pb-2 flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-[#005596]" /> Affiliation R&I
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="md:col-span-2">
                  <label className="block font-bold text-[#55636B] mb-1">Affiliation (Organisation)</label>
                  <input
                    type="text"
                    value={affiliation}
                    onChange={(e) => setAffiliation(e.target.value)}
                    placeholder="Université Cheikh Anta Diop"
                    className={INPUT_CLASS}
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#55636B] mb-1">Fonction</label>
                  <input
                    type="text"
                    value={fonction}
                    onChange={(e) => setFonction(e.target.value)}
                    placeholder="Directeur de Recherche en IA"
                    className={INPUT_CLASS}
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#55636B] mb-1">Expérience</label>
                  <input
                    type="text"
                    value={experience}
                    onChange={(e) => setExperience(e.target.value)}
                    placeholder="Ex: 10 ans en recherche biomédicale"
                    className={INPUT_CLASS}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block font-bold text-[#55636B] mb-1">Faculté / Département</label>
                  <input
                    type="text"
                    value={facultyDepartment}
                    onChange={(e) => setFacultyDepartment(e.target.value)}
                    placeholder="Ex: Faculté des Sciences et Techniques"
                    className={INPUT_CLASS}
                  />
                </div>
              </div>
            </section>

            {/* Section 4: Tags / Étiquettes */}
            <section className="space-y-4">
              <h2 className="text-base font-bold text-[#005596] border-b border-[#C9D4DE]/40 pb-2 flex items-center gap-2">
                <TagIcon className="w-4 h-4 text-[#005596]" /> Étiquettes / Tags
              </h2>

              {tags.length === 0 ? (
                <p className="text-xs text-slate-400 italic">
                  Aucun tag disponible. Créez des tags dans l'onglet Segmentation.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {tags.map(t => {
                    const active = selectedTagNames.includes(t.name);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => toggleTag(t.name)}
                        className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all cursor-pointer ${
                          active
                            ? 'bg-[#005596] text-white border-[#005596] shadow'
                            : `${t.color || 'bg-slate-100 text-slate-700 border-slate-200'} hover:opacity-90`
                        }`}
                      >
                        {t.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

          </div>
        </div>

        {/* Right Column: Completion Score & Live Preview Sidebar */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">

          {/* Completion Status Box */}
          <div className="bg-white/90 backdrop-blur-md rounded-2xl p-6 border border-[#C9D4DE]/50 shadow-[0_6px_18px_rgba(0,0,0,0.06)] sticky top-20 text-xs space-y-6">
            <h3 className="text-base font-bold text-[#1C2529]">Statut du Contact</h3>

            <div className="space-y-2">
              <div className="flex items-center justify-between font-bold">
                <span className="text-[#55636B]">Score de Complétude</span>
                <span className="text-[#005596]">{completionScore}%</span>
              </div>
              <div className="w-full bg-[#D9E6F2] rounded-full h-2">
                <div
                  className="bg-[#005596] h-2 rounded-full transition-all duration-300"
                  style={{ width: `${completionScore}%` }}
                />
              </div>

              <ul className="space-y-2 pt-2 text-[#55636B]">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className={`w-4 h-4 ${firstName && email ? 'text-[#005596]' : 'text-slate-300'}`} />
                  Identité & contact de base
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className={`w-4 h-4 ${affiliation ? 'text-[#005596]' : 'text-slate-300'}`} />
                  Affiliation R&I précisée
                </li>
              </ul>
            </div>

            {/* Live Profile Preview */}
            <div className="pt-4 border-t border-[#C9D4DE]">
              <p className="text-[11px] font-bold text-[#55636B] uppercase tracking-wider mb-3">
                Aperçu du Profil
              </p>

              <div className="flex flex-col items-center text-center p-4 bg-[#E8F1F8]/40 rounded-xl border border-[#005596]/20">
                <div className="w-16 h-16 rounded-full bg-[#005596] text-white font-bold flex items-center justify-center text-lg mb-2">
                  {firstName ? firstName[0].toUpperCase() : 'NC'}
                </div>
                <p className="font-extrabold text-sm text-[#1C2529]">
                  {firstName || lastName ? formatFullName(firstName, lastName) : 'Nouveau Contact'}
                </p>
                <p className="text-xs text-[#55636B] mt-0.5">
                  {affiliation || 'Organisation non définie'}
                </p>
                {researchCareerStage && (
                  <span className="mt-2 bg-[#BCD7EE] text-[#005596] px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                    {CAREER_STAGE_LABELS[researchCareerStage]}
                  </span>
                )}
              </div>
            </div>

            {/* Helper Card */}
            <div className="bg-[#005596] text-white rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-[#FFC20C]" />
                <span className="font-bold text-xs">Innovation Logic</span>
              </div>
              <p className="text-[11px] text-white/90 leading-relaxed">
                L'intégration d'experts transversaux favorise les synergies entre les hubs de recherche européens et africains. Assurez-vous d'identifier les stades de carrière et affilier les experts à leurs institutions de recherche.
              </p>
            </div>

          </div>

        </div>

      </form>

      <ModalConfirmation
        open={isConfirmOpen}
        title={contactToEdit ? 'Confirmer la modification' : 'Confirmer la création'}
        confirmLabel={contactToEdit ? 'Enregistrer' : 'Créer le contact'}
        isLoading={isSaving}
        onConfirm={performSave}
        onCancel={() => setIsConfirmOpen(false)}
        message={
          <span>
            {contactToEdit ? 'Vous êtes sur le point de mettre à jour la fiche de ' : 'Vous êtes sur le point d’ajouter '}
            <strong>{formatFullName(firstName, lastName) || 'ce contact'}</strong>
            {contactToEdit ? '.' : ' au réseau EURAXESS Africa.'}
            {(countryOfOrigin.trim() || city.trim()) && (
              <>
                <br />
                Localisation : {[city.trim(), countryOfOrigin.trim()].filter(Boolean).join(', ') || '\u2014'}
              </>
            )}
          </span>
        }
      />

    </div>
  );
};
