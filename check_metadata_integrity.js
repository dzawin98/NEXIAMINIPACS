
// import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000/api/dicom/rs';
const STUDY_UID = '1.3.12.2.1107.5.1.4.77167.30000025101405264802200000048';

async function checkMetadataIntegrity() {
  try {
    console.log(`Fetching metadata for study ${STUDY_UID}...`);
    const response = await fetch(`${BASE_URL}/studies/${STUDY_UID}/metadata`);
    
    if (!response.ok) {
        console.error("Failed to fetch metadata:", response.status, response.statusText);
        return;
    }

    const instances = await response.json();
    console.log(`Total instances: ${instances.length}`);

    let missingModalityCount = 0;
    let undefinedModalityValueCount = 0;
    let missingSOPClass = 0;
    
    instances.forEach((inst, idx) => {
        const sop = inst['00080018']?.Value?.[0] || 'Unknown';
        const modalityTag = inst['00080060'];
        
        if (!modalityTag) {
            console.error(`[${idx}] Missing Modality Tag (00080060) for SOP: ${sop}`);
            missingModalityCount++;
        } else {
            const val = modalityTag.Value?.[0];
            if (val === undefined || val === null || val === '') {
                console.error(`[${idx}] Undefined/Null Modality Value for SOP: ${sop}. Value:`, modalityTag.Value);
                undefinedModalityValueCount++;
            }
        }

        if (!inst['00080016']?.Value?.[0]) {
             console.error(`[${idx}] Missing SOPClassUID (00080016) for SOP: ${sop}`);
             missingSOPClass++;
        }
    });

    console.log("Summary:");
    console.log(`  Missing Modality Tag: ${missingModalityCount}`);
    console.log(`  Undefined Modality Value: ${undefinedModalityValueCount}`);
    console.log(`  Missing SOPClassUID: ${missingSOPClass}`);

  } catch (err) {
    console.error('Error:', err);
  }
}

checkMetadataIntegrity();
