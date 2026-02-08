import http from 'http';

const STUDY_UID = '1.3.12.2.1107.5.1.4.77167.30000025101405264802200000048';

function getJSON(path) {
    return new Promise((resolve, reject) => {
        http.get({
            hostname: 'localhost',
            port: 3000,
            path: path,
            headers: { 'Accept': 'application/json' }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    console.error(`Error parsing JSON from ${path}:`, data.substring(0, 200));
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

function checkFrameHeader(path) {
    return new Promise((resolve, reject) => {
        http.get({
            hostname: 'localhost',
            port: 3000,
            path: path
        }, (res) => {
            res.resume(); // Consume data to free memory
            resolve(res.headers);
        }).on('error', reject);
    });
}

async function run() {
    try {
        console.log('1. Fetching Series...');
        const seriesList = await getJSON(`/api/dicom/rs/studies/${STUDY_UID}/series`);
        
        // Find CT Series
        const targetSeries = seriesList.find(s => s['00080060'] && s['00080060'].Value && s['00080060'].Value[0] === 'CT') || seriesList[0];
        const seriesUID = targetSeries['0020000E'].Value[0];
        console.log(`Targeting Series UID: ${seriesUID}`);

        console.log('2. Fetching QIDO Instances...');
        const qidoInstances = await getJSON(`/api/dicom/rs/studies/${STUDY_UID}/series/${seriesUID}/instances`);
        const qidoInstance = qidoInstances[0];
        const qidoSOPUID = qidoInstance['00080018'].Value[0];
        const qidoSeriesUID = qidoInstance['0020000E'].Value[0];
        
        console.log(`[QIDO] SOPInstanceUID: ${qidoSOPUID}`);
        console.log(`[QIDO] SeriesInstanceUID: ${qidoSeriesUID}`);

        console.log('3. Fetching WADO Metadata...');
        const wadoMetadata = await getJSON(`/api/dicom/rs/studies/${STUDY_UID}/series/${seriesUID}/metadata`);
        
        // Find matching instance
        const wadoInstance = wadoMetadata.find(inst => inst['00080018'].Value[0] === qidoSOPUID);
        
        if (!wadoInstance) {
            console.error('❌ Mismatch! QIDO instance not found in WADO metadata.');
        } else {
            const wadoSOPUID = wadoInstance['00080018'].Value[0];
            const wadoSeriesUID = wadoInstance['0020000E'].Value[0];
            
            console.log(`[WADO] SOPInstanceUID: ${wadoSOPUID}`);
            console.log(`[WADO] SeriesInstanceUID: ${wadoSeriesUID}`);
            
            if (qidoSeriesUID !== wadoSeriesUID) {
                console.error(`\n🚨 CRITICAL MISMATCH DETECTED! 🚨`);
                console.error(`QIDO SeriesUID: ${qidoSeriesUID}`);
                console.error(`WADO SeriesUID: ${wadoSeriesUID}`);
                console.error(`Diagnosis: Smart Splitting logic in Metadata endpoint is changing SeriesUID, causing Cornerstone to fail mapping!`);
            } else {
                console.log(`✅ SeriesUID matches.`);
            }

            console.log('\n--- Checking Pixel Data Tags (WADO) ---');
            const pixelTags = {
                '00280010': 'Rows',
                '00280011': 'Columns',
                '00280100': 'BitsAllocated',
                '00280101': 'BitsStored',
                '00280102': 'HighBit',
                '00280103': 'PixelRepresentation',
                '00280030': 'PixelSpacing',
                '00200037': 'ImageOrientationPatient',
                '00200032': 'ImagePositionPatient'
            };

            for (const [tag, name] of Object.entries(pixelTags)) {
                if (wadoInstance[tag] && wadoInstance[tag].Value) {
                    console.log(`✅ ${name} (${tag}): Present`);
                } else {
                    console.error(`❌ ${name} (${tag}): MISSING in Metadata!`);
                }
            }
        }

        console.log('\n4. Checking Frame Request Header...');
        // Note: conquest.js implementation of single frame retrieval
        // Assuming path /rs/studies/.../series/.../instances/.../frames/1 (if implemented)
        // Or WADO-URI
        
        // Let's check the URL provided in QIDO
        const wadoUriUrl = qidoInstance['00081190'].Value[0];
        console.log(`WADO-URI URL: ${wadoUriUrl}`);
        
        // Parse the URL to get path for http.get
        const urlObj = new URL(wadoUriUrl);
        const headers = await checkFrameHeader(urlObj.pathname + urlObj.search);
        console.log('Response Content-Type:', headers['content-type']);
        
        if (headers['content-type'] !== 'application/dicom' && !headers['content-type'].includes('multipart')) {
             console.warn('⚠️ Warning: Content-Type might be problematic for OHIF if not application/dicom or multipart.');
        }

    } catch (err) {
        console.error('Error:', err);
    }
}

run();
