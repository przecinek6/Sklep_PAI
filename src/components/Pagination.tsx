import React from 'react';
import './Pagination.css';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  itemsPerPage?: number;
  totalItems?: number;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  itemsPerPage,
  totalItems,
}) => {
  // Generuj numery stron do wyświetlenia
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 7; // Maksymalna ilość widocznych numerów

    if (totalPages <= maxVisible) {
      // Jeśli jest mało stron, pokaż wszystkie
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Zawsze pokaż pierwszą stronę
      pages.push(1);

      if (currentPage > 3) {
        pages.push('...');
      }

      // Pokaż strony wokół aktualnej
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (currentPage < totalPages - 2) {
        pages.push('...');
      }

      // Zawsze pokaż ostatnią stronę
      pages.push(totalPages);
    }

    return pages;
  };

  const handlePrevious = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  const handlePageClick = (page: number | string) => {
    if (typeof page === 'number') {
      onPageChange(page);
    }
  };

  if (totalPages <= 1) return null;

  return (
    <div className="pagination-container">
      {totalItems !== undefined && itemsPerPage !== undefined && (
        <div className="pagination-info">
          Wyświetlanie {(currentPage - 1) * itemsPerPage + 1}-
          {Math.min(currentPage * itemsPerPage, totalItems)} z {totalItems}
        </div>
      )}

      <div className="pagination">
        <button
          className="pagination-btn pagination-arrow"
          onClick={handlePrevious}
          disabled={currentPage === 1}
          aria-label="Poprzednia strona"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M12.5 15L7.5 10L12.5 5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {getPageNumbers().map((page, index) => (
          <React.Fragment key={index}>
            {page === '...' ? (
              <span className="pagination-dots">...</span>
            ) : (
              <button
                className={`pagination-btn ${
                  page === currentPage ? 'active' : ''
                }`}
                onClick={() => handlePageClick(page)}
              >
                {page}
              </button>
            )}
          </React.Fragment>
        ))}

        <button
          className="pagination-btn pagination-arrow"
          onClick={handleNext}
          disabled={currentPage === totalPages}
          aria-label="Następna strona"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M7.5 15L12.5 10L7.5 5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
};
