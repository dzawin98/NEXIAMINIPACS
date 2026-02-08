import React, { useState, useEffect, useRef } from 'react';
import { 
  X, User, FileText, Building, Stethoscope, Calendar, Clock, Hash, Layers, 
  Trash2, ChevronDown, ChevronRight, ImageIcon, Loader2 
} from 'lucide-react';
import { Study, Series } from '@/lib/mockData';
import { StatusBadge } from './StatusBadge';
import { ViewerButtons } from './ViewerButtons';
import { StudyActions } from './StudyActions';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { format, parseISO, differenceInYears } from 'date-fns';
import { cn } from '@/lib/utils';
import { useStudyDetail } from '@/hooks/useStudyDetail';
import { pacsApi } from '@/services/pacsApi';
import { useToast } from '@/components/ui/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';

interface StudyDetailDrawerProps {
  studyId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

const InfoItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string | React.ReactNode;
  className?: string;
}> = ({ icon, label, value, className }) => (
  <div className={cn('flex items-start gap-3', className)}>
    <div className="mt-0.5 text-muted-foreground">{icon}</div>
    <div className="flex-1 min-w-0">
      <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="font-medium mt-0.5 break-words">{value}</p>
    </div>
  </div>
);

// Instance Thumbnail Component (Grid Item)
const InstanceThumbnail: React.FC<{ 
  instance: any; 
  studyId: string;
  seriesId: string;
  onViewImage: (url: string, info?: any) => void;
  onDelete?: (id: string) => void;
  scrollContainerRef?: React.RefObject<HTMLDivElement>;
}> = ({ instance, studyId, seriesId, onViewImage, onDelete, scrollContainerRef }) => {
  const [imageError, setImageError] = useState(false);
  const [previewSrc, setPreviewSrc] = useState<string>('');
  const [isVisible, setIsVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const itemRef = useRef<HTMLDivElement>(null);
  const { hasPermission } = useAuth();

  // Lazy load using Intersection Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { 
        root: scrollContainerRef?.current || null,
        rootMargin: '100px' 
      }
    );

    if (itemRef.current) {
      observer.observe(itemRef.current);
    }

    return () => observer.disconnect();
  }, [scrollContainerRef]);

  useEffect(() => {
    if (!isVisible) return;

    let active = true;
    const load = async () => {
        try {
          const url = await pacsApi.fetchInstancePreviewBlob(instance.ID, studyId, seriesId);
          if (active) {
            setPreviewSrc(url);
          }
      } catch (e) {
        if (active) setImageError(true);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [isVisible, instance.ID, studyId, seriesId]);

  const handleDelete = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!onDelete) return;
      
      if (confirm('Delete this image?')) {
          setIsDeleting(true);
          try {
              await onDelete(instance.ID);
          } catch (e) {
              setIsDeleting(false);
          }
      }
  };

  return (
    <div 
      ref={itemRef}
      className="aspect-square bg-black/20 rounded-md overflow-hidden border border-border/50 cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all relative group"
    >
      <div className="w-full h-full" onClick={() => previewSrc && onViewImage(previewSrc, { type: 'instance', data: { instance, studyId, seriesId } })}>
        {!imageError && previewSrc ? (
           <img 
             src={previewSrc} 
             alt="Preview" 
             className="w-full h-full object-cover"
             onError={() => setImageError(true)}
             loading="lazy"
           />
        ) : (
           <div className="w-full h-full flex items-center justify-center">
              <ImageIcon className="h-6 w-6 text-muted-foreground/50" />
           </div>
        )}
      </div>
      
      {/* Delete Button Overlay */}
      {hasPermission('delete') && onDelete && (
        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
            <Button
                variant="destructive"
                size="icon"
                className="h-6 w-6 shadow-sm opacity-90 hover:opacity-100"
                onClick={handleDelete}
                disabled={isDeleting}
            >
                {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
            </Button>
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-[10px] text-white p-1 truncate opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        Img {instance.IndexInSeries}
      </div>
    </div>
  );
};

// Series Row Component with Expansion and Delete
const SeriesRow: React.FC<{ 
  series: Series; 
  studyId: string;
  onSeriesDeleted: () => void; 
  onViewImage: (url: string, info?: any) => void 
}> = ({ series, studyId, onSeriesDeleted, onViewImage }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [instances, setInstances] = useState<any[]>([]);
  const [isLoadingInstances, setIsLoadingInstances] = useState(false);
  const [isDeletingSeries, setIsDeletingSeries] = useState(false);
  const [seriesPreviewUrl, setSeriesPreviewUrl] = useState<string>('');
  const [previewError, setPreviewError] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const seriesRowRef = useRef<HTMLDivElement>(null);

  // Load series thumbnail
  useEffect(() => {
    let active = true;
    const loadPreview = async () => {
        if (!studyId || !series.id) return;
        try {
            const url = await pacsApi.fetchSeriesPreviewBlob(studyId, series.id);
            if (active && url) {
                setSeriesPreviewUrl(url);
            }
        } catch (e) {
            console.error("Failed to load series preview", e);
            if (active) setPreviewError(true);
        }
    };
    loadPreview();
    return () => { active = false; };
  }, [studyId, series.id]);

  const toggleExpand = async () => {
    if (!isExpanded && instances.length === 0) {
      setIsLoadingInstances(true);
      try {
        // Pass studyId to enforce hierarchical context locking
        const data = await pacsApi.getSeriesInstances(series.id, studyId);
        
        // Sort by instance number
        const sorted = data.sort((a: any, b: any) => 
          (parseInt(a.IndexInSeries || '0') - parseInt(b.IndexInSeries || '0'))
        );
        
        setInstances(sorted);
      } catch (error) {
        console.error("Failed to load instances", error);
        toast({
          title: "Error",
          description: "Failed to load images.",
          variant: "destructive",
        });
      } finally {
        setIsLoadingInstances(false);
      }
    }
    setIsExpanded(!isExpanded);
  };

  const handleDeleteSeries = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this series?')) {
      setIsDeletingSeries(true);
      try {
        await pacsApi.deleteSeries(series.id, studyId);
        toast({ title: "Series deleted" });
        queryClient.invalidateQueries({ queryKey: ['study-detail'] });
        onSeriesDeleted();
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to delete series.",
          variant: "destructive",
        });
        setIsDeletingSeries(false);
      }
    }
  };

  const handleDeleteInstance = async (instanceId: string) => {
    try {
      await pacsApi.deleteInstance(instanceId, studyId, series.id);
      toast({ title: "Image deleted" });
      setInstances(prev => prev.filter(i => i.ID !== instanceId));
      queryClient.invalidateQueries({ queryKey: ['study-detail'] });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete image.",
        variant: "destructive",
      });
      throw error; // Re-throw to be caught by the component
    }
  };

  return (
    <div className="rounded-lg bg-muted/50 overflow-hidden border border-transparent hover:border-border/50 transition-all" ref={seriesRowRef}>
      <div 
        className="flex items-center gap-3 p-3"
      >
        <div 
           className="flex-shrink-0 w-16 h-16 rounded-lg bg-accent flex items-center justify-center overflow-hidden border border-border cursor-pointer relative group"
           onClick={() => seriesPreviewUrl && onViewImage(seriesPreviewUrl, { type: 'series', data: { studyId, series } })}
        >
          {seriesPreviewUrl && !previewError ? (
              <img src={seriesPreviewUrl} alt="Series Preview" className="w-full h-full object-cover" />
          ) : (
              <span className="text-xs font-semibold text-accent-foreground">{series.modality}</span>
          )}
          
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
             <ImageIcon className="text-white h-5 w-5" />
          </div>
        </div>
        
        <div className="flex-1 min-w-0 flex flex-col justify-center min-h-[4rem]">
          <p className="font-medium text-sm break-words whitespace-normal leading-tight">{series.seriesDescription || 'No Description'}</p>
          <div className="flex items-center gap-2 mt-1">
             <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                {series.modality}
             </span>
             <p className="text-xs text-muted-foreground">
                Series {series.seriesNumber} • {series.instanceCount} images
             </p>
          </div>
          
          <div className="mt-2 flex items-center gap-2">
             <Button 
               variant="outline" 
               size="sm" 
               className="h-6 text-xs px-2"
               onClick={toggleExpand}
             >
                {isExpanded ? (
                    <>
                       <ChevronDown className="h-3 w-3 mr-1" /> Hide Gallery
                    </>
                ) : (
                    <>
                       <ChevronRight className="h-3 w-3 mr-1" /> View Gallery
                    </>
                )}
             </Button>
             
             {hasPermission('delete') && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10 ml-auto"
                onClick={handleDeleteSeries}
                disabled={isDeletingSeries}
              >
                {isDeletingSeries ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
              </Button>
            )}
          </div>
        </div>
      </div>
      
      {isExpanded && (
        <div className="bg-background/50 border-t border-border/50">
          {isLoadingInstances ? (
            <div className="p-4 flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : instances.length > 0 ? (
            <div 
              ref={scrollContainerRef}
              className="max-h-[320px] overflow-y-auto p-2"
            >
              <div className="grid grid-cols-4 gap-2">
                {instances.map(instance => (
                  <InstanceThumbnail 
                    key={instance.ID} 
                    instance={instance} 
                    studyId={studyId}
                    seriesId={series.id}
                    onViewImage={onViewImage} 
                    onDelete={handleDeleteInstance}
                    scrollContainerRef={scrollContainerRef}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="p-4 text-center text-xs text-muted-foreground">
              No images found in this series.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const DrawerSkeleton = () => (
  <div className="p-4 space-y-6">
    <div className="space-y-2">
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
    </div>
    <div className="space-y-4">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
    </div>
  </div>
);

export const StudyDetailDrawer: React.FC<StudyDetailDrawerProps> = ({
  studyId,
  isOpen,
  onClose,
}) => {
  const { data, isLoading, error, refetch } = useStudyDetail(isOpen ? studyId : null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  const study = data?.study;
  const series = data?.series || [];

  const handleViewImage = async (url: string, info?: any) => {
    setPreviewImageUrl(url);
    
    // If info provided, fetch high resolution image
    if (info) {
       try {
          let highResUrl = '';
          
          if (info.type === 'instance' && info.data) {
             highResUrl = await pacsApi.fetchInstanceImageBlob(
                info.data.instance.ID, 
                info.data.studyId, 
                info.data.seriesId
             );
          } else if (info.type === 'series' && info.data) {
             highResUrl = await pacsApi.fetchSeriesImageBlob(
                info.data.studyId,
                info.data.series.id
             );
          } else if (!info.type && info.instance) {
             // Fallback for any legacy calls (though we updated all)
             highResUrl = await pacsApi.fetchInstanceImageBlob(
                info.instance.ID, 
                info.studyId, 
                info.seriesId
             );
          }

          if (highResUrl) {
             setPreviewImageUrl(highResUrl);
          }
       } catch (e) {
          console.error("Failed to fetch high-res preview", e);
       }
    }
  };

  const parseDicomDate = (dateStr: string) => {
    if (!dateStr) return null;
    if (/^\d{8}$/.test(dateStr)) {
      const year = parseInt(dateStr.substring(0, 4));
      const month = parseInt(dateStr.substring(4, 6)) - 1;
      const day = parseInt(dateStr.substring(6, 8));
      return new Date(year, month, day);
    }
    return parseISO(dateStr);
  };

  const calculateAge = () => {
    if (!study?.patientBirthDate) return null;
    try {
      const dob = parseDicomDate(study.patientBirthDate);
      if (!dob || isNaN(dob.getTime())) return null;
      return differenceInYears(new Date(), dob);
    } catch {
      return null;
    }
  };

  const age = calculateAge();

  const formatPatientBirthDate = () => {
    if (!study?.patientBirthDate) return 'N/A';
    try {
        const dob = parseDicomDate(study.patientBirthDate);
        if (!dob || isNaN(dob.getTime())) return study.patientBirthDate;
        
        const dateStr = format(dob, 'dd/MM/yyyy');
        return `${dateStr}${age !== null ? ` (${age}y)` : ''}`;
    } catch {
        return study.patientBirthDate;
    }
  };

  const formatStudyDateTime = () => {
    if (!study) return '';
    try {
      // Date
      const dateObj = parseDicomDate(study.studyDate);
      const dateStr = dateObj ? format(dateObj, 'dd/MM/yyyy') : study.studyDate;

      // Time
      let timeStr = study.studyTime || '';
      let hours = '00', minutes = '00';

      if (timeStr.includes(':')) {
        [hours, minutes] = timeStr.split(':');
      } else if (/^\d{4}/.test(timeStr)) {
        // HHMM...
        hours = timeStr.substring(0, 2);
        minutes = timeStr.substring(2, 4);
      }

      return `${dateStr} ${hours}:${minutes}`;
    } catch {
      return `${study.studyDate} ${study.studyTime}`;
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 bg-foreground/20 backdrop-blur-sm z-[100] transition-opacity duration-200',
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={cn(
          'fixed top-0 right-0 h-full w-full max-w-lg bg-card border-l border-border shadow-xl z-[101]',
          'transform transition-transform duration-300 ease-out',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border bg-table-header">
            <div>
              <h2 className="text-lg font-semibold">Study Details</h2>
              {isLoading ? (
                <Skeleton className="h-4 w-24 mt-1" />
              ) : (
                <p className="text-sm text-muted-foreground">{study?.accessionNumber}</p>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <DrawerSkeleton />
            ) : error ? (
              <div className="p-6 text-center text-destructive">
                Error loading study details.
              </div>
            ) : study ? (
              <div className="p-4 space-y-6">
                {/* Actions */}
                <div className="flex flex-wrap items-center gap-2">
                  <ViewerButtons 
                    studyId={study.engineId}
                    studyInstanceUid={study.studyInstanceUID}
                    modality={study.modality}
                  />
                  <StudyActions 
                    studyId={study.engineId}
                    currentTags={{
                      patientName: study.patientName,
                      patientId: study.patientId,
                      accessionNumber: study.accessionNumber,
                      patientBirthDate: study.patientBirthDate,
                      patientSex: study.patientSex,
                      institution: study.institution,
                      referringPhysician: study.referringPhysician,
                      studyDate: study.studyDate,
                      studyTime: study.studyTime,
                      studyId: study.dicomStudyId,
                      studyDescription: study.studyDescription,
                    }}
                    onActionComplete={onClose}
                  />
                </div>

                <Separator />

                {/* Patient Info */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <User className="h-4 w-4" /> Patient Information
                  </h3>
                  <div className="grid gap-4 pl-1">
                    <InfoItem
                      icon={<User className="h-4 w-4" />}
                      label="Patient Name"
                      value={study.patientName}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <InfoItem
                        icon={<Hash className="h-4 w-4" />}
                        label="Patient ID"
                        value={study.patientId}
                      />
                      <InfoItem
                        icon={<User className="h-4 w-4" />}
                        label="Sex"
                        value={study.patientSex || 'N/A'}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <InfoItem
                        icon={<Calendar className="h-4 w-4" />}
                        label="DOB / Age"
                        value={formatPatientBirthDate()}
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Study Info */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <FileText className="h-4 w-4" /> Study Information
                  </h3>
                  <div className="grid gap-4 pl-1">
                    <div className="grid grid-cols-2 gap-4">
                      <InfoItem
                        icon={<FileText className="h-4 w-4" />}
                        label="Accession Number"
                        value={study.accessionNumber}
                      />
                      <InfoItem
                        icon={<Hash className="h-4 w-4" />}
                        label="Study ID"
                        value={study.dicomStudyId}
                      />
                    </div>
                    <InfoItem
                      icon={<FileText className="h-4 w-4" />}
                      label="Description"
                      value={study.studyDescription}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <InfoItem
                        icon={<Stethoscope className="h-4 w-4" />}
                        label="Modality"
                        value={study.modality}
                      />
                      <InfoItem
                        icon={<Calendar className="h-4 w-4" />}
                        label="Date & Time"
                        value={formatStudyDateTime()}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <InfoItem
                        icon={<Building className="h-4 w-4" />}
                        label="Institution"
                        value={study.institution || '-'}
                      />
                      <InfoItem
                        icon={<User className="h-4 w-4" />}
                        label="Referring Physician"
                        value={study.referringPhysician || '-'}
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Series List */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Layers className="h-4 w-4" /> Series
                    </h3>
                    <span className="text-xs text-muted-foreground">
                      {series.length} series
                    </span>
                  </div>
                  <div className="grid gap-2">
                    {series.map((item) => (
                      <SeriesRow 
                        key={item.id} 
                        series={item} 
                        studyId={study?.studyInstanceUID || studyId || ''}
                        onSeriesDeleted={() => refetch()} 
                        onViewImage={handleViewImage}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Image Preview Dialog */}
      <Dialog open={!!previewImageUrl} onOpenChange={(open) => !open && setPreviewImageUrl(null)}>
        <DialogContent className="max-w-4xl w-full h-[80vh] p-0 overflow-hidden bg-black/95 border-none flex flex-col" aria-describedby="preview-desc">
           <DialogHeader className="absolute top-2 right-2 z-50">
             <DialogTitle className="sr-only">Image Preview</DialogTitle>
             <DialogDescription id="preview-desc" className="sr-only">Full size preview of the medical image</DialogDescription>
             <DialogClose className="rounded-full bg-white/10 p-2 hover:bg-white/20 text-white transition-colors">
               <X className="h-4 w-4" />
               <span className="sr-only">Close</span>
             </DialogClose>
           </DialogHeader>
           <div className="flex-1 w-full h-full flex items-center justify-center p-4">
             {previewImageUrl && (
               <img 
                 src={previewImageUrl} 
                 alt="Full size preview" 
                 className="max-w-full max-h-full object-contain"
               />
             )}
           </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
