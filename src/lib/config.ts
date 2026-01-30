// PACS Configuration
// These can be overridden with environment variables

export const config = {
  // Orthanc API Base URL
  orthancBaseUrl: import.meta.env.VITE_ORTHANC_BASE_URL || 'http://localhost:8042',
  
  // Viewer URLs
  viewers: {
    ohif: import.meta.env.VITE_OHIF_VIEWER_URL || 'http://localhost:3000/viewer',
    stone: import.meta.env.VITE_STONE_VIEWER_URL || 'http://localhost:8042/stone-webviewer/index.html',
    basic: import.meta.env.VITE_BASIC_VIEWER_URL || 'http://localhost:8042/app/explorer.html',
  },
  
  // Application Settings
  app: {
    name: import.meta.env.VITE_APP_NAME || 'PACS Worklist',
    institution: import.meta.env.VITE_INSTITUTION_NAME || 'Medical Center',
    pageSize: 25,
  },
};

// Build viewer URL with study ID
export const getViewerUrl = (viewerType: 'ohif' | 'stone' | 'basic', studyId: string): string => {
  switch (viewerType) {
    case 'ohif':
      return `${config.viewers.ohif}?StudyInstanceUIDs=${studyId}`;
    case 'stone':
      return `${config.viewers.stone}?study=${studyId}`;
    case 'basic':
      return `${config.viewers.basic}#study?uuid=${studyId}`;
    default:
      return '#';
  }
};
