import React from 'react';
import { Eye, ExternalLink, ImageIcon, FileImage } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import viewerConfigList from '@/config/viewers.json';
import { useAuth } from '@/contexts/AuthContext';
import { config } from '@/lib/config';

const IconMap: Record<string, React.ElementType> = {
  Eye,
  ExternalLink,
  ImageIcon,
  FileImage
};

interface ViewerButtonsProps {
  studyId: string; // PACS ID
  studyInstanceUid: string; // DICOM Study Instance UID
  modality?: string; // Modality for filtering viewers
  compact?: boolean;
}

export const ViewerButtons: React.FC<ViewerButtonsProps> = ({
  studyId,
  studyInstanceUid,
  modality,
  compact = false,
}) => {
  const { user } = useAuth();

  const openViewer = (template: string) => {
    // Get credentials
    let authPart = '';
    
    // Try to get from Auth Context first
    if (user && user.token) {
      const username = user.pacs_username || user.username;
      authPart = `${encodeURIComponent(username)}:${encodeURIComponent(user.token)}@`;
    } 
    // Fallback to local storage if needed
    else {
      try {
          const stored = localStorage.getItem('pacs_user');
          if (stored) {
              const storedUser = JSON.parse(stored);
              if (storedUser.username && storedUser.token) {
                  const username = storedUser.pacs_username || storedUser.username;
                  authPart = `${encodeURIComponent(username)}:${encodeURIComponent(storedUser.token)}@`;
              }
          }
      } catch (e) {
          console.error("Failed to get auth for viewer", e);
      }
    }

    // Replace placeholders
    // We also need to inject auth into the URL host part if it's not already there.
    // The template is like http://localhost:8042/...
    // We want http://user:pass@localhost:8042/...
    
    // For localhost:5001 (custom viewer), we usually don't need basic auth in URL 
    // because it handles auth via token in query param or headers, or relies on cookies.
    // However, user specifically asked for http://localhost:5001/viewer?StudyInstanceUIDs
    // If the user's viewer supports basic auth in URL, we can keep it.
    // But usually embedding credentials in URL is for Orthanc/Stone directly.
    // If target is port 5001, let's skip auth injection unless we know it's needed.
    // Actually, user's error log showed: "Connecting to 'http://dzawin:dzawin@localhost:3004/stone-webviewer..."
    // This confirms 3004 (Gateway/Orthanc) needed it.
    // Port 5001 is likely their custom viewer app.
    // Let's NOT inject auth for 5001 to avoid CORS/Mixed Content issues or breaking URL structure,
    // unless the template explicitly asks for it? No, template is simple.
    // Safest bet: Inject auth ONLY if port is 3004 or 8042 (Orthanc ports). 
    
    let url = template
      .replace('{{studyId}}', studyId)
      .replace('{{studyInstanceUid}}', studyInstanceUid);
      
    if (authPart && (url.includes(':3004') || url.includes(':8042'))) {
        // Simple injection after protocol
        // Assumes template starts with http:// or https://
        url = url.replace('://', `://${authPart}`);
    }
    
    // Use a fixed window name 'MINIPACS_VIEWER' to reuse the same tab
    window.open(url, 'MINIPACS_VIEWER');
  };

  // Filter viewers based on modality
  const viewers = viewerConfigList.filter(viewer => {
    // If no modalities defined in config, show for all
    if (!viewer.modalities || viewer.modalities.length === 0) {
      return true;
    }
    // If modality prop is provided, check if it matches
    if (modality) {
      return viewer.modalities.includes(modality);
    }
    // If no modality prop provided (e.g. loading state or unknown), maybe hide restricted ones?
    // Or show all? Let's hide restricted ones to be safe, or maybe show them?
    // User goal implies strict mapping. If we don't know the modality, we probably shouldn't show specific viewers.
    // However, existing usage might not always have modality available immediately? 
    // But our Study object has it.
    return false; 
  });

  if (viewers.length === 0) return null;

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        {viewers.map((viewer) => {
          const IconComponent = IconMap[viewer.icon] || ExternalLink;
          const effectiveTemplate = viewer.id === 'ohif'
            ? `${config.viewerUrl}?StudyInstanceUIDs={{studyInstanceUid}}`
            : viewer.urlTemplate;
          return (
            <Tooltip key={viewer.id}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn("h-8 w-8 p-0", viewer.className)}
                  onClick={(e) => {
                    e.stopPropagation();
                    openViewer(effectiveTemplate);
                  }}
                >
                  <IconComponent className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{viewer.description}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {viewers.map((viewer) => {
        const IconComponent = IconMap[viewer.icon] || ExternalLink;
        const effectiveTemplate = viewer.id === 'ohif'
          ? `${config.viewerUrl}?StudyInstanceUIDs={{studyInstanceUid}}`
          : viewer.urlTemplate;
        return (
          <Button
            key={viewer.id}
            variant="outline"
            className={cn("gap-2", viewer.className)}
            onClick={() => openViewer(effectiveTemplate)}
          >
            <IconComponent className="h-4 w-4" />
            {viewer.label}
          </Button>
        );
      })}
    </div>
  );
};
