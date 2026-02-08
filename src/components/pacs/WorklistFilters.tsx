import React, { useState, useEffect } from 'react';
import { Search, X, Calendar, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format, subDays, isSameDay } from 'date-fns';
import { modalityOptions } from '@/lib/mockData';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface WorklistFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  selectedModality: string;
  onModalityChange: (value: string) => void;
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  onDateFromChange: (date: Date | undefined) => void;
  onDateToChange: (date: Date | undefined) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  children?: React.ReactNode;
}

type DateFilterMode = 'today' | 'lastDays' | 'range';

export const WorklistFilters: React.FC<WorklistFiltersProps> = ({
  searchQuery,
  onSearchChange,
  selectedModality,
  onModalityChange,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  onClearFilters,
  hasActiveFilters,
  children,
}) => {
  const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false);
  
  // Local state for the popover
  const [mode, setMode] = useState<DateFilterMode>('range');
  const [lastDays, setLastDays] = useState(7);
  const [tempDateFrom, setTempDateFrom] = useState<Date | undefined>(dateFrom);
  const [tempDateTo, setTempDateTo] = useState<Date | undefined>(dateTo);

  // Initialize local state when popover opens or props change
  useEffect(() => {
    if (isDatePopoverOpen) {
      const today = new Date();
      if (dateFrom && dateTo && isSameDay(dateFrom, today) && isSameDay(dateTo, today)) {
        setMode('today');
      } else if (dateFrom && dateTo && isSameDay(dateTo, today)) {
        // Check if it matches lastDays
        // For simplicity, default to range if not exactly Today
        // Or could try to calculate diff
        setMode('range');
      } else {
        setMode('range');
      }
      setTempDateFrom(dateFrom);
      setTempDateTo(dateTo);
    }
  }, [isDatePopoverOpen, dateFrom, dateTo]);

  const handleApply = () => {
    const today = new Date();
    if (mode === 'today') {
      onDateFromChange(today);
      onDateToChange(today);
    } else if (mode === 'lastDays') {
      onDateFromChange(subDays(today, lastDays));
      onDateToChange(today);
    } else {
      onDateFromChange(tempDateFrom);
      onDateToChange(tempDateTo);
    }
    setIsDatePopoverOpen(false);
  };

  const getDisplayText = () => {
    if (!dateFrom && !dateTo) return 'All Dates';
    const today = new Date();
    if (dateFrom && dateTo && isSameDay(dateFrom, today) && isSameDay(dateTo, today)) {
      return 'Today';
    }
    if (dateFrom && dateTo) {
      return `${format(dateFrom, 'MM/dd/yyyy')} - ${format(dateTo, 'MM/dd/yyyy')}`;
    }
    if (dateFrom) {
      return `From ${format(dateFrom, 'MM/dd/yyyy')}`;
    }
    if (dateTo) {
      return `Until ${format(dateTo, 'MM/dd/yyyy')}`;
    }
    return 'All Dates';
  };

  return (
    <div className="flex flex-wrap items-center gap-3 p-4 bg-card rounded-lg shadow-medical border border-border">
      {/* Search Input */}
      <div className="relative flex-1 min-w-[250px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search patient name, ID, or accession..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 bg-background"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Modality Filter */}
      <div className="min-w-[160px]">
        <Select value={selectedModality} onValueChange={onModalityChange}>
          <SelectTrigger className="bg-background">
            <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Modality" />
          </SelectTrigger>
          <SelectContent>
            {modalityOptions.map((modality) => (
              <SelectItem key={modality} value={modality}>
                {modality}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Unified Date Filter */}
      <Popover open={isDatePopoverOpen} onOpenChange={setIsDatePopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'min-w-[200px] justify-start text-left font-normal bg-background',
              !dateFrom && !dateTo && 'text-muted-foreground'
            )}
          >
            <Calendar className="mr-2 h-4 w-4" />
            {getDisplayText()}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-4" align="start">
          <div className="space-y-4">
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as DateFilterMode)}>
              
              {/* Today Option */}
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="today" id="r1" />
                <Label htmlFor="r1" className="cursor-pointer">Today</Label>
              </div>

              {/* Less or Equal to X Days Option */}
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="lastDays" id="r2" />
                <div className="flex items-center gap-2">
                  <Label htmlFor="r2" className="cursor-pointer whitespace-nowrap">Less or Equal to</Label>
                  <Input 
                    type="number" 
                    value={lastDays} 
                    onChange={(e) => setLastDays(Number(e.target.value))}
                    className="w-16 h-8"
                    min={1}
                  />
                  <Label htmlFor="r2" className="cursor-pointer">Days</Label>
                </div>
              </div>

              {/* Range Option */}
              <div className="flex items-start space-x-2">
                <RadioGroupItem value="range" id="r3" className="mt-1" />
                <div className="space-y-2">
                  <Label htmlFor="r3" className="cursor-pointer">Range</Label>
                  {mode === 'range' && (
                    <div className="flex gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">From</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className={cn("w-[130px] justify-start text-left font-normal", !tempDateFrom && "text-muted-foreground")}>
                              {tempDateFrom ? format(tempDateFrom, 'MMM d, yyyy') : <span>Pick a date</span>}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <CalendarComponent
                              mode="single"
                              selected={tempDateFrom}
                              onSelect={setTempDateFrom}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">To</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className={cn("w-[130px] justify-start text-left font-normal", !tempDateTo && "text-muted-foreground")}>
                              {tempDateTo ? format(tempDateTo, 'MMM d, yyyy') : <span>Pick a date</span>}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <CalendarComponent
                              mode="single"
                              selected={tempDateTo}
                              onSelect={setTempDateTo}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </RadioGroup>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" size="sm" onClick={() => setIsDatePopoverOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleApply}>
                OK
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {children}

      {/* Clear Filters */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearFilters}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4 mr-1" />
          Clear
        </Button>
      )}
    </div>
  );
};
