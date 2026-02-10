Math.toRad = function(deg) {
  return deg * Math.PI / 180;
};

function approxDist2(lat1, lon1, lat2, lon2) {
  const dLat = lat2 - lat1;
  const dLon = (lon2 - lon1) * Math.cos(lat1 * Math.PI / 180);
  return dLat*dLat + dLon*dLon;
}

function haversineDist(lat1, lon1, lat2, lon2){
  const R = 6371000.0

  const phi1 = Math.toRad(lat1)
  const phi2 = Math.toRad(lat2)
  const dphi = Math.toRad(lat2 - lat1)
  const dlambda = Math.toRad(lon2 - lon1)
  
  const a = Math.min(1, Math.sin(dphi/2)**2 + Math.cos(phi1)*Math.cos(phi2)* Math.sin(dlambda/2)**2)

  return 2*R*Math.asin(Math.sqrt(a))
}

function computeBearing(lat1, lon1, lat2, lon2) {
  const toRad = (d) => d * Math.PI / 180;
  const toDeg = (r) => r * 180 / Math.PI;

  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lon2 - lon1);

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function smoothHeading(headings) {
  let x = 0, y = 0;
  for (const h of headings) {
    const r = h * Math.PI / 180;
    x += Math.cos(r);
    y += Math.sin(r);
  }
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

// Spatial grid for nodes
const CELL_SIZE = 0.002; // ≈ 200m in lat/lon (rough)

function cellKey(lat, lon) {
  const x = Math.floor(lon / CELL_SIZE);
  const y = Math.floor(lat / CELL_SIZE);
  return `${x},${y}`;
}

function nearbyNodes(grid, lat, lon) {
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