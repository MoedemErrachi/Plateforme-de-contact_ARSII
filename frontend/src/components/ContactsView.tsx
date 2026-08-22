import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Contact, FilterState, Segment, Tag as TagType, User as UserType, Gender, ResearchCareerStage, ContactSelection, PaginationInfo, GENDER_LABELS, CAREER_STAGE_LABELS, CAREER_STAGE_SHORT_LABELS } from '../types';
import { apiFetch } from '../services/api';
import { mapContactFromApi } from '../utils/mapContact';
import { buildContactsListQuery, emptyFilterState, isEmptyFilterState } from '../utils/contactQuery';
import { formatFieldValue } from '../utils/formatFieldValue';
import { canCreate, canEdit, canDelete } from '../utils/privileges';
import { Modal } from './Modal';
import { Pagination } from './Pagination';
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
  Mail, 
  Phone, 
  ExternalLink,
  RotateCcw,
  RotateCw,
  Check
} from 'lucide-react';
import { ContactsTableSkeleton } from './Skeletons';

interface ContactsViewProps {
  segments: Segment[];
  tags: TagType[];
  activeSegmentId: string;
  onSelectSegment: (segmentId: string) => void;
  onSaveCurrentAsSegment: (segmentName: string, filters: FilterState) => void;
  onSelectContact: (contactId: string) => void;
  onDeleteContact?: (contactId: string) => void;
  onDeleteContacts?: (ids: string[]) => void;
  /** Incrémenté par App après chaque mutation : déclenche un rechargement. */
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
  // Filter Sidebar Toggle State
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // RBAC : visibilité des actions selon le privilège du compte connecté.
  const showCreate = canCreate(user);
  const showEdit = canEdit(user);
  const showDelete = canDelete(user);

  // Pending Filters State (modified in sidebar before clicking "Appliquer les filtres")
  const [pendingFilters, setPendingFilters] = useState<FilterState>(emptyFilterState);

  const location = useLocation();
  const navigate = useNavigate();

  // Applied Filters State (used to fetch the contacts table)
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(emptyFilterState);

  // Server-side paginated data
  const [pageContacts, setPageContacts] = useState<Contact[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [pageLoading, setPageLoading] = useState<boolean>(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);

  // Distinct countries for the filter sidebar (server, indépendant de la page)
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
        // liste des pays non bloquante
      });
    return () => { cancelled = true; };
  }, []);

  // Apply filters passed via router state (e.g. from the AI chat assistant)
  useEffect(() => {
    const stateFilters = (location.state as { filters?: FilterState } | null)?.filters;
    if (stateFilters && typeof stateFilters === 'object') {
      setPendingFilters(stateFilters);
      setAppliedFilters(stateFilters);
    }
  }, [location.state]);

  // Recherche texte : appliquée explicitement (touche Entrée / suggestion
  // récente / bouton X), plus de debounce automatique à chaque frappe.

  // When activeSegmentId changes, update both pending and applied filters to match segment
  useEffect(() => {
    const activeSeg = segments.find(s => s.id === activeSegmentId);
    if (activeSeg) {
      setPendingFilters(activeSeg.filters);
      setAppliedFilters(activeSeg.filters);
    }
  }, [activeSegmentId, segments]);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);

  // Premier chargement terminé ? Ensuite on affiche un voile flou au lieu du
  // squelette complet lors des rechargements (pagination, recherche, filtres).
  const hasLoadedOnceRef = useRef(false);


  // Reset page when applied filters or segment changes
  useEffect(() => {
    setCurrentPage(1);
  }, [appliedFilters, activeSegmentId]);

  // Fetch current page from the server (AbortController pour annuler les requêtes obsolètes)
  useEffect(() => {
    const controller = new AbortController();
    setPageLoading(true);
    setServerError(null);

    apiFetch(buildContactsListQuery(appliedFilters, tags, currentPage, itemsPerPage), { signal: controller.signal })
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
    // refreshKey : rechargement après toute mutation effectuée ailleurs dans
    // l'application (création, import, suppression simple ou en lot).
  }, [appliedFilters, currentPage, itemsPerPage, tags, retryTick, refreshKey]);

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

  // ── Recherche : application explicite + suggestions récentes (localStorage) ──
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
        // ignore storage failures
      }
      return next;
    });
  };

  // Applique la requête courante (Entrée) et l'ajoute aux recherches récentes.
  const applySearchQuery = () => {
    setAppliedFilters(prev => ({ ...prev, search: pendingFilters.search }));
    setCurrentPage(1);
    persistRecentSearch(pendingFilters.search);
    setIsRecentSearchesOpen(false);
  };

  // Applique immédiatement une suggestion récente.
  const applyRecentSearch = (query: string) => {
    updatePendingFilters(prev => ({ ...prev, search: query }));
    setAppliedFilters(prev => ({ ...prev, search: query }));
    setCurrentPage(1);
    persistRecentSearch(query);
    setIsRecentSearchesOpen(false);
  };

  // Efface instantanément la recherche (bouton X) et relance la liste.
  const clearSearch = () => {
    updatePendingFilters(prev => ({ ...prev, search: '' }));
    setAppliedFilters(prev => ({ ...prev, search: '' }));
    setCurrentPage(1);
  };

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

  // Determine if any custom filter is active (search, countries, genders, career stages, tags)
  const isAnyCustomFilterActive = useMemo(() => {
    return (
      appliedFilters.search.trim() !== '' ||
      appliedFilters.countries.length > 0 ||
      appliedFilters.genders.length > 0 ||
      appliedFilters.careerStages.length > 0 ||
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
      tags: []
    }
  }), []);

  const displaySegments = useMemo(() => {
    const hasAll = segments.some(s => s.id === 'all');
    return hasAll ? segments : [ALL_SEGMENT, ...segments];
  }, [segments, ALL_SEGMENT]);

  // Expanded tags popover ID
  const [popoverContactId, setPopoverContactId] = useState<string | null>(null);

  const genders = ['FEMALE', 'MALE', 'NOT_SPECIFIED'] as Gender[];
  const allCareerStages = ['R1_FIRST_STAGE', 'R2_RECOGNIZED', 'R3_ESTABLISHED', 'R4_LEADING'] as ResearchCareerStage[];

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

  // Reset all filters
  const handleResetFilters = () => {
    const emptyFilter = emptyFilterState();
    setPendingFilters(emptyFilter);
    setAppliedFilters(emptyFilter);
    onSelectSegment('all');
  };

  // ── Sélection (4 modes) : none | page | partial | all-filtered ──
  const handleSelectPage = (checked: boolean) => {
    if (checked) {
      onSelectionChange({
        mode: 'page',
        ids: pageContacts.map(c => c.id),
        filters: appliedFilters,
        totalCount: pagination?.totalCount ?? pageContacts.length
      });
    } else {
      onSelectionChange({ mode: 'none', ids: [], filters: appliedFilters, totalCount: 0 });
    }
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
      // décocher
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

  // Un changement de filtres invalide la sélection (page / all-filtered)
  const appliedFiltersRef = useRef(appliedFilters);
  useEffect(() => {
    const filtersChanged = JSON.stringify(appliedFiltersRef.current) !== JSON.stringify(appliedFilters);
    appliedFiltersRef.current = appliedFilters;
    if (filtersChanged && (selection.mode === 'page' || selection.mode === 'all-filtered')) {
      onSelectionChange({ mode: 'none', ids: [], filters: appliedFilters, totalCount: 0 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedFilters]);

  // Mode 'page' : les ids suivent la page courante
  useEffect(() => {
    if (selection.mode === 'page' && pageContacts.length) {
      onSelectionChange(prev => prev.mode === 'page' ? { ...prev, ids: pageContacts.map(c => c.id) } : prev);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageContacts, selection.mode]);

  // ── Export (bouton de la barre flottante) ──
  const handleExportSelection = () => {
    // Navigation vers /export : la sélection (mode + filtres + ids) voyage via
    // les props d'App (persistée en localStorage) ; ExportView appelle le backend.
    navigate('/export');
  };

  const isRowSelected = (id: string) =>
    selection.mode === 'all-filtered' || selection.ids.includes(id);

  // Helper to resolve tag color badge class
  const getTagBadgeStyle = (tagName: string) => {
    const found = tags.find(t => t.name.toLowerCase() === tagName.toLowerCase());
    if (found && found.color) return found.color;
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row lg:items-start min-h-[calc(100vh-64px)] w-full max-w-full bg-[#E8F1F8] relative">
      
      {/* Mobile / Slide-over Filter Backdrop (< lg) */}
      {isFilterOpen && (
        <div 
          onClick={() => setIsFilterOpen(false)}
          className="lg:hidden fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-40 animate-in fade-in duration-200"
        />
      )}

      {/* Left Sidebar Filter Panel (permanent on lg+, slide-over drawer below) */}
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
                  setIsFilterOpen(false);
                }}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200/60 hover:text-[#005596] transition-colors cursor-pointer"
                title="Réinitialiser les filtres"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setIsFilterOpen(false)}
                className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-200/60 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="space-y-5">
            {/* Country of Origin Checkboxes */}
            <section>
              <label className="text-xs font-bold text-[#55636B] flex items-center gap-1.5 mb-2">
                <Globe className="w-4 h-4 text-[#005596]" /> Pays d'origine
                {pendingFilters.countries.length > 0 && (
                  <span className="ml-auto text-[10px] font-bold text-[#005596] bg-[#E8F1F8] px-1.5 py-0.5 rounded-full">{pendingFilters.countries.length}</span>
                )}
              </label>
              <div className="space-y-2 bg-white/60 p-3 rounded-xl border border-[#C9D4DE]/40 max-h-48 overflow-y-auto">
                {countries.length === 0 && (
                  <span className="text-[11px] text-slate-400 italic">Aucun pays renseigné</span>
                )}
                {countries.map(country => {
                  const checked = pendingFilters.countries.includes(country);
                  return (
                    <label key={country} className="flex items-center gap-2 cursor-pointer text-xs text-[#1C2529] hover:text-[#005596]">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleCountry(country)}
                        className="rounded border-[#C9D4DE] text-[#005596] focus:ring-[#005596] w-4 h-4 cursor-pointer"
                      />
                      <span className={checked ? 'font-bold text-[#005596]' : 'font-medium'}>{country}</span>
                    </label>
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
                setAppliedFilters(pendingFilters);
                setCurrentPage(1);
                setIsFilterOpen(false);
              }}
              disabled={pageLoading}
              className="w-full py-2.5 px-4 bg-[#005596] hover:bg-[#004275] text-white rounded-2xl text-xs font-extrabold flex items-center justify-start gap-3 transition-all active:scale-95 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              title="Appliquer les filtres sélectionnés au répertoire"
            >
              {pageLoading ? (
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

            {/* Enregistrer comme segment */}
            <button 
              onClick={() => {
                setIsSaveSegmentModalOpen(true);
                setIsFilterOpen(false);
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
              onClick={() => setIsFilterOpen(prev => !prev)}
              className="lg:hidden flex items-center gap-1.5 px-3.5 py-2.5 bg-[#005596] hover:bg-[#004275] text-white rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer shadow-xs"
              title={isFilterOpen ? 'Masquer les filtres' : 'Afficher les filtres'}
            >
              {isFilterOpen ? <ChevronLeft className="w-4 h-4" /> : <SlidersHorizontal className="w-4 h-4" />}
              <span>Filtres</span>
            </button>

            <div className="flex-1 relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={pendingFilters.search}
                onChange={(e) => {
                  const val = e.target.value;
                  updatePendingFilters(prev => ({ ...prev, search: val }));
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    applySearchQuery();
                  }
                  if (e.key === 'Escape') {
                    setIsRecentSearchesOpen(false);
                  }
                }}
                onFocus={() => { if (recentSearches.length > 0) setIsRecentSearchesOpen(true); }}
                onBlur={() => { setTimeout(() => setIsRecentSearchesOpen(false), 150); }}
                placeholder="Rechercher par nom, e-mail, affiliation, pays, département, tag… (Entrée pour appliquer)"
                className="w-full pl-10 pr-10 py-2.5 bg-[#E8F1F8] border-none rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#005596]"
              />

              {/* Bouton X : efface instantanément la recherche */}
              {pendingFilters.search && (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={clearSearch}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-500 hover:text-white hover:bg-slate-400 transition-colors cursor-pointer"
                  title="Effacer la recherche"
                  aria-label="Effacer la recherche"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Suggestions : 4 dernières recherches validées (localStorage) */}
              {isRecentSearchesOpen && recentSearches.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-slate-200 rounded-xl shadow-lg z-30 overflow-hidden">
                  <p className="px-4 pt-2.5 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    Recherches récentes
                  </p>
                  {recentSearches.map(query => (
                    <button
                      key={query}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => applyRecentSearch(query)}
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

        {/* Contacts Container : squelette au premier chargement, voile flou ensuite */}
        {pageLoading && !hasLoadedOnceRef.current ? (
          <ContactsTableSkeleton />
        ) : (
        <div className={`relative bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-200 transition-opacity duration-200 ${pageLoading ? 'opacity-90' : ''}`}>
          {/* Voile de rechargement : la table reste visible mais est estompée */}
          {pageLoading && hasLoadedOnceRef.current && (
            <div
              className="absolute inset-0 z-20 bg-white/50 backdrop-blur-sm animate-pulse"
              role="status"
              aria-label="Rechargement des contacts"
            />
          )}

            {/* Sélection (4 modes) : cette page / tous les résultats */}
            <div className="px-4 py-2.5 border-b border-[#C9D4DE] bg-white flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
              <label className="flex items-center gap-2 cursor-pointer text-[#55636B] font-semibold hover:text-[#005596]">
                <input
                  type="checkbox"
                  checked={selection.mode === 'page' && pageContacts.length > 0}
                  onChange={(e) => handleSelectPage(e.target.checked)}
                  className="rounded text-[#005596] focus:ring-[#005596] border-[#C9D4DE] w-4 h-4 cursor-pointer"
                />
                Sélectionner cette page ({pageContacts.length})
              </label>
              <button
                onClick={handleSelectAllFiltered}
                disabled={!pagination?.totalCount}
                className={`flex items-center gap-1.5 font-bold transition-colors cursor-pointer ${
                  pagination?.totalCount
                    ? 'text-[#005596] hover:text-[#004275]'
                    : 'text-slate-300 cursor-not-allowed'
                }`}
              >
                Sélectionner les {pagination?.totalCount ?? 0} résultats
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              {isEmptyFilterState(appliedFilters) && (
                <span className="text-[11px] text-slate-400 font-medium">(tous les contacts)</span>
              )}
            </div>

            {/* Desktop / Tablet Table View (Hidden on mobile <768px) */}
            <div className="hidden md:block w-full overflow-hidden">
              <table className="w-full text-left border-collapse table-fixed max-w-full">
                <thead className="bg-[#D9E6F2]/50 border-b border-[#C9D4DE] text-[11px] font-bold text-[#55636B] uppercase tracking-wider">
                  <tr>
                    <th className="p-3 w-10 text-center shrink-0"></th>
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
                  {serverError ? (
                    <tr>
                      <td colSpan={8} className="p-12 text-center text-slate-500">
                        <p className="font-bold text-red-600 text-sm">{serverError}</p>
                        <button
                          onClick={() => setRetryTick(t => t + 1)}
                          className="mt-3 px-4 py-2 bg-[#005596] hover:bg-[#004275] text-white rounded-xl font-bold text-xs cursor-pointer shadow-xs"
                        >
                          Réessayer
                        </button>
                      </td>
                    </tr>
                  ) : pageContacts.length === 0 ? (
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
                    pageContacts.map(contact => {
                      const isSelected = isRowSelected(contact.id);
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
                          <td className="p-3 sm:p-4" onClick={(e) => { e.stopPropagation(); handleSelectRow(contact.id, !isSelected); }}>
                            <input 
                              type="checkbox" 
                              checked={isSelected}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                e.stopPropagation();
                                handleSelectRow(contact.id, e.target.checked);
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
                              <span className="font-semibold text-[#1C2529] truncate" title={contact.countryOfOrigin}>{formatFieldValue(contact.countryOfOrigin)}</span>
                            </div>
                            <div className="text-[11px] text-[#8A98A1] truncate pl-5" title={contact.city}>{formatFieldValue(contact.city)}</div>
                          </td>

                          {/* Affiliation & Fonction */}
                          <td className="p-3 sm:p-4 min-w-0">
                            <div className="font-semibold text-[#1C2529] truncate" title={contact.affiliation}>{formatFieldValue(contact.affiliation)}</div>
                            <div className="text-[11px] text-[#8A98A1] truncate" title={contact.function}>{formatFieldValue(contact.function)}</div>
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
                              {showEdit && (
                                <Link
                                  to={`/contacts/${contact.id}/edit`}
                                  className="p-1.5 hover:bg-[#005596]/20 rounded-lg text-[#005596] cursor-pointer"
                                  title="Modifier"
                                >
                                  <Edit className="w-4 h-4" />
                                </Link>
                              )}
                              {showDelete && onDeleteContact && (
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
              {serverError ? (
                <div className="p-8 text-center text-slate-500">
                  <p className="font-bold text-red-600 text-sm">{serverError}</p>
                  <button
                    onClick={() => setRetryTick(t => t + 1)}
                    className="mt-3 px-4 py-2 bg-[#005596] text-white rounded-xl font-bold text-xs cursor-pointer"
                  >
                    Réessayer
                  </button>
                </div>
              ) : pageContacts.length === 0 ? (
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
                pageContacts.map(contact => {
                  const isSelected = isRowSelected(contact.id);
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
                              handleSelectRow(contact.id, e.target.checked);
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
                        <span className="text-[11px] text-slate-500 font-medium truncate">{contact.function?.trim() || contact.affiliation?.trim() || '\u2014'}</span>
                        
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => onSelectContact(contact.id)}
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
                          {showDelete && onDeleteContact && (
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
                {pageContacts.length === 0 ? 0 : ((pagination?.page ?? 1) - 1) * itemsPerPage + 1} - {Math.min((pagination?.page ?? 1) * itemsPerPage, pagination?.totalCount ?? 0)}
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
                  disabled={(pagination?.page ?? 1) === 1}
                  className="p-1 hover:bg-[#E8F1F8] rounded disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed transition-colors"
                  title="Page précédente"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                
                <Pagination
                  page={pagination?.page ?? 1}
                  totalPages={pagination?.totalPages ?? 1}
                  onPageChange={setCurrentPage}
                />

                <button 
                  onClick={() => setCurrentPage(p => Math.min(pagination?.totalPages ?? 1, p + 1))}
                  disabled={(pagination?.page ?? 1) >= (pagination?.totalPages ?? 1)}
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
        {selection.mode !== 'none' && (
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
                onClick={handleExportSelection}
                className="flex items-center gap-1.5 hover:text-[#FFC20C] transition-colors cursor-pointer"
                title="Exporter la sélection"
              >
                <Download className="w-4 h-4" /> Exporter
              </button>
              {(selection.mode === 'page' || selection.mode === 'partial') && (
                <Link 
                  to="/segments"
                  className="flex items-center gap-1.5 hover:text-[#FFC20C] transition-colors"
                >
                  <TagIcon className="w-4 h-4" /> Ajouter des tags
                </Link>
              )}
              {/* Suppression en lot : réservée au privilège FULL_ACCESS et aux
                  sélections à identifiants explicites (page / partielle). */}
              {showDelete && (selection.mode === 'page' || selection.mode === 'partial') && onDeleteContacts && (
                <button
                  onClick={() => onDeleteContacts(selection.ids)}
                  disabled={selection.ids.length === 0}
                  className="flex items-center gap-1.5 text-red-400 hover:text-red-300 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  title={`Supprimer la sélection (${selection.ids.length})`}
                >
                  <Trash2 className="w-4 h-4" /> Supprimer
                </button>
              )}
            </div>

            <button 
              onClick={handleClearSelection}
              className="p-1 hover:bg-white/10 rounded-full transition-colors ml-2"
              title="Effacer la sélection"
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
                  <p className="text-xs text-[#005596] font-bold mt-0.5">{formatFieldValue(quickDrawerContact.function)}</p>
                  <p className="text-xs text-[#55636B]">{formatFieldValue(quickDrawerContact.affiliation)}</p>
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
                      <span>{formatFieldValue(quickDrawerContact.phone)}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[#55636B]">
                      <Globe className="w-4 h-4 text-[#005596]" />
                      <span>Pays: {formatFieldValue(quickDrawerContact.countryOfOrigin)}{quickDrawerContact.city?.trim() ? ` · ${quickDrawerContact.city}` : ''}</span>
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
                      <span className="text-right">{formatFieldValue(quickDrawerContact.experience)}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="font-bold text-[#1C2529]">Faculté / Dépt:</span>
                      <span className="text-right">{formatFieldValue(quickDrawerContact.facultyDepartment)}</span>
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
                  {appliedFilters.tags.length > 0 && <li>Tags: {appliedFilters.tags.join(', ')}</li>}
                  {!appliedFilters.search && appliedFilters.countries.length === 0 && appliedFilters.genders.length === 0 && appliedFilters.careerStages.length === 0 && appliedFilters.tags.length === 0 && (
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
