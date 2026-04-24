export interface IOAE {
  id: string;
  name: string;
  bimModelUrl: string;
}

export interface IDetection {
  id: string;
  class_name: string;
  confidence: number;
  box: { x1: number; y1: number; x2: number; y2: number };
  maintenanceAt?: string;
  maintenanceResponsible?: string;
  maintenanceNotes?: string;
  maintenanceCost?: number;
  status?: 'pending' | 'resolved';
}

export interface IGeoDetection {
  id: string;
  class_name: string;
  confidence: number;
  pixel_box: { x1: number; y1: number; x2: number; y2: number };
  geo_box: { lat1: number; lon1: number; lat2: number; lon2: number };
  center: { lat: number; lon: number };
  maintenanceAt?: string;
  maintenanceResponsible?: string;
  maintenanceNotes?: string;
  maintenanceCost?: number;
  status?: 'pending' | 'resolved';
}

export interface IImage {
  url: string;
  detections?: IDetection[];
}

export interface IOrthoResult {
  url: string;
  previewUrl?: string;
  detections: IGeoDetection[];
}

// Nova interface IInspection (substitui IFolder)
export interface IInspection {
  id: string; 
  inspectionType: string;
  inspectionObjective: string;
  inspectionDate: string;
  inspectionResponsible: string;
  images: IImage[];
  orthoResults?: IOrthoResult[];
}

export interface IProject {
  id: string;
  userId: string;
  name: string;
  address: string;
  type: string;
  responsible: string;
  coverImageUrl: string;
  modules: {
    progress: boolean;
    security: boolean;
    maintenance: boolean;
  };
  bimModelUrl: string;
  oae?: IOAE[];
  omniverseLink?: string;
  processedImages?: string[];
  buildingYear?: string;
  builtArea?: string;
  facadeTypology?: string;
  roofTypology?: string;
  buildingAcronym?: string;
  unitDirector?: string;
  inspections?: IInspection[];
}
