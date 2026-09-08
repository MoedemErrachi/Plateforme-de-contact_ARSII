import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Contact, FilterState, Segment, Tag as TagType, User as UserType, Gender, ResearchCareerStage, ContactSelection, PaginationInfo, GENDER_LABELS, CAREER_STAGE_LABELS, CAREER_STAGE_SHORT_LABELS, ContactSortBy, ContactSortOrder } from '../types';
import { apiFetch } from '../services/api';
import { mapContactFromApi } from '../utils/mapContact';
import { buildContactsListQuery, emptyFilterState, isEmptyFilterState } from '../utils/contactQuery';
import { formatFieldValue } from '../utils/formatFieldValue';
import { canCreate, canEdit, canDelete } from '../utils/privileges';
import { Pagination } from './Pagination';
import { ContactsProfileDrawer } from './ContactsProfileDrawer';
import { SaveSegmentModal } from './SaveSegmentModal';
import { 
  Search, 
  SlidersHorizontal, 
  Save,
  Globe, 
  Users, 
  Bookmark, 
  UserPlus, 
  Flag, 
  Edit, 
  Trash2, 
  ChevronLeft, 
  ChevronRight, 
  X, 
  Download, 
  Tag as TagIcon, 
  ExternalLink,
  RotateCcw,
  RotateCw,
  Check
} from 'lucide-react';
import { ContactsTableSkeleton } from './Skeletons';

const GENDERS: Gender[] = ['FEMALE', 'MALE', 'NOT_SPECIFIED'];
const ALL_CAREER_STAGES: ResearchCareerStage[] = ['R1_FIRST_STAGE', 'R2_RECOGNIZED', 'R3_ESTABLISHED', 'R4_LEADING'];

const getCareerStageClass = (stage: string): string => {
  switch (stage) {
    case 'R1_FIRST_STAGE': return 'bg-slate-100 text-[#55636B]';
    case 'R2_RECOGNIZED': return 'bg-[#005596]/10 text-[#005596]';
    case 'R3_ESTABLISHED': return 'bg-[#B8167C]/10 text-[#B8167C]';
    default: return 'bg-[#FFC20C]/20 text-[#8a6d00]';
  }
};

const getTagBadgeStyle = (tagName: string, tags: TagType[]): string => {
  const found = tags.find(t => t.name.toLowerCase() === tagName.toLowerCase());
  if (found?.color) return found.color;
  return 'bg-slate-100 text-slate-700 border-slate-200';
};

const renderSortIndicator = (column: ContactSortBy, sortBy: ContactSortBy | null, sortOrder: ContactSortOrder) => {
  if (sortBy !== column) {
    return <span className="text-[10px] leading-none text-slate-300">▼</span>;
  }
  return (
    <span className={`text-[10px] leading-none text-[#005596] ${sortOrder === 'asc' ? '' : 'rotate-180 inline-block'}`}>▼</span>
  );
};

interface SidebarBackdropProps { onClose: () => void; }

const SidebarBackdrop: React.FC<SidebarBackdropProps> = ({ onClose }) => (
  <div /* NOSONAR */
    onClick={onClose}
    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClose(); }}
    role="button"
    aria-label="Fermer les filtres"
    tabIndex={-1}
    className="lg:hidden fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-40 animate-in fade-in duration-200"
  />
);

interface SidebarFiltersProps {
  filters: FilterState;
  countries: string[];
  tags: TagType[];
  loading: boolean;
  handlers: {
    onToggleCountry: (c: string) => void;
    onToggleGender: (g: Gender) => void;
    onToggleCareerStage: (s: ResearchCareerStage) => void;
    onToggleTag: (t: string) => void;
    onApply: () => void;
    onSaveSegment: () => void;
    onReset: () => void;
    onClose: () => void;
  };
}

const SidebarFilters: React.FC<SidebarFiltersProps> = ({ filters, countries, tags, loading, handlers }) => (
  <div className="space-y-5">
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-lg font-bold text-[#005596]">Filtres</h2>
        <p className="text-[10px] font-bold text-[#55636B] uppercase tracking-wider">
          Sélectionnez vos critères
        </p>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => {
            handlers.onReset();
            handlers.onClose();
          }}
          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200/60 hover:text-[#005596] transition-colors cursor-pointer"
          title="Réinitialiser les filtres"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <button
          onClick={handlers.onClose}
          className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-200/60 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>

    <div className="space-y-5">
      <section>
        <label className="text-xs font-bold text-[#55636B] flex items-center gap-1.5 mb-2">
          <Globe className="w-4 h-4 text-[#005596]" /> Pays d'origine
          {filters.countries.length > 0 && (
            <span className="ml-auto text-[10px] font-bold text-[#005596] bg-[#E8F1F8] px-1.5 py-0.5 rounded-full">{filters.countries.length}</span>
          )}
        </label>
        <div className="space-y-2 bg-white/60 p-3 rounded-xl border border-[#C9D4DE]/40 max-h-48 overflow-y-auto">
          {countries.length === 0 && (
            <span className="text-[11px] text-slate-400 italic">Aucun pays renseigné</span>
          )}
          {countries.map(country => {
            const checked = filters.countries.includes(country);
            return (
              <label key={country} className="flex items-center gap-2 cursor-pointer text-xs text-[#1C2529] hover:text-[#005596]">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => handlers.onToggleCountry(country)}
                  className="rounded border-[#C9D4DE] text-[#005596] focus:ring-[#005596] w-4 h-4 cursor-pointer"
                />
                <span className={checked ? 'font-bold text-[#005596]' : 'font-medium'}>{country}</span>
              </label>
            );
          })}
        </div>
      </section>

      <section>
        <label className="text-xs font-bold text-[#55636B] flex items-center gap-1.5 mb-2">
          <Users className="w-4 h-4 text-[#005596]" /> Genre
        </label>
        <div className="space-y-2 bg-white/60 p-3 rounded-xl border border-[#C9D4DE]/40">
          {GENDERS.map(gender => {
            const checked = filters.genders.includes(gender);
            return (
              <label key={gender} className="flex items-center gap-2 cursor-pointer text-xs text-[#1C2529] hover:text-[#005596]">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => handlers.onToggleGender(gender)}
                  className="rounded border-[#C9D4DE] text-[#005596] focus:ring-[#005596] w-4 h-4 cursor-pointer"
                />
                <span className={checked ? 'font-bold text-[#005596]' : 'font-medium'}>{GENDER_LABELS[gender as Gender]}</span>
              </label>
            );
          })}
        </div>
      </section>

      <section>
        <label className="text-xs font-bold text-[#55636B] flex items-center gap-1.5 mb-2">
          <Bookmark className="w-4 h-4 text-[#005596]" /> Stade de carrière
        </label>
        <div className="space-y-2 bg-white/60 p-3 rounded-xl border border-[#C9D4DE]/40">
          {ALL_CAREER_STAGES.map(stage => {
            const checked = filters.careerStages.includes(stage);
            return (
              <label key={stage} className="flex items-center gap-2 cursor-pointer text-xs text-[#1C2529] hover:text-[#005596]">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => handlers.onToggleCareerStage(stage)}
                  className="rounded border-[#C9D4DE] text-[#005596] focus:ring-[#005596] w-4 h-4 cursor-pointer"
                />
                <span className={checked ? 'font-bold text-[#005596]' : 'font-medium'}>{CAREER_STAGE_SHORT_LABELS[stage as ResearchCareerStage]}</span>
              </label>
            );
          })}
        </div>
      </section>

      <section>
        <label className="text-xs font-bold text-[#55636B] flex items-center gap-1.5 mb-2">
          <TagIcon className="w-4 h-4 text-[#005596]" /> Étiquettes / Tags
        </label>
        <div className="flex flex-wrap gap-1.5">
          {tags.map(t => {
            const active = filters.tags.includes(t.name);
            return (
              <button
                key={t.id}
                onClick={() => handlers.onToggleTag(t.name)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                  active
                    ? 'bg-[#005596] text-white border-[#005596] shadow'
                    : `${t.color || 'bg-slate-100'} hover:opacity-90`
                }`}
              >
                {t.name}
              </button>
            );
          })}
        </div>
      </section>
    </div>

    <div className="pt-4 border-t border-[#C9D4DE] space-y-2.5">
      <button
        onClick={handlers.onApply}
        disabled={loading}
        className="w-full py-2.5 px-4 bg-[#005596] hover:bg-[#004275] text-white rounded-2xl text-xs font-extrabold flex items-center justify-start gap-3 transition-all active:scale-95 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
        title="Appliquer les filtres sélectionnés au répertoire"
      >
        {loading ? (
          <>
            <RotateCw className="w-4 h-4 text-white animate-spin" />
            <span>Filtrage…</span>
          </>
        ) : (
          <>
            <Search className="w-4 h-4 text-white stroke-[2.5]" />
            <span>Appliquer les filtres</span>
          </>
        )}
      </button>
      <button
        onClick={handlers.onSaveSegment}
        disabled={isEmptyFilterState(filters)}
        className="w-full py-2.5 px-4 bg-[#E8F1F8] hover:bg-[#D9E6F2] text-[#004275] rounded-2xl text-xs font-extrabold flex items-center justify-start gap-3 transition-all active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#E8F1F8]"
        title={
          isEmptyFilterState(filters)
            ? 'Sélectionnez d\u2019abord des filtres pour créer un segment'
            : 'Enregistrer les filtres sélectionnés comme nouveau segment'
        }
      >
        <Save className="w-4 h-4 text-[#004275] stroke-[2.5]" />
        <span>Enregistrer comme segment</span>
      </button>
    </div>
  </div>
);

interface ContactToolbarProps {
  showCreate: boolean;
  filtersOpen: boolean;
  searchValue: string;
  recentSearches: string[];
  recentOpen: boolean;
  handlers: {
    onToggleFilters: () => void;
    onSearchChange: (v: string) => void;
    onSearchEnter: () => void;
    onSearchEscape: () => void;
    onSearchFocus: () => void;
    onSearchBlur: () => void;
    onClear: () => void;
    onApplyRecent: (q: string) => void;
  };
}

const ContactToolbar: React.FC<ContactToolbarProps> = ({ showCreate, filtersOpen, searchValue, recentSearches, recentOpen, handlers }) => (
  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
    <div className="flex items-center gap-2 flex-1 w-full">
      <button
        onClick={handlers.onToggleFilters}
        className="lg:hidden flex items-center gap-1.5 px-3.5 py-2.5 bg-[#005596] hover:bg-[#004275] text-white rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer shadow-xs"
        title={filtersOpen ? 'Masquer les filtres' : 'Afficher les filtres'}
      >
        {filtersOpen ? <ChevronLeft className="w-4 h-4" /> : <SlidersHorizontal className="w-4 h-4" />}
        <span>Filtres</span>
      </button>

      <div className="flex-1 relative">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={searchValue}
          onChange={(e) => handlers.onSearchChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handlers.onSearchEnter();
            }
            if (e.key === 'Escape') {
              handlers.onSearchEscape();
            }
          }}
          onFocus={handlers.onSearchFocus}
          onBlur={handlers.onSearchBlur}
          placeholder="Rechercher par nom, e-mail, affiliation, pays, département, tag… (Entrée pour enregistrer)"
          className="w-full pl-10 pr-10 py-2.5 bg-[#E8F1F8] border-none rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#005596]"
        />
        {searchValue && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handlers.onClear}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-500 hover:text-white hover:bg-slate-400 transition-colors cursor-pointer"
            title="Effacer la recherche"
            aria-label="Effacer la recherche"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        {recentOpen && recentSearches.length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-slate-200 rounded-xl shadow-lg z-30 overflow-hidden">
            <p className="px-4 pt-2.5 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              Recherches récentes
            </p>
            {recentSearches.map(query => (
              <button
                key={query}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handlers.onApplyRecent(query)}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-xs font-semibold text-slate-700 hover:bg-[#E8F1F8] hover:text-[#005596] transition-colors cursor-pointer"
              >
                <Search className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                <span className="truncate">{query}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
    <div className="flex items-center gap-2 shrink-0 justify-end">
      {showCreate && (
        <Link
          to="/contacts/new"
          className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#005596] hover:bg-[#004275] text-white font-bold text-xs rounded-xl shadow-sm hover:shadow transition-all active:scale-95 cursor-pointer w-full sm:w-auto"
        >
          <UserPlus className="w-4 h-4" />
          <span>Nouveau Contact</span>
        </Link>
      )}
    </div>
  </div>
);

interface ContactSegmentsBarProps {
  segments: Segment[];
  activeSegmentId: string;
  isAnyCustomFilterActive: boolean;
  canScrollLeft: boolean;
  canScrollRight: boolean;
  segmentsRef: React.RefObject<HTMLDivElement | null>;
  onSegmentSelect: (id: string) => void;
  onScrollBy: (delta: number) => void;
}

const ContactSegmentsBar: React.FC<ContactSegmentsBarProps> = ({ segments, activeSegmentId, isAnyCustomFilterActive, canScrollLeft, canScrollRight, segmentsRef, onSegmentSelect, onScrollBy }) => (
  <div className="bg-white p-2.5 sm:p-3 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-2">
    <button
      type="button"
      disabled={!canScrollLeft}
      onClick={() => onScrollBy(-200)}
      className={`p-2 rounded-xl bg-slate-100 transition-colors shrink-0 shadow-2xs ${
        canScrollLeft
          ? 'hover:bg-[#D9E6F2] text-[#005596] cursor-pointer'
          : 'opacity-40 cursor-not-allowed text-slate-400'
      }`}
      title="Défiler les segments vers la gauche"
    >
      <ChevronLeft className="w-4 h-4" />
    </button>
    <div
      ref={segmentsRef}
      className="flex items-center gap-2 overflow-x-auto scrollbar-none scroll-smooth flex-1 py-0.5"
    >
      {segments.map(seg => {
        const isActive = seg.id === 'all'
          ? (activeSegmentId === 'all' && !isAnyCustomFilterActive)
          : (activeSegmentId === seg.id);
        return (
          <button
            key={seg.id}
            onClick={() => onSegmentSelect(seg.id)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer shrink-0 ${
              isActive
                ? 'bg-[#005596] text-white shadow-sm'
                : 'bg-[#E8F1F8] text-[#55636B] hover:bg-[#BCD7EE] hover:text-[#005596]'
            }`}
          >
            <span>{seg.name}</span>
            {isActive && <Check className="w-3.5 h-3.5" />}
          </button>
        );
      })}
    </div>
    <button
      type="button"
      disabled={!canScrollRight}
      onClick={() => onScrollBy(200)}
      className={`p-2 rounded-xl bg-slate-100 transition-colors shrink-0 shadow-2xs ${
        canScrollRight
          ? 'hover:bg-[#D9E6F2] text-[#005596] cursor-pointer'
          : 'opacity-40 cursor-not-allowed text-slate-400'
      }`}
      title="Défiler les segments vers la droite"
    >
      <ChevronRight className="w-4 h-4" />
    </button>
  </div>
);

interface ContactSelectionControlsProps {
  pageCount: number;
  selection: ContactSelection;
  isEmptyFilters: boolean;
  totalCount: number;
  onSelectPage: (action: 'select' | 'clear') => void;
  onSelectAllFiltered: () => void;
}

const ContactSelectionControls: React.FC<ContactSelectionControlsProps> = ({ pageCount, selection, isEmptyFilters, totalCount, onSelectPage, onSelectAllFiltered }) => (
  <div className="px-4 py-2.5 border-b border-[#C9D4DE] bg-white flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
    <label className="flex items-center gap-2 cursor-pointer text-[#55636B] font-semibold hover:text-[#005596]">
      <input
        type="checkbox"
        checked={selection.mode === 'page' && pageCount > 0}
        onChange={(e) => onSelectPage(e.target.checked ? 'select' : 'clear')}
        className="rounded text-[#005596] focus:ring-[#005596] border-[#C9D4DE] w-4 h-4 cursor-pointer"
      />
      Sélectionner cette page ({pageCount})
    </label>
    <button
      onClick={onSelectAllFiltered}
      disabled={!totalCount}
      className={`flex items-center gap-1.5 font-bold transition-colors cursor-pointer ${
        totalCount
          ? 'text-[#005596] hover:text-[#004275]'
          : 'text-slate-300 cursor-not-allowed'
      }`}
    >
      Sélectionner les {totalCount ?? 0} résultats
      <ChevronRight className="w-3.5 h-3.5" />
    </button>
    {isEmptyFilters && (
      <span className="text-[11px] text-slate-400 font-medium">(tous les contacts)</span>
    )}
  </div>
);

interface SortableThProps {
  label: string;
  thClassName: string;
  thTitle: string;
  column: ContactSortBy;
  sortBy: ContactSortBy | null;
  sortOrder: ContactSortOrder;
  onToggleSort: (c: ContactSortBy) => void;
  onToggleDirection: (c: ContactSortBy) => void;
}

const SortableTh: React.FC<SortableThProps> = ({ label, thClassName, thTitle, column, sortBy, sortOrder, onToggleSort, onToggleDirection }) => {
  const isSorted = sortBy === column;
  const ariaSortDirection = sortOrder === 'asc' ? 'ascending' : 'descending';
  return (
    <th className={`p-3 ${thClassName} truncate ${isSorted ? 'text-[#005596]' : ''}`} aria-sort={isSorted ? ariaSortDirection : 'none'} title={thTitle}>
      <div className="inline-flex items-center gap-1">
        <button
          type="button"
          onClick={() => onToggleSort(column)}
          className="font-bold uppercase tracking-wider transition-colors cursor-pointer hover:text-[#005596]"
        >
          {label}
        </button>
        <button
          type="button"
          onClick={() => onToggleDirection(column)}
          aria-label="Inverser le sens du tri"
          title="Changer la direction du tri (A→Z / Z→A)"
          className="inline-flex items-center cursor-pointer"
        >
          {renderSortIndicator(column, sortBy, sortOrder)}
        </button>
      </div>
    </th>
  );
};

interface ContactTableRowProps {
  contact: Contact;
  selected: boolean;
  popoverOpen: boolean;
  onOpen: () => void;
  onSelect: (checked: boolean) => void;
  onTogglePopover: () => void;
  onOpenDetail: () => void;
  onEdit: () => void;
  onDelete: () => void;
  showEdit: boolean;
  showDelete: boolean;
  tags: TagType[];
}

const ContactTableRow: React.FC<ContactTableRowProps> = ({ contact, selected, popoverOpen, onOpen, onSelect, onTogglePopover, onOpenDetail, onEdit, onDelete, showEdit, showDelete, tags: tagsList }) => {
  const contactTags = contact.tags || [];
  const visibleTags = contactTags.slice(0, 2);
  const hiddenCount = contactTags.length - 2;
  const careerStageClass = getCareerStageClass(contact.researchCareerStage);

  return (
    <tr
      key={contact.id}
      onClick={onOpen}
      className={`hover:bg-[#E8F1F8]/60 transition-colors cursor-pointer group ${
        selected ? 'bg-[#E8F1F8]' : ''
      }`}
    >
      <td className="p-3 sm:p-4" onClick={(e) => { e.stopPropagation(); onSelect(!selected); }}>
        <input
          type="checkbox"
          checked={selected}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            e.stopPropagation();
            onSelect(e.target.checked);
          }}
          className="rounded text-[#005596] focus:ring-[#005596] border-[#C9D4DE] w-4 h-4 cursor-pointer"
        />
      </td>
      <td className="p-3 sm:p-4 min-w-0">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-[#005596]/20 flex items-center justify-center text-[#005596] font-bold overflow-hidden shrink-0">
            {contact.avatarUrl ? (
              <img src={contact.avatarUrl} alt={contact.name} className="w-full h-full object-cover" />
            ) : (
              <span>{contact.initials}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-bold text-[#1C2529] truncate" title={contact.name}>{contact.name}</div>
            <div className="text-[11px] text-[#8A98A1] truncate" title={contact.email}>{contact.email}</div>
          </div>
        </div>
      </td>
      <td className="p-3 sm:p-4 min-w-0">
        <div className="flex items-center gap-1.5">
          <Flag className="w-3.5 h-3.5 text-[#8A98A1] shrink-0" />
          <span className="font-semibold text-[#1C2529] truncate" title={contact.countryOfOrigin}>{formatFieldValue(contact.countryOfOrigin)}</span>
        </div>
        <div className="text-[11px] text-[#8A98A1] truncate pl-5" title={contact.city}>{formatFieldValue(contact.city)}</div>
      </td>
      <td className="p-3 sm:p-4 min-w-0">
        <div className="font-semibold text-[#1C2529] truncate" title={contact.affiliation}>{formatFieldValue(contact.affiliation)}</div>
        <div className="text-[11px] text-[#8A98A1] truncate" title={contact.function}>{formatFieldValue(contact.function)}</div>
      </td>
      <td className="p-3 sm:p-4 hidden lg:table-cell">
        <span
          className={`px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap ${careerStageClass}`}
          title={CAREER_STAGE_LABELS[contact.researchCareerStage]}
        >
          {CAREER_STAGE_SHORT_LABELS[contact.researchCareerStage]}
        </span>
      </td>
      <td className="p-3 sm:p-4 hidden lg:table-cell">
        <span className="px-2.5 py-1 bg-[#E8F1F8] text-[#005596] rounded-full text-[11px] font-bold whitespace-nowrap">
          {GENDER_LABELS[contact.gender]}
        </span>
      </td>
      <td className="p-3 sm:p-4 min-w-0" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1 relative flex-wrap">
          {visibleTags.map((tName) => (
            <span
              key={tName}
              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${getTagBadgeStyle(tName, tagsList)} shadow-2xs truncate max-w-[80px]`}
              title={tName}
            >
              {tName}
            </span>
          ))}
          {hiddenCount > 0 && (
            <div className="relative">
              <button
                onClick={onTogglePopover}
                className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full text-[10px] font-extrabold border border-slate-300 cursor-pointer"
              >
                +{hiddenCount}
              </button>
              {popoverOpen && (
                <div className="absolute left-0 mt-1 z-30 bg-white p-2.5 rounded-xl shadow-xl border border-slate-200 w-48 space-y-1 text-xs animate-in fade-in">
                  <p className="font-bold text-[10px] uppercase text-slate-400 mb-1">Tous les tags:</p>
                  <div className="flex flex-wrap gap-1">
                    {contactTags.map((tName) => (
                      <span
                        key={tName}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${getTagBadgeStyle(tName, tagsList)}`}
                      >
                        {tName}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </td>
      <td className="p-3 sm:p-4 text-right shrink-0" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-end gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onOpenDetail}
            className="p-1.5 hover:bg-[#005596]/20 rounded-lg text-[#005596] cursor-pointer"
            title="Voir la fiche détaillée"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
          {showEdit && (
            <Link
              to={`/contacts/${contact.id}/edit`}
              className="p-1.5 hover:bg-[#005596]/20 rounded-lg text-[#005596] cursor-pointer"
              title="Modifier"
            >
              <Edit className="w-4 h-4" />
            </Link>
          )}
          {showDelete && (
            <button
              onClick={onDelete}
              className="p-1.5 hover:bg-red-50 rounded-lg text-red-600 cursor-pointer"
              title="Supprimer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
};

interface ContactDesktopTableProps {
  contacts: Contact[];
  sortBy: ContactSortBy | null;
  sortOrder: ContactSortOrder;
  serverError: string | null;
  isRowSelected: (id: string) => boolean;
  popoverContactId: string | null;
  tags: TagType[];
  onRetry: () => void;
  onResetFilters: () => void;
  onToggleColumnSort: (c: ContactSortBy) => void;
  onToggleSortDirection: (c: ContactSortBy) => void;
  onOpenDrawer: (c: Contact) => void;
  onSelectRow: (id: string, checked: boolean) => void;
  onOpenDetail: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onTogglePopover: (id: string) => void;
  showEdit: boolean;
  showDelete: boolean;
}

const ContactDesktopTable: React.FC<ContactDesktopTableProps> = ({ contacts, sortBy, sortOrder, serverError, isRowSelected, popoverContactId, tags, onRetry, onResetFilters, onToggleColumnSort, onToggleSortDirection, onOpenDrawer, onSelectRow, onOpenDetail, onEdit, onDelete, onTogglePopover, showEdit, showDelete }) => {
  const thProps: Omit<SortableThProps, 'label' | 'thClassName' | 'thTitle' | 'column'> = { sortBy, sortOrder, onToggleSort: onToggleColumnSort, onToggleDirection: onToggleSortDirection };

  const body: React.ReactNode = (() => {
    if (serverError) {
      return (
        <tr>
          <td colSpan={8} className="p-12 text-center text-slate-500">
            <p className="font-bold text-red-600 text-sm">{serverError}</p>
            <button
              onClick={onRetry}
              className="mt-3 px-4 py-2 bg-[#005596] hover:bg-[#004275] text-white rounded-xl font-bold text-xs cursor-pointer shadow-xs"
            >
              Réessayer
            </button>
          </td>
        </tr>
      );
    }
    if (contacts.length === 0) {
      return (
        <tr>
          <td colSpan={8} className="p-12 text-center text-slate-500">
            <p className="font-bold text-slate-700 text-sm">Aucun contact ne correspond à ces critères</p>
            <button
              onClick={onResetFilters}
              className="mt-3 px-4 py-2 bg-[#005596] hover:bg-[#004275] text-white rounded-xl font-bold text-xs cursor-pointer shadow-xs"
            >
              Réinitialiser tous les filtres
            </button>
          </td>
        </tr>
      );
    }
    return contacts.map(contact => (
      <ContactTableRow
        key={contact.id}
        contact={contact}
        selected={isRowSelected(contact.id)}
        popoverOpen={popoverContactId === contact.id}
        onOpen={() => onOpenDrawer(contact)}
        onSelect={(checked) => onSelectRow(contact.id, checked)}
        onTogglePopover={() => onTogglePopover(popoverContactId === contact.id ? null : contact.id)}
        onOpenDetail={() => onOpenDetail(contact.id)}
        onEdit={() => onEdit(contact.id)}
        onDelete={() => onDelete(contact.id)}
        showEdit={showEdit}
        showDelete={showDelete}
        tags={tags}
      />
    ));
  })();

  return (
    <div className="hidden md:block w-full overflow-hidden">
      <table className="w-full text-left border-collapse table-fixed max-w-full">
        <thead className="bg-[#D9E6F2]/50 border-b border-[#C9D4DE] text-[11px] font-bold text-[#55636B] uppercase tracking-wider">
          <tr>
            <th className="p-3 w-10 text-center shrink-0"></th>
            <SortableTh {...thProps} label="CONTACT" thClassName="w-[30%] md:w-[28%] lg:w-[22%]" thTitle="Trier par nom et e-mail du contact" column="name" />
            <SortableTh {...thProps} label="PAYS & VILLE" thClassName="w-[20%] md:w-[18%] lg:w-[14%]" thTitle="Trier par pays d'origine et ville" column="countryOfOrigin" />
            <SortableTh {...thProps} label="AFFILIATION & FONCTION" thClassName="w-[25%] md:w-[22%] lg:w-[18%]" thTitle="Trier par affiliation et fonction" column="affiliation" />
            <SortableTh {...thProps} label="STADE DE CARRIÈRE" thClassName="hidden lg:table-cell lg:w-[12%]" thTitle="Trier par stade de carrière" column="researchCareerStage" />
            <SortableTh {...thProps} label="GENRE" thClassName="hidden lg:table-cell lg:w-[10%]" thTitle="Trier par genre" column="gender" />
            <SortableTh {...thProps} label="TAGS" thClassName="w-[24%] md:w-[22%] lg:w-[14%]" thTitle="Trier par nombre de tags" column="tags" />
            <th className="p-3 w-20 text-right shrink-0">ACTIONS</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#C9D4DE]/30 text-xs">
          {body}
        </tbody>
      </table>
    </div>
  );
};

interface ContactMobileCardProps {
  contact: Contact;
  selected: boolean;
  tags: TagType[];
  onSelect: (checked: boolean) => void;
  onOpenDrawer: () => void;
  onOpenDetail: () => void;
  onEdit: () => void;
  onDelete: () => void;
  showEdit: boolean;
  showDelete: boolean;
}

const ContactMobileCard: React.FC<ContactMobileCardProps> = ({ contact, selected, tags: tagsList, onSelect, onOpenDrawer, onOpenDetail, onEdit, onDelete, showEdit, showDelete }) => {
  const contactTags = contact.tags || [];

  return (
    <div /* NOSONAR */
      role="button"
      tabIndex={0}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('[data-row-actions]')) return;
        onOpenDrawer();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpenDrawer();
        }
      }}
      className={`p-4 space-y-3 cursor-pointer hover:bg-slate-50 transition-colors ${
        selected ? 'bg-[#E8F1F8]/60' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={selected}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              e.stopPropagation();
              onSelect(e.target.checked);
            }}
            className="rounded text-[#005596] focus:ring-[#005596] border-[#C9D4DE] w-4 h-4 cursor-pointer mt-0.5"
          />
          <div className="w-10 h-10 rounded-full bg-[#005596]/20 flex items-center justify-center text-[#005596] font-bold overflow-hidden shrink-0">
            {contact.avatarUrl ? (
              <img src={contact.avatarUrl} alt={contact.name} className="w-full h-full object-cover" />
            ) : (
              <span>{contact.initials}</span>
            )}
          </div>
          <div>
            <div className="font-bold text-sm text-[#1C2529]">{contact.name}</div>
            <div className="text-xs text-slate-500">{contact.email}</div>
          </div>
        </div>
        <span className="px-2.5 py-0.5 bg-[#005596]/10 text-[#005596] rounded-full text-[10px] font-bold shrink-0">
          {GENDER_LABELS[contact.gender]}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
        <div>
          <span className="text-[10px] font-bold uppercase text-slate-400 block">Affiliation</span>
          <span className="font-semibold text-slate-800">{formatFieldValue(contact.affiliation)}</span>
        </div>
        <div>
          <span className="text-[10px] font-bold uppercase text-slate-400 block">Pays & Ville</span>
          <span className="font-semibold text-slate-800">{[contact.countryOfOrigin, contact.city].filter(v => v?.trim()).join(', ') || '\u2014'}</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-1 items-center">
        <span className="px-2 py-0.5 bg-[#D9E6F2] text-[#55636B] rounded-full text-[10px] font-bold">
          {CAREER_STAGE_SHORT_LABELS[contact.researchCareerStage]}
        </span>
        {contactTags.map((tName) => (
          <span
            key={tName}
            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${getTagBadgeStyle(tName, tagsList)}`}
          >
            {tName}
          </span>
        ))}
      </div>
      <div data-row-actions className="pt-2 flex items-center justify-between border-t border-slate-100">
        <span className="text-[11px] text-slate-500 font-medium truncate">{contact.function?.trim() || contact.affiliation?.trim() || '\u2014'}</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onOpenDetail()}
            className="px-2.5 py-1 bg-[#E8F1F8] text-[#005596] rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Voir
          </button>
          {showEdit && (
            <Link
              to={`/contacts/${contact.id}/edit`}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-[#005596] cursor-pointer"
            >
              <Edit className="w-4 h-4" />
            </Link>
          )}
          {showDelete && (
            <button
              onClick={() => onDelete()}
              className="p-1.5 hover:bg-red-50 rounded-lg text-red-600 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

interface ContactMobileListProps {
  contacts: Contact[];
  serverError: string | null;
  selection: ContactSelection;
  tags: TagType[];
  showEdit: boolean;
  showDelete: boolean;
  isRowSelected: (id: string) => boolean;
  onRetry: () => void;
  onResetFilters: () => void;
  onSelectRow: (id: string, checked: boolean) => void;
  onOpenDrawer: (c: Contact) => void;
  onOpenDetail: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

const ContactMobileList: React.FC<ContactMobileListProps> = ({ contacts, serverError, selection, tags, showEdit, showDelete, isRowSelected, onRetry, onResetFilters, onSelectRow, onOpenDrawer, onOpenDetail, onEdit, onDelete }) => {
  const renderContent = () => {
    if (serverError) {
      return (
        <div className="p-8 text-center text-slate-500">
          <p className="font-bold text-red-600 text-sm">{serverError}</p>
          <button
            onClick={onRetry}
            className="mt-3 px-4 py-2 bg-[#005596] text-white rounded-xl font-bold text-xs cursor-pointer"
          >
            Réessayer
          </button>
        </div>
      );
    }
    if (contacts.length === 0) {
      return (
        <div className="p-8 text-center text-slate-500">
          <p className="font-bold text-slate-700 text-sm">Aucun contact trouvé</p>
          <button
            onClick={onResetFilters}
            className="mt-3 px-4 py-2 bg-[#005596] text-white rounded-xl font-bold text-xs cursor-pointer"
          >
            Réinitialiser les filtres
          </button>
        </div>
      );
    }
    return contacts.map(contact => (
      <ContactMobileCard
        key={contact.id}
        contact={contact}
        selected={isRowSelected(contact.id)}
        tags={tags}
        onSelect={(checked) => onSelectRow(contact.id, checked)}
        onOpenDrawer={() => onOpenDrawer(contact)}
        onOpenDetail={() => onOpenDetail(contact.id)}
        onEdit={() => onEdit(contact.id)}
        onDelete={() => onDelete(contact.id)}
        showEdit={showEdit}
        showDelete={showDelete}
      />
    ));
  };

  return (
    <div className="block md:hidden divide-y divide-slate-100">
      {renderContent()}
    </div>
  );
};

interface ContactPaginationBarProps {
  pageContactsCount: number;
  pagination: PaginationInfo | null;
  itemsPerPage: number;
  onItemsPerPageChange?: (newLimit: number) => void;
  onPageChange: (p: number) => void;
}

const ContactPaginationBar: React.FC<ContactPaginationBarProps> = ({ pageContactsCount, pagination, itemsPerPage, onItemsPerPageChange, onPageChange }) => (
  <div className="px-6 py-3 bg-[#E8F1F8] border-t border-[#C9D4DE] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#55636B]">
    <div>
      Affichage de <span className="font-bold text-[#005596]">
        {pageContactsCount === 0 ? 0 : ((pagination?.page ?? 1) - 1) * itemsPerPage + 1} - {Math.min((pagination?.page ?? 1) * itemsPerPage, pagination?.totalCount ?? 0)}
      </span> sur <span className="font-bold text-[#005596]">{pagination?.totalCount ?? 0}</span> contacts
    </div>
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-medium">Voir</span>
        <select
          value={itemsPerPage}
          onChange={(e) => {
            const newLimit = Number(e.target.value);
            if (onItemsPerPageChange) {
              onItemsPerPageChange(newLimit);
            }
            onPageChange(1);
          }}
          className="px-2 py-1 border border-[#C9D4DE] rounded-lg text-xs bg-white cursor-pointer font-bold text-[#005596]"
        >
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(Math.max(1, (pagination?.page ?? 1) - 1))}
          disabled={(pagination?.page ?? 1) === 1}
          className="p-1 hover:bg-[#E8F1F8] rounded disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed transition-colors"
          title="Page précédente"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <Pagination
          page={pagination?.page ?? 1}
          totalPages={pagination?.totalPages ?? 1}
          onPageChange={onPageChange}
        />
        <button
          onClick={() => onPageChange(Math.min(pagination?.totalPages ?? 1, (pagination?.page ?? 1) + 1))}
          disabled={(pagination?.page ?? 1) >= (pagination?.totalPages ?? 1)}
          className="p-1 hover:bg-[#E8F1F8] rounded disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed transition-colors"
          title="Page suivante"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  </div>
);

interface ContactFloatingBarProps {
  selection: ContactSelection;
  canBatchDelete: boolean;
  onExport: () => void;
  onDeleteBatch: (ids: string[]) => void;
  onClear: () => void;
}

const ContactFloatingBar: React.FC<ContactFloatingBarProps> = ({ selection, canBatchDelete, onExport, onDeleteBatch, onClear }) => {
  const hasExplicitIds = selection.mode === 'page' || selection.mode === 'partial';
  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-[#1C2529] text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-6 z-40 animate-slide-up">
      <div className="flex items-center gap-2">
        <span className="bg-[#005596] px-2.5 py-0.5 rounded-full text-xs font-bold">
          {selection.mode === 'all-filtered' ? `${selection.totalCount} ↗` : selection.ids.length}
        </span>
        <span className="text-xs font-medium text-[#E8F1F8]">
          {selection.mode === 'all-filtered' ? 'Tous les résultats sélectionnés' : 'Contacts sélectionnés'}
        </span>
      </div>
      <div className="h-5 w-px bg-white/20" />
      <div className="flex items-center gap-4 text-xs font-bold">
        <button
          onClick={onExport}
          className="flex items-center gap-1.5 hover:text-[#FFC20C] transition-colors cursor-pointer"
          title="Exporter la sélection"
        >
          <Download className="w-4 h-4" /> Exporter
        </button>
        {hasExplicitIds && (
          <Link
            to="/segments"
            className="flex items-center gap-1.5 hover:text-[#FFC20C] transition-colors"
          >
            <TagIcon className="w-4 h-4" /> Ajouter des tags
          </Link>
        )}
        {canBatchDelete && hasExplicitIds && (
          <button
            onClick={() => onDeleteBatch(selection.ids)}
            disabled={selection.ids.length === 0}
            className="flex items-center gap-1.5 text-red-400 hover:text-red-300 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            title={`Supprimer la sélection (${selection.ids.length})`}
          >
            <Trash2 className="w-4 h-4" /> Supprimer
          </button>
        )}
      </div>
      <button
        onClick={onClear}
        className="p-1 hover:bg-white/10 rounded-full transition-colors ml-2"
        title="Effacer la sélection"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

interface ContactsViewProps {
  segments: Segment[];
  tags: TagType[];
  activeSegmentId: string;
  onSelectSegment: (segmentId: string) => void;
  onSaveCurrentAsSegment: (segmentName: string, filters: FilterState) => void;
  onSelectContact: (contactId: string) => void;
  onDeleteContact?: (contactId: string) => void;
  onDeleteContacts?: (ids: string[]) => void;
  refreshKey?: number;
  itemsPerPage?: number;
  onItemsPerPageChange?: (newLimit: number) => void;
  selection: ContactSelection;
  onSelectionChange: (next: ContactSelection | ((prev: ContactSelection) => ContactSelection)) => void;
  user?: UserType | null;
}

export const ContactsView: React.FC<ContactsViewProps> = ({
  segments,
  tags,
  activeSegmentId,
  onSelectSegment,
  onSaveCurrentAsSegment,
  onSelectContact,
  onDeleteContact,
  onDeleteContacts,
  refreshKey = 0,
  itemsPerPage = 10,
  onItemsPerPageChange,
  selection,
  onSelectionChange,
  user
}) => {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const showCreate = canCreate(user);
  const showEdit = canEdit(user);
  const showDelete = canDelete(user);

  const [pendingFilters, setPendingFilters] = useState<FilterState>(emptyFilterState);
  const location = useLocation();
  const navigate = useNavigate();
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(emptyFilterState);

  const [sortBy, setSortBy] = useState<ContactSortBy | null>(null);
  const [sortOrder, setSortOrder] = useState<ContactSortOrder>('desc');

  const toggleColumnSort = (column: ContactSortBy) => {
    if (sortBy === column) {
      setSortBy(null);
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
    setCurrentPage(1);
  };

  const toggleSortDirection = (column: ContactSortBy) => {
    if (sortBy !== column) return;
    if (sortOrder === 'asc') {
      setSortOrder('desc');
    } else {
      setSortOrder('asc');
    }
    setCurrentPage(1);
  };

  const [pageContacts, setPageContacts] = useState<Contact[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [pageLoading, setPageLoading] = useState<boolean>(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);

  const [countries, setCountries] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    apiFetch('/api/contacts/countries')
      .then((data: any) => {
        if (!cancelled && Array.isArray(data?.data?.countries)) {
          setCountries(data.data.countries);
        }
      })
      .catch(() => {
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const stateFilters = (location.state as { filters?: FilterState } | null)?.filters;
    if (stateFilters && typeof stateFilters === 'object') {
      setPendingFilters(stateFilters);
      setAppliedFilters(stateFilters);
    }
  }, [location.state]);

  const debouncedSearch = pendingFilters.search;
  useEffect(() => {
    const timer = setTimeout(() => {
      setAppliedFilters(prev => (prev.search === debouncedSearch ? prev : { ...prev, search: debouncedSearch }));
    }, 400);
    return () => clearTimeout(timer);
  }, [debouncedSearch]);

  useEffect(() => {
    const activeSeg = segments.find(s => s.id === activeSegmentId);
    if (activeSeg) {
      setPendingFilters(activeSeg.filters);
      setAppliedFilters(activeSeg.filters);
    }
  }, [activeSegmentId, segments]);

  const [currentPage, setCurrentPage] = useState(1);
  const hasLoadedOnceRef = useRef(false);

  useEffect(() => {
    setCurrentPage(1);
  }, [appliedFilters, activeSegmentId]);

  useEffect(() => {
    const controller = new AbortController();
    setPageLoading(true);
    setServerError(null);

    apiFetch(buildContactsListQuery(appliedFilters, tags, currentPage, itemsPerPage, sortBy ? { sortBy, sortOrder } : undefined), { signal: controller.signal })
      .then((data: any) => {
        if (controller.signal.aborted) return;
        const rows = Array.isArray(data?.data?.contacts) ? data.data.contacts : [];
        setPageContacts(rows.map(mapContactFromApi));
        setPagination(data?.pagination ?? null);
      })
      .catch((err: any) => {
        if (controller.signal.aborted) return;
        setServerError(err?.message || 'Erreur lors du chargement des contacts.');
        setPageContacts([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setPageLoading(false);
          hasLoadedOnceRef.current = true;
        }
      });

    return () => controller.abort();
  }, [appliedFilters, currentPage, itemsPerPage, tags, retryTick, refreshKey, sortBy, sortOrder]);

  const [quickDrawerContact, setQuickDrawerContact] = useState<Contact | null>(null);
  const [isSaveSegmentModalOpen, setIsSaveSegmentModalOpen] = useState(false);
  const [newSegmentNameInput, setNewSegmentNameInput] = useState('');

  const handleSaveSegmentSubmit = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newSegmentNameInput.trim()) return;
    onSaveCurrentAsSegment(newSegmentNameInput.trim(), pendingFilters);
    setNewSegmentNameInput('');
    setIsSaveSegmentModalOpen(false);
  };

  const RECENT_SEARCHES_KEY = 'euraxess_recent_searches';
  const RECENT_SEARCHES_MAX = 4;
  const [isRecentSearchesOpen, setIsRecentSearchesOpen] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string').slice(0, RECENT_SEARCHES_MAX) : [];
    } catch {
      return [];
    }
  });

  const persistRecentSearch = (query: string) => {
    const q = query.trim();
    if (!q) return;
    setRecentSearches(prev => {
      const next = [q, ...prev.filter(s => s.toLowerCase() !== q.toLowerCase())].slice(0, RECENT_SEARCHES_MAX);
      try {
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
      } catch {
      }
      return next;
    });
  };

  const saveSearchToRecents = () => {
    persistRecentSearch(pendingFilters.search);
    setIsRecentSearchesOpen(false);
  };

  const applyRecentSearch = (query: string) => {
    updatePendingFilters(prev => ({ ...prev, search: query }));
    setAppliedFilters(prev => ({ ...prev, search: query }));
    setCurrentPage(1);
    persistRecentSearch(query);
    setIsRecentSearchesOpen(false);
  };

  const clearSearch = () => {
    updatePendingFilters(prev => ({ ...prev, search: '' }));
    setAppliedFilters(prev => ({ ...prev, search: '' }));
    setCurrentPage(1);
  };

  const segmentsRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkSegmentsScrollState = useCallback(() => {
    const el = segmentsRef.current;
    if (!el) return;
    const hasOverflow = el.scrollWidth > el.clientWidth + 1;
    if (!hasOverflow) {
      setCanScrollLeft(false);
      setCanScrollRight(false);
    } else {
      setCanScrollLeft(el.scrollLeft > 2);
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
    }
  }, []);

  useEffect(() => {
    const el = segmentsRef.current;
    if (!el) return;
    checkSegmentsScrollState();
    el.addEventListener('scroll', checkSegmentsScrollState, { passive: true });
    const observer = new ResizeObserver(() => {
      checkSegmentsScrollState();
    });
    observer.observe(el);
    return () => {
      el.removeEventListener('scroll', checkSegmentsScrollState);
      observer.disconnect();
    };
  }, [checkSegmentsScrollState, segments]);

  const isAnyCustomFilterActive = useMemo(() => {
    return (
      appliedFilters.search.trim() !== '' ||
      appliedFilters.countries.length > 0 ||
      appliedFilters.genders.length > 0 ||
      appliedFilters.careerStages.length > 0 ||
      appliedFilters.tags.length > 0
    );
  }, [appliedFilters]);

  const ALL_SEGMENT: Segment = useMemo(() => ({
    id: 'all',
    name: 'Tous les contacts',
    filters: {
      search: '',
      countries: [],
      genders: [],
      careerStages: [],
      tags: []
    }
  }), []);

  const displaySegments = useMemo(() => {
    const hasAll = segments.some(s => s.id === 'all');
    return hasAll ? segments : [ALL_SEGMENT, ...segments];
  }, [segments, ALL_SEGMENT]);

  const [popoverContactId, setPopoverContactId] = useState<string | null>(null);

  const updatePendingFilters = (updater: (prev: FilterState) => FilterState) => {
    setPendingFilters(prev => updater(prev));
    if (activeSegmentId !== 'all') {
      onSelectSegment('all');
    }
  };

  const toggleCountry = (country: string) => {
    updatePendingFilters(prev => ({
      ...prev,
      countries: prev.countries.includes(country)
        ? prev.countries.filter(c => c !== country)
        : [...prev.countries, country]
    }));
  };

  const toggleGender = (gender: Gender) => {
    updatePendingFilters(prev => ({
      ...prev,
      genders: prev.genders.includes(gender)
        ? prev.genders.filter(g => g !== gender)
        : [...prev.genders, gender]
    }));
  };

  const toggleCareerStage = (stage: ResearchCareerStage) => {
    updatePendingFilters(prev => ({
      ...prev,
      careerStages: prev.careerStages.includes(stage)
        ? prev.careerStages.filter(s => s !== stage)
        : [...prev.careerStages, stage]
    }));
  };

  const toggleTag = (tagName: string) => {
    updatePendingFilters(prev => ({
      ...prev,
      tags: prev.tags.includes(tagName)
        ? prev.tags.filter(t => t !== tagName)
        : [...prev.tags, tagName]
    }));
  };

  const handleResetFilters = () => {
    const emptyFilter = emptyFilterState();
    setPendingFilters(emptyFilter);
    setAppliedFilters(emptyFilter);
    onSelectSegment('all');
  };

  const handleSelectPage = (action: 'select' | 'clear') => {
    const actions: Record<'select' | 'clear', () => void> = {
      select: () => {
        onSelectionChange({
          mode: 'page',
          ids: pageContacts.map(c => c.id),
          filters: appliedFilters,
          totalCount: pagination?.totalCount ?? pageContacts.length
        });
      },
      clear: () => {
        onSelectionChange({ mode: 'none', ids: [], filters: appliedFilters, totalCount: 0 });
      },
    };
    actions[action]();
  };

  const handleSelectAllFiltered = () => {
    onSelectionChange({
      mode: 'all-filtered',
      ids: [],
      filters: appliedFilters,
      totalCount: pagination?.totalCount ?? pageContacts.length
    });
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    onSelectionChange(prev => {
      if (checked) {
        if (prev.mode === 'all-filtered' || prev.mode === 'none') {
          return { mode: 'partial', ids: [id], filters: prev.filters, totalCount: prev.totalCount };
        }
        const ids = prev.ids.includes(id) ? prev.ids : [...prev.ids, id];
        return { ...prev, mode: 'partial', ids };
      }
      if (prev.mode === 'page') {
        const ids = prev.ids.filter(i => i !== id);
        return { ...prev, mode: ids.length ? 'partial' : 'none', ids };
      }
      if (prev.mode === 'all-filtered') {
        const ids = pageContacts.map(c => c.id).filter(i => i !== id);
        return { ...prev, mode: ids.length ? 'partial' : 'none', ids, totalCount: pagination?.totalCount ?? ids.length };
      }
      const ids = prev.ids.filter(i => i !== id);
      return { ...prev, mode: ids.length ? 'partial' : 'none', ids };
    });
  };

  const handleClearSelection = () => {
    onSelectionChange({ mode: 'none', ids: [], filters: appliedFilters, totalCount: 0 });
  };

  const appliedFiltersRef = useRef(appliedFilters);
  useEffect(() => {
    const filtersChanged = JSON.stringify(appliedFiltersRef.current) !== JSON.stringify(appliedFilters);
    appliedFiltersRef.current = appliedFilters;
    if (filtersChanged && (selection.mode === 'page' || selection.mode === 'all-filtered')) {
      onSelectionChange({ mode: 'none', ids: [], filters: appliedFilters, totalCount: 0 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedFilters]);

  useEffect(() => {
    if (selection.mode === 'page' && pageContacts.length) {
      onSelectionChange(prev => prev.mode === 'page' ? { ...prev, ids: pageContacts.map(c => c.id) } : prev);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageContacts, selection.mode]);

  const handleExportSelection = () => {
    navigate('/export');
  };

  const isRowSelected = (id: string) =>
    selection.mode === 'all-filtered' || selection.ids.includes(id);

  const getTagBadgeStyleForContact = (tagName: string) => {
    return getTagBadgeStyle(tagName, tags);
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row lg:items-start min-h-[calc(100vh-64px)] w-full max-w-full bg-[#E8F1F8] relative">
      {isFilterOpen && (
        <SidebarBackdrop onClose={() => setIsFilterOpen(false)} />
      )}
      <aside className={`
        w-72 flex-shrink-0
        fixed lg:relative
        inset-y-0 lg:inset-y-auto
        left-0
        z-40
        h-full lg:h-auto
        bg-[#F1F7FC] border-r border-[#C9D4DE]
        p-4 sm:p-5
        flex flex-col
        overflow-y-auto lg:overflow-visible
        transition-transform duration-300
        shadow-2xl lg:shadow-none
        lg:translate-x-0
        ${isFilterOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <SidebarFilters
          filters={pendingFilters}
          countries={countries}
          tags={tags}
          loading={pageLoading}
          handlers={{
            onToggleCountry: toggleCountry,
            onToggleGender: toggleGender,
            onToggleCareerStage: toggleCareerStage,
            onToggleTag: toggleTag,
            onApply: () => {
              setAppliedFilters(pendingFilters);
              setCurrentPage(1);
              setIsFilterOpen(false);
            },
            onSaveSegment: () => {
              setIsSaveSegmentModalOpen(true);
              setIsFilterOpen(false);
            },
            onReset: handleResetFilters,
            onClose: () => setIsFilterOpen(false),
          }}
        />
      </aside>

      <main className="flex-1 min-w-0 w-full max-w-full p-3 sm:p-6 lg:p-8 relative space-y-6">
        <ContactToolbar
          showCreate={showCreate}
          filtersOpen={isFilterOpen}
          searchValue={pendingFilters.search}
          recentSearches={recentSearches}
          recentOpen={isRecentSearchesOpen}
          handlers={{
            onToggleFilters: () => setIsFilterOpen(prev => !prev),
            onSearchChange: (v) => updatePendingFilters(prev => ({ ...prev, search: v })),
            onSearchEnter: saveSearchToRecents,
            onSearchEscape: () => setIsRecentSearchesOpen(false),
            onSearchFocus: () => { if (recentSearches.length > 0) setIsRecentSearchesOpen(true); },
            onSearchBlur: () => { setTimeout(() => setIsRecentSearchesOpen(false), 150); },
            onClear: clearSearch,
            onApplyRecent: applyRecentSearch,
          }}
        />
        <ContactSegmentsBar
          segments={displaySegments}
          activeSegmentId={activeSegmentId}
          isAnyCustomFilterActive={isAnyCustomFilterActive}
          canScrollLeft={canScrollLeft}
          canScrollRight={canScrollRight}
          segmentsRef={segmentsRef}
          onSegmentSelect={(id) => {
            if (id === 'all') { handleResetFilters(); }
            onSelectSegment(id);
          }}
          onScrollBy={(delta) => { segmentsRef.current?.scrollBy({ left: delta, behavior: 'smooth' }); }}
        />
        {pageLoading && !hasLoadedOnceRef.current ? (
          <ContactsTableSkeleton />
        ) : (
          <div className={`relative bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-200 transition-opacity duration-200 ${pageLoading ? 'opacity-90' : ''}`}>
            {pageLoading && hasLoadedOnceRef.current && (
              <output
                className="absolute inset-0 z-20 bg-white/50 backdrop-blur-sm animate-pulse"
                aria-label="Rechargement des contacts"
              />
            )}
            <ContactSelectionControls
              pageCount={pageContacts.length}
              selection={selection}
              isEmptyFilters={isEmptyFilterState(appliedFilters)}
              totalCount={pagination?.totalCount ?? 0}
              onSelectPage={handleSelectPage}
              onSelectAllFiltered={handleSelectAllFiltered}
            />
            <ContactDesktopTable
              contacts={pageContacts}
              sortBy={sortBy}
              sortOrder={sortOrder}
              serverError={serverError}
              isRowSelected={isRowSelected}
              popoverContactId={popoverContactId}
              tags={tags}
              onRetry={() => setRetryTick(t => t + 1)}
              onResetFilters={handleResetFilters}
              onToggleColumnSort={toggleColumnSort}
              onToggleSortDirection={toggleSortDirection}
              onOpenDrawer={(c) => setQuickDrawerContact(c)}
              onSelectRow={handleSelectRow}
              onOpenDetail={onSelectContact}
              onEdit={(id) => navigate(`/contacts/${id}/edit`)}
              onDelete={(id) => onDeleteContact?.(id)}
              onTogglePopover={(id) => setPopoverContactId(id)}
              showEdit={showEdit}
              showDelete={showDelete}
            />
            <ContactMobileList
              contacts={pageContacts}
              serverError={serverError}
              selection={selection}
              tags={tags}
              showEdit={showEdit}
              showDelete={showDelete}
              isRowSelected={isRowSelected}
              onRetry={() => setRetryTick(t => t + 1)}
              onResetFilters={handleResetFilters}
              onSelectRow={handleSelectRow}
              onOpenDrawer={(c) => setQuickDrawerContact(c)}
              onOpenDetail={onSelectContact}
              onEdit={(id) => navigate(`/contacts/${id}/edit`)}
              onDelete={(id) => onDeleteContact?.(id)}
            />
            <ContactPaginationBar
              pageContactsCount={pageContacts.length}
              pagination={pagination}
              itemsPerPage={itemsPerPage}
              onItemsPerPageChange={onItemsPerPageChange}
              onPageChange={setCurrentPage}
            />
          </div>
        )}

        {selection.mode !== 'none' && (
          <ContactFloatingBar
            selection={selection}
            canBatchDelete={showDelete && !!onDeleteContacts}
            onExport={handleExportSelection}
            onDeleteBatch={(ids) => onDeleteContacts?.(ids)}
            onClear={handleClearSelection}
          />
        )}
      </main>

      {quickDrawerContact && (
        <ContactsProfileDrawer
          contact={quickDrawerContact}
          getTagBadgeStyle={getTagBadgeStyleForContact}
          onClose={() => setQuickDrawerContact(null)}
          onNavigateToDetail={(id) => {
            setQuickDrawerContact(null);
            onSelectContact(id);
          }}
        />
      )}

      <SaveSegmentModal
        isOpen={isSaveSegmentModalOpen}
        onClose={() => setIsSaveSegmentModalOpen(false)}
        pendingFilters={pendingFilters}
        segmentNameInput={newSegmentNameInput}
        onSegmentNameInputChange={setNewSegmentNameInput}
        onSubmit={handleSaveSegmentSubmit}
      />
    </div>
  );
};
