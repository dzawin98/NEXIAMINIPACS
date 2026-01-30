import React from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Study } from '@/lib/mockData';
import { StatusBadge } from './StatusBadge';
import { ViewerButtons } from './ViewerButtons';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';

type SortField = keyof Study | null;
type SortDirection = 'asc' | 'desc';

interface WorklistTableProps {
  studies: Study[];
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: keyof Study) => void;
  onStudyClick: (study: Study) => void;
  selectedStudyId: string | null;
  isLoading?: boolean;
}

const columns: { key: keyof Study; label: string; width?: string; sortable?: boolean }[] = [
  { key: 'patientName', label: 'Patient Name', sortable: true },
  { key: 'patientId', label: 'Patient ID', width: 'w-28', sortable: true },
  { key: 'accessionNumber', label: 'Accession #', width: 'w-32', sortable: true },
  { key: 'modality', label: 'Modality', width: 'w-20', sortable: true },
  { key: 'studyDescription', label: 'Study Description', sortable: true },
  { key: 'studyDate', label: 'Date', width: 'w-28', sortable: true },
  { key: 'studyTime', label: 'Time', width: 'w-20', sortable: true },
  { key: 'seriesCount', label: 'Series', width: 'w-16', sortable: true },
  { key: 'instanceCount', label: 'Images', width: 'w-16', sortable: true },
  { key: 'institution', label: 'Institution', width: 'w-36', sortable: true },
  { key: 'status', label: 'Status', width: 'w-28', sortable: true },
];

const SortIcon: React.FC<{ field: keyof Study; sortField: SortField; sortDirection: SortDirection }> = ({
  field,
  sortField,
  sortDirection,
}) => {
  if (sortField !== field) {
    return <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />;
  }
  return sortDirection === 'asc' ? (
    <ArrowUp className="h-3.5 w-3.5 text-primary" />
  ) : (
    <ArrowDown className="h-3.5 w-3.5 text-primary" />
  );
};

const TableSkeleton: React.FC = () => (
  <>
    {Array.from({ length: 8 }).map((_, i) => (
      <tr key={i} className="animate-pulse">
        {columns.map((col, j) => (
          <td key={j} className="px-3 py-3">
            <div className="h-4 bg-muted rounded" style={{ width: `${60 + Math.random() * 40}%` }} />
          </td>
        ))}
        <td className="px-3 py-3">
          <div className="flex gap-1">
            <div className="h-8 w-8 bg-muted rounded" />
            <div className="h-8 w-8 bg-muted rounded" />
            <div className="h-8 w-8 bg-muted rounded" />
          </div>
        </td>
      </tr>
    ))}
  </>
);

export const WorklistTable: React.FC<WorklistTableProps> = ({
  studies,
  sortField,
  sortDirection,
  onSort,
  onStudyClick,
  selectedStudyId,
  isLoading = false,
}) => {
  const formatTime = (time: string) => {
    try {
      const [hours, minutes] = time.split(':');
      return `${hours}:${minutes}`;
    } catch {
      return time;
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'MMM d, yyyy');
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="bg-card rounded-lg shadow-medical border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-table-header border-b border-border">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'px-3 py-3 text-left font-medium text-muted-foreground',
                    col.width,
                    col.sortable && 'cursor-pointer hover:text-foreground transition-colors select-none'
                  )}
                  onClick={() => col.sortable && onSort(col.key)}
                >
                  <div className="flex items-center gap-1.5">
                    {col.label}
                    {col.sortable && (
                      <SortIcon field={col.key} sortField={sortField} sortDirection={sortDirection} />
                    )}
                  </div>
                </th>
              ))}
              <th className="px-3 py-3 text-left font-medium text-muted-foreground w-32">
                Viewers
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <TableSkeleton />
            ) : studies.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="px-3 py-16 text-center">
                  <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <svg
                      className="h-12 w-12 text-muted-foreground/30"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <p className="font-medium">No studies found</p>
                    <p className="text-sm">Try adjusting your search or filter criteria</p>
                  </div>
                </td>
              </tr>
            ) : (
              studies.map((study) => (
                <tr
                  key={study.id}
                  className={cn(
                    'worklist-row border-b border-border/50 last:border-0',
                    selectedStudyId === study.id && 'selected'
                  )}
                  onClick={() => onStudyClick(study)}
                >
                  <td className="px-3 py-3 font-medium">{study.patientName}</td>
                  <td className="px-3 py-3 text-muted-foreground">{study.patientId}</td>
                  <td className="px-3 py-3 text-muted-foreground">{study.accessionNumber}</td>
                  <td className="px-3 py-3">
                    <span className="inline-flex items-center justify-center w-10 h-6 rounded bg-accent text-accent-foreground text-xs font-semibold">
                      {study.modality}
                    </span>
                  </td>
                  <td className="px-3 py-3 max-w-xs truncate" title={study.studyDescription}>
                    {study.studyDescription}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">
                    {formatDate(study.studyDate)}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">{formatTime(study.studyTime)}</td>
                  <td className="px-3 py-3 text-center text-muted-foreground">{study.seriesCount}</td>
                  <td className="px-3 py-3 text-center text-muted-foreground">{study.instanceCount}</td>
                  <td className="px-3 py-3 text-muted-foreground truncate max-w-[150px]" title={study.institution}>
                    {study.institution}
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge status={study.status} />
                  </td>
                  <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                    <ViewerButtons
                      studyInstanceUID={study.studyInstanceUID}
                      orthancId={study.orthancId}
                      compact
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
