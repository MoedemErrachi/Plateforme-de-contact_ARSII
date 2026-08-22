import React from 'react';

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  adjacent?: number;
  edgePages?: number;
}

type PaginationItem = { type: 'page'; value: number; key: string } | { type: 'ellipsis'; key: string };

function buildItems(page: number, totalPages: number, adjacent: number, edgePages: number): PaginationItem[] {
  const wanted = new Set<number>();
  const clamp = (n: number) => Math.max(1, Math.min(totalPages, n));

  for (let i = 1; i <= edgePages; i++) wanted.add(i);
  for (let i = totalPages - edgePages + 1; i <= totalPages; i++) wanted.add(clamp(i));
  for (let i = page - adjacent; i <= page + adjacent; i++) wanted.add(clamp(i));

  const pages = Array.from(wanted).sort((a, b) => a - b);
  const items: PaginationItem[] = [];

  pages.forEach((value, index) => {
    if (index > 0 && value - pages[index - 1] > 1) {
      items.push({ type: 'ellipsis', key: `ellipsis-${index}` });
    }
    items.push({ type: 'page', value, key: `page-${value}` });
  });

  return items;
}

export const Pagination: React.FC<PaginationProps> = ({
  page,
  totalPages,
  onPageChange,
  adjacent = 1,
  edgePages = 2
}) => {
  if (totalPages <= 1) return null;

  const items = buildItems(page, totalPages, adjacent, edgePages);

  return (
    <div className="flex items-center gap-1">
      {items.map(item =>
        item.type === 'ellipsis' ? (
          <span key={item.key} className="w-4 text-center text-[#55636B] select-none" aria-hidden="true">
            …
          </span>
        ) : (
          <button
            key={item.key}
            onClick={() => onPageChange(item.value)}
            aria-current={item.value === page ? 'page' : undefined}
            className={`w-7 h-7 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
              item.value === page
                ? 'bg-[#005596] text-white shadow-xs'
                : 'hover:bg-[#D9E6F2] text-[#55636B]'
            }`}
          >
            {item.value}
          </button>
        )
      )}
    </div>
  );
};
