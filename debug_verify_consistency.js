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
                    console.error('Error parsing JSON:', data.substring(0, 200));
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

async function run() {
    try {
        console.log('1. Fetching Series...');
        const seriesList = await getJSON(`/api/dicom/rs/studies/${STUDY_UID}/series`);
        const targetSeries = seriesList.find(s => s['00080060'] && s['00080060'].Value && s['00080060'].Value[0] === 'CT') || seriesList[0];
        const seriesUID = targetSeries['0020000E'].Value[0];
        console.log(`Targeting Series UID: ${seriesUID}`);

        console.log('2. Fetching QIDO Instances...');
        const qidoInstances = await getJSON(`/api/dicom/rs/studies/${STUDY_UID}/series/${seriesUID}/instances`);
        const qidoInstance = qidoInstances[0];
        const qidoSOPUID = qidoInstance['00080018'].Value[0];
        console.log(`QIDO SOPInstanceUID: ${qidoSOPUID}`);

        console.log('3. Fetching WADO Metadata...');
        const wadoMetadata = await getJSON(`/api/dicom/rs/studies/${STUDY_UID}/series/${seriesUID}/metadata`);
        
        // Find the same instance in metadata
        const wadoInstance = wadoMetadata.find(inst => inst['00080018'].Value[0] === qidoSOPUID);
        
        if (!wadoInstance) {
            console.error('❌ Mismatch! QIDO instance not found in WADO metadata.');
            return;
        }
        
        const wadoSOPUID = wadoInstance['00080018'].Value[0];
        console.log(`WADO SOPInstanceUID: ${wadoSOPUID}`);

        if (qidoSOPUID === wadoSOPUID) {
            console.log('✅ UID Consistency Verified.');
        } else {
            console.error('❌ UID Mismatch!');
        }

        console.log('\n--- Comparing Critical Tags ---');
        const tags = ['00080016', '0020000D', '0020000E', '00080060'];
        for (const tag of tags) {
            const qVal = qidoInstance[tag]?.Value?.[0];
            const wVal = wadoInstance[tag]?.Value?.[0];
            if (qVal === wVal) {
                console.log(`✅ Tag ${tag} matches: ${qVal}`);
            } else {
                console.error(`❌ Tag ${tag} mismatch! QIDO: ${qVal}, WADO: ${wVal}`);
            }
        }

    } catch (err) {
        console.error('Error:', err);
    }
}

run();
