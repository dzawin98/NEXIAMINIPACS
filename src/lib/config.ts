// PACS Configuration
// These can be overridden with environment variables

export const config = {
  // API Base URL - Pointing to DICOMweb (Backend Proxy)
  // In development: Use the Vite proxy '/pacs' which forwards to 'http://localhost:3000/api/dicom'
  // In production: Set VITE_API_BASE_URL to the absolute URL if needed
  // Note: Orthanc DICOMweb root is usually without '/rs' suffix if using the standard plugin path, 
  // but if we want strictly QIDO-RS, we usually append nothing as the proxy handles it.
  // However, most DICOMweb clients expect the root.
  // Our proxy maps /api/dicom -> /dicom-web
  // So /pacs (frontend) -> /api/dicom (backend) -> /dicom-web (orthanc)
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '/pacs',
  
  // OHIF Viewer URL
  viewerUrl: import.meta.env.VITE_VIEWER_URL || import.meta.env.VITE_OHIF_VIEWER_URL || 'http://localhost:5001/viewer',
  
  // Application Settings
  app: {
    name: import.meta.env.VITE_APP_NAME || 'PACS Worklist',
    institution: import.meta.env.VITE_INSTITUTION_NAME || 'Medical Center',
    pageSize: 25,
  },
};

// Build viewer URL with study ID
export const getViewerUrl = (viewerType: 'ohif', studyId: string): string => {
  switch (viewerType) {
    case 'ohif':
      return `${config.viewerUrl}?StudyInstanceUIDs=${studyId}`;
    default:
      return '#';
  }
};
