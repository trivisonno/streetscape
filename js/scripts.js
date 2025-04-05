// --- Global Variables ---
let currentIconUrl = null;
let selectedMarker = null;  // for pavement markings
const markers = [];
let selectedLaneLine = null;
const laneLines = [];
let selectedPavementPolygon = null;
const pavementPolygons = [];
let markersEnabled = true;

// Global variable to store the current settings
let currentSettings = {
    color: document.querySelector('input[name="laneColor"]:checked').value,
    stroke: parseInt(document.querySelector('input[name="laneWidth"]:checked').value, 10),
    dash: document.querySelector('input[name="laneDash"]:checked').value
};

// Function to update selectors to match a line's properties
function setSelectorsFromLine(line) {
    document.querySelector(`input[name="laneColor"][value="${line.myStyle.color}"]`).checked = true;
    document.querySelector(`input[name="laneWidth"][value="${line.myStyle.weight}"]`).checked = true;
    document.querySelector(`input[name="laneDash"][value="${line.myStyle.dashArray}"]`).checked = true;
}

// Function to restore selectors to the previous settings
function restoreSelectors() {
    document.querySelector(`input[name="laneColor"][value="${currentSettings.color}"]`).checked = true;
    document.querySelector(`input[name="laneWidth"][value="${currentSettings.stroke}"]`).checked = true;
    document.querySelector(`input[name="laneDash"][value="${currentSettings.dash}"]`).checked = true;
}

// --- Initialize Map & Layers ---
const map = L.map('map', { maxZoom: 23, editable: true, zoomControl: false }).setView([41.4993, -81.6944], 21);
L.control.zoom({
    position: 'bottomright'
}).addTo(map);
map.editTools = new L.Editable(map);
// Tile layer management (available tile layers)
const tileLayers = [];
const esriTiles = L.tileLayer('https://gis.cuyahogacounty.us/server/rest/services/IMAGERY/2023_Fall_Aerial/MapServer/tile/{z}/{y}/{x}', {
    maxNativeZoom: 21,
    maxZoom: 23,
    zoomOffset: -10,
    attribution: '<a href="https://geospatial.gis.cuyahogacounty.gov/" target="_blank">Cuyahoga County GIS</a>'
}).addTo(map);

const esriTilesProxy = L.tileLayer('https://ggsyu5e4m3.execute-api.us-east-1.amazonaws.com/dev/{z}/{y}/{x}', {
        maxNativeZoom: 21,
        maxZoom: 23,
        zoomOffset: -10,
        attribution: '<a href="https://geospatial.gis.cuyahogacounty.gov/" target="_blank">Cuyahoga County GIS</a>'
    });

const osmTiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxNativeZoom: 19,
    maxZoom: 23,
    attribution: '© OpenStreetMap contributors'
});

var satellite = L.gridLayer.googleMutant({
    type: 'satellite',
    maxZoom: 23	// valid values are 'roadmap', 'satellite', 'terrain' and 'hybrid'
    });

var hybrid = L.gridLayer.googleMutant({
    maxZoom: 23,
    type: 'hybrid'	// valid values are 'roadmap', 'satellite', 'terrain' and 'hybrid'
    });    

var varPolylineMeasure = L.control.polylineMeasure({
    'unit': 'landmiles',
    'showClearControl': true,
    measureControlLabel: '&#128207;',
    clearMeasurementsOnStop: false,
    position: 'topright',
    measureControlTitleOn: 'Measure distance',
    measureControlTitleOff: 'Clear measurements',
    clearControlTitle: 'Clear measurements'
}).addTo(map);

// When the measurement tool is cleared, disable marker adding.
map.on('polylinemeasure:clear', function () {
    markersEnabled = true;
});

// When the measurement tool is toggled off (status=false), disable marker adding;
// when toggled on (status=true), you can re-enable marker adding if you want.
map.on('polylinemeasure:toggle', function (e) {
    if (e.status === true) {
        markersEnabled = false;
    } else {
        markersEnabled = true;
    }
});

tileLayers.push({ name: "Cuyahoga County", url: 'https://gis.cuyahogacounty.us/server/rest/services/IMAGERY/2023_Fall_Aerial/MapServer/tile/{z}/{y}/{x}', layer: esriTiles });
tileLayers.push({ name: "OpenStreetMap", url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', layer: osmTiles });

// Create separate layer groups.
const pavementPolygonsLayer = L.featureGroup().addTo(map); // Underneath other features
const laneLinesLayer = L.featureGroup().addTo(map);
const signMarkersLayer = L.featureGroup().addTo(map); // Layer for sign icons
    const dimensionsLayer = L.featureGroup().addTo(map);

// Create a custom pane for pavement polygons with a lower z-index.
map.createPane('pavementPane');
map.getPane('pavementPane').style.zIndex = 250;

// Create an overlay pane for all other features (higher z-index)
map.createPane('overlayPane');
map.getPane('overlayPane').style.zIndex = 400;

// Add our tile layers to the map (default visible ones)
tileLayers.forEach(tl => {
    if (tl.visible) {
        tl.layer.addTo(map);
    }
});

// Overlay layers
const markersLayer = L.featureGroup().addTo(map);

 const baseLayers = {
        "Cuyahoga County": esriTiles,
        "OpenStreetMap": osmTiles,
        "Google Satellite": satellite,
        "Google Hybrid": hybrid,
        "Cuyahoga County Proxy": esriTilesProxy
    };

// Add these layers to the layer control
const overlayLayers = {
    "Pavement Polygons": pavementPolygonsLayer,
    "Lane Lines": laneLinesLayer,
    "Markers": markersLayer,
    "Signs": signMarkersLayer, // Add sign markers layer
    "Dimensions": dimensionsLayer // Add dimensions layer
};

let layerControl = L.control.layers(baseLayers, overlayLayers).addTo(map);

// Listen for base layer changes
map.on('baselayerchange', function (e) {
    if (e.name === "OpenStreetMap") {
        map.setZoom(Math.min(map.getZoom(), osmTiles.options.maxZoom)); // Force zoom out if needed
    }
});

// Update layers to use the new feature groups
markers.forEach(marker => markersLayer.addLayer(marker));
laneLines.forEach(line => laneLinesLayer.addLayer(line));
pavementPolygons.forEach(polygon => pavementPolygonsLayer.addLayer(polygon));

// Ensure new features are added to their respective layers
function addMarkerToLayer(marker) {
    if (marker.myIconUrl && marker.myIconUrl.includes('MUTCD')) {
        signMarkersLayer.addLayer(marker); // Add sign markers to the sign layer
    } else {
        markersLayer.addLayer(marker); // Add other markers to the general markers layer
    }
}

function addLaneLineToLayer(line) {
    laneLinesLayer.addLayer(line);
}

function addPavementPolygonToLayer(polygon) {
    pavementPolygonsLayer.addLayer(polygon);
}

// Update layer control labels based on zoom level
function updateLayerControlLabels() {
    const currentZoom = map.getZoom();
    const updatedBaseLayers = {};
    Object.keys(baseLayers).forEach(layerName => {
        const layer = baseLayers[layerName];
        const label = currentZoom > layer.options.maxZoom ? `${layerName} (zoom out)` : layerName;
        updatedBaseLayers[label] = layer;
    });
    layerControl.remove();
    layerControl = L.control.layers(updatedBaseLayers, overlayLayers).addTo(map);
}

// Listen for zoom changes to update layer control labels
map.on('zoomend', updateLayerControlLabels);

// Listen for base layer changes and adjust zoom if necessary
map.on('baselayerchange', function (e) {
    const selectedLayer = e.name.includes("OpenStreetMap") ? osmTiles : esriTiles;
    if (map.getZoom() > selectedLayer.options.maxZoom) {
        map.setZoom(selectedLayer.options.maxZoom); // Force zoom out to the layer's maxZoom
    }
});

// Initial update of layer control labels
updateLayerControlLabels();

// --- Tab Switching ---
const tabMarkings = document.getElementById('tabMarkings');
const tabLaneLines = document.getElementById('tabLaneLines');
const tabPavementColor = document.getElementById('tabPavementColor');
const tabProjectSettings = document.getElementById('tabProjectSettings');
const pavementTab = document.getElementById('pavementTab');
const laneTab = document.getElementById('laneTab');
const pavementColorTab = document.getElementById('pavementColorTab');
const projectSettingsTab = document.getElementById('projectSettingsTab');

function deselectAllPavementPolygons() {
    pavementPolygons.forEach(poly => {
        poly.setStyle({
            dashArray: poly.myStyle.dashArray || "",
            weight: poly.myStyle.weight || 0,
            color: poly.myStyle.color || "transparent"
        });
        if (poly.disableEdit) {
            poly.disableEdit();
        }
    });
    selectedPavementPolygon = null;

    // Hide the area display when no polygon is selected
    document.getElementById('pavementArea').textContent = '';
}

tabMarkings.addEventListener('click', function () {
    tabMarkings.classList.add('active');
    tabLaneLines.classList.remove('active');
    tabPavementColor.classList.remove('active');
    tabProjectSettings.classList.remove('active');
    projectSettingsTab.style.display = "none";
    pavementTab.style.display = "block";
    laneTab.style.display = "none";
    pavementColorTab.style.display = "none";
    disablePavementEditing();
    deselectAllPavementPolygons();
    deselectAllLineStrings();
});

tabLaneLines.addEventListener('click', function () {
    showTabLaneLines();
});

function showTabLaneLines() {
    tabMarkings.classList.remove('active');
    tabLaneLines.classList.add('active');
    tabPavementColor.classList.remove('active');
    pavementTab.style.display = "none";
    laneTab.style.display = "block";
    pavementColorTab.style.display = "none";
    disablePavementEditing();
    tabProjectSettings.classList.remove('active');
    projectSettingsTab.style.display = "none";
    deselectAllPavementPolygons();
}

tabPavementColor.addEventListener('click', function () {
    tabMarkings.classList.remove('active');
    tabLaneLines.classList.remove('active');
    tabPavementColor.classList.add('active');
    pavementTab.style.display = "none";
    laneTab.style.display = "none";
    pavementColorTab.style.display = "block";
    // Now enable editing/interactivity on pavement polygons
    enablePavementEditing();
    tabProjectSettings.classList.remove('active');
    projectSettingsTab.style.display = "none";
    deselectAllLineStrings();
});

tabProjectSettings.addEventListener('click', function () {
    tabMarkings.classList.remove('active');
    tabLaneLines.classList.remove('active');
    tabPavementColor.classList.remove('active');
    tabProjectSettings.classList.add('active');
    pavementTab.style.display = "none";
    laneTab.style.display = "none";
    pavementColorTab.style.display = "none";
    projectSettingsTab.style.display = "block";
    disablePavementEditing();
    deselectAllPavementPolygons();
    deselectAllLineStrings();
});

// --- Pavement Markings ---
function getIconForZoom(zoom, iconUrl, className = 'marker-icon-default') {
    let baseHeight = 90, baseWidth = baseHeight / 3;

    if (className == 'marker-icon-sign') {
        baseWidth = 60;
        baseHeight = 180;
    }
    
    // If iconUrl starts with "svg:", generate inline SVG.
    if (iconUrl !== null && iconUrl.indexOf("svg:") === 0) {
        if (iconUrl === "svg:greenRect") {
            baseWidth = 30;
            baseHeight = 20;
            const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${baseWidth}" height="${baseHeight}">
    <rect width="${baseWidth}" height="${baseHeight}" fill="green"/>
    <line x1="1.5" y1="0" x2="1.5" y2="${baseHeight}" stroke="white" stroke-width="3"/>
    <line x1="${baseWidth - 1.5}" y1="0" x2="${baseWidth - 1.5}" y2="${baseHeight}" stroke="white" stroke-width="3"/>
  </svg>`;
            iconUrl = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgContent);
        }
    }

    const factor = Math.pow(0.5, 21 - zoom);
    return L.icon({
        iconUrl: iconUrl,
        iconSize: [baseWidth * factor, baseHeight * factor],
        iconAnchor: [(baseWidth * factor) / 2, (baseHeight * factor) / 2]
    });
}

let highlightCircle = null;
function highlightMarker(marker) {
    if (highlightCircle) { map.removeLayer(highlightCircle); }
    const factor = Math.pow(0.5, 21 - map.getZoom());
    highlightCircle = L.circleMarker(marker.getLatLng(), {
        radius: 40 * factor,
        color: 'red',
        weight: 2,
        fill: false
    }).addTo(map);
}
function deselectMarker() {
    if (selectedMarker && selectedMarker.dragging && selectedMarker.dragging.disable) {
        selectedMarker.dragging.disable();
    }
    selectedMarker = null;
    if (highlightCircle) { map.removeLayer(highlightCircle); highlightCircle = null; }
}

// Icon selection buttons
const iconButtons = document.querySelectorAll('.iconButton');
iconButtons.forEach(btn => {
    btn.addEventListener('click', function (e) {
        currentIconUrl = e.currentTarget.getAttribute('data-icon');
        iconButtons.forEach(b => b.classList.remove('selected'));
        e.currentTarget.classList.add('selected');
    });
});

// Function to deselect all line strings
function deselectAllLineStrings() {
    if (selectedLaneLine) {
        selectedLaneLine.setStyle({
            dashArray: selectedLaneLine.myStyle.dashArray,
            color: selectedLaneLine.myStyle.color
        });
        if (selectedLaneLine.disableEdit) {
            selectedLaneLine.disableEdit();
        }
        selectedLaneLine = null;
        restoreSelectors(); // Restore selectors to previous settings
        removeArrowheads(); // Remove arrowheads when deselecting
    }
}

let isDraggingMap = false;

// Detect when the map starts and stops being dragged
map.on('dragstart', function () {
    isDraggingMap = true;
});

map.on('dragend', function () {
    isDraggingMap = false;
});

// Map click event for Pavement Markings and for deselecting lane/pavement polygons
map.on('click', function (e) {
    if (isDraggingMap || !markersEnabled) return; // Do nothing if dragging the map or markers are disabled.
    if (pavementTab.style.display !== "none") {
        // Only add marker if an icon is selected.
        if (!currentIconUrl) return;
        if (selectedMarker) { deselectMarker(); return; }
        deselectAllLineStrings();
        if (document.querySelector(`.iconButton.selected`).classList.contains('sign')) {
            className = 'marker-icon-sign';
        } else {
            className = 'marker-icon-default';
        }
        const angle = parseInt(document.getElementById('angleValue').textContent);
        const marker = L.marker(e.latlng, {
            icon: getIconForZoom(map.getZoom(), currentIconUrl, className),
            rotationAngle: angle,
            rotationOrigin: 'center center',
            draggable: false,
            pane: 'overlayPane'
        }).addTo(map);
        marker.myIconUrl = currentIconUrl;
        markers.push(marker);
        marker.on('click', function (ev) {
            L.DomEvent.stopPropagation(ev);
            if (selectedMarker && selectedMarker !== marker) { deselectMarker(); }
            selectedMarker = marker;
            marker.dragging.enable();
            highlightMarker(marker);
            document.getElementById('angleValue').textContent = Math.round(marker.options.rotationAngle) + '°';
            const rad = marker.options.rotationAngle * Math.PI / 180;
            document.getElementById('angleLine').setAttribute('x2', 50 + 40 * Math.sin(rad));
            document.getElementById('angleLine').setAttribute('y2', 50 - 40 * Math.cos(rad));
        });
        addMarkerToLayer(marker);
    }
    else if (laneTab.style.display !== "none") {
        deselectAllLineStrings(); // Deselect all line strings when clicking on the map
    }
    else if (pavementColorTab.style.display !== "none") {
        if (selectedPavementPolygon) {
            // Reset its style.
            selectedPavementPolygon.setStyle({ dashArray: selectedPavementPolygon.myStyle.dashArray || "", weight: 0 });
            if (selectedPavementPolygon.disableEdit) { selectedPavementPolygon.disableEdit(); }
            selectedPavementPolygon = null;
        }
    }
});

document.getElementById('removeMarker').addEventListener('click', function () {
    if (selectedMarker) {
        map.removeLayer(selectedMarker);
        const idx = markers.indexOf(selectedMarker);
        if (idx > -1) markers.splice(idx, 1);
        deselectMarker();
    }
});

// Circular angle selector for pavement markings.
(function () {
    const svg = document.getElementById('angleSVG');
    const angleLine = document.getElementById('angleLine');
    const angleValue = document.getElementById('angleValue');
    let dragging = false;
    function getMousePosition(evt) {
        const rect = svg.getBoundingClientRect();
        return { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
    }
    function updateAngle(evt) {
        const pos = getMousePosition(evt);
        const centerX = 50, centerY = 50;
        const dx = pos.x - centerX, dy = centerY - pos.y;
        let angle = Math.atan2(dx, dy) * (180 / Math.PI);
        if (angle < 0) angle += 360;
        const rad = angle * Math.PI / 180, r = 40;
        angleLine.setAttribute('x2', centerX + r * Math.sin(rad));
        angleLine.setAttribute('y2', centerY - r * Math.cos(rad));
        angleValue.textContent = Math.round(angle) + '°';
        if (selectedMarker) { selectedMarker.setRotationAngle(angle); }
    }
    svg.addEventListener('mousedown', function (e) { dragging = true; updateAngle(e); });
    window.addEventListener('mousemove', function (e) { if (dragging) updateAngle(e); });
    window.addEventListener('mouseup', function () { dragging = false; });
})();

document.getElementById('angle180Button').addEventListener('click', function () {
    const angleValue = document.getElementById('angleValue');
    let currentAngle = parseInt(angleValue.textContent);
    currentAngle = (currentAngle + 180) % 360;
    angleValue.textContent = currentAngle + '°';
    const rad = currentAngle * Math.PI / 180;
    document.getElementById('angleLine').setAttribute('x2', 50 + 40 * Math.sin(rad));
    document.getElementById('angleLine').setAttribute('y2', 50 - 40 * Math.cos(rad));
    if (selectedMarker) {
        selectedMarker.setRotationAngle(currentAngle);
    }
});

// --- Lane Lines Section ---
function startDrawingLaneLine() {
    const laneColor = document.querySelector('input[name="laneColor"]:checked').value;
    const laneWidth = parseInt(document.querySelector('input[name="laneWidth"]:checked').value, 10);
    const laneDash = document.querySelector('input[name="laneDash"]:checked').value;

    // Disable the polylineMeasure tool while drawing
    if (varPolylineMeasure._measuring == true) {
        varPolylineMeasure._toggleMeasure(); // Turn off the tool
    }

    var polyline = map.editTools.startPolyline();
    polyline.on('editable:drawing:end', function () {
        const latlngs = polyline.getLatLngs();
        // if (!latlngs || latlngs.length < 2) { console.error("Invalid polyline"); return; }
        if (polyline.disableEdit) { polyline.disableEdit(); }
        polyline.setStyle({ color: laneColor, weight: laneWidth, dashArray: laneDash, lineJoin: "round", lineCap: "square" });
        polyline.myStyle = { color: laneColor, weight: laneWidth, dashArray: laneDash, lineJoin: "round", lineCap: "square" };
        laneLinesLayer.addLayer(polyline);
        laneLines.push(polyline);
        polyline.off('editable:drawing:commit editable:drawing:end');
        polyline.on('click', function (ev) {
            L.DomEvent.stopPropagation(ev);
            selectLine(polyline);
        });
        // Automatically allow new line drawing.
        // startDrawingLaneLine();
        addLaneLineToLayer(polyline);
    });
}
document.getElementById('drawLaneLine').addEventListener('click', function () {
    startDrawingLaneLine();
});
// document.getElementById('editLaneLine').addEventListener('click', function () {
//     if (selectedLaneLine) { selectedLaneLine.enableEdit(); }
// });
// document.getElementById('saveLaneLineEdits').addEventListener('click', function () {
//     if (selectedLaneLine) {
//         selectedLaneLine.disableEdit();
//         const newColor = document.querySelector('input[name="laneColor"]:checked').value;
//         const newWidth = parseInt(document.querySelector('input[name="laneWidth"]:checked').value, 10);
//         const newDash = document.querySelector('input[name="laneDash"]:checked').value;
//         selectedLaneLine.myStyle = { color: newColor, weight: newWidth, dashArray: newDash, lineJoin: "round", lineCap: "square" };
//         selectedLaneLine.setStyle({ color: newColor, weight: newWidth, dashArray: newDash, lineJoin: "round", lineCap: "square" });
//     }
// });
document.getElementById('removeLaneLine').addEventListener('click', function () {
    if (selectedLaneLine) {
        laneLinesLayer.removeLayer(selectedLaneLine);
        const idx = laneLines.indexOf(selectedLaneLine);
        if (idx > -1) laneLines.splice(idx, 1);
        selectedLaneLine = null;
    }
});

// Function to apply style changes to the selected line
function updateSelectedLineStyle() {
    if (selectedLaneLine) {
        const newColor = document.querySelector('input[name="laneColor"]:checked').value;
        const newWidth = parseInt(document.querySelector('input[name="laneWidth"]:checked').value, 10);
        const newDash = document.querySelector('input[name="laneDash"]:checked').value;

        selectedLaneLine.setStyle({
            color: newColor,
            weight: newWidth,
            dashArray: newDash,
            lineJoin: "round",
            lineCap: "square"
        });

        // Update the saved style for persistence
        selectedLaneLine.myStyle = {
            color: newColor,
            weight: newWidth,
            dashArray: newDash,
            lineJoin: "round",
            lineCap: "square"
        };
    }
}

// Add event listeners to update the selected line immediately
document.querySelectorAll('input[name="laneColor"]').forEach(input => {
    input.addEventListener('change', updateSelectedLineStyle);
});

document.querySelectorAll('input[name="laneWidth"]').forEach(input => {
    input.addEventListener('change', updateSelectedLineStyle);
});

document.querySelectorAll('input[name="laneDash"]').forEach(input => {
    input.addEventListener('change', updateSelectedLineStyle);
});

// Function to offset a line by X feet
function offsetLine(line, offsetFeet) {
    const latlngs = line.getLatLngs();
    units = 'feet';
    distance = offsetFeet;
    const offsetMeters = offsetFeet * 0.3048; // Convert feet to meters
    const coords = latlngs.map(ll => [ll.lng, ll.lat]);

    // Use Turf.js to calculate the offset line
    const lineString = turf.lineString(coords);
    const lineCoords = lineString.geometry.coordinates;
    const transformAngle = distance < 0 ? -90 : 90;
    if (distance < 0) distance = -distance;

    const offsetLines = [];
    for (let i = 0; i < lineCoords.length - 1; i++) { // Translating each segment of the line to correct position
        const angle = turf.bearing(lineCoords[i], lineCoords[i + 1]) + transformAngle;
        const firstPoint = turf.transformTranslate(turf.point(lineCoords[i]), distance, angle, { units })?.geometry.coordinates;
        const secondPoint = turf.transformTranslate(turf.point(lineCoords[i + 1]), distance, angle, { units })?.geometry.coordinates;
        offsetLines.push([firstPoint, secondPoint]);
    }

    const offsetCoords = [offsetLines[0][0]]; // First point inserted
    for (let i = 0; i < offsetLines.length; i++) { // For each translated segment of the initial line
        if (offsetLines[i + 1]) { // If there's another segment after this one
            const firstLine = turf.transformScale(turf.lineString(offsetLines[i]), 2); // transformScale is useful in case the two segment don't have an intersection point
            const secondLine = turf.transformScale(turf.lineString(offsetLines[i + 1]), 2); // Which happen when the resulting offset line is bigger than the initial one
            // We're calculating the intersection point between the two translated & scaled segments
            if (turf.lineIntersect(firstLine, secondLine).features[0]) {
                offsetCoords.push(turf.lineIntersect(firstLine, secondLine).features[0].geometry.coordinates);
            }
        } else offsetCoords.push(offsetLines[i][1]); // If there's no other segment after this one, we simply push the last point of the line
    }

    const offsetLineString = turf.lineString(offsetCoords)

    // Convert the offset line back to Leaflet LatLngs
    const offsetCoordsOutput = offsetLineString.geometry.coordinates.map(coord => L.latLng(coord[1], coord[0]));
    return offsetCoordsOutput;
}

// Function to create a new offset line
function createOffsetLine() {
    if (!selectedLaneLine) {
        alert("Please select a line first.");
        return;
    }

    const offsetFeet = parseFloat(prompt("Enter right-side offset distance in feet (negative values will offset left-side):", "10"));
    if (isNaN(offsetFeet)) {
        alert("Invalid offset distance.");
        return;
    }

    const offsetLatLngs = offsetLine(selectedLaneLine, offsetFeet);
    const newLine = L.polyline(offsetLatLngs, {
        color: selectedLaneLine.myStyle.color,
        weight: selectedLaneLine.myStyle.weight,
        dashArray: selectedLaneLine.myStyle.dashArray,
        lineJoin: "round",
        lineCap: "square"
    }).addTo(laneLinesLayer);

    newLine.myStyle = { ...selectedLaneLine.myStyle };
    laneLines.push(newLine);

    newLine.on('click', function (ev) {
        L.DomEvent.stopPropagation(ev);
        selectLine(newLine);
    });
}

// Add event listener to the "New Offset Line" button
document.getElementById('newOffsetLine').addEventListener('click', createOffsetLine);

// --- Pavement Color (Polygon) Section ---
document.getElementById('drawPavementPolygon').addEventListener('click', function () {
    const strokeColor = document.getElementById('pavementStroke').value;
    const fillColor = document.getElementById('pavementFill').value;
    const fillOpacity = parseFloat(document.getElementById('pavementFillOpacity').value);
    var polygon = map.editTools.startPolygon();
    polygon.on('editable:drawing:end', function () {
        const latlngs = polygon.getLatLngs()[0] || polygon.getLatLngs();
        if (!latlngs || latlngs.length < 3) { console.error("Invalid polygon"); return; }
        if (polygon.disableEdit) { polygon.disableEdit(); }
        polygon.setStyle({
            color: strokeColor,
            weight: 0,
            fillColor: fillColor,
            fillOpacity: fillOpacity,
            pane: 'pavementPane'
        });
        polygon.myStyle = {
            color: strokeColor,
            weight: 0,
            fillColor: fillColor,
            fillOpacity: fillOpacity,
            pane: 'pavementPane'
        };
        pavementPolygonsLayer.addLayer(polygon);
        pavementPolygons.push(polygon);
        polygon.off('editable:drawing:commit editable:drawing:end');
        polygon.on('click', function (ev) {
            if (document.getElementById('pavementColorTab').style.display !== "none") {
                L.DomEvent.stopPropagation(ev);
            }
            deselectAllPavementPolygons(); // Deselect all polygons first
            selectedPavementPolygon = polygon;
            polygon.setStyle({ dashArray: "20,20", weight: 5, color: 'red' });
            updatePavementAreaDisplay(polygon); // Update area display
        });
        addPavementPolygonToLayer(polygon);
    });
});

document.getElementById('editPavementPolygon').addEventListener('click', function () {
    if (selectedPavementPolygon) { selectedPavementPolygon.enableEdit(); }
});

document.getElementById('pavementFill').addEventListener('change', function () {
    const newFillColor = this.value;
    document.getElementById('pavementFill').textContent = this.value;
    if (selectedPavementPolygon) {
        selectedPavementPolygon.setStyle({ fillColor: newFillColor });
        // Also update the saved style so future edits persist the new opacity.
        selectedPavementPolygon.myStyle.fillColor = newFillColor;
    }
});

document.getElementById('pavementFillOpacity').addEventListener('click', function () {
    const newOpacity = parseFloat(this.value);
    document.getElementById('pavementFillOpacityValue').textContent = this.value;
    if (selectedPavementPolygon) {
        selectedPavementPolygon.setStyle({ fillOpacity: newOpacity });
        // Also update the saved style so future edits persist the new opacity.
        selectedPavementPolygon.myStyle.fillOpacity = newOpacity;
    }
});

document.getElementById('removePavementPolygon').addEventListener('click', function () {
    if (selectedPavementPolygon) {
        pavementPolygonsLayer.removeLayer(selectedPavementPolygon);
        const idx = pavementPolygons.indexOf(selectedPavementPolygon);
        if (idx > -1) pavementPolygons.splice(idx, 1);
        selectedPavementPolygon = null;
    }
});

// Function to calculate the area of a polygon in square feet and square yards
function calculatePolygonArea(polygon) {
    const latLngs = polygon.getLatLngs()[0] || polygon.getLatLngs();
    const coordinates = latLngs.map(latlng => [latlng.lng, latlng.lat]);

    // Ensure the polygon is closed by checking if the first and last coordinates are the same
    if (coordinates.length > 0) {
        const firstCoord = coordinates[0];
        const lastCoord = coordinates[coordinates.length - 1];
        if (firstCoord[0] !== lastCoord[0] || firstCoord[1] !== lastCoord[1]) {
            coordinates.push(firstCoord); // Add the first coordinate to the end to close the polygon
        }
    }

    const geojsonPolygon = turf.polygon([coordinates]);
    const areaInSquareMeters = turf.area(geojsonPolygon);
    const areaInSquareFeet = areaInSquareMeters * 10.7639; // Convert to square feet
    const areaInSquareYards = areaInSquareFeet / 9; // Convert to square yards
    return { squareFeet: areaInSquareFeet, squareYards: areaInSquareYards };
}

// Update the area display when a polygon is clicked
function updatePavementAreaDisplay(polygon) {
    if (polygon) {
        const area = calculatePolygonArea(polygon);
        document.getElementById('pavementArea').textContent = `Area: ${area.squareFeet.toFixed(0)} sqft (${area.squareYards.toFixed(0)} sqyd)`;
    } else {
        // Hide the area display if no polygon is selected
        document.getElementById('pavementArea').textContent = '';
    }
}

// --- Save/Load GeoJSON with coordinates rounded to 6 decimals ---
document.getElementById('saveGeoJson').addEventListener('click', function () {
    const features = [];
    // This Set holds geometry signatures we've already processed.
    const geometrySignatures = new Set();

    // Helper function to create a signature string from an array of coordinate pairs.
    function createCoordsSignature(coordsArray) {
        // e.g. "lng1,lat1|lng2,lat2|...|lngN,latN"
        return coordsArray.map(([lng, lat]) => `${lng},${lat}`).join('|');
    }

    // Markers
    markers.forEach(marker => {
        const latlng = marker.getLatLng();
        const lng = Number(latlng.lng.toFixed(6));
        const lat = Number(latlng.lat.toFixed(6));

        // Create signature for the marker geometry
        const signature = `Point:${lng},${lat}`;

        if (!geometrySignatures.has(signature)) {
            geometrySignatures.add(signature);
            features.push({
                type: "Feature",
                properties: {
                    type: "marking",
                    rotation: marker.options.rotationAngle,
                    icon: marker.myIconUrl
                },
                geometry: {
                    type: "Point",
                    coordinates: [lng, lat]
                }
            });
        }
    });

    // Lane lines
    laneLines.forEach(line => {
        const latlngs = line.getLatLngs();
        // Convert to [ [lng, lat], ... ] using 6-decimal rounding
        const coords = latlngs.map(ll => [
            Number(ll.lng.toFixed(6)),
            Number(ll.lat.toFixed(6))
        ]);

        // Create signature for the linestring
        const signature = `LineString:${createCoordsSignature(coords)}`;

        if (!geometrySignatures.has(signature)) {
            geometrySignatures.add(signature);
            features.push({
                type: "Feature",
                properties: {
                    type: "lane",
                    style: line.myStyle
                },
                geometry: {
                    type: "LineString",
                    coordinates: coords
                }
            });
        }
    });

    // Pavement polygons (assume single-ring)
    pavementPolygons.forEach(polygon => {
        const latlngs = polygon.getLatLngs()[0] || polygon.getLatLngs();
        // Convert to [ [lng, lat], ... ] using 6-decimal rounding
        const coords = latlngs.map(ll => [
            Number(ll.lng.toFixed(6)),
            Number(ll.lat.toFixed(6))
        ]);

        // Create signature for the polygon ring
        const signature = `Polygon:${createCoordsSignature(coords)}`;

        if (!geometrySignatures.has(signature)) {
            geometrySignatures.add(signature);
            features.push({
                type: "Feature",
                properties: {
                    type: "pavement",
                    style: polygon.myStyle
                },
                geometry: {
                    type: "Polygon",
                    coordinates: [coords]
                }
            });
        }
    });

    // Project settings:
    const project = {
        name: document.getElementById('projectNameInput').value || document.getElementById('projectNameLabel').textContent,
        initialCenter: [
            Number(document.getElementById('initialLat').value),
            Number(document.getElementById('initialLng').value)
        ],
        initialZoom: Number(document.getElementById('initialZoom').value),
        tileLayers: tileLayers.map(tl => ({
            name: tl.name,
            url: tl.url,
            zoomOffset: tl.layer.options.zoomOffset || 0
        }))
    };

    // Get the project name from the input or label.
    const projectName = document.getElementById('projectNameInput').value || document.getElementById('projectNameLabel').textContent;
    // Replace any character that isn't a letter, number, dash, or underscore with an underscore.
    const safeProjectName = projectName.replace(/[^a-zA-Z0-9-_]/g, '_') + '.geojson';
    // Append the .geojson extension.


    const geojson = { type: "FeatureCollection", features: features, project: project };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(geojson));
    const a = document.createElement('a');
    a.setAttribute("href", dataStr);
    a.setAttribute("download", safeProjectName);
    document.body.appendChild(a);
    a.click();
    a.remove();
});

document.getElementById('loadGeoJsonBtn').addEventListener('click', function () {
    document.getElementById('loadGeoJson').click();
});

// Function to load a GeoJSON file from a URL
function loadGeoJsonFromUrl(url) {
    fetch(url)
        .then(response => {
            console.log(response);
            if (!response.ok) {
                throw new Error(`Failed to fetch GeoJSON file: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            // Process the GeoJSON data
            loadFeaturesFromGeoJson(data)
            console.log("GeoJSON loaded successfully.");
        })
        .catch(error => {
            console.error("Error loading GeoJSON:", error);
        });
}

// Check for a GeoJSON file in the URL query parameters
const urlParams = new URLSearchParams(window.location.search);
const geoJsonUrl = urlParams.get('file');
if (geoJsonUrl) {
    loadGeoJsonFromUrl(geoJsonUrl);
}

function loadFeaturesFromGeoJson(geojson) {
    try {
        geojson.features.forEach(feature => {
            if (feature.geometry.type === "Point" && feature.properties.type === "marking") {
                const coords = feature.geometry.coordinates;
                const latlng = L.latLng(coords[1], coords[0]);
                const rotation = feature.properties.rotation;
                const iconUrl = feature.properties.icon;
                const marker = L.marker(latlng, {
                    icon: getIconForZoom(map.getZoom(), iconUrl),
                    rotationAngle: rotation,
                    rotationOrigin: 'center center',
                    draggable: false,
                    pane: 'overlayPane'
                }).addTo(map);
                marker.myIconUrl = iconUrl;
                markers.push(marker);
                marker.on('click', function (ev) {
                    L.DomEvent.stopPropagation(ev);
                    if (selectedMarker && selectedMarker !== marker) {
                        deselectMarker();
                    }
                    selectedMarker = marker;
                    marker.dragging.enable();
                    highlightMarker(marker);
                    document.getElementById('angleValue').textContent = Math.round(marker.options.rotationAngle) + '°';
                    const rad = marker.options.rotationAngle * Math.PI / 180;
                    document.getElementById('angleLine').setAttribute('x2', 50 + 40 * Math.sin(rad));
                    document.getElementById('angleLine').setAttribute('y2', 50 - 40 * Math.cos(rad));
                });
                addMarkerToLayer(marker);
            } else if (feature.geometry.type === "LineString" && feature.properties.type === "lane") {
                const coords = feature.geometry.coordinates;
                const latlngs = coords.map(c => L.latLng(c[1], c[0]));
                const style = feature.properties.style;
                const polyline = L.polyline(latlngs, {
                    color: style.color,
                    weight: style.weight,
                    dashArray: style.dashArray,
                    lineJoin: style.lineJoin,
                    lineCap: style.lineCap,
                    pane: 'overlayPane'
                }).addTo(laneLinesLayer);
                polyline.myStyle = style;
                laneLines.push(polyline);
                polyline.on('click', function (ev) {
                    L.DomEvent.stopPropagation(ev);
                    selectLine(polyline);
                });
                addLaneLineToLayer(polyline);
            } else if (feature.geometry.type === "Polygon" && feature.properties.type === "pavement") {
                const coords = feature.geometry.coordinates[0]; // assume single-ring
                const latlngs = coords.map(c => L.latLng(c[1], c[0]));
                const style = feature.properties.style;
                const poly = L.polygon(latlngs, {
                    color: style.color,
                    weight: style.weight,
                    fillColor: style.fillColor,
                    fillOpacity: style.fillOpacity,
                    pane: 'pavementPane'
                }).addTo(pavementPolygonsLayer);
                poly.myStyle = style;
                pavementPolygons.push(poly);
                poly.on('click', function (ev) {
                    L.DomEvent.stopPropagation(ev);
                    deselectAllPavementPolygons(); // Deselect all polygons first
                    if (selectedPavementPolygon && selectedPavementPolygon !== poly) {
                        selectedPavementPolygon.setStyle({ dashArray: selectedPavementPolygon.myStyle.dashArray || "" });
                    }
                    selectedPavementPolygon = poly;
                    poly.setStyle({ dashArray: "20,20", weight: 5, color: 'red' });
                    updatePavementAreaDisplay(poly);
                });
                poly.disableEdit();
                poly.options.interactive = false;
                if (poly._path) {
                    poly._path.style.pointerEvents = "none";
                }
                addPavementPolygonToLayer(poly);
            }
        });

        // Update project settings if available.
        if (geojson.project) {
            if (!geojson.project || !geojson.project.name || !geojson.project.name.trim()) {
                document.getElementById('projectNameLabel').textContent = baseName;
                document.getElementById('projectNameInput').value = baseName;
            } else {
                document.getElementById('projectNameLabel').textContent = geojson.project.name;
                document.getElementById('projectNameInput').value = geojson.project.name;
            }

            document.getElementById('initialLat').value = geojson.project.initialCenter ? geojson.project.initialCenter[0] : "";
            document.getElementById('initialLng').value = geojson.project.initialCenter ? geojson.project.initialCenter[1] : "";
            document.getElementById('initialZoom').value = geojson.project.initialZoom || 21;
            // Update tile layer checkboxes.

            // Set map view to project initial settings.
            if (geojson.project.initialCenter) {
                map.setView(geojson.project.initialCenter, geojson.project.initialZoom);
            } else {
                // Zoom to features if `initialCenter` is not provided.
                let bounds = new L.LatLngBounds();
                markers.forEach(m => bounds.extend(m.getLatLng()));
                laneLines.forEach(l => l.getLatLngs().forEach(ll => bounds.extend(ll)));
                pavementPolygons.forEach(p => p.getLatLngs()[0].forEach(ll => bounds.extend(ll)));
                if (bounds.isValid()) {
                    map.fitBounds(bounds);
                }
            }
            const projectName = geojson.project.name || file.name.replace(/\.[^/.]+$/, ""); // Use file name if no project name
            document.getElementById('projectNameLabel').textContent = projectName;
            document.getElementById('projectNameInput').value = projectName;
            updateHtmlTitle(projectName); // Update the title
        }
        // Zoom to features if project settings not provided.
        else {
            let bounds = new L.LatLngBounds();
            markers.forEach(m => bounds.extend(m.getLatLng()));
            laneLines.forEach(l => l.getLatLngs().forEach(ll => bounds.extend(ll)));
            pavementPolygons.forEach(p => p.getLatLngs()[0].forEach(ll => bounds.extend(ll)));
            if (bounds.isValid()) { map.fitBounds(bounds); }
        }
    } catch (err) {
        alert("Error reading GeoJSON: " + err);
    }
}

document.getElementById('loadGeoJson').addEventListener('input', function (e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        const geojson = JSON.parse(e.target.result);
        loadFeaturesFromGeoJson(geojson)
    };
    reader.readAsText(file);
});

// --- Tile Layer Management in Project Settings ---
// const tileLayerCheckboxes = document.querySelectorAll('.tileLayerCheckbox');
// tileLayerCheckboxes.forEach(cb => {
//     cb.addEventListener('change', function () {
//         const name = this.getAttribute('data-name');
//         tileLayers.forEach(t => {
//             if (t.name === name) {
//                 t.visible = this.checked;
//                 if (this.checked) { t.layer.addTo(map); }
//                 else { map.removeLayer(t.layer); }
//             }
//         });
//     });
// });    

// --- Zoom-dependent Updates ---
map.on('zoomend', function () {
    const currentZoom = map.getZoom();
    markers.forEach(marker => {
        if (marker.myIconUrl.includes('MUTCD')) {
            className = 'marker-icon-sign';
        } else {
            className = 'marker-icon-default';
        }
        marker.setIcon(getIconForZoom(currentZoom, marker.myIconUrl, className));
    });
    if (highlightCircle && selectedMarker) {
        const factor = Math.pow(0.5, 21 - currentZoom);
        highlightCircle.setRadius(40 * factor);
        highlightCircle.setLatLng(selectedMarker.getLatLng());
    }
    laneLines.forEach(line => {
        const originalDash = line.myStyle.dashArray;
        if (originalDash && originalDash.trim() !== "") {
            const dashFactor = Math.pow(0.5, 21 - currentZoom);
            const dashParts = originalDash.split(",").map(Number);
            const scaledDash = dashParts.map(v => Math.max(1, Math.round(v * dashFactor))).join(",");
            line.setStyle({ dashArray: scaledDash });
        } else {
            line.setStyle({ dashArray: "" });
        }
        const originalWeight = line.myStyle.weight;
        if (currentZoom < 21) {
            let weightFactor = Math.pow(0.5, 21 - currentZoom);
            line.setStyle({ weight: originalWeight * weightFactor });
        } else {
            line.setStyle({ weight: originalWeight });
        }
    });
});

function updatePavementPaneInteractivity() {
    // When pavementColor tab is active, interactive is true; otherwise false.
    const interactive = (pavementColorTab.style.display !== "none");
    pavementPolygons.forEach(poly => {
        if (poly.setInteractive) {
            poly.disable();
        } else {
            // Fallback: update the option and force a redraw.
            poly.options.interactive = interactive;
            if (poly.redraw) { poly.redraw(); }
        }
    });
}

function disablePavementEditing() {
    pavementPolygons.forEach(poly => {
        if (poly.disableEdit) {
            poly.disableEdit();  // turn off editing handles if they were active
        }
        // Mark the polygon as non-interactive so clicks fall through
        poly.options.interactive = false;
        if (poly._path) {
            poly._path.style.pointerEvents = "none";
        }
    });
}
disablePavementEditing();

function enablePavementEditing() {
    pavementPolygons.forEach(poly => {
        // Mark the polygon as interactive so it can be selected/edited
        poly.options.interactive = true;
        if (poly._path) {
            poly._path.style.pointerEvents = "auto";
        }
    });
}

// When the label is clicked, hide it and show the input and OK button.
// document.getElementById('projectNameLabel').addEventListener('click', function () {
//     this.style.display = 'none';
//     const input = document.getElementById('projectNameInput');
//     const okButton = document.getElementById('projectNameOk');
//     input.style.display = 'inline-block';
//     okButton.style.display = 'inline-block';
//     input.focus();
// });

// When the OK button is clicked, update the label and hide the input.
document.getElementById('projectNameOk').addEventListener('click', function () {
    const input = document.getElementById('projectNameInput');
    const label = document.getElementById('projectNameLabel');
    const projectName = input.value;
    label.textContent = projectName;
    input.style.display = 'none';
    this.style.display = 'none';
    label.style.display = 'inline-block';
    document.getElementById('projectNameEdit').style.display = 'inline-block';
    updateHtmlTitle(projectName); // Update the title
});

document.getElementById('updateProjectSettings').addEventListener('click', function () {
    const center = map.getCenter();
    document.getElementById('initialLat').value = center.lat.toFixed(6);
    document.getElementById('initialLng').value = center.lng.toFixed(6);
    document.getElementById('initialZoom').value = map.getZoom();
});

document.addEventListener('keydown', function (e) {
    if (isProjectNameInputFocused) return; // Skip shortcuts if input is focused

    if (e.key === 'l') {
        showTabLaneLines();
        // Call the function that begins drawing a new lane line.
        startDrawingLaneLine();
    }
});

document.addEventListener('keydown', function (e) {
    if (isProjectNameInputFocused) return; // Skip shortcuts if input is focused

    if (e.key === 'o') {
        // showTabLaneLines();
        // Call the function that begins drawing a new lane line.
        createOffsetLine();
    }
});

// In your script, add an event listener to remove all features:
document.getElementById('clearMap').addEventListener('click', function () {
    if (confirm('Are you sure you want to clear the map? This will remove all markers, lane lines, and pavement polygons.')) {
        // Remove all markers
        markers.forEach(m => map.removeLayer(m));
        markers.length = 0;

        // Remove all lane lines
        laneLines.forEach(l => map.removeLayer(l));
        laneLines.length = 0;

        // Remove all pavement polygons
        pavementPolygons.forEach(p => map.removeLayer(p));
        pavementPolygons.length = 0;

        // Reset the loadGeoJson file input
        const loadGeoJsonInput = document.getElementById('loadGeoJson');
        loadGeoJsonInput.value = ''; // Clear the input value
    }
});

// A snippet to handle clicking the edit icon.
// It hides the label & icon, shows the text input & OK button for editing.
document.getElementById('projectNameEdit').addEventListener('click', function () {
    document.getElementById('projectNameLabel').style.display = 'none';
    this.style.display = 'none';
    const input = document.getElementById('projectNameInput');
    const okButton = document.getElementById('projectNameOk');
    input.style.display = 'inline-block';
    okButton.style.display = 'inline-block';
    input.focus();
});

// Toggle a 'collapsed' class on the #control element when the collapse button is clicked.
document.getElementById('collapseButton').addEventListener('click', function () {
    const controlBox = document.getElementById('control');
    controlBox.classList.toggle('collapsed');
});

document.getElementById('deleteMarkers').addEventListener('click', function () {
    if (confirm('Are you sure you want to delete all markers?')) {
        markers.forEach(m => map.removeLayer(m));
        markers.length = 0; // clear the array
    }
});

document.getElementById('deleteLaneLines').addEventListener('click', function () {
    if (confirm('Are you sure you want to delete all lane lines?')) {
        laneLines.forEach(l => map.removeLayer(l));
        laneLines.length = 0; // clear the array
    }
});

// Function to deselect all features
function deselectAllFeatures() {
    if (selectedLaneLine) {
        selectedLaneLine.setStyle({
            dashArray: selectedLaneLine.myStyle.dashArray,
            color: selectedLaneLine.myStyle.color
        });
        selectedLaneLine.disableEdit();
        selectedLaneLine = null;
        restoreSelectors(); // Restore selectors to previous settings
        removeArrowheads(); // Remove arrowheads when deselecting
    }

    if (selectedMarker) {
        deselectMarker();
    }

    if (selectedPavementPolygon) {
        selectedPavementPolygon.setStyle({
            dashArray: selectedPavementPolygon.myStyle.dashArray || "",
            weight: 0
        });
        if (selectedPavementPolygon.disableEdit) {
            selectedPavementPolygon.disableEdit();
        }
        selectedPavementPolygon = null;
    }
}

// Add event listener for the "Esc" key
document.addEventListener('keydown', function (e) {
    if (isProjectNameInputFocused) return; // Skip shortcuts if input is focused

    if (e.key === 'Escape') {
        deselectAllFeatures();
    }
});

let arrowDecorator = null;

// Function to add arrowheads to a selected line
function addArrowheads(line) {
    const latlngs = line.getLatLngs();
    if (latlngs.length < 2) return;
    // Remove any existing arrowheads before adding new ones
    removeArrowheads();

    // Create a polyline decorator for arrowheads
    arrowDecorator = L.polylineDecorator(line, {
        patterns: [
            {
                offset: '10',
                repeat: '50',
                symbol: L.Symbol.arrowHead({
                    pixelSize: 10,
                    polygon: false,
                    pathOptions: { stroke: true, color: 'red', weight: 2 }
                })
            }
        ]
    }).addTo(map);
}

// Function to remove arrowheads
function removeArrowheads() {
    if (arrowDecorator) {
        map.removeLayer(arrowDecorator);
        arrowDecorator = null;
    }
}// Function to reset arrowheads when the line is edited
    function resetArrowheadsOnEdit(line) {
        line.on('editable:vertex:dragend editable:vertex:deleted', function () {
            addArrowheads(line); // Re-add arrowheads after editing
        });
    }

// Update the line selection logic to include arrowheads
function selectLine(line) {
    if (selectedLaneLine && selectedLaneLine !== line) {
        selectedLaneLine.setStyle({
            dashArray: selectedLaneLine.myStyle.dashArray,
            color: selectedLaneLine.myStyle.color
        });
        selectedLaneLine.disableEdit();
        removeArrowheads(); // Remove arrowheads from the previously selected line
        restoreSelectors();
    }

    selectedLaneLine = line;
    setSelectorsFromLine(line);
    line.enableEdit();
    addArrowheads(line); // Add arrowheads to the newly selected line
    resetArrowheadsOnEdit(line);
}

// // Update the click event for lines to use the new selection logic
// laneLines.forEach(line => {
//     line.on('click', function (ev) {
//         L.DomEvent.stopPropagation(ev);
//         selectLine(line);
//     });
// });

// Ensure deselection removes the arrowheads
function deselectAllLineStrings() {
    if (selectedLaneLine) {
        selectedLaneLine.setStyle({
            dashArray: selectedLaneLine.myStyle.dashArray,
            color: selectedLaneLine.myStyle.color
        });
        selectedLaneLine.disableEdit();
        removeArrowheads(); // Remove arrowheads when deselecting
        selectedLaneLine = null;
        restoreSelectors();
    }
}

// Add event listener for the 'Delete' key
document.addEventListener('keydown', function (e) {
    if (isProjectNameInputFocused) return; // Skip shortcuts if input is focused

    if (e.key === 'r') {
        if (selectedMarker) {
            // Trigger marker removal
            map.removeLayer(selectedMarker);
            const idx = markers.indexOf(selectedMarker);
            if (idx > -1) markers.splice(idx, 1);
            deselectMarker();
        } else if (selectedLaneLine) {
            // Trigger line string removal
            laneLinesLayer.removeLayer(selectedLaneLine);
            const idx = laneLines.indexOf(selectedLaneLine);
            if (idx > -1) laneLines.splice(idx, 1);
            selectedLaneLine = null;
            removeArrowheads(); // Ensure arrowheads are removed
        }
    }
});

// Add event listener for the 'F' key to run the rotate180 function
document.addEventListener('keydown', function (e) {
    if (isProjectNameInputFocused) return; // Skip shortcuts if input is focused

    if (e.key === 'f') {
        const angleValue = document.getElementById('angleValue');
        let currentAngle = parseInt(angleValue.textContent);
        currentAngle = (currentAngle + 180) % 360;
        angleValue.textContent = currentAngle + '°';
        const rad = currentAngle * Math.PI / 180;
        document.getElementById('angleLine').setAttribute('x2', 50 + 40 * Math.sin(rad));
        document.getElementById('angleLine').setAttribute('y2', 50 - 40 * Math.cos(rad));
        if (selectedMarker) {
            selectedMarker.setRotationAngle(currentAngle);
        }
    }
});

// Function to calculate the area of a polygon in square feet and square yards
function calculatePolygonArea(polygon) {
    const latLngs = polygon.getLatLngs()[0] || polygon.getLatLngs();
    const coordinates = latLngs.map(latlng => [latlng.lng, latlng.lat]);

    // Ensure the polygon is closed by checking if the first and last coordinates are the same
    if (coordinates.length > 0) {
        const firstCoord = coordinates[0];
        const lastCoord = coordinates[coordinates.length - 1];
        if (firstCoord[0] !== lastCoord[0] || firstCoord[1] !== lastCoord[1]) {
            coordinates.push(firstCoord); // Add the first coordinate to the end to close the polygon
        }
    }

    const geojsonPolygon = turf.polygon([coordinates]);
    const areaInSquareMeters = turf.area(geojsonPolygon);
    const areaInSquareFeet = areaInSquareMeters * 10.7639; // Convert to square feet
    const areaInSquareYards = areaInSquareFeet / 9; // Convert to square yards
    return { squareFeet: areaInSquareFeet, squareYards: areaInSquareYards };
}

// Update the area display when a polygon is clicked
function updatePavementAreaDisplay(polygon) {
    if (polygon) {
        const area = calculatePolygonArea(polygon);
        document.getElementById('pavementArea').textContent = `Area: ${area.squareFeet.toFixed(0)} sqft (${area.squareYards.toFixed(0)} sqyd)`;
    } else {
        // Hide the area display if no polygon is selected
        document.getElementById('pavementArea').textContent = '';
    }
}

// Function to update the HTML title
function updateHtmlTitle(projectName) {
    document.title = `${projectName} - Streetscape`;
}

// Update the title when the project name is updated
document.getElementById('projectNameOk').addEventListener('click', function () {
    const input = document.getElementById('projectNameInput');
    const label = document.getElementById('projectNameLabel');
    const projectName = input.value;
    label.textContent = projectName;
    input.style.display = 'none';
    this.style.display = 'none';
    label.style.display = 'inline-block';
    document.getElementById('projectNameEdit').style.display = 'inline-block';
    updateHtmlTitle(projectName); // Update the title
});

// Update the title when loading a GeoJSON file
document.getElementById('loadGeoJson').addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const geojson = JSON.parse(e.target.result);
            // ...existing code...
            if (geojson.project) {
                const projectName = geojson.project.name || file.name.replace(/\.[^/.]+$/, ""); // Use file name if no project name
                document.getElementById('projectNameLabel').textContent = projectName;
                document.getElementById('projectNameInput').value = projectName;
                updateHtmlTitle(projectName); // Update the title
            }
            // ...existing code...
        } catch (err) {
            alert("Error reading GeoJSON: " + err);
        }
    };
    reader.readAsText(file);
});

// Disable shortcut keys when projectNameInput is focused
let isProjectNameInputFocused = false;

// Update the global variable on focus/blur events
const projectNameInput = document.getElementById('projectNameInput');
projectNameInput.addEventListener('focus', function () {
    isProjectNameInputFocused = true;
});

projectNameInput.addEventListener('blur', function () {
    isProjectNameInputFocused = false;
});