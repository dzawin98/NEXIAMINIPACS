import React from 'react';
import { X, User, FileText, Building, Stethoscope, Calendar, Clock, Hash, Layers } from 'lucide-react';
import { Study, Series, getMockSeriesForStudy } from '@/lib/mockData';
import { StatusBadge } from './StatusBadge';
import { ViewerButtons } from './ViewerButtons';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { format, parseISO, differenceInYears } from 'date-fns';
import { cn } from '@/lib/utils';

interface StudyDetailDrawerProps {
  study: Study | null;
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

const SeriesRow: React.FC<{ series: Series }> = ({ series }) => (
  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
      <span className="text-xs font-semibold text-accent-foreground">{series.modality}</span>
    </div>
    <div className="flex-1 min-w-0">
      <p className="font-medium text-sm truncate">{series.seriesDescription || 'No Description'}</p>
      <p className="text-xs text-muted-foreground">
        Series {series.seriesNumber} • {series.instanceCount} images
      </p>
    </div>
  </div>
);

export const StudyDetailDrawer: React.FC<StudyDetailDrawerProps> = ({
  study,
  isOpen,
  onClose,
}) => {
  if (!study) return null;

  const series = getMockSeriesForStudy(study.id);

  const calculateAge = () => {
    if (!study.patientBirthDate) return null;
    try {
      return differenceInYears(new Date(), parseISO(study.patientBirthDate));
    } catch {
      return null;
    }
  };

  const age = calculateAge();

  const formatStudyDateTime = () => {
    try {
      const date = format(parseISO(study.studyDate), 'MMMM d, yyyy');
      const [hours, minutes] = study.studyTime.split(':');
      return `${date} at ${hours}:${minutes}`;
    } catch {
      return `${study.studyDate} ${study.studyTime}`;
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 bg-foreground/20 backdrop-blur-sm z-40 transition-opacity duration-200',
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={cn(
          'fixed top-0 right-0 h-full w-full max-w-lg bg-card border-l border-border shadow-xl z-50',
          'transform transition-transform duration-300 ease-out',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border bg-table-header">
            <div>
              <h2 className="text-lg font-semibold">Study Details</h2>
              <p className="text-sm text-muted-foreground">{study.accessionNumber}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* Patient Info */}
            <section>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Patient Information
              </h3>
              <div className="space-y-4">
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
                    label="Sex / Age"
                    value={`${study.patientSex || 'Unknown'} ${age ? `/ ${age} years` : ''}`}
                  />
                </div>
              </div>
            </section>

            <Separator />

            {/* Study Info */}
            <section>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Study Information
              </h3>
              <div className="space-y-4">
                <InfoItem
                  icon={<FileText className="h-4 w-4" />}
                  label="Description"
                  value={study.studyDescription}
                />
                <div className="grid grid-cols-2 gap-4">
                  <InfoItem
                    icon={<Calendar className="h-4 w-4" />}
                    label="Date & Time"
                    value={formatStudyDateTime()}
                  />
                  <InfoItem
                    icon={<Layers className="h-4 w-4" />}
                    label="Modality"
                    value={
                      <span className="inline-flex items-center justify-center px-2 py-1 rounded bg-accent text-accent-foreground text-xs font-semibold">
                        {study.modality}
                      </span>
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <InfoItem
                    icon={<Building className="h-4 w-4" />}
                    label="Institution"
                    value={study.institution}
                  />
                  <InfoItem
                    icon={<Stethoscope className="h-4 w-4" />}
                    label="Referring Physician"
                    value={study.referringPhysician}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-muted-foreground">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Status</p>
                    <div className="mt-1">
                      <StatusBadge status={study.status} />
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <Separator />

            {/* Series List */}
            <section>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Series ({series.length})
              </h3>
              <div className="space-y-2">
                {series.map((s) => (
                  <SeriesRow key={s.id} series={s} />
                ))}
              </div>
            </section>
          </div>

          {/* Footer with Viewer Buttons */}
          <div className="p-4 border-t border-border bg-table-header">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3">
              Open Study In
            </p>
            <ViewerButtons
              studyInstanceUID={study.studyInstanceUID}
              orthancId={study.orthancId}
            />
          </div>
        </div>
      </div>
    </>
  );
};
