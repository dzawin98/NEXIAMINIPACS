# Panduan Integrasi OHIF Viewer & Produksi Komersial

Dokumen ini menjelaskan langkah-langkah untuk menghubungkan **MINIPACS Worklist** dengan **OHIF Viewer** (Port 5001) dan Backend (Port 3000) dalam lingkungan produksi.

## 1. Konfigurasi OHIF Viewer (app-config.js)

Agar OHIF Viewer (yang berjalan di port 5001) dapat mengambil data dari Backend MINIPACS, Anda perlu mengonfigurasi `dataSources` di file konfigurasi OHIF Anda (biasanya `platform/app/public/config/default.js` atau `app-config.js`).

Gunakan konfigurasi berikut:

```javascript
window.config = {
  routerBasename: '/',
  extensions: [],
  modes: [],
  showStudyList: false, // Kita menggunakan Worklist MINIPACS, bukan bawaan OHIF
  // ... setting lainnya
  
  dataSources: [
    {
      friendlyName: 'MINIPACS Backend',
      namespace: '@ohif/extension-default.dataSourcesModule.dicomweb',
      sourceName: 'dicomweb',
      configuration: {
        name: 'minipacs',
        // Arahkan ke Backend Node.js Anda
        wadoUriRoot: 'http://localhost:3000/api/dicom/wadouri',
        qidoRoot: 'http://localhost:3000/api/dicom/rs',
        wadoRoot: 'http://localhost:3000/api/dicom/rs',
        qidoSupportsIncludeField: true,
        imageRendering: 'wado-uri', // Gunakan 'wado-uri' atau 'wado-rs' (Backend mendukung keduanya sekarang)
        thumbnailRendering: 'wado-uri',
        enableStudyLazyLoad: true,
        supportsFuzzyMatching: true,
        supportsWildcard: true,
        // Konfigurasi DICOM metadata
        dicomUploadEnabled: false,
        singlepart: 'video', // Backend mengirim single part DICOM
        bulkDataURI: {
          enabled: false,
        },
      },
    },
  ],
  defaultDataSourceName: 'dicomweb',
};
```

### Pilihan Mode Rendering:
*   **`imageRendering: 'wado-uri'`**: Lebih stabil untuk backend sederhana. Mengambil seluruh file DICOM via endpoint `/wadouri`.
*   **`imageRendering: 'wado-rs'`**: Lebih modern. Mengambil metadata JSON lalu mengambil frame/instance via `/rs/...`. Backend telah diupdate untuk mendukung retrieval instance dasar.

## 2. Arsitektur Produksi (Commercial Grade)

Untuk deployment di Rumah Sakit, disarankan menggunakan arsitektur berikut:

### A. Server Setup
Gunakan **Nginx** sebagai Reverse Proxy di depan semua layanan untuk menangani SSL (HTTPS) dan Routing.

*   **Port 80/443 (Nginx)**:
    *   `/` -> Frontend Worklist (Port 8080 atau Static Build)
    *   `/viewer` -> OHIF Viewer (Port 5001 atau Static Build)
    *   `/api` -> Backend Node.js (Port 3000)
    *   `/dgate` -> Conquest (Opsional, jika akses langsung diperlukan)

### B. Keamanan (Security)
1.  **HTTPS**: Wajib untuk lingkungan medis.
2.  **Authentication**:
    *   Saat ini Worklist memiliki login.
    *   **Penting**: Pastikan API Backend (`/api/dicom`) dilindungi oleh Middleware Auth (JWT) di `server/index.js`.
    *   OHIF perlu mengirim token Auth. Anda dapat menambahkan header `Authorization` di konfigurasi OHIF:
    ```javascript
    // Di konfigurasi OHIF
    requestHooks: [
      function (request, xhr) {
        // Ambil token dari LocalStorage atau URL query param
        const token = ...; 
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        return request;
      }
    ]
    ```

### C. Backend Reliability
1.  **PM2**: Gunakan PM2 untuk menjalankan Backend Node.js agar auto-restart jika crash.
    ```bash
    npm install -g pm2
    pm2 start server/index.js --name "minipacs-backend"
    ```
2.  **Conquest**: Pastikan Conquest berjalan sebagai Service Windows.

## 3. Perubahan Code yang Telah Dilakukan

Saya telah melakukan update pada backend untuk mendukung integrasi ini:
1.  **Added WADO-RS Instance Support**: Menambahkan route di `server/routes/conquest.js` agar OHIF bisa mengambil file DICOM via protokol WADO-RS (`/rs/studies/.../instances/...`).
2.  **Updated Config**: Mengubah `src/lib/config.ts` agar Frontend menggunakan proxy `/pacs` yang benar mengarah ke Backend.

## 4. Cara Menjalankan Sekarang
1.  Pastikan Backend running: `npx nodemon server/index.js`
2.  Pastikan Frontend running: `npm run dev`
3.  Jalankan OHIF di project terpisah (Port 5001) dengan config di atas.
