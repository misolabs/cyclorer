import {nearbyNodes, approxDist2, haversineDist, cellKey} from "./helpers.js"
import { uiUpdateStats } from "./dom.js"
import {Routing} from "./routing.js"
import {Heading} from "./heading.js"

const buildTime = "__BUILD_TIME__"
const isMobileLike = window.matchMedia("(pointer: coarse)").matches;

const homeGPS = [49.4986211, 5.9763811]
const ellergronnGPS = [49.477015, 5.980889]
const zoomLevel = 17

const nodesGrid = new Map();
var areas = []
var statsData = {}

// UI elements
const button = document.getElementById("tracking-btn");
const splash = document.getElementById("splash");
const distanceToTargetEl = document.getElementById("candidate-dist")

async function loadStats(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Network error");
    statsData = await response.json();
    
    // bbox format: minLon, minLat, maxLon, maxLat
    Routing.init("data/routing_edges.geojson", statsData.bbox)

    uiUpdateStats(statsData["total_length"], statsData["areas"])
    document.getElementById("stats-total-length").classList.add("fadein-slow")
    document.getElementById("stats-areas-count").classList.add("fadein-slow")
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
    }).addTo(staticLayer);

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
    }).addTo(staticLayer);

  } catch (err) {
    console.error("Failed to load edges:", err);
  }
}

async function loadAreas(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Network error");
    const geojsonData = await response.json();

    areas = geojsonData.features
  } catch (err) {
    console.error("Failed to load edges:", err);
  }
}

function rotateMap(deg) {
  const mapEl = document.getElementById("map");
  if(mapEl)
    mapEl.style.transform = `translate(-50%, -50%) rotate(${-deg}deg)`;
}

// Splash screen

function hideSplash() {
  // Show tracking screen
  const trScreenEl = document.getElementById("tracking-screen")
  trScreenEl.style.visibility = "visible"

  // Fade-out splash screen
  splash.classList.add("hidden");
  setTimeout(() => {
    splash.remove();
    // If using Leaflet:
    trackingMap.invalidateSize();
    areaMap.invalidateSize();
  }, 600);
}

splash.addEventListener("click", () => {
  hideSplash();
});

// Initialise maps

// Tracking map
const trackingMap = L.map("map").setView(homeGPS, zoomLevel)

const trackingBaseMap = L.tileLayer(
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  { attribution: "© OpenStreetMap contributors" }
).addTo(trackingMap)

// Add layers (from bottom to top)
const staticLayer = L.layerGroup().addTo(trackingMap)
const routingLayer = L.layerGroup().addTo(trackingMap)
const markerLayer = L.layerGroup().addTo(trackingMap)

const trackingMarkerLocation = L.circleMarker([0, 0], {
  radius: 8,
  color: "blue",
  fillOpacity: 1
}).addTo(markerLayer)

const trackingMarkerBoundary = L.circleMarker([0, 0], {
  radius: 8,
  color: "purple",
  fillOpacity: 1
}).addTo(markerLayer)

const routeLine = L.polyline([], {
  color: 'purple', 
  opacity: 1, 
  weight: 7,
}).addTo(routingLayer)


// Unexplored area preview
const areaMap = L.map("area-preview", {zoomControl: false, dragging: false} )
const areaPreview = L.polyline([], {color: 'lightseagreen', weight: 2}).addTo(areaMap)
const areaEntrypoint = L.circleMarker([0, 0], {
  radius: 8,
  color: "purple",
  fillOpacity: 0.8
}).addTo(areaMap)

function findArea(areaId){
  for(const area of areas){
    if(area.properties.area_id == areaId){
      return area
    }
  }
  return null
}

function flipCoords(coords) {
  if (typeof coords[0] === "number") {
    return [coords[1], coords[0]];
  }
  return coords.map(flipCoords);
}

function setAreaPreview(areaId){
  let area = findArea(areaId)
  if(area)
  {
    areaPreview.setLatLngs(flipCoords(area.geometry.coordinates))
    areaMap.fitBounds(areaPreview.getBounds())
  }
}

// Load mapping data
loadJunctions("data/unvisited_junctions.geojson");
loadEdges("data/unvisited_edges.geojson")
loadStats("data/stats.json")
loadAreas("data/unvisited_areas.geojson")
//loadRouting("data/routing_edges.geojson")

// --- GPS Tracking Logic ---
let watchId = null;
let trackingEnabled = false;

let entrypointNode = null;

// ROUTING STATE

// Routing edge that the current GPS tracking position snaps to
let currentClosestEdge = null
let currentRouteInfo = null

function trackingListener(pos){
  const { latitude, longitude, speed } = pos.coords;
  const currentGPS = [latitude, longitude]

  if (trackingEnabled) {
    console.log("---------------------------------------")

    // Position Tracking
    trackingMarkerLocation.setLatLng(currentGPS);
    trackingMap.setView(currentGPS, zoomLevel);

    // Heading
    try{
      const stableHeading = Heading.update(latitude, longitude, speed)
      if (stableHeading !== null) rotateMap(stableHeading)
    }catch(err){console.error("Exception in heading", err.message)}

    // Find closest boundary point
    let closestNode = null
    console.log("Finding closest nodes")
    try{
      const distEl = document.getElementById("candidate-dist")
      const closeNodes = nearbyNodes(nodesGrid, latitude, longitude)

      let minDist = Infinity
      for(let node of closeNodes){
        let dist = approxDist2(latitude, longitude, node.geometry.coordinates[1], node.geometry.coordinates[0])
        if(dist < minDist){
          console.log("Candidate", dist.toFixed(0), "m")
          minDist = dist
          closestNode = node
        }
      }
      if(closestNode != null){
        console.log("Closest area", closestNode.properties.area_id)

        // store the currently selected entrypoint node to the current area
        entrypointNode = closestNode

        let closestGPS = [closestNode.geometry.coordinates[1], closestNode.geometry.coordinates[0]]
        const areaId = closestNode.properties.area_id
        const area = findArea(areaId)

        trackingMarkerBoundary.setLatLng(closestGPS)
        //trackingLineBoundary.setLatLngs([closestGPS, trackingGPS])

        setAreaPreview(closestNode.properties.area_id)
        areaEntrypoint.setLatLng(closestGPS)

        const realDist = haversineDist(latitude, longitude, closestNode.geometry.coordinates[1], closestNode.geometry.coordinates[0]).toFixed(0)
        console.log("Direct Distance", realDist)
        //distEl.textContent = `${realDist}m`

        const areaEl = document.getElementById("area-info")
        if(areaEl && area)
          areaEl.textContent = `Area ${areaId} - ${(area.properties.total_length).toFixed(0)}m`
      }
      else{
        entrypointNode = null
        distEl.textContent = "Nothing new around here..."
      }
    }catch(err){
      console.error("Finding boundary node", err.message)
    }

    // Find closest edge for routing
    try{
      if(entrypointNode){
        // We snap the current postion to a routing edge on every frame
        const snappedEdgeInfo = Routing.findClosestEdge(latitude, longitude)

        // Couldn't latch onto anything
        if(!snappedEdgeInfo || !snappedEdgeInfo.edge){
          distanceToTargetEl.textContent = "We're lost!?"
          routeLine.setLatLngs([])
        }

        // No routing 
        else if(snappedEdgeInfo.edge.properties.ride_count == 0){
          distanceToTargetEl.textContent = "Go! Explore"
          routeLine.setLatLngs([])
        }

        // We have moved on to a new edge -> reroute
        else if(snappedEdgeInfo.edge != currentClosestEdge){
          currentClosestEdge = snappedEdgeInfo.edge
          currentRouteInfo = Routing.findRoute(
            snappedEdgeInfo, 
            Number(entrypointNode.properties.osmid)
          )
        }

        // We have a valid route
        if(currentRouteInfo){
          console.log("Approximate route length", currentRouteInfo.totalLength)

          document.getElementById("candidate-dist").textContent = `${currentRouteInfo.totalLength.toFixed(0)}`
          // Draw polyline, flip lat / lon
          routeLine.setLatLngs(flipCoords(currentRouteInfo.geometry))
        }else
          document.getElementById("candidate-dist").textContent = "Route not found"
      }
    }catch(err){
      document.getElementById("candidate-dist").textContent= "Routing Exception: " + err.message
    }

  }
}

function registerTrackingListener(){
  watchId = navigator.geolocation.watchPosition(
    trackingListener,
    (err) => console.warn("Geolocation error:", err.message),
    { enableHighAccuracy: true }
  );
}

let simulationId = null
function registerSimulationTimer(){
  simulationId = window.setInterval( () => 
    {
      const pos = trackingMap.getCenter()
      trackingListener({
        coords: {
          latitude: pos.lat,
          longitude: pos.lng,
          speed: 1.0
        }
      })
    }, 5000)
}


window.addEventListener("resize", () => {
  trackingMap.invalidateSize({ animate: false });
  areaMap.invalidateSize({animate: false})
});

const simulationMode = !isMobileLike

if(!simulationMode){
  button.addEventListener("click", () => {
    if (!trackingEnabled) {
      // Enable tracking
      if ("geolocation" in navigator) {
        registerTrackingListener()
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

  registerTrackingListener()
  trackingEnabled = true;
  button.textContent = "Disable Tracking";
}else{
  button.addEventListener("click", () => {
    if (!trackingEnabled) {
      // Enable simulation
      registerSimulationTimer()
      trackingEnabled = true;
      button.textContent = "Disable Simulation";
    } else {
      // Disable tracking
      trackingEnabled = false;
      button.textContent = "Enable Simulation";
      if (simulationId !== null) {
        window.clearInterval(simulationId)
        simulationId = null;
      }
    }
  });

  trackingEnabled = true
  registerSimulationTimer()
  button.textContent = "Disable Simulation"
}
