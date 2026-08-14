import React, { useMemo, useState } from 'react';
import { Contact, Gender, GENDER_LABELS } from '../types';

interface DistributionChartProps {
  contacts: Contact[];
}

type Mode = 'countryGender' | 'country' | 'gender';

const GENDER_COLORS: Record<Gender, string> = {
  FEMALE: '#B8167C',
  MALE: '#005596',
  NOT_SPECIFIED: '#8A98A1'
};

const GENDERS: Gender[] = ['FEMALE', 'MALE', 'NOT_SPECIFIED'];

const MODE_OPTIONS: { value: Mode; label: string }[] = [
  { value: 'countryGender', label: 'Pays & Genre (empilé)' },
  { value: 'country', label: 'Par pays' },
  { value: 'gender', label: 'Par genre' }
];

interface HoveredSegment {
  mode: Mode;
  key: string;
  label: string;
  count: number;
}

function toGender(value?: string): Gender {
  return value === 'MALE' ? 'MALE' : value === 'FEMALE' ? 'FEMALE' : 'NOT_SPECIFIED';
}

export const DistributionChart: React.FC<DistributionChartProps> = ({ contacts }) => {
  const [mode, setMode] = useState<Mode>('countryGender');
  const [hovered, setHovered] = useState<HoveredSegment | null>(null);

  const genderTotals = useMemo(() => {
    const totals: Record<Gender, number> = { FEMALE: 0, MALE: 0, NOT_SPECIFIED: 0 };
    contacts.forEach(c => {
      totals[toGender(c.gender)] += 1;
    });
    return totals;
  }, [contacts]);

  const totalCount = contacts.length;

  const countryData = useMemo(() => {
    const totals: Record<string, number> = {};
    contacts.forEach(c => {
      const raw = c.countryOfOrigin?.trim();
      const country = raw && raw !== 'N/A' ? raw : 'Inconnu';
      totals[country] = (totals[country] || 0) + 1;
    });
    return Object.entries(totals)
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [contacts]);

  const countryGenderData = useMemo(() => {
    const matrix: Record<string, Record<Gender, number>> = {};
    contacts.forEach(c => {
      const raw = c.countryOfOrigin?.trim();
      const country = raw && raw !== 'N/A' ? raw : 'Inconnu';
      if (!matrix[country]) {
        matrix[country] = { FEMALE: 0, MALE: 0, NOT_SPECIFIED: 0 };
      }
      matrix[country][toGender(c.gender)] += 1;
    });
    return Object.entries(matrix)
      .map(([country, genderCounts]) => {
        const total = Object.values(genderCounts).reduce((s, n) => s + n, 0);
        return { country, total, genderCounts };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [contacts]);

  const maxCountryCount = Math.max(...countryData.map(d => d.count), 1);

  const hoverCountBadge = (count: number) => (
    <span className="absolute inset-0 flex items-center justify-center text-[11px] font-extrabold text-white pointer-events-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
      {count}
    </span>
  );

  return (
    <div className="space-y-4">
      {/* Segmented toggle */}
      <div className="flex flex-wrap gap-1.5">
        {MODE_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => { setMode(opt.value); setHovered(null); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              mode === opt.value
                ? 'bg-[#E8F1F8] text-[#005596] ring-1 ring-[#BCD7EE]'
                : 'bg-white border border-[#C9D4DE] text-[#55636B] hover:bg-slate-50'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {mode === 'gender' && (
        <div className="space-y-3">
          {GENDERS.map(g => {
            const count = genderTotals[g];
            const pct = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;
            const isHovered = hovered?.mode === 'gender' && hovered?.key === g;
            return (
              <div
                key={g}
                className="flex items-center gap-3"
                onMouseEnter={() => setHovered({ mode: 'gender', key: g, label: GENDER_LABELS[g], count })}
                onMouseLeave={() => setHovered(null)}
              >
                <span className="w-40 shrink-0 text-xs font-semibold text-[#55636B] flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: GENDER_COLORS[g] }} />
                  {GENDER_LABELS[g]}
                </span>
                <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden relative">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${Math.max(pct, count > 0 ? 3 : 0)}%`, backgroundColor: GENDER_COLORS[g] }}
                  />
                  {isHovered && count > 0 && hoverCountBadge(count)}
                </div>
                <span className="w-16 shrink-0 text-right text-xs font-bold text-[#1C2529]">
                  {count} ({pct}%)
                </span>
              </div>
            );
          })}
        </div>
      )}

      {mode === 'country' && (
        <div className="space-y-3">
          {countryData.map(d => {
            const pct = Math.round((d.count / maxCountryCount) * 100);
            const isHovered = hovered?.mode === 'country' && hovered?.key === d.country;
            return (
              <div
                key={d.country}
                className="flex items-center gap-3"
                onMouseEnter={() => setHovered({ mode: 'country', key: d.country, label: d.country, count: d.count })}
                onMouseLeave={() => setHovered(null)}
              >
                <span className="w-40 shrink-0 text-xs font-semibold text-[#55636B] truncate" title={d.country}>
                  {d.country}
                </span>
                <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden relative">
                  <div
                    className="h-full rounded-full bg-[#005596] transition-all"
                    style={{ width: `${Math.max(pct, d.count > 0 ? 3 : 0)}%` }}
                  />
                  {isHovered && d.count > 0 && hoverCountBadge(d.count)}
                </div>
                <span className="w-16 shrink-0 text-right text-xs font-bold text-[#1C2529]">{d.count}</span>
              </div>
            );
          })}
        </div>
      )}

      {mode === 'countryGender' && (
        <div className="space-y-3">
          {countryGenderData.map(d => (
            <div key={d.country} className="flex items-center gap-3">
              <span className="w-40 shrink-0 text-xs font-semibold text-[#55636B] truncate" title={d.country}>
                {d.country}
              </span>
              <div className="flex-1 h-7 bg-slate-100 rounded-full overflow-hidden flex relative">
                {GENDERS.map(g => {
                  const count = d.genderCounts[g];
                  if (count === 0) return null;
                  const pct = d.total > 0 ? (count / d.total) * 100 : 0;
                  const segKey = `${d.country}|${g}`;
                  const isHovered = hovered?.mode === 'countryGender' && hovered?.key === segKey;
                  return (
                    <div
                      key={g}
                      className="h-full relative transition-all cursor-pointer"
                      style={{ width: `${pct}%`, backgroundColor: GENDER_COLORS[g] }}
                      onMouseEnter={() => setHovered({ mode: 'countryGender', key: segKey, label: `${d.country} · ${GENDER_LABELS[g]}`, count })}
                      onMouseLeave={() => setHovered(null)}
                    >
                      {isHovered && hoverCountBadge(count)}
                    </div>
                  );
                })}
              </div>
              <span className="w-16 shrink-0 text-right text-xs font-bold text-[#1C2529]">{d.total}</span>
            </div>
          ))}
          <div className="flex flex-wrap gap-x-5 gap-y-1.5 pt-2 border-t border-slate-100">
            {GENDERS.map(g => (
              <div key={g} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: GENDER_COLORS[g] }} />
                <span className="text-[11px] font-semibold text-[#55636B]">{GENDER_LABELS[g]}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
