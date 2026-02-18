import { GeoJsonEdge, GeoJsonBBox } from "../domain/geo";
import { Edge, LatLng, BoundingBox } from "../domain/edge";


export function mapBBox(bbox: GeoJsonBBox): BoundingBox {
  // tuple destructuring
  const [minLon, minLat, maxLon, maxLat] = bbox;

  return {
    min: { lat: minLat, lng: minLon },
    max: { lat: maxLat, lng: maxLon }
  };
}

export function mapGeoJsonEdge(feature: GeoJsonEdge): Edge {
  const coordinates: LatLng[] = feature.geometry.coordinates.map(
    ([lng, lat]) => ({ lat, lng })
  );

  return {
    id: feature.properties.id,
    name: feature.properties.name,
    surface: feature.properties.surface,
    length:
      feature.properties.length ??
      calculateLength(coordinates),
    coordinates,
    bbox: mapBBox(feature.properties.bbox)
  };
}