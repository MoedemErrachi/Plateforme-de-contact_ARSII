import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { ViewPage, Contact, FilterState, Segment, Tag as TagType } from '../types';
import { 
  Search, 
  SlidersHorizontal, 
  Filter,
  Save,
  Globe, 
  Map, 
  Brain, 
  Users, 
  Settings, 
  HelpCircle, 
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
  GitMerge, 
  Mail, 
  Phone, 
  ExternalLink,
  RotateCcw,
  PlusCircle,
  Layers,
  Sparkles,
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
  onNavigate: (page: ViewPage) => void;
  onSelectContact: (contactId: string) => void;
  onDeleteContact?: (contactId: string) => void;
  itemsPerPage?: number;
  onItemsPerPageChange?: (newLimit: number) => void;
  onEditContact?: (contact: Contact) => void;
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
  onNavigate,
  onSelectContact,
  onDeleteContact,
  itemsPerPage = 10,
  onItemsPerPageChange,
  onEditContact,
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
    headquarters: 'Tous les pays',
    zones: [],
    expertises: [],
    actorTypes: [],
    tags: []
  });

  // Applied Filters State (used to filter contacts table)
  const [appliedFilters, setAppliedFilters] = useState<FilterState>({
    search: '',
    headquarters: 'Tous les pays',
    zones: [],
    expertises: [],
    actorTypes: [],
    tags: []
  });

  // Debounced search term for real-time text input
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(pendingFilters.search);
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

  // Settings & Support Modals State
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [supportMessage, setSupportMessage] = useState({ subject: '', body: '' });
  const [supportSubmitted, setSupportSubmitted] = useState(false);
  
  // Settings preferences state
  const [settingsPrefs, setSettingsPrefs] = useState({
    emailAlerts: true,
    defaultItemsPerPage: 20,
    autoSync: true,
    theme: 'Clair (R&I Standard)'
  });
  const [settingsSaved, setSettingsSaved] = useState(false);

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

  // Determine if any custom filter is active (search, country, zones, expertises, actor types, tags)
  const isAnyCustomFilterActive = useMemo(() => {
    return (
      appliedFilters.search.trim() !== '' ||
      appliedFilters.headquarters !== 'Tous les pays' ||
      appliedFilters.zones.length > 0 ||
      appliedFilters.expertises.length > 0 ||
      appliedFilters.actorTypes.length > 0 ||
      appliedFilters.tags.length > 0
    );
  }, [appliedFilters]);

  // Expanded tags popover ID
  const [popoverContactId, setPopoverContactId] = useState<string | null>(null);

  // Available Filter Options
  const countries = ['Tous les pays', 'France', 'Tunisie', 'Sénégal', 'Maroc', 'Allemagne', 'Belgique'];
  const allZones = ['Afrique Subsaharienne', 'Afrique du Nord', 'Union Européenne'];
  const allExpertises = ['Agriculture', 'Santé', 'Climat', 'IA & Data', 'Maladies Tropicales', 'Épidémiologie'];
  const allActorTypes = ['Labo de recherche', 'ONG', 'Université', 'PME', 'Institutionnel'];

  // Helper to handle pending filter updates and deselect active segment
  const updatePendingFilters = (updater: (prev: FilterState) => FilterState) => {
    setPendingFilters(prev => updater(prev));
    if (activeSegmentId !== 'all') {
      onSelectSegment('all');
    }
  };

  // Toggle helpers for sidebar pending filters
  const toggleZone = (zone: string) => {
    updatePendingFilters(prev => ({
      ...prev,
      zones: prev.zones.includes(zone) 
        ? prev.zones.filter(z => z !== zone) 
        : [...prev.zones, zone]
    }));
  };

  const toggleExpertise = (exp: string) => {
    updatePendingFilters(prev => ({
      ...prev,
      expertises: prev.expertises.includes(exp) 
        ? prev.expertises.filter(e => e !== exp) 
        : [...prev.expertises, exp]
    }));
  };

  const toggleActorType = (type: string) => {
    updatePendingFilters(prev => ({
      ...prev,
      actorTypes: prev.actorTypes.includes(type) 
        ? prev.actorTypes.filter(t => t !== type) 
        : [...prev.actorTypes, type]
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
      headquarters: 'Tous les pays',
      zones: [],
      expertises: [],
      actorTypes: [],
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
        const matchName = contact.name.toLowerCase().includes(query);
        const matchOrg = contact.organization.toLowerCase().includes(query);
        const matchEmail = contact.email.toLowerCase().includes(query);
        const matchRole = contact.title.toLowerCase().includes(query);
        if (!matchName && !matchOrg && !matchEmail && !matchRole) return false;
      }

      // Headquarters match
      if (appliedFilters.headquarters !== 'Tous les pays' && contact.country !== appliedFilters.headquarters) {
        return false;
      }

      // Actor type filter match
      if (appliedFilters.actorTypes.length > 0 && !appliedFilters.actorTypes.includes(contact.actorType)) {
        return false;
      }

      // Zones filter match
      if (appliedFilters.zones.length > 0) {
        const hasZone = contact.interventionZones.some(z => appliedFilters.zones.includes(z));
        if (!hasZone) return false;
      }

      // Expertises filter match
      if (appliedFilters.expertises.length > 0) {
        const hasExp = contact.expertise.some(e => appliedFilters.expertises.includes(e));
        if (!hasExp) return false;
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
    if (found) return found.color;
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  return (
    <div className="flex-1 flex flex-col min-[1600px]:flex-row min-h-[calc(100vh-64px)] w-full max-w-full bg-[#dff9f8] relative">
      
      {/* Mobile / Slide-over Filter Backdrop (< 1600px) */}
      {isMobileFilterOpen && (
        <div 
          onClick={() => setIsMobileFilterOpen(false)}
          className="min-[1600px]:hidden fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-40 animate-in fade-in duration-200"
        />
      )}

      {/* Left Sidebar Filter Drawer (Non-scrollable Lock, sticky top-16 >= 1600px) */}
      <aside className={`
        fixed min-[1600px]:sticky top-0 min-[1600px]:top-16 inset-y-0 min-[1600px]:inset-y-auto left-0 z-40 min-[1600px]:z-30 w-[280px] sm:w-80 h-full min-[1600px]:h-[calc(100vh-64px)] bg-[#e4fffe] border-r border-[#bcc9c7] p-5 flex flex-col justify-between shrink-0 overflow-hidden transition-transform duration-300 shadow-2xl min-[1600px]:shadow-none
        ${isMobileFilterOpen ? 'translate-x-0' : '-translate-x-full min-[1600px]:translate-x-0'}
      `}>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-[#006a66]">Filtres</h2>
              <p className="text-[10px] font-bold text-[#3d4948] uppercase tracking-wider">
                Sélectionnez vos critères
              </p>
            </div>
            <button 
              onClick={() => setIsMobileFilterOpen(false)}
              className="min-[1600px]:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-200/60 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-5">
            {/* Siège / HQ Select */}
            <section>
              <label className="text-xs font-bold text-[#3d4948] flex items-center gap-1.5 mb-2">
                <Globe className="w-4 h-4 text-[#006a66]" /> Siège social
              </label>
              <select 
                value={pendingFilters.headquarters}
                onChange={(e) => updatePendingFilters(prev => ({ ...prev, headquarters: e.target.value }))}
                className="w-full rounded-xl border border-[#bcc9c7] bg-white text-xs p-2.5 font-semibold text-[#071f1f] focus:ring-2 focus:ring-[#006a66] cursor-pointer shadow-xs"
              >
                {countries.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </section>

            {/* Zone d'action Checkboxes */}
            <section>
              <label className="text-xs font-bold text-[#3d4948] flex items-center gap-1.5 mb-2">
                <Map className="w-4 h-4 text-[#006a66]" /> Zone d'intervention
              </label>
              <div className="space-y-2 bg-white/60 p-3 rounded-xl border border-[#bcc9c7]/40">
                {allZones.map(zone => {
                  const checked = pendingFilters.zones.includes(zone);
                  return (
                    <label key={zone} className="flex items-center gap-2 cursor-pointer text-xs text-[#071f1f] hover:text-[#006a66]">
                      <input 
                        type="checkbox" 
                        checked={checked}
                        onChange={() => toggleZone(zone)}
                        className="rounded border-[#bcc9c7] text-[#006a66] focus:ring-[#006a66] w-4 h-4 cursor-pointer"
                      />
                      <span className={checked ? 'font-bold text-[#006a66]' : 'font-medium'}>{zone}</span>
                    </label>
                  );
                })}
              </div>
            </section>

            {/* Expertise Tags */}
            <section>
              <label className="text-xs font-bold text-[#3d4948] flex items-center gap-1.5 mb-2">
                <Brain className="w-4 h-4 text-[#006a66]" /> Domaine d'expertise
              </label>
              <div className="flex flex-wrap gap-1.5">
                {allExpertises.map(exp => {
                  const active = pendingFilters.expertises.includes(exp);
                  return (
                    <button
                      key={exp}
                      onClick={() => toggleExpertise(exp)}
                      className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                        active 
                          ? 'bg-[#006a66] text-white shadow-sm' 
                          : 'bg-[#cee8e7] text-[#3d4948] hover:bg-[#abece7]'
                      }`}
                    >
                      {exp}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Type d'acteur Checkboxes */}
            <section>
              <label className="text-xs font-bold text-[#3d4948] flex items-center gap-1.5 mb-2">
                <Users className="w-4 h-4 text-[#006a66]" /> Type d'acteur
              </label>
              <div className="space-y-2 bg-white/60 p-3 rounded-xl border border-[#bcc9c7]/40">
                {allActorTypes.map(type => {
                  const checked = pendingFilters.actorTypes.includes(type);
                  return (
                    <label key={type} className="flex items-center gap-2 cursor-pointer text-xs text-[#071f1f] hover:text-[#006a66]">
                      <input 
                        type="checkbox" 
                        checked={checked}
                        onChange={() => toggleActorType(type)}
                        className="rounded border-[#bcc9c7] text-[#006a66] focus:ring-[#006a66] w-4 h-4 cursor-pointer"
                      />
                      <span className={checked ? 'font-bold text-[#006a66]' : 'font-medium'}>{type}</span>
                    </label>
                  );
                })}
              </div>
            </section>

            {/* Filter by Tags */}
            <section>
              <label className="text-xs font-bold text-[#3d4948] flex items-center gap-1.5 mb-2">
                <TagIcon className="w-4 h-4 text-[#006a66]" /> Étiquettes / Tags
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
                          ? 'bg-[#006a66] text-white border-[#006a66] shadow' 
                          : `${t.color} hover:opacity-90`
                      }`}
                    >
                      {t.name}
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        </div>

        {/* Sidebar Footer Buttons */}
        <div className="pt-4 border-t border-[#bcc9c7] mt-6 space-y-2.5">
          {/* Appliquer les filtres */}
          <button 
            onClick={() => {
              handleApplyFilters();
              setIsMobileFilterOpen(false);
            }}
            className="w-full py-3 px-4 bg-[#005f5a] hover:bg-[#004f4a] text-white rounded-2xl text-xs font-extrabold flex items-center justify-start gap-3 shadow-xs transition-all active:scale-95 cursor-pointer"
          >
            <Filter className="w-4 h-4 text-white stroke-[2.5]" />
            <span>Appliquer les filtres</span>
          </button>

          {/* Réinitialiser les filtres */}
          <button 
            onClick={() => {
              handleResetFilters();
              setIsMobileFilterOpen(false);
            }}
            className="w-full py-2.5 px-4 bg-white hover:bg-slate-100 text-slate-700 border border-[#bcc9c7] rounded-2xl text-xs font-extrabold flex items-center justify-start gap-3 transition-all cursor-pointer shadow-2xs"
            title="Réinitialiser tous les critères de filtrage"
          >
            <RotateCcw className="w-4 h-4 text-slate-500 stroke-[2.5]" />
            <span>Réinitialiser les filtres</span>
          </button>

          {/* Enregistrer comme segment */}
          <button 
            onClick={() => {
              setIsSaveSegmentModalOpen(true);
              setIsMobileFilterOpen(false);
            }}
            className="w-full py-2.5 px-4 bg-[#d7f2ef] hover:bg-[#c9ece8] text-[#005f5a] rounded-2xl text-xs font-extrabold flex items-center justify-start gap-3 transition-all active:scale-95 cursor-pointer"
            title="Enregistrer les filtres appliqués comme nouveau segment"
          >
            <Save className="w-4 h-4 text-[#005f5a] stroke-[2.5]" />
            <span>Enregistrer comme segment</span>
          </button>

          {/* Subtle Divider */}
          <div className="border-t border-[#bcc9c7]/40 my-1 pt-1"></div>

          {/* Paramètres */}
          <button 
            onClick={() => {
              setIsSettingsModalOpen(true);
              setIsMobileFilterOpen(false);
            }}
            className="w-full py-2 px-2 text-[#3d4948] hover:text-[#005f5a] hover:bg-white/60 rounded-xl text-xs font-bold flex items-center justify-start gap-3 transition-colors cursor-pointer"
            title="Ouvrir les paramètres"
          >
            <Settings className="w-4 h-4 text-[#3d4948]" />
            <span>Paramètres</span>
          </button>

          {/* Support */}
          <button 
            onClick={() => {
              setIsSupportModalOpen(true);
              setIsMobileFilterOpen(false);
            }}
            className="w-full py-2 px-2 text-[#3d4948] hover:text-[#005f5a] hover:bg-white/60 rounded-xl text-xs font-bold flex items-center justify-start gap-3 transition-colors cursor-pointer"
            title="Besoin d'aide ou support"
          >
            <HelpCircle className="w-4 h-4 text-[#3d4948]" />
            <span>Support</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area (Unified page scroll) */}
      <main className="flex-1 min-w-0 w-full max-w-full p-3 sm:p-6 lg:p-8 relative space-y-6">
        
        {/* Contextual Search Bar & Mobile / Collapse Filter Trigger (< 1600px) */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
          
          <div className="flex items-center gap-2 flex-1 w-full">
            <button
              onClick={() => setIsMobileFilterOpen(true)}
              className="min-[1600px]:hidden flex items-center gap-1.5 px-3.5 py-2.5 bg-[#006a66] hover:bg-[#256865] text-white rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer shadow-xs"
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
                placeholder="Rechercher par nom, org, e-mail..."
                className="w-full pl-10 pr-4 py-2.5 bg-[#dff9f8] border-none rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#006a66]"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 justify-end">
            <button 
              onClick={() => onNavigate('new-contact')}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#35b8b2] hover:bg-[#2b958f] text-white font-bold text-xs rounded-xl shadow-sm hover:shadow transition-all active:scale-95 cursor-pointer w-full sm:w-auto"
            >
              <UserPlus className="w-4 h-4" />
              <span>Nouveau Contact</span>
            </button>
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
                ? 'hover:bg-[#cee8e7] text-[#006a66] cursor-pointer'
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
            {segments.map(seg => {
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
                      ? 'bg-[#006a66] text-white shadow-sm'
                      : 'bg-[#dff9f8] text-[#3d4948] hover:bg-[#abece7] hover:text-[#006a66]'
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
                ? 'hover:bg-[#cee8e7] text-[#006a66] cursor-pointer'
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
                <thead className="bg-[#cee8e7]/50 border-b border-[#bcc9c7] text-[11px] font-bold text-[#3d4948] uppercase tracking-wider">
                  <tr>
                    <th className="p-3 w-10 text-center shrink-0">
                      <input 
                        type="checkbox"
                        checked={paginatedContacts.length > 0 && paginatedContacts.every(c => selectedContactIds.includes(c.id))}
                        onChange={handleSelectAll}
                        className="rounded text-[#006a66] focus:ring-[#006a66] border-[#bcc9c7] w-4 h-4 cursor-pointer"
                      />
                    </th>
                    <th className="p-3 w-[30%] md:w-[28%] lg:w-[22%] truncate" title="Nom et e-mail du contact">CONTACT</th>
                    <th className="p-3 w-[28%] md:w-[26%] lg:w-[18%] truncate" title="Organisation et poste">ORG / RÔLE</th>
                    <th className="p-3 w-[18%] md:w-[16%] lg:w-[10%] text-center truncate" title="Siège / Pays">SIÈGE</th>
                    <th className="p-3 hidden lg:table-cell lg:w-[18%] truncate" title="Zone d'intervention">ZONE D'INTERVENTION</th>
                    <th className="p-3 hidden lg:table-cell lg:w-[10%] truncate" title="Type d'acteur">TYPE</th>
                    <th className="p-3 w-[24%] md:w-[22%] lg:w-[14%] truncate" title="Tags">TAGS</th>
                    <th className="p-3 w-20 text-right shrink-0">ACTIONS</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#bcc9c7]/30 text-xs">
                  {filteredContacts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-12 text-center text-slate-500">
                        <p className="font-bold text-slate-700 text-sm">Aucun contact ne correspond à ces critères</p>
                        <button 
                          onClick={handleResetFilters}
                          className="mt-3 px-4 py-2 bg-[#006a66] hover:bg-[#256865] text-white rounded-xl font-bold text-xs cursor-pointer shadow-xs"
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
                          className={`hover:bg-[#dff9f8]/60 transition-colors cursor-pointer group ${
                            isSelected ? 'bg-[#dff9f8]' : ''
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
                              className="rounded text-[#006a66] focus:ring-[#006a66] border-[#bcc9c7] w-4 h-4 cursor-pointer"
                            />
                          </td>

                          {/* Contact Name & Avatar */}
                          <td className="p-3 sm:p-4 min-w-0">
                            <div className="flex items-center gap-2.5">
                              <div className="w-9 h-9 rounded-full bg-[#35b8b2]/20 flex items-center justify-center text-[#006a66] font-bold overflow-hidden shrink-0">
                                {contact.avatarUrl ? (
                                  <img src={contact.avatarUrl} alt={contact.name} className="w-full h-full object-cover" />
                                ) : (
                                  <span>{contact.initials}</span>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="font-bold text-[#071f1f] truncate" title={contact.name}>{contact.name}</div>
                                <div className="text-[11px] text-[#6d7a78] truncate" title={contact.email}>{contact.email}</div>
                              </div>
                            </div>
                          </td>

                          {/* Org / Role */}
                          <td className="p-3 sm:p-4 min-w-0">
                            <div className="font-semibold text-[#071f1f] truncate" title={contact.organization}>{contact.organization}</div>
                            <div className="text-[11px] text-[#6d7a78] truncate" title={contact.title}>{contact.title}</div>
                          </td>

                          {/* Siège */}
                          <td className="p-3 sm:p-4 text-center shrink-0">
                            <div className="inline-flex flex-col items-center gap-0.5">
                              <Flag className="w-3.5 h-3.5 text-[#6d7a78]" />
                              <span className="text-[11px] font-medium truncate max-w-[80px]" title={contact.country}>{contact.country}</span>
                            </div>
                          </td>

                          {/* Zone d'intervention (Hidden on tablet, shown on lg) */}
                          <td className="p-3 sm:p-4 hidden lg:table-cell">
                            <div className="flex flex-wrap gap-1">
                              {contact.interventionZones.slice(0, 2).map((z, idx) => (
                                <span key={idx} className="px-2 py-0.5 bg-[#cee8e7] text-[#3d4948] rounded-full text-[10px] font-medium">
                                  {z}
                                </span>
                              ))}
                              {contact.interventionZones.length > 2 && (
                                <span className="px-1.5 py-0.5 bg-[#cee8e7] text-[#3d4948] rounded-full text-[10px] font-bold">
                                  +{contact.interventionZones.length - 2}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Type Badge (Hidden on tablet, shown on lg) */}
                          <td className="p-3 sm:p-4 hidden lg:table-cell">
                            <span className="px-2.5 py-1 bg-[#006a66]/10 text-[#006a66] rounded-full text-[11px] font-bold whitespace-nowrap">
                              {contact.actorType}
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
                                className="p-1.5 hover:bg-[#35b8b2]/20 rounded-lg text-[#006a66] cursor-pointer" 
                                title="Voir la fiche détaillée"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => {
                                  if (onEditContact) {
                                    onEditContact(contact);
                                  } else {
                                    onNavigate('new-contact');
                                  }
                                }}
                                className="p-1.5 hover:bg-[#35b8b2]/20 rounded-lg text-[#006a66] cursor-pointer" 
                                title="Modifier"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
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
                    className="mt-3 px-4 py-2 bg-[#006a66] text-white rounded-xl font-bold text-xs cursor-pointer"
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
                        isSelected ? 'bg-[#dff9f8]/60' : ''
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
                            className="rounded text-[#006a66] focus:ring-[#006a66] border-[#bcc9c7] w-4 h-4 cursor-pointer mt-0.5"
                          />
                          <div className="w-10 h-10 rounded-full bg-[#35b8b2]/20 flex items-center justify-center text-[#006a66] font-bold overflow-hidden shrink-0">
                            {contact.avatarUrl ? (
                              <img src={contact.avatarUrl} alt={contact.name} className="w-full h-full object-cover" />
                            ) : (
                              <span>{contact.initials}</span>
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-sm text-[#071f1f]">{contact.name}</div>
                            <div className="text-xs text-slate-500">{contact.email}</div>
                          </div>
                        </div>

                        <span className="px-2.5 py-0.5 bg-[#006a66]/10 text-[#006a66] rounded-full text-[10px] font-bold shrink-0">
                          {contact.actorType}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <div>
                          <span className="text-[10px] font-bold uppercase text-slate-400 block">Organisation</span>
                          <span className="font-semibold text-slate-800">{contact.organization}</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold uppercase text-slate-400 block">Siège / Pays</span>
                          <span className="font-semibold text-slate-800">{contact.country}</span>
                        </div>
                      </div>

                      {/* Intervention zones & Tags */}
                      <div className="flex flex-wrap gap-1 items-center">
                        {contact.interventionZones.map((z, idx) => (
                          <span key={idx} className="px-2 py-0.5 bg-[#cee8e7] text-[#3d4948] rounded-full text-[10px] font-medium">
                            {z}
                          </span>
                        ))}
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
                        <span className="text-[11px] text-slate-500 font-medium">{contact.title}</span>
                        
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => onSelectContact(contact.id)}
                            className="px-2.5 py-1 bg-[#dff9f8] text-[#006a66] rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <ExternalLink className="w-3.5 h-3.5" /> Voir
                          </button>
                          <button 
                            onClick={() => {
                              if (onEditContact) {
                                onEditContact(contact);
                              } else {
                                onNavigate('new-contact');
                              }
                            }}
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-[#006a66] cursor-pointer" 
                          >
                            <Edit className="w-4 h-4" />
                          </button>
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
          <div className="px-6 py-3 bg-[#d9f3f2] border-t border-[#bcc9c7] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#3d4948]">
            <div>
              Affichage de <span className="font-bold text-[#006a66]">
                {filteredContacts.length === 0 ? 0 : (validCurrentPage - 1) * itemsPerPage + 1} - {Math.min(validCurrentPage * itemsPerPage, filteredContacts.length)}
              </span> sur <span className="font-bold text-[#006a66]">{filteredContacts.length}</span> contacts
              {filteredContacts.length !== contacts.length && (
                <span className="text-[#6d7a78] ml-1">({contacts.length} au total)</span>
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
                  className="px-2 py-1 border border-[#bcc9c7] rounded-lg text-xs bg-white cursor-pointer font-bold text-[#006a66]"
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
                  className="p-1 hover:bg-[#d3eded] rounded disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed transition-colors"
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
                        ? 'bg-[#006a66] text-white shadow-xs'
                        : 'hover:bg-[#bcdedc] text-[#3d4948]'
                    }`}
                  >
                    {pageNum}
                  </button>
                ))}

                <button 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={validCurrentPage >= totalPages}
                  className="p-1 hover:bg-[#d3eded] rounded disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed transition-colors"
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
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-[#1d3434] text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-6 z-40 animate-slide-up">
            <div className="flex items-center gap-2">
              <span className="bg-[#006a66] px-2.5 py-0.5 rounded-full text-xs font-bold">
                {selectedContactIds.length}
              </span>
              <span className="text-xs font-medium text-[#dcf6f5]">Contacts sélectionnés</span>
            </div>

            <div className="h-5 w-px bg-white/20" />

            <div className="flex items-center gap-4 text-xs font-bold">
              <button 
                onClick={() => onNavigate('exportation')}
                className="flex items-center gap-1.5 hover:text-[#7df6ef] transition-colors"
              >
                <Download className="w-4 h-4" /> Exporter
              </button>
              <button 
                onClick={() => onNavigate('segmentation')}
                className="flex items-center gap-1.5 hover:text-[#7df6ef] transition-colors"
              >
                <TagIcon className="w-4 h-4" /> Ajouter des tags
              </button>
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
        <div 
          onClick={() => setQuickDrawerContact(null)}
          className="fixed inset-0 z-50 flex justify-end bg-black/20 backdrop-blur-xs cursor-pointer"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[480px] bg-white h-full shadow-2xl border-l border-[#bcc9c7] flex flex-col justify-between animate-slide-left p-6 overflow-y-auto cursor-default"
          >
            
            <div>
              <div className="flex justify-between items-start mb-6">
                <div className="flex flex-col items-center text-center w-full">
                  <div className="w-24 h-24 rounded-full bg-[#35b8b2]/20 p-1 mb-3 relative">
                    {quickDrawerContact.avatarUrl ? (
                      <img src={quickDrawerContact.avatarUrl} alt={quickDrawerContact.name} className="w-full h-full object-cover rounded-full" />
                    ) : (
                      <div className="w-full h-full rounded-full bg-[#35b8b2] text-white flex items-center justify-center font-bold text-xl">
                        {quickDrawerContact.initials}
                      </div>
                    )}
                  </div>
                  <h2 className="text-xl font-bold text-[#071f1f]">{quickDrawerContact.name}</h2>
                  <p className="text-xs text-[#006a66] font-bold mt-0.5">{quickDrawerContact.title}</p>
                  <p className="text-xs text-[#3d4948]">{quickDrawerContact.organization}</p>
                </div>

                <button 
                  onClick={() => setQuickDrawerContact(null)}
                  className="p-1.5 hover:bg-[#d3eded] rounded-full text-slate-500 transition-colors absolute right-4 top-4"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Contact Details */}
                <section className="bg-[#dff9f8]/50 p-4 rounded-xl">
                  <h3 className="text-xs font-bold text-[#006a66] uppercase tracking-wider mb-3">Coordonnées</h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-3 text-[#3d4948]">
                      <Mail className="w-4 h-4 text-[#006a66]" />
                      <span>{quickDrawerContact.email}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[#3d4948]">
                      <Phone className="w-4 h-4 text-[#006a66]" />
                      <span>{quickDrawerContact.phone}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[#3d4948]">
                      <Globe className="w-4 h-4 text-[#006a66]" />
                      <span>Siège: {quickDrawerContact.country}</span>
                    </div>
                  </div>
                </section>

                {/* Tags Section */}
                <section>
                  <h3 className="text-xs font-bold text-[#071f1f] mb-2 flex items-center justify-between">
                    <span>Étiquettes / Tags</span>
                    <button 
                      onClick={() => onNavigate('segmentation')}
                      className="text-[11px] text-[#006a66] hover:underline font-bold"
                    >
                      Gérer
                    </button>
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

                {/* R&I Profile Tags */}
                <section>
                  <h3 className="text-xs font-bold text-[#071f1f] mb-3">Profil R&I & Expertise</h3>
                  <div className="flex flex-wrap gap-2">
                    {quickDrawerContact.expertise.map((exp, idx) => (
                      <span key={idx} className="px-3 py-1 bg-[#abece7] text-[#2b6c6a] rounded-full text-xs font-semibold">
                        {exp}
                      </span>
                    ))}
                  </div>
                </section>
              </div>
            </div>

            <div className="pt-6 border-t border-[#bcc9c7] mt-6 flex gap-2">
              <button 
                onClick={() => {
                  const contactToEdit = quickDrawerContact;
                  setQuickDrawerContact(null);
                  if (onEditContact && contactToEdit) {
                    onEditContact(contactToEdit);
                  }
                }}
                className="px-4 py-3 bg-[#abece7] text-[#006a66] hover:bg-[#86e2dc] font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
              >
                <Edit className="w-4 h-4" />
                Modifier
              </button>
              <button 
                onClick={() => {
                  const id = quickDrawerContact.id;
                  setQuickDrawerContact(null);
                  onSelectContact(id);
                }}
                className="flex-1 py-3 bg-[#006a66] hover:bg-[#256865] text-white font-bold text-xs rounded-xl shadow transition-all active:scale-95 cursor-pointer"
              >
                Voir la fiche complète
              </button>
            </div>

          </div>
        </div>
      )}

      {/* SAVE SEGMENT MODAL */}
      {isSaveSegmentModalOpen && (
        <div 
          onClick={() => setIsSaveSegmentModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 cursor-pointer"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5 animate-fade-in cursor-default"
          >
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Bookmark className="w-5 h-5 text-[#006a66]" />
                <h3 className="font-extrabold text-base text-[#071f1f]">
                  Enregistrer les filtres comme segment
                </h3>
              </div>
              <button 
                onClick={() => setIsSaveSegmentModalOpen(false)}
                className="p-1 hover:bg-slate-100 rounded-full text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSegmentSubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Nom du Segment *</label>
                <input
                  type="text"
                  required
                  value={newSegmentNameInput}
                  onChange={(e) => setNewSegmentNameInput(e.target.value)}
                  placeholder="ex: Experts Santé Afrique 2024"
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#006a66] font-semibold text-[#071f1f]"
                  autoFocus
                />
              </div>

              <div className="bg-[#dff9f8]/50 p-3.5 rounded-xl border border-[#bcc9c7]/30 text-slate-600">
                <p className="font-bold text-[#006a66] mb-1.5 text-xs">Filtres actuellement appliqués:</p>
                <ul className="list-disc list-inside space-y-1 text-[11px] font-medium">
                  {appliedFilters.search && <li>Recherche: "{appliedFilters.search}"</li>}
                  {appliedFilters.headquarters !== 'Tous les pays' && <li>Siège: {appliedFilters.headquarters}</li>}
                  {appliedFilters.zones.length > 0 && <li>Zones: {appliedFilters.zones.join(', ')}</li>}
                  {appliedFilters.actorTypes.length > 0 && <li>Types d'acteur: {appliedFilters.actorTypes.join(', ')}</li>}
                  {appliedFilters.expertises.length > 0 && <li>Expertises: {appliedFilters.expertises.join(', ')}</li>}
                  {appliedFilters.tags.length > 0 && <li>Tags: {appliedFilters.tags.join(', ')}</li>}
                  {!appliedFilters.search && appliedFilters.headquarters === 'Tous les pays' && appliedFilters.zones.length === 0 && appliedFilters.actorTypes.length === 0 && appliedFilters.expertises.length === 0 && appliedFilters.tags.length === 0 && (
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
                  className="px-5 py-2 bg-[#006a66] hover:bg-[#256865] text-white font-bold rounded-xl shadow transition-all active:scale-95 cursor-pointer"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SETTINGS MODAL */}
      {isSettingsModalOpen && (
        <div 
          onClick={() => {
            setIsSettingsModalOpen(false);
            setSettingsSaved(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 cursor-pointer"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-5 animate-fade-in cursor-default"
          >
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-[#006a66]" />
                <h3 className="font-extrabold text-base text-[#071f1f]">
                  Paramètres de l'Annuaire R&I
                </h3>
              </div>
              <button 
                onClick={() => {
                  setIsSettingsModalOpen(false);
                  setSettingsSaved(false);
                }}
                className="p-1 hover:bg-slate-100 rounded-full text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {settingsSaved && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl font-bold flex items-center justify-between">
                  <span>Modifications enregistrées avec succès !</span>
                  <Check className="w-4 h-4 text-emerald-600" />
                </div>
              )}

              {/* Preferences */}
              <div className="space-y-3">
                <h4 className="font-extrabold text-[#006a66] uppercase text-[10px] tracking-wider">Affichage & Navigation</h4>
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div>
                    <span className="font-bold text-[#071f1f] block">Éléments par page par défaut</span>
                    <span className="text-slate-500 text-[11px]">Nombre de contacts affichés dans la table</span>
                  </div>
                  <select 
                    value={settingsPrefs.defaultItemsPerPage}
                    onChange={(e) => setSettingsPrefs({ ...settingsPrefs, defaultItemsPerPage: Number(e.target.value) })}
                    className="p-2 bg-white border border-slate-300 rounded-lg font-bold text-xs cursor-pointer"
                  >
                    <option value={10}>10 par page</option>
                    <option value={20}>20 par page</option>
                    <option value={50}>50 par page</option>
                    <option value={100}>100 par page</option>
                  </select>
                </div>
              </div>

              {/* Notifications */}
              <div className="space-y-3">
                <h4 className="font-extrabold text-[#006a66] uppercase text-[10px] tracking-wider">Notifications & Alertes</h4>
                <label className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
                  <div>
                    <span className="font-bold text-[#071f1f] block">Alertes par e-mail sur nouveaux contacts</span>
                    <span className="text-slate-500 text-[11px]">Recevoir une notification lors d'imports R&I automatiques</span>
                  </div>
                  <input 
                    type="checkbox"
                    checked={settingsPrefs.emailAlerts}
                    onChange={(e) => setSettingsPrefs({ ...settingsPrefs, emailAlerts: e.target.checked })}
                    className="w-4 h-4 rounded text-[#006a66] focus:ring-[#006a66]"
                  />
                </label>
              </div>

              {/* Data Sync */}
              <div className="space-y-3">
                <h4 className="font-extrabold text-[#006a66] uppercase text-[10px] tracking-wider">Synchronisation & Sécurité</h4>
                <label className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
                  <div>
                    <span className="font-bold text-[#071f1f] block">Mise à jour automatique des conflits</span>
                    <span className="text-slate-500 text-[11px]">Proposer la fusion automatique des doublons d'emails</span>
                  </div>
                  <input 
                    type="checkbox"
                    checked={settingsPrefs.autoSync}
                    onChange={(e) => setSettingsPrefs({ ...settingsPrefs, autoSync: e.target.checked })}
                    className="w-4 h-4 rounded text-[#006a66] focus:ring-[#006a66]"
                  />
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setIsSettingsModalOpen(false);
                  setSettingsSaved(false);
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors text-xs cursor-pointer"
              >
                Fermer
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onItemsPerPageChange) {
                    onItemsPerPageChange(settingsPrefs.defaultItemsPerPage);
                  }
                  setSettingsSaved(true);
                  setTimeout(() => setSettingsSaved(false), 2500);
                }}
                className="px-5 py-2 bg-[#006a66] hover:bg-[#256865] text-white font-bold rounded-xl shadow transition-all active:scale-95 text-xs cursor-pointer"
              >
                Sauvegarder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUPPORT MODAL */}
      {isSupportModalOpen && (
        <div 
          onClick={() => {
            setIsSupportModalOpen(false);
            setSupportSubmitted(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 cursor-pointer"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-5 animate-fade-in cursor-default"
          >
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-[#006a66]" />
                <h3 className="font-extrabold text-base text-[#071f1f]">
                  Support & Assistance Technique
                </h3>
              </div>
              <button 
                onClick={() => {
                  setIsSupportModalOpen(false);
                  setSupportSubmitted(false);
                }}
                className="p-1 hover:bg-slate-100 rounded-full text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {supportSubmitted ? (
              <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-3">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <Check className="w-6 h-6" />
                </div>
                <h4 className="font-extrabold text-emerald-900 text-sm">Message transmis au support R&I !</h4>
                <p className="text-xs text-emerald-700">
                  Notre équipe technique prendra en charge votre demande dans les plus brefs délais.
                </p>
                <button
                  onClick={() => {
                    setIsSupportModalOpen(false);
                    setSupportSubmitted(false);
                  }}
                  className="px-5 py-2 bg-[#006a66] text-white font-bold text-xs rounded-xl shadow cursor-pointer"
                >
                  Fermer
                </button>
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                <div className="bg-[#dff9f8] p-3.5 rounded-xl border border-[#bcc9c7]/40 flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-[#006a66] shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-[#006a66]">Besoin d'aide avec l'Annuaire R&I ?</p>
                    <p className="text-slate-600 text-[11px]">
                      Vous pouvez contacter l'équipe d'administration ou poser vos questions sur l'importation de contacts, les filtres et les segments.
                    </p>
                  </div>
                </div>

                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    setSupportSubmitted(true);
                    setSupportMessage({ subject: '', body: '' });
                  }} 
                  className="space-y-3"
                >
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Sujet de votre demande *</label>
                    <input
                      type="text"
                      required
                      value={supportMessage.subject}
                      onChange={(e) => setSupportMessage({ ...supportMessage, subject: e.target.value })}
                      placeholder="ex: Problème d'importation CSV ou question sur les filtres..."
                      className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#006a66] text-xs font-medium"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Message / Description *</label>
                    <textarea
                      required
                      rows={4}
                      value={supportMessage.body}
                      onChange={(e) => setSupportMessage({ ...supportMessage, body: e.target.value })}
                      placeholder="Décrivez votre question ou le comportement observé..."
                      className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#006a66] text-xs font-medium resize-none"
                    />
                  </div>

                  <div className="pt-2 flex justify-between items-center border-t border-slate-100">
                    <span className="text-[11px] text-slate-500 font-medium">
                      E-mail support: <a href="mailto:support-ri@recherche.org" className="text-[#006a66] underline font-bold">support-ri@recherche.org</a>
                    </span>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setIsSupportModalOpen(false)}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors cursor-pointer"
                      >
                        Annuler
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 bg-[#006a66] hover:bg-[#256865] text-white font-bold rounded-xl shadow transition-all active:scale-95 cursor-pointer"
                      >
                        Envoyer
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
