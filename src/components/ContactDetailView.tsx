import React, { useState } from 'react';
import { Contact, ViewPage, ExchangeNote } from '../types';
import { 
  ChevronRight, 
  CheckCircle2, 
  Building2, 
  Edit3, 
  Share2, 
  Mail, 
  Phone, 
  Linkedin, 
  Globe, 
  FolderGit2, 
  History, 
  PlusCircle, 
  MessageSquare, 
  ArrowRight, 
  Check, 
  X,
  FileText,
  Copy
} from 'lucide-react';

interface ContactDetailViewProps {
  contact: Contact;
  onNavigate: (page: ViewPage) => void;
  onAddNote: (contactId: string, note: Omit<ExchangeNote, 'id'>) => void;
  onEditContact?: (contact: Contact) => void;
}

export const ContactDetailView: React.FC<ContactDetailViewProps> = ({
  contact,
  onNavigate,
  onAddNote,
  onEditContact
}) => {
  const [quickNoteModalOpen, setQuickNoteModalOpen] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newNoteType, setNewNoteType] = useState<'meeting' | 'email' | 'call' | 'note'>('meeting');
  const [copiedToast, setCopiedToast] = useState(false);

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

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-6 space-y-6 animate-fade-in">
      
      {/* Toast Notification for Share Link */}
      {copiedToast && (
        <div className="fixed top-20 right-8 z-50 bg-[#006a66] text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 text-xs font-bold animate-bounce">
          <Check className="w-4 h-4" /> Lien du profil copié dans le presse-papier !
        </div>
      )}

      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-xs text-[#3d4948] font-medium">
        <button onClick={() => onNavigate('contacts')} className="hover:text-[#006a66] transition-colors">
          Base de données
        </button>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        <button onClick={() => onNavigate('contacts')} className="hover:text-[#006a66] transition-colors">
          Chercheurs & Experts
        </button>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-[#006a66] font-bold">{contact.name}</span>
      </nav>

      {/* Profile Header Card */}
      <section className="bg-white rounded-2xl p-6 sm:p-8 border border-[#bcc9c7]/40 shadow-[0_6px_18px_rgba(0,0,0,0.06)]">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          
          <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-4 sm:gap-6 w-full md:w-auto">
            <div className="relative shrink-0">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden border-4 border-[#abece7] ring-4 ring-[#35b8b2]/10 bg-slate-100 flex items-center justify-center font-bold text-2xl text-[#006a66]">
                {contact.avatarUrl ? (
                  <img src={contact.avatarUrl} alt={contact.name} className="w-full h-full object-cover" />
                ) : (
                  contact.initials
                )}
              </div>
              {contact.isVerified && (
                <div className="absolute bottom-1 right-1 bg-[#006a66] text-white p-1 rounded-full border-2 border-white" title="Compte Vérifié ARSII">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              )}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2.5 mb-1">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-[#071f1f]">
                  {contact.name}
                </h1>
                <span className="bg-[#abece7] text-[#2b6c6a] px-3 py-0.5 rounded-full text-xs font-bold flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5" />
                  {contact.organization}
                </span>
              </div>

              <p className="text-sm font-medium text-[#3d4948] mb-3">
                {contact.title}
              </p>

              <div className="flex flex-wrap gap-2">
                {contact.expertise.slice(0, 3).map((tag, idx) => (
                  <span key={idx} className="bg-[#d3eded] text-[#006a66] px-3 py-1 rounded-lg text-xs font-bold">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <button
              onClick={() => {
                if (onEditContact) {
                  onEditContact(contact);
                } else {
                  onNavigate('new-contact');
                }
              }}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 border-2 border-[#006a66] text-[#006a66] hover:bg-[#dff9f8] font-bold text-xs rounded-xl transition-all active:scale-95 cursor-pointer"
            >
              <Edit3 className="w-4 h-4" />
              Modifier
            </button>
            <button
              onClick={handleShare}
              className="flex items-center justify-center bg-[#006a66] hover:bg-[#256865] text-white p-2.5 rounded-xl shadow-md transition-all active:scale-95"
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
          <div className="bg-white rounded-2xl p-6 border border-[#bcc9c7]/40 shadow-[0_6px_18px_rgba(0,0,0,0.06)]">
            <h3 className="text-base font-bold text-[#006a66] mb-4 flex items-center gap-2">
              <Mail className="w-5 h-5 text-[#006a66]" /> Coordonnées
            </h3>
            <ul className="space-y-4 text-xs">
              <li className="flex items-start gap-3 group">
                <div className="bg-[#d9f3f2] p-2 rounded-lg text-[#006a66] group-hover:bg-[#35b8b2] group-hover:text-white transition-colors">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-[#3d4948]">Email</p>
                  <a href={`mailto:${contact.email}`} className="font-semibold text-[#071f1f] hover:text-[#006a66] transition-colors break-all">
                    {contact.email}
                  </a>
                </div>
              </li>

              <li className="flex items-start gap-3 group">
                <div className="bg-[#d9f3f2] p-2 rounded-lg text-[#006a66] group-hover:bg-[#35b8b2] group-hover:text-white transition-colors">
                  <Phone className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-[#3d4948]">Téléphone</p>
                  <p className="font-semibold text-[#071f1f]">{contact.phone}</p>
                </div>
              </li>

              {contact.linkedin && (
                <li className="flex items-start gap-3 group">
                  <div className="bg-[#d9f3f2] p-2 rounded-lg text-[#006a66] group-hover:bg-[#35b8b2] group-hover:text-white transition-colors">
                    <Linkedin className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-[#3d4948]">LinkedIn</p>
                    <a href={`https://${contact.linkedin}`} target="_blank" rel="noreferrer" className="font-semibold text-[#071f1f] hover:text-[#006a66] transition-colors">
                      {contact.linkedin}
                    </a>
                  </div>
                </li>
              )}
            </ul>
          </div>

          {/* Profil R&I Card */}
          <div className="bg-white rounded-2xl p-6 border border-[#bcc9c7]/40 shadow-[0_6px_18px_rgba(0,0,0,0.06)]">
            <h3 className="text-base font-bold text-[#006a66] mb-4 flex items-center gap-2">
              <Globe className="w-5 h-5 text-[#006a66]" /> Profil R&I
            </h3>

            <div className="space-y-4 text-xs">
              <div>
                <p className="text-[11px] font-bold text-[#3d4948] uppercase tracking-wider mb-1.5">
                  Siège (HQ)
                </p>
                <div className="flex items-center gap-2 font-semibold text-[#071f1f]">
                  <span className="text-lg">{contact.flagEmoji || '🌍'}</span>
                  {contact.country}
                </div>
              </div>

              <div>
                <p className="text-[11px] font-bold text-[#3d4948] uppercase tracking-wider mb-1.5">
                  Zone d'intervention
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {contact.interventionZones.map((z, idx) => (
                    <span key={idx} className="bg-[#d9f3f2] text-[#256865] px-2.5 py-1 rounded-full font-bold text-[11px]">
                      {z}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[11px] font-bold text-[#3d4948] uppercase tracking-wider mb-1.5">
                  Expertise
                </p>
                <ul className="space-y-1.5">
                  {contact.expertise.map((exp, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-[#071f1f] font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#006a66]" />
                      {exp}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

        </div>

        {/* Right Column: Projects & Timeline */}
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
          
          {/* Affiliated Projects */}
          <section>
            <h3 className="text-base font-bold text-[#071f1f] mb-3 flex items-center gap-2">
              <FolderGit2 className="w-5 h-5 text-[#006a66]" /> Projets Affiliés
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {contact.projects.map((proj) => (
                <div 
                  key={proj.id}
                  className="group bg-white p-5 rounded-2xl border border-[#bcc9c7]/40 hover:border-[#006a66] hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <span className="bg-[#35b8b2]/10 text-[#006a66] px-2.5 py-0.5 rounded-md font-bold text-[11px]">
                        {proj.sector}
                      </span>
                      <span className="text-[11px] font-medium text-[#3d4948]">{proj.period}</span>
                    </div>

                    <h4 className="font-bold text-[#071f1f] group-hover:text-[#006a66] transition-colors mb-1">
                      {proj.title}
                    </h4>
                    <p className="text-xs text-[#3d4948] line-clamp-2">
                      {proj.description}
                    </p>
                  </div>

                  <div className="mt-4 pt-2 border-t border-slate-100 flex items-center text-[#006a66] font-bold text-xs">
                    Voir les détails <ArrowRight className="w-3.5 h-3.5 ml-1 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Interaction Memory (Timeline) */}
          <section className="bg-white rounded-2xl p-6 border border-[#bcc9c7]/40 shadow-[0_6px_18px_rgba(0,0,0,0.06)] flex-1">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-base font-bold text-[#071f1f] flex items-center gap-2">
                <History className="w-5 h-5 text-[#006a66]" /> Mémoire des Échanges
              </h3>

              <button
                onClick={() => setQuickNoteModalOpen(true)}
                className="text-[#006a66] font-bold text-xs flex items-center gap-1 hover:underline"
              >
                <PlusCircle className="w-4 h-4" /> Note rapide
              </button>
            </div>

            {/* Timeline Tree */}
            <div className="space-y-6 relative pl-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-[#cee8e7]">
              {contact.exchangeNotes.map((note) => (
                <div key={note.id} className="relative">
                  {/* Circle Marker */}
                  <div className="absolute -left-[31px] top-0 w-6 h-6 bg-white border-2 border-[#006a66] rounded-full flex items-center justify-center z-10 text-[#006a66]">
                    <MessageSquare className="w-3 h-3" />
                  </div>

                  <div className="bg-[#dff9f8]/30 p-4 rounded-xl border border-[#bcc9c7]/30">
                    <div className="flex justify-between items-center mb-1">
                      <p className="font-bold text-xs text-[#071f1f]">{note.title}</p>
                      <span className="text-[11px] text-[#3d4948] italic">{note.relativeTime || note.date}</span>
                    </div>

                    <p className="text-xs text-[#3d4948] leading-relaxed">
                      {note.content}
                    </p>

                    {note.author && (
                      <div className="mt-3 flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-[#35b8b2] text-white flex items-center justify-center text-[9px] font-bold">
                          {note.authorInitials || 'LM'}
                        </div>
                        <span className="text-[11px] font-medium text-[#3d4948]">{note.author}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <button className="w-full mt-6 py-3 border-2 border-dashed border-[#bcc9c7] rounded-xl text-[#3d4948] font-bold text-xs hover:bg-[#dff9f8] transition-colors">
              Charger l'historique complet
            </button>
          </section>

        </div>

      </div>

      {/* Quick Note Modal */}
      {quickNoteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4 animate-scale-up">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-[#071f1f]">Ajouter une note d'échange</h3>
              <button onClick={() => setQuickNoteModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateNote} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-[#3d4948] mb-1">Type d'échange</label>
                <select
                  value={newNoteType}
                  onChange={(e) => setNewNoteType(e.target.value as any)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-[#006a66]"
                >
                  <option value="meeting">Réunion / Visioconférence</option>
                  <option value="email">Courrier Électronique</option>
                  <option value="call">Appel Téléphonique</option>
                  <option value="note">Note interne</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#3d4948] mb-1">Titre de la note</label>
                <input 
                  type="text"
                  value={newNoteTitle}
                  onChange={(e) => setNewNoteTitle(e.target.value)}
                  placeholder="Ex: Réunion de cadrage Horizon-Health"
                  className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-[#006a66]"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-[#3d4948] mb-1">Contenu / Résumé</label>
                <textarea 
                  rows={4}
                  value={newNoteContent}
                  onChange={(e) => setNewNoteContent(e.target.value)}
                  placeholder="Compte-rendu succinct de l'échange..."
                  className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-[#006a66] resize-none"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setQuickNoteModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl font-bold hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#006a66] hover:bg-[#256865] text-white rounded-xl font-bold shadow"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
