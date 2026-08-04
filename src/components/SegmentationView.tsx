import React, { useState, useMemo } from 'react';
import { ViewPage, Contact, Tag, Segment, FilterState } from '../types';
import { 
  Layers, 
  Tag as TagIcon, 
  Plus, 
  Edit3, 
  Trash2, 
  Copy, 
  Check, 
  Search, 
  Filter, 
  Users, 
  ArrowRight, 
  X, 
  Sparkles,
  Info,
  Globe,
  MapPin,
  Brain,
  Building
} from 'lucide-react';

interface SegmentationViewProps {
  contacts: Contact[];
  tags: Tag[];
  segments: Segment[];
  onNavigate: (page: ViewPage) => void;
  onApplySegment: (segment: Segment) => void;
  onCreateSegment: (segment: Segment) => void;
  onUpdateSegment: (segment: Segment) => void;
  onDeleteSegment: (segmentId: string) => void;
  onCreateTag: (tag: Tag) => void;
  onUpdateTag: (tag: Tag) => void;
  onDeleteTag: (tagId: string) => void;
  onToggleContactTag: (contactId: string, tagName: string) => void;
}

export const SegmentationView: React.FC<SegmentationViewProps> = ({
  contacts,
  tags,
  segments,
  onNavigate,
  onApplySegment,
  onCreateSegment,
  onUpdateSegment,
  onDeleteSegment,
  onCreateTag,
  onUpdateTag,
  onDeleteTag,
  onToggleContactTag
}) => {
  const [activeTab, setActiveTab] = useState<'segments' | 'tags'>('segments');

  // Modals state
  const [isSegmentModalOpen, setIsSegmentModalOpen] = useState(false);
  const [editingSegment, setEditingSegment] = useState<Segment | null>(null);
  const [segmentSearchQuery, setSegmentSearchQuery] = useState('');

  // Segment Form state
  const [segName, setSegName] = useState('');
  const [segDesc, setSegDesc] = useState('');
  const [segFilters, setSegFilters] = useState<FilterState>({
    search: '',
    headquarters: 'Tous les pays',
    zones: [],
    expertises: [],
    actorTypes: [],
    tags: []
  });

  // Tag Form state
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [tagNameInput, setTagNameInput] = useState('');
  const [tagCategoryInput, setTagCategoryInput] = useState('Secteur');
  const [tagColorInput, setTagColorInput] = useState('bg-emerald-100 text-emerald-800 border-emerald-300');
  const [tagDescInput, setTagDescInput] = useState('');

  // Selected tag for detail drawer / assign tool
  const [selectedTagForDetail, setSelectedTagForDetail] = useState<Tag | null>(null);
  const [contactSearchInTagModal, setContactSearchInTagModal] = useState('');

  // Preset Colors for Tags
  const colorPresets = [
    { label: 'Émeraude / Vert', class: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
    { label: 'Teal / ARSII', class: 'bg-[#006a66]/15 text-[#006a66] border-[#006a66]/30' },
    { label: 'Ambre / VIP', class: 'bg-amber-100 text-amber-800 border-amber-300' },
    { label: 'Rose / Santé', class: 'bg-rose-100 text-rose-800 border-rose-300' },
    { label: 'Bleu / UE', class: 'bg-blue-100 text-blue-800 border-blue-300' },
    { label: 'Cyan / Climat', class: 'bg-cyan-100 text-cyan-800 border-cyan-300' },
    { label: 'Violet / Tech', class: 'bg-purple-100 text-purple-800 border-purple-300' },
    { label: 'Ardoise / Neutre', class: 'bg-slate-100 text-slate-800 border-slate-300' },
  ];

  const categories = ['Secteur', 'Priorité', 'Rôle', 'Statut', 'Financement', 'Réseau'];
  const countries = ['Tous les pays', 'France', 'Tunisie', 'Sénégal', 'Maroc', 'Allemagne', 'Belgique'];
  const allZones = ['Afrique Subsaharienne', 'Afrique du Nord', 'Union Européenne'];
  const allExpertises = ['Agriculture', 'Santé', 'Climat', 'IA & Data', 'Maladies Tropicales', 'Épidémiologie'];
  const allActorTypes = ['Labo de recherche', 'ONG', 'Université', 'PME', 'Institutionnel'];

  // Helper to count contacts in segment
  const getSegmentCount = (seg: Segment) => {
    return contacts.filter(contact => {
      const f = seg.filters;
      if (f.search) {
        const q = f.search.toLowerCase();
        if (!contact.name.toLowerCase().includes(q) && 
            !contact.organization.toLowerCase().includes(q)) return false;
      }
      if (f.headquarters && f.headquarters !== 'Tous les pays' && contact.country !== f.headquarters) return false;
      if (f.actorTypes && f.actorTypes.length > 0 && !f.actorTypes.includes(contact.actorType)) return false;
      if (f.zones && f.zones.length > 0) {
        const hasZone = contact.interventionZones.some(z => f.zones.includes(z));
        if (!hasZone) return false;
      }
      if (f.expertises && f.expertises.length > 0) {
        const hasExp = contact.expertise.some(e => f.expertises.includes(e));
        if (!hasExp) return false;
      }
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
        headquarters: 'Tous les pays',
        zones: [],
        expertises: [],
        actorTypes: [],
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
      setTagCategoryInput(tagToEdit.category || 'Secteur');
      setTagColorInput(tagToEdit.color);
      setTagDescInput(tagToEdit.description || '');
    } else {
      setEditingTag(null);
      setTagNameInput('');
      setTagCategoryInput('Secteur');
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
        category: tagCategoryInput,
        color: tagColorInput,
        description: tagDescInput
      });
    } else {
      onCreateTag({
        id: `tag-${Date.now()}`,
        name: tagNameInput.trim(),
        category: tagCategoryInput,
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
          <div className="flex items-center gap-2 text-[#006a66] font-bold text-xs uppercase tracking-wider mb-1">
            <Layers className="w-4 h-4" /> Organisation R&I
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#071f1f] tracking-tight">
            Segmentation & Gestion des Tags
          </h1>
          <p className="text-sm text-[#3d4948] mt-1 max-w-2xl">
            Catégorisez et découpez votre réseau d'experts avec des filtres dynamiques sauvegardés et des étiquettes personnalisées.
          </p>
        </div>

        {/* Action Toggle Tabs */}
        <div className="flex items-center bg-[#dff9f8] p-1.5 rounded-xl border border-[#bcc9c7]/40 shrink-0">
          <button
            onClick={() => setActiveTab('segments')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'segments'
                ? 'bg-[#006a66] text-white shadow'
                : 'text-[#3d4948] hover:text-[#006a66]'
            }`}
          >
            <Layers className="w-4 h-4" />
            Gestion des Segments ({segments.length})
          </button>
          <button
            onClick={() => setActiveTab('tags')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'tags'
                ? 'bg-[#006a66] text-white shadow'
                : 'text-[#3d4948] hover:text-[#006a66]'
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
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-[#006a66]"
              />
            </div>

            <button
              onClick={() => openSegmentModal()}
              className="flex items-center gap-2 bg-[#35b8b2] hover:bg-[#2b958f] text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-sm transition-all active:scale-95 shrink-0"
            >
              <Plus className="w-4 h-4" />
              Créer un Nouveau Segment
            </button>
          </div>

          {/* Segments Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSegments.map(segment => {
              const count = getSegmentCount(segment);
              const isAll = segment.id === 'all';
              const f = segment.filters;

              return (
                <div 
                  key={segment.id}
                  className="bg-white rounded-2xl p-6 border border-slate-200 hover:border-[#006a66] shadow-sm hover:shadow-md transition-all flex flex-col justify-between relative group"
                >
                  <div>
                    <div className="flex justify-between items-start gap-2 mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-[#dff9f8] text-[#006a66] flex items-center justify-center font-bold">
                          <Layers className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-bold text-base text-[#071f1f]">{segment.name}</h3>
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#006a66] bg-[#dff9f8] px-2 py-0.5 rounded-full mt-0.5">
                            <Users className="w-3 h-3" /> {count} contacts
                          </span>
                        </div>
                      </div>

                      {!isAll && (
                        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openSegmentModal(segment)}
                            className="p-1.5 text-slate-400 hover:text-[#006a66] hover:bg-slate-100 rounded-lg transition-colors"
                            title="Modifier le segment"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              onCreateSegment({
                                ...segment,
                                id: `seg-${Date.now()}`,
                                name: `${segment.name} (Copie)`
                              });
                            }}
                            className="p-1.5 text-slate-400 hover:text-[#006a66] hover:bg-slate-100 rounded-lg transition-colors"
                            title="Dupliquer"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onDeleteSegment(segment.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Supprimer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    <p className="text-xs text-[#3d4948] mb-4 line-clamp-2">
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
                            {f.headquarters && f.headquarters !== 'Tous les pays' && (
                              <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-medium flex items-center gap-1">
                                <Globe className="w-3 h-3" /> Siège: {f.headquarters}
                              </span>
                            )}
                            {f.actorTypes && f.actorTypes.map(type => (
                              <span key={type} className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded font-medium flex items-center gap-1">
                                <Building className="w-3 h-3" /> {type}
                              </span>
                            ))}
                            {f.zones && f.zones.map(z => (
                              <span key={z} className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded font-medium flex items-center gap-1">
                                <MapPin className="w-3 h-3" /> {z}
                              </span>
                            ))}
                            {f.expertises && f.expertises.map(exp => (
                              <span key={exp} className="px-2 py-0.5 bg-teal-50 text-teal-700 rounded font-medium flex items-center gap-1">
                                <Brain className="w-3 h-3" /> {exp}
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
                      className="w-full py-2.5 bg-[#006a66] hover:bg-[#256865] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95"
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
              <h2 className="text-lg font-bold text-[#071f1f]">Étiquettes & Catégories R&I</h2>
              <p className="text-xs text-[#3d4948]">Créez des badges de couleur pour qualifier rapidement vos experts.</p>
            </div>

            <button
              onClick={() => openTagModal()}
              className="flex items-center gap-2 bg-[#35b8b2] hover:bg-[#2b958f] text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-sm transition-all active:scale-95 shrink-0"
            >
              <Plus className="w-4 h-4" />
              Créer un Nouveau Tag
            </button>
          </div>

          {/* Tags Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {tags.map(tag => {
              const count = getTagContactCount(tag.name);

              return (
                <div 
                  key={tag.id}
                  className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-[#35b8b2] shadow-sm transition-all flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex justify-between items-start gap-2 mb-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold border ${tag.color} inline-flex items-center gap-1.5 shadow-xs`}>
                        <TagIcon className="w-3.5 h-3.5" />
                        {tag.name}
                      </span>

                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openTagModal(tag)}
                          className="p-1 text-slate-400 hover:text-[#006a66] hover:bg-slate-100 rounded transition-colors"
                          title="Modifier"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDeleteTag(tag.id)}
                          className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {tag.category && (
                      <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                        Catégorie: {tag.category}
                      </span>
                    )}

                    <p className="text-xs text-[#3d4948] mt-2 line-clamp-2">
                      {tag.description || 'Pas de description.'}
                    </p>
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-600">
                      <strong className="text-[#006a66] font-extrabold">{count}</strong> contact{count > 1 ? 's' : ''}
                    </span>

                    <button
                      onClick={() => setSelectedTagForDetail(tag)}
                      className="text-[#006a66] font-bold hover:underline flex items-center gap-1 text-xs"
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
            <div className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-xs">
              <div className="w-full max-w-lg bg-white h-full shadow-2xl p-6 flex flex-col justify-between overflow-y-auto animate-slide-left">
                <div>
                  <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold border ${selectedTagForDetail.color} flex items-center gap-1.5`}>
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
                      Cochez ou décochez les contacts pour leur attribuer ou leur retirer le tag <strong>"{selectedTagForDetail.name}"</strong> en temps réel.
                    </p>

                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={contactSearchInTagModal}
                        onChange={(e) => setContactSearchInTagModal(e.target.value)}
                        placeholder="Chercher un contact..."
                        className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-[#006a66]"
                      />
                    </div>
                  </div>

                  {/* List of contacts with toggle checkboxes */}
                  <div className="divide-y divide-slate-100 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
                    {contacts
                      .filter(c => 
                        c.name.toLowerCase().includes(contactSearchInTagModal.toLowerCase()) ||
                        c.organization.toLowerCase().includes(contactSearchInTagModal.toLowerCase())
                      )
                      .map(contact => {
                        const hasTag = contact.tags?.includes(selectedTagForDetail.name);

                        return (
                          <label 
                            key={contact.id} 
                            className="py-3 flex items-center justify-between hover:bg-slate-50 px-2 rounded-lg cursor-pointer transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-[#35b8b2]/20 flex items-center justify-center font-bold text-xs text-[#006a66] shrink-0">
                                {contact.initials}
                              </div>
                              <div>
                                <p className="font-bold text-xs text-[#071f1f]">{contact.name}</p>
                                <p className="text-[11px] text-slate-500">{contact.organization}</p>
                              </div>
                            </div>

                            <input
                              type="checkbox"
                              checked={!!hasTag}
                              onChange={() => onToggleContactTag(contact.id, selectedTagForDetail.name)}
                              className="rounded border-slate-300 text-[#006a66] focus:ring-[#006a66] w-4 h-4 cursor-pointer"
                            />
                          </label>
                        );
                      })}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <button
                    onClick={() => setSelectedTagForDetail(null)}
                    className="w-full py-2.5 bg-[#006a66] hover:bg-[#256865] text-white font-bold text-xs rounded-xl shadow"
                  >
                    Fermer et sauvegarder
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* SEGMENT CREATE / EDIT MODAL */}
      {isSegmentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto animate-fade-in">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-[#006a66]" />
                <h3 className="font-extrabold text-lg text-[#071f1f]">
                  {editingSegment ? 'Modifier le segment' : 'Créer un nouveau segment'}
                </h3>
              </div>
              <button 
                onClick={() => setIsSegmentModalOpen(false)}
                className="p-1 hover:bg-slate-100 rounded-full text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSegment} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Nom du segment *</label>
                <input
                  type="text"
                  required
                  value={segName}
                  onChange={(e) => setSegName(e.target.value)}
                  placeholder="ex: Experts Santé Afrique de l'Ouest"
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#006a66]"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Description</label>
                <textarea
                  rows={2}
                  value={segDesc}
                  onChange={(e) => setSegDesc(e.target.value)}
                  placeholder="Objectif de ce groupe ou critères d'inclusion..."
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#006a66]"
                />
              </div>

              {/* Criteria builders */}
              <div className="bg-[#dff9f8]/40 p-4 rounded-xl space-y-4 border border-[#bcc9c7]/30">
                <span className="font-bold text-[#006a66] uppercase text-[10px] tracking-wider block">
                  Configuration des filtres automatiques
                </span>

                {/* HQ Country */}
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Siège social (Pays)</label>
                  <select
                    value={segFilters.headquarters}
                    onChange={(e) => setSegFilters({ ...segFilters, headquarters: e.target.value })}
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg"
                  >
                    {countries.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                {/* Actor types */}
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Types d'acteur inclus</label>
                  <div className="flex flex-wrap gap-2">
                    {allActorTypes.map(type => {
                      const active = segFilters.actorTypes.includes(type);
                      return (
                        <button
                          type="button"
                          key={type}
                          onClick={() => {
                            setSegFilters({
                              ...segFilters,
                              actorTypes: active 
                                ? segFilters.actorTypes.filter(t => t !== type)
                                : [...segFilters.actorTypes, type]
                            });
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                            active ? 'bg-[#006a66] text-white' : 'bg-white text-slate-700 border border-slate-200'
                          }`}
                        >
                          {type}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Zones */}
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Zones d'action</label>
                  <div className="flex flex-wrap gap-2">
                    {allZones.map(zone => {
                      const active = segFilters.zones.includes(zone);
                      return (
                        <button
                          type="button"
                          key={zone}
                          onClick={() => {
                            setSegFilters({
                              ...segFilters,
                              zones: active 
                                ? segFilters.zones.filter(z => z !== zone)
                                : [...segFilters.zones, zone]
                            });
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                            active ? 'bg-[#006a66] text-white' : 'bg-white text-slate-700 border border-slate-200'
                          }`}
                        >
                          {zone}
                        </button>
                      );
                    })}
                  </div>
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
                            active ? 'bg-[#006a66] text-white' : 'bg-white text-slate-700 border border-slate-200'
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
                  className="px-5 py-2 bg-[#006a66] hover:bg-[#256865] text-white font-bold rounded-xl shadow"
                >
                  Sauvegarder le Segment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAG CREATE / EDIT MODAL */}
      {isTagModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5 animate-fade-in">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <TagIcon className="w-5 h-5 text-[#006a66]" />
                <h3 className="font-extrabold text-base text-[#071f1f]">
                  {editingTag ? 'Modifier le Tag' : 'Créer un nouveau Tag'}
                </h3>
              </div>
              <button 
                onClick={() => setIsTagModalOpen(false)}
                className="p-1 hover:bg-slate-100 rounded-full text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTag} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Nom du Tag *</label>
                <input
                  type="text"
                  required
                  value={tagNameInput}
                  onChange={(e) => setTagNameInput(e.target.value)}
                  placeholder="ex: Leader R&I, Financement 2025"
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#006a66]"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Catégorie</label>
                <select
                  value={tagCategoryInput}
                  onChange={(e) => setTagCategoryInput(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#006a66]"
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
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
                      } ${tagColorInput === preset.class ? 'ring-2 ring-[#006a66]' : ''}`}
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
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#006a66]"
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
                  className="px-5 py-2 bg-[#006a66] hover:bg-[#256865] text-white font-bold rounded-xl shadow"
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
