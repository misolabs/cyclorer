import { Feature, FeatureCollection, LineString } from "geojson";

// Bounding box in GeoJSON
export type GeoJsonBBox = [minLon: number, minLat: number, maxLon: number, maxLat: number];

// Edge properties we care about
export interface EdgeProperties {
    u: number
    v: number
    osmid: string;
    name?: string;

    length?: number;
    bbox: GeoJsonBBox

    ride_count: number
    deadend: boolean
}

export type GeoJsonRoutingEdge = Feature<LineString, EdgeProperties>;
export type GeoJsonRoutingCollection = FeatureCollection<LineString, EdgeProperties>
