# DICOM Conformance Statement

**Product Name:** MiniPACS Server  
**Version:** 2.0  
**Date:** 2026-02-02

---

## 1. Introduction
This DICOM Conformance Statement specifies the DICOM capabilities of the **MiniPACS Server**. The system provides storage, query, and retrieval services for medical imaging modalities and workstations.

## 2. Implementation Model

### 2.1 Application Data Flow
The MiniPACS Server Application Entity (AE) receives DICOM images from remote AEs (modalities) via the C-STORE operation. It stores these images in its internal database and filesystem. It also responds to query (C-FIND) and retrieve (C-MOVE) requests from remote AEs.

### 2.2 Functional Definition of AE
The **MINIPACS** AE waits for association requests at the TCP/IP port 104 (configurable). It accepts associations for:
- Verification (C-ECHO)
- Storage (C-STORE)
- Query (C-FIND)
- Retrieval (C-MOVE)

## 3. AE Specifications

### 3.1 MINIPACS AE Specification

#### 3.1.1 SOP Classes Supported
This Application Entity provides Standard Conformance to the following SOP Classes:

| SOP Class Name | SOP Class UID | SCU | SCP |
| :--- | :--- | :---: | :---: |
| Verification SOP Class | 1.2.840.10008.1.1 | No | **Yes** |
| CT Image Storage | 1.2.840.10008.5.1.4.1.1.2 | No | **Yes** |
| MR Image Storage | 1.2.840.10008.5.1.4.1.1.4 | No | **Yes** |
| Ultrasound Image Storage | 1.2.840.10008.5.1.4.1.1.6.1 | No | **Yes** |
| Secondary Capture Image Storage | 1.2.840.10008.5.1.4.1.1.7 | No | **Yes** |
| X-Ray Angiographic Image Storage | 1.2.840.10008.5.1.4.1.1.12.1 | No | **Yes** |
| Computed Radiography Image Storage | 1.2.840.10008.5.1.4.1.1.1 | No | **Yes** |
| Digital X-Ray Image Storage | 1.2.840.10008.5.1.4.1.1.1.1 | No | **Yes** |
| Study Root Q/R Information Model - FIND | 1.2.840.10008.5.1.4.1.2.2.1 | No | **Yes** |
| Study Root Q/R Information Model - MOVE | 1.2.840.10008.5.1.4.1.2.2.2 | No | **Yes** |

*(Note: Full list of supported SOP Classes covers all standard image storage types)*

#### 3.1.2 Association Policies
- **General:** The maximum PDU size offered is 16384 bytes (configurable).
- **Number of Associations:** Maximum 50 simultaneous associations (configurable).
- **Asynchronous Nature:** Not supported.
- **Implementation Identifying Information:**
  - Implementation Class UID: `1.2.276.0.7230010.3.0.3.6.4` (Generic)
  - Implementation Version Name: `MINIPACS_2_0`

#### 3.1.3 Association Acceptance Policy
The MINIPACS AE accepts associations from any calling AE Title (promiscuous mode) by default, or can be configured to accept only from a whitelist of known AEs.

## 4. Communication Profiles
- **TCP/IP Stack:** Inherited from the underlying operating system (Windows/Linux).
- **Physical Media Support:** Ethernet 100/1000 BaseT.

## 5. Extensions / Specializations / Privatizations
No private SOP Classes or Transfer Syntaxes are used. Standard DICOM 3.0 only.

## 6. Configuration
The following parameters are configurable:
- AE Title (Default: `MINIPACS`)
- TCP Port (Default: `104` or `4242`)
- Storage directory path
- Maximum number of associations
- PDU Size

---
*End of Document*
