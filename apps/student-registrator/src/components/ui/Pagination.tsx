import { Icons } from './Icons';

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}

export function Pagination({ page, pageSize, total, onChange }: PaginationProps) {
  const totalPages = Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  if (total === 0) return null;

  return (
    <div className="pagination">
      <span className="pagination-info">
        {start}-{end} / {total}
      </span>
      <div className="pagination-actions">
        <button
          className="btn-icon"
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          aria-label="Oldingi sahifa"
        >
          <Icons.ChevronLeft />
        </button>
        <span className="pagination-page">
          {page} / {totalPages}
        </span>
        <button
          className="btn-icon"
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Keyingi sahifa"
        >
          <Icons.ChevronRight />
        </button>
      </div>
    </div>
  );
}
