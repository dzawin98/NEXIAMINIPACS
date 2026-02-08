# MiniPACS Integration Guide for HIS/SIMRS

**Version:** 1.0.0  
**Date:** 2026-02-02  
**Confidentiality:** Commercial & Confidential

---

## 1. Overview
This document provides the technical specifications for integrating the Hospital Information System (SIMRS) with the **MiniPACS Server**. It outlines the API endpoints and URL patterns required to:
- Retrieve patient study lists.
- Launch the medical image viewer directly from SIMRS.
- Integrate with Modality Worklist (MWL) services (optional).

## 2. Authentication & Security
Access to the MiniPACS API requires authentication via an API Key or secure token exchange.

- **Base URL:** `https://{pacs-server-ip}/api/v1`
- **Authentication Header:**
  ```http
  Authorization: Bearer {YOUR_API_TOKEN}
  ```

> **Note:** For simple URL launching (viewer integration), a signed URL or IP whitelisting approach is recommended to simplify the doctor's workflow.

---

## 3. Viewer Integration (Deep Linking)
To allow doctors to view images directly from the Electronic Medical Record (EMR/SIMRS), use the following URL pattern. This opens the MiniPACS Viewer in a new browser tab.

### 3.1. Launch by Study Instance UID
Directly open a specific study using its unique DICOM Study Instance UID.

**URL Pattern:**
```
https://{pacs-server-ip}/viewer?StudyInstanceUIDs={StudyInstanceUID}
```

**Example:**
```
https://pacs.hospital.com/viewer?StudyInstanceUIDs=1.2.840.113619.2.55.3.4271045733.996
```

### 3.2. Launch by Accession Number (Recommended)
Since SIMRS typically tracks the Accession Number (Order ID), this is the most common integration method.

**URL Pattern:**
```
https://{pacs-server-ip}/viewer?AccessionNumber={AccessionNumber}
```

### 3.3. Launch by Patient ID
Opens the study list for a specific patient.

**URL Pattern:**
```
https://{pacs-server-ip}/worklist?patientId={PatientID}
```

---

## 4. API Reference (RESTful)

### 4.1. Search Studies
Search for stored imaging studies to display history in SIMRS.

**Endpoint:** `GET /studies`

**Query Parameters:**
| Parameter | Type | Description |
| :--- | :--- | :--- |
| `PatientID` | string | Medical Record Number (MRN) |
| `PatientName` | string | Patient's name (supports partial match) |
| `AccessionNumber` | string | Order ID |
| `StudyDate` | string | Format: YYYYMMDD or YYYYMMDD-YYYYMMDD |
| `limit` | integer | Max results (default: 100) |

**Response Example:**
```json
{
  "data": [
    {
      "studyInstanceUid": "1.2.840...",
      "accessionNumber": "ACC12345",
      "patientId": "001234",
      "patientName": "DOE^JOHN",
      "studyDate": "20240125",
      "modality": "CT",
      "description": "CT HEAD NON CONTRAST",
      "viewerUrl": "https://pacs.hospital.com/viewer?StudyInstanceUIDs=1.2.840..."
    }
  ],
  "total": 1
}
```

---

## 5. DICOM Services (Modality Integration)

MiniPACS provides standard DICOM services for modalities (CT, MRI, CR, US) and other PACS nodes.

### 5.1. Connectivity Details
- **AE Title:** `MINIPACS` (Default, configurable)
- **Port:** `104` or `11112`
- **IP Address:** `{pacs-server-ip}`

### 5.2. Supported SOP Classes
MiniPACS acts as a Service Class Provider (SCP) for the following:
- **Verification SOP Class (C-ECHO):** Connectivity check.
- **Storage SOP Class (C-STORE):** Receiving images from modalities.
- **Query/Retrieve SOP Class (C-FIND, C-MOVE):** Querying and retrieving studies.

### 5.3. Modality Worklist (MWL)
MiniPACS can serve as a Modality Worklist Provider, feeding patient/order data from SIMRS to the modalities.
- **MWL AE Title:** `MINIPACS_MWL`
- **Port:** `104`

---

## 6. Support
For technical assistance regarding integration, please contact:

**MiniPACS Technical Support**
- **Email:** support@minipacs.com
- **Phone:** +62-8XX-XXXX-XXXX
