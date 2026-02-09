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
      const key = cellKey(node.geometry[1], node.geometry[0]);
      if (!grid.has(key)) grid.set(key, []);
        grid.get(key).push(node);
      console.log(key)
    }
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
          const { latitude, longitude, speed } = pos.coords;
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
