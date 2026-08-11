import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Contact, Gender, ResearchCareerStage, Tag, GENDER_LABELS, CAREER_STAGE_LABELS } from '../types';
import {
  ChevronRight,
  User,
  Briefcase,
  MapPin,
  CheckCircle2,
  Circle,
  Lightbulb,
  X,
  AlertTriangle,
  Tag as TagIcon,
  Camera,
  Loader2,
  GraduationCap
} from 'lucide-react';
import { useToast } from './Toast';
import { validateImageFile, uploadImage, readFileAsDataUrl } from '../utils/upload';

interface NewContactViewProps {
  onAddContact: (contact: Contact) => void;
  onUpdateContact?: (updated: Contact) => void;
  existingContacts?: Contact[];
  tags?: Tag[];
}

const COMMON_COUNTRIES = [
  'Sénégal', 'Tunisie', 'Maroc', 'Algérie', 'Côte d\'Ivoire', 'Nigéria', 'Ghana',
  'Kenya', 'Éthiopie', 'Afrique du Sud', 'Égypte', 'Cameroun', 'Burkina Faso',
  'Mali', 'République démocratique du Congo', 'France', 'Belgique', 'Allemagne',
  'Italie', 'Espagne', 'Pays-Bas', 'Royaume-Uni', 'Portugal'
];

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
  const [gender, setGender] = useState<Gender>(contactToEdit?.gender || 'MALE');
  const [countryOfOrigin, setCountryOfOrigin] = useState(contactToEdit?.countryOfOrigin || 'Sénégal');
  const [city, setCity] = useState(contactToEdit?.city || '');
  const [affiliation, setAffiliation] = useState(contactToEdit?.affiliation || '');
  const [fonction, setFonction] = useState(contactToEdit?.function || '');
  const [experience, setExperience] = useState(contactToEdit?.experience || '');
  const [facultyDepartment, setFacultyDepartment] = useState(contactToEdit?.facultyDepartment || '');
  const [researchCareerStage, setResearchCareerStage] = useState<ResearchCareerStage>(contactToEdit?.researchCareerStage || 'R1_FIRST_STAGE');
  const [lastDate, setLastDate] = useState(contactToEdit?.exchangeNotes?.[0]?.date || '');
  const [exchangeSummary, setExchangeSummary] = useState(
    contactToEdit?.exchangeNotes?.[0]?.content || ''
  );

  // Tags & Avatar
  const [selectedTagNames, setSelectedTagNames] = useState<string[]>(contactToEdit?.tags || []);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(contactToEdit?.avatarUrl || null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const avatarInputRef = React.useRef<HTMLInputElement>(null);

  // Sync state if contactToEdit changes
  React.useEffect(() => {
    if (contactToEdit) {
      setFirstName(contactToEdit.firstName || '');
      setLastName(contactToEdit.lastName || '');
      setEmail(contactToEdit.email || '');
      setPhone(contactToEdit.phone || '');
      setGender(contactToEdit.gender || 'MALE');
      setCountryOfOrigin(contactToEdit.countryOfOrigin || 'Sénégal');
      setCity(contactToEdit.city || '');
      setAffiliation(contactToEdit.affiliation || '');
      setFonction(contactToEdit.function || '');
      setExperience(contactToEdit.experience || '');
      setFacultyDepartment(contactToEdit.facultyDepartment || '');
      setResearchCareerStage(contactToEdit.researchCareerStage || 'R1_FIRST_STAGE');
      setLastDate(contactToEdit.exchangeNotes?.[0]?.date || '');
      setExchangeSummary(contactToEdit.exchangeNotes?.[0]?.content || '');
      setSelectedTagNames(contactToEdit.tags || []);
      setAvatarUrl(contactToEdit.avatarUrl || null);
    }
  }, [contactToEdit]);

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
    firstName, lastName, email, phone, gender, countryOfOrigin, city, affiliation, fonction, experience, facultyDepartment, researchCareerStage
  ].filter(Boolean).length;

  const completionScore = Math.min(Math.round((filledFieldsCount / 12) * 100), 100);

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
      showToast(`Erreur d'import de la photo : ${err.message}`, 'error');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !email) return;

    const fullName = `${firstName} ${lastName}`.trim();
    const initials = `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase() || 'NC';

    const basePayload = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      gender,
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
        initials,
        exchangeNotes: contactToEdit.exchangeNotes || []
      };

      await onUpdateContact(updatedContact);
      navigate('/contacts');
    } else {
      const newContact: Contact = {
        id: '',
        ...basePayload,
        name: fullName,
        initials,
        exchangeNotes: []
      };

      await onAddContact(newContact);
      navigate('/contacts');
    }
  };

  const inputClass = "w-full px-3 py-2.5 rounded-lg border border-[#C9D4DE] focus:border-[#005596] focus:ring-2 focus:ring-[#005596]/20";

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
              onClick={handleSubmit}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#005596] to-[#004275] text-white text-xs font-bold shadow hover:shadow-md active:scale-95 transition-all cursor-pointer"
            >
              {contactToEdit ? 'Enregistrer les modifications' : 'Enregistrer le contact'}
            </button>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-12 gap-6">

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
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Ex: Diop"
                    className={inputClass}
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#55636B] mb-1">Prénom *</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Ex: Moussa"
                    className={inputClass}
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#55636B] mb-1">Email Professionnel *</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="moussa.diop@research-net.org"
                    className={inputClass}
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#55636B] mb-1">Téléphone</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+221 XX XXX XX XX"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#55636B] mb-1">Genre</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as Gender)}
                    className={`${inputClass} bg-white`}
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
                    className={`${inputClass} bg-white`}
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
                  <input
                    type="text"
                    value={countryOfOrigin}
                    onChange={(e) => setCountryOfOrigin(e.target.value)}
                    placeholder="Ex: Sénégal"
                    list="country-of-origin-options"
                    className={inputClass}
                  />
                  <datalist id="country-of-origin-options">
                    {COMMON_COUNTRIES.map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>

                <div>
                  <label className="block font-bold text-[#55636B] mb-1">Ville</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Ex: Dakar"
                    className={inputClass}
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
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#55636B] mb-1">Fonction</label>
                  <input
                    type="text"
                    value={fonction}
                    onChange={(e) => setFonction(e.target.value)}
                    placeholder="Directeur de Recherche en IA"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#55636B] mb-1">Expérience</label>
                  <input
                    type="text"
                    value={experience}
                    onChange={(e) => setExperience(e.target.value)}
                    placeholder="Ex: 10 ans en recherche biomédicale"
                    className={inputClass}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block font-bold text-[#55636B] mb-1">Faculté / Département</label>
                  <input
                    type="text"
                    value={facultyDepartment}
                    onChange={(e) => setFacultyDepartment(e.target.value)}
                    placeholder="Ex: Faculté des Sciences et Techniques"
                    className={inputClass}
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
                            : `${t.color} hover:opacity-90`
                        }`}
                      >
                        {t.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Section 5: Notes & Suivi */}
            <section className="space-y-4">
              <h2 className="text-base font-bold text-[#005596] border-b border-[#C9D4DE]/40 pb-2 flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-[#005596]" /> Notes & Suivi
              </h2>

              <div className="grid grid-cols-1 gap-4 text-xs">
                <div className="md:w-1/2">
                  <label className="block font-bold text-[#55636B] mb-1">Date du premier échange</label>
                  <input
                    type="date"
                    value={lastDate}
                    onChange={(e) => setLastDate(e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#55636B] mb-1">Résumé de l'échange</label>
                  <textarea
                    rows={4}
                    value={exchangeSummary}
                    onChange={(e) => setExchangeSummary(e.target.value)}
                    placeholder="Points clés discutés, opportunités de collaboration identifiées..."
                    className="w-full px-3 py-2.5 rounded-lg border border-[#C9D4DE] focus:border-[#005596] focus:ring-2 focus:ring-[#005596]/20 resize-none"
                  />
                </div>
              </div>
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
                <li className="flex items-center gap-2">
                  <Circle className={`w-4 h-4 ${exchangeSummary ? 'text-[#005596]' : 'text-slate-300'}`} />
                  Première note d'échange documentée
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
                  {firstName || lastName ? `${firstName} ${lastName}` : 'Nouveau Contact'}
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

    </div>
  );
};
