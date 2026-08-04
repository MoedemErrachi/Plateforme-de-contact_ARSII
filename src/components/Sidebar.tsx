import React from 'react';
import { FilterState, ActorType } from '../types';
import { Filter, RotateCcw, Building2, MapPin, Tag as TagIcon, Sparkles } from 'lucide-react';

interface SidebarProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  onResetFilters: () => void;
  allActorTypes: ActorType[];
  allZones: string[];
  allTags: Array<{ id: string; name: string; color: string }>;
  positionMode?: 'sticky' | 'fixed';
  isOpenOnMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  filters,
  onFilterChange,
  onResetFilters,
  allActorTypes,
  allZones,
  allTags,
  positionMode = 'sticky',
  isOpenOnMobile = false,
  onCloseMobile
}) => {
  const handleActorTypeToggle = (type: ActorType) => {
    const current = filters.actorTypes || [];
    const next = current.includes(type)
      ? current.filter(t => t !== type)
      : [...current, type];
    onFilterChange({ ...filters, actorTypes: next });
  };

  const handleZoneToggle = (zone: string) => {
    const current = filters.zones || [];
    const next = current.includes(zone)
      ? current.filter(z => z !== zone)
      : [...current, zone];
    onFilterChange({ ...filters, zones: next });
  };

  const handleTagToggle = (tagName: string) => {
    const current = filters.tags || [];
    const next = current.includes(tagName)
      ? current.filter(t => t !== tagName)
      : [...current, tagName];
    onFilterChange({ ...filters, tags: next });
  };

  const activeFilterCount = (filters.actorTypes?.length || 0) + 
                            (filters.zones?.length || 0) + 
                            (filters.tags?.length || 0) + 
                            (filters.headquarters ? 1 : 0);

  return (
    <aside 
      className={`
        w-[280px] sm:w-80 h-[calc(100vh-64px)] overflow-hidden bg-[#e4fffe] border-r border-[#bcc9c7] 
        p-4 sm:p-5 flex flex-col justify-between shrink-0 z-30 transition-all duration-300 shadow-sm
        ${positionMode === 'sticky' ? 'sticky top-16' : 'fixed top-16 left-0'}
        ${isOpenOnMobile ? 'translate-x-0 z-50' : '-translate-x-full min-[1600px]:translate-x-0'}
      `}
    >
      {/* Top Header Section */}
      <div className="flex items-center justify-between border-b border-[#bcc9c7]/60 pb-3 shrink-0">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-[#006a66]" />
          <h2 className="font-bold text-sm sm:text-base text-[#1b1c1d]">Filtres Directory</h2>
          {activeFilterCount > 0 && (
            <span className="px-2 py-0.5 text-xs font-bold bg-[#006a66] text-white rounded-full">
              {activeFilterCount}
            </span>
          )}
        </div>
        {activeFilterCount > 0 && (
          <button
            onClick={onResetFilters}
            className="text-xs text-[#006a66] hover:text-[#256865] flex items-center gap-1 font-semibold cursor-pointer"
            title="Réinitialiser"
          >
            <RotateCcw className="w-3 h-3" />
            Effacer
          </button>
        )}
      </div>

      {/* Middle Non-Scrollable Lock Area - Flex Column Distributed */}
      <div className="flex-1 my-3 flex flex-col justify-between gap-3 overflow-hidden text-xs">
        
        {/* Type d'Acteur */}
        <div className="space-y-1.5 shrink-0">
          <div className="flex items-center gap-1.5 text-[#006a66] font-bold uppercase tracking-wider text-[11px]">
            <Building2 className="w-3.5 h-3.5" />
            <span>Type d'Acteur</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {allActorTypes.slice(0, 5).map(type => {
              const selected = filters.actorTypes?.includes(type);
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleActorTypeToggle(type)}
                  className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                    selected
                      ? 'bg-[#006a66] text-white border-[#006a66] shadow-xs'
                      : 'bg-white/80 text-slate-700 border-slate-200 hover:border-[#006a66]/50'
                  }`}
                >
                  {type}
                </button>
              );
            })}
          </div>
        </div>

        {/* Zones d'intervention */}
        <div className="space-y-1.5 shrink-0">
          <div className="flex items-center gap-1.5 text-[#006a66] font-bold uppercase tracking-wider text-[11px]">
            <MapPin className="w-3.5 h-3.5" />
            <span>Zones d'intervention</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {allZones.slice(0, 4).map(zone => {
              const selected = filters.zones?.includes(zone);
              return (
                <button
                  key={zone}
                  type="button"
                  onClick={() => handleZoneToggle(zone)}
                  className={`px-2 py-1 rounded-lg border text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                    selected
                      ? 'bg-[#35B8B2] text-white border-[#35B8B2]'
                      : 'bg-white/80 text-slate-700 border-slate-200 hover:border-[#35B8B2]'
                  }`}
                >
                  {zone}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tags & Segments */}
        <div className="space-y-1.5 shrink-0">
          <div className="flex items-center gap-1.5 text-[#006a66] font-bold uppercase tracking-wider text-[11px]">
            <TagIcon className="w-3.5 h-3.5" />
            <span>Tags & Segments</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {allTags.slice(0, 4).map(tag => {
              const selected = filters.tags?.includes(tag.name);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => handleTagToggle(tag.name)}
                  className={`px-2 py-1 rounded-lg border text-xs font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                    selected
                      ? 'bg-[#256865] text-white border-[#256865]'
                      : 'bg-white/80 text-slate-700 border-slate-200 hover:border-[#256865]'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tag.color }} />
                  {tag.name}
                </button>
              );
            })}
          </div>
        </div>

      </div>

      {/* Bottom Footer Info Box - Non-scrollable Lock */}
      <div className="shrink-0 p-3 bg-[#35B8B2]/10 border border-[#35B8B2]/30 rounded-xl flex items-center gap-2 text-xs text-[#006a66]">
        <Sparkles className="w-4 h-4 shrink-0 text-[#006a66]" />
        <span className="font-semibold text-[11px]">
          Verrouillage d'affichage optimal (Sans défilement interne)
        </span>
      </div>
    </aside>
  );
};
