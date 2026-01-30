import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { mockStudies, Study } from '@/lib/mockData';
import { config } from '@/lib/config';
import { useAuth } from '@/contexts/AuthContext';
import { WorklistHeader } from '@/components/pacs/WorklistHeader';
import { WorklistFilters } from '@/components/pacs/WorklistFilters';
import { WorklistTable } from '@/components/pacs/WorklistTable';
import { StudyDetailDrawer } from '@/components/pacs/StudyDetailDrawer';
import { Pagination } from '@/components/pacs/Pagination';
import { parseISO, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';

type SortField = keyof Study | null;
type SortDirection = 'asc' | 'desc';

const Worklist: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Redirect if not authenticated
  React.useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedModality, setSelectedModality] = useState('All Modalities');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  // Sort state
  const [sortField, setSortField] = useState<SortField>('studyDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(config.app.pageSize);

  // Study detail drawer
  const [selectedStudy, setSelectedStudy] = useState<Study | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Refresh state
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filter and sort studies
  const filteredStudies = useMemo(() => {
    let result = [...mockStudies];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (study) =>
          study.patientName.toLowerCase().includes(query) ||
          study.patientId.toLowerCase().includes(query) ||
          study.accessionNumber.toLowerCase().includes(query)
      );
    }

    // Modality filter
    if (selectedModality && selectedModality !== 'All Modalities') {
      result = result.filter((study) => study.modality === selectedModality);
    }

    // Date range filter
    if (dateFrom) {
      const fromDate = startOfDay(dateFrom);
      result = result.filter((study) => {
        const studyDate = parseISO(study.studyDate);
        return isAfter(studyDate, fromDate) || studyDate.getTime() === fromDate.getTime();
      });
    }

    if (dateTo) {
      const toDate = endOfDay(dateTo);
      result = result.filter((study) => {
        const studyDate = parseISO(study.studyDate);
        return isBefore(studyDate, toDate) || studyDate.getTime() === toDate.getTime();
      });
    }

    // Sort
    if (sortField) {
      result.sort((a, b) => {
        const aValue = a[sortField];
        const bValue = b[sortField];

        if (aValue === bValue) return 0;
        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;

        const comparison = aValue < bValue ? -1 : 1;
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return result;
  }, [searchQuery, selectedModality, dateFrom, dateTo, sortField, sortDirection]);

  // Paginated studies
  const paginatedStudies = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredStudies.slice(start, start + pageSize);
  }, [filteredStudies, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredStudies.length / pageSize);

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return (
      searchQuery !== '' ||
      selectedModality !== 'All Modalities' ||
      dateFrom !== undefined ||
      dateTo !== undefined
    );
  }, [searchQuery, selectedModality, dateFrom, dateTo]);

  // Handlers
  const handleSort = useCallback((field: keyof Study) => {
    setSortField((prev) => {
      if (prev === field) {
        setSortDirection((dir) => (dir === 'asc' ? 'desc' : 'asc'));
        return field;
      }
      setSortDirection('asc');
      return field;
    });
  }, []);

  const handleStudyClick = useCallback((study: Study) => {
    setSelectedStudy(study);
    setIsDrawerOpen(true);
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setIsDrawerOpen(false);
  }, []);

  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedModality('All Modalities');
    setDateFrom(undefined);
    setDateTo(undefined);
    setCurrentPage(1);
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    // Simulate API refresh
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsRefreshing(false);
  }, []);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  }, []);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <WorklistHeader
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        studyCount={filteredStudies.length}
      />

      <main className="flex-1 p-6 space-y-4">
        <WorklistFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedModality={selectedModality}
          onModalityChange={setSelectedModality}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
          onClearFilters={handleClearFilters}
          hasActiveFilters={hasActiveFilters}
        />

        <WorklistTable
          studies={paginatedStudies}
          sortField={sortField}
          sortDirection={sortDirection}
          onSort={handleSort}
          onStudyClick={handleStudyClick}
          selectedStudyId={selectedStudy?.id ?? null}
          isLoading={isRefreshing}
        />

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={filteredStudies.length}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      </main>

      <StudyDetailDrawer
        study={selectedStudy}
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
      />
    </div>
  );
};

export default Worklist;
