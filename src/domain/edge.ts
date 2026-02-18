export interface LatLng {
  lat: number;
  lng: number;
}

export interface Cartesian {
    x: number
    y: number
}

export interface BoundingBox {
  min: LatLng;
  max: LatLng;
}

export interface Edge {
  id: string;

  coordinates: LatLng[];
  cartesian?: Cartesian[]
  
  length: number;
  bbox: BoundingBox

  surface?: string;
  name?: string;
}