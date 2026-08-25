"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const getElement = (id) => document.getElementById(id);

  const startBtn = getElement("startBtn");
  const stopBtn = getElement("stopBtn");
  const statusElement = getElement("status");

  let map = null;
  let marker = null;
  let routeLine = null;

  let watchId = null;
  let timerId = null;
  let startedAt = 0;

  let points = [];
  let totalDistance = 0;
  let elevationGain = 0;
  let elevationLoss = 0;

  function setStatus(message, isError = false) {
    statusElement.textContent = message;
    statusElement.classList.toggle("error", isError);
  }

  function initializeMap() {
    if (typeof L === "undefined") {
      setStatus(
        "La carte n'a pas pu être chargée. Le suivi GPS reste utilisable.",
        true
      );
      return;
    }

    map = L.map("map").setView([48.8566, 2.3522], 13);

    L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap"
      }
    ).addTo(map);

    routeLine = L.polyline([], {
      color: "#0d6efd",
      weight: 5
    }).addTo(map);
  }

  function startTracking() {
    if (!navigator.geolocation) {
      setStatus(
        "La géolocalisation n'est pas disponible sur ce navigateur.",
        true
      );
      return;
    }

    resetTrip();

    startedAt = Date.now();

    startBtn.disabled = true;
    stopBtn.disabled = false;

    setStatus("Recherche du signal GPS...");

    updateDuration();

    timerId = window.setInterval(updateDuration, 1000);

    watchId = navigator.geolocation.watchPosition(
      updatePosition,
      handleGpsError,
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 20000
      }
    );
  }

  function stopTracking() {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
    }

    if (timerId !== null) {
      window.clearInterval(timerId);
    }

    watchId = null;
    timerId = null;

    startBtn.disabled = false;
    stopBtn.disabled = true;

    setStatus("Suivi arrêté");
  }

  function resetTrip() {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
    }

    if (timerId !== null) {
      window.clearInterval(timerId);
    }

    watchId = null;
    timerId = null;

    points = [];
    totalDistance = 0;
    elevationGain = 0;
    elevationLoss = 0;

    getElement("distance").textContent = "0.00 km";
    getElement("duration").textContent = "00:00:00";
    getElement("avgSpeed").textContent = "0.0 km/h";
    getElement("currentSpeed").textContent = "0.0 km/h";
    getElement("altitude").textContent = "Indisponible";
    getElement("accuracy").textContent = "Indisponible";
    getElement("elevationGain").textContent = "0 m";
    getElement("elevationLoss").textContent = "0 m";

    if (routeLine) {
      routeLine.setLatLngs([]);
    }
  }

  function updatePosition(position) {
    const coordinates = position.coords;

    const currentPoint = {
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      altitude: coordinates.altitude,
      timestamp: position.timestamp
    };

    const previousPoint =
      points.length > 0 ? points[points.length - 1] : null;

    if (previousPoint) {
      const segmentDistance = calculateDistance(
        previousPoint.latitude,
        previousPoint.longitude,
        currentPoint.latitude,
        currentPoint.longitude
      );

      const elapsedSeconds = Math.max(
        (currentPoint.timestamp - previousPoint.timestamp) / 1000,
        0.001
      );

      const speedMetersPerSecond =
        segmentDistance / elapsedSeconds;

      const pointIsValid =
        segmentDistance >= 1 &&
        speedMetersPerSecond < 60 &&
        coordinates.accuracy <= 100;

      if (pointIsValid) {
        totalDistance += segmentDistance;

        if (
          Number.isFinite(currentPoint.altitude) &&
          Number.isFinite(previousPoint.altitude)
        ) {
          const altitudeDifference =
            currentPoint.altitude - previousPoint.altitude;

          if (altitudeDifference >= 3) {
            elevationGain += altitudeDifference;
          }

          if (altitudeDifference <= -3) {
            elevationLoss += Math.abs(altitudeDifference);
          }
        }
      }
    }

    points.push(currentPoint);

    updateStatistics(coordinates);
    updateMap(currentPoint);

    setStatus(
      `GPS actif, précision ${Math.round(coordinates.accuracy)} m`
    );
  }

  function updateStatistics(coordinates) {
    getElement("distance").textContent =
      `${(totalDistance / 1000).toFixed(2)} km`;

    getElement("accuracy").textContent =
      `${Math.round(coordinates.accuracy)} m`;

    getElement("altitude").textContent =
      Number.isFinite(coordinates.altitude)
        ? `${Math.round(coordinates.altitude)} m`
        : "Indisponible";

    getElement("currentSpeed").textContent =
      Number.isFinite(coordinates.speed)
        ? `${(coordinates.speed * 3.6).toFixed(1)} km/h`
        : "0.0 km/h";

    getElement("elevationGain").textContent =
      `${Math.round(elevationGain)} m`;

    getElement("elevationLoss").textContent =
      `${Math.round(elevationLoss)} m`;

    updateAverageSpeed();
  }

  function updateMap(point) {
    if (!map) {
      return;
    }

    const position = [
      point.latitude,
      point.longitude
    ];

    if (!marker) {
      marker = L.marker(position).addTo(map);
    } else {
      marker.setLatLng(position);
    }

    routeLine.addLatLng(position);

    map.setView(
      position,
      Math.max(map.getZoom(), 16)
    );
  }

  function updateDuration() {
    if (!startedAt) {
      return;
    }

    const elapsedSeconds = Math.floor(
      (Date.now() - startedAt) / 1000
    );

    const hours = String(
      Math.floor(elapsedSeconds / 3600)
    ).padStart(2, "0");

    const minutes = String(
      Math.floor((elapsedSeconds % 3600) / 60)
    ).padStart(2, "0");

    const seconds = String(
      elapsedSeconds % 60
    ).padStart(2, "0");

    getElement("duration").textContent =
      `${hours}:${minutes}:${seconds}`;

    updateAverageSpeed();
  }

  function updateAverageSpeed() {
    if (!startedAt) {
      return;
    }

    const elapsedHours =
      (Date.now() - startedAt) / 3600000;

    const averageSpeed =
      elapsedHours > 0
        ? (totalDistance / 1000) / elapsedHours
        : 0;

    getElement("avgSpeed").textContent =
      `${averageSpeed.toFixed(1)} km/h`;
  }

  function handleGpsError(error) {
    const messages = {
      1: "Accès à la position refusé. Autorise la localisation dans les réglages du navigateur.",
      2: "Position GPS indisponible. Vérifie que la localisation du téléphone est activée.",
      3: "Le GPS met trop de temps à répondre. Réessaie à l'extérieur."
    };

    setStatus(
      messages[error.code] || `Erreur GPS : ${error.message}`,
      true
    );

    stopAfterError();
  }

  function stopAfterError() {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
    }

    if (timerId !== null) {
      window.clearInterval(timerId);
    }

    watchId = null;
    timerId = null;

    startBtn.disabled = false;
    stopBtn.disabled = true;
  }

  function calculateDistance(
    latitude1,
    longitude1,
    latitude2,
    longitude2
  ) {
    const earthRadius = 6371000;

    const toRadians = (value) =>
      value * Math.PI / 180;

    const latitudeDifference =
      toRadians(latitude2 - latitude1);

    const longitudeDifference =
      toRadians(longitude2 - longitude1);

    const calculation =
      Math.sin(latitudeDifference / 2) ** 2 +
      Math.cos(toRadians(latitude1)) *
      Math.cos(toRadians(latitude2)) *
      Math.sin(longitudeDifference / 2) ** 2;

    return earthRadius * 2 * Math.atan2(
      Math.sqrt(calculation),
      Math.sqrt(1 - calculation)
    );
  }

  startBtn.addEventListener("click", startTracking);
  stopBtn.addEventListener("click", stopTracking);

  initializeMap();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("sw.js")
      .catch((error) => {
        console.warn(
          "Service worker non chargé :",
          error
        );
      });
  }
});
