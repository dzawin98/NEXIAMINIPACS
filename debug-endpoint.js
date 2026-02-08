
import axios from 'axios';

async function testEndpoint() {
  try {
    console.log('Fetching /api/dicom/studies...');
    const res = await axios.get('http://localhost:3000/api/dicom/studies?expand');
    console.log('Status:', res.status);
    console.log('Data length:', res.data.length);
  } catch (err) {
    console.log('Error Status:', err.response?.status);
    console.log('Error Data:', err.response?.data);
    console.log('Error Message:', err.message);
  }
}

testEndpoint();
