import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createProxyMiddleware } from 'http-proxy-middleware';
import axios from 'axios';
import userRoutes from './routes/users.js';
import roleRoutes from './routes/roles.js';
import statsRoutes from './routes/stats.js';
import settingsRoutes from './routes/settings.js';
import { requireAuth } from './middleware/auth.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const ORTHANC_URL = process.env.ORTHANC_URL || 'http://localhost:8042';

app.use(cors());
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
});

// Helper to find Orthanc UUID from DICOM UID
async function getOrthancId(level, query) {
  try {
    const response = await axios.post(`${ORTHANC_URL}/tools/find`, {
      Level: level,
      Query: query,
    });
    if (response.data && response.data.length > 0) {
      return response.data[0];
    }
    return null;
  } catch (error) {
    console.error(`Error finding ${level} with query ${JSON.stringify(query)}:`, error.message);
    return null;
  }
}

// Custom Handlers for DELETE (Map DICOM UID -> Orthanc UUID -> Delete)
app.delete('/api/dicom/studies/:studyId', requireAuth, async (req, res) => {
  const { studyId } = req.params;
  const orthancId = await getOrthancId('Study', { StudyInstanceUID: studyId });
  
  if (!orthancId) {
    return res.status(404).json({ error: 'Study not found' });
  }

  try {
    await axios.delete(`${ORTHANC_URL}/studies/${orthancId}`);
    res.status(200).send();
  } catch (error) {
    console.error('Error deleting study:', error.message);
    res.status(500).json({ error: 'Failed to delete study' });
  }
});

app.delete('/api/dicom/studies/:studyId/series/:seriesId', requireAuth, async (req, res) => {
  const { seriesId } = req.params;
  const orthancId = await getOrthancId('Series', { SeriesInstanceUID: seriesId });
  
  if (!orthancId) {
    return res.status(404).json({ error: 'Series not found' });
  }

  try {
    await axios.delete(`${ORTHANC_URL}/series/${orthancId}`);
    res.status(200).send();
  } catch (error) {
    console.error('Error deleting series:', error.message);
    res.status(500).json({ error: 'Failed to delete series' });
  }
});

app.delete('/api/dicom/studies/:studyId/series/:seriesId/instances/:instanceId', requireAuth, async (req, res) => {
  const { instanceId } = req.params;
  const orthancId = await getOrthancId('Instance', { SOPInstanceUID: instanceId });
  
  if (!orthancId) {
    return res.status(404).json({ error: 'Instance not found' });
  }

  try {
    await axios.delete(`${ORTHANC_URL}/instances/${orthancId}`);
    res.status(200).send();
  } catch (error) {
    console.error('Error deleting instance:', error.message);
    res.status(500).json({ error: 'Failed to delete instance' });
  }
});

// Custom Handlers for Thumbnail (Map -> Preview)
// Case 1: Series Thumbnail (find first instance)
app.get('/api/dicom/studies/:studyId/series/:seriesId/thumbnail', requireAuth, async (req, res) => {
  const { seriesId } = req.params;
  const orthancSeriesId = await getOrthancId('Series', { SeriesInstanceUID: seriesId });

  if (!orthancSeriesId) {
    return res.status(404).send('Series not found');
  }

  try {
    // Get instances of the series
    const instancesRes = await axios.get(`${ORTHANC_URL}/series/${orthancSeriesId}/instances`);
    const instances = instancesRes.data;
    
    if (instances.length === 0) {
      return res.status(404).send('No instances in series');
    }

    // Use the first instance for preview
    // We stream the response from Orthanc's preview endpoint
    const previewUrl = `${ORTHANC_URL}/instances/${instances[0].ID}/preview`;
    const response = await axios({
      method: 'get',
      url: previewUrl,
      responseType: 'stream'
    });

    res.setHeader('Content-Type', 'image/jpeg');
    response.data.pipe(res);
  } catch (error) {
    console.error('Error generating series thumbnail:', error.message);
    res.status(500).send('Thumbnail generation failed');
  }
});

// Case 2: Instance Thumbnail
app.get('/api/dicom/studies/:studyId/series/:seriesId/instances/:instanceId/thumbnail', requireAuth, async (req, res) => {
  const { instanceId } = req.params;
  const orthancId = await getOrthancId('Instance', { SOPInstanceUID: instanceId });

  if (!orthancId) {
    return res.status(404).send('Instance not found');
  }

  try {
    const previewUrl = `${ORTHANC_URL}/instances/${orthancId}/preview`;
    const response = await axios({
      method: 'get',
      url: previewUrl,
      responseType: 'stream'
    });

    res.setHeader('Content-Type', 'image/jpeg');
    response.data.pipe(res);
  } catch (error) {
    console.error('Error generating instance thumbnail:', error.message);
    res.status(500).send('Thumbnail generation failed');
  }
});

// Case 3: Study Archive (Map -> Archive)
app.get('/api/dicom/studies/:studyId/archive', requireAuth, async (req, res) => {
  const { studyId } = req.params;
  const orthancId = await getOrthancId('Study', { StudyInstanceUID: studyId });

  if (!orthancId) {
    return res.status(404).send('Study not found');
  }

  try {
    const archiveUrl = `${ORTHANC_URL}/studies/${orthancId}/archive`;
    const response = await axios({
      method: 'get',
      url: archiveUrl,
      responseType: 'stream'
    });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${studyId}.zip"`);
    response.data.pipe(res);
  } catch (error) {
    console.error('Error generating study archive:', error.message);
    res.status(500).send('Archive generation failed');
  }
});

// Case 4: Modify Study
app.post('/api/dicom/studies/:studyId/modify', requireAuth, express.json(), async (req, res) => {
  const { studyId } = req.params;
  const { changes, keepSource, keepStudyInstanceUID } = req.body;
  
  const orthancId = await getOrthancId('Study', { StudyInstanceUID: studyId });

  if (!orthancId) {
    return res.status(404).send('Study not found');
  }

  try {
    const modifyPayload = {
      Replace: changes,
      KeepSource: keepSource,
      Force: true, // Allow changing PatientID etc
      Keep: keepStudyInstanceUID ? ['StudyInstanceUID', 'SeriesInstanceUID', 'SOPInstanceUID'] : [] 
    };

    // Note: If keepStudyInstanceUID is true, we usually want to modify in place (sort of).
    // Orthanc's /modify creates a NEW resource by default. 
    // If we keep UIDs, it might overwrite or create conflict if not careful?
    // Orthanc documentation says:
    // "If 'Keep' contains 'StudyInstanceUID', the StudyInstanceUID will be kept."
    // If we keep UIDs and modify other tags, Orthanc might allow it if Force=true.
    
    // If we are keeping UIDs, Orthanc requires KeepSource to be true
    // to avoid deleting the 'source' which effectively is the same as the 'target'
    if (keepStudyInstanceUID) {
        modifyPayload.KeepSource = true;
    }
    
    const response = await axios.post(`${ORTHANC_URL}/studies/${orthancId}/modify`, modifyPayload);
    
    // If KeepSource is false, and the ID changed (which implies a new resource was created,
    // e.g. because of PatientID change), we should ensure the original is gone.
    // However, Orthanc should handle this if KeepSource is false.
    // But if we are observing duplicates when PatientID changes, it means Orthanc
    // might treat the new Patient hierarchy as independent and not delete the old one.
    // Let's explicitly delete the old one if we intended to move it.
    if (!keepSource && response.data.ID !== orthancId) {
       console.log(`Deleting original study ${orthancId} after modification to ${response.data.ID}`);
       try {
         await axios.delete(`${ORTHANC_URL}/studies/${orthancId}`);
       } catch (delErr) {
         console.warn('Failed to delete source study after modification:', delErr.message);
         // Ignore error as it might already be gone
       }
    }

    // Response contains { "ID": "new-orthanc-id", "Path": "..." }
    res.json(response.data);
  } catch (error) {
    console.error('Error modifying study:', error.message);
    if (error.response) {
        console.error('Orthanc response:', error.response.data);
        res.status(error.response.status).json(error.response.data);
    } else {
        res.status(500).json({ error: 'Modification failed' });
    }
  }
});

// Orthanc Proxy (DICOMWeb)
// Forward /api/dicom/* to Orthanc /dicom-web/*
// Place this BEFORE express.json() to avoid body parsing issues with binary DICOM data
app.use('/api/dicom', requireAuth, createProxyMiddleware({
  target: ORTHANC_URL,
  changeOrigin: true,
  pathRewrite: (path) => {
    // Express strips '/api/dicom', so path is '/studies', '/rs/studies', etc.
    // We want to map it to '/dicom-web/studies'
    return path.replace(/^\//, '/dicom-web/');
  },
  onProxyReq: (proxyReq, req, res) => {
    // Optional: Add Auth headers if Orthanc is protected
    // proxyReq.setHeader('Authorization', 'Basic ' + Buffer.from('orthanc:orthanc').toString('base64'));
  },
  onError: (err, req, res) => {
    console.error('Proxy Error:', err);
    res.status(502).json({ error: 'Orthanc Unreachable' });
  }
}));

app.use(express.json());

// Routes
app.use('/api/users', userRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/settings', settingsRoutes);

app.get('/', (req, res) => {
  res.send('MiniPACS Backend Running (Orthanc Mode)');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Proxying DICOM requests to ${ORTHANC_URL}`);
});
