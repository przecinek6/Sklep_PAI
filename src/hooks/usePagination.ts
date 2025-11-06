import { useState, useEffect } from 'react';

interface UsePaginationProps<T> {
  items?: T[];
  itemsPerPage?: number;
  fetchFunction?: (page: number, limit: number) => Promise<{ data: T[]; total: number }>;
}

interface UsePaginationReturn<T> {
  currentPage: number;
  totalPages: number;
  currentItems: T[];
  totalItems: number;
  loading: boolean;
  error: string | null;
  goToPage: (page: number) => void;
  nextPage: () => void;
  previousPage: () => void;
  setItemsPerPage: (perPage: number) => void;
}

/**
 * Hook do zarządzania paginacją
 * Może pracować z lokalną tablicą lub funkcją fetchującą z API
 */
export function usePagination<T>({
  items,
  itemsPerPage = 10,
  fetchFunction,
}: UsePaginationProps<T>): UsePaginationReturn<T> {
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(itemsPerPage);
  const [currentItems, setCurrentItems] = useState<T[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalPages = Math.ceil(totalItems / perPage);

  // Paginacja lokalna (dla przekazanej tablicy)
  useEffect(() => {
    if (items && !fetchFunction) {
      const startIndex = (currentPage - 1) * perPage;
      const endIndex = startIndex + perPage;
      setCurrentItems(items.slice(startIndex, endIndex));
      setTotalItems(items.length);
    }
  }, [items, currentPage, perPage]); // Usunięto fetchFunction z zależności

  // Paginacja z API (dla funkcji fetchującej)
  useEffect(() => {
    if (fetchFunction) {
      const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
          const result = await fetchFunction(currentPage, perPage);
          setCurrentItems(result.data);
          setTotalItems(result.total);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Błąd ładowania danych');
          setCurrentItems([]);
        } finally {
          setLoading(false);
        }
      };

      fetchData();
    }
  }, [currentPage, perPage]); // Usunięto fetchFunction z zależności - funkcja jest stabilna

  const goToPage = (page: number) => {
    const validPage = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(validPage);
  };

  const nextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const previousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const setItemsPerPageHandler = (newPerPage: number) => {
    setPerPage(newPerPage);
    setCurrentPage(1); // Reset do pierwszej strony
  };

  return {
    currentPage,
    totalPages,
    currentItems,
    totalItems,
    loading,
    error,
    goToPage,
    nextPage,
    previousPage,
    setItemsPerPage: setItemsPerPageHandler,
  };
}
