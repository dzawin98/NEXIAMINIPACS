
// import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000/api/dicom/rs';
const STUDY_UID = '1.3.12.2.1107.5.1.4.77167.30000025101405264802200000048'; // Use the study from previous context

async function debugMetadata() {
  try {
    console.log(`Fetching metadata for study ${STUDY_UID}...`);
    const response = await fetch(`${BASE_URL}/studies/${STUDY_UID}/metadata`);
    
    if (!response.ok) {
        console.error('Failed to fetch:', response.status, response.statusText);
        return;
    }

    const json = await response.json();
    console.log(`Received ${json.length} instances.`);

    const seriesMap = {};
    const missingPos = [];
    const missingOrient = [];

    json.forEach(inst => {
        const seriesUID = inst['0020000E'].Value[0];
        const sopUID = inst['00080018'].Value[0];
        const modality = inst['00080060']?.Value?.[0];
        
        if (!seriesMap[seriesUID]) {
            seriesMap[seriesUID] = { 
                count: 0, 
                modalities: new Set(), 
                orientations: new Set(),
                spacings: new Set(),
                thicknesses: new Set(),
                dims: new Set(),
                seriesNumbers: new Set(),
                positions: [],
                firstInstance: inst
            };
        }
        seriesMap[seriesUID].count++;
        if (modality) seriesMap[seriesUID].modalities.add(modality);

        const ipp = inst['00200032'];
        const iop = inst['00200037'];

        if (!ipp) missingPos.push(sopUID);
        if (!iop) missingOrient.push(sopUID);
        
        const seriesNo = inst['00200011']?.Value?.[0];
        if (seriesNo) seriesMap[seriesUID].seriesNumbers.add(seriesNo);
        
        const rows = inst['00280010']?.Value?.[0];
        const cols = inst['00280011']?.Value?.[0];
        if (rows && cols) seriesMap[seriesUID].dims.add(`${rows}x${cols}`);

        if (iop) {
            seriesMap[seriesUID].orientations.add(iop.Value.join(','));
        }
        
        // Track spacing and thickness
        const spacing = inst['00280030']?.Value;
        const thickness = inst['00180050']?.Value;
        if (spacing) seriesMap[seriesUID].spacings.add(spacing.join(','));
        if (thickness) seriesMap[seriesUID].thicknesses.add(thickness[0]);
        
        if (ipp) {
             seriesMap[seriesUID].positions.push(ipp.Value);
        }
    });

    console.log('Series Summary:');
    Object.keys(seriesMap).forEach(uid => {
        const s = seriesMap[uid];
        console.log(`Series ${uid}:`);
         console.log(`  Count: ${s.count}`);
         console.log(`  Series No: ${Array.from(s.seriesNumbers).join(', ')}`);
         console.log(`  Modalities: ${Array.from(s.modalities).join(', ')}`);
        console.log(`  Unique Orientations: ${s.orientations.size}`);
         console.log(`  Unique Dims: ${s.dims.size} (${Array.from(s.dims).join(' | ')})`);
         console.log(`  Unique Spacings: ${s.spacings.size} (${Array.from(s.spacings).join(' | ')})`);
        console.log(`  Unique Thicknesses: ${s.thicknesses.size} (${Array.from(s.thicknesses).join(' | ')})`);
        
        const first = s.firstInstance;
        if (!first) {
            console.log('  ERROR: firstInstance is undefined!');
            return;
        }
        // console.log('First instance keys:', Object.keys(first));
        
        console.log(`  PixelRepresentation: ${first['00280103']?.Value?.[0]}`);
        console.log(`  BitsStored: ${first['00280101']?.Value?.[0]}`);
        console.log(`  HighBit: ${first['00280102']?.Value?.[0]}`);
        console.log(`  SamplesPerPixel: ${first['00280002']?.Value?.[0]}`);
        console.log(`  RescaleIntercept: ${first['00281052']?.Value?.[0]}`);
        console.log(`  RescaleSlope: ${first['00281053']?.Value?.[0]}`);
        
        // Check z-spacing uniformity (rough check)
        if (s.positions.length > 1) {
            // Sort by Z (assuming axial for now, but dot product is better)
            // Just checking distance between sorted projections
            // Simple approach: calculate distance between consecutive slices
            // This requires orientation. Assuming first orientation.
            const orient = s.orientations.values().next().value;
            if (orient) {
                const [rx, ry, rz, cx, cy, cz] = orient.split(',').map(Number);
                const normal = [
                    ry * cz - rz * cy,
                    rz * cx - rx * cz,
                    rx * cy - ry * cx
                ];
                
                const projected = s.positions.map(p => {
                    return p[0]*normal[0] + p[1]*normal[1] + p[2]*normal[2];
                }).sort((a,b) => a-b);
                
                const diffs = [];
                for(let i=0; i<projected.length-1; i++) {
                    diffs.push(projected[i+1] - projected[i]);
                }
                
                // Check consistency
                const avg = diffs.reduce((a,b)=>a+b,0)/diffs.length;
                const min = Math.min(...diffs);
                const max = Math.max(...diffs);
                console.log(`  Spacing (calc): Avg=${avg.toFixed(3)}, Min=${min.toFixed(3)}, Max=${max.toFixed(3)}`);
                if (max - min > 0.01) console.log(`  WARNING: Non-uniform spacing!`);
            }
        }

        if (s.orientations.size > 1) {
            console.log(`  WARNING: Multiple orientations:`);
            s.orientations.forEach(o => console.log(`    [${o}]`));
        }
    });

    if (missingPos.length > 0) console.log(`Instances missing ImagePositionPatient: ${missingPos.length}`);
    if (missingOrient.length > 0) console.log(`Instances missing ImageOrientationPatient: ${missingOrient.length}`);

  } catch (err) {
    console.error('Error:', err);
  }
}

debugMetadata();
