import express from 'express';
import axios from 'axios';
import checkDiskSpace from 'check-disk-space';
import path from 'path';

const router = express.Router();

// Use direct Orthanc URL from env, similar to index.js
const ORTHANC_URL = process.env.ORTHANC_URL || 'http://localhost:8042';

// Default storage path, can be configured via env
const STORAGE_PATH = process.env.PACS_STORAGE_PATH || 'C:\\PACS_Storage';

router.get('/', async (req, res) => {
  const { startDate, endDate } = req.query;

  // Initialize default response structure
  let stats = {
    totalPatients: 0,
    totalStudies: 0,
    modalities: {},
    storage: {
      path: STORAGE_PATH,
      free: 0,
      size: 0
    },
    errors: []
  };

  try {
    // 1. Fetch all studies from PACS
    try {
        const username = process.env.PACS_USERNAME;
        const password = process.env.PACS_PASSWORD;
        const axiosConfig = { timeout: 5000 };
        if (username && password) {
          axiosConfig.auth = { username, password };
        }
        // Use Native API directly
        const studiesResponse = await axios.get(`${ORTHANC_URL}/studies?expand`, axiosConfig);
        let studies = studiesResponse.data;

        // Filter studies by date if provided
        if (startDate && endDate) {
            const start = parseInt(startDate);
            const end = parseInt(endDate);
            studies = studies.filter(study => {
                const studyDateStr = study.MainDicomTags?.StudyDate;
                if (!studyDateStr) return false;
                const studyDate = parseInt(studyDateStr);
                return studyDate >= start && studyDate <= end;
            });
        }

        // Calculate Stats
        stats.totalStudies = studies.length;
        const patientIds = new Set();
        const modalityCounts = {};
        
        for (const study of studies) {
            // Count unique patients
            if (study.PatientMainDicomTags && study.PatientMainDicomTags.PatientID) {
                patientIds.add(study.PatientMainDicomTags.PatientID);
            }

        }

        // Count modalities based on Series-level Modality code (0008,0060)
        try {
          const findBody = {
            Level: 'Series',
            Query: {},
            Expand: true
          };
          
          if (startDate && endDate) {
             findBody.Query.StudyDate = `${startDate}-${endDate}`;
          }

          const seriesResp = await axios.post(`${ORTHANC_URL}/tools/find`, findBody, axiosConfig);
          const seriesList = seriesResp.data || [];
          for (const s of seriesList) {
            const m =
              (s.MainDicomTags && s.MainDicomTags.Modality) ||
              (s['0008,0060'] && s['0008,0060'].Value && s['0008,0060'].Value[0]) ||
              s.Modality;
            if (m && typeof m === 'string') {
              const key = m.trim().toUpperCase();
              if (key) {
                modalityCounts[key] = (modalityCounts[key] || 0) + 1;
              }
            }
          }
        } catch (findErr) {
          console.error('PACS Series Find Error:', findErr.message);
          stats.errors.push(`Failed to aggregate modalities via Series-level search: ${findErr.message}`);
        }

        stats.totalPatients = patientIds.size;
        stats.modalities = modalityCounts;

    } catch (pacsError) {
        console.error('PACS Error:', pacsError.message);
        if (pacsError?.response?.status === 401) {
          stats.errors.push('PACS authentication required (401). Set PACS_USERNAME and PACS_PASSWORD');
        } else {
          stats.errors.push(`PACS Connection Error: ${pacsError.code || pacsError.message}`);
        }
    }

    // 2. Check Disk Space
    try {
        const normalizedPath = path.normalize(STORAGE_PATH);
        const diskSpace = await checkDiskSpace(normalizedPath);
        stats.storage.free = diskSpace.free;
        stats.storage.size = diskSpace.size;
    } catch (diskError) {
        console.error('Disk Space Error:', diskError.message);
        // Try falling back to C: root if specific path fails
        try {
            const rootPath = 'C:\\';
            const diskSpace = await checkDiskSpace(rootPath);
            stats.storage.free = diskSpace.free;
            stats.storage.size = diskSpace.size;
            stats.storage.path = rootPath + ' (Fallback)';
        } catch (fallbackError) {
            console.error('Disk Space Fallback Error:', fallbackError.message);
            stats.errors.push(`Disk space check failed: ${diskError.message}`);
        }
    }

    // Always return 200 with whatever data we managed to gather
    res.json(stats);

  } catch (criticalError) {
    console.error('Critical Stats Error:', criticalError);
    res.status(500).json({ error: 'Critical failure in stats service' });
  }
});

export default router;
