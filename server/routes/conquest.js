
import express from 'express';
import mysql from 'mysql2/promise';
import path from 'path';
import fs from 'fs';
import dicomParser from 'dicom-parser';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { randomUUID } from 'crypto';
import archiver from 'archiver';

const execFileAsync = promisify(execFile);
const router = express.Router();

// Configuration based on user input
const dbConfig = {
  host: process.env.CONQUEST_DB_HOST || 'localhost',
  user: process.env.CONQUEST_DB_USER || 'root',
  password: process.env.CONQUEST_DB_PASSWORD || 'nexia',
  database: process.env.CONQUEST_DB_NAME || 'nexia'
};

// Conquest Data Path
const MAG0_PATH = 'C:\\dicomserver\\Data\\';

const pool = mysql.createPool(dbConfig);

const formatName = (name) => name ? name.replace(/\^/g, ' ').trim() : '';
const formatDicomName = (name) => name || ''; // Keep carets for DICOMweb JSON
const formatPNValue = (name) => [ { Alphabetic: formatDicomName(name) } ];

// Helper to read DICOM tags from file header
const getDicomFileHeader = async (relativePath) => {
  try {
    const filePath = path.join(MAG0_PATH, relativePath.replace(/\\/g, path.sep));
    
    // Read only the first 1MB (increased from 128KB)
    const fd = await fs.promises.open(filePath, 'r');
    const buffer = Buffer.alloc(1024 * 1024); // 1MB
    const { bytesRead } = await fd.read(buffer, 0, buffer.length, 0);
    await fd.close();
    
    if (bytesRead < 132) return {}; // Too small

    const dicomData = new Uint8Array(buffer.buffer, 0, bytesRead);
    let dataSet;
    try {
      dataSet = dicomParser.parseDicom(dicomData);
    } catch (err) {
      if (err.dataSet) {
        dataSet = err.dataSet;
      } else {
        // console.warn('Failed to parse DICOM header for', relativePath, err.message);
        return {};
      }
    }

    const getString = (tag) => {
      try {
        const element = dataSet.elements[tag];
        if (element) {
           const text = dicomParser.explicitElementToString(dataSet, element);
           return text ? text.trim() : undefined;
        }
        return undefined;
      } catch (e) { return undefined; }
    };
    
    const getFloat = (tag) => {
       const str = getString(tag);
       if (!str) return undefined;
       const val = parseFloat(str);
       return isNaN(val) ? undefined : val;
    };

    const getInt = (tag) => {
       const str = getString(tag);
       if (!str) return undefined;
       const val = parseInt(str, 10);
       return isNaN(val) ? undefined : val;
    };

    const getFloatArray = (tag) => {
       const str = getString(tag);
       if (!str) return undefined;
       const arr = str.split('\\').map(parseFloat);
       if (arr.some(isNaN)) return undefined; // strict check
       // Round to 6 decimal places to avoid floating point noise issues in viewers
       return arr.map(n => parseFloat(n.toFixed(6)));
    };
    
    // Additional Tags for Metadata
    const getUS = (tag) => {
       const str = getString(tag);
       if (!str) return undefined;
       const val = parseInt(str, 10);
       return isNaN(val) ? undefined : val;
    };

    return {
      ImagePositionPatient: getFloatArray('x00200032'),
      ImageOrientationPatient: getFloatArray('x00200037'),
      PixelSpacing: getFloatArray('x00280030'),
      SliceThickness: getFloat('x00180050'),
      FrameOfReferenceUID: getString('x00200052'),
      SeriesDate: getString('x00080021'),
      SeriesTime: getString('x00080031'),
      WindowCenter: getFloatArray('x00281050'),
      WindowWidth: getFloatArray('x00281051'),
      RescaleIntercept: getFloat('x00281052'),
      RescaleSlope: getFloat('x00281053'),
      BitsAllocated: getUS('x00280100'),
      BitsStored: getUS('x00280101'),
      HighBit: getUS('x00280102'),
      PixelRepresentation: getUS('x00280103'),
      SamplesPerPixel: getUS('x00280002'),
      PhotometricInterpretation: getString('x00280004'),
      Rows: getUS('x00280010'),
      Columns: getUS('x00280011'),
      SOPClassUID: getString('x00080016'),
      InstitutionName: getString('x00080080'),
      ReferringPhysicianName: getString('x00080090'),
    };
  } catch (err) {
    // console.warn('Failed to read DICOM header for', relativePath, err.message);
    return {};
  }
};

const mapStudy = (row) => ({
  ID: row.StudyInsta,
  Type: 'Study',
  MainDicomTags: {
    StudyInstanceUID: row.StudyInsta,
    StudyDate: row.StudyDate,
    StudyTime: row.StudyTime,
    AccessionNumber: row.AccessionN,
    StudyDescription: row.StudyDescr,
    StudyID: row.StudyID,
    PatientName: formatName(row.PatientNam),
    PatientID: row.PatientID,
    PatientBirthDate: row.PatientBir,
    PatientSex: row.PatientSex,
    Modality: row.StudyModal || 'OT',
    InstitutionName: row.Institution || row.InstitutionNa, 
    ReferringPhysicianName: formatName(row.ReferPhysi)
  },
  PatientMainDicomTags: {
    PatientName: formatName(row.PatientNam),
    PatientID: row.PatientID,
    PatientBirthDate: row.PatientBir,
    PatientSex: row.PatientSex
  },
  Series: [] 
});

const mapSeries = (row) => ({
  ID: row.SeriesInst,
  Type: 'Series',
  MainDicomTags: {
    Modality: row.Modality,
    SeriesInstanceUID: row.SeriesInst,
    SeriesNumber: row.SeriesNumb,
    SeriesDescription: row.SeriesDesc,
    StationName: row.StationNam,
    BodyPartExamined: row.BodyPartEx
  },
  ParentStudy: row.StudyInsta,
  Instances: []
});

// DICOMweb QIDO-RS & WADO-RS Helpers
const TAGS = {
  StudyDate: '00080020',
  StudyTime: '00080030',
  AccessionNumber: '00080050',
  Modality: '00080060',
  ReferringPhysicianName: '00080090',
  PatientName: '00100010',
  PatientID: '00100020',
  PatientBirthDate: '00100030',
  PatientSex: '00100040',
  StudyInstanceUID: '0020000D',
  StudyID: '00200010',
  SeriesNumber: '00200011',
  InstanceNumber: '00200013',
  SeriesInstanceUID: '0020000E',
  SOPInstanceUID: '00080018',
  SOPClassUID: '00080016',
  StudyDescription: '00081030',
  SeriesDescription: '0008103E',
  Rows: '00280010',
  Columns: '00280011',
  BitsAllocated: '00280100',
  BitsStored: '00280101',
  HighBit: '00280102',
  PixelRepresentation: '00280103',
  WindowCenter: '00281050',
  WindowWidth: '00281051',
  RescaleIntercept: '00281052',
  RescaleSlope: '00281053',
  PhotometricInterpretation: '00280004',
  NumberOfFrames: '00280008',
  SamplesPerPixel: '00280002',
  PlanarConfiguration: '00280006'
};

const mapToDicomWebValue = (vr, value) => {
  if (value === undefined || value === null) return undefined;
  // Simple mapping, mostly string (CS, SH, LO, PN, UI, DA, TM)
  // For numbers (US, SS, FL, FD, SL, UL), we can return number or string. OHIF handles both usually.
  return { vr, Value: [value] };
};

const mapStudyToDicomWeb = (row) => ({
  [TAGS.StudyDate]: mapToDicomWebValue('DA', row.StudyDate),
  [TAGS.StudyTime]: mapToDicomWebValue('TM', row.StudyTime),
  [TAGS.AccessionNumber]: mapToDicomWebValue('SH', row.AccessionN),
  [TAGS.PatientName]: mapToDicomWebValue('PN', formatName(row.PatientNam)),
  [TAGS.PatientID]: mapToDicomWebValue('LO', row.PatientID),
  [TAGS.PatientBirthDate]: mapToDicomWebValue('DA', row.PatientBir),
  [TAGS.PatientSex]: mapToDicomWebValue('CS', row.PatientSex),
  [TAGS.StudyInstanceUID]: mapToDicomWebValue('UI', row.StudyInsta),
  [TAGS.StudyID]: mapToDicomWebValue('SH', row.StudyID),
  [TAGS.StudyDescription]: mapToDicomWebValue('LO', row.StudyDescr),
  [TAGS.Modality]: mapToDicomWebValue('CS', row.StudyModal || 'OT'),
  [TAGS.ReferringPhysicianName]: mapToDicomWebValue('PN', formatName(row.ReferPhysi)),
  // Add number of study related series/instances if available
  // '00201206': mapToDicomWebValue('IS', row.NumberOfStudyRelatedSeries),
  // '00201208': mapToDicomWebValue('IS', row.NumberOfStudyRelatedInstances),
});

// QIDO-RS: Search Studies
router.get('/rs/studies', async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;
    // Basic filter support (expand as needed)
    let query = 'SELECT * FROM dicomstudies ORDER BY StudyDate DESC, StudyTime DESC LIMIT ? OFFSET ?';
    const params = [parseInt(limit), parseInt(offset)];
    
    if (req.query.StudyInstanceUID) {
       query = 'SELECT * FROM dicomstudies WHERE StudyInsta = ?';
       params.length = 0;
       params.push(req.query.StudyInstanceUID);
    }
    
    const [rows] = await pool.query(query, params);
    const dicomWebStudies = rows.map(mapStudyToDicomWeb);
    res.json(dicomWebStudies);
  } catch (err) {
    console.error('QIDO-RS Studies Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// WADO-RS: Retrieve Study Metadata
router.get('/rs/studies/:studyUID/metadata', async (req, res) => {
  try {
    const { studyUID } = req.params;
    
    // 1. Get all series in study
    const [seriesRows] = await pool.query('SELECT * FROM dicomseries WHERE StudyInsta = ?', [studyUID]);
    
    if (seriesRows.length === 0) return res.json([]);
    
    const metadata = [];
    
    for (const series of seriesRows) {
       // 2. Get all images in series
       const [imageRows] = await pool.query('SELECT * FROM dicomimages WHERE SeriesInst = ? ORDER BY ImageNumbe', [series.SeriesInst]);
       
       if (imageRows.length === 0) continue;
       
       // 3. Optimization: Read header from the FIRST image in series to get "Shared" tags
       let sharedTags = {};
       try {
         const relativePath = imageRows[0].ObjectFile.replace(/\\/g, path.sep);
         sharedTags = await getDicomFileHeader(relativePath);
       } catch (e) { console.warn('Failed to read header for series', series.SeriesInst); }
       
       // 4. Build instance metadata
       for (const img of imageRows) {
          const instance = {
             [TAGS.StudyInstanceUID]: mapToDicomWebValue('UI', studyUID),
             [TAGS.SeriesInstanceUID]: mapToDicomWebValue('UI', series.SeriesInst),
             [TAGS.SOPInstanceUID]: mapToDicomWebValue('UI', img.SOPInstanc),
             [TAGS.SOPClassUID]: mapToDicomWebValue('UI', sharedTags.SOPClassUID || '1.2.840.10008.5.1.4.1.1.7'), // Fallback to Secondary Capture
             [TAGS.InstanceNumber]: mapToDicomWebValue('IS', img.ImageNumbe || 1),
             [TAGS.Modality]: mapToDicomWebValue('CS', series.Modality),
             [TAGS.SeriesNumber]: mapToDicomWebValue('IS', series.SeriesNumb),
             [TAGS.SeriesDescription]: mapToDicomWebValue('LO', series.SeriesDesc),
             
             // Image Pixel Tags (Crucial for rendering)
             [TAGS.Rows]: mapToDicomWebValue('US', sharedTags.ImageOrientationPatient ? undefined : 512), // Fallback? No, undefined is better if missing
             [TAGS.Columns]: mapToDicomWebValue('US', sharedTags.ImageOrientationPatient ? undefined : 512),
          };
          
          // Helper to add if exists
          const addTag = (tag, vr, val) => { if (val !== undefined) instance[tag] = mapToDicomWebValue(vr, val); };
          
          addTag(TAGS.Rows, 'US', sharedTags.ImageOrientationPatient ? undefined : (sharedTags.Rows || 512)); // Hacky fallback
          // Better: Use what we read
          if (sharedTags.Rows) addTag(TAGS.Rows, 'US', sharedTags.Rows);
          if (sharedTags.Columns) addTag(TAGS.Columns, 'US', sharedTags.Columns);
          if (sharedTags.BitsAllocated) addTag(TAGS.BitsAllocated, 'US', sharedTags.BitsAllocated);
          if (sharedTags.BitsStored) addTag(TAGS.BitsStored, 'US', sharedTags.BitsStored);
          if (sharedTags.HighBit) addTag(TAGS.HighBit, 'US', sharedTags.HighBit);
          if (sharedTags.PixelRepresentation) addTag(TAGS.PixelRepresentation, 'US', sharedTags.PixelRepresentation);
          if (sharedTags.PhotometricInterpretation) addTag(TAGS.PhotometricInterpretation, 'CS', sharedTags.PhotometricInterpretation);
          if (sharedTags.SamplesPerPixel) addTag(TAGS.SamplesPerPixel, 'US', sharedTags.SamplesPerPixel);
          
          if (sharedTags.WindowCenter) addTag(TAGS.WindowCenter, 'DS', sharedTags.WindowCenter);
          if (sharedTags.WindowWidth) addTag(TAGS.WindowWidth, 'DS', sharedTags.WindowWidth);
          if (sharedTags.RescaleIntercept) addTag(TAGS.RescaleIntercept, 'DS', sharedTags.RescaleIntercept);
          if (sharedTags.RescaleSlope) addTag(TAGS.RescaleSlope, 'DS', sharedTags.RescaleSlope);
          
          if (sharedTags.ImagePositionPatient) addTag('00200032', 'DS', sharedTags.ImagePositionPatient);
          if (sharedTags.ImageOrientationPatient) addTag('00200037', 'DS', sharedTags.ImageOrientationPatient);
          if (sharedTags.PixelSpacing) addTag('00280030', 'DS', sharedTags.PixelSpacing);
          if (sharedTags.SliceThickness) addTag('00180050', 'DS', sharedTags.SliceThickness);
          
          // Add WADO-RS retrieval URL (BulkDataURI) or just rely on WADO-URI
          // OHIF DICOMweb datasource uses wadoUriRoot if imageRendering is 'wadouri'
          // But it needs these tags to know how to render.
          
          metadata.push(instance);
       }
    }
    
    res.json(metadata);
  } catch (err) {
    console.error('WADO-RS Metadata Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /studies
router.get('/studies', async (req, res) => {
  try {
    const expand = req.query.expand !== undefined;
    
    // Use standard Conquest table names
    const query = `
      SELECT * FROM dicomstudies 
      ORDER BY StudyDate DESC, StudyTime DESC 
      LIMIT 100
    `;
    const [rows] = await pool.query(query);

    if (expand) {
      const studies = rows.map(mapStudy);
      res.json(studies);
    } else {
      res.json(rows.map(r => r.StudyInsta));
    }
  } catch (err) {
    console.error('Conquest DB Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /studies/:id
router.get('/studies/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query('SELECT * FROM dicomstudies WHERE StudyInsta = ?', [id]);
    
    if (rows.length === 0) return res.status(404).send('Study not found');
    
    const study = mapStudy(rows[0]);
    
    // Get Series IDs
    const [seriesRows] = await pool.query('SELECT SeriesInst FROM dicomseries WHERE StudyInsta = ?', [id]);
    study.Series = seriesRows.map(r => r.SeriesInst);

    // Populate missing tags (InstitutionName) from the first image file
    try {
       const [imgRows] = await pool.query('SELECT i.ObjectFile FROM dicomimages i JOIN dicomseries s ON i.SeriesInst = s.SeriesInst WHERE s.StudyInsta = ? LIMIT 1', [id]);
       if (imgRows.length > 0) {
          const header = await getDicomFileHeader(imgRows[0].ObjectFile);
          if (header.InstitutionName) study.MainDicomTags.InstitutionName = header.InstitutionName;
          // Prefer DB for RefPhysician, but fallback to header if empty
          if (!study.MainDicomTags.ReferringPhysicianName && header.ReferringPhysicianName) {
             study.MainDicomTags.ReferringPhysicianName = header.ReferringPhysicianName;
          }
          
          // Add VOI LUT and Rescale tags to MainDicomTags to help Viewer with initial display
          if (header.WindowCenter !== undefined) study.MainDicomTags.WindowCenter = header.WindowCenter;
          if (header.WindowWidth !== undefined) study.MainDicomTags.WindowWidth = header.WindowWidth;
          if (header.RescaleIntercept !== undefined) study.MainDicomTags.RescaleIntercept = header.RescaleIntercept;
          if (header.RescaleSlope !== undefined) study.MainDicomTags.RescaleSlope = header.RescaleSlope;
          if (header.PhotometricInterpretation) study.MainDicomTags.PhotometricInterpretation = header.PhotometricInterpretation;
       }
    } catch (e) { console.error('Failed to populate extra tags', e); }
    
    res.json(study);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /studies/:id/series (New endpoint)
router.get('/studies/:id/series', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query('SELECT * FROM dicomseries WHERE StudyInsta = ?', [id]);
    
    const seriesList = rows.map(mapSeries);
    
    // Populate Instances for each series (optional but good for completeness)
    for (const series of seriesList) {
       const [imgRows] = await pool.query('SELECT SOPInstanc FROM dicomimages WHERE SeriesInst = ?', [series.ID]);
       series.Instances = imgRows.map(r => r.SOPInstanc);
    }
    
    res.json(seriesList);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /studies/:id/statistics
router.get('/studies/:id/statistics', async (req, res) => {
   try {
     const { id } = req.params;
     const [seriesCount] = await pool.query('SELECT COUNT(*) as cnt FROM dicomseries WHERE StudyInsta = ?', [id]);
     
     const [instanceCount] = await pool.query(`
        SELECT COUNT(*) as cnt 
        FROM dicomimages i
        JOIN dicomseries s ON i.SeriesInst = s.SeriesInst
        WHERE s.StudyInsta = ?
     `, [id]);

     res.json({
       CountSeries: seriesCount[0].cnt,
       CountInstances: instanceCount[0].cnt,
       CountModalities: 1 
     });
   } catch (err) {
     res.status(500).json({ error: err.message });
   }
});

// GET /series/:id
router.get('/series/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query('SELECT * FROM dicomseries WHERE SeriesInst = ?', [id]);
    if (rows.length === 0) return res.status(404).send('Series not found');
    
    const series = mapSeries(rows[0]);
    
    const [imgRows] = await pool.query('SELECT SOPInstanc FROM dicomimages WHERE SeriesInst = ?', [id]);
    series.Instances = imgRows.map(r => r.SOPInstanc);
    
    res.json(series);
  } catch (err) {
    console.error('QIDO Series Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// WADO-RS: Retrieve Instance (Returns raw DICOM file)
router.get('/rs/studies/:studyUID/series/:seriesUID/instances/:instanceUID', async (req, res) => {
  try {
    const { instanceUID } = req.params;
    
    // Find file path
    const [rows] = await pool.query('SELECT ObjectFile FROM dicomimages WHERE SOPInstanc = ?', [instanceUID]);
    
    if (rows.length === 0) {
      return res.status(404).send('Instance not found');
    }

    const relativePath = rows[0].ObjectFile.replace(/\\/g, path.sep);
    const filePath = path.join(MAG0_PATH, relativePath);

    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      return res.status(404).send('File not found on disk');
    }

    // Serve as DICOM
    res.setHeader('Content-Type', 'application/dicom');
    res.sendFile(filePath);

  } catch (err) {
    console.error('WADO-RS Instance Error:', err);
    res.status(500).send(err.message);
  }
});

// GET /series/:id/instances (Added for MINIPACS Dialog)
router.get('/series/:id/instances', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get Instances
    const [rows] = await pool.query('SELECT * FROM dicomimages WHERE SeriesInst = ? ORDER BY ImageNumbe', [id]);
    
    // Map to simple format expected by pacsApi
    const instances = rows.map(row => ({
      ID: row.SOPInstanc,
      MainDicomTags: {
        SOPInstanceUID: row.SOPInstanc,
        SeriesInstanceUID: row.SeriesInst,
        InstanceNumber: row.ImageNumbe || '1',
      },
      IndexInSeries: parseInt(row.ImageNumbe || '1'),
      ParentSeries: row.SeriesInst
    }));

    res.json(instances);
  } catch (err) {
    console.error('Get Series Instances Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /studies/:id
router.delete('/studies/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Find all series
        const [seriesRows] = await pool.query('SELECT SeriesInst FROM dicomseries WHERE StudyInsta = ?', [id]);
        
        for (const series of seriesRows) {
            const seriesId = series.SeriesInst;
             // Find files to delete
            const [rows] = await pool.query('SELECT ObjectFile FROM dicomimages WHERE SeriesInst = ?', [seriesId]);
            
            for (const row of rows) {
                const relativePath = row.ObjectFile.replace(/\\/g, path.sep);
                const filePath = path.join(MAG0_PATH, relativePath);
                if (fs.existsSync(filePath)) {
                    try { fs.unlinkSync(filePath); } catch (e) { console.error('Delete file error:', e); }
                }
            }
            // Delete series data
             await pool.query('DELETE FROM dicomimages WHERE SeriesInst = ?', [seriesId]);
             await pool.query('DELETE FROM dicomseries WHERE SeriesInst = ?', [seriesId]);
        }

        await pool.query('DELETE FROM dicomstudies WHERE StudyInsta = ?', [id]);
        
        res.status(200).send('Study deleted');
    } catch (err) {
        console.error('Delete Study Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE /series/:id
router.delete('/series/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Find files to delete
        const [rows] = await pool.query('SELECT ObjectFile FROM dicomimages WHERE SeriesInst = ?', [id]);
        
        for (const row of rows) {
            const relativePath = row.ObjectFile.replace(/\\/g, path.sep);
            const filePath = path.join(MAG0_PATH, relativePath);
            if (fs.existsSync(filePath)) {
                try { fs.unlinkSync(filePath); } catch (e) { console.error('Delete file error:', e); }
            }
        }

        // Delete from DB (Cascade usually handles this, but let's be explicit if needed or rely on trigger)
        // Conquest DB doesn't always have cascade. Safer to delete images then series.
        await pool.query('DELETE FROM dicomimages WHERE SeriesInst = ?', [id]);
        await pool.query('DELETE FROM dicomseries WHERE SeriesInst = ?', [id]);
        
        res.status(200).send('Series deleted');
    } catch (err) {
        console.error('Delete Series Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE /instances/:id
router.delete('/instances/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const [rows] = await pool.query('SELECT ObjectFile FROM dicomimages WHERE SOPInstanc = ?', [id]);
        if (rows.length > 0) {
            const relativePath = rows[0].ObjectFile.replace(/\\/g, path.sep);
            const filePath = path.join(MAG0_PATH, relativePath);
            if (fs.existsSync(filePath)) {
                try { fs.unlinkSync(filePath); } catch (e) { console.error('Delete file error:', e); }
            }
        }

        await pool.query('DELETE FROM dicomimages WHERE SOPInstanc = ?', [id]);
        res.status(200).send('Instance deleted');
    } catch (err) {
        console.error('Delete Instance Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /instances/:id/preview
router.get('/instances/:id/preview', async (req, res) => {
  const { id } = req.params;
  const tempOutputFile = path.join('C:\\dicomserver\\Data', `temp_preview_${randomUUID()}.jpg`);
  
  try {
    // 1. Find the DICOM file path
    const [rows] = await pool.query('SELECT ObjectFile FROM dicomimages WHERE SOPInstanc = ?', [id]);
    
    if (rows.length === 0) {
      return res.status(404).send('Instance not found');
    }

    const relativePath = rows[0].ObjectFile.replace(/\\/g, path.sep);
    const filePath = path.join(MAG0_PATH, relativePath);

    if (!fs.existsSync(filePath)) {
       console.error(`Preview: File not found on disk: ${filePath}`);
       throw new Error('File not found on disk');
    }

    // 2. Convert to JPG using dgate64
    // Command: dgate64.exe --convert_to_jpg:file,size,out
    const dgatePath = 'C:\\dicomserver\\dgate64.exe';
    const size = 512;
    
    // Note: dgate64 expects the argument as a single string starting with --convert_to_jpg:
    await execFileAsync(dgatePath, [`--convert_to_jpg:${filePath},${size},${tempOutputFile}`]);
    
    // 3. Serve the file
    if (fs.existsSync(tempOutputFile)) {
        const imageBuffer = await fs.promises.readFile(tempOutputFile);
        res.setHeader('Content-Type', 'image/jpeg');
        res.send(imageBuffer);
        
        // Cleanup
        await fs.promises.unlink(tempOutputFile).catch(e => console.error('Cleanup error:', e));
    } else {
        throw new Error('Conversion failed, output file not created');
    }

  } catch (err) {
    console.error('Preview Generation Error:', err);
    try {
      fs.writeFileSync(path.join(process.cwd(), 'preview_error.log'), err.toString() + '\n' + (err.stack || ''));
    } catch (e) { console.error('Failed to write error log', e); }
    
    // Cleanup if exists
    if (fs.existsSync(tempOutputFile)) {
        try { fs.unlinkSync(tempOutputFile); } catch(e) {}
    }

    // Fallback to SVG Placeholder
    const svg = `
    <svg width="150" height="150" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#2d2d2d"/>
      <text x="50%" y="50%" font-family="Arial" font-size="14" fill="#888" text-anchor="middle" dy=".3em">DICOM PREVIEW</text>
      <text x="50%" y="65%" font-family="Arial" font-size="10" fill="#666" text-anchor="middle" dy=".3em">Not Available</text>
    </svg>`;
    
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(svg);
  }
});

// WADO-URI Endpoint
const wadoHandler = async (req, res) => {
  try {
    const { requestType, studyUID, seriesUID, objectUID } = req.query;

    if (requestType !== 'WADO') {
      return res.status(400).send('Only WADO requestType is supported');
    }

    if (!objectUID) {
      return res.status(400).send('Missing objectUID parameter');
    }

    // Find file path
    const [rows] = await pool.query('SELECT ObjectFile FROM dicomimages WHERE SOPInstanc = ?', [objectUID]);
    
    if (rows.length === 0) {
      return res.status(404).send('DICOM Object not found');
    }

    const relativePath = rows[0].ObjectFile.replace(/\\/g, path.sep);
    const filePath = path.join(MAG0_PATH, relativePath);

    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      return res.status(404).send('File not found on disk');
    }

    // Stream file
    res.setHeader('Content-Type', 'application/dicom');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    res.sendFile(filePath, {
      headers: {
        'Content-Type': 'application/dicom',
        'Cross-Origin-Resource-Policy': 'cross-origin',
        'Access-Control-Allow-Origin': '*',
        'Cross-Origin-Embedder-Policy': 'require-corp',
        'Cross-Origin-Opener-Policy': 'same-origin'
      }
    });

  } catch (err) {
    console.error('WADO Error:', err);
    res.status(500).send(err.message);
  }
};

router.get('/wado', wadoHandler);
router.get('/wadouri', wadoHandler); // Alias for compatibility

// QIDO-RS Studies Endpoint
router.get('/rs/studies', async (req, res) => {
  try {
    let { StudyInstanceUID, PatientName, PatientID, limit, offset } = req.query;
    
    // Support DICOM Tag keys (QIDO Standard)
    if (!PatientID) PatientID = req.query['00100020'];
    if (!PatientName) PatientName = req.query['00100010'];
    if (!StudyInstanceUID) StudyInstanceUID = req.query['0020000D'];

    console.log('QIDO Search Params:', { StudyInstanceUID, PatientName, PatientID });

    let query = `
      SELECT * FROM dicomstudies 
      WHERE 1=1
    `;
    const params = [];

    if (StudyInstanceUID) {
      query += ` AND StudyInsta = ?`;
      params.push(StudyInstanceUID);
    }
    if (PatientID) {
      query += ` AND PatientID LIKE ?`;
      params.push(`%${PatientID}%`);
    }
    if (PatientName) {
      query += ` AND PatientNam LIKE ?`;
      params.push(`%${PatientName}%`);
    }

    query += ` ORDER BY StudyDate DESC, StudyTime DESC LIMIT 100`;

    const [rows] = await pool.query(query, params);

    // Calculate study statistics (Series Count & Instance Count)
    const statsMap = {};
    
    // Get Series Counts
    const [seriesCounts] = await pool.query(`
        SELECT StudyInsta, COUNT(*) as cnt FROM dicomseries GROUP BY StudyInsta
    `);
    seriesCounts.forEach(r => {
        if (!statsMap[r.StudyInsta]) statsMap[r.StudyInsta] = { series: 0, instances: 0 };
        statsMap[r.StudyInsta].series = r.cnt;
    });

    // Get Instance Counts
    const [instanceCounts] = await pool.query(`
        SELECT s.StudyInsta, COUNT(*) as cnt 
        FROM dicomimages i
        JOIN dicomseries s ON i.SeriesInst = s.SeriesInst
        GROUP BY s.StudyInsta
    `);
    instanceCounts.forEach(r => {
        if (!statsMap[r.StudyInsta]) statsMap[r.StudyInsta] = { series: 0, instances: 0 };
        statsMap[r.StudyInsta].instances = r.cnt;
    });

    // Map to DICOMweb JSON
    const studies = rows.map(row => {
      const stats = statsMap[row.StudyInsta] || { series: 0, instances: 0 };
      return {
        "0020000D": { "vr": "UI", "Value": [row.StudyInsta] },
        "00080020": { "vr": "DA", "Value": [row.StudyDate] },
        "00080030": { "vr": "TM", "Value": [row.StudyTime] },
        "00080050": { "vr": "SH", "Value": [row.AccessionN] },
        "00100010": { "vr": "PN", "Value": formatPNValue(row.PatientNam) },
        "00100020": { "vr": "LO", "Value": [row.PatientID] },
        "00080061": { "vr": "CS", "Value": [row.StudyModal || 'OT'] },
        "00081030": { "vr": "LO", "Value": [row.StudyDescr] },
        "00201206": { "vr": "IS", "Value": [stats.series] }, // Number of Study Related Series
        "00201208": { "vr": "IS", "Value": [stats.instances] }  // Number of Study Related Instances
      };
    });

    res.json(studies);
  } catch (err) {
    console.error('QIDO Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /rs/studies/:studyUID/series
router.get('/rs/studies/:studyUID/series', async (req, res) => {
  try {
    const { studyUID } = req.params;
    
    // Get Study Patient Info
    const [studyRows] = await pool.query('SELECT PatientNam, PatientID FROM dicomstudies WHERE StudyInsta = ?', [studyUID]);
    const studyInfo = studyRows.length > 0 ? studyRows[0] : { PatientNam: '', PatientID: '' };

    const query = `
      SELECT * FROM dicomseries 
      WHERE StudyInsta = ?
    `;
    const [rows] = await pool.query(query, [studyUID]);

    const series = rows.map(row => ({
      "0020000E": { "vr": "UI", "Value": [row.SeriesInst] },
      "00080060": { "vr": "CS", "Value": [row.Modality] },
      "00200011": { "vr": "IS", "Value": [row.SeriesNumb] },
      "0008103E": { "vr": "LO", "Value": [row.SeriesDesc] },
      "00201209": { "vr": "IS", "Value": [0] }, // Number of Series Related Instances
      // Add Patient Info to Series level
      "00100010": { "vr": "PN", "Value": formatPNValue(studyInfo.PatientNam) },
      "00100020": { "vr": "LO", "Value": [studyInfo.PatientID] }
    }));

    res.json(series);
  } catch (err) {
    console.error('QIDO Series Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /rs/studies/:studyUID/series/:seriesUID/instances
router.get('/rs/studies/:studyUID/series/:seriesUID/instances', async (req, res) => {
  try {
    const { studyUID, seriesUID } = req.params;
    
    // Get Series Modality first
    const [seriesRows] = await pool.query('SELECT Modality FROM dicomseries WHERE SeriesInst = ?', [seriesUID]);
    const seriesModality = seriesRows.length > 0 ? seriesRows[0].Modality : 'OT';

    // Get Study Patient Info
    const [studyRows] = await pool.query('SELECT PatientNam, PatientID FROM dicomstudies WHERE StudyInsta = ?', [studyUID]);
    const studyInfo = studyRows.length > 0 ? studyRows[0] : { PatientNam: '', PatientID: '' };

    const query = `
      SELECT * FROM dicomimages 
      WHERE SeriesInst = ?
    `;
    const [rows] = await pool.query(query, [seriesUID]);

    // HEAVY QIDO MODE: Read file headers to ensure metadata completeness
    // This is critical for OHIF to properly build imageIds and register metadata
    const CONCURRENCY_LIMIT = 20;
    const enhancedInstances = [];
    
    for (let i = 0; i < rows.length; i += CONCURRENCY_LIMIT) {
      const chunk = rows.slice(i, i + CONCURRENCY_LIMIT);
      const chunkResults = await Promise.all(chunk.map(async (row) => {
        const fileHeader = await getDicomFileHeader(row.ObjectFile);
        
        // Merge DB and File Header
        return {
          ...row,
          ...fileHeader,
          // Fallbacks if file header fails
          SOPClassUID: fileHeader.SOPClassUID || row.SOPClassUI,
          Modality: fileHeader.FileModality || seriesModality
        };
      }));
      enhancedInstances.push(...chunkResults);
    }

    const instances = enhancedInstances.map(row => ({
      "00080018": { "vr": "UI", "Value": [row.SOPInstanc] },
      "00080016": { "vr": "UI", "Value": [row.SOPClassUID || '1.2.840.10008.5.1.4.1.1.2'] }, // Fallback to CT Image Storage if missing
      "0020000D": { "vr": "UI", "Value": [studyUID] },
      "0020000E": { "vr": "UI", "Value": [seriesUID] },
      "00100010": { "vr": "PN", "Value": formatPNValue(row.FilePatientName || studyInfo.PatientNam) },
      "00100020": { "vr": "LO", "Value": [row.FilePatientID || studyInfo.PatientID] },
      "00080060": { "vr": "CS", "Value": [row.Modality] },
      "00200013": { "vr": "IS", "Value": [row.ImageNumbe] },
      "00280010": { "vr": "US", "Value": [row.QRows] },
      "00280011": { "vr": "US", "Value": [row.QColumns] },
      "00081190": { "vr": "UR", "Value": [`http://localhost:3000/api/dicom/wado?requestType=WADO&studyUID=${studyUID}&seriesUID=${seriesUID}&objectUID=${row.SOPInstanc}`] }
    }));

    res.json(instances);
  } catch (err) {
    console.error('QIDO Instances Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /studies/:id/modify
router.post('/studies/:id/modify', async (req, res) => {
  const { id } = req.params;
  const { Replace, KeepSource, KeepStudyInstanceUID } = req.body;
  
  const logError = (msg, err) => {
    console.error(msg, err);
    try {
      fs.appendFileSync(path.join(process.cwd(), 'modify_error.log'), `${new Date().toISOString()} - ${msg}: ${err}\n`);
    } catch (e) { console.error('Failed to write log', e); }
  };

  logError(`Modifying study ${id}`, JSON.stringify({ Replace, KeepSource, KeepStudyInstanceUID }));

  let tempDir = path.join('C:\\dicomserver', 'temp_modify_' + randomUUID());
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

  try {
    // 1. Get all instances of the study
    const query = 'SELECT i.ObjectFile, i.SOPInstanc, i.SeriesInst FROM dicomimages i JOIN dicomseries s ON i.SeriesInst = s.SeriesInst WHERE s.StudyInsta = ?';
    logError('Executing query', query);
    
    let rows;
    try {
      [rows] = await pool.query(query, [id]);
    } catch (dbErr) {
      logError('DB Query Failed', dbErr);
      throw dbErr;
    }
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Study not found' });
    }

    const dgatePath = 'C:\\dicomserver\\dgate64.exe';
    
    // Maps to ensure consistency if generating new UIDs
    const seriesUidMap = new Map();
    // Generate a proper UID prefix. Using standard root + timestamp + random
    const newStudyInstanceUID = (!KeepStudyInstanceUID) ? 
      `1.2.826.0.1.3680043.2.135.${Date.now()}.${Math.floor(Math.random() * 10000)}` : null;

    // 2. Process files in batch using a single Lua script
    const luaScriptLines = [
       'local x = newdicomobject()',
       'local res',
       'print("Starting batch modification")'
    ];
    
    for (const row of rows) {
      const relativePath = row.ObjectFile.replace(/\\/g, path.sep);
      const filePath = path.join(MAG0_PATH, relativePath);
      
      if (!fs.existsSync(filePath)) {
        logError('File missing on disk', filePath);
        continue;
      }

      // Determine new UIDs if needed
      let fileReplace = { ...Replace };
      
      if (!KeepStudyInstanceUID && newStudyInstanceUID) {
        fileReplace.StudyInstanceUID = newStudyInstanceUID;
        
        // Consistent SeriesUID
        if (!seriesUidMap.has(row.SeriesInst)) {
           seriesUidMap.set(row.SeriesInst, `1.2.826.0.1.3680043.2.135.${Date.now()}.${Math.floor(Math.random() * 10000)}.1`);
        }
        fileReplace.SeriesInstanceUID = seriesUidMap.get(row.SeriesInst);
        
        // New SOPInstanceUID (always unique)
        fileReplace.SOPInstanceUID = `1.2.826.0.1.3680043.2.135.${Date.now()}.${Math.floor(Math.random() * 100000)}.2`;
      }

      const tempOut = path.join(tempDir, row.SOPInstanc + '.dcm');
      const tempOutEscaped = tempOut.replace(/\\/g, '\\\\');
      const filePathEscaped = filePath.replace(/\\/g, '\\\\');

      // Add file block to Lua script
      luaScriptLines.push(`
        readdicom(x, [[${filePathEscaped}]])
        ${Object.entries(fileReplace).map(([tag, value]) => {
           const safeVal = String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
           return `x.${tag} = "${safeVal}"`;
        }).join('\n')}
        writedicom(x, [[${tempOutEscaped}]])
        res = servercommand('addlocalfile:' .. [[${tempOutEscaped}]])
        print('Processed ' .. [[${row.SOPInstanc}]] .. ' Result: ' .. tostring(res))
      `);
    }
    
    // 3. Delete old study if not KeepSource (Append to Lua script)
    // CRITICAL: Only delete if we are NOT keeping the same StudyInstanceUID.
    // If we keep the UID (Modify in place), addlocalfile updates the existing study. 
    // Deleting it would remove the updates we just made!
    if (!KeepSource && !KeepStudyInstanceUID) {
       luaScriptLines.push(`
         res = servercommand('delete_study:${id}')
         print('Deleted old study ${id} Result: ' .. tostring(res))
       `);
    }

    const luaFile = path.join(tempDir, `batch_mod.lua`);
    fs.writeFileSync(luaFile, luaScriptLines.join('\n'));

    // Execute Batch Lua
    try {
      const cmdArgs = [`--dolua:${luaFile}`];
      logError('Executing batch dgate lua', dgatePath + ' ' + cmdArgs.join(' '));
      const { stdout } = await execFileAsync(dgatePath, cmdArgs, { cwd: 'C:\\dicomserver' });
      logError('Batch Lua Output', stdout);
    } catch (e) {
      if (e.code === 4294967295 || e.code === -1) {
         logError('dgate batch lua exited with -1, assuming success', e.stdout);
      } else {
         logError('Batch Lua execution failed', JSON.stringify(e, Object.getOwnPropertyNames(e)));
         throw e;
      }
    }

    // Force update DB to ensure metadata is synced (bypassing dgate mapping issues)
    const targetStudyUID = (!KeepStudyInstanceUID && newStudyInstanceUID) ? newStudyInstanceUID : id;
    const dbUpdates = [];
    const dbParams = [];

    if (modifications.InstitutionName !== undefined) { 
        dbUpdates.push('Institution = ?'); 
        dbParams.push(modifications.InstitutionName); 
    }
    if (modifications.ReferringPhysicianName !== undefined) { 
        dbUpdates.push('ReferPhysi = ?'); 
        dbParams.push(formatName(modifications.ReferringPhysicianName)); 
    }
    if (modifications.PatientName) { dbUpdates.push('PatientNam = ?'); dbParams.push(formatName(modifications.PatientName)); }
    if (modifications.PatientID) { dbUpdates.push('PatientID = ?'); dbParams.push(modifications.PatientID); }
    if (modifications.PatientBirthDate) { dbUpdates.push('PatientBir = ?'); dbParams.push(modifications.PatientBirthDate); }
    if (modifications.PatientSex) { dbUpdates.push('PatientSex = ?'); dbParams.push(modifications.PatientSex); }
    if (modifications.AccessionNumber) { dbUpdates.push('AccessionN = ?'); dbParams.push(modifications.AccessionNumber); }
    if (modifications.StudyID) { dbUpdates.push('StudyID = ?'); dbParams.push(modifications.StudyID); }

    if (dbUpdates.length > 0) {
        // Wait a brief moment to ensure dgate has committed its changes (if any)
        await new Promise(r => setTimeout(r, 500));
        
        const updateSql = `UPDATE dicomstudies SET ${dbUpdates.join(', ')} WHERE StudyInsta = ?`;
        dbParams.push(targetStudyUID);
        logError('Updating DB Metadata manually', { sql: updateSql, params: dbParams });
        try {
            await pool.query(updateSql, dbParams);
        } catch (dbErr) {
            logError('Manual DB Update Failed', dbErr);
            // Don't fail the request, just log it
        }
    }

    res.json({ message: 'Study modified successfully', ID: targetStudyUID });

  } catch (err) {
    logError('Modify Study Fatal Error', err);
    res.status(500).json({ error: err.message });
  } finally {
    // Cleanup temp files
    // Use a small delay to ensure dgate has released locks if any
    setTimeout(() => {
        try {
          if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
          }
        } catch (e) { logError('Cleanup temp dir failed', e); }
    }, 2000);
  }
});

// WADO-RS Retrieve Instance (Single Part)
router.get('/rs/studies/:studyUID/series/:seriesUID/instances/:instanceUID', async (req, res) => {
    // Redirect to WADO-URI handler logic but set params manually
    req.query.requestType = 'WADO';
    req.query.objectUID = req.params.instanceUID;
    return wadoHandler(req, res);
});

// WADO-RS Metadata Endpoint (Enhanced with File Header Reading)
const metadataHandler = async (req, res) => {
  try {
    const { studyUID, seriesUID } = req.params;
    
    // Base query to get instances
    let query = `
      SELECT 
        s.StudyInsta, s.StudyDate, s.StudyTime, s.AccessionN, s.StudyID, s.StudyDescr, s.ReferPhysi, s.StudyModal,
        s.PatientNam, s.PatientID, s.PatientBir, s.PatientSex,
        se.SeriesInst, se.SeriesNumb, se.SeriesDate, se.SeriesTime, se.SeriesDesc, se.Modality, se.BodyPartEx, se.ProtocolNa, se.FrameOfRef,
        i.SOPInstanc, i.SOPClassUI, i.ImageNumbe, i.ImageDate, i.ImageTime, 
        i.SliceLocat, i.QRows, i.QColumns, i.ObjectFile,
        i.SamplesPer, i.PhotoMetri, i.BitsStored, i.ImageType
      FROM dicomstudies s
      JOIN dicomseries se ON s.StudyInsta = se.StudyInsta
      JOIN dicomimages i ON se.SeriesInst = i.SeriesInst
      WHERE s.StudyInsta = ?
    `;
    
    const params = [studyUID];

    // Filter by series if provided
    if (seriesUID) {
      query += ` AND se.SeriesInst = ?`;
      params.push(seriesUID);
    }
    
    const [rows] = await pool.query(query, params);
    
    if (rows.length === 0) {
      return res.json([]);
    }

    // Enhance rows with file data (concurrently)
    // Limit concurrency to avoid too many open files
    const CONCURRENCY_LIMIT = 20;
    const enhancedRows = [];
    
    for (let i = 0; i < rows.length; i += CONCURRENCY_LIMIT) {
      const chunk = rows.slice(i, i + CONCURRENCY_LIMIT);
      const chunkResults = await Promise.all(chunk.map(async (row) => {
        const fileData = await getDicomFileHeader(row.ObjectFile);
        return { ...row, ...fileData };
      }));
      enhancedRows.push(...chunkResults);
    }

    // Analyze orientations and geometry for splitting mixed-plane/geometry series
    // DISABLE SMART SPLITTING TO FIX METADATA MISMATCH
    // The previous logic caused SeriesInstanceUID in Metadata to differ from QIDO,
    // causing Cornerstone to fail attaching metadata to imageIds.
    // For now, we trust the SeriesInstanceUID from DB/QIDO.
    
    // Map to DICOMweb JSON format
    const metadata = enhancedRows.map(row => {
      let seriesUID = row.SeriesInst;
      let seriesDesc = row.SeriesDesc;
      let seriesNumber = parseInt(row.SeriesNumb || '1'); 
      const modality = row.FileModality || row.Modality || 'OT'; 

      /* SMART SPLITTING DISABLED TEMPORARILY
      // Fix for Mixed Modality Series (CT/SC) breaking 3D
      const isSpatial = ['CT', 'MR', 'PT'].includes(modality);
      if (isSpatial && !row.ImagePositionPatient) {
          seriesUID = seriesUID + '.99';
          seriesDesc = (seriesDesc || '') + ' (Derived)';
          seriesNumber = (seriesNumber * 100) + 99; 
      }

      if (sopSuffixMap[row.SOPInstanc]) {
          const { suffix, index } = sopSuffixMap[row.SOPInstanc];
          seriesUID = seriesUID + suffix;
          seriesDesc = (seriesDesc || '') + ` (Split ${index})`;
          seriesNumber = (seriesNumber * 100) + index; 
      }
      */

      // Use DB values as primary source where possible (User instruction: use DB tables)
      const dbSamplesPerPixel = parseInt(row.SamplesPer) || 1;
      const dbPhotometric = row.PhotoMetri || 'MONOCHROME2';
      const dbBitsStored = parseInt(row.BitsStored) || 8;
      const dbBitsAllocated = dbBitsStored > 8 ? 16 : 8; // Infer from BitsStored
      const dbHighBit = dbBitsStored - 1;
      const dbRows = parseInt(row.QRows) || 512;
      const dbColumns = parseInt(row.QColumns) || 512;

      // Merge file header values with DB values (File header takes precedence if available, else DB)
      const valSamplesPerPixel = row.SamplesPerPixel || dbSamplesPerPixel;
      const valPhotometric = row.PhotometricInterpretation || dbPhotometric;
      const valBitsAllocated = row.BitsAllocated || dbBitsAllocated;
      const valBitsStored = row.BitsStored !== undefined ? parseInt(row.BitsStored) : dbBitsStored;
      const valHighBit = row.HighBit !== undefined ? row.HighBit : dbHighBit;
      const valPixelRepresentation = row.PixelRepresentation !== undefined ? row.PixelRepresentation : 0; // Default to unsigned
      const valRows = row.QRows ? parseInt(row.QRows) : dbRows; // row.QRows comes from DB in SQL query, but getDicomFileHeader doesn't read it, so it's safe.
      const valColumns = row.QColumns ? parseInt(row.QColumns) : dbColumns;

      const obj = {
        "00080018": { "vr": "UI", "Value": [row.SOPInstanc] }, // SOPInstanceUID
        "00080016": { "vr": "UI", "Value": [row.SOPClassUI] }, // SOPClassUID
        "0020000D": { "vr": "UI", "Value": [row.StudyInsta] }, // StudyInstanceUID
        "0020000E": { "vr": "UI", "Value": [seriesUID] }, // SeriesInstanceUID
        "00080060": { "vr": "CS", "Value": [modality] },   // Modality
        "0008103E": { "vr": "LO", "Value": [seriesDesc || ''] }, // SeriesDescription
        "00200011": { "vr": "IS", "Value": [String(seriesNumber)] }, // SeriesNumber
        "00200013": { "vr": "IS", "Value": [row.InstanceNumber || row.ImageNumbe || '1'] }, // InstanceNumber
        "00280010": { "vr": "US", "Value": [valRows] },      // Rows
        "00280011": { "vr": "US", "Value": [valColumns] },   // Columns
        "00280002": { "vr": "US", "Value": [valSamplesPerPixel] },
        "00280004": { "vr": "CS", "Value": [valPhotometric] },
        "00280100": { "vr": "US", "Value": [valBitsAllocated] },
        "00280101": { "vr": "US", "Value": [valBitsStored] },
        "00280102": { "vr": "US", "Value": [valHighBit] },
        "00280103": { "vr": "US", "Value": [valPixelRepresentation] },
        
        // Patient & Study Info (Added for Overlay)
        "00100010": { "vr": "PN", "Value": formatPNValue(row.PatientNam || row.FilePatientName) },
        "00100020": { "vr": "LO", "Value": [row.PatientID || row.FilePatientID] },
        "00100030": { "vr": "DA", "Value": [row.PatientBir] },
        "00100040": { "vr": "CS", "Value": [row.PatientSex] },
        "00080020": { "vr": "DA", "Value": [row.StudyDate] },
        "00080030": { "vr": "TM", "Value": [row.StudyTime] },
        "00200010": { "vr": "SH", "Value": [row.StudyID || ''] }, // StudyID
        "00080090": { "vr": "PN", "Value": formatPNValue(row.ReferPhysi) }, // ReferringPhysicianName
        "00080021": { "vr": "DA", "Value": [row.SeriesDate || row.StudyDate] }, // SeriesDate
        "00080031": { "vr": "TM", "Value": [row.SeriesTime || row.StudyTime] }, // SeriesTime
        "00080023": { "vr": "DA", "Value": [row.ImageDate || row.SeriesDate || row.StudyDate] }, // ContentDate
        "00080033": { "vr": "TM", "Value": [row.ImageTime || row.SeriesTime || row.StudyTime] }, // ContentTime
        "00081030": { "vr": "LO", "Value": [row.StudyDescr] },
        "00080050": { "vr": "SH", "Value": [row.AccessionN] },
        "00180015": { "vr": "CS", "Value": [row.BodyPartEx || ''] }, // BodyPartExamined
        "00181030": { "vr": "LO", "Value": [row.ProtocolNa || ''] }, // ProtocolName
        "00080008": { "vr": "CS", "Value": [row.ImageType ? row.ImageType.split('\\') : ['ORIGINAL', 'PRIMARY']] }, // ImageType
        
        // Geometry Tags (from file)
        "00201041": { "vr": "DS", "Value": [parseFloat(row.SliceLocat) || 0] }, // SliceLocation
        
        "00081190": { "vr": "UR", "Value": [`http://localhost:3000/api/dicom/wado?requestType=WADO&studyUID=${row.StudyInsta}&seriesUID=${row.SeriesInst}&objectUID=${row.SOPInstanc}`] }
      };

      if (row.ImagePositionPatient) obj["00200032"] = { "vr": "DS", "Value": row.ImagePositionPatient };
      if (row.ImageOrientationPatient) obj["00200037"] = { "vr": "DS", "Value": row.ImageOrientationPatient };
      if (row.PixelSpacing) obj["00280030"] = { "vr": "DS", "Value": row.PixelSpacing };
      if (row.SliceThickness !== undefined) obj["00180050"] = { "vr": "DS", "Value": [row.SliceThickness] };
      // Prefer file header FrameOfReferenceUID, fallback to DB
      if (row.FrameOfReferenceUID || row.FrameOfRef) obj["00200052"] = { "vr": "UI", "Value": [row.FrameOfReferenceUID || row.FrameOfRef] };
      
      if (row.WindowCenter && row.WindowWidth) {
         obj["00281050"] = { "vr": "DS", "Value": row.WindowCenter };
         obj["00281051"] = { "vr": "DS", "Value": row.WindowWidth };
      }
      
      if (row.RescaleIntercept !== undefined) {
          obj["00281052"] = { "vr": "DS", "Value": [row.RescaleIntercept] };
      } else if (modality === 'CT') {
          obj["00281052"] = { "vr": "DS", "Value": [0] }; // Safety default for CT
      }

      if (row.RescaleSlope !== undefined) {
          obj["00281053"] = { "vr": "DS", "Value": [row.RescaleSlope] };
      } else if (modality === 'CT') {
          obj["00281053"] = { "vr": "DS", "Value": [1] }; // Safety default for CT
      }

      return obj;
    });

    res.json(metadata);

  } catch (err) {
    console.error('Metadata Error:', err);
    res.status(500).json({ error: err.message });
  }
};

router.get('/studies/:studyUID/metadata', metadataHandler);
router.get('/rs/studies/:studyUID/metadata', metadataHandler); // Alias for RS path
router.get('/rs/studies/:studyUID/series/:seriesUID/metadata', metadataHandler); // Series level metadata

// GET /studies/:id/archive (Download Study as ZIP)
router.get('/studies/:id/archive', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 1. Get all instances of the study
    const [rows] = await pool.query('SELECT i.ObjectFile, i.SOPInstanc FROM dicomimages i JOIN dicomseries s ON i.SeriesInst = s.SeriesInst WHERE s.StudyInsta = ?', [id]);
    
    if (rows.length === 0) {
      return res.status(404).send('Study not found or empty');
    }

    // 2. Setup Zip Stream
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="study_${id}.zip"`);

    const archive = archiver('zip', {
      zlib: { level: 9 } // Sets the compression level.
    });

    archive.on('error', function(err) {
      console.error('Archiver Error:', err);
      if (!res.headersSent) res.status(500).send({error: err.message});
    });

    // Pipe archive data to the file
    archive.pipe(res);

    // 3. Add files
    for (const row of rows) {
         const relativePath = row.ObjectFile.replace(/\\/g, path.sep);
         const filePath = path.join(MAG0_PATH, relativePath);
         
         if (fs.existsSync(filePath)) {
             archive.file(filePath, { name: row.SOPInstanc + '.dcm' });
         }
    }

    await archive.finalize();

  } catch (err) {
    console.error('Archive Generation Error:', err);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

// POST /tools/find (Mocking Orthanc's tools/find for stats)
router.post('/tools/find', async (req, res) => {
  try {
    const { Level, Query, Expand } = req.body;
    
    if (Level !== 'Series') {
        return res.status(400).json({ error: 'Only Series level is supported for now' });
    }

    let query = 'SELECT * FROM dicomseries WHERE 1=1';
    const params = [];

    // Handle Date Range Query if present (e.g. StudyDate: '20230101-20231231')
    if (Query && Query.StudyDate) {
        const parts = Query.StudyDate.split('-');
        if (parts.length === 2) {
             // We need to join with dicomstudies to filter by StudyDate
             query = `
                SELECT s.* FROM dicomseries s
                JOIN dicomstudies st ON s.StudyInsta = st.StudyInsta
                WHERE st.StudyDate BETWEEN ? AND ?
             `;
             params.push(parts[0], parts[1]);
        }
    }

    const [rows] = await pool.query(query, params);

    // Map to format expected by stats.js
    const results = rows.map(row => ({
        MainDicomTags: {
            Modality: row.Modality
        },
        "0008,0060": {
            Value: [row.Modality]
        },
        Modality: row.Modality
    }));

    res.json(results);

  } catch (err) {
    console.error('Tools Find Error:', err);
    res.status(500).json({ error: err.message });
  }
});

export const conquestRouter = router;
