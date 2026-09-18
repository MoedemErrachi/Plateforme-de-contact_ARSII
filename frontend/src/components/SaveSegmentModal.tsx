import React from 'react';
import { FilterState, Gender, ResearchCareerStage, GENDER_LABELS, CAREER_STAGE_SHORT_LABELS } from '../types';
import { isEmptyFilterState } from '../utils/contactQuery';
import { Modal } from './Modal';
import { Bookmark } from 'lucide-react';

interface SaveSegmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  pendingFilters: FilterState;
  segmentNameInput: string;
  onSegmentNameInputChange: (value: string) => void;
  onSubmit: (e: React.SubmitEvent<HTMLFormElement>) => void;
}

export const SaveSegmentModal: React.FC<SaveSegmentModalProps> = ({
  isOpen,
  onClose,
  pendingFilters,
  segmentNameInput,
  onSegmentNameInputChange,
  onSubmit
}) => (
  <Modal
    open={isOpen}
    onClose={onClose}
    maxWidth="max-w-md"
    title={
      <div className="flex items-center gap-2">
        <Bookmark className="w-5 h-5 text-[#005596]" />
        <h3 className="font-extrabold text-base text-[#1C2529]">
          Enregistrer les filtres comme segment
        </h3>
      </div>
    }
  >
    <form onSubmit={onSubmit} className="space-y-4 text-xs">
      <div>
        <label htmlFor="segment-name" className="font-bold text-slate-700 block mb-1">Nom du Segment *</label>
        <input
          id="segment-name"
          type="text"
          required
          value={segmentNameInput}
          onChange={(e) => onSegmentNameInputChange(e.target.value)}
          placeholder="ex: Experts Santé Afrique 2024"
          className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#005596] font-semibold text-[#1C2529]"
        />
      </div>

      <div className="bg-[#E8F1F8]/50 p-3.5 rounded-xl border border-[#C9D4DE]/30 text-slate-600">
        <p className="font-bold text-[#005596] mb-1.5 text-xs">Filtres sélectionnés:</p>
        <ul className="list-disc list-inside space-y-1 text-[11px] font-medium">
          {pendingFilters.search && <li>Recherche: "{pendingFilters.search}"</li>}
          {pendingFilters.countries.length > 0 && <li>Pays d'origine: {pendingFilters.countries.join(', ')}</li>}
          {pendingFilters.genders.length > 0 && <li>Genres: {pendingFilters.genders.map(g => GENDER_LABELS[g as Gender]).join(', ')}</li>}
          {pendingFilters.careerStages.length > 0 && <li>Stades de carrière: {pendingFilters.careerStages.map(s => CAREER_STAGE_SHORT_LABELS[s as ResearchCareerStage]).join(', ')}</li>}
          {pendingFilters.tags.length > 0 && <li>Tags: {pendingFilters.tags.join(', ')}</li>}
          {isEmptyFilterState(pendingFilters) && (
            <li className="italic text-slate-500">Tous les contacts (aucun filtre restreint)</li>
          )}
        </ul>
      </div>

      <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors cursor-pointer"
        >
          Annuler
        </button>
        <button
          type="submit"
          className="px-5 py-2 bg-[#005596] hover:bg-[#004275] text-white font-bold rounded-xl shadow transition-all active:scale-95 cursor-pointer"
        >
          Enregistrer
        </button>
      </div>
    </form>
  </Modal>
);
