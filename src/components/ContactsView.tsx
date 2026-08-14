import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Contact, FilterState, Segment, Tag as TagType, Gender, ResearchCareerStage, GENDER_LABELS, CAREER_STAGE_LABELS, CAREER_STAGE_SHORT_LABELS } from '../types';
import { formatFullName } from '../utils/format';
import { Modal } from './Modal';
import { 
  Search, 
  SlidersHorizontal, 
  Filter,
  Save,
  Globe, 
  Map, 
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
  Mail, 
  Phone, 
  ExternalLink,
  RotateCcw,
  Check
} from 'lucide-react';
import { ContactsTableSkeleton } from './Skeletons';

interface ContactsViewProps {
  contacts: Contact[];
  segments: Segment[];
  tags: TagType[];
  activeSegmentId: string;
  onSelectSegment: (segmentId: string) => void;
  onSaveCurrentAsSegment: (segmentName: string, filters: FilterState) => void;
  onSelectContact: (contactId: string) => void;
  onDeleteContact?: (contactId: string) => void;
  itemsPerPage?: number;
  onItemsPerPageChange?: (newLimit: number) => void;
  selectedContactIds?: string[];
  onSelectContactIds?: (ids: string[] | ((prev: string[]) => string[])) => void;
  isLoading?: boolean;
}

export const ContactsView: React.FC<ContactsViewProps> = ({
  contacts,
  segments,
  tags,
  activeSegmentId,
  onSelectSegment,
  onSaveCurrentAsSegment,
  onSelectContact,
  onDeleteContact,
  itemsPerPage = 10,
  onItemsPerPageChange,
  selectedContactIds: propSelectedContactIds,
  onSelectContactIds: propOnSelectContactIds,
  isLoading = false
}) => {
  // Local fallback selection state if prop not passed
  const [localSelectedContactIds, setLocalSelectedContactIds] = useState<string[]>([]);
  const selectedContactIds = propSelectedContactIds ?? localSelectedContactIds;
  const setSelectedContactIds = propOnSelectContactIds ?? setLocalSelectedContactIds;

  // Mobile Filter Drawer Toggle State
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

  // Pending Filters State (modified in sidebar before clicking "Appliquer les filtres")
  const [pendingFilters, setPendingFilters] = useState<FilterState>({
    search: '',
    countries: [],
    genders: [],
    careerStages: [],
    affiliations: '',
    tags: []
  });

  const location = useLocation();

  // Applied Filters State (used to filter contacts table)
  const [appliedFilters, setAppliedFilters] = useState<FilterState>({
    search: '',
    countries: [],
    genders: [],
    careerStages: [],
    affiliations: '',
    tags: []
  });

  // Apply filters passed via router state (e.g. from the AI chat assistant)
  useEffect(() => {
    const stateFilters = (location.state as { filters?: FilterState } | null)?.filters;
    if (stateFilters && typeof stateFilters === 'object') {
      setPendingFilters(stateFilters);
      setAppliedFilters(stateFilters);
    }
  }, [location.state]);

  // Debounced search term for real-time text input
  useEffect(() => {
    const handler = setTimeout(() => {
      setAppliedFilters(prev => ({ ...prev, search: pendingFilters.search }));
    }, 250);
    return () => clearTimeout(handler);
  }, [pendingFilters.search]);

  // When activeSegmentId changes, update both pending and applied filters to match segment
  useEffect(() => {
    const activeSeg = segments.find(s => s.id === activeSegmentId);
    if (activeSeg) {
      setPendingFilters(activeSeg.filters);
      setAppliedFilters(activeSeg.filters);
    }
  }, [activeSegmentId, segments]);

  // Drawer state
  const [quickDrawerContact, setQuickDrawerContact] = useState<Contact | null>(null);

  // Save Segment Modal State
  const [isSaveSegmentModalOpen, setIsSaveSegmentModalOpen] = useState(false);
  const [newSegmentNameInput, setNewSegmentNameInput] = useState('');

  // Handle Save Current Applied Filters as Segment
  const handleSaveSegmentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSegmentNameInput.trim()) return;
    onSaveCurrentAsSegment(newSegmentNameInput.trim(), appliedFilters);
    setNewSegmentNameInput('');
    setIsSaveSegmentModalOpen(false);
  };

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);

  // Reset page when applied filters or segment changes
  useEffect(() => {
    setCurrentPage(1);
  }, [appliedFilters, activeSegmentId]);

  // Ref for scrollable segments bar
  const segmentsRef = useRef<HTMLDivElement>(null);

  // Scrollable segment bar overflow & position check
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

  // Determine if any custom filter is active (search, countries, genders, career stages, affiliations, tags)
  const isAnyCustomFilterActive = useMemo(() => {
    return (
      appliedFilters.search.trim() !== '' ||
      appliedFilters.countries.length > 0 ||
      appliedFilters.genders.length > 0 ||
      appliedFilters.careerStages.length > 0 ||
      appliedFilters.affiliations.trim() !== '' ||
      appliedFilters.tags.length > 0
    );
  }, [appliedFilters]);

  // "Tous les contacts" default segment shown at the front of the quick-access bar
  const ALL_SEGMENT: Segment = useMemo(() => ({
    id: 'all',
    name: 'Tous les contacts',
    filters: {
      search: '',
      countries: [],
      genders: [],
      careerStages: [],
      affiliations: '',
      tags: []
    }
  }), []);

  const displaySegments = useMemo(() => {
    const hasAll = segments.some(s => s.id === 'all');
    return hasAll ? segments : [ALL_SEGMENT, ...segments];
  }, [segments, ALL_SEGMENT]);

  // Expanded tags popover ID
  const [popoverContactId, setPopoverContactId] = useState<string | null>(null);

  // Available Filter Options
  const countries = useMemo(() => {
    const set = new Set<string>();
    contacts.forEach(c => { if (c.countryOfOrigin && c.countryOfOrigin.trim() !== 'N/A') set.add(c.countryOfOrigin.trim()); });
    return Array.from(set).sort();
  }, [contacts]);

  const genders = ['FEMALE', 'MALE', 'NOT_SPECIFIED'] as Gender[];
  const allCareerStages = ['R1_FIRST_STAGE', 'R2_RECOGNIZED', 'R3_ESTABLISHED', 'R4_LEADING'] as ResearchCareerStage[];

  const hasVal = (v?: string | null) => Boolean(v && v.trim() && v.trim() !== 'N/A');
  const dash = <span className="text-[#8A98A1]">—</span>;
  const fmt = (v?: string | null) => (hasVal(v) ? v : dash);

  // Helper to handle pending filter updates and deselect active segment
  const updatePendingFilters = (updater: (prev: FilterState) => FilterState) => {
    setPendingFilters(prev => updater(prev));
    if (activeSegmentId !== 'all') {
      onSelectSegment('all');
    }
  };

  // Toggle helpers for sidebar pending filters
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

  // Apply pending sidebar filters to appliedFilters
  const handleApplyFilters = () => {
    setAppliedFilters(pendingFilters);
    if (activeSegmentId !== 'all') {
      onSelectSegment('all');
    }
  };

  // Reset all filters
  const handleResetFilters = () => {
    const emptyFilter: FilterState = {
      search: '',
      countries: [],
      genders: [],
      careerStages: [],
      affiliations: '',
      tags: []
    };
    setPendingFilters(emptyFilter);
    setAppliedFilters(emptyFilter);
    onSelectSegment('all');
  };

  // Filtered contacts calculation with applied filters
  const filteredContacts = useMemo(() => {
    return contacts.filter(contact => {
      // Search text match
      if (appliedFilters.search.trim()) {
        const query = appliedFilters.search.toLowerCase().trim();
        const matchName = contact.name?.toLowerCase().includes(query) || formatFullName(contact.firstName, contact.lastName).toLowerCase().includes(query);
        const matchAff = contact.affiliation?.toLowerCase().includes(query);
        const matchEmail = contact.email?.toLowerCase().includes(query);
        const matchFunction = contact.function?.toLowerCase().includes(query);
        const matchDepartment = contact.facultyDepartment?.toLowerCase().includes(query);
        if (!matchName && !matchAff && !matchEmail && !matchFunction && !matchDepartment) return false;
      }

      // Country of origin match
      if (appliedFilters.countries.length > 0 && !appliedFilters.countries.includes(contact.countryOfOrigin)) {
        return false;
      }

      // Gender match
      if (appliedFilters.genders.length > 0 && !appliedFilters.genders.includes(contact.gender)) {
        return false;
      }

      // Career stage match
      if (appliedFilters.careerStages.length > 0 && !appliedFilters.careerStages.includes(contact.researchCareerStage)) {
        return false;
      }

      // Affiliation match
      if (appliedFilters.affiliations.trim() && !(contact.affiliation || '').toLowerCase().includes(appliedFilters.affiliations.toLowerCase().trim())) {
        return false;
      }

      // Tags filter match
      if (appliedFilters.tags.length > 0) {
        const hasTag = contact.tags?.some(t => appliedFilters.tags.includes(t));
        if (!hasTag) return false;
      }

      return true;
    });
  }, [contacts, appliedFilters]);

  // Total pages and valid page calculation
  const totalPages = Math.max(1, Math.ceil(filteredContacts.length / itemsPerPage));
  const validCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  // Slice contacts for active page
  const paginatedContacts = useMemo(() => {
    const startIndex = (validCurrentPage - 1) * itemsPerPage;
    return filteredContacts.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredContacts, validCurrentPage, itemsPerPage]);

  // Select all checkbox handler for current page items
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedContactIds(paginatedContacts.map(c => c.id));
    } else {
      setSelectedContactIds([]);
    }
  };

  const handleSelectRow = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedContactIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // Helper to resolve tag color badge class
  const getTagBadgeStyle = (tagName: string) => {
    const found = tags.find(t => t.name.toLowerCase() === tagName.toLowerCase());
    if (found && found.color) return found.color;
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row lg:items-start min-h-[calc(100vh-64px)] w-full max-w-full bg-[#E8F1F8] relative">
      
      {/* Mobile / Slide-over Filter Backdrop (< lg) */}
      {isMobileFilterOpen && (
        <div 
          onClick={() => setIsMobileFilterOpen(false)}
          className="lg:hidden fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-40 animate-in fade-in duration-200"
        />
      )}

      {/* Left Sidebar Filter Panel (sticky on lg+, slide-over drawer below) */}
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
        ${isMobileFilterOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
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
                  handleResetFilters();
                  setIsMobileFilterOpen(false);
                }}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200/60 hover:text-[#005596] transition-colors cursor-pointer"
                title="Réinitialiser les filtres"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setIsMobileFilterOpen(false)}
                className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-200/60 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="space-y-5">
            {/* Country of Origin Pills */}
            <section>
              <label className="text-xs font-bold text-[#55636B] flex items-center gap-1.5 mb-2">
                <Globe className="w-4 h-4 text-[#005596]" /> Pays d'origine
              </label>
              <div className="flex flex-wrap gap-1.5">
                {countries.length === 0 && (
                  <span className="text-[11px] text-slate-400 italic">Aucun pays renseigné</span>
                )}
                {countries.map(country => {
                  const active = pendingFilters.countries.includes(country);
                  return (
                    <button
                      key={country}
                      onClick={() => toggleCountry(country)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                        active
                          ? 'bg-[#005596] text-white shadow-sm'
                          : 'bg-[#D9E6F2] text-[#55636B] hover:bg-[#BCD7EE]'
                      }`}
                    >
                      {country}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Gender Checkboxes */}
            <section>
              <label className="text-xs font-bold text-[#55636B] flex items-center gap-1.5 mb-2">
                <Users className="w-4 h-4 text-[#005596]" /> Genre
              </label>
              <div className="space-y-2 bg-white/60 p-3 rounded-xl border border-[#C9D4DE]/40">
                {genders.map(gender => {
                  const checked = pendingFilters.genders.includes(gender);
                  return (
                    <label key={gender} className="flex items-center gap-2 cursor-pointer text-xs text-[#1C2529] hover:text-[#005596]">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleGender(gender)}
                        className="rounded border-[#C9D4DE] text-[#005596] focus:ring-[#005596] w-4 h-4 cursor-pointer"
                      />
                      <span className={checked ? 'font-bold text-[#005596]' : 'font-medium'}>{GENDER_LABELS[gender as Gender]}</span>
                    </label>
                  );
                })}
              </div>
            </section>

            {/* Career Stage Checkboxes */}
            <section>
              <label className="text-xs font-bold text-[#55636B] flex items-center gap-1.5 mb-2">
                <Bookmark className="w-4 h-4 text-[#005596]" /> Stade de carrière
              </label>
              <div className="space-y-2 bg-white/60 p-3 rounded-xl border border-[#C9D4DE]/40">
                {allCareerStages.map(stage => {
                  const checked = pendingFilters.careerStages.includes(stage);
                  return (
                    <label key={stage} className="flex items-center gap-2 cursor-pointer text-xs text-[#1C2529] hover:text-[#005596]">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleCareerStage(stage)}
                        className="rounded border-[#C9D4DE] text-[#005596] focus:ring-[#005596] w-4 h-4 cursor-pointer"
                      />
                      <span className={checked ? 'font-bold text-[#005596]' : 'font-medium'}>{CAREER_STAGE_SHORT_LABELS[stage as ResearchCareerStage]}</span>
                    </label>
                  );
                })}
              </div>
            </section>

            {/* Affiliation Search */}
            <section>
              <label className="text-xs font-bold text-[#55636B] flex items-center gap-1.5 mb-2">
                <Map className="w-4 h-4 text-[#005596]" /> Affiliation
              </label>
              <input
                type="text"
                value={pendingFilters.affiliations}
                onChange={(e) => updatePendingFilters(prev => ({ ...prev, affiliations: e.target.value }))}
                placeholder="Rechercher une affiliation..."
                className="w-full rounded-xl border border-[#C9D4DE] bg-white text-xs p-2.5 font-semibold text-[#1C2529] focus:ring-2 focus:ring-[#005596] shadow-xs"
              />
            </section>

            {/* Filter by Tags */}
            <section>
              <label className="text-xs font-bold text-[#55636B] flex items-center gap-1.5 mb-2">
                <TagIcon className="w-4 h-4 text-[#005596]" /> Étiquettes / Tags
              </label>
              <div className="flex flex-wrap gap-1.5">
                {tags.map(t => {
                  const active = pendingFilters.tags.includes(t.name);
                  return (
                    <button
                      key={t.id}
                      onClick={() => toggleTag(t.name)}
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

          {/* Sidebar Action Buttons (end of content) */}
          <div className="pt-4 border-t border-[#C9D4DE] space-y-2.5">
            {/* Appliquer les filtres */}
            <button 
              onClick={() => {
                handleApplyFilters();
                setIsMobileFilterOpen(false);
              }}
              className="w-full py-3 px-4 bg-[#004275] hover:bg-[#003B66] text-white rounded-2xl text-xs font-extrabold flex items-center justify-start gap-3 shadow-xs transition-all active:scale-95 cursor-pointer"
            >
              <Filter className="w-4 h-4 text-white stroke-[2.5]" />
              <span>Appliquer les filtres</span>
            </button>

            {/* Enregistrer comme segment */}
            <button 
              onClick={() => {
                setIsSaveSegmentModalOpen(true);
                setIsMobileFilterOpen(false);
              }}
              className="w-full py-2.5 px-4 bg-[#E8F1F8] hover:bg-[#D9E6F2] text-[#004275] rounded-2xl text-xs font-extrabold flex items-center justify-start gap-3 transition-all active:scale-95 cursor-pointer"
              title="Enregistrer les filtres appliqués comme nouveau segment"
            >
              <Save className="w-4 h-4 text-[#004275] stroke-[2.5]" />
              <span>Enregistrer comme segment</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area (Unified page scroll) */}
      <main className="flex-1 min-w-0 w-full max-w-full p-3 sm:p-6 lg:p-8 relative space-y-6">
        
        {/* Contextual Search Bar & Mobile / Collapse Filter Trigger (< 1600px) */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
          
          <div className="flex items-center gap-2 flex-1 w-full">
            <button
              onClick={() => setIsMobileFilterOpen(true)}
              className="min-[1600px]:hidden flex items-center gap-1.5 px-3.5 py-2.5 bg-[#005596] hover:bg-[#004275] text-white rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer shadow-xs"
              title="Afficher les filtres"
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>Filtres</span>
            </button>

            <div className="flex-1 relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text"
                value={pendingFilters.search}
                onChange={(e) => {
                  const val = e.target.value;
                  updatePendingFilters(prev => ({ ...prev, search: val }));
                  setAppliedFilters(prev => ({ ...prev, search: val }));
                }}
                placeholder="Rechercher par nom, e-mail, affiliation, fonction..."
                className="w-full pl-10 pr-4 py-2.5 bg-[#E8F1F8] border-none rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#005596]"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 justify-end">
            <Link 
              to="/contacts/new"
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#005596] hover:bg-[#004275] text-white font-bold text-xs rounded-xl shadow-sm hover:shadow transition-all active:scale-95 cursor-pointer w-full sm:w-auto"
            >
              <UserPlus className="w-4 h-4" />
              <span>Nouveau Contact</span>
            </Link>
          </div>
        </div>

        {/* SEGMENTS QUICK-ACCESS BAR WITH SCROLL NAVIGATION */}
        <div className="bg-white p-2.5 sm:p-3 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-2">
          {/* Left Scroll Button */}
          <button
            type="button"
            disabled={!canScrollLeft}
            onClick={() => {
              if (segmentsRef.current) {
                segmentsRef.current.scrollBy({ left: -200, behavior: 'smooth' });
              }
            }}
            className={`p-2 rounded-xl bg-slate-100 transition-colors shrink-0 shadow-2xs ${
              canScrollLeft
                ? 'hover:bg-[#D9E6F2] text-[#005596] cursor-pointer'
                : 'opacity-40 cursor-not-allowed text-slate-400'
            }`}
            title="Défiler les segments vers la gauche"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Scrollable Container */}
          <div 
            ref={segmentsRef}
            className="flex items-center gap-2 overflow-x-auto scrollbar-none scroll-smooth flex-1 py-0.5"
          >
            {displaySegments.map(seg => {
              const isActive = seg.id === 'all'
                ? (activeSegmentId === 'all' && !isAnyCustomFilterActive)
                : (activeSegmentId === seg.id);
              return (
                <button
                  key={seg.id}
                  onClick={() => {
                    if (seg.id === 'all') {
                      handleResetFilters();
                    }
                    onSelectSegment(seg.id);
                  }}
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

          {/* Right Scroll Button */}
          <button
            type="button"
            disabled={!canScrollRight}
            onClick={() => {
              if (segmentsRef.current) {
                segmentsRef.current.scrollBy({ left: 200, behavior: 'smooth' });
              }
            }}
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

        {/* Contacts Container */}
        {isLoading ? (
          <ContactsTableSkeleton />
        ) : (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-200">
            
            {/* Desktop / Tablet Table View (Hidden on mobile <768px) */}
            <div className="hidden md:block w-full overflow-hidden">
              <table className="w-full text-left border-collapse table-fixed max-w-full">
                <thead className="bg-[#D9E6F2]/50 border-b border-[#C9D4DE] text-[11px] font-bold text-[#55636B] uppercase tracking-wider">
                  <tr>
                    <th className="p-3 w-10 text-center shrink-0">
                      <input 
                        type="checkbox"
                        checked={paginatedContacts.length > 0 && paginatedContacts.every(c => selectedContactIds.includes(c.id))}
                        onChange={handleSelectAll}
                        className="rounded text-[#005596] focus:ring-[#005596] border-[#C9D4DE] w-4 h-4 cursor-pointer"
                      />
                    </th>
                    <th className="p-3 w-[30%] md:w-[28%] lg:w-[22%] truncate" title="Nom et e-mail du contact">CONTACT</th>
                    <th className="p-3 w-[20%] md:w-[18%] lg:w-[14%] truncate" title="Pays d'origine et ville">PAYS & VILLE</th>
                    <th className="p-3 w-[25%] md:w-[22%] lg:w-[18%] truncate" title="Affiliation et fonction">AFFILIATION & FONCTION</th>
                    <th className="p-3 hidden lg:table-cell lg:w-[12%] truncate" title="Stade de carrière">STADE DE CARRIÈRE</th>
                    <th className="p-3 hidden lg:table-cell lg:w-[10%] truncate" title="Genre">GENRE</th>
                    <th className="p-3 w-[24%] md:w-[22%] lg:w-[14%] truncate" title="Tags">TAGS</th>
                    <th className="p-3 w-20 text-right shrink-0">ACTIONS</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#C9D4DE]/30 text-xs">
                  {filteredContacts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-12 text-center text-slate-500">
                        <p className="font-bold text-slate-700 text-sm">Aucun contact ne correspond à ces critères</p>
                        <button 
                          onClick={handleResetFilters}
                          className="mt-3 px-4 py-2 bg-[#005596] hover:bg-[#004275] text-white rounded-xl font-bold text-xs cursor-pointer shadow-xs"
                        >
                          Réinitialiser tous les filtres
                        </button>
                      </td>
                    </tr>
                  ) : (
                    paginatedContacts.map(contact => {
                      const isSelected = selectedContactIds.includes(contact.id);
                      const contactTags = contact.tags || [];
                      const visibleTags = contactTags.slice(0, 2);
                      const hiddenCount = contactTags.length - 2;

                      return (
                        <tr 
                          key={contact.id}
                          onClick={() => setQuickDrawerContact(contact)}
                          className={`hover:bg-[#E8F1F8]/60 transition-colors cursor-pointer group ${
                            isSelected ? 'bg-[#E8F1F8]' : ''
                          }`}
                        >
                          <td className="p-3 sm:p-4" onClick={(e) => { e.stopPropagation(); handleSelectRow(contact.id, e); }}>
                            <input 
                              type="checkbox" 
                              checked={isSelected}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                e.stopPropagation();
                                handleSelectRow(contact.id, e as unknown as React.MouseEvent);
                              }}
                              className="rounded text-[#005596] focus:ring-[#005596] border-[#C9D4DE] w-4 h-4 cursor-pointer"
                            />
                          </td>

                          {/* Contact Name & Avatar */}
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

                          {/* Pays & Ville */}
                          <td className="p-3 sm:p-4 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <Flag className="w-3.5 h-3.5 text-[#8A98A1] shrink-0" />
                              <span className="font-semibold text-[#1C2529] truncate" title={contact.countryOfOrigin}>{fmt(contact.countryOfOrigin)}</span>
                            </div>
                            <div className="text-[11px] text-[#8A98A1] truncate pl-5" title={contact.city}>{fmt(contact.city)}</div>
                          </td>

                          {/* Affiliation & Fonction */}
                          <td className="p-3 sm:p-4 min-w-0">
                            <div className="font-semibold text-[#1C2529] truncate" title={contact.affiliation}>{fmt(contact.affiliation)}</div>
                            <div className="text-[11px] text-[#8A98A1] truncate" title={contact.function}>{fmt(contact.function)}</div>
                          </td>

                          {/* Stade de carrière (Hidden on tablet, shown on lg) */}
                          <td className="p-3 sm:p-4 hidden lg:table-cell">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap ${
                                contact.researchCareerStage === 'R1_FIRST_STAGE'
                                  ? 'bg-slate-100 text-[#55636B]'
                                  : contact.researchCareerStage === 'R2_RECOGNIZED'
                                    ? 'bg-[#005596]/10 text-[#005596]'
                                    : contact.researchCareerStage === 'R3_ESTABLISHED'
                                      ? 'bg-[#B8167C]/10 text-[#B8167C]'
                                      : 'bg-[#FFC20C]/20 text-[#8a6d00]'
                              }`}
                              title={CAREER_STAGE_LABELS[contact.researchCareerStage]}
                            >
                              {CAREER_STAGE_SHORT_LABELS[contact.researchCareerStage]}
                            </span>
                          </td>

                          {/* Genre (Hidden on tablet, shown on lg) */}
                          <td className="p-3 sm:p-4 hidden lg:table-cell">
                            <span className="px-2.5 py-1 bg-[#E8F1F8] text-[#005596] rounded-full text-[11px] font-bold whitespace-nowrap">
                              {GENDER_LABELS[contact.gender]}
                            </span>
                          </td>

                          {/* TAGS Column */}
                          <td className="p-3 sm:p-4 min-w-0" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-1 relative flex-wrap">
                              {visibleTags.map((tName, idx) => (
                                <span 
                                  key={idx} 
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${getTagBadgeStyle(tName)} shadow-2xs truncate max-w-[80px]`}
                                  title={tName}
                                >
                                  {tName}
                                </span>
                              ))}

                              {hiddenCount > 0 && (
                                <div className="relative">
                                  <button
                                    onClick={() => setPopoverContactId(popoverContactId === contact.id ? null : contact.id)}
                                    className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full text-[10px] font-extrabold border border-slate-300 cursor-pointer"
                                  >
                                    +{hiddenCount}
                                  </button>

                                  {/* Popover for extra tags */}
                                  {popoverContactId === contact.id && (
                                    <div className="absolute left-0 mt-1 z-30 bg-white p-2.5 rounded-xl shadow-xl border border-slate-200 w-48 space-y-1 text-xs animate-in fade-in">
                                      <p className="font-bold text-[10px] uppercase text-slate-400 mb-1">Tous les tags:</p>
                                      <div className="flex flex-wrap gap-1">
                                        {contactTags.map((tName, idx) => (
                                          <span 
                                            key={idx} 
                                            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${getTagBadgeStyle(tName)}`}
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

                          {/* Actions */}
                          <td className="p-3 sm:p-4 text-right shrink-0" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-end gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => onSelectContact(contact.id)}
                                className="p-1.5 hover:bg-[#005596]/20 rounded-lg text-[#005596] cursor-pointer" 
                                title="Voir la fiche détaillée"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </button>
                              <Link 
                                to={`/contacts/${contact.id}/edit`}
                                className="p-1.5 hover:bg-[#005596]/20 rounded-lg text-[#005596] cursor-pointer" 
                                title="Modifier"
                              >
                                <Edit className="w-4 h-4" />
                              </Link>
                              {onDeleteContact && (
                                <button 
                                  onClick={() => onDeleteContact(contact.id)}
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
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List View (Visible on small screens) */}
            <div className="block md:hidden divide-y divide-slate-100">
              {filteredContacts.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  <p className="font-bold text-slate-700 text-sm">Aucun contact trouvé</p>
                  <button 
                    onClick={handleResetFilters}
                    className="mt-3 px-4 py-2 bg-[#005596] text-white rounded-xl font-bold text-xs cursor-pointer"
                  >
                    Réinitialiser les filtres
                  </button>
                </div>
              ) : (
                paginatedContacts.map(contact => {
                  const isSelected = selectedContactIds.includes(contact.id);
                  const contactTags = contact.tags || [];

                  return (
                    <div 
                      key={contact.id}
                      onClick={() => setQuickDrawerContact(contact)}
                      className={`p-4 space-y-3 cursor-pointer hover:bg-slate-50 transition-colors ${
                        isSelected ? 'bg-[#E8F1F8]/60' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <input 
                            type="checkbox" 
                            checked={isSelected}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleSelectRow(contact.id, e as unknown as React.MouseEvent);
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
                          <span className="font-semibold text-slate-800">{fmt(contact.affiliation)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold uppercase text-slate-400 block">Pays & Ville</span>
                          <span className="font-semibold text-slate-800">{[contact.countryOfOrigin, contact.city].filter(v => hasVal(v)).join(', ') || dash}</span>
                        </div>
                      </div>

                      {/* Career stage & Tags */}
                      <div className="flex flex-wrap gap-1 items-center">
                        <span className="px-2 py-0.5 bg-[#D9E6F2] text-[#55636B] rounded-full text-[10px] font-bold">
                          {CAREER_STAGE_SHORT_LABELS[contact.researchCareerStage]}
                        </span>
                        {contactTags.map((tName, idx) => (
                          <span 
                            key={idx} 
                            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${getTagBadgeStyle(tName)}`}
                          >
                            {tName}
                          </span>
                        ))}
                      </div>

                      {/* Mobile Card Action Footer */}
                      <div className="pt-2 flex items-center justify-between border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
                        <span className="text-[11px] text-slate-500 font-medium truncate">{hasVal(contact.function) ? contact.function : hasVal(contact.affiliation) ? contact.affiliation : dash}</span>
                        
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => onSelectContact(contact.id)}
                            className="px-2.5 py-1 bg-[#E8F1F8] text-[#005596] rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <ExternalLink className="w-3.5 h-3.5" /> Voir
                          </button>
                          <Link 
                            to={`/contacts/${contact.id}/edit`}
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-[#005596] cursor-pointer" 
                          >
                            <Edit className="w-4 h-4" />
                          </Link>
                          {onDeleteContact && (
                            <button 
                              onClick={() => onDeleteContact(contact.id)}
                              className="p-1.5 hover:bg-red-50 rounded-lg text-red-600 cursor-pointer" 
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

          {/* Pagination */}
          <div className="px-6 py-3 bg-[#E8F1F8] border-t border-[#C9D4DE] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#55636B]">
            <div>
              Affichage de <span className="font-bold text-[#005596]">
                {filteredContacts.length === 0 ? 0 : (validCurrentPage - 1) * itemsPerPage + 1} - {Math.min(validCurrentPage * itemsPerPage, filteredContacts.length)}
              </span> sur <span className="font-bold text-[#005596]">{filteredContacts.length}</span> contacts
              {filteredContacts.length !== contacts.length && (
                <span className="text-[#8A98A1] ml-1">({contacts.length} au total)</span>
              )}
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
                    setCurrentPage(1);
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
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={validCurrentPage === 1}
                  className="p-1 hover:bg-[#E8F1F8] rounded disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed transition-colors"
                  title="Page précédente"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-7 h-7 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                      pageNum === validCurrentPage
                        ? 'bg-[#005596] text-white shadow-xs'
                        : 'hover:bg-[#D9E6F2] text-[#55636B]'
                    }`}
                  >
                    {pageNum}
                  </button>
                ))}

                <button 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={validCurrentPage >= totalPages}
                  className="p-1 hover:bg-[#E8F1F8] rounded disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed transition-colors"
                  title="Page suivante"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

        {/* Floating Selection Action Bar */}
        {selectedContactIds.length > 0 && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-[#1C2529] text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-6 z-40 animate-slide-up">
            <div className="flex items-center gap-2">
              <span className="bg-[#005596] px-2.5 py-0.5 rounded-full text-xs font-bold">
                {selectedContactIds.length}
              </span>
              <span className="text-xs font-medium text-[#E8F1F8]">Contacts sélectionnés</span>
            </div>

            <div className="h-5 w-px bg-white/20" />

            <div className="flex items-center gap-4 text-xs font-bold">
              <Link 
                to="/export"
                className="flex items-center gap-1.5 hover:text-[#FFC20C] transition-colors"
              >
                <Download className="w-4 h-4" /> Exporter
              </Link>
              <Link 
                to="/segments"
                className="flex items-center gap-1.5 hover:text-[#FFC20C] transition-colors"
              >
                <TagIcon className="w-4 h-4" /> Ajouter des tags
              </Link>
            </div>

            <button 
              onClick={() => setSelectedContactIds([])}
              className="p-1 hover:bg-white/10 rounded-full transition-colors ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

      </main>

      {/* Slide-over Profile Quick Drawer */}
      {quickDrawerContact && (
        <Modal open={quickDrawerContact !== null} onClose={() => setQuickDrawerContact(null)} variant="drawer" noPadding>
          <div className="p-6 flex flex-col justify-between min-h-full cursor-default">
            
            <div>
              <div className="flex justify-between items-start mb-6">
                <div className="flex flex-col items-center text-center w-full">
                  <div className="w-24 h-24 rounded-full bg-[#005596]/20 p-1 mb-3 relative">
                    {quickDrawerContact.avatarUrl ? (
                      <img src={quickDrawerContact.avatarUrl} alt={quickDrawerContact.name} className="w-full h-full object-cover rounded-full" />
                    ) : (
                      <div className="w-full h-full rounded-full bg-[#005596] text-white flex items-center justify-center font-bold text-xl">
                        {quickDrawerContact.initials}
                      </div>
                    )}
                  </div>
                  <h2 className="text-xl font-bold text-[#1C2529]">{quickDrawerContact.name}</h2>
                  <p className="text-xs text-[#005596] font-bold mt-0.5">{fmt(quickDrawerContact.function)}</p>
                  <p className="text-xs text-[#55636B]">{fmt(quickDrawerContact.affiliation)}</p>
                  <span className="inline-block mt-2 px-2.5 py-1 bg-[#D9E6F2] text-[#005596] rounded-full text-[11px] font-bold">
                    {CAREER_STAGE_LABELS[quickDrawerContact.researchCareerStage]}
                  </span>
                </div>

                <button 
                  onClick={() => setQuickDrawerContact(null)}
                  className="p-1.5 hover:bg-[#E8F1F8] rounded-full text-slate-500 transition-colors absolute right-4 top-4"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Contact Details */}
                <section className="bg-[#E8F1F8]/50 p-4 rounded-xl">
                  <h3 className="text-xs font-bold text-[#005596] uppercase tracking-wider mb-3">Coordonnées</h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-3 text-[#55636B]">
                      <Mail className="w-4 h-4 text-[#005596]" />
                      <span>{quickDrawerContact.email}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[#55636B]">
                      <Phone className="w-4 h-4 text-[#005596]" />
                      <span>{fmt(quickDrawerContact.phone)}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[#55636B]">
                      <Globe className="w-4 h-4 text-[#005596]" />
                      <span>Pays: {fmt(quickDrawerContact.countryOfOrigin)}{hasVal(quickDrawerContact.city) ? ` · ${quickDrawerContact.city}` : ''}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[#55636B]">
                      <Users className="w-4 h-4 text-[#005596]" />
                      <span>Genre: {GENDER_LABELS[quickDrawerContact.gender]}</span>
                    </div>
                  </div>
                </section>

                {/* Tags Section */}
                <section>
                  <h3 className="text-xs font-bold text-[#1C2529] mb-2 flex items-center justify-between">
                    <span>Étiquettes / Tags</span>
                    <Link 
                      to="/segments"
                      onClick={() => setQuickDrawerContact(null)}
                      className="text-[11px] text-[#005596] hover:underline font-bold"
                    >
                      Gérer
                    </Link>
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {quickDrawerContact.tags && quickDrawerContact.tags.length > 0 ? (
                      quickDrawerContact.tags.map((tName, idx) => (
                        <span key={idx} className={`px-2.5 py-1 rounded-full text-xs font-extrabold border ${getTagBadgeStyle(tName)}`}>
                          {tName}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400 italic">Aucun tag attribué</span>
                    )}
                  </div>
                </section>

                {/* R&I Profile Details */}
                <section>
                  <h3 className="text-xs font-bold text-[#1C2529] mb-3">Profil R&I</h3>
                  <div className="space-y-2 text-xs text-[#55636B] bg-[#F4F6F8] p-4 rounded-xl border border-[#C9D4DE]/40">
                    <div className="flex justify-between gap-2">
                      <span className="font-bold text-[#1C2529]">Stade de carrière:</span>
                      <span className="text-right">{CAREER_STAGE_LABELS[quickDrawerContact.researchCareerStage]}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="font-bold text-[#1C2529]">Expérience:</span>
                      <span className="text-right">{fmt(quickDrawerContact.experience)}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="font-bold text-[#1C2529]">Faculté / Dépt:</span>
                      <span className="text-right">{fmt(quickDrawerContact.facultyDepartment)}</span>
                    </div>
                  </div>
                </section>
              </div>
            </div>

            <div className="pt-6 border-t border-[#C9D4DE] mt-6 flex gap-2">
              <Link 
                to={`/contacts/${quickDrawerContact.id}/edit`}
                onClick={() => setQuickDrawerContact(null)}
                className="px-4 py-3 bg-[#BCD7EE] text-[#005596] hover:bg-[#3F88C4] font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
              >
                <Edit className="w-4 h-4" />
                Modifier
              </Link>
              <button 
                onClick={() => {
                  const id = quickDrawerContact.id;
                  setQuickDrawerContact(null);
                  onSelectContact(id);
                }}
                className="flex-1 py-3 bg-[#005596] hover:bg-[#004275] text-white font-bold text-xs rounded-xl shadow transition-all active:scale-95 cursor-pointer"
              >
                Voir la fiche complète
              </button>
            </div>

          </div>
        </Modal>
      )}

      {/* SAVE SEGMENT MODAL */}
      {isSaveSegmentModalOpen && (
        <Modal
          open={isSaveSegmentModalOpen}
          onClose={() => setIsSaveSegmentModalOpen(false)}
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

            <form onSubmit={handleSaveSegmentSubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Nom du Segment *</label>
                <input
                  type="text"
                  required
                  value={newSegmentNameInput}
                  onChange={(e) => setNewSegmentNameInput(e.target.value)}
                  placeholder="ex: Experts Santé Afrique 2024"
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#005596] font-semibold text-[#1C2529]"
                  autoFocus
                />
              </div>

              <div className="bg-[#E8F1F8]/50 p-3.5 rounded-xl border border-[#C9D4DE]/30 text-slate-600">
                <p className="font-bold text-[#005596] mb-1.5 text-xs">Filtres actuellement appliqués:</p>
                <ul className="list-disc list-inside space-y-1 text-[11px] font-medium">
                  {appliedFilters.search && <li>Recherche: "{appliedFilters.search}"</li>}
                  {appliedFilters.countries.length > 0 && <li>Pays d'origine: {appliedFilters.countries.join(', ')}</li>}
                  {appliedFilters.genders.length > 0 && <li>Genres: {appliedFilters.genders.map(g => GENDER_LABELS[g as Gender]).join(', ')}</li>}
                  {appliedFilters.careerStages.length > 0 && <li>Stades de carrière: {appliedFilters.careerStages.map(s => CAREER_STAGE_SHORT_LABELS[s as ResearchCareerStage]).join(', ')}</li>}
                  {appliedFilters.affiliations && <li>Affiliation: {appliedFilters.affiliations}</li>}
                  {appliedFilters.tags.length > 0 && <li>Tags: {appliedFilters.tags.join(', ')}</li>}
                  {!appliedFilters.search && appliedFilters.countries.length === 0 && appliedFilters.genders.length === 0 && appliedFilters.careerStages.length === 0 && !appliedFilters.affiliations && appliedFilters.tags.length === 0 && (
                    <li className="italic text-slate-500">Tous les contacts (aucun filtre restreint)</li>
                  )}
                </ul>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsSaveSegmentModalOpen(false)}
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
      )}

    </div>
  );
};
