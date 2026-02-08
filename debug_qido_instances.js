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
        console.log('Fetching Series...');
        const seriesList = await getJSON(`/api/dicom/rs/studies/${STUDY_UID}/series`);
        
        if (!seriesList || seriesList.length === 0) {
            console.error('No series found.');
            return;
        }

        const targetSeries = seriesList.find(s => s['00080060'] && s['00080060'].Value && s['00080060'].Value[0] === 'CT') || seriesList[0];
        const seriesUID = targetSeries['0020000E'].Value[0];
        console.log(`Targeting Series UID: ${seriesUID}`);

        console.log('Fetching Instances...');
        const instances = await getJSON(`/api/dicom/rs/studies/${STUDY_UID}/series/${seriesUID}/instances`);
        
        if (!instances || instances.length === 0) {
            console.error('No instances found.');
            return;
        }

        const firstInstance = instances[0];
        console.log('First Instance JSON keys:', Object.keys(firstInstance));
        console.log('First Instance JSON content:', JSON.stringify(firstInstance, null, 2));

        // Check for critical tags
        const criticalTags = {
            '00080018': 'SOPInstanceUID',
            '00080016': 'SOPClassUID',
            '0020000D': 'StudyInstanceUID',
            '0020000E': 'SeriesInstanceUID',
            '00080060': 'Modality'
        };

        console.log('\n--- Critical Tag Check ---');
        let allPresent = true;
        for (const [tag, name] of Object.entries(criticalTags)) {
            if (!firstInstance[tag] || !firstInstance[tag].Value) {
                console.error(`❌ Missing ${name} (${tag})`);
                allPresent = false;
            } else {
                console.log(`✅ ${name} (${tag}): ${firstInstance[tag].Value[0]}`);
            }
        }

        if (!allPresent) {
            console.log('\nResult: ❌ MISSING CRITICAL TAGS. This confirms the diagnosis.');
        } else {
            console.log('\nResult: ✅ All critical tags present.');
        }

    } catch (err) {
        console.error('Error:', err);
    }
}

run();
