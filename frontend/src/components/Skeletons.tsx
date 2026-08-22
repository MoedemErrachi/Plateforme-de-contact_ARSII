import React from 'react';

export const SkeletonBox: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse bg-[#D9E6F2]/50 rounded-lg ${className}`} />
);

export const LoadingSpinner: React.FC<{ size?: 'sm' | 'md' | 'lg'; text?: string }> = ({ 
  size = 'md', 
  text = 'Chargement en cours...' 
}) => {
  const dimension = size === 'sm' ? 'w-5 h-5 border-2' : size === 'lg' ? 'w-12 h-12 border-4' : 'w-8 h-8 border-3';
  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-3">
      <div className={`${dimension} border-[#005596] border-t-transparent rounded-full animate-spin`} />
      {text && <p className="text-xs font-bold text-[#005596] animate-pulse">{text}</p>}
    </div>
  );
};

export const DashboardSkeleton: React.FC = () => (
  <div className="space-y-6">
    {/* KPI Stats Skeletons */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="bg-white p-6 rounded-2xl shadow-[0_6px_18px_rgba(0,0,0,0.06)] border border-[#C9D4DE]/30 h-40 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <SkeletonBox className="w-10 h-10 rounded-xl" />
            <SkeletonBox className="w-16 h-6 rounded-full" />
          </div>
          <div className="space-y-2">
            <SkeletonBox className="w-24 h-8" />
            <SkeletonBox className="w-32 h-4" />
          </div>
        </div>
      ))}
    </div>

    {/* Charts Grid Skeletons */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white p-6 rounded-2xl shadow-[0_6px_18px_rgba(0,0,0,0.06)] border border-[#C9D4DE]/30 space-y-4 h-80">
        <div className="flex justify-between items-center pb-3 border-b border-slate-100">
          <SkeletonBox className="w-48 h-6" />
          <SkeletonBox className="w-24 h-8" />
        </div>
        <div className="h-52 flex items-end justify-between gap-3 pt-6">
          {[60, 85, 45, 95, 70, 50].map((h, idx) => (
            <div key={idx} className="flex-1 flex flex-col items-center gap-2">
              <SkeletonBox className={`w-full h-[${h}%] rounded-t-lg`} />
              <SkeletonBox className="w-8 h-3" />
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-[0_6px_18px_rgba(0,0,0,0.06)] border border-[#C9D4DE]/30 space-y-4 h-80 flex flex-col justify-between">
        <div className="flex justify-between items-center pb-3 border-b border-slate-100">
          <SkeletonBox className="w-40 h-6" />
        </div>
        <div className="flex items-center justify-center my-auto">
          <SkeletonBox className="w-40 h-40 rounded-full" />
        </div>
        <div className="grid grid-cols-4 gap-2">
          {[1, 2, 3, 4].map(idx => (
            <SkeletonBox key={idx} className="h-8 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  </div>
);

export const ContactProfileSkeleton: React.FC = () => (
  <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-6 space-y-6">
    {/* Breadcrumb skeleton */}
    <div className="flex items-center gap-1.5">
      <SkeletonBox className="w-24 h-3" />
      <SkeletonBox className="w-3 h-3 rounded-full" />
      <SkeletonBox className="w-32 h-3" />
    </div>

    {/* Profile header card */}
    <section className="bg-white rounded-2xl p-6 sm:p-8 border border-[#C9D4DE]/40 shadow-[0_6px_18px_rgba(0,0,0,0.06)]">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6">
          <SkeletonBox className="w-24 h-24 sm:w-28 sm:h-28 rounded-full shrink-0" />
          <div className="space-y-3">
            <SkeletonBox className="w-48 h-7" />
            <SkeletonBox className="w-32 h-4" />
            <div className="flex gap-2">
              <SkeletonBox className="w-16 h-5 rounded-lg" />
              <SkeletonBox className="w-20 h-5 rounded-lg" />
              <SkeletonBox className="w-14 h-5 rounded-lg" />
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <SkeletonBox className="w-24 h-10 rounded-xl" />
          <SkeletonBox className="w-10 h-10 rounded-xl" />
        </div>
      </div>
    </section>

    {/* Main grid */}
    <div className="grid grid-cols-12 gap-6">
      <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
        <div className="bg-white rounded-2xl p-6 border border-[#C9D4DE]/40 shadow-[0_6px_18px_rgba(0,0,0,0.06)] space-y-4">
          <SkeletonBox className="w-32 h-5" />
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-3">
              <SkeletonBox className="w-9 h-9 rounded-lg shrink-0" />
              <div className="space-y-1.5 flex-1">
                <SkeletonBox className="w-16 h-3" />
                <SkeletonBox className="w-40 h-4" />
              </div>
            </div>
          ))}
        </div>
        <div className="bg-white rounded-2xl p-6 border border-[#C9D4DE]/40 shadow-[0_6px_18px_rgba(0,0,0,0.06)] space-y-4">
          <SkeletonBox className="w-40 h-5" />
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="space-y-1">
              <SkeletonBox className="w-20 h-3" />
              <SkeletonBox className="w-36 h-4" />
            </div>
          ))}
        </div>
      </div>
      <div className="col-span-12 lg:col-span-8">
        <div className="bg-white rounded-2xl p-6 border border-[#C9D4DE]/40 shadow-[0_6px_18px_rgba(0,0,0,0.06)] space-y-4">
          <SkeletonBox className="w-44 h-5" />
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-[#F4F6F8] rounded-xl p-3.5 space-y-1.5">
                <SkeletonBox className="w-20 h-3" />
                <SkeletonBox className="w-32 h-4" />
              </div>
            ))}
          </div>
          <div className="pt-4 border-t border-[#C9D4DE]/40 space-y-2">
            <SkeletonBox className="w-28 h-3" />
            <div className="flex gap-2">
              <SkeletonBox className="w-16 h-5 rounded-full" />
              <SkeletonBox className="w-20 h-5 rounded-full" />
              <SkeletonBox className="w-14 h-5 rounded-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export const ContactsTableSkeleton: React.FC = () => (
  <div className="space-y-6">
    {/* Filter bar skeleton */}
    <div className="bg-white rounded-2xl p-4 shadow-[0_6px_18px_rgba(0,0,0,0.06)] border border-[#C9D4DE]/40 flex flex-col md:flex-row gap-4 items-center justify-between">
      <SkeletonBox className="w-full md:w-96 h-10 rounded-xl" />
      <div className="flex items-center gap-3 w-full md:w-auto justify-end">
        <SkeletonBox className="w-28 h-10 rounded-xl" />
        <SkeletonBox className="w-28 h-10 rounded-xl" />
      </div>
    </div>

    {/* Table skeleton */}
    <div className="bg-white rounded-2xl shadow-[0_6px_18px_rgba(0,0,0,0.06)] border border-[#C9D4DE]/40 overflow-hidden">
      <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
        <SkeletonBox className="w-36 h-5" />
        <SkeletonBox className="w-24 h-5" />
      </div>
      <div className="divide-y divide-slate-100">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1">
              <SkeletonBox className="w-10 h-10 rounded-full shrink-0" />
              <div className="space-y-1.5 flex-1">
                <SkeletonBox className="w-40 h-4" />
                <SkeletonBox className="w-56 h-3" />
              </div>
            </div>
            <SkeletonBox className="w-28 h-4 hidden sm:block" />
            <SkeletonBox className="w-24 h-6 rounded-full hidden md:block" />
            <SkeletonBox className="w-20 h-7 rounded-lg" />
          </div>
        ))}
      </div>
      {/* Pagination bar skeleton */}
      <div className="p-4 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3 bg-slate-50/60">
        <SkeletonBox className="w-40 h-4" />
        <div className="flex items-center gap-2">
          <SkeletonBox className="w-9 h-9 rounded-lg" />
          <SkeletonBox className="w-16 h-9 rounded-lg" />
          <SkeletonBox className="w-9 h-9 rounded-lg" />
        </div>
        <SkeletonBox className="w-28 h-9 rounded-xl" />
      </div>
    </div>
  </div>
);

/** Écran plein affiché pendant la réhydratation de la session (refresh). */
export const AuthSplash: React.FC = () => (
  <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#F4F6F8] font-sans gap-4" aria-busy="true" aria-live="polite">
    <div className="w-10 h-10 border-4 border-[#005596] border-t-transparent rounded-full animate-spin" />
    <p className="text-sm font-bold text-[#55636B]">Chargement...</p>
  </div>
);

/** Squelette de la page Segmentation (grille de cartes segments/tags). */
export const SegmentationSkeleton: React.FC = () => (
  <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-8 space-y-8">
    <div className="flex justify-between items-center gap-4">
      <div className="space-y-2">
        <SkeletonBox className="w-64 h-7" />
        <SkeletonBox className="w-80 h-4" />
      </div>
      <SkeletonBox className="w-44 h-10 rounded-xl shrink-0" />
    </div>

    {/* Tabs */}
    <div className="flex gap-3">
      <SkeletonBox className="w-32 h-11 rounded-xl" />
      <SkeletonBox className="w-28 h-11 rounded-xl" />
    </div>

    {/* Cards grid */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[1, 2, 3, 4, 5, 6].map(i => (
        <div key={i} className="bg-white rounded-2xl p-6 border border-[#C9D4DE]/40 shadow-[0_6px_18px_rgba(0,0,0,0.06)] space-y-4">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-2.5">
              <SkeletonBox className="w-10 h-10 rounded-xl" />
              <div className="space-y-1.5">
                <SkeletonBox className="w-32 h-4" />
                <SkeletonBox className="w-24 h-5 rounded-full" />
              </div>
            </div>
            <SkeletonBox className="w-8 h-8 rounded-lg" />
          </div>
          <SkeletonBox className="w-full h-4" />
          <SkeletonBox className="w-3/4 h-4" />
          <div className="flex gap-2 pt-2">
            <SkeletonBox className="w-20 h-5 rounded-full" />
            <SkeletonBox className="w-24 h-5 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

/** Squelette du panneau de résultats OCR pendant l'extraction. */
export const OcrResultSkeleton: React.FC = () => (
  <div className="bg-white rounded-2xl p-6 border border-[#C9D4DE]/40 shadow-[0_6px_18px_rgba(0,0,0,0.06)] space-y-5">
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 border-[3px] border-[#005596] border-t-transparent rounded-full animate-spin shrink-0" />
      <div className="space-y-1.5">
        <SkeletonBox className="w-48 h-4" />
        <SkeletonBox className="w-64 h-3" />
      </div>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {['Prénom', 'Nom', 'E-mail', 'Téléphone', 'Affiliation', 'Fonction', 'Ville', 'Pays'].map(label => (
        <div key={label} className="bg-[#F4F6F8] rounded-xl p-3.5 space-y-1.5">
          <SkeletonBox className="w-16 h-3" />
          <SkeletonBox className="w-36 h-4" />
        </div>
      ))}
    </div>
  </div>
);

/** Bulle « l'assistant réfléchit » affichée pendant l'attente du chatbot. */
export const ChatThinkingBubble: React.FC = () => (
  <div className="flex justify-start" aria-live="polite" aria-label="L'assistant est en train de rédiger une réponse">
    <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="w-2 h-2 rounded-full bg-[#005596]/60 animate-bounce"
            style={{ animationDelay: `${i * 150}ms`, animationDuration: '0.9s' }}
          />
        ))}
      </div>
    </div>
  </div>
);
