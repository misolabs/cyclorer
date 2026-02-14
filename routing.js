const ROUTING_CELL_SIZE = 0.0005;

var edge_grid_index = []
var gridW = 0
var gridH = 0
var gridMinLon = 0
var gridMinLat = 0

var adjacent_edges = new Map() 

var projCenterLon = 0
var projCenterLat = 0

var initialised = 0

// Longitude → X axis (horizontal) (6)
// Latitude  → Y axis (vertical) (49)
// In bbox (minlon, minlat, maxlon, maxlat)

const R = 6371000; // meters

function toXY(lat, lon) {
  const φ = lat * Math.PI / 180;
  const λ = lon * Math.PI / 180;
  const φ0 = projCenterLat * Math.PI / 180;
  const λ0 = projCenterLon * Math.PI / 180;

  const x = R * (λ - λ0) * Math.cos(φ0);
  const y = R * (φ - φ0);

  return { x, y };
}

function pointToSegmentDistance(P, A, B) {
  const ABx = B.x - A.x;
  const ABy = B.y - A.y;
  const APx = P.x - A.x;
  const APy = P.y - A.y;

  const ab2 = ABx * ABx + ABy * ABy;
  const t = Math.max(0, Math.min(1,
      (APx * ABx + APy * ABy) / ab2
  ));

  const closestX = A.x + t * ABx;
  const closestY = A.y + t * ABy;

  const dx = P.x - closestX;
  const dy = P.y - closestY;

  return Math.sqrt(dx * dx + dy * dy);
}

export function init_edge_index(bbox){
    gridMinLon = bbox[0]
    gridMinLat = bbox[1]

    gridW = Math.ceil((bbox[2] - bbox[0]) / ROUTING_CELL_SIZE); // LON
    gridH = Math.ceil((bbox[3] - bbox[1]) / ROUTING_CELL_SIZE); // LAT

    projCenterLon = (bbox[0] + bbox[2]) / 2
    projCenterLat = (bbox[1] + bbox[3]) / 2

    console.log("x buckets", gridW)
    console.log("y buckets", gridH)
    console.log("total buckets", gridW * gridH)
    
    edge_grid_index = new Array(gridW * gridH)
    initialised = true
}

function cell_to_index(x, y){
    return y * gridW + x
}

function latlon_to_cell(lat, lon){
  const x = Math.floor((lon - gridMinLon) / ROUTING_CELL_SIZE);
  const y = Math.floor((lat - gridMinLat) / ROUTING_CELL_SIZE);
  return { x, y };
}

// bbox format: minLon, minLat, maxLon, maxLat
export function add_routing_edge(bbox, edge){
    if(!initialised)
        return

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
    adjacent_edges[u].push({node: v, length: edge.properties.length, geometry: edge.geometry.coordinates})
    
    if(!adjacent_edges[v])
        adjacent_edges[v] = []
    adjacent_edges[v].push({node: u, length: edge.properties.length, geometry: edge.geometry.coordinates})
}

function find_candidate_edges(x, y){
    let candidates = new Set()
    for (let dx = -1 ; dx <= 1 ; dx++){
        for (let dy = -1 ; dy <=  1; dy++){
            const cs = edge_grid_index[cell_to_index(x+dx, y+dy)]
            for(const c of cs){
                candidates.add(c)
            }
        }
    }
    return candidates.values()
}

export function find_closest_edge(lat, lon){
    const pTracking = toXY(lat, lon)
    const {x,y} = latlon_to_cell(lat, lon)
    console.log(x,y)

    let closestEdge = null
    let minDist = Infinity
    const candidates = find_candidate_edges(x,y)
    for(const c of candidates){
        console.log("Candidate", c.properties.osmid)
        const pointsXY = c.geometry.cartesian
        // geometry is in order lon, lat
        let pLast = pointsXY[0]
        for(let i=1; i < pointsXY.length; i++){
            const dist = pointToSegmentDistance(pTracking, pointsXY[i], pLast)
            if(dist < minDist){
                minDist = dist
                closestEdge = c
            }
            pLast = pointsXY[i]
        }
        console.log("Closest point", minDist)
    }
    return closestEdge
}

function reconstructPath(prev, target) {
  const path = [];
  let current = target;

  // If target was never reached
  if (!(current in prev)) {
    return null; // or []
  }

  while (current !== undefined) {
    path.push(current);
    current = prev[current];
  }

  path.reverse();
  return path;
}

function dijkstra(start, target) {
  const dist = {};
  const prev = {};
  const visited = new Set();
  
  dist[start] = 0;

  const queue = [start];

  while (queue.length > 0) {

    // Find node with smallest distance
    let u = null;
    let best = Infinity;

    for (const n of queue) {
      if (dist[n] < best) {
        best = dist[n];
        u = n;
      }
    }

    // Remove u from queue
    queue.splice(queue.indexOf(u), 1);

    if (u === target){
        break;
    }

    visited.add(u);

    //console.log("Neighbours", u, adjacent_edges[u])
    for (const { node: v, length } of adjacent_edges[u]) {
      if (visited.has(v)) continue;

      const alt = dist[u] + length;

      if (dist[v] === undefined || alt < dist[v]) {
        dist[v] = alt;
        prev[v] = u;

        if (!queue.includes(v))
          queue.push(v);
      }
    }
  }

  return reconstructPath(prev, target);
}

export function find_route(startEdge, nodeId){
    console.log("Target", nodeId)
    console.log("Starting node 1", startEdge.properties.u)
    console.log("Starting node 2", startEdge.properties.v)

    // Proper method
    // Search from both ends
    // Determine intersection of tracking pos with current edge and split
    const routeNodesU = dijkstra(startEdge.properties.u, nodeId)

    if(routeNodesU){
        //console.log(result)

        // Collect edges and length
        let lastN = routeNodesU[0]
        let total_length = 0
        for(let i=1; i < routeNodesU.length;i++){
            const currentN = routeNodesU[i]
            const adj = adjacent_edges[lastN]

            if(adj){
                for(const n of adj){
                    if(n.node === currentN){
                        total_length += n.length
                    }
                }
            }else console.error("No neighbours")
            lastN = currentN
        }
        console.log("Route length", total_length)
    }else console.error("No route found")
}

export function routing_stats(){
    let emptyCount = 0
    let largest = 0

    console.log(edge_grid_index.length)
    for(const b of edge_grid_index){
        if(b == undefined || b.length == 0)
            emptyCount++
        if(b && b.length > largest)
            largest = b.length
    }
    console.log("Empty buckets", emptyCount)
    console.log("Largest bucket", largest)

    let nmax = 0
    for(const a in adjacent_edges){
        if(adjacent_edges[a].length > nmax)
            nmax = adjacent_edges[a].length
    }
    console.log("Most neighbours", nmax)

    console.log("Testing localisation")
    const edge = find_closest_edge(49.474077, 5.987302)

    // Test routing
    console.log("Testing routing")
    find_route(edge, 1447926964 /*3642217639*/) 
}