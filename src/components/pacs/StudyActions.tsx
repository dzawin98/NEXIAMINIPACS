import React, { useState } from 'react';
import { Trash2, Download, Edit, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { pacsApi } from '@/services/pacsApi';
import { useToast } from '@/components/ui/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';

interface StudyActionsProps {
  studyId: string;
  currentTags: {
    patientName: string;
    patientId: string;
    accessionNumber: string;
    patientBirthDate?: string;
    patientSex?: string;
    institution?: string;
    referringPhysician?: string;
    studyDate?: string;
    studyTime?: string;
    studyId?: string; // DICOM Study ID
    studyDescription?: string;
  };
  onActionComplete: () => void;
}

type ModificationMode = 'modify-new-uids' | 'modify-keep-uids' | 'copy-new-uids';

export const StudyActions: React.FC<StudyActionsProps> = ({
  studyId,
  currentTags,
  onActionComplete,
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isModifyDialogOpen, setIsModifyDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isModifying, setIsModifying] = useState(false);
  // Default to modify-keep-uids for simple modification
  const [modificationMode, setModificationMode] = useState<ModificationMode>('modify-keep-uids');

  // Modify form state
  const [modifyForm, setModifyForm] = useState({
    PatientName: currentTags.patientName,
    PatientID: currentTags.patientId,
    AccessionNumber: currentTags.accessionNumber,
    PatientBirthDate: currentTags.patientBirthDate || '',
    PatientSex: currentTags.patientSex || '',
    ReferringPhysicianName: currentTags.referringPhysician || '',
    StudyDescription: currentTags.studyDescription || '',
  });

  const handleDownload = () => {
    const url = pacsApi.getStudyArchiveUrl(studyId);
    window.open(url, '_blank');
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await pacsApi.deleteStudy(studyId);
      toast({
        title: "Study deleted",
        description: "The study has been successfully deleted.",
      });
      setIsDeleteDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['studies'] });
      onActionComplete();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete study.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleModify = async () => {
    setIsModifying(true);
    try {
      // Build replacement tags
      const changes: Record<string, string> = {};
      
      // Helper to check if value changed or is present
      const addIfChangedOrPresent = (key: string, newValue: string, originalValue?: string) => {
        if (newValue && newValue !== originalValue) {
          changes[key] = newValue;
        } else if (newValue && !originalValue) {
           changes[key] = newValue;
        }
      };

      // We send all non-empty fields to ensure they are set/updated as requested
      // Or should we only send changed ones? 
      // PACS modify endpoint: "Replace" replaces the tag. 
      // If we send the same value, it's fine. 
      // But to be cleaner, let's send only what we want to be in the final DICOM.
      // If user clears a field, we might want to send empty string? 
      // PACS might reject empty string for some tags.
      // Let's iterate and send all current form values if they are different from original or just send all to be safe?
      // Sending all non-empty values from form is safer to ensure state matches form.
      
      const fields = [
        { key: 'PatientName', val: modifyForm.PatientName, orig: currentTags.patientName },
        { key: 'PatientID', val: modifyForm.PatientID, orig: currentTags.patientId },
        { key: 'AccessionNumber', val: modifyForm.AccessionNumber, orig: currentTags.accessionNumber },
        { key: 'PatientBirthDate', val: modifyForm.PatientBirthDate, orig: currentTags.patientBirthDate },
        { key: 'PatientSex', val: modifyForm.PatientSex, orig: currentTags.patientSex },
        { key: 'ReferringPhysicianName', val: modifyForm.ReferringPhysicianName, orig: currentTags.referringPhysician },
        { key: 'StudyDescription', val: modifyForm.StudyDescription, orig: currentTags.studyDescription },
      ];

      fields.forEach(f => {
        if (f.val !== f.orig) {
           changes[f.key] = f.val;
        }
      });

      // If no changes and mode is "Modify original (keep UIDs)", it's a no-op?
      // But maybe user wants to trigger a process.
      // However, if we change mode to "Copy", we definitely need to call API even if no tags change.
      
      // Determine API flags based on mode
      let keepSource = false;
      let keepStudyInstanceUID = false;

      switch (modificationMode) {
        case 'modify-new-uids':
          keepSource = false;
          keepStudyInstanceUID = false;
          break;
        case 'modify-keep-uids':
          keepSource = false;
          keepStudyInstanceUID = true;
          break;
        case 'copy-new-uids':
          keepSource = true;
          keepStudyInstanceUID = false;
          break;
      }

      await pacsApi.modifyStudy(studyId, changes, keepSource, keepStudyInstanceUID);
      
      const actionDescription = modificationMode === 'copy-new-uids' 
        ? "A new modified copy has been created." 
        : "The study has been updated.";

      toast({
        title: "Success",
        description: actionDescription,
      });
      
      setIsModifyDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['studies'] });
      onActionComplete();
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to modify study. Check console for details.",
        variant: "destructive",
      });
    } finally {
      setIsModifying(false);
    }
  };

  const updateForm = (key: string, value: string) => {
    setModifyForm(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={handleDownload}
          >
            <Download className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Download ZIP</p>
        </TooltipContent>
      </Tooltip>

      {hasPermission('modify') && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                // Reset form to current values when opening
                setModifyForm({
                  PatientName: currentTags.patientName,
                  PatientID: currentTags.patientId,
                  AccessionNumber: currentTags.accessionNumber,
                  PatientBirthDate: currentTags.patientBirthDate || '',
                  PatientSex: currentTags.patientSex || '',
                  ReferringPhysicianName: currentTags.referringPhysician || '',
                  StudyDescription: currentTags.studyDescription || '',
                });
                setModificationMode('modify-keep-uids');
                setIsModifyDialogOpen(true);
              }}
            >
              <Edit className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Modify</p>
          </TooltipContent>
        </Tooltip>
      )}

      {hasPermission('delete') && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="destructive"
              size="icon"
              className="h-8 w-8"
              onClick={() => setIsDeleteDialogOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Delete</p>
          </TooltipContent>
        </Tooltip>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete Study?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the study 
              and all its associated series and instances from the PACS server.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
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

      {/* Modify Dialog */}
      <Dialog open={isModifyDialogOpen} onOpenChange={setIsModifyDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Modify Study</DialogTitle>
            <DialogDescription>
              Update DICOM tags and choose modification mode.
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="flex-1 pr-4">
            <div className="py-4 space-y-6">
              {/* Patient Information Group */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold flex items-center gap-2 border-b pb-2">
                   Patient Information
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                     <Label htmlFor="pname">Patient Name</Label>
                     <Input id="pname" value={modifyForm.PatientName} onChange={e => updateForm('PatientName', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                     <Label htmlFor="pid">Patient ID</Label>
                     <Input id="pid" value={modifyForm.PatientID} onChange={e => updateForm('PatientID', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                     <Label htmlFor="dob">Patient Birth Date (YYYYMMDD)</Label>
                     <Input id="dob" value={modifyForm.PatientBirthDate} onChange={e => updateForm('PatientBirthDate', e.target.value)} placeholder="YYYYMMDD" />
                  </div>
                  <div className="space-y-2">
                     <Label htmlFor="sex">Patient Sex</Label>
                     <Input id="sex" value={modifyForm.PatientSex} onChange={e => updateForm('PatientSex', e.target.value)} placeholder="M/F/O" />
                  </div>
                </div>
              </div>

              {/* Study Information Group */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold flex items-center gap-2 border-b pb-2">
                   Study Information
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                     <Label htmlFor="acc">Accession Number</Label>
                     <Input id="acc" value={modifyForm.AccessionNumber} onChange={e => updateForm('AccessionNumber', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                     <Label htmlFor="ref">Referring Physician</Label>
                     <Input id="ref" value={modifyForm.ReferringPhysicianName} onChange={e => updateForm('ReferringPhysicianName', e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                     <Label htmlFor="desc">Study Description</Label>
                     <Input id="desc" value={modifyForm.StudyDescription} onChange={e => updateForm('StudyDescription', e.target.value)} />
                </div>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsModifyDialogOpen(false)} disabled={isModifying}>
              Cancel
            </Button>
            <Button onClick={handleModify} disabled={isModifying}>
              {isModifying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                'Apply Changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
