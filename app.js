async function loadJunctions() {
  try {
    const response = await fetch("unvisited_junctions.geojson");
    if (!response.ok) throw new Error("Network error");
    const geojsonData = await response.json();

    L.geoJSON(geojsonData, {
      pointToLayer: (feature, latlng) =>
        L.circleMarker(latlng, { color: "red", radius: 5 }),
    }).addTo(map);
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
        weight: 3,
        opacity: 0.7
      }
    }).addTo(map);

  } catch (err) {
    console.error("Failed to load edges:", err);
  }
}

const map = L.map("map").setView([49.477015, 5.980889], 15)

L.tileLayer(
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  { attribution: "© OpenStreetMap contributors" }
).addTo(map)

loadJunctions();
loadEdges("unvisited_edges.geojson")

const marker = L.circleMarker([0, 0], {
  radius: 8,
  color: "blue",
  fillOpacity: 0.8
}).addTo(map)

// --- GPS Tracking Logic ---
let watchId = null;
let trackingEnabled = false;

const button = document.getElementById("tracking-btn");

button.addEventListener("click", () => {
  if (!trackingEnabled) {
    // Enable tracking
    if ("geolocation" in navigator) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          if (trackingEnabled) {
            marker.setLatLng([latitude, longitude]);
            map.setView([latitude, longitude], 16);
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
