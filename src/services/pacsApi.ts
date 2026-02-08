import { config } from '@/lib/config';

const API_BASE_URL = config.apiBaseUrl;

// Types matching API responses
export interface PacsStudy {
  ID: string;
  IsStable: boolean;
  LastUpdate: string;
  MainDicomTags: {
    AccessionNumber?: string;
    InstitutionName?: string;
    ReferringPhysicianName?: string;
    StudyDate?: string;
    StudyDescription?: string;
    StudyID?: string;
    StudyTime?: string;
    PatientName?: string;
    PatientID?: string;
    Modality?: string;
    StudyInstanceUID?: string;
  };
  PatientMainDicomTags?: {
    PatientName?: string;
    PatientID?: string;
    PatientBirthDate?: string;
    PatientSex?: string;
  };
  ParentPatient: string;
  Series: string[];
  Type: 'Study';
}

export interface PacsSeries {
  ID: string;
  IsStable: boolean;
  LastUpdate: string;
  MainDicomTags: {
    Modality?: string;
    SeriesDate?: string;
    SeriesDescription?: string;
    SeriesNumber?: string;
    StationName?: string;
    BodyPartExamined?: string;
    SeriesInstanceUID?: string;
    NumberOfSeriesRelatedInstances?: string;
  };
  ParentStudy: string;
  Instances: string[];
  Type: 'Series';
}

// Helper to extract value from DICOM JSON format
// e.g. { "00100010": { "vr": "PN", "Value": ["Doe^John"] } } -> "Doe^John"
const getValue = (obj: any, tag: string) => {
    if (!obj || !obj[tag] || !obj[tag].Value || !obj[tag].Value.length) return undefined;
    const val = obj[tag].Value[0];
    if (typeof val === 'object' && val.Alphabetic) return val.Alphabetic; // Handle Person Name objects
    return val;
};

// Helper to format Person Name
const formatPN = (pn: string) => {
    if (!pn) return '';
    return pn.replace(/\^/g, ' ').trim();
};

// Helper to format DICOM Time (TM)
// Supports HHMMSS.frac or HHMMSS
const formatDicomTime = (time: string) => {
    if (!time) return '';
    // Remove fractional seconds for display
    const cleanTime = time.split('.')[0];
    if (cleanTime.length >= 6) {
        return `${cleanTime.slice(0, 2)}:${cleanTime.slice(2, 4)}:${cleanTime.slice(4, 6)}`;
    }
    return time;
};

const getHeaders = () => {
  const stored = localStorage.getItem('pacs_user');
  if (!stored) return {};
  
  try {
    const user = JSON.parse(stored);
    const username = user.pacs_username || user.username;
    if (username && user.token) {
      return {
        'Authorization': 'Basic ' + btoa(username + ':' + user.token)
      };
    }
  } catch (e) {
    console.error('Error parsing user for auth headers', e);
  }
  return {};
};

// Simple Task Queue for Concurrency Limiting
class TaskQueue {
  private queue: (() => Promise<void>)[] = [];
  private active = 0;
  private concurrency: number;

  constructor(concurrency: number) {
    this.concurrency = concurrency;
  }

  add<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await task();
          resolve(result);
        } catch (e) {
          reject(e);
        }
      });
      this.process();
    });
  }

  private async process() {
    if (this.active >= this.concurrency || this.queue.length === 0) return;

    this.active++;
    const task = this.queue.shift();
    if (task) {
      try {
        await task();
      } finally {
        this.active--;
        this.process();
      }
    }
  }
}

// Limit image requests to 3 concurrent connections to prevent server overload
const imageQueue = new TaskQueue(3);

export const pacsApi = {
  // Get all studies (optimized for QIDO-RS)
  // Returns raw QIDO-RS JSON array
  getAllStudiesRaw: async (): Promise<any[]> => {
    try {
      // Use relative path to leverage Vite proxy
      // The API_BASE_URL should already include '/pacs' which maps to backend '/api/dicom' which maps to Orthanc '/dicom-web'
      // Orthanc QIDO-RS for studies is at {root}/studies
      const url = `${API_BASE_URL}/studies?includefield=00081030&includefield=00080080&includefield=00080090`;
      console.log('Fetching studies from:', url);
      const response = await fetch(url, { headers: getHeaders() });
      if (!response.ok) {
        console.error('Fetch error:', response.status, response.statusText);
        throw new Error('Failed to fetch studies list');
      }
      const data = await response.json();
      console.log('Raw studies data:', data);
      return data;
    } catch (e) {
      console.error('getAllStudiesRaw failed:', e);
      return [];
    }
  },
  
  // Get all studies mapped to domain model
  getAllStudies: async (): Promise<any[]> => {
      const rawData = await pacsApi.getAllStudiesRaw();
      if (!Array.isArray(rawData)) {
        console.error('Raw data is not an array:', rawData);
        return [];
      }
      
      return rawData.map((item, index) => {
          const studyUid = getValue(item, '0020000D') || `unknown-uid-${index}`;
          const seriesCount = parseInt(getValue(item, '00201206') || '0');
          const instanceCount = parseInt(getValue(item, '00201208') || '0');
          
          return {
              id: studyUid,
              engineId: studyUid,
              patientName: formatPN(getValue(item, '00100010')),
              patientId: getValue(item, '00100020') || 'UNKNOWN',
              accessionNumber: getValue(item, '00080050') || '',
              modality: getValue(item, '00080061') || 'OT',
              studyDescription: getValue(item, '00081030') || '',
              studyDate: getValue(item, '00080020') || '',
              studyTime: formatDicomTime(getValue(item, '00080030')),
              seriesCount: seriesCount,
              instanceCount: instanceCount,
              institution: getValue(item, '00080080') || '',
              referringPhysician: formatPN(getValue(item, '00080090')),
              status: 'completed',
              patientBirthDate: getValue(item, '00100030') || '',
              patientSex: getValue(item, '00100040') || '',
              studyInstanceUID: studyUid,
              dicomStudyId: getValue(item, '00200010') || ''
          };
      });
  },

  // Get details for a single study
  getStudy: async (id: string): Promise<PacsStudy> => {
    // Explicitly request StudyDescription (00081030), InstitutionName (00080080), ReferringPhysicianName (00080090)
    const response = await fetch(`${API_BASE_URL}/studies?StudyInstanceUID=${id}&includefield=00081030&includefield=00080080&includefield=00080090`, { headers: getHeaders() });
    if (!response.ok) throw new Error(`Failed to fetch study ${id}`);
    const data = await response.json();
    if (!data || data.length === 0) throw new Error('Study not found');
    
    const item = data[0];
    const studyUid = getValue(item, '0020000D');
    
    return {
        ID: studyUid,
        IsStable: true,
        LastUpdate: getValue(item, '00080020') || '',
        Type: 'Study',
        ParentPatient: getValue(item, '00100020') || '',
        Series: [], 
        MainDicomTags: {
            StudyInstanceUID: studyUid,
            PatientName: formatPN(getValue(item, '00100010')),
            PatientID: getValue(item, '00100020'),
            AccessionNumber: getValue(item, '00080050'),
            InstitutionName: getValue(item, '00080080'),
            ReferringPhysicianName: formatPN(getValue(item, '00080090')),
            StudyDate: getValue(item, '00080020'),
            StudyTime: getValue(item, '00080030'),
            StudyDescription: getValue(item, '00081030'),
            StudyID: getValue(item, '00200010'),
            Modality: getValue(item, '00080061') 
        },
        PatientMainDicomTags: {
            PatientName: formatPN(getValue(item, '00100010')),
            PatientID: getValue(item, '00100020'),
            PatientBirthDate: getValue(item, '00100030'),
            PatientSex: getValue(item, '00100040')
        }
    };
  },

  // Get statistics for a study
  getStudyStatistics: async (id: string): Promise<{ CountInstances: number; CountSeries: number; DiskSize: string; DiskSizeMB: number }> => {
    const response = await fetch(`${API_BASE_URL}/studies?StudyInstanceUID=${id}`, { headers: getHeaders() });
    if (!response.ok) throw new Error('Failed to fetch stats');
    const data = await response.json();
    if (!data || !data.length) return { CountInstances: 0, CountSeries: 0, DiskSize: '0 MB', DiskSizeMB: 0 };
    
    const item = data[0];
    const instances = parseInt(getValue(item, '00201208') || '0');
    const series = parseInt(getValue(item, '00201206') || '0');
    
    return {
        CountInstances: instances,
        CountSeries: series,
        DiskSize: 'Unknown',
        DiskSizeMB: 0
    };
  },

  // Get all series for a study
  getStudySeries: async (studyId: string): Promise<PacsSeries[]> => {
    // Explicitly request SeriesDescription (0008103E)
    const response = await fetch(`${API_BASE_URL}/studies/${studyId}/series?includefield=00201209&includefield=0008103E`, { headers: getHeaders() });
    if (!response.ok) throw new Error(`Failed to fetch series for study ${studyId}`);
    const data = await response.json();
    
    return data.map((item: any) => ({
        ID: getValue(item, '0020000E'),
        IsStable: true,
        LastUpdate: getValue(item, '00080021') || '',
        Type: 'Series',
        ParentStudy: studyId,
        Instances: [],
        MainDicomTags: {
            SeriesInstanceUID: getValue(item, '0020000E'),
            Modality: getValue(item, '00080060'),
            SeriesDescription: getValue(item, '0008103E'),
            SeriesNumber: getValue(item, '00200011'),
            SeriesDate: getValue(item, '00080021'),
            StationName: getValue(item, '00081010'),
            BodyPartExamined: getValue(item, '00180015'),
            NumberOfSeriesRelatedInstances: getValue(item, '00201209')
        }
    }));
  },
  
  // Get details for a single series
  getSeries: async (id: string): Promise<PacsSeries> => {
      const response = await fetch(`${API_BASE_URL}/series?SeriesInstanceUID=${id}`, { headers: getHeaders() });
      if (!response.ok) throw new Error(`Failed to fetch series ${id}`);
      const data = await response.json();
      if (!data || !data.length) throw new Error('Series not found');
      
      const item = data[0];
      return {
        ID: getValue(item, '0020000E'),
        IsStable: true,
        LastUpdate: '',
        Type: 'Series',
        ParentStudy: getValue(item, '0020000D'),
        Instances: [],
        MainDicomTags: {
            SeriesInstanceUID: getValue(item, '0020000E'),
            Modality: getValue(item, '00080060'),
            SeriesDescription: getValue(item, '0008103E'),
            SeriesNumber: getValue(item, '00200011'),
            NumberOfSeriesRelatedInstances: getValue(item, '00201209')
        }
      };
  },

  deleteStudy: async (id: string): Promise<void> => {
      const url = `${API_BASE_URL}/studies/${id}`;
      const response = await fetch(url, { method: 'DELETE', headers: getHeaders() });
      if (!response.ok) throw new Error('Failed to delete study');
  },

  deleteSeries: async (id: string, studyId?: string): Promise<void> => {
      let url = `${API_BASE_URL}/studies/${studyId}/series/${id}`;
      if (!studyId) {
          // Fallback if studyId is missing (might fail if backend requires it)
           console.warn('Deleting series without studyId might fail');
           // Try to lookup studyId? Or just fail?
           // For now, let's assume UI always passes studyId.
           // If not, we could search for it.
           throw new Error('Study ID required for deletion');
      }
      const response = await fetch(url, { method: 'DELETE', headers: getHeaders() });
      if (!response.ok) throw new Error('Failed to delete series');
  },

  deleteInstance: async (id: string, studyId?: string, seriesId?: string): Promise<void> => {
      if (!studyId || !seriesId) {
           throw new Error('Study ID and Series ID required for deletion');
      }
      const url = `${API_BASE_URL}/studies/${studyId}/series/${seriesId}/instances/${id}`;
      const response = await fetch(url, { method: 'DELETE', headers: getHeaders() });
      if (!response.ok) throw new Error('Failed to delete instance');
  },

  getSeriesInstances: async (seriesId: string, studyId?: string): Promise<any[]> => {
    let url = `${API_BASE_URL}/instances?SeriesInstanceUID=${seriesId}`;
    
    // If studyId is provided, use the hierarchical endpoint to ensure context locking
    if (studyId) {
        url = `${API_BASE_URL}/studies/${studyId}/series/${seriesId}/instances`;
    }
    
    const response = await fetch(url, { headers: getHeaders() });
    if (!response.ok) throw new Error('Failed to fetch instances');
    const data = await response.json();
    
    return data.map((item: any) => ({
        ID: getValue(item, '00080018'), // SOPInstanceUID
        MainDicomTags: {
            SOPInstanceUID: getValue(item, '00080018'),
            InstanceNumber: getValue(item, '00200013')
        },
        ParentSeries: seriesId
    }));
  },

  getInstancePreviewUrl: (id: string): string => {
    console.warn('Cannot generate preview URL with ID only for Conquest');
    return ''; 
  },
  
  fetchInstancePreviewBlob: async (id: string, studyId?: string, seriesId?: string): Promise<string> => {
    try {
        let st = studyId;
        let se = seriesId;
        let sop = id;

        // If we don't have study/series UIDs, we must look them up
        if (!st || !se) {
            const search = await fetch(`${API_BASE_URL}/instances?SOPInstanceUID=${id}`, { headers: getHeaders() });
            const data = await search.json();
            if (data && data.length > 0) {
                const item = data[0];
                st = getValue(item, '0020000D');
                se = getValue(item, '0020000E');
                sop = getValue(item, '00080018'); // Ensure we use the one from response? Should match id.
            } else {
                return '';
            }
        }

        if (st && se && sop) {
            // Wrap the fetch in the queue
            return imageQueue.add(async () => {
                const response = await fetch(`${API_BASE_URL}/studies/${st}/series/${se}/instances/${sop}/thumbnail`, { headers: getHeaders() });
                if (response.ok) {
                    const blob = await response.blob();
                    return URL.createObjectURL(blob);
                }
                return '';
            });
        }
    } catch (e) {
        console.error('Error fetching preview', e);
    }
    return '';
  },

  fetchInstanceImageBlob: async (id: string, studyId?: string, seriesId?: string): Promise<string> => {
    try {
        let st = studyId;
        let se = seriesId;
        let sop = id;

        if (!st || !se) {
             // Basic lookup if needed, but UI usually provides these
             return pacsApi.fetchInstancePreviewBlob(id, studyId, seriesId); 
        }

        if (st && se && sop) {
            return imageQueue.add(async () => {
                // Request larger size for preview (e.g. 1024px)
                const response = await fetch(`${API_BASE_URL}/studies/${st}/series/${se}/instances/${sop}/thumbnail?viewport=1024`, { headers: getHeaders() });
                if (response.ok) {
                    const blob = await response.blob();
                    return URL.createObjectURL(blob);
                }
                return '';
            });
        }
    } catch (e) {
        console.error('Error fetching full image', e);
    }
    return '';
  },

  fetchSeriesPreviewBlob: async (studyId: string, seriesId: string): Promise<string> => {
    try {
        return imageQueue.add(async () => {
            // Use the series thumbnail endpoint which gets a representative image (usually the middle one)
            const response = await fetch(`${API_BASE_URL}/studies/${studyId}/series/${seriesId}/thumbnail`, { headers: getHeaders() });
            if (response.ok) {
                const blob = await response.blob();
                return URL.createObjectURL(blob);
            }
            return '';
        });
    } catch (e) {
        console.error('Error fetching series preview', e);
    }
    return '';
  },

  fetchSeriesImageBlob: async (studyId: string, seriesId: string): Promise<string> => {
    try {
        return imageQueue.add(async () => {
            // Request larger size for preview (e.g. 1024px)
            const response = await fetch(`${API_BASE_URL}/studies/${studyId}/series/${seriesId}/thumbnail?viewport=1024`, { headers: getHeaders() });
            if (response.ok) {
                const blob = await response.blob();
                return URL.createObjectURL(blob);
            }
            return '';
        });
    } catch (e) {
        console.error('Error fetching series full image', e);
    }
    return '';
  },

  getStudyArchiveUrl: (id: string): string => {
     return `${API_BASE_URL}/studies/${id}/archive`;
  },

  modifyStudy: async (id: string, changes: Record<string, string>, keepSource: boolean, keepStudyInstanceUID: boolean): Promise<void> => {
    const url = `${API_BASE_URL}/studies/${id}/modify`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...getHeaders()
        },
        body: JSON.stringify({
            changes,
            keepSource,
            keepStudyInstanceUID
        })
    });
    
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to modify study: ${errorText}`);
    }
  }
};

// Mappers for compatibility with UI components
export const mapPacsStudyToStudy = (
  pacsStudy: PacsStudy,
  seriesCount: number = 0,
  instanceCount: number = 0,
  modality: string = ''
): any => {
  return {
    id: pacsStudy.ID,
    engineId: pacsStudy.ID,
    patientName: pacsStudy.PatientMainDicomTags?.PatientName || pacsStudy.MainDicomTags.PatientName || 'Unknown',
    patientId: pacsStudy.PatientMainDicomTags?.PatientID || pacsStudy.MainDicomTags.PatientID || 'Unknown',
    accessionNumber: pacsStudy.MainDicomTags.AccessionNumber || '',
    modality: modality || pacsStudy.MainDicomTags.Modality || 'OT',
    studyDescription: pacsStudy.MainDicomTags.StudyDescription || '',
    studyDate: pacsStudy.MainDicomTags.StudyDate || '',
    studyTime: pacsStudy.MainDicomTags.StudyTime || '',
    seriesCount: seriesCount,
    instanceCount: instanceCount,
    institution: pacsStudy.MainDicomTags.InstitutionName || '',
    referringPhysician: pacsStudy.MainDicomTags.ReferringPhysicianName || '',
    status: 'completed',
    patientBirthDate: pacsStudy.PatientMainDicomTags?.PatientBirthDate || '',
    patientSex: pacsStudy.PatientMainDicomTags?.PatientSex || '',
    studyInstanceUID: pacsStudy.MainDicomTags.StudyInstanceUID || pacsStudy.ID,
    dicomStudyId: pacsStudy.MainDicomTags.StudyID || ''
  };
};

export const mapPacsSeriesToSeries = (pacsSeries: PacsSeries): any => {
  const instanceCount = pacsSeries.Instances && pacsSeries.Instances.length > 0 
    ? pacsSeries.Instances.length 
    : parseInt(pacsSeries.MainDicomTags.NumberOfSeriesRelatedInstances || '0');

  return {
    id: pacsSeries.ID,
    seriesDescription: pacsSeries.MainDicomTags.SeriesDescription || '',
    modality: pacsSeries.MainDicomTags.Modality || '',
    seriesNumber: parseInt(pacsSeries.MainDicomTags.SeriesNumber || '0'),
    instanceCount: instanceCount,
    bodyPart: pacsSeries.MainDicomTags.BodyPartExamined || '',
    seriesInstanceUID: pacsSeries.MainDicomTags.SeriesInstanceUID || pacsSeries.ID
  };
};
