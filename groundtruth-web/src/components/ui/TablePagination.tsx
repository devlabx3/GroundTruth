import { CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react';
import Button from './Button';

interface TablePaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export default function TablePagination({
  currentPage,
  totalPages,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: TablePaginationProps) {
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, total);

  return (
    <div className="flex items-center justify-between gap-4 pt-4 border-t border-graphite-light">
      <div className="flex items-center gap-2">
        <label htmlFor="pageSize" className="text-xs text-graphite">
          Por página:
        </label>
        <select
          id="pageSize"
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="px-2 py-1 border border-graphite-light rounded text-xs">
          {[10, 25, 50, 100].map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </div>

      <div className="text-xs text-graphite">
        Mostrando {startItem} a {endItem} de {total} resultados
      </div>

      <div className="flex gap-1">
        <Button
          variant="ghost"
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="px-2 py-1">
          <CaretLeftIcon size={16} />
        </Button>

        <div className="flex items-center gap-1 px-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((page) => {
              const distance = Math.abs(page - currentPage);
              return distance <= 1 || page === 1 || page === totalPages;
            })
            .map((page, idx, arr) => (
              <div key={page}>
                {idx > 0 && arr[idx - 1] !== page - 1 && <span className="px-1 text-graphite">…</span>}
                <Button
                  variant={page === currentPage ? 'primary' : 'ghost'}
                  onClick={() => onPageChange(page)}
                  className="px-2 py-1 text-xs min-w-8">
                  {page}
                </Button>
              </div>
            ))}
        </div>

        <Button
          variant="ghost"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="px-2 py-1">
          <CaretRightIcon size={16} />
        </Button>
      </div>
    </div>
  );
}
