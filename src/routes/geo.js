/**
 * Geolocation Service Routes
 * Google Maps & OpenStreetMap integration for location services
 */

const express = require('express');
const router = express.Router();

const { asyncHandler, ValidationError } = require('../middleware/errorHandler');
const { authenticate } = require('../middleware/auth');
const { locationLimiter } = require('../middleware/rateLimiter');
const { isLatitude, isLongitude, isNumber } = require('../middleware/validate');
const { locationHistory, uuidv4, addActivity } = require('../models/store');

router.use(authenticate);

function haversineMeters(lat1, lon1, lat2, lon2) {
  const toRad = (degrees) => (degrees * Math.PI) / 180;
  const earthRadiusMeters = 6371000;
  const deltaLat = toRad(lat2 - lat1);
  const deltaLon = toRad(lon2 - lon1);
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
  return earthRadiusMeters * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

/**
 * POST /api/geo/reverse-geocode
 * Convert coordinates to address (Name the location)
 * Uses OpenStreetMap Nominatim API (free, no key required)
 */
router.post('/reverse-geocode', locationLimiter, asyncHandler(async (req, res) => {
  try {
    const { latitude, longitude } = req.body;

    // Validate coordinates
    isLatitude(latitude);
    isLongitude(longitude);

    // OpenStreetMap Nominatim API (free)
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
      {
        headers: { 'User-Agent': 'Suraksha-Safety-App' }
      }
    );

    if (!response.ok) {
      throw new Error('Reverse geocoding failed');
    }

    const data = await response.json();

    res.json({
      success: true,
      data: {
        address: data.address || {},
        displayName: data.display_name || 'Unknown Location',
        latitude,
        longitude
      }
    });
  } catch (err) {
    console.error('[ERROR] Reverse geocode failed:', err.message);
    res.json({
      success: true,
      data: {
        address: {},
        displayName: `Location: ${req.body.latitude.toFixed(4)}, ${req.body.longitude.toFixed(4)}`,
        latitude: req.body.latitude,
        longitude: req.body.longitude
      }
    });
  }
}));

/**
 * GET /api/geo/search-destinations
 * Search for destination suggestions using OpenStreetMap Nominatim.
 */
router.get('/search-destinations', locationLimiter, asyncHandler(async (req, res) => {
  const query = String(req.query.q || '').trim();

  if (!query) {
    return res.json({
      success: true,
      data: { suggestions: [] }
    });
  }

  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&addressdetails=1&q=${encodeURIComponent(query)}`,
    {
      headers: { 'User-Agent': 'Suraksha-Safety-App' }
    }
  );

  if (!response.ok) {
    throw new Error('Destination search failed');
  }

  const results = await response.json();
  const suggestions = Array.isArray(results)
    ? results.map((item) => ({
        name: item.display_name || query,
        latitude: parseFloat(item.lat),
        longitude: parseFloat(item.lon),
        type: item.type || item.class || 'place'
      }))
      .filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude))
    : [];

  if (!suggestions.length) {
    suggestions.push({
      name: query,
      latitude: null,
      longitude: null,
      type: 'query'
    });
  }

  res.json({
    success: true,
    data: { suggestions }
  });
}));

/**
 * POST /api/geo/route-plan
 * Resolve a destination and return route geometry for Safe Ride monitoring.
 */
router.post('/route-plan', locationLimiter, asyncHandler(async (req, res) => {
  const { originLatitude, originLongitude, destinationQuery, destinationLatitude, destinationLongitude } = req.body;

  isLatitude(originLatitude);
  isLongitude(originLongitude);

  let query = typeof destinationQuery === 'string' ? destinationQuery.trim() : '';
  let resolvedDestination = null;

  if (Number.isFinite(destinationLatitude) && Number.isFinite(destinationLongitude)) {
    resolvedDestination = {
      display_name: query || 'Selected destination',
      lat: parseFloat(destinationLatitude),
      lon: parseFloat(destinationLongitude)
    };
    query = query || resolvedDestination.display_name;
  } else {
    if (!query) {
      throw new ValidationError('destinationQuery is required');
    }

    const geocodeResponse = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`,
      {
        headers: { 'User-Agent': 'Suraksha-Safety-App' }
      }
    );

    if (!geocodeResponse.ok) {
      throw new Error('Destination lookup failed');
    }

    const geocodeResults = await geocodeResponse.json();
    if (!Array.isArray(geocodeResults) || geocodeResults.length === 0) {
      throw new ValidationError('Destination not found');
    }

    resolvedDestination = geocodeResults[0];
  }

  const destinationLat = parseFloat(resolvedDestination.lat);
  const destinationLon = parseFloat(resolvedDestination.lon);

  let routeGeometry = [
    [originLongitude, originLatitude],
    [destinationLon, destinationLat]
  ];
  let routeDistanceMeters = Math.round(haversineMeters(originLatitude, originLongitude, destinationLat, destinationLon));
  let routeDurationSeconds = Math.max(60, Math.round(routeDistanceMeters / 10));

  try {
    const routeResponse = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${originLongitude},${originLatitude};${destinationLon},${destinationLat}?overview=full&geometries=geojson&steps=true`,
      {
        headers: { 'User-Agent': 'Suraksha-Safety-App' }
      }
    );

    if (routeResponse.ok) {
      const routeData = await routeResponse.json();
      const route = routeData?.routes?.[0];
      if (route?.geometry?.coordinates?.length) {
        routeGeometry = route.geometry.coordinates;
      }
      if (typeof route?.distance === 'number') {
        routeDistanceMeters = Math.round(route.distance);
      }
      if (typeof route?.duration === 'number') {
        routeDurationSeconds = Math.round(route.duration);
      }
    }
  } catch (error) {
    // Fall back to a direct route estimate if OSRM is unavailable.
  }

  addActivity(req.user.id, {
    icon: 'safe',
    emoji: '🧭',
    name: 'Safe Ride Route Planned',
    detail: `${query} route prepared`,
    time: 'Just now',
    distLabel: 'Route'
  });

  res.json({
    success: true,
    message: 'Route planned successfully',
    data: {
      destination: {
        name: resolvedDestination.display_name || query,
        latitude: destinationLat,
        longitude: destinationLon
      },
      route: {
        distanceMeters: routeDistanceMeters,
        durationSeconds: routeDurationSeconds,
        geometry: routeGeometry,
        deviationThresholdMeters: 500
      }
    }
  });
}));

/**
 * GET /api/geo/map-url
 * Get map viewing URL for coordinates
 * Returns both OpenStreetMap and Google Maps URLs
 */
router.get('/map-url', asyncHandler(async (req, res) => {
  try {
    const { latitude, longitude, zoom = 15 } = req.query;

    isLatitude(parseFloat(latitude));
    isLongitude(parseFloat(longitude));

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    res.json({
      success: true,
      data: {
        openStreetMap: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}&zoom=${zoom}`,
        googleMaps: `https://maps.google.com/?q=${lat},${lng}&z=${zoom}`,
        osm_embed: `<iframe width="100%" height="300" frameborder="0" src="https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.01},${lat - 0.01},${lng + 0.01},${lat + 0.01}&layer=mapnik"></iframe>`,
        latitude: lat,
        longitude: lng
      }
    });
  } catch (err) {
    console.error('[ERROR] Map URL generation failed:', err.message);
    throw err;
  }
}));

/**
 * GET /api/geo/distance
 * Calculate distance between two points (Haversine formula)
 */
router.get('/distance', asyncHandler(async (req, res) => {
  try {
    const { lat1, lon1, lat2, lon2 } = req.query;

    isLatitude(parseFloat(lat1));
    isLongitude(parseFloat(lon1));
    isLatitude(parseFloat(lat2));
    isLongitude(parseFloat(lon2));

    const R = 6371; // Earth radius in km

    const toRad = (degrees) => (degrees * Math.PI) / 180;

    const dLat = toRad(parseFloat(lat2) - parseFloat(lat1));
    const dLon = toRad(parseFloat(lon2) - parseFloat(lon1));

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(parseFloat(lat1))) *
        Math.cos(toRad(parseFloat(lat2))) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in km

    res.json({
      success: true,
      data: {
        distanceKm: parseFloat(distance.toFixed(2)),
        distanceMeters: Math.round(distance * 1000),
        distanceMiles: parseFloat((distance * 0.621371).toFixed(2))
      }
    });
  } catch (err) {
    console.error('[ERROR] Distance calculation failed:', err.message);
    throw err;
  }
}));

/**
 * POST /api/geo/nearby-contacts
 * Find nearby emergency contacts
 * Based on current location and stored contact locations
 */
router.post('/nearby-contacts', locationLimiter, asyncHandler(async (req, res) => {
  try {
    const { latitude, longitude, radiusKm = 5 } = req.body;

    isLatitude(latitude);
    isLongitude(longitude);
    isNumber(radiusKm, 'radiusKm');

    // In production, store contact locations and query them
    // For now, return mock data
    res.json({
      success: true,
      data: {
        searchCenter: { latitude, longitude },
        radiusKm,
        nearbyContacts: [
          // Mock data - replace with actual contact location lookups
        ],
        message: 'No contacts within search radius'
      }
    });
  } catch (err) {
    console.error('[ERROR] Nearby contacts search failed:', err.message);
    throw err;
  }
}));

module.exports = router;
