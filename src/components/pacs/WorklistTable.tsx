import React, { useState, useEffect } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Settings, Check } from 'lucide-react';
import { Study } from '@/lib/mockData';
import { StatusBadge } from './StatusBadge';
import { ViewerButtons } from './ViewerButtons';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { Checkbox } from "@/components/ui/checkbox";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from '@/components/ui/button';

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
  columns: Column[];
  onColumnsChange: (columns: Column[]) => void;
  className?: string;
  selectedIds?: string[];
  onSelectAll?: (checked: boolean) => void;
  onSelectOne?: (id: string, checked: boolean) => void;
}

export interface Column {
  key: keyof Study;
  label: string;
  width?: string;
  sortable?: boolean;
}

export const allAvailableColumns: Column[] = [
  { key: 'actions', label: 'Actions', width: 'w-24', sortable: false },
  { key: 'patientName', label: 'Patient Name', sortable: true },
  { key: 'patientId', label: 'Patient ID', width: 'w-28', sortable: true },
  { key: 'accessionNumber', label: 'Accession #', width: 'w-32', sortable: true },
  { key: 'modality', label: 'Modality', width: 'w-20', sortable: true },
  { key: 'studyDescription', label: 'Study Description', sortable: true },
  { key: 'studyDate', label: 'Study Date', width: 'w-28', sortable: true },
  { key: 'studyTime', label: 'Time', width: 'w-24', sortable: true },
  { key: 'seriesCount', label: 'Series', width: 'w-16', sortable: true },
  { key: 'instanceCount', label: 'Images', width: 'w-16', sortable: true },
  { key: 'institution', label: 'Institution', sortable: true },
  { key: 'referringPhysician', label: 'Ref. Physician', sortable: true },
  { key: 'status', label: 'Status', width: 'w-24', sortable: true },
  { key: 'patientBirthDate', label: 'Birth Date', width: 'w-28', sortable: true },
  { key: 'patientSex', label: 'Sex', width: 'w-16', sortable: true },
  { key: 'studyInstanceUID', label: 'Study UID', sortable: true },
];

export const defaultColumns: Column[] = allAvailableColumns.filter(c => 
  ['actions', 'patientName', 'patientId', 'accessionNumber', 'modality', 'studyDescription', 'studyDate', 'seriesCount', 'instanceCount'].includes(c.key)
);

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

const SortableHeaderCell = ({ column, sortField, sortDirection, onSort }: { column: Column, sortField: SortField, sortDirection: SortDirection, onSort: (field: keyof Study | 'actions') => void }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: column.key });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: 'move'
  };

  return (
    <th
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'px-3 py-3 text-left font-medium text-muted-foreground select-none',
        column.width,
        column.sortable && 'hover:text-foreground transition-colors'
      )}
      onClick={(e) => {
        // Only sort if not dragging and not clicking on a non-sortable element
        if (!isDragging && column.sortable) {
          onSort(column.key);
        }
      }}
    >
      <div className="flex items-center gap-2">
        {column.label}
        {column.sortable && (
          <SortIcon field={column.key} sortField={sortField} sortDirection={sortDirection} />
        )}
      </div>
    </th>
  );
};

const TableSkeleton = ({ columns }: { columns: Column[] }) => (
  <>
    {[...Array(5)].map((_, i) => (
      <tr key={i} className="border-b border-border/50">
        {columns.map((col, j) => (
          <td key={j} className="px-3 py-4">
            <div className="h-4 bg-muted rounded" style={{ width: `${60 + Math.random() * 40}%` }} />
          </td>
        ))}
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
  columns,
  onColumnsChange,
  className,
  selectedIds,
  onSelectAll,
  onSelectOne,
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = columns.findIndex((item) => item.key === active.id);
      const newIndex = columns.findIndex((item) => item.key === over.id);
      const newItems = arrayMove(columns, oldIndex, newIndex);
      onColumnsChange(newItems);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      // Handle DICOM DA format: YYYYMMDD
      if (/^\d{8}$/.test(dateStr)) {
        const year = parseInt(dateStr.substring(0, 4));
        const month = parseInt(dateStr.substring(4, 6)) - 1; 
        const day = parseInt(dateStr.substring(6, 8));
        return format(new Date(year, month, day), 'dd/MM/yyyy');
      }
      return format(parseISO(dateStr), 'dd/MM/yyyy');
    } catch {
      return dateStr;
    }
  };

  const formatBirthDate = (dateStr?: string) => {
    if (!dateStr) return '';
    
    let dob: Date | null = null;

    // Handle DICOM DA format: YYYYMMDD
    if (/^\d{8}$/.test(dateStr)) {
        const year = parseInt(dateStr.substring(0, 4));
        const month = parseInt(dateStr.substring(4, 6)) - 1; 
        const day = parseInt(dateStr.substring(6, 8));
        dob = new Date(year, month, day);
    } 
    // Handle ISO format: YYYY-MM-DD
    else if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        dob = parseISO(dateStr);
    }

    if (dob && !isNaN(dob.getTime())) {
        // Calculate age
        const today = new Date();
        let age = today.getFullYear() - dob.getFullYear();
        const m = today.getMonth() - dob.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
            age--;
        }
        
        try {
            const formattedDate = format(dob, 'dd/MM/yyyy');
            return `${formattedDate} (${age}y)`;
        } catch {
            return dateStr;
        }
    }
    
    return dateStr;
  };

  const isAllSelected = studies.length > 0 && selectedIds && studies.every(s => selectedIds.includes(s.id));
  const isSomeSelected = selectedIds && selectedIds.length > 0 && !isAllSelected;

  return (
    <div className={cn("bg-card rounded-lg shadow-medical border border-border overflow-hidden flex flex-col", className)}>
      <div className="overflow-auto flex-1">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-table-header border-b border-border sticky top-0 z-10">
                {onSelectAll && (
                  <th className="px-3 py-3 w-10 text-left bg-table-header">
                    <Checkbox 
                      checked={isAllSelected || (isSomeSelected ? "indeterminate" : false)}
                      onCheckedChange={(checked) => onSelectAll(checked === true)}
                    />
                  </th>
                )}
                <SortableContext
                  items={columns.map(c => c.key)}
                  strategy={horizontalListSortingStrategy}
                >
                  {columns.map((col) => (
                    <SortableHeaderCell
                      key={col.key}
                      column={col}
                      sortField={sortField}
                      sortDirection={sortDirection}
                      onSort={onSort}
                    />
                  ))}
                </SortableContext>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <TableSkeleton columns={columns} />
              ) : studies.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + (onSelectAll ? 1 : 0)} className="px-3 py-16 text-center">
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
                studies.map((study, index) => (
                  <tr
                    key={study.studyInstanceUID || `${study.id || 'unknown'}-${index}`}
                    className={cn(
                      'worklist-row border-b border-border/50 last:border-0',
                      selectedStudyId === study.id && 'selected'
                    )}
                    onClick={() => onStudyClick(study)}
                  >
                    {onSelectOne && (
                      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <Checkbox 
                          checked={selectedIds?.includes(study.id)}
                          onCheckedChange={(checked) => onSelectOne(study.id, checked === true)}
                        />
                      </td>
                    )}
                    {columns.map((col) => {
                       if (col.key === 'actions') {
                         return (
                           <td key={col.key} className="px-3 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                             <ViewerButtons 
                               studyId={study.engineId} 
                               studyInstanceUid={study.studyInstanceUID} 
                               modality={study.modality}
                               compact={true}
                             />
                           </td>
                         );
                       }
                       if (col.key === 'modality') {
                         return (
                           <td key={col.key} className="px-3 py-3 whitespace-nowrap">
                             <span className="inline-flex items-center justify-center w-10 h-6 rounded bg-accent text-accent-foreground text-xs font-semibold">
                               {study.modality}
                             </span>
                           </td>
                         );
                       }
                       if (col.key === 'studyDate') {
                         return (
                           <td key={col.key} className="px-3 py-3 text-muted-foreground whitespace-nowrap">
                             {formatDate(study.studyDate)}
                           </td>
                         );
                       }
                       if (col.key === 'patientBirthDate') {
                         return (
                           <td key={col.key} className="px-3 py-3 text-muted-foreground whitespace-nowrap">
                             {formatBirthDate(study.patientBirthDate)}
                           </td>
                         );
                       }
                       if (col.key === 'status') {
                          return (
                            <td key={col.key} className="px-3 py-3 whitespace-nowrap">
                              <StatusBadge status={study.status} />
                            </td>
                          );
                       }
                       if (col.key === 'seriesCount' || col.key === 'instanceCount') {
                          return (
                            <td key={col.key} className="px-3 py-3 text-center text-muted-foreground">
                              {study[col.key]}
                            </td>
                          );
                       }
                       
                       return (
                         <td key={col.key} className="px-3 py-3 whitespace-nowrap">
                           {String(study[col.key] || '')}
                         </td>
                       );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </DndContext>
      </div>
    </div>
  );
};
