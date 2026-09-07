import React from 'react';
import { Link } from 'react-router-dom';
import { Contact, CAREER_STAGE_LABELS, GENDER_LABELS } from '../types';
import { formatFieldValue } from '../utils/formatFieldValue';
import { Modal } from './Modal';
import { X, Edit, Mail, Phone, Globe, Users } from 'lucide-react';

interface ContactsProfileDrawerProps {
  contact: Contact;
  getTagBadgeStyle: (tagName: string) => string;
  onNavigateToDetail: (id: string) => void;
  onClose: () => void;
}

export const ContactsProfileDrawer: React.FC<ContactsProfileDrawerProps> = ({
  contact,
  getTagBadgeStyle,
  onNavigateToDetail,
  onClose
}) => (
  <Modal open={true} onClose={onClose} variant="drawer" noPadding>
    <div className="p-6 flex flex-col justify-between min-h-full cursor-default">
      <div>
        <div className="flex justify-between items-start mb-6">
          <div className="flex flex-col items-center text-center w-full">
            <div className="w-24 h-24 rounded-full bg-[#005596]/20 p-1 mb-3 relative">
              {contact.avatarUrl ? (
                <img src={contact.avatarUrl} alt={contact.name} className="w-full h-full object-cover rounded-full" />
              ) : (
                <div className="w-full h-full rounded-full bg-[#005596] text-white flex items-center justify-center font-bold text-xl">
                  {contact.initials}
                </div>
              )}
            </div>
            <h2 className="text-xl font-bold text-[#1C2529]">{contact.name}</h2>
            <p className="text-xs text-[#005596] font-bold mt-0.5">{formatFieldValue(contact.function)}</p>
            <p className="text-xs text-[#55636B]">{formatFieldValue(contact.affiliation)}</p>
            <span className="inline-block mt-2 px-2.5 py-1 bg-[#D9E6F2] text-[#005596] rounded-full text-[11px] font-bold">
              {CAREER_STAGE_LABELS[contact.researchCareerStage]}
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 hover:bg-[#E8F1F8] rounded-full text-slate-500 transition-colors absolute right-4 top-4"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6">
          <section className="bg-[#E8F1F8]/50 p-4 rounded-xl">
            <h3 className="text-xs font-bold text-[#005596] uppercase tracking-wider mb-3">Coordonnées</h3>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-3 text-[#55636B]">
                <Mail className="w-4 h-4 text-[#005596]" />
                <span>{contact.email}</span>
              </div>
              <div className="flex items-center gap-3 text-[#55636B]">
                <Phone className="w-4 h-4 text-[#005596]" />
                <span>{formatFieldValue(contact.phone)}</span>
              </div>
              <div className="flex items-center gap-3 text-[#55636B]">
                <Globe className="w-4 h-4 text-[#005596]" />
                <span>Pays: {formatFieldValue(contact.countryOfOrigin)}{contact.city?.trim() ? ` · ${contact.city}` : ''}</span>
              </div>
              <div className="flex items-center gap-3 text-[#55636B]">
                <Users className="w-4 h-4 text-[#005596]" />
                <span>Genre: {GENDER_LABELS[contact.gender]}</span>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-xs font-bold text-[#1C2529] mb-2 flex items-center justify-between">
              <span>Étiquettes / Tags</span>
              <Link
                to="/segments"
                onClick={onClose}
                className="text-[11px] text-[#005596] hover:underline font-bold"
              >
                Gérer
              </Link>
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {contact.tags && contact.tags.length > 0 ? (
                contact.tags.map((tName) => (
                  <span key={tName} className={`px-2.5 py-1 rounded-full text-xs font-extrabold border ${getTagBadgeStyle(tName)}`}>
                    {tName}
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-400 italic">Aucun tag attribué</span>
              )}
            </div>
          </section>

          <section>
            <h3 className="text-xs font-bold text-[#1C2529] mb-3">Profil R&I</h3>
            <div className="space-y-2 text-xs text-[#55636B] bg-[#F4F6F8] p-4 rounded-xl border border-[#C9D4DE]/40">
              <div className="flex justify-between gap-2">
                <span className="font-bold text-[#1C2529]">Stade de carrière:</span>
                <span className="text-right">{CAREER_STAGE_LABELS[contact.researchCareerStage]}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="font-bold text-[#1C2529]">Expérience:</span>
                <span className="text-right">{formatFieldValue(contact.experience)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="font-bold text-[#1C2529]">Faculté / Dépt:</span>
                <span className="text-right">{formatFieldValue(contact.facultyDepartment)}</span>
              </div>
            </div>
          </section>
        </div>
      </div>

      <div className="pt-6 border-t border-[#C9D4DE] mt-6 flex gap-2">
        <Link
          to={`/contacts/${contact.id}/edit`}
          onClick={onClose}
          className="px-4 py-3 bg-[#BCD7EE] text-[#005596] hover:bg-[#3F88C4] font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
        >
          <Edit className="w-4 h-4" />
          Modifier
        </Link>
        <button
          onClick={() => onNavigateToDetail(contact.id)}
          className="flex-1 py-3 bg-[#005596] hover:bg-[#004275] text-white font-bold text-xs rounded-xl shadow transition-all active:scale-95 cursor-pointer"
        >
          Voir la fiche complète
        </button>
      </div>
    </div>
  </Modal>
);
