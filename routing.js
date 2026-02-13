const ROUTING_CELL_SIZE = 0.0005;

var edge_grid_index = []
var gridW = 0
var gridH = 0
var gridMinLon = 0
var gridMinLat = 0

var initialised = 0

// Longitude → X axis (horizontal) (6)
// Latitude  → Y axis (vertical) (49)
// In bbox (minlon, minlat, maxlon, maxlat)

export function init_edge_index(bbox){
    gridMinLon = bbox[0]
    gridMinLat = bbox[1]

    gridW = Math.ceil((bbox[2] - bbox[0]) / ROUTING_CELL_SIZE); // LON
    gridH = Math.ceil((bbox[3] - bbox[1]) / ROUTING_CELL_SIZE); // LAT

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
export function add_routing_edge(bbox, edgeId){
    if(!initialised)
        return

    const {x: minX, y: minY} = latlon_to_cell(bbox[1], bbox[0])
    const {x: maxX, y: maxY} = latlon_to_cell(bbox[3], bbox[2])

    for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
            const i = cell_to_index(x, y);
            if (!edge_grid_index[i]) 
                edge_grid_index[i] = [];
            edge_grid_index[i].push(edgeId);
        }
    }
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

    console.log("Testing localisation")
    const [lat,lon] = [49.474077, 5.987302]
    const {x,y} = latlon_to_cell(lat, lon)
    console.log(x,y)
    
    const candidates = find_candidate_edges(x,y)
    for(const c of candidates)
        console.log(c)
}