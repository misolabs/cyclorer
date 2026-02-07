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

const map = L.map("map").setView([49.477015, 5.980889], 15)

L.tileLayer(
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  { attribution: "© OpenStreetMap contributors" }
).addTo(map)

loadJunctions();

const marker = L.circleMarker([0, 0], {
  radius: 8,
  color: "blue",
  fillOpacity: 0.8
}).addTo(map)

navigator.geolocation.watchPosition(
  pos => {
    const { latitude, longitude } = pos.coords
    marker.setLatLng([latitude, longitude])
    map.setView([latitude, longitude], 18)
  },
  err => alert(err.message),
  { enableHighAccuracy: true }
)
