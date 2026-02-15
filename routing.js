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

  // Project onto line through A and B
  const ab2 = ABx * ABx + ABy * ABy;
  const t = Math.max(0, Math.min(1,
      (APx * ABx + APy * ABy) / ab2
  ));

  // Intersection point I
  const closestX = A.x + t * ABx;
  const closestY = A.y + t * ABy;

  // Vector from P to intersection point
  const dx = P.x - closestX;
  const dy = P.y - closestY;

  return {
    distanceToSegment: Math.sqrt(dx * dx + dy * dy),
    t: t,
  }
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
    adjacent_edges[u].push({node: v, length: edge.properties.length, edge:edge})
    
    if(!adjacent_edges[v])
        adjacent_edges[v] = []
    adjacent_edges[v].push({node: u, length: edge.properties.length, edge:edge})
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
    let segmentIndex = undefined
    let segmentT = undefined

    const candidates = find_candidate_edges(x,y)
    for(const c of candidates){
        console.log("Candidate", c.properties.osmid)
        const pointsXY = c.geometry.cartesian

        // geometry is in order lon, lat
        let pLast = pointsXY[0]
        console.log("Edge segments", pointsXY.length - 1)
        for(let i=1; i < pointsXY.length; i++){
            const {distanceToSegment, t} = pointToSegmentDistance(pTracking, pointsXY[i], pLast)
            if(distanceToSegment < minDist && t >= 0 && t <= 1){
                minDist = distanceToSegment
                closestEdge = c
                segmentIndex = i - 1
                segmentT = t
            }
            pLast = pointsXY[i]
        }
        console.log("Closest point", minDist)
        console.log("Segment index", segmentIndex)
        console.log("Segement t", segmentT)
    }
    return {
        edge:closestEdge,
        segmentIndex: segmentIndex,
        segmentT: segmentT,
        distanceToEdge: minDist,
    }
}

// Use Map of "Best predecessor for x" to walk back to starting node from target
// Result is a list of node ids 
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
  const dist = {}; // Distances from starting node to node x
  const prev = {}; // Best predecessor for node x 
  const visited = new Set();
  
  // Init: Put starting node in queue
  dist[start] = 0;
  const queue = [start];

  while (queue.length > 0) {

    // Find node u in queue with smallest distance
    let u = null;
    let best = Infinity;

    for (const n of queue) {
      if (dist[n] < best) {
        best = dist[n];
        u = n;
      }
    }

    // Remove best candidate u from queue
    queue.splice(queue.indexOf(u), 1);

    if (u === target){
        break;
    }

    visited.add(u);

    // Find all neighbours of u that we haven't visited yet
    for (const { node: v, length } of adjacent_edges[u]) {
      // Skip if we have been here before (avoid loops)
      if (visited.has(v)) continue;

      // Is this a better way to get to v?
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

function nodes_to_edges(routeNodes){
    // Collect edges and length
    let lastN = routeNodes[0]
    let totalLength = 0
    const routeEdges = []

    for(let i=1; i < routeNodes.length;i++){
        const currentN = routeNodes[i]
        const adj = adjacent_edges[lastN]

        if(adj){
            for(const n of adj){
                if(n.node === currentN){
                    totalLength += n.length
                    routeEdges.push(n.edge)
                }
            }
        }else console.error("No neighbours")
        lastN = currentN
    }
    return {totalLength, routeEdges}
}

export function find_route(startEdge, nodeId){
    console.log("Target", nodeId)
    console.log("Starting node 1", startEdge.properties.u)
    console.log("Starting node 2", startEdge.properties.v)

    let routeEdgesU = null
    let routeEdgesV = null

    const routeNodesU = dijkstra(startEdge.properties.u, nodeId)
    const routeNodesV = dijkstra(startEdge.properties.v, nodeId)

    // Given a list of nodes reconstruct the list of edges
    if(routeNodesU){
        // Collect edges and length
        routeEdgesU = nodes_to_edges(routeNodesU)
        console.log("Route u length", routeEdgesU.totalLength)
    }else console.error("No route found")

    // Given a list of nodes reconstruct the list of edges
    if(routeNodesV){
        // Collect edges and length
        routeEdgesV = nodes_to_edges(routeNodesV)
        console.log("Route u length", routeEdgesV.totalLength)
    }else console.error("No route found")

    if(routeEdgesU && routeEdgesV && routeEdgesU.totalLength > routeEdgesV.totalLength)
        return routeEdgesU
    else
        return routeEdgesV
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
    const route = find_route(edge.edge, 1447926964 /*3642217639*/) 
    console.log(route)
}