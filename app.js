const map = L.map("map").setView([52.52, 13.405], 13) // fallback (Berlin)

L.tileLayer(
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  { attribution: "© OpenStreetMap contributors" }
).addTo(map)

const marker = L.circleMarker([52.52, 13.405], {
  radius: 8,
  color: "blue",
  fillOpacity: 0.8
}).addTo(map)

if ("geolocation" in navigator) {
  navigator.geolocation.watchPosition(
    pos => {
      const { latitude, longitude } = pos.coords
      marker.setLatLng([latitude, longitude])
      map.setView([latitude, longitude], 16)
    },
    err => {
      console.warn("Geolocation error:", err.message)
      // keep fallback location
    },
    { enableHighAccuracy: true }
  )
}
