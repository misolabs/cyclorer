const map = L.map("map").setView([0, 0], 15)

L.tileLayer(
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  { attribution: "© OpenStreetMap contributors" }
).addTo(map)

const marker = L.circleMarker([0, 0], {
  radius: 8,
  color: "blue",
  fillOpacity: 0.8
}).addTo(map)

navigator.geolocation.watchPosition(
  pos => {
    const { latitude, longitude } = pos.coords
    marker.setLatLng([latitude, longitude])
    map.setView([latitude, longitude], 16)
  },
  err => alert(err.message),
  { enableHighAccuracy: true }
)
