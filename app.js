let map;
let marker;
let polyline;
let watchId;

let tracking = false;

let trackPoints = [];

let totalDistance = 0;
let elevationGain = 0;
let elevationLoss = 0;

let startTime;

initializeMap();

function initializeMap() {

    map = L.map('map').setView([48.8566, 2.3522], 13);

    L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        {
            attribution:'© OpenStreetMap'
        }
    ).addTo(map);

    polyline = L.polyline([], {
        color:'blue',
        weight:5
    }).addTo(map);
}

document
.getElementById('startBtn')
.addEventListener('click', startTracking);

document
.getElementById('stopBtn')
.addEventListener('click', stopTracking);

function startTracking(){

    if(tracking) return;

    tracking = true;

    trackPoints = [];
    totalDistance = 0;
    elevationGain = 0;
    elevationLoss = 0;

    startTime = Date.now();

    watchId = navigator.geolocation.watchPosition(

        updatePosition,

        error => {
            alert(error.message);
        },

        {
            enableHighAccuracy:true,
            maximumAge:0,
            timeout:10000
        }
    );

    setInterval(updateDuration,1000);
}

function stopTracking(){

    tracking = false;

    if(watchId){
        navigator.geolocation.clearWatch(watchId);
    }
}

function updatePosition(position){

    const lat = position.coords.latitude;
    const lon = position.coords.longitude;
    const alt = position.coords.altitude || 0;

    const point = {
        lat,
        lon,
        alt,
        time:Date.now()
    };

    if(trackPoints.length > 0){

        const previous = trackPoints[trackPoints.length-1];

        const d = haversine(
            previous.lat,
            previous.lon,
            point.lat,
            point.lon
        );

        if(d > 2){

            totalDistance += d;

            const altDiff = alt - previous.alt;

            if(altDiff > 3){
                elevationGain += altDiff;
            }

            if(altDiff < -3){
                elevationLoss += Math.abs(altDiff);
            }
        }
    }

    trackPoints.push(point);

    updateDisplay();

    if(marker){
        marker.setLatLng([lat,lon]);
    }else{
        marker = L.marker([lat,lon]).addTo(map);
    }

    polyline.addLatLng([lat,lon]);

    map.setView([lat,lon]);
}

function updateDisplay(){

    document.getElementById("distance").textContent =
        (totalDistance/1000).toFixed(2) + " km";

    document.getElementById("altitude").textContent =
        Math.round(
            trackPoints[trackPoints.length-1]?.alt || 0
        ) + " m";

    document.getElementById("elevationGain").textContent =
        Math.round(elevationGain) + " m";

    document.getElementById("elevationLoss").textContent =
        Math.round(elevationLoss) + " m";

    const elapsed =
        (Date.now() - startTime) / 1000 / 3600;

    const avg =
        elapsed > 0
            ? (totalDistance/1000) / elapsed
            : 0;

    document.getElementById("avgSpeed").textContent =
        avg.toFixed(1) + " km/h";
}

function updateDuration(){

    if(!tracking) return;

    const elapsed =
        Math.floor(
            (Date.now()-startTime)/1000
        );

    const h =
        String(Math.floor(elapsed/3600))
        .padStart(2,'0');

    const m =
        String(Math.floor((elapsed%3600)/60))
        .padStart(2,'0');

    const s =
        String(elapsed%60)
        .padStart(2,'0');

    document.getElementById("duration").textContent =
        `${h}:${m}:${s}`;
}

function haversine(lat1, lon1, lat2, lon2){

    const R = 6371000;

    const dLat =
        (lat2-lat1)*Math.PI/180;

    const dLon =
        (lon2-lon1)*Math.PI/180;

    const a =
        Math.sin(dLat/2) *
        Math.sin(dLat/2)
        +
        Math.cos(lat1*Math.PI/180)
        *
        Math.cos(lat2*Math.PI/180)
        *
        Math.sin(dLon/2)
        *
        Math.sin(dLon/2);

    const c =
        2*Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1-a)
        );

    return R*c;
}

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js');
}
