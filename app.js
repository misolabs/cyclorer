const map = L.map("map").setView([49.477015, 5.980889], 15)

L.tileLayer(
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  { attribution: "© OpenStreetMap contributors" }
).addTo(map)

unvisited_junctions = fetch("unvisited_junctions.geojson")
L.geoJSON(unvisited_junctions, {
  pointToLayer: (feature, latlng) => L.circleMarker(latlng, { color: 'red', radius: 3 })
}).addTo(map);

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
