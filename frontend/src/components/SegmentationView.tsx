import React, { useState, useMemo } from 'react';
import { Contact, Tag, Segment, FilterState, User, Gender, ResearchCareerStage, GENDER_LABELS, CAREER_STAGE_SHORT_LABELS } from '../types';
import { Modal } from './Modal';
import { SegmentationSkeleton } from './Skeletons';
import { canCreate, canEdit, canDelete } from '../utils/privileges';
import {
  Layers,
  Tag as TagIcon,
  Plus,
  Edit3,
  Trash2,
  Copy,
  Check,
  Search,
  Users,
  ArrowRight,
  X,
  Globe,
  Bookmark
} from 'lucide-react';

interface SegmentationViewProps {
  contacts: Contact[];
  tags: Tag[];
  segments: Segment[];
  isLoading?: boolean;
  onApplySegment: (segment: Segment) => void;
  onCreateSegment: (segment: Segment) => void;
  onUpdateSegment: (segment: Segment) => void;
  onDeleteSegment: (segmentId: string) => void;
  onCreateTag: (tag: Tag) => void;
  onUpdateTag: (tag: Tag) => void;
  onDeleteTag: (tagId: string) => void;
  onSaveTagContacts: (tagId: string, contactIds: string[]) => Promise<void>;
  user?: User | null;
}

export const SegmentationView: React.FC<SegmentationViewProps> = ({
  contacts,
  tags,
  segments,
  isLoading = false,
  onApplySegment,
  onCreateSegment,
  onUpdateSegment,
  onDeleteSegment,
  onCreateTag,
  onUpdateTag,
  onDeleteTag,
  onSaveTagContacts,
  user
}) => {
  const [activeTab, setActiveTab] = useState<'segments' | 'tags'>('segments');

  // RBAC : actions d'écriture masquées selon le privilège du compte.
  const showCreate = canCreate(user);
  const showEdit = canEdit(user);
  const showDelete = canDelete(user);

  // Modals state
  const [isSegmentModalOpen, setIsSegmentModalOpen] = useState(false);
  const [editingSegment, setEditingSegment] = useState<Segment | null>(null);
  const [segmentSearchQuery, setSegmentSearchQuery] = useState('');

  // Segment Form state
  const [segName, setSegName] = useState('');
  const [segDesc, setSegDesc] = useState('');
  const [segFilters, setSegFilters] = useState<FilterState>({
    search: '',
    countries: [],
    genders: [],
    careerStages: [],
    tags: []
  });

  // Tag Form state
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [tagNameInput, setTagNameInput] = useState('');
  const [tagColorInput, setTagColorInput] = useState('bg-emerald-100 text-emerald-800 border-emerald-300');
  const [tagDescInput, setTagDescInput] = useState('');

  // Selected tag for detail drawer / assign tool
  const [selectedTagForDetail, setSelectedTagForDetail] = useState<Tag | null>(null);
  const [contactSearchInTagModal, setContactSearchInTagModal] = useState('');
  const [tagContactSelection, setTagContactSelection] = useState<string[]>([]);
  const [isSavingTagContacts, setIsSavingTagContacts] = useState(false);

  // Preset Colors for Tags
  const colorPresets = [
    { label: 'Émeraude / Vert', class: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
    { label: 'Bleu / EURAXESS Africa', class: 'bg-[#005596]/15 text-[#005596] border-[#005596]/30' },
    { label: 'Magenta / EURAXESS', class: 'bg-[#B8167C]/15 text-[#B8167C] border-[#B8167C]/30' },
    { label: 'Ambre / VIP', class: 'bg-amber-100 text-amber-800 border-amber-300' },
    { label: 'Rose / Santé', class: 'bg-rose-100 text-rose-800 border-rose-300' },
    { label: 'Bleu / UE', class: 'bg-blue-100 text-blue-800 border-blue-300' },
    { label: 'Cyan / Climat', class: 'bg-cyan-100 text-cyan-800 border-cyan-300' },
    { label: 'Violet / Tech', class: 'bg-purple-100 text-purple-800 border-purple-300' },
    { label: 'Ardoise / Neutre', class: 'bg-slate-100 text-slate-800 border-slate-300' },
  ];

  const allGenders = ['FEMALE', 'MALE', 'NOT_SPECIFIED'] as Gender[];
  const allCareerStages = ['R1_FIRST_STAGE', 'R2_RECOGNIZED', 'R3_ESTABLISHED', 'R4_LEADING'] as ResearchCareerStage[];

  const countries = useMemo(() => {
    const set = new Set<string>();
    contacts.forEach(c => { if (c.countryOfOrigin && c.countryOfOrigin.trim() !== 'N/A') set.add(c.countryOfOrigin.trim()); });
    return Array.from(set).sort();
  }, [contacts]);

  // Helper to count contacts in segment
  const getSegmentCount = (seg: Segment) => {
    return contacts.filter(contact => {
      const f = seg.filters;
      if (f.search) {
        const q = f.search.toLowerCase();
        if (!contact.name.toLowerCase().includes(q) &&
            !contact.email.toLowerCase().includes(q) &&
            !(contact.affiliation || '').toLowerCase().includes(q) &&
            !(contact.function || '').toLowerCase().includes(q)) return false;
      }
      if (f.countries && f.countries.length > 0 && !f.countries.includes(contact.countryOfOrigin)) return false;
      if (f.genders && f.genders.length > 0 && !f.genders.includes(contact.gender)) return false;
      if (f.careerStages && f.careerStages.length > 0 && !f.careerStages.includes(contact.researchCareerStage)) return false;
      if (f.tags && f.tags.length > 0) {
        const hasTag = contact.tags?.some(t => f.tags.includes(t));
        if (!hasTag) return false;
      }
      return true;
    }).length;
  };

  // Helper to count contacts per tag
  const getTagContactCount = (tagName: string) => {
    return contacts.filter(c => c.tags?.includes(tagName)).length;
  };

  // Premier chargement : squelette pleine page (les hooks ci-dessus sont déjà déclarés)
  if (isLoading) {
    return <SegmentationSkeleton />;
  }

  // Open Segment Create/Edit Modal
  const openSegmentModal = (segToEdit?: Segment) => {
    if (segToEdit) {
      setEditingSegment(segToEdit);
      setSegName(segToEdit.name);
      setSegDesc(segToEdit.description || '');
      setSegFilters(segToEdit.filters);
    } else {
      setEditingSegment(null);
      setSegName('');
      setSegDesc('');
      setSegFilters({
        search: '',
        countries: [],
        genders: [],
        careerStages: [],
        tags: []
      });
    }
    setIsSegmentModalOpen(true);
  };

  const handleSaveSegment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!segName.trim()) return;

    if (editingSegment) {
      onUpdateSegment({
        ...editingSegment,
        name: segName,
        description: segDesc,
        filters: segFilters
      });
    } else {
      onCreateSegment({
        id: `seg-${Date.now()}`,
        name: segName,
        description: segDesc,
        filters: segFilters
      });
    }
    setIsSegmentModalOpen(false);
  };

  // Open Tag Create/Edit Modal
  const openTagModal = (tagToEdit?: Tag) => {
    if (tagToEdit) {
      setEditingTag(tagToEdit);
      setTagNameInput(tagToEdit.name);
      setTagColorInput(tagToEdit.color || colorPresets[0].class);
      setTagDescInput(tagToEdit.description || '');
    } else {
      setEditingTag(null);
      setTagNameInput('');
      setTagColorInput(colorPresets[0].class);
      setTagDescInput('');
    }
    setIsTagModalOpen(true);
  };

  const handleSaveTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tagNameInput.trim()) return;

    if (editingTag) {
      onUpdateTag({
        ...editingTag,
        name: tagNameInput.trim(),
        color: tagColorInput,
        description: tagDescInput
      });
    } else {
      onCreateTag({
        id: `tag-${Date.now()}`,
        name: tagNameInput.trim(),
        color: tagColorInput,
        description: tagDescInput
      });
    }
    setIsTagModalOpen(false);
  };

  const filteredSegments = segments.filter(s => 
    s.name.toLowerCase().includes(segmentSearchQuery.toLowerCase()) ||
    (s.description && s.description.toLowerCase().includes(segmentSearchQuery.toLowerCase()))
  );

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-8 space-y-8 animate-fade-in">
      
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-[#005596] font-bold text-xs uppercase tracking-wider mb-1">
            <Layers className="w-4 h-4" /> Organisation R&I
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1C2529] tracking-tight">
            Segmentation & Gestion des Tags
          </h1>
          <p className="text-sm text-[#55636B] mt-1 max-w-2xl">
            Catégorisez et découpez votre réseau d'experts avec des filtres dynamiques sauvegardés et des étiquettes personnalisées.
          </p>
        </div>

        {/* Action Toggle Tabs */}
        <div className="flex items-center bg-[#E8F1F8] p-1.5 rounded-xl border border-[#C9D4DE]/40 shrink-0">
          <button
            onClick={() => setActiveTab('segments')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'segments'
                ? 'bg-[#005596] text-white shadow'
                : 'text-[#55636B] hover:text-[#005596]'
            }`}
          >
            <Layers className="w-4 h-4" />
            Gestion des Segments ({segments.length})
          </button>
          <button
            onClick={() => setActiveTab('tags')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'tags'
                ? 'bg-[#005596] text-white shadow'
                : 'text-[#55636B] hover:text-[#005596]'
            }`}
          >
            <TagIcon className="w-4 h-4" />
            Gestion des Tags ({tags.length})
          </button>
        </div>
      </div>

      {/* TAB 1: GESTION DES SEGMENTS */}
      {activeTab === 'segments' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={segmentSearchQuery}
                onChange={(e) => setSegmentSearchQuery(e.target.value)}
                placeholder="Rechercher un segment..."
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-[#005596]"
              />
            </div>

            {showCreate && (
              <button
                onClick={() => openSegmentModal()}
                className="flex items-center gap-2 bg-[#005596] hover:bg-[#004275] text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-sm transition-all active:scale-95 shrink-0"
              >
                <Plus className="w-4 h-4" />
                Créer un Nouveau Segment
              </button>
            )}
          </div>

          {/* Segments Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSegments.length === 0 && (
              <div className="md:col-span-2 lg:col-span-3 bg-white rounded-2xl p-10 border border-dashed border-[#C9D4DE] text-center">
                <Layers className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="font-bold text-sm text-slate-700">
                  {segmentSearchQuery.trim() ? 'Aucun segment ne correspond à cette recherche' : 'Aucun segment pour le moment'}
                </p>
                <p className="text-xs text-[#55636B] mt-1">
                  {segmentSearchQuery.trim()
                    ? 'Essayez un autre mot-clé ou créez un nouveau segment.'
                    : 'Cliquez sur « Créer un Nouveau Segment » pour regrouper vos contacts par critères.'}
                </p>
              </div>
            )}
            {filteredSegments.map(segment => {
              // Comptage exact servi par le backend (memberCount) ; repli local
              // sur les contacts chargés uniquement si l'API n'en fournit pas.
              const count = typeof segment.memberCount === 'number' ? segment.memberCount : getSegmentCount(segment);
              const isAll = segment.id === 'all';
              const f = segment.filters;

              return (
                <div 
                  key={segment.id}
                  className="bg-white rounded-2xl p-6 border border-slate-200 hover:border-[#005596] shadow-sm hover:shadow-md transition-all flex flex-col justify-between relative group"
                >
                  <div>
                    <div className="flex justify-between items-start gap-2 mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-[#E8F1F8] text-[#005596] flex items-center justify-center font-bold">
                          <Layers className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-bold text-base text-[#1C2529]">{segment.name}</h3>
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#005596] bg-[#E8F1F8] px-2 py-0.5 rounded-full mt-0.5">
                            <Users className="w-3 h-3" /> {count} contacts
                          </span>
                        </div>
                      </div>

                      {!isAll && (showEdit || showDelete) && (
                        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                          {showEdit && (
                            <button
                              onClick={() => openSegmentModal(segment)}
                              className="p-1.5 text-slate-400 hover:text-[#005596] hover:bg-slate-100 rounded-lg transition-colors"
                              title="Modifier le segment"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          )}
                          {showCreate && (
                            <button
                              onClick={() => {
                                onCreateSegment({
                                  ...segment,
                                  id: `seg-${Date.now()}`,
                                  name: `${segment.name} (Copie)`
                                });
                              }}
                              className="p-1.5 text-slate-400 hover:text-[#005596] hover:bg-slate-100 rounded-lg transition-colors"
                              title="Dupliquer"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                          )}
                          {showDelete && (
                            <button
                              onClick={() => onDeleteSegment(segment.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Supprimer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    <p className="text-xs text-[#55636B] mb-4 line-clamp-2">
                      {segment.description || 'Aucune description fournie.'}
                    </p>

                    {/* Criteria Tags Preview */}
                    <div className="space-y-2 pt-3 border-t border-slate-100 text-[11px]">
                      <span className="font-semibold text-slate-400 uppercase tracking-wider text-[10px]">Critères du segment:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {isAll ? (
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[11px]">Tous les filtres réinitialisés</span>
                        ) : (
                          <>
                            {f.countries && f.countries.map(country => (
                              <span key={country} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-medium flex items-center gap-1">
                                <Globe className="w-3 h-3" /> {country}
                              </span>
                            ))}
                            {f.genders && f.genders.map(g => (
                              <span key={g} className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded font-medium flex items-center gap-1">
                                <Users className="w-3 h-3" /> {GENDER_LABELS[g]}
                              </span>
                            ))}
                            {f.careerStages && f.careerStages.map(s => (
                              <span key={s} className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded font-medium flex items-center gap-1">
                                <Bookmark className="w-3 h-3" /> {CAREER_STAGE_SHORT_LABELS[s]}
                              </span>
                            ))}
                            {f.tags && f.tags.map(t => (
                              <span key={t} className="px-2 py-0.5 bg-rose-50 text-rose-700 rounded font-medium flex items-center gap-1">
                                <TagIcon className="w-3 h-3" /> Tag: {t}
                              </span>
                            ))}
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-100">
                    <button
                      onClick={() => onApplySegment(segment)}
                      className="w-full py-2.5 bg-[#005596] hover:bg-[#004275] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95"
                    >
                      Appliquer au répertoire de contacts
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: GESTION DES TAGS */}
      {activeTab === 'tags' && (
        <div className="space-y-8">
          
          {/* Top Bar for Tags */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div>
              <h2 className="text-lg font-bold text-[#1C2529]">Étiquettes & Catégories R&I</h2>
              <p className="text-xs text-[#55636B]">Créez des badges de couleur pour qualifier rapidement vos experts.</p>
            </div>

            {showCreate && (
              <button
                onClick={() => openTagModal()}
                className="flex items-center gap-2 bg-[#005596] hover:bg-[#004275] text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-sm transition-all active:scale-95 shrink-0"
              >
                <Plus className="w-4 h-4" />
                Créer un Nouveau Tag
              </button>
            )}
          </div>

          {/* Tags Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {tags.length === 0 && (
              <div className="sm:col-span-2 lg:col-span-3 xl:col-span-4 bg-white rounded-2xl p-10 border border-dashed border-[#C9D4DE] text-center">
                <TagIcon className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="font-bold text-sm text-slate-700">Aucun tag pour le moment</p>
                <p className="text-xs text-[#55636B] mt-1">
                  Cliquez sur « Créer un Nouveau Tag » pour catégoriser vos contacts par expertise.
                </p>
              </div>
            )}
            {tags.map(tag => {
              // Comptage exact depuis la base (tag._count.contacts renvoyé par /api/segments)
              const count = typeof tag._count?.contacts === 'number' ? tag._count.contacts : getTagContactCount(tag.name);

              return (
                <div 
                  key={tag.id}
                  className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-[#005596] shadow-sm transition-all flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex justify-between items-start gap-2 mb-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold border ${tag.color || 'bg-slate-100 text-slate-700 border-slate-200'} inline-flex items-center gap-1.5 shadow-xs`}>
                        <TagIcon className="w-3.5 h-3.5" />
                        {tag.name}
                      </span>

                      {(showEdit || showDelete) && (
                        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                          {showEdit && (
                            <button
                              onClick={() => openTagModal(tag)}
                              className="p-1 text-slate-400 hover:text-[#005596] hover:bg-slate-100 rounded transition-colors"
                              title="Modifier"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {showDelete && (
                            <button
                              onClick={() => onDeleteTag(tag.id)}
                              className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Supprimer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    <p className="text-xs text-[#55636B] mt-2 line-clamp-2">
                      {tag.description || 'Pas de description.'}
                    </p>
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-600">
                      <strong className="text-[#005596] font-extrabold">{count}</strong> contact{count > 1 ? 's' : ''}
                    </span>

                    <button
                      onClick={() => {
                        setTagContactSelection(
                          contacts.filter(c => c.tags?.includes(tag.name)).map(c => c.id)
                        );
                        setContactSearchInTagModal('');
                        setSelectedTagForDetail(tag);
                      }}
                      className="text-[#005596] font-bold hover:underline flex items-center gap-1 text-xs"
                    >
                      Gérer les contacts <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tag Assignment Drawer / Modal */}
          {selectedTagForDetail && (
            <Modal open={selectedTagForDetail !== null} onClose={() => setSelectedTagForDetail(null)} variant="drawer" noPadding>
              <div className="p-6 flex flex-col justify-between min-h-full">
                <div>
                  <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold border ${selectedTagForDetail.color || 'bg-slate-100 text-slate-700 border-slate-200'} flex items-center gap-1.5`}>
                        <TagIcon className="w-4 h-4" />
                        {selectedTagForDetail.name}
                      </span>
                      <span className="text-xs text-slate-500 font-medium">Affectation directe</span>
                    </div>

                    <button 
                      onClick={() => setSelectedTagForDetail(null)}
                      className="p-1.5 hover:bg-slate-100 rounded-full text-slate-500"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="mb-4">
                    <p className="text-xs text-slate-600 mb-3">
                      Cochez ou décochez les contacts pour leur attribuer ou leur retirer le tag <strong>"{selectedTagForDetail.name}"</strong>, puis cliquez sur <strong>Enregistrer</strong> pour valider.
                    </p>

                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={contactSearchInTagModal}
                        onChange={(e) => setContactSearchInTagModal(e.target.value)}
                        placeholder="Chercher un contact..."
                        className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-[#005596]"
                      />
                    </div>
                  </div>

                  {/* List of contacts with toggle checkboxes */}
                  <div className="divide-y divide-slate-100 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
                    {contacts
                      .filter(c =>
                        c.name.toLowerCase().includes(contactSearchInTagModal.toLowerCase()) ||
                        c.email.toLowerCase().includes(contactSearchInTagModal.toLowerCase()) ||
                        (c.affiliation || '').toLowerCase().includes(contactSearchInTagModal.toLowerCase())
                      )
                      .map(contact => {
                        const hasTag = tagContactSelection.includes(contact.id);

                        return (
                          <label
                            key={contact.id}
                            className="py-3 flex items-center justify-between hover:bg-slate-50 px-2 rounded-lg cursor-pointer transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-[#005596]/20 flex items-center justify-center font-bold text-xs text-[#005596] shrink-0">
                                {contact.initials}
                              </div>
                              <div>
                                <p className="font-bold text-xs text-[#1C2529]">{contact.name}</p>
                                <p className="text-[11px] text-slate-500">{contact.affiliation || contact.email}</p>
                              </div>
                            </div>

                            <input
                              type="checkbox"
                              checked={hasTag}
                              onChange={() => setTagContactSelection(prev =>
                                prev.includes(contact.id)
                                  ? prev.filter(id => id !== contact.id)
                                  : [...prev, contact.id]
                              )}
                              className="rounded border-slate-300 text-[#005596] focus:ring-[#005596] w-4 h-4 cursor-pointer"
                            />
                          </label>
                        );
                      })}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 space-y-2.5">
                  {showEdit && (
                  <button
                    disabled={isSavingTagContacts}
                    onClick={async () => {
                      try {
                        setIsSavingTagContacts(true);
                        await onSaveTagContacts(selectedTagForDetail.id, tagContactSelection);
                        setSelectedTagForDetail(null);
                      } catch {
                        // Keep drawer open so the user can retry
                      } finally {
                        setIsSavingTagContacts(false);
                      }
                    }}
                    className="w-full py-2.5 bg-[#005596] hover:bg-[#004275] text-white font-bold text-xs rounded-xl shadow flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isSavingTagContacts ? (
                      <>
                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                        </svg>
                        Enregistrement...
                      </>
                    ) : (
                      'Enregistrer'
                    )}
                  </button>
                  )}
                  <button
                    onClick={() => setSelectedTagForDetail(null)}
                    className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            </Modal>
          )}

        </div>
      )}

      {/* SEGMENT CREATE / EDIT MODAL */}
      {isSegmentModalOpen && (
        <Modal
          open={isSegmentModalOpen}
          onClose={() => setIsSegmentModalOpen(false)}
          maxWidth="max-w-2xl"
          title={
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-[#005596]" />
              <h3 className="font-extrabold text-lg text-[#1C2529]">
                {editingSegment ? 'Modifier le segment' : 'Créer un nouveau segment'}
              </h3>
            </div>
          }
        >

            <form onSubmit={handleSaveSegment} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Nom du segment *</label>
                <input
                  type="text"
                  required
                  value={segName}
                  onChange={(e) => setSegName(e.target.value)}
                  placeholder="ex: Experts Santé Afrique de l'Ouest"
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#005596]"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Description</label>
                <textarea
                  rows={2}
                  value={segDesc}
                  onChange={(e) => setSegDesc(e.target.value)}
                  placeholder="Objectif de ce groupe ou critères d'inclusion..."
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#005596]"
                />
              </div>

              {/* Criteria builders */}
              <div className="bg-[#E8F1F8]/40 p-4 rounded-xl space-y-4 border border-[#C9D4DE]/30">
                <span className="font-bold text-[#005596] uppercase text-[10px] tracking-wider block">
                  Configuration des filtres automatiques
                </span>

                {/* Country of origin */}
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Pays d'origine</label>
                  <div className="flex flex-wrap gap-2">
                    {countries.map(country => {
                      const active = segFilters.countries.includes(country);
                      return (
                        <button
                          type="button"
                          key={country}
                          onClick={() => {
                            setSegFilters({
                              ...segFilters,
                              countries: active
                                ? segFilters.countries.filter(c => c !== country)
                                : [...segFilters.countries, country]
                            });
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                            active ? 'bg-[#005596] text-white' : 'bg-white text-slate-700 border border-slate-200'
                          }`}
                        >
                          {country}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Genders */}
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Genres inclus</label>
                  <div className="flex flex-wrap gap-2">
                    {allGenders.map(g => {
                      const active = segFilters.genders.includes(g);
                      return (
                        <button
                          type="button"
                          key={g}
                          onClick={() => {
                            setSegFilters({
                              ...segFilters,
                              genders: active
                                ? segFilters.genders.filter(x => x !== g)
                                : [...segFilters.genders, g]
                            });
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                            active ? 'bg-[#005596] text-white' : 'bg-white text-slate-700 border border-slate-200'
                          }`}
                        >
                          {GENDER_LABELS[g]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Career stages */}
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Stades de carrière</label>
                  <div className="flex flex-wrap gap-2">
                    {allCareerStages.map(s => {
                      const active = segFilters.careerStages.includes(s);
                      return (
                        <button
                          type="button"
                          key={s}
                          onClick={() => {
                            setSegFilters({
                              ...segFilters,
                              careerStages: active
                                ? segFilters.careerStages.filter(x => x !== s)
                                : [...segFilters.careerStages, s]
                            });
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                            active ? 'bg-[#005596] text-white' : 'bg-white text-slate-700 border border-slate-200'
                          }`}
                        >
                          {CAREER_STAGE_SHORT_LABELS[s]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Search keyword */}
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Recherche (nom, e-mail, affiliation, pays…)</label>
                  <input
                    type="text"
                    value={segFilters.search}
                    onChange={(e) => setSegFilters({ ...segFilters, search: e.target.value })}
                    placeholder="ex: Université, Sénégal, CNRS..."
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg"
                  />
                </div>

                {/* Tags filter */}
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Tags requis</label>
                  <div className="flex flex-wrap gap-2">
                    {tags.map(tag => {
                      const active = segFilters.tags.includes(tag.name);
                      return (
                        <button
                          type="button"
                          key={tag.id}
                          onClick={() => {
                            setSegFilters({
                              ...segFilters,
                              tags: active 
                                ? segFilters.tags.filter(t => t !== tag.name)
                                : [...segFilters.tags, tag.name]
                            });
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                            active ? 'bg-[#005596] text-white' : 'bg-white text-slate-700 border border-slate-200'
                          }`}
                        >
                          {tag.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsSegmentModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#005596] hover:bg-[#004275] text-white font-bold rounded-xl shadow"
                >
                  Sauvegarder le Segment
                </button>
              </div>
            </form>
        </Modal>
      )}

      {/* TAG CREATE / EDIT MODAL */}
      {isTagModalOpen && (
        <Modal
          open={isTagModalOpen}
          onClose={() => setIsTagModalOpen(false)}
          maxWidth="max-w-md"
          title={
            <div className="flex items-center gap-2">
              <TagIcon className="w-5 h-5 text-[#005596]" />
              <h3 className="font-extrabold text-base text-[#1C2529]">
                {editingTag ? 'Modifier le Tag' : 'Créer un nouveau Tag'}
              </h3>
            </div>
          }
          noPadding
        >

            <form onSubmit={handleSaveTag} className="p-4 space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Nom du Tag *</label>
                <input
                  type="text"
                  required
                  value={tagNameInput}
                  onChange={(e) => setTagNameInput(e.target.value)}
                  placeholder="ex: Leader R&I, Financement 2025"
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#005596]"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Palette de couleur</label>
                <div className="grid grid-cols-2 gap-2">
                  {colorPresets.map((preset, idx) => (
                    <button
                      type="button"
                      key={idx}
                      onClick={() => setTagColorInput(preset.class)}
                      className={`p-2 rounded-xl text-left text-xs font-semibold border flex items-center justify-between ${
                        preset.class
                      } ${tagColorInput === preset.class ? 'ring-2 ring-[#005596]' : ''}`}
                    >
                      <span>{preset.label}</span>
                      {tagColorInput === preset.class && <Check className="w-3.5 h-3.5" />}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Description (optionnelle)</label>
                <input
                  type="text"
                  value={tagDescInput}
                  onChange={(e) => setTagDescInput(e.target.value)}
                  placeholder="Explication courte..."
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#005596]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsTagModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#005596] hover:bg-[#004275] text-white font-bold rounded-xl shadow"
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
