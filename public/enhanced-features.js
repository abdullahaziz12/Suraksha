/**
 * Suraksha Frontend - Enhanced Features
 * Google OAuth, Geolocation, Sensors, Power Button
 * 
 * Add this to your HTML <head> section:
 * 
 * 1. Google Sign-In SDK:
 *    <script src="https://accounts.google.com/gsi/client" async defer></script>
 * 
 * 2. OpenStreetMap Leaflet:
 *    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
 *    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
 * 
 * 3. This file:
 *    <script src="/enhanced-features.js"></script>
 */

// ═══════════════════════════════════════════════════════════
// GOOGLE OAUTH SETUP
// ═══════════════════════════════════════════════════════════

class GoogleAuthManager {
  constructor(clientId) {
    this.clientId = clientId;
    this.initialized = false;
    this.onSuccess = null;
  }

  /**
   * Initialize Google Sign-In
   * @param {string} clientId - Your Google OAuth 2.0 Client ID
   * @example
   * const googleAuth = new GoogleAuthManager('YOUR_CLIENT_ID.apps.googleusercontent.com');
   * googleAuth.init('googleSignInButton');
   */
  async init(buttonId, options = {}) {
    try {
      if (!window.google) {
        console.error('Google Sign-In SDK not loaded');
        return false;
      }

      this.onSuccess = options.onSuccess || null;
      const promptOneTap = options.promptOneTap !== false;

      google.accounts.id.initialize({
        client_id: this.clientId,
        callback: (response) => this.handleCredentialResponse(response),
        auto_select: false, // Don't auto-select
        itp_support: true
      });

      google.accounts.id.renderButton(document.getElementById(buttonId), {
        theme: 'outline',
        size: 'large',
        width: '100%',
        text: 'signin_with'
      });

      if (promptOneTap) {
        google.accounts.id.prompt();
      }

      this.initialized = true;
      console.log('✅ Google Sign-In initialized');
      return true;
    } catch (err) {
      console.error('[ERROR] Google Sign-In init failed:', err);
      return false;
    }
  }

  /**
   * Handle Google Sign-In response
   */
  async handleCredentialResponse(response) {
    try {
      if (!response || !response.credential) {
        alert('Login failed: missing Google credential');
        return;
      }

      let decodedToken = {};
      try {
        decodedToken = jwt_decode(response.credential);
      } catch (decodeError) {
        // Continue with backend fallback decoding when client-side decode fails.
        console.warn('[WARN] Failed to decode Google token on client:', decodeError.message);
      }

      console.log('📊 Google User Info:', {
        email: decodedToken.email,
        name: decodedToken.name,
        picture: decodedToken.picture
      });

      // Send to backend
      const result = await fetch('/api/google-auth/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idToken: response.credential,
          userInfo: {
            email: decodedToken.email,
            name: decodedToken.name,
            picture: decodedToken.picture
          }
        })
      });

      const rawBody = await result.text();
      let data = null;

      try {
        data = rawBody ? JSON.parse(rawBody) : null;
      } catch (parseError) {
        data = null;
      }

      if (!result.ok || !data || data.success !== true) {
        const apiMessage = data && data.error && data.error.message
          ? data.error.message
          : (rawBody || 'Google login request failed');
        alert('Login failed: ' + apiMessage);
        return;
      }

      if (data.success) {
        if (data.data?.requiresPhone) {
          const rawPhone = window.prompt('Google sign-in successful. Enter your mobile number in +92 format to continue (e.g. +923001234567):', '+92');
          if (!rawPhone) {
            alert('Phone number is required to use the app. Please try Google sign-in again.');
            return;
          }

          const completeResponse = await fetch('/api/google-auth/complete-phone', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              setupUserId: data.data.setupUserId,
              phone: rawPhone
            })
          });

          const completeData = await completeResponse.json();
          if (!completeData.success) {
            alert('Phone verification failed: ' + (completeData.error?.message || 'Unable to complete setup'));
            return;
          }

          localStorage.setItem('suraksha_token', completeData.data.token);
          localStorage.setItem('suraksha_user', JSON.stringify(completeData.data.user || decodedToken));

          if (typeof this.onSuccess === 'function') {
            this.onSuccess(completeData.data);
          }
          return;
        }

        // Store token
        localStorage.setItem('suraksha_token', data.data.token);
        localStorage.setItem('suraksha_user', JSON.stringify(data.data.user || decodedToken));

        if (typeof this.onSuccess === 'function') {
          this.onSuccess(data.data);
        }
      } else {
        alert('Login failed: ' + (data.error?.message || 'Unknown Google login error'));
      }
    } catch (err) {
      console.error('[ERROR] Google auth response handling failed:', err);
      alert('Login failed: ' + (err.message || 'Unexpected error'));
    }
  }

  /**
   * Logout
   */
  logout() {
    google.accounts.id.disableAutoSelect();
    localStorage.removeItem('suraksha_token');
    localStorage.removeItem('suraksha_user');

    if (typeof this.onSuccess === 'function') {
      this.onSuccess(null);
    }
  }
}

// Helper: Decode JWT (add jwt-decode library to HTML)
function jwt_decode(token) {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const jsonPayload = decodeURIComponent(
    atob(base64)
      .split('')
      .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join('')
  );
  return JSON.parse(jsonPayload);
}

// ═══════════════════════════════════════════════════════════
// GEOLOCATION SERVICE
// ═══════════════════════════════════════════════════════════

class GeolocationService {
  constructor() {
    this.currentPosition = null;
    this.watchId = null;
    this.map = null;
    this.marker = null;
  }

  /**
   * Get current position
   */
  getCurrentPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          this.currentPosition = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude,
            heading: position.coords.heading,
            speed: position.coords.speed,
            timestamp: new Date().toISOString()
          };

          console.log('📍 Location:', this.currentPosition);
          resolve(this.currentPosition);
        },
        (error) => {
          console.error('[ERROR] Geolocation failed:', error.message);
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    });
  }

  /**
   * Watch location continuously
   * Calls callback every time location changes
   */
  watchLocation(callback) {
    if (!navigator.geolocation) {
      console.error('Geolocation not supported');
      return null;
    }

    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        this.currentPosition = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: new Date().toISOString()
        };

        if (callback) callback(this.currentPosition);

        // Send to backend
        this.updateBackend(this.currentPosition);
      },
      (error) => {
        console.error('[ERROR] Watch position failed:', error.message);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000 // Update every 5 seconds
      }
    );

    console.log('👁️ Location tracking started');
    return this.watchId;
  }

  /**
   * Stop watching location
   */
  stopWatching() {
    if (this.watchId) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
      console.log('🛑 Location tracking stopped');
    }
  }

  /**
   * Send location to backend
   */
  async updateBackend(position) {
    try {
      const token = localStorage.getItem('suraksha_token');
      await fetch('/api/location/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(position)
      });
    } catch (err) {
      console.error('[ERROR] Failed to send location to backend:', err);
    }
  }

  /**
   * Initialize Leaflet map with OpenStreetMap
   */
  initMap(containerId, latitude = 31.5204, longitude = 74.3587, zoom = 13) {
    try {
      // Remove existing map
      if (this.map) this.map.remove();

      // Create map
      this.map = L.map(containerId).setView([latitude, longitude], zoom);

      // Add OpenStreetMap tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(this.map);

      // Add user marker
      this.marker = L.circleMarker([latitude, longitude], {
        radius: 10,
        fillColor: '#E8274B',
        color: '#000',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8
      })
        .addTo(this.map)
        .bindPopup('Your Location');

      console.log('🗺️ Map initialized');

      return this.map;
    } catch (err) {
      console.error('[ERROR] Map initialization failed:', err);
    }
  }

  /**
   * Get reverse geocode (address from coordinates)
   */
  async reverseGeocode(latitude, longitude) {
    try {
      const token = localStorage.getItem('suraksha_token');
      const response = await fetch('/api/geo/reverse-geocode', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ latitude, longitude })
      });

      const data = await response.json();
      return data.data;
    } catch (err) {
      console.error('[ERROR] Reverse geocode failed:', err);
    }
  }
}

// ═══════════════════════════════════════════════════════════
// DEVICE SENSORS SERVICE
// ═══════════════════════════════════════════════════════════

class DeviceSensorsService {
  constructor() {
    this.isListening = false;
    this.lastShakeTime = 0;
    this.shakeThreshold = 25; // Motion threshold for shake detection
  }

  /**
   * Request permission for sensor access
   */
  async requestSensorPermission() {
    try {
      if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
        const permission = await DeviceMotionEvent.requestPermission();
        console.log('📱 Sensor permission:', permission);
        return permission === 'granted';
      } else {
        console.log('ℹ️ Sensors auto-enabled on this device');
        return true;
      }
    } catch (err) {
      console.error('[ERROR] Sensor permission request failed:', err);
      return false;
    }
  }

  /**
   * Start listening to gyroscope/accelerometer
   * Detects shakes and sudden movements
   */
  async startGyroscopeDetection(callback) {
    try {
      const hasPermission = await this.requestSensorPermission();
      if (!hasPermission) {
        console.warn('Sensor permission denied');
        return false;
      }

      window.addEventListener('devicemotion', (event) => {
        const { x, y, z } = event.acceleration;

        // Calculate acceleration magnitude
        const acceleration = Math.sqrt(x * x + y * y + z * z);

        // Calculate intensity (0-100)
        const intensity = Math.min((acceleration / 10) * 100, 100);

        // Detect shake (sudden high acceleration)
        if (intensity > this.shakeThreshold) {
          const now = Date.now();

          // Only trigger once per 500ms
          if (now - this.lastShakeTime > 500) {
            this.lastShakeTime = now;

            console.log('🤳 Shake Detected! Intensity:', intensity.toFixed(0));

            // Send to backend
            this.reportSensorEvent('gyroscope', intensity, x, y, z);

            if (callback) callback(intensity);

            // Auto-trigger SOS if intensity > 85 (violent shake)
            if (intensity > 85) {
              console.warn('⚠️ Violent motion detected!');
              this.triggerEmergencyAlert('shake');
            }
          }
        }
      });

      this.isListening = true;
      console.log('👁️ Gyroscope detection started');
      return true;
    } catch (err) {
      console.error('[ERROR] Gyroscope detection failed:', err);
      return false;
    }
  }

  /**
   * Stop listening to gyroscope
   */
  stopGyroscopeDetection() {
    window.removeEventListener('devicemotion', null);
    this.isListening = false;
    console.log('🛑 Gyroscope detection stopped');
  }

  /**
   * Report sensor event to backend
   */
  async reportSensorEvent(type, intensity, x, y, z) {
    try {
      const token = localStorage.getItem('suraksha_token');
      await fetch('/api/sensors/gyroscope-event', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ intensity, x, y, z })
      });
    } catch (err) {
      console.error('[ERROR] Failed to report sensor event:', err);
    }
  }

  /**
   * Start detecting power button double-tap
   * Send emergency alert to trustee contact
   */
  startPowerButtonDetection() {
    let powerButtonPressCount = 0;
    let lastPressTime = 0;

    // Capture volume buttons on Android (closest to power button simulation)
    document.addEventListener('volumedown', () => {
      const now = Date.now();

      if (now - lastPressTime < 500) {
        powerButtonPressCount++;
      } else {
        powerButtonPressCount = 1;
      }

      lastPressTime = now;

      // Double tap detected
      if (powerButtonPressCount >= 2) {
        console.log('🆘 Power Button Double-Tap Detected!');
        this.triggerEmergencyAlert('power_button');
        powerButtonPressCount = 0;
      }
    });

    console.log('👁️ Power button detection started (use volume down button x2)');
  }

  /**
   * Trigger emergency alert
   */
  async triggerEmergencyAlert(source) {
    try {
      const token = localStorage.getItem('suraksha_token');

      // Get current location first
      const geo = new GeolocationService();
      const position = await geo.getCurrentPosition();

      // Trigger SOS
      const response = await fetch('/api/sos/trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          latitude: position.latitude,
          longitude: position.longitude,
          source,
          accuracy: position.accuracy
        })
      });

      const data = await response.json();

      if (data.success) {
        console.log('✅ Emergency alert sent!');
        // Show confirmation to user
        alert('🆘 Emergency alert sent to your trustee contacts!');
      }
    } catch (err) {
      console.error('[ERROR] Emergency alert failed:', err);
      alert('Failed to send emergency alert');
    }
  }
}

// ═══════════════════════════════════════════════════════════
// DESKTOP/WEB APPLICATION (No hardware sensors)
// ═══════════════════════════════════════════════════════════

class WebSuraksha {
  constructor(googleClientId) {
    this.googleAuth = new GoogleAuthManager(googleClientId);
    this.geolocation = new GeolocationService();
    this.sensors = new DeviceSensorsService();
  }

  /**
   * Initialize all features
   */
  async init(config = {}) {
    console.log('🛡️ Suraksha initializing...');

    // Google OAuth
    if (config.googleClientId && config.googleButtonId) {
      await this.googleAuth.init(config.googleButtonId);
    }

    // Map
    if (config.mapContainerId) {
      this.geolocation.initMap(config.mapContainerId);
    }

    // Sensors (mobile only)
    if (config.enableSensors && /Android|iPhone/.test(navigator.userAgent)) {
      await this.sensors.startGyroscopeDetection();
      this.sensors.startPowerButtonDetection();
    }

    console.log('✅ Suraksha ready!');
  }
}

// Export globally
if (typeof window !== 'undefined') {
  window.SurakshEnhanced = {
    GoogleAuthManager,
    GeolocationService,
    DeviceSensorsService,
    WebSuraksha
  };
}
