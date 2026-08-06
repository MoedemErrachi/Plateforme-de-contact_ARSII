import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Contact, ActorType, Tag } from '../types';
import { 
  ChevronRight, 
  User, 
  Briefcase, 
  Brain, 
  History, 
  CheckCircle2, 
  Circle, 
  Lightbulb, 
  X, 
  AlertTriangle,
  Plus,
  Tag as TagIcon,
  Camera,
  Loader2
} from 'lucide-react';
import { useToast } from './Toast';
import { validateImageFile, uploadImage, readFileAsDataUrl } from '../utils/upload';

interface NewContactViewProps {
  onAddContact: (contact: Contact) => void;
  onUpdateContact?: (updated: Contact) => void;
  existingContacts?: Contact[];
  tags?: Tag[];
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
  // Form fields initialized according to contactToEdit or blank defaults
  const [nom, setNom] = useState(() => {
    if (!contactToEdit) return '';
    const parts = contactToEdit.name.split(' ');
    return parts.length > 1 ? parts.slice(1).join(' ') : contactToEdit.name;
  });

  const [prenom, setPrenom] = useState(() => {
    if (!contactToEdit) return '';
    const parts = contactToEdit.name.split(' ');
    return parts.length > 1 ? parts[0] : '';
  });

  const [email, setEmail] = useState(contactToEdit?.email || '');
  const [phone, setPhone] = useState(contactToEdit?.phone || '');
  const [fonction, setFonction] = useState(contactToEdit?.title || '');
  const [organization, setOrganization] = useState(contactToEdit?.organization || '');
  const [actorType, setActorType] = useState<ActorType>(contactToEdit?.actorType || 'Labo de recherche');
  const [country, setCountry] = useState(contactToEdit?.country || 'Sénégal');
  const [interventionZones, setInterventionZones] = useState<string[]>(
    contactToEdit?.interventionZones || ['Sénégal', 'Gambie', 'Mali']
  );
  const [zoneInput, setZoneInput] = useState('');
  const [domaine, setDomaine] = useState(contactToEdit?.expertise?.[0] || '');
  const [projetsInput, setProjetsInput] = useState(
    contactToEdit?.projects?.map(p => p.title).join(', ') || ''
  );
  const [competences, setCompetences] = useState<string[]>(
    contactToEdit?.expertise || ['Deep Learning', 'Data Science']
  );
  const [compInput, setCompInput] = useState('');
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
      const parts = contactToEdit.name.split(' ');
      if (parts.length > 1) {
        setPrenom(parts[0]);
        setNom(parts.slice(1).join(' '));
      } else {
        setNom(contactToEdit.name);
        setPrenom('');
      }
      setEmail(contactToEdit.email || '');
      setPhone(contactToEdit.phone || '');
      setFonction(contactToEdit.title || '');
      setOrganization(contactToEdit.organization || '');
      setActorType(contactToEdit.actorType || 'Labo de recherche');
      setCountry(contactToEdit.country || 'Sénégal');
      setInterventionZones(contactToEdit.interventionZones || [contactToEdit.country || 'Sénégal']);
      setDomaine(contactToEdit.expertise?.[0] || '');
      setProjetsInput(contactToEdit.projects?.map(p => p.title).join(', ') || '');
      setCompetences(contactToEdit.expertise || []);
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
    nom, prenom, email, phone, fonction, organization, country, domaine, lastDate, exchangeSummary
  ].filter(Boolean).length + (interventionZones.length > 0 ? 1 : 0) + (competences.length > 0 ? 1 : 0);

  const completionScore = Math.min(Math.round((filledFieldsCount / 12) * 100), 100);

  const handleAddZone = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && zoneInput.trim()) {
      e.preventDefault();
      if (!interventionZones.includes(zoneInput.trim())) {
        setInterventionZones([...interventionZones, zoneInput.trim()]);
      }
      setZoneInput('');
    }
  };

  const removeZone = (z: string) => {
    setInterventionZones(interventionZones.filter(item => item !== z));
  };

  const handleAddComp = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && compInput.trim()) {
      e.preventDefault();
      if (!competences.includes(compInput.trim())) {
        setCompetences([...competences, compInput.trim()]);
      }
      setCompInput('');
    }
  };

  const removeComp = (c: string) => {
    setCompetences(competences.filter(item => item !== c));
  };

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
    if (!nom || !email) return;

    const formattedName = prenom ? `${prenom} ${nom}`.trim() : nom;
    const initials = `${prenom[0] || ''}${nom[0] || ''}`.toUpperCase() || 'NC';

    const flagEmoji =
      country === 'Sénégal' ? '🇸🇳' :
      country === 'Tunisie' ? '🇹🇳' :
      country === 'Maroc' ? '🇲🇦' :
      country === 'France' ? '🇫🇷' :
      country === 'Belgique' ? '🇧🇪' : '🌐';

    if (contactToEdit && onUpdateContact) {
      const updatedContact: Contact = {
        ...contactToEdit,
        name: formattedName,
        initials,
        title: fonction || contactToEdit.title,
        organization: organization || contactToEdit.organization,
        email,
        phone: phone || contactToEdit.phone,
        country,
        flagEmoji,
        interventionZones: interventionZones.length ? interventionZones : [country],
        actorType: actorType,
        expertise: competences.length ? competences : contactToEdit.expertise,
        tags: selectedTagNames,
        avatarUrl: avatarUrl || undefined,
        projects: contactToEdit.projects || [],
        exchangeNotes: contactToEdit.exchangeNotes || []
      };

      await onUpdateContact(updatedContact);
      navigate('/contacts');
    } else {
      const newContact: Contact = {
        id: '',          // will be replaced by DB-generated ID
        name: formattedName,
        initials,
        title: fonction || 'Membre Réseau',
        organization: organization || '',
        email,
        phone: phone || '',
        country,
        flagEmoji,
        interventionZones: interventionZones.length ? interventionZones : [country],
        actorType: actorType,
        expertise: competences.length ? competences : domaine ? [domaine] : [],
        tags: selectedTagNames,
        avatarUrl: avatarUrl || undefined,
        projects: [],
        exchangeNotes: []
      };

      await onAddContact(newContact);
      navigate('/contacts');
    }
  };


  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-8 space-y-6 animate-fade-in">
      
      {/* Header & Breadcrumbs */}
      <div className="flex flex-col gap-1">
        <nav className="flex items-center gap-1.5 text-xs text-[#3d4948] font-semibold">
          <Link to="/contacts" className="hover:text-[#006a66]">
            Contacts
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-[#006a66] font-bold">
            {contactToEdit ? 'Modifier le Contact' : 'Nouveau Contact'}
          </span>
        </nav>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mt-2">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#071f1f] tracking-tight">
              {contactToEdit ? `Modifier la fiche de ${contactToEdit.name}` : 'Ajouter un expert au réseau'}
            </h1>
            <p className="text-xs text-[#3d4948] mt-1">
              {contactToEdit 
                ? 'Mettez à jour les coordonnées et informations R&I du profil.' 
                : 'Complétez les informations pour enrichir la base de données ARSII.'}
            </p>
          </div>

          <div className="flex gap-3">
            <Link
              to="/contacts"
              className="px-5 py-2.5 rounded-xl border border-[#bcc9c7] text-xs font-bold text-[#006a66] hover:bg-[#dff9f8] transition-colors cursor-pointer"
            >
              Annuler
            </Link>
            <button
              onClick={handleSubmit}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#35b8b2] to-[#256865] text-white text-xs font-bold shadow hover:shadow-md active:scale-95 transition-all cursor-pointer"
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
            <div className="flex items-center gap-3 p-4 bg-[#F5A623]/15 border border-[#F5A623] rounded-xl animate-pulse text-xs">
              <AlertTriangle className="w-5 h-5 text-[#F5A623] shrink-0" />
              <div>
                <p className="text-[#855a13] font-bold">Un contact avec cet e-mail existe déjà !</p>
                <p className="text-[#855a13] text-[11px]">Considérez la fusion de fiches dans l'onglet Importation.</p>
              </div>
            </div>
          )}

          <div className="bg-white/90 backdrop-blur-md rounded-2xl p-6 sm:p-8 border border-[#bcc9c7]/50 shadow-[0_6px_18px_rgba(0,0,0,0.06)] space-y-8">
            
            {/* Section 1: Personal Info */}
            <section className="space-y-4">
              <h2 className="text-base font-bold text-[#006a66] border-b border-[#bcc9c7]/40 pb-2 flex items-center gap-2">
                <User className="w-4 h-4 text-[#006a66]" /> Informations Personnelles
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-[#3d4948] mb-1">Nom *</label>
                  <input 
                    type="text"
                    value={nom}
                    onChange={(e) => setNom(e.target.value)}
                    placeholder="Ex: Diop"
                    className="w-full px-3 py-2.5 rounded-lg border border-[#bcc9c7] focus:border-[#35b8b2] focus:ring-2 focus:ring-[#35b8b2]/20"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#3d4948] mb-1">Prénom</label>
                  <input 
                    type="text"
                    value={prenom}
                    onChange={(e) => setPrenom(e.target.value)}
                    placeholder="Ex: Moussa"
                    className="w-full px-3 py-2.5 rounded-lg border border-[#bcc9c7] focus:border-[#35b8b2] focus:ring-2 focus:ring-[#35b8b2]/20"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#3d4948] mb-1">Email Professionnel *</label>
                  <input 
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="moussa.diop@research-net.org"
                    className="w-full px-3 py-2.5 rounded-lg border border-[#bcc9c7] focus:border-[#35b8b2] focus:ring-2 focus:ring-[#35b8b2]/20"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#3d4948] mb-1">Téléphone</label>
                  <input 
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+221 XX XXX XX XX"
                    className="w-full px-3 py-2.5 rounded-lg border border-[#bcc9c7] focus:border-[#35b8b2] focus:ring-2 focus:ring-[#35b8b2]/20"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block font-bold text-[#3d4948] mb-1">Fonction / Titre</label>
                  <input 
                    type="text"
                    value={fonction}
                    onChange={(e) => setFonction(e.target.value)}
                    placeholder="Directeur de Recherche en IA"
                    className="w-full px-3 py-2.5 rounded-lg border border-[#bcc9c7] focus:border-[#35b8b2] focus:ring-2 focus:ring-[#35b8b2]/20"
                  />
                </div>

                {/* Avatar Upload */}
                <div className="md:col-span-2 flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full overflow-hidden bg-[#cee8e7] border-2 border-[#35b8b2]/40 flex items-center justify-center shrink-0">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Photo de profil" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-lg font-black text-[#006a66]">{(prenom || nom)[0]?.toUpperCase() || 'NC'}</span>
                    )}
                  </div>
                  <div className="flex flex-col items-start gap-1">
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      disabled={isUploadingAvatar}
                      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#dff9f8] hover:bg-[#abece7] text-[#006a66] font-bold transition-colors cursor-pointer disabled:opacity-75"
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

            {/* Section 2: R&I Affiliation */}
            <section className="space-y-4">
              <h2 className="text-base font-bold text-[#006a66] border-b border-[#bcc9c7]/40 pb-2 flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-[#006a66]" /> Affiliation R&I
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="md:col-span-2">
                  <label className="block font-bold text-[#3d4948] mb-1">Organisation</label>
                  <input 
                    type="text"
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                    placeholder="Université Cheikh Anta Diop"
                    className="w-full px-3 py-2.5 rounded-lg border border-[#bcc9c7] focus:border-[#35b8b2] focus:ring-2 focus:ring-[#35b8b2]/20"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#3d4948] mb-1">Type d'Acteur</label>
                  <select
                    value={actorType}
                    onChange={(e) => setActorType(e.target.value as any)}
                    className="w-full px-3 py-2.5 rounded-lg border border-[#bcc9c7] focus:border-[#35b8b2] focus:ring-2 focus:ring-[#35b8b2]/20 bg-white"
                  >
                    <option value="Labo de recherche">Labo de recherche / Université</option>
                    <option value="PME">PME / Startup</option>
                    <option value="ONG">ONG / Association</option>
                    <option value="Institutionnel">Institution Publique</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#3d4948] mb-1">Pays du Siège</label>
                  <select
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-[#bcc9c7] focus:border-[#35b8b2] focus:ring-2 focus:ring-[#35b8b2]/20 bg-white"
                  >
                    <option value="Sénégal">Sénégal</option>
                    <option value="Tunisie">Tunisie</option>
                    <option value="France">France</option>
                    <option value="Belgique">Belgique</option>
                    <option value="Maroc">Maroc</option>
                  </select>
                </div>

                {/* Removable Tag Pills for Intervention Countries */}
                <div className="md:col-span-2">
                  <label className="block font-bold text-[#3d4948] mb-1">Pays d'Intervention (Appuyer sur Entrée)</label>
                  <div className="flex flex-wrap gap-1.5 p-2 border border-[#bcc9c7] rounded-lg bg-white min-h-[42px] items-center">
                    {interventionZones.map((z, idx) => (
                      <span key={idx} className="bg-[#abece7] text-[#2b6c6a] text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                        {z}
                        <X className="w-3 h-3 cursor-pointer hover:text-red-700" onClick={() => removeZone(z)} />
                      </span>
                    ))}
                    <input 
                      type="text"
                      value={zoneInput}
                      onChange={(e) => setZoneInput(e.target.value)}
                      onKeyDown={handleAddZone}
                      placeholder="Ajouter un pays..."
                      className="border-none focus:ring-0 text-xs py-0 px-1 flex-1 min-w-[120px]"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Section 3: Expertise & Projects */}
            <section className="space-y-4">
              <h2 className="text-base font-bold text-[#006a66] border-b border-[#bcc9c7]/40 pb-2 flex items-center gap-2">
                <Brain className="w-4 h-4 text-[#006a66]" /> Expertise & Projets
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-[#3d4948] mb-1">Domaine principal</label>
                  <input 
                    type="text"
                    value={domaine}
                    onChange={(e) => setDomaine(e.target.value)}
                    placeholder="Ex: Santé Digitale"
                    className="w-full px-3 py-2.5 rounded-lg border border-[#bcc9c7] focus:border-[#35b8b2] focus:ring-2 focus:ring-[#35b8b2]/20"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#3d4948] mb-1">Projets associés</label>
                  <input 
                    type="text"
                    value={projetsInput}
                    onChange={(e) => setProjetsInput(e.target.value)}
                    placeholder="Ex: Horizon Europe, ARSII-Connect"
                    className="w-full px-3 py-2.5 rounded-lg border border-[#bcc9c7] focus:border-[#35b8b2] focus:ring-2 focus:ring-[#35b8b2]/20"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block font-bold text-[#3d4948] mb-1">Mots-clés / Compétences</label>
                  <div className="flex flex-wrap gap-1.5 p-2 border border-[#bcc9c7] rounded-lg bg-white min-h-[42px] items-center">
                    {competences.map((c, idx) => (
                      <span key={idx} className="bg-[#abece7] text-[#2b6c6a] text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                        {c}
                        <X className="w-3 h-3 cursor-pointer hover:text-red-700" onClick={() => removeComp(c)} />
                      </span>
                    ))}
                    <input 
                      type="text"
                      value={compInput}
                      onChange={(e) => setCompInput(e.target.value)}
                      onKeyDown={handleAddComp}
                      placeholder="Ajouter une compétence..."
                      className="border-none focus:ring-0 text-xs py-0 px-1 flex-1 min-w-[120px]"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Section 3.5: Tags / Étiquettes */}
            <section className="space-y-4">
              <h2 className="text-base font-bold text-[#006a66] border-b border-[#bcc9c7]/40 pb-2 flex items-center gap-2">
                <TagIcon className="w-4 h-4 text-[#006a66]" /> Étiquettes / Tags
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
                            ? 'bg-[#006a66] text-white border-[#006a66] shadow'
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

            {/* Section 4: Notes & Suivi */}
            <section className="space-y-4">
              <h2 className="text-base font-bold text-[#006a66] border-b border-[#bcc9c7]/40 pb-2 flex items-center gap-2">
                <History className="w-4 h-4 text-[#006a66]" /> Notes & Suivi
              </h2>

              <div className="grid grid-cols-1 gap-4 text-xs">
                <div className="md:w-1/2">
                  <label className="block font-bold text-[#3d4948] mb-1">Date du premier échange</label>
                  <input 
                    type="date"
                    value={lastDate}
                    onChange={(e) => setLastDate(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-[#bcc9c7] focus:border-[#35b8b2] focus:ring-2 focus:ring-[#35b8b2]/20"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#3d4948] mb-1">Résumé de l'échange</label>
                  <textarea 
                    rows={4}
                    value={exchangeSummary}
                    onChange={(e) => setExchangeSummary(e.target.value)}
                    placeholder="Points clés discutés, opportunités de collaboration identifiées..."
                    className="w-full px-3 py-2.5 rounded-lg border border-[#bcc9c7] focus:border-[#35b8b2] focus:ring-2 focus:ring-[#35b8b2]/20 resize-none"
                  />
                </div>
              </div>
            </section>

          </div>
        </div>

        {/* Right Column: Completion Score & Live Preview Sidebar */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
          
          {/* Completion Status Box */}
          <div className="bg-white/90 backdrop-blur-md rounded-2xl p-6 border border-[#bcc9c7]/50 shadow-[0_6px_18px_rgba(0,0,0,0.06)] sticky top-20 text-xs space-y-6">
            <h3 className="text-base font-bold text-[#071f1f]">Statut du Contact</h3>

            <div className="space-y-2">
              <div className="flex items-center justify-between font-bold">
                <span className="text-[#3d4948]">Score de Complétude</span>
                <span className="text-[#006a66]">{completionScore}%</span>
              </div>
              <div className="w-full bg-[#cee8e7] rounded-full h-2">
                <div 
                  className="bg-[#006a66] h-2 rounded-full transition-all duration-300"
                  style={{ width: `${completionScore}%` }}
                />
              </div>

              <ul className="space-y-2 pt-2 text-[#3d4948]">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className={`w-4 h-4 ${nom && email ? 'text-[#006a66]' : 'text-slate-300'}`} />
                  Identité & contact de base
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className={`w-4 h-4 ${organization ? 'text-[#006a66]' : 'text-slate-300'}`} />
                  Affiliation R&I précisée
                </li>
                <li className="flex items-center gap-2">
                  <Circle className={`w-4 h-4 ${exchangeSummary ? 'text-[#006a66]' : 'text-slate-300'}`} />
                  Première note d'échange documentée
                </li>
              </ul>
            </div>

            {/* Live Profile Preview */}
            <div className="pt-4 border-t border-[#bcc9c7]">
              <p className="text-[11px] font-bold text-[#3d4948] uppercase tracking-wider mb-3">
                Aperçu du Profil
              </p>
              
              <div className="flex flex-col items-center text-center p-4 bg-[#dff9f8]/40 rounded-xl border border-[#35b8b2]/20">
                <div className="w-16 h-16 rounded-full bg-[#35b8b2] text-white font-bold flex items-center justify-center text-lg mb-2">
                  {nom ? nom[0].toUpperCase() : 'NC'}
                </div>
                <p className="font-extrabold text-sm text-[#071f1f]">
                  {prenom || nom ? `${prenom} ${nom}` : 'Nouveau Contact'}
                </p>
                <p className="text-xs text-[#3d4948] mt-0.5">
                  {organization || 'Organisation non définie'}
                </p>
                {domaine && (
                  <span className="mt-2 bg-[#abece7] text-[#2b6c6a] px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                    {domaine}
                  </span>
                )}
              </div>
            </div>

            {/* Helper Card */}
            <div className="bg-[#006a66] text-white rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-[#34fcec]" />
                <span className="font-bold text-xs">Innovation Logic</span>
              </div>
              <p className="text-[11px] text-white/90 leading-relaxed">
                L'intégration d'experts transversaux favorise les synergies entre les hubs de recherche européens et africains. Assurez-vous d'identifier les domaines d'expertise stratégiques.
              </p>
            </div>

          </div>

        </div>

      </form>

    </div>
  );
};
