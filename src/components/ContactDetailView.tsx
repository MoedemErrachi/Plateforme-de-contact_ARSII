import React, { useState } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import { Contact, ExchangeNote, GENDER_LABELS, CAREER_STAGE_LABELS } from '../types';
import { Modal } from './Modal';
import {
  ChevronRight,
  CheckCircle2,
  Building2,
  Edit3,
  Share2,
  Mail,
  Phone,
  Globe,
  History,
  PlusCircle,
  MessageSquare,
  Check,
  X,
  MapPin,
  GraduationCap,
  Users
} from 'lucide-react';

interface ContactDetailViewProps {
  contacts: Contact[];
  onAddNote: (contactId: string, note: Omit<ExchangeNote, 'id'>) => void;
}

export const ContactDetailView: React.FC<ContactDetailViewProps> = ({
  contacts,
  onAddNote
}) => {
  const { id } = useParams<{ id: string }>();
  const contact = contacts.find(c => c.id === id);
  const [quickNoteModalOpen, setQuickNoteModalOpen] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newNoteType, setNewNoteType] = useState<'meeting' | 'email' | 'call' | 'note'>('meeting');
  const [copiedToast, setCopiedToast] = useState(false);

  if (!contact) {
    return <Navigate to="/contacts" replace />;
  }

  const handleCreateNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteTitle.trim() || !newNoteContent.trim()) return;

    onAddNote(contact.id, {
      date: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }),
      relativeTime: 'À l\'instant',
      title: newNoteTitle,
      content: newNoteContent,
      author: 'Marie Curie',
      authorInitials: 'MC',
      type: newNoteType
    });

    setNewNoteTitle('');
    setNewNoteContent('');
    setQuickNoteModalOpen(false);
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedToast(true);
    setTimeout(() => setCopiedToast(false), 2000);
  };

  const identityFields: { label: string; value: string }[] = [
    { label: 'Genre', value: GENDER_LABELS[contact.gender] },
    { label: 'Stade de carrière', value: CAREER_STAGE_LABELS[contact.researchCareerStage] },
    { label: 'Pays d\'origine', value: contact.countryOfOrigin || '—' },
    { label: 'Ville', value: contact.city || '—' }
  ];

  const riFields: { label: string; value: string }[] = [
    { label: 'Affiliation', value: contact.affiliation || '—' },
    { label: 'Fonction', value: contact.function || '—' },
    { label: 'Expérience', value: contact.experience || '—' },
    { label: 'Faculté / Département', value: contact.facultyDepartment || '—' }
  ];

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-6 space-y-6 animate-fade-in">

      {/* Toast Notification for Share Link */}
      {copiedToast && (
        <div className="fixed top-20 right-8 z-50 bg-[#005596] text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 text-xs font-bold animate-bounce">
          <Check className="w-4 h-4" /> Lien du profil copié dans le presse-papier !
        </div>
      )}

      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-xs text-[#55636B] font-medium">
        <Link to="/contacts" className="hover:text-[#005596] transition-colors">
          Base de données
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        <Link to="/contacts" className="hover:text-[#005596] transition-colors">
          Chercheurs & Experts
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-[#005596] font-bold">{contact.name}</span>
      </nav>

      {/* Profile Header Card */}
      <section className="bg-white rounded-2xl p-6 sm:p-8 border border-[#C9D4DE]/40 shadow-[0_6px_18px_rgba(0,0,0,0.06)]">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">

          <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-4 sm:gap-6 w-full md:w-auto">
            <div className="relative shrink-0">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden border-4 border-[#BCD7EE] ring-4 ring-[#005596]/10 bg-slate-100 flex items-center justify-center font-bold text-2xl text-[#005596]">
                {contact.avatarUrl ? (
                  <img src={contact.avatarUrl} alt={contact.name} className="w-full h-full object-cover" />
                ) : (
                  contact.initials
                )}
              </div>
              {contact.isVerified && (
                <div className="absolute bottom-1 right-1 bg-[#005596] text-white p-1 rounded-full border-2 border-white" title="Compte Vérifié EURAXESS Africa">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              )}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2.5 mb-1">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1C2529]">
                  {contact.name}
                </h1>
                {contact.affiliation && (
                  <span className="bg-[#BCD7EE] text-[#005596] px-3 py-0.5 rounded-full text-xs font-bold flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5" />
                    {contact.affiliation}
                  </span>
                )}
              </div>

              {contact.function && (
                <p className="text-sm font-medium text-[#55636B] mb-3">
                  {contact.function}
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                {contact.tags.slice(0, 4).map((tName, idx) => (
                  <span key={idx} className="bg-[#E8F1F8] text-[#005596] px-3 py-1 rounded-lg text-xs font-bold">
                    {tName}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <Link
              to={`/contacts/${contact.id}/edit`}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 border-2 border-[#005596] text-[#005596] hover:bg-[#E8F1F8] font-bold text-xs rounded-xl transition-all active:scale-95 cursor-pointer"
            >
              <Edit3 className="w-4 h-4" />
              Modifier
            </Link>
            <button
              onClick={handleShare}
              className="flex items-center justify-center bg-[#005596] hover:bg-[#004275] text-white p-2.5 rounded-xl shadow-md transition-all active:scale-95"
              title="Partager la fiche"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>

        </div>
      </section>

      {/* Main Grid */}
      <div className="grid grid-cols-12 gap-6">

        {/* Left Column: Quick Info & Identity */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">

          {/* Coordonnées Card */}
          <div className="bg-white rounded-2xl p-6 border border-[#C9D4DE]/40 shadow-[0_6px_18px_rgba(0,0,0,0.06)]">
            <h3 className="text-base font-bold text-[#005596] mb-4 flex items-center gap-2">
              <Mail className="w-5 h-5 text-[#005596]" /> Coordonnées
            </h3>
            <ul className="space-y-4 text-xs">
              <li className="flex items-start gap-3 group">
                <div className="bg-[#E8F1F8] p-2 rounded-lg text-[#005596] group-hover:bg-[#005596] group-hover:text-white transition-colors">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-[#55636B]">Email</p>
                  <a href={`mailto:${contact.email}`} className="font-semibold text-[#1C2529] hover:text-[#005596] transition-colors break-all">
                    {contact.email}
                  </a>
                </div>
              </li>

              <li className="flex items-start gap-3 group">
                <div className="bg-[#E8F1F8] p-2 rounded-lg text-[#005596] group-hover:bg-[#005596] group-hover:text-white transition-colors">
                  <Phone className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-[#55636B]">Téléphone</p>
                  <p className="font-semibold text-[#1C2529]">{contact.phone || '—'}</p>
                </div>
              </li>

              <li className="flex items-start gap-3 group">
                <div className="bg-[#E8F1F8] p-2 rounded-lg text-[#005596] group-hover:bg-[#005596] group-hover:text-white transition-colors">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-[#55636B]">Localisation</p>
                  <p className="font-semibold text-[#1C2529]">
                    {[contact.countryOfOrigin, contact.city].filter(Boolean).join(', ') || '—'}
                  </p>
                </div>
              </li>
            </ul>
          </div>

          {/* Identité & Carrière Card */}
          <div className="bg-white rounded-2xl p-6 border border-[#C9D4DE]/40 shadow-[0_6px_18px_rgba(0,0,0,0.06)]">
            <h3 className="text-base font-bold text-[#005596] mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-[#005596]" /> Identité & Carrière
            </h3>
            <div className="space-y-3 text-xs">
              {identityFields.map(f => (
                <div key={f.label}>
                  <p className="text-[11px] font-bold text-[#55636B] uppercase tracking-wider mb-0.5">{f.label}</p>
                  <p className="font-semibold text-[#1C2529]">{f.value}</p>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Right Column: R&I Info & Timeline */}
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">

          {/* Affiliation R&I */}
          <section className="bg-white rounded-2xl p-6 border border-[#C9D4DE]/40 shadow-[0_6px_18px_rgba(0,0,0,0.06)]">
            <h3 className="text-base font-bold text-[#1C2529] mb-4 flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-[#005596]" /> Affiliation R&I
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {riFields.map(f => (
                <div key={f.label} className="bg-[#F4F6F8] rounded-xl p-3.5 border border-[#C9D4DE]/30">
                  <p className="text-[11px] font-bold text-[#005596] uppercase tracking-wider mb-1">{f.label}</p>
                  <p className="font-semibold text-[#1C2529] text-xs">{f.value}</p>
                </div>
              ))}
            </div>

            {/* Tags */}
            <div className="mt-5 pt-4 border-t border-[#C9D4DE]/40">
              <p className="text-[11px] font-bold text-[#55636B] uppercase tracking-wider mb-2">Étiquettes / Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {contact.tags.length > 0 ? (
                  contact.tags.map((tName, idx) => (
                    <span key={idx} className="bg-[#E8F1F8] text-[#004275] px-2.5 py-1 rounded-full font-bold text-[11px]">
                      {tName}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-400 italic">Aucun tag attribué</span>
                )}
              </div>
            </div>
          </section>

          {/* Interaction Memory (Timeline) */}
          <section className="bg-white rounded-2xl p-6 border border-[#C9D4DE]/40 shadow-[0_6px_18px_rgba(0,0,0,0.06)] flex-1">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-base font-bold text-[#1C2529] flex items-center gap-2">
                <History className="w-5 h-5 text-[#005596]" /> Mémoire des Échanges
              </h3>

              <button
                onClick={() => setQuickNoteModalOpen(true)}
                className="text-[#005596] font-bold text-xs flex items-center gap-1 hover:underline cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" /> Note rapide
              </button>
            </div>

            {/* Timeline Tree */}
            <div className="space-y-6 relative pl-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-[#D9E6F2]">
              {contact.exchangeNotes.length === 0 && (
                <p className="text-xs text-slate-400 italic">Aucun échange documenté pour le moment.</p>
              )}
              {contact.exchangeNotes.map((note) => (
                <div key={note.id} className="relative">
                  {/* Circle Marker */}
                  <div className="absolute -left-[31px] top-0 w-6 h-6 bg-white border-2 border-[#005596] rounded-full flex items-center justify-center z-10 text-[#005596]">
                    <MessageSquare className="w-3 h-3" />
                  </div>

                  <div className="bg-[#E8F1F8]/30 p-4 rounded-xl border border-[#C9D4DE]/30">
                    <div className="flex justify-between items-center mb-1">
                      <p className="font-bold text-xs text-[#1C2529]">{note.title}</p>
                      <span className="text-[11px] text-[#55636B] italic">{note.relativeTime || note.date}</span>
                    </div>

                    <p className="text-xs text-[#55636B] leading-relaxed">
                      {note.content}
                    </p>

                    {note.author && (
                      <div className="mt-3 flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-[#005596] text-white flex items-center justify-center text-[9px] font-bold">
                          {note.authorInitials || 'LM'}
                        </div>
                        <span className="text-[11px] font-medium text-[#55636B]">{note.author}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <button className="w-full mt-6 py-3 border-2 border-dashed border-[#C9D4DE] rounded-xl text-[#55636B] font-bold text-xs hover:bg-[#E8F1F8] transition-colors cursor-pointer">
              Charger l'historique complet
            </button>
          </section>

        </div>

      </div>

      {/* Quick Note Modal */}
      {quickNoteModalOpen && (
        <Modal
          open={quickNoteModalOpen}
          onClose={() => setQuickNoteModalOpen(false)}
          maxWidth="max-w-md"
          title={<h3 className="font-bold text-base text-[#1C2529]">Ajouter une note d'échange</h3>}
        >
          <form onSubmit={handleCreateNote} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-[#55636B] mb-1">Type d'échange</label>
                <select
                  value={newNoteType}
                  onChange={(e) => setNewNoteType(e.target.value as any)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-[#005596]"
                >
                  <option value="meeting">Réunion / Visioconférence</option>
                  <option value="email">Courrier Électronique</option>
                  <option value="call">Appel Téléphonique</option>
                  <option value="note">Note interne</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#55636B] mb-1">Titre de la note</label>
                <input
                  type="text"
                  value={newNoteTitle}
                  onChange={(e) => setNewNoteTitle(e.target.value)}
                  placeholder="Ex: Réunion de cadrage Horizon-Health"
                  className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-[#005596]"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-[#55636B] mb-1">Contenu / Résumé</label>
                <textarea
                  rows={4}
                  value={newNoteContent}
                  onChange={(e) => setNewNoteContent(e.target.value)}
                  placeholder="Compte-rendu succinct de l'échange..."
                  className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-[#005596] resize-none"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setQuickNoteModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#005596] hover:bg-[#004275] text-white rounded-xl font-bold shadow cursor-pointer"
                >
                  Enregistrer
                </button>
              </div>
            </form>
        </Modal>
      )}

    </div>
  );
};
