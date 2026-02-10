const buildTime = "__BUILD_TIME__"
document.getElementById("buildTime").textContent = buildTime

const homeGPS = [49.497373, 5.978007]

async function loadStats(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Network error");
    const statsData = await response.json();
    setStats(statsData["total_length"], statsData["areas"])
  } catch (err) {
    console.error("Failed to load Stats json:", err);
  }
}

async function loadJunctions(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Network error");
    const geojsonData = await response.json();

    L.geoJSON(geojsonData, {
      pointToLayer: (feature, latlng) =>
        L.circleMarker(latlng, { color: "red", radius: 3 }),
    }).addTo(map);

    // Build spatial grid index for nodes
    for (const node of geojsonData.features) {
      const key = cellKey(node.geometry.coordinates[1], node.geometry.coordinates[0]);
      if (!grid.has(key)) grid.set(key, []);
        grid.get(key).push(node);
    }
    console.log("buckets", grid.size)
  } catch (err) {
    console.error("Failed to load GeoJSON:", err);
  }
}

async function loadEdges(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Network error");
    const geojsonData = await response.json();

    L.geoJSON(geojsonData, {
      style: {
        color: "red",
        weight: 2,
        opacity: 0.7
      }
    }).addTo(map);

  } catch (err) {
    console.error("Failed to load edges:", err);
  }
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

function rotateMap(deg) {
  const mapEl = document.getElementById("map");
  mapEl.style.transform =
    `translate(-50%, -50%) rotate(${-deg}deg)`;
}

function setStats(total_length, area_count){
  document.getElementById("total_length").textContent = `${total_length}km of trails`
  document.getElementById("area_count").textContent = `In ${area_count} areas`
}

const CELL_SIZE = 0.002; // ≈ 200m in lat/lon (rough)

function cellKey(lat, lon) {
  const x = Math.floor(lon / CELL_SIZE);
  const y = Math.floor(lat / CELL_SIZE);
  return `${x},${y}`;
}

function nearbyNodes(lat, lon) {
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

/*
def haversine_dist(p1: HasLatLon, p2: HasLatLon):
    R = 6371000.0
    phi1, phi2 = math.radians(p1.lat), math.radians(p2.lat)
    dphi = math.radians(p2.lat - p1.lat)
    dlambda = math.radians(p2.lon - p1.lon)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2)**2
    return 2*R*math.asin(math.sqrt(a))
    */
const grid = new Map();

// For heading direction
const MIN_SPEED = 0.5; // m/s (~5.4 km/h)

// Initialise map
const map = L.map("map").setView([49.477015, 5.980889], 17)

L.tileLayer(
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  { attribution: "© OpenStreetMap contributors" }
).addTo(map)

loadJunctions("data/unvisited_junctions.geojson");
loadEdges("data/unvisited_edges.geojson")
loadStats("data/stats.json")

const marker = L.circleMarker([0, 0], {
  radius: 8,
  color: "blue",
  fillOpacity: 0.8
}).addTo(map)

const boundaryMarker = L.circleMarker([0, 0], {
  radius: 8,
  color: "purple",
  fillOpacity: 0.8
}).addTo(map)

// --- GPS Tracking Logic ---
let watchId = null;
let trackingEnabled = false;

let lastPos = null;
let headingHistory = [];
let stableHeading = null;
const MAX_HISTORY = 5;

setStats(666, 17)

const button = document.getElementById("tracking-btn");

window.addEventListener("resize", () => {
  map.invalidateSize({ animate: false });
});

button.addEventListener("click", () => {
  if (!trackingEnabled) {
    // Enable tracking
    if ("geolocation" in navigator) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          //const { latitude, longitude, speed } = pos.coords;
          [latitude, longitude] = homeGPS
          speed = 1.0

          if (trackingEnabled) {
            // Tracking
            marker.setLatLng([latitude, longitude]);
            map.setView([latitude, longitude], 17);

            // Heading
            if (lastPos && speed !== null && speed > MIN_SPEED) {
              const h = computeBearing(
                lastPos.latitude,
                lastPos.longitude,
                latitude,
                longitude
              );

              headingHistory.push(h);
              if (headingHistory.length > MAX_HISTORY) {
                headingHistory.shift();
              }

              stableHeading = smoothHeading(headingHistory);
            }

            lastPos = { latitude, longitude };

            if (stableHeading !== null) {
              rotateMap(stableHeading);
            }

            // Find closest boundary point
            try{
              const distEl = document.getElementById("candidate-dist")
              const closeNodes = nearbyNodes(latitude, longitude)
              //distEl.textContent=`${closeNodes.length}`
              let minDist = Infinity
              let closestNode = null
              for(node of closeNodes){
                dist = approxDist2(latitude, longitude, node.geometry.coordinates[1], node.geometry.coordinates[0])
                if(dist < minDist){
                  console.log("Candidate", dist)
                  minDist = dist
                  closestNode = node
                }
              }
              distEl.textContent = `${minDist} units`

              if(closestNode != null){
                boundaryMarker.setLatLng([closestNode.geometry.coordinates[1], closestNode.geometry.coordinates[0]])
                const realDist = haversineDist(latitude, longitude, closestNode.geometry.coordinates[1], closestNode.geometry.coordinates[0]).toFixed(0)
                distEl.textContent = `${realDist}m`
              }
              else distEl.textContent = "Nothing around here..."
            }catch(err){
              document.getElementById("candidate-dist").textContent = err.message
            }
          }
        },
        (err) => console.warn("Geolocation error:", err.message),
        { enableHighAccuracy: true }
      );
      trackingEnabled = true;
      button.textContent = "Disable Tracking";
    } else {
      alert("Geolocation not available");
    }
  } else {
    // Disable tracking
    trackingEnabled = false;
    button.textContent = "Enable Tracking";
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }
  }
});
