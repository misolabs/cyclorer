import {nearbyNodes, computeBearing, smoothHeadingMode, approxDist2, haversineDist, cellKey} from "./helpers.js"
import { uiUpdateStats } from "./dom.js"

const buildTime = "__BUILD_TIME__"

const homeGPS = [49.497373, 5.978007]
const ellergronnGPS = [49.477015, 5.980889]
const zoomLevel = 17

const nodesGrid = new Map();

// For heading direction
const MIN_SPEED = 1.0

document.getElementById("buildTime").textContent = buildTime


async function loadStats(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Network error");
    const statsData = await response.json();
    uiUpdateStats(statsData["total_length"], statsData["areas"])
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
      if (!nodesGrid.has(key)) nodesGrid.set(key, []);
        nodesGrid.get(key).push(node);
    }
    console.log("buckets", nodesGrid.size)
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

function rotateMap(deg) {
  const mapEl = document.getElementById("map");
  if(mapEl)
    mapEl.style.transform = `translate(-50%, -50%) rotate(${-deg}deg)`;
}

// Initialise map
const map = L.map("map").setView(ellergronnGPS, zoomLevel)

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

const polyline = L.polyline([], {color: 'pink', width: 2}).addTo(map)

// --- GPS Tracking Logic ---
let watchId = null;
let trackingEnabled = false;

let lastPos = null;
let headingHistory = [];
let stableHeading = null;
const MAX_HISTORY = 5;

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
          const currentGPS = [latitude, longitude]

          if (trackingEnabled) {
            // Tracking
            marker.setLatLng(currentGPS);
            map.setView(currentGPS, zoomLevel);

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

              stableHeading = smoothHeadingMode(headingHistory);
            }

            lastPos = { latitude, longitude };

            if (stableHeading !== null) {
              rotateMap(stableHeading);
            }

            // Find closest boundary point
            try{
              const distEl = document.getElementById("candidate-dist")
              const closeNodes = nearbyNodes(nodesGrid, latitude, longitude)

              let minDist = Infinity
              let closestNode = null
              for(let node of closeNodes){
                let dist = approxDist2(latitude, longitude, node.geometry.coordinates[1], node.geometry.coordinates[0])
                if(dist < minDist){
                  console.log("Candidate", dist)
                  minDist = dist
                  closestNode = node
                }
              }
              if(closestNode != null){
                let closestGPS = [closestNode.geometry.coordinates[1], closestNode.geometry.coordinates[0]]
                let trackingGPS = [latitude, longitude]

                boundaryMarker.setLatLng(closestGPS)
                polyline.setLatLngs([closestGPS, trackingGPS])
                
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
