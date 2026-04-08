/**
 * Suraksha API Client
 * Frontend helper to interact with the backend API
 * 
 * Usage:
 * const api = new SurakshAPI();
 * 
 * // Login
 * const {token, user} = await api.auth.login(email, password);
 * api.setToken(token);
 * 
 * // Get contacts
 * const contacts = await api.contacts.list();
 */

class SurakshAPI {
  constructor(baseURL) {
    const configuredBase = typeof window !== 'undefined' && typeof window.__surakshaApiBase === 'string'
      ? window.__surakshaApiBase
      : '/api';
    this.baseURL = baseURL || configuredBase;
    this.token = localStorage.getItem('suraksha_token');
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('suraksha_token', token);
    } else {
      localStorage.removeItem('suraksha_token');
    }
  }

  getToken() {
    return this.token || localStorage.getItem('suraksha_token');
  }

  /**
   * Make an API request
   */
  async request(method, endpoint, data = null) {
    const url = `${this.baseURL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json'
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const options = {
      method,
      headers
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, options);
      const json = await response.json();

      if (!response.ok) {
        const error = new Error(json.error?.message || 'API Error');
        error.code = json.error?.code;
        error.status = response.status;
        throw error;
      }

      return json.data || json;
    } catch (err) {
      console.error(`[API] ${method} ${endpoint}:`, err);
      throw err;
    }
  }

  // ─── AUTH ───────────────────────────────────────────────
  auth = {
    register: (name, email, password, phone = '') => 
      this.request('POST', '/auth/register', { name, email, password, phone }),
    
    login: (email, password) => 
      this.request('POST', '/auth/login', { email, password }),
    
    logout: () => 
      this.request('POST', '/auth/logout'),
    
    me: () => 
      this.request('GET', '/auth/me'),
    
    updateProfile: (name, phone) => 
      this.request('PATCH', '/auth/profile', { name, phone }),
    
    changePassword: (currentPassword, newPassword) => 
      this.request('PATCH', '/auth/password', { currentPassword, newPassword })
  };

  // ─── CONTACTS ───────────────────────────────────────────
  contacts = {
    list: () => 
      this.request('GET', '/contacts'),
    
    add: (name, phone, relation = 'Contact', primary = false) => 
      this.request('POST', '/contacts', { name, phone, relation, primary }),
    
    update: (id, data) => 
      this.request('PUT', `/contacts/${id}`, data),
    
    delete: (id) => 
      this.request('DELETE', `/contacts/${id}`),
    
    setPrimary: (id) => 
      this.request('POST', `/contacts/${id}/set-primary`),
    
    shareLocation: (id) => 
      this.request('POST', `/contacts/${id}/share-location`),
    
    sendMessage: (id, message) => 
      this.request('POST', `/contacts/${id}/send-message`, { message })
  };

  // ─── SOS ────────────────────────────────────────────────
  sos = {
    trigger: (latitude, longitude, source = 'manual', accuracy = null) => 
      this.request('POST', '/sos/trigger', { latitude, longitude, source, accuracy }),
    
    cancel: (eventId = null) => 
      this.request('POST', '/sos/cancel', { eventId }),
    
    allSafe: () => 
      this.request('POST', '/sos/all-safe'),
    
    getActive: () => 
      this.request('GET', '/sos/active'),
    
    getHistory: (limit = 20) => 
      this.request('GET', `/sos/history?limit=${limit}`)
  };

  // ─── RIDE ───────────────────────────────────────────────
  ride = {
    start: (rideType, originName = '', destinationName = '', latitude = null, longitude = null) => 
      this.request('POST', '/ride/start', { rideType, originName, destinationName, latitude, longitude }),
    
    end: (durationSeconds = null) => 
      this.request('POST', '/ride/end', { durationSeconds }),
    
    updateLocation: (latitude, longitude, accuracy = null) => 
      this.request('PATCH', '/ride/location', { latitude, longitude, accuracy }),
    
    deviationAlert: (deviationMeters = null) => 
      this.request('POST', '/ride/deviation-alert', { deviationMeters }),
    
    getActive: () => 
      this.request('GET', '/ride/active'),
    
    getHistory: (limit = 20) => 
      this.request('GET', `/ride/history?limit=${limit}`)
  };

  // ─── LOCATION ───────────────────────────────────────────
  location = {
    update: (latitude, longitude, accuracy = null, altitude = null, heading = null, speed = null) => 
      this.request('POST', '/location/update', { latitude, longitude, accuracy, altitude, heading, speed }),
    
    getCurrent: () => 
      this.request('GET', '/location/current'),
    
    getHistory: (limit = 50) => 
      this.request('GET', `/location/history?limit=${limit}`)
  };

  // ─── SETTINGS ───────────────────────────────────────────
  settings = {
    get: () => 
      this.request('GET', '/settings'),
    
    update: (settings) => 
      this.request('PATCH', '/settings', { settings }),
    
    toggleProtection: (enabled) => 
      this.request('PATCH', '/settings/protection', { enabled }),
    
    setSosCountdown: (seconds) => 
      this.request('PATCH', '/settings/sos-countdown', { seconds })
  };

  // ─── ACTIVITY ───────────────────────────────────────────
  activity = {
    getFeed: (limit = 50) => 
      this.request('GET', `/activity/feed?limit=${limit}`)
  };

  // ─── HEALTH ─────────────────────────────────────────────
  health = () => 
    this.request('GET', '/health');
}

// Export for use in HTML
if (typeof window !== 'undefined') {
  window.SurakshAPI = SurakshAPI;
  window.api = new SurakshAPI();
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SurakshAPI;
}
