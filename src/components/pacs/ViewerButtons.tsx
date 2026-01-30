import React from 'react';
import { ExternalLink, Eye, Layers } from 'lucide-react';
import { getViewerUrl } from '@/lib/config';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ViewerButtonsProps {
  studyInstanceUID: string;
  orthancId: string;
  compact?: boolean;
}

export const ViewerButtons: React.FC<ViewerButtonsProps> = ({
  studyInstanceUID,
  orthancId,
  compact = false,
}) => {
  const openViewer = (type: 'ohif' | 'stone' | 'basic') => {
    const url = getViewerUrl(type, type === 'basic' ? orthancId : studyInstanceUID);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-primary hover:bg-primary/10"
              onClick={(e) => {
                e.stopPropagation();
                openViewer('ohif');
              }}
            >
              <Eye className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Open in OHIF Viewer</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-secondary hover:bg-secondary/10"
              onClick={(e) => {
                e.stopPropagation();
                openViewer('stone');
              }}
            >
              <Layers className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Open in Stone Viewer</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-muted-foreground hover:bg-muted"
              onClick={(e) => {
                e.stopPropagation();
                openViewer('basic');
              }}
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Open in Orthanc Explorer</TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        className="viewer-btn viewer-btn-ohif"
        onClick={() => openViewer('ohif')}
      >
        <Eye className="h-4 w-4" />
        OHIF Viewer
      </button>

      <button
        className="viewer-btn viewer-btn-stone"
        onClick={() => openViewer('stone')}
      >
        <Layers className="h-4 w-4" />
        Stone Viewer
      </button>

      <button
        className="viewer-btn viewer-btn-basic"
        onClick={() => openViewer('basic')}
      >
        <ExternalLink className="h-4 w-4" />
        Orthanc Explorer
      </button>
    </div>
  );
};
