export interface Study {
  id: string;
  orthancId: string;
  patientName: string;
  patientId: string;
  accessionNumber: string;
  modality: string;
  studyDescription: string;
  studyDate: string;
  studyTime: string;
  seriesCount: number;
  instanceCount: number;
  institution: string;
  referringPhysician: string;
  status: 'new' | 'in-progress' | 'completed' | 'urgent';
  patientBirthDate?: string;
  patientSex?: string;
  studyInstanceUID: string;
}

export interface Series {
  id: string;
  seriesDescription: string;
  modality: string;
  seriesNumber: number;
  instanceCount: number;
  bodyPart?: string;
  seriesInstanceUID: string;
}

// Mock studies data
export const mockStudies: Study[] = [
  {
    id: '1',
    orthancId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    patientName: 'SMITH^JOHN^A',
    patientId: 'PAT001',
    accessionNumber: 'ACC2024001',
    modality: 'CT',
    studyDescription: 'CT CHEST WITH CONTRAST',
    studyDate: '2024-01-15',
    studyTime: '09:30:00',
    seriesCount: 4,
    instanceCount: 312,
    institution: 'General Hospital',
    referringPhysician: 'Dr. Williams',
    status: 'new',
    patientBirthDate: '1965-03-22',
    patientSex: 'M',
    studyInstanceUID: '1.2.840.113619.2.55.3.604688119.969.1234567890.123',
  },
  {
    id: '2',
    orthancId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    patientName: 'JOHNSON^MARY^E',
    patientId: 'PAT002',
    accessionNumber: 'ACC2024002',
    modality: 'MR',
    studyDescription: 'MRI BRAIN WITHOUT CONTRAST',
    studyDate: '2024-01-15',
    studyTime: '10:15:00',
    seriesCount: 6,
    instanceCount: 180,
    institution: 'General Hospital',
    referringPhysician: 'Dr. Thompson',
    status: 'in-progress',
    patientBirthDate: '1978-07-14',
    patientSex: 'F',
    studyInstanceUID: '1.2.840.113619.2.55.3.604688119.969.1234567890.124',
  },
  {
    id: '3',
    orthancId: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
    patientName: 'WILLIAMS^ROBERT^J',
    patientId: 'PAT003',
    accessionNumber: 'ACC2024003',
    modality: 'CR',
    studyDescription: 'CHEST PA AND LATERAL',
    studyDate: '2024-01-15',
    studyTime: '11:00:00',
    seriesCount: 2,
    instanceCount: 2,
    institution: 'City Medical Center',
    referringPhysician: 'Dr. Davis',
    status: 'completed',
    patientBirthDate: '1952-11-08',
    patientSex: 'M',
    studyInstanceUID: '1.2.840.113619.2.55.3.604688119.969.1234567890.125',
  },
  {
    id: '4',
    orthancId: 'd4e5f6a7-b8c9-0123-defa-234567890123',
    patientName: 'BROWN^SARAH^L',
    patientId: 'PAT004',
    accessionNumber: 'ACC2024004',
    modality: 'US',
    studyDescription: 'ULTRASOUND ABDOMEN COMPLETE',
    studyDate: '2024-01-14',
    studyTime: '14:30:00',
    seriesCount: 3,
    instanceCount: 45,
    institution: 'General Hospital',
    referringPhysician: 'Dr. Miller',
    status: 'urgent',
    patientBirthDate: '1990-05-30',
    patientSex: 'F',
    studyInstanceUID: '1.2.840.113619.2.55.3.604688119.969.1234567890.126',
  },
  {
    id: '5',
    orthancId: 'e5f6a7b8-c9d0-1234-efab-345678901234',
    patientName: 'DAVIS^MICHAEL^T',
    patientId: 'PAT005',
    accessionNumber: 'ACC2024005',
    modality: 'CT',
    studyDescription: 'CT ABDOMEN PELVIS WITH CONTRAST',
    studyDate: '2024-01-14',
    studyTime: '15:45:00',
    seriesCount: 5,
    instanceCount: 520,
    institution: 'Regional Medical',
    referringPhysician: 'Dr. Anderson',
    status: 'new',
    patientBirthDate: '1975-09-12',
    patientSex: 'M',
    studyInstanceUID: '1.2.840.113619.2.55.3.604688119.969.1234567890.127',
  },
  {
    id: '6',
    orthancId: 'f6a7b8c9-d0e1-2345-fabc-456789012345',
    patientName: 'GARCIA^ELENA^M',
    patientId: 'PAT006',
    accessionNumber: 'ACC2024006',
    modality: 'MR',
    studyDescription: 'MRI LUMBAR SPINE WITHOUT CONTRAST',
    studyDate: '2024-01-14',
    studyTime: '08:00:00',
    seriesCount: 7,
    instanceCount: 210,
    institution: 'General Hospital',
    referringPhysician: 'Dr. Martinez',
    status: 'completed',
    patientBirthDate: '1968-12-03',
    patientSex: 'F',
    studyInstanceUID: '1.2.840.113619.2.55.3.604688119.969.1234567890.128',
  },
  {
    id: '7',
    orthancId: 'a7b8c9d0-e1f2-3456-abcd-567890123456',
    patientName: 'MARTINEZ^CARLOS^R',
    patientId: 'PAT007',
    accessionNumber: 'ACC2024007',
    modality: 'XA',
    studyDescription: 'CARDIAC CATHETERIZATION',
    studyDate: '2024-01-13',
    studyTime: '11:30:00',
    seriesCount: 8,
    instanceCount: 1250,
    institution: 'Heart Center',
    referringPhysician: 'Dr. Lee',
    status: 'completed',
    patientBirthDate: '1960-04-18',
    patientSex: 'M',
    studyInstanceUID: '1.2.840.113619.2.55.3.604688119.969.1234567890.129',
  },
  {
    id: '8',
    orthancId: 'b8c9d0e1-f2a3-4567-bcde-678901234567',
    patientName: 'ANDERSON^LISA^K',
    patientId: 'PAT008',
    accessionNumber: 'ACC2024008',
    modality: 'MG',
    studyDescription: 'MAMMOGRAM BILATERAL SCREENING',
    studyDate: '2024-01-13',
    studyTime: '09:00:00',
    seriesCount: 4,
    instanceCount: 8,
    institution: 'Womens Health Center',
    referringPhysician: 'Dr. Wilson',
    status: 'in-progress',
    patientBirthDate: '1972-08-25',
    patientSex: 'F',
    studyInstanceUID: '1.2.840.113619.2.55.3.604688119.969.1234567890.130',
  },
  {
    id: '9',
    orthancId: 'c9d0e1f2-a3b4-5678-cdef-789012345678',
    patientName: 'THOMAS^DAVID^W',
    patientId: 'PAT009',
    accessionNumber: 'ACC2024009',
    modality: 'PT',
    studyDescription: 'PET CT WHOLE BODY ONCOLOGY',
    studyDate: '2024-01-12',
    studyTime: '13:00:00',
    seriesCount: 12,
    instanceCount: 890,
    institution: 'Cancer Center',
    referringPhysician: 'Dr. Clark',
    status: 'urgent',
    patientBirthDate: '1955-01-10',
    patientSex: 'M',
    studyInstanceUID: '1.2.840.113619.2.55.3.604688119.969.1234567890.131',
  },
  {
    id: '10',
    orthancId: 'd0e1f2a3-b4c5-6789-defa-890123456789',
    patientName: 'JACKSON^AMANDA^R',
    patientId: 'PAT010',
    accessionNumber: 'ACC2024010',
    modality: 'NM',
    studyDescription: 'BONE SCAN WHOLE BODY',
    studyDate: '2024-01-12',
    studyTime: '10:30:00',
    seriesCount: 3,
    instanceCount: 128,
    institution: 'General Hospital',
    referringPhysician: 'Dr. Harris',
    status: 'new',
    patientBirthDate: '1983-06-20',
    patientSex: 'F',
    studyInstanceUID: '1.2.840.113619.2.55.3.604688119.969.1234567890.132',
  },
];

// Mock series data for a study
export const getMockSeriesForStudy = (studyId: string): Series[] => {
  const baseSeries: Series[] = [
    {
      id: `${studyId}-s1`,
      seriesDescription: 'LOCALIZER',
      modality: 'CT',
      seriesNumber: 1,
      instanceCount: 3,
      bodyPart: 'CHEST',
      seriesInstanceUID: `1.2.840.113619.2.55.3.${studyId}.1`,
    },
    {
      id: `${studyId}-s2`,
      seriesDescription: 'AXIAL 5MM',
      modality: 'CT',
      seriesNumber: 2,
      instanceCount: 120,
      bodyPart: 'CHEST',
      seriesInstanceUID: `1.2.840.113619.2.55.3.${studyId}.2`,
    },
    {
      id: `${studyId}-s3`,
      seriesDescription: 'AXIAL 1.25MM',
      modality: 'CT',
      seriesNumber: 3,
      instanceCount: 480,
      bodyPart: 'CHEST',
      seriesInstanceUID: `1.2.840.113619.2.55.3.${studyId}.3`,
    },
    {
      id: `${studyId}-s4`,
      seriesDescription: 'CORONAL MPR',
      modality: 'CT',
      seriesNumber: 4,
      instanceCount: 60,
      bodyPart: 'CHEST',
      seriesInstanceUID: `1.2.840.113619.2.55.3.${studyId}.4`,
    },
  ];

  return baseSeries;
};

export const modalityOptions = [
  'All Modalities',
  'CT',
  'MR',
  'CR',
  'DX',
  'US',
  'XA',
  'MG',
  'PT',
  'NM',
  'RF',
  'OT',
];
