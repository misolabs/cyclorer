Math.toRad = function(deg) {
  return deg * Math.PI / 180;
};

export function approxDist2(lat1, lon1, lat2, lon2) {
  const dLat = lat2 - lat1;
  const dLon = (lon2 - lon1) * Math.cos(lat1 * Math.PI / 180);
  return dLat*dLat + dLon*dLon;
}

export function haversineDist(lat1, lon1, lat2, lon2){
  const R = 6371000.0

  const phi1 = Math.toRad(lat1)
  const phi2 = Math.toRad(lat2)
  const dphi = Math.toRad(lat2 - lat1)
  const dlambda = Math.toRad(lon2 - lon1)
  
  const a = Math.min(1, Math.sin(dphi/2)**2 + Math.cos(phi1)*Math.cos(phi2)* Math.sin(dlambda/2)**2)

  return 2*R*Math.asin(Math.sqrt(a))
}

// Spatial grid for nodes
const CELL_SIZE = 0.002; // ≈ 200m in lat/lon (rough)

export function cellKey(lat, lon) {
  const x = Math.floor(lon / CELL_SIZE);
  const y = Math.floor(lat / CELL_SIZE);
  return `${x},${y}`;
}

export function nearbyNodes(grid, lat, lon) {
  const x = Math.floor(lon / CELL_SIZE);
  const y = Math.floor(lat / CELL_SIZE);

  const result = [];

  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const key = `${x + dx},${y + dy}`;
      if (grid.has(key)) {
        result.push(...grid.get(key));
      }
    }
  }
  return result;
}