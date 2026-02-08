
import http from 'http';

function get(path) {
  return new Promise((resolve, reject) => {
    http.get({
      hostname: 'localhost',
      port: 3000,
      path: path,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function test() {
  try {
    const studyUID = '1.2.392.200036.9125.188036017160117176.65117450920.0.0.1';
    
    console.log('Testing WADO-RS Metadata Endpoint...');
    const metadataPath = `/api/dicom/rs/studies/${studyUID}/metadata`;
    const res = await get(metadataPath);
    
    try {
        const json = JSON.parse(res);
        console.log('Metadata Items:', json.length);
        if (json.length > 0) {
            const firstItem = json[0];
            console.log('PatientName (00100010):', JSON.stringify(firstItem['00100010'], null, 2));
            console.log('PatientID (00100020):', JSON.stringify(firstItem['00100020'], null, 2));
        }
    } catch (e) {
        console.log('Response not JSON:', res.substring(0, 200));
    }

  } catch (err) {
    console.error(err);
  }
}

test();
