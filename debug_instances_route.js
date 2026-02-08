
const BASE_URL = 'http://localhost:3000/api/dicom';
const SERIES_UID = '1.2.392.200036.9125.188036017160117176.65117450920.1.0.1'; 

async function check() {
    console.log(`Checking ${BASE_URL}/series/${SERIES_UID}/instances`);
    try {
        const res = await fetch(`${BASE_URL}/series/${SERIES_UID}/instances`);
        console.log(`Status: ${res.status}`);
        if (res.ok) {
            const json = await res.json();
            console.log('JSON length:', json.length);
        } else {
            console.log('Text:', await res.text());
        }
    } catch (e) {
        console.error(e);
    }
}

check();
