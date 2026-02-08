import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Study } from '@/lib/mockData';
import { config } from '@/lib/config';
import { useAuth } from '@/contexts/AuthContext';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { RefreshCw, SlidersHorizontal, Trash2, Loader2 } from 'lucide-react';
import { WorklistFilters } from '@/components/pacs/WorklistFilters';
import { WorklistTable, Column, allAvailableColumns, defaultColumns } from '@/components/pacs/WorklistTable';
import { StudyDetailDrawer } from '@/components/pacs/StudyDetailDrawer';
import { Pagination } from '@/components/pacs/Pagination';
import { parseISO, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';
import { useStudies } from '@/hooks/useStudies';
import { pacsApi } from '@/services/pacsApi';
import { useToast } from '@/components/ui/use-toast';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type SortField = keyof Study | null;
type SortDirection = 'asc' | 'desc';

const Worklist: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Data fetching
  const { data: studies = [], isLoading, error, refetch } = useStudies();

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
  const [selectedStudyId, setSelectedStudyId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Selection state
  const [selectedStudyIds, setSelectedStudyIds] = useState<string[]>([]);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Columns state
  const [columns, setColumns] = useState<Column[]>(() => {
    const saved = localStorage.getItem('worklist_columns');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const restoredColumns = parsed
          .map((c: any) => allAvailableColumns.find(ac => ac.key === c.key))
          .filter((c: Column | undefined): c is Column => !!c);
        
        if (restoredColumns.length > 0) return restoredColumns;
      } catch (e) {
        console.error('Failed to parse saved columns', e);
      }
    }
    return defaultColumns;
  });

  const toggleColumn = (columnKey: keyof Study) => {
    setColumns(current => {
      const exists = current.find(c => c.key === columnKey);
      let newColumns;
      if (exists) {
        newColumns = current.filter(c => c.key !== columnKey);
      } else {
        const columnToAdd = allAvailableColumns.find(c => c.key === columnKey);
        if (columnToAdd) {
          newColumns = [...current, columnToAdd];
        } else {
          newColumns = current;
        }
      }
      localStorage.setItem('worklist_columns', JSON.stringify(newColumns));
      return newColumns;
    });
  };

  const resetColumns = () => {
    setColumns(defaultColumns);
    localStorage.setItem('worklist_columns', JSON.stringify(defaultColumns));
  };
  
  const handleColumnsChange = (newColumns: Column[]) => {
      setColumns(newColumns);
      localStorage.setItem('worklist_columns', JSON.stringify(newColumns));
  };

  // Filter and sort studies
  const filteredStudies = useMemo(() => {
    let result = [...studies];

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
        if (!study.studyDate) return false;
        const studyDate = parseISO(study.studyDate);
        return isAfter(studyDate, fromDate) || studyDate.getTime() === fromDate.getTime();
      });
    }

    if (dateTo) {
      const toDate = endOfDay(dateTo);
      result = result.filter((study) => {
        if (!study.studyDate) return false;
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
  }, [studies, searchQuery, selectedModality, dateFrom, dateTo, sortField, sortDirection]);

  // Pagination logic
  const totalPages = Math.ceil(filteredStudies.length / pageSize);
  const paginatedStudies = filteredStudies.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handleSort = (field: keyof Study) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleStudyClick = (study: Study) => {
    setSelectedStudyId(study.id);
    setIsDrawerOpen(true);
  };

  const handleRefresh = async () => {
    await refetch();
  };

  const hasActiveFilters = searchQuery !== '' || 
    selectedModality !== 'All Modalities' || 
    dateFrom !== undefined || 
    dateTo !== undefined;

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedModality('All Modalities');
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      // Select all visible studies (paginated)
      const ids = paginatedStudies.map(s => s.id);
      // Merge with existing selection to avoid losing selections from other pages if we wanted to support multi-page selection
      // But for "select all on page" behavior:
      setSelectedStudyIds(prev => {
        const newIds = new Set(prev);
        ids.forEach(id => newIds.add(id));
        return Array.from(newIds);
      });
    } else {
      // Deselect all visible studies
      const idsToDeselect = paginatedStudies.map(s => s.id);
      setSelectedStudyIds(prev => prev.filter(id => !idsToDeselect.includes(id)));
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    setSelectedStudyIds(prev => {
      if (checked) {
        return [...prev, id];
      } else {
        return prev.filter(i => i !== id);
      }
    });
  };

  const handleDeleteSelected = async () => {
    if (selectedStudyIds.length === 0) return;
    
    setIsDeleting(true);
    let successCount = 0;
    let failCount = 0;

    try {
      // Process deletions in sequence or parallel?
      // Let's do parallel with Promise.allSettled for better performance but might hit rate limits?
      // pacsApi deleteStudy is just a fetch call.
      
      const results = await Promise.allSettled(
        selectedStudyIds.map(id => pacsApi.deleteStudy(id))
      );

      results.forEach(result => {
        if (result.status === 'fulfilled') {
          successCount++;
        } else {
          failCount++;
          console.error('Delete failed:', result.reason);
        }
      });

      if (successCount > 0) {
        toast({
          title: "Deletion Complete",
          description: `Successfully deleted ${successCount} study(s).`,
          variant: "default",
        });
        await refetch();
        setSelectedStudyIds([]); // Clear selection
      }

      if (failCount > 0) {
        toast({
          title: "Deletion Issues",
          description: `Failed to delete ${failCount} study(s). Check console for details.`,
          variant: "destructive",
        });
      }

    } catch (error) {
      console.error('Bulk delete error:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred during deletion.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setIsDeleteConfirmOpen(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <Header
        title="Worklist"
        subtitle="Manage and view patient studies"
      >
        {selectedStudyIds.length > 0 && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setIsDeleteConfirmOpen(true)}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            <span className="hidden sm:inline">Delete ({selectedStudyIds.length})</span>
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isLoading}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </Header>
      
      <main className="flex-1 container py-6 flex flex-col gap-6 overflow-hidden">
        <WorklistFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedModality={selectedModality}
          onModalityChange={setSelectedModality}
          dateFrom={dateFrom}
          onDateFromChange={setDateFrom}
          dateTo={dateTo}
          onDateToChange={setDateTo}
          onClearFilters={handleClearFilters}
          hasActiveFilters={hasActiveFilters}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground">
                <SlidersHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[200px]">
              <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {allAvailableColumns.map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.key}
                  className="capitalize"
                  checked={columns.some(c => c.key === column.key)}
                  onCheckedChange={() => toggleColumn(column.key)}
                >
                  {column.label}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                onCheckedChange={resetColumns}
                checked={false}
                className="text-destructive focus:text-destructive"
              >
                Reset to Default
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </WorklistFilters>
        
        <div className="flex-1 flex flex-col overflow-hidden">
          {error ? (
            <div className="flex-1 flex items-center justify-center text-destructive">
              Error loading studies. Please check your connection to PACS.
            </div>
          ) : (
            <WorklistTable
              className="flex-1 min-h-0"
              studies={paginatedStudies}
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={handleSort}
              onStudyClick={handleStudyClick}
              selectedStudyId={selectedStudyId}
              isLoading={isLoading}
              columns={columns}
              onColumnsChange={handleColumnsChange}
              selectedIds={selectedStudyIds}
              onSelectAll={handleSelectAll}
              onSelectOne={handleSelectOne}
            />
          )}
          
          <div className="mt-4">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              pageSize={pageSize}
              onPageSizeChange={setPageSize}
              totalItems={filteredStudies.length}
            />
          </div>
        </div>
      </main>

      <StudyDetailDrawer
        studyId={selectedStudyId}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />

      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {selectedStudyIds.length} selected study(s) and all associated series and instances.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteSelected();
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Worklist;
