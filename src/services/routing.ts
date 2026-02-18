import { BoundingBox, Edge } from "../domain/edge";
import { GeoJsonRoutingCollection } from "../domain/geo";
import { mapGeoJsonEdge } from "../mapper/edgemapper";

let routingData: GeoJsonRoutingCollection

function addRoutingEdge(edge: Edge){
    // Get the corner grid cells indices from bbox
    const {x: minX, y: minY} = latlon_to_cell(bbox[1], bbox[0])
    const {x: maxX, y: maxY} = latlon_to_cell(bbox[3], bbox[2])

    // Register edge in every bbox cell that may be touched
    for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
            const i = cell_to_index(x, y);
            if (!edge_grid_index[i]) 
                edge_grid_index[i] = [];
            edge_grid_index[i].push(edge);
        }
    }

    // Precompute cartesian coords for geometry points
    const points = edge.geometry.coordinates
    const xyPoints = []

    for(const pLatLon of points){
        // original geometry is in order lon, lat
        let pCart = toXY(pLatLon[1], pLatLon[0])
        xyPoints.push(pCart)
    }
    edge.geometry.cartesian = xyPoints

    // Add edge to adjacency map
    const u = edge.properties.u
    const v = edge.properties.v

    if(!adjacent_edges[u])
        adjacent_edges[u] = []
    adjacent_edges[u].push({node: v, length: edge.properties.length, edge:edge})
    
    if(!adjacent_edges[v])
        adjacent_edges[v] = []
    adjacent_edges[v].push({node: u, length: edge.properties.length, edge:edge})
}

async function loadRoutingData(url: string, bbox: BoundingBox) {
  try {
    // Set up grid index
    init_edge_index(bbox)

    // Fetch edge network data
    const response = await fetch(url);
    if (!response.ok) throw new Error("Network error");
    routingData = await response.json();

    // bbox format: minLon, minLat, maxLon, maxLat
    for(const geoEdge of routingData.features){ 
        const edge: Edge = mapGeoJsonEdge(geoEdge)
        addRoutingEdge(edge)
    }
    console.log("grid index built")
    Routing.initialised = true 
  } catch (err) {
    console.error("Failed to load routing:", err.message);
  }
}