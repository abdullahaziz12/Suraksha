# 🚀 Quick Start Guide

## Installation (2 minutes)

```bash
cd c:\Users\user\Downloads\Safety
npm install
npm start
```

✅ Server running at **http://localhost:3000**

## Access Points

| URL | Purpose |
|-----|---------|
| http://localhost:3000 | Frontend SPA |
| http://localhost:3000/api | API Base |
| http://localhost:3000/api/health | Health Check |

## Test Login

```
Email:    aisha@suraksha.app
Password: password123
```

## API Quick Reference

### Authentication
```javascript
// Login
POST /api/auth/login { email, password }

// Logout
POST /api/auth/logout

// Get Profile
GET /api/auth/me

// Update Profile
PATCH /api/auth/profile { name, phone }

// Change Password
PATCH /api/auth/password { currentPassword, newPassword }

// Register
POST /api/auth/register { name, email, password, phone }
```

### Contacts
```javascript
// List
GET /api/contacts

// Add
POST /api/contacts { name, phone, relation, primary }

// Update
PUT /api/contacts/:id { name, phone, relation, primary, smsAlertsOn }

// Delete
DELETE /api/contacts/:id

// Set Primary
POST /api/contacts/:id/set-primary

// Share Location
POST /api/contacts/:id/share-location

// Send Message
POST /api/contacts/:id/send-message { message }
```

### SOS Alerts
```javascript
// Trigger
POST /api/sos/trigger { latitude, longitude, source, accuracy }

// Cancel
POST /api/sos/cancel { eventId }

// Mark All Safe
POST /api/sos/all-safe

// Get Active
GET /api/sos/active

// Get History
GET /api/sos/history?limit=20
```

### Safe Ride
```javascript
// Start
POST /api/ride/start { rideType, originName, destinationName, latitude, longitude }

// End
POST /api/ride/end { durationSeconds }

// Update Location
PATCH /api/ride/location { latitude, longitude, accuracy }

// Deviation Alert
POST /api/ride/deviation-alert { deviationMeters }

// Get Active
GET /api/ride/active

// Get History
GET /api/ride/history?limit=20
```

### Location
```javascript
// Update
POST /api/location/update { latitude, longitude, accuracy, altitude, heading, speed }

// Get Current
GET /api/location/current

// Get History
GET /api/location/history?limit=50
```

### Settings
```javascript
// Get All
GET /api/settings

// Update
PATCH /api/settings { settings: {...} }

// Toggle Protection
PATCH /api/settings/protection { enabled }

// Set SOS Countdown
PATCH /api/settings/sos-countdown { seconds }
```

### Activity
```javascript
// Get Feed
GET /api/activity/feed?limit=50
```

## Error Codes

| Code | Status | Meaning |
|------|--------|---------|
| VALIDATION_ERROR | 422 | Invalid input |
| AUTH_ERROR | 401 | Auth failed |
| INVALID_TOKEN | 401 | Bad token |
| TOKEN_EXPIRED | 401 | Token expired |
| NOT_FOUND | 404 | Not found |
| CONFLICT | 409 | Already exists |
| RATE_LIMIT_EXCEEDED | 429 | Too many requests |
| INTERNAL_ERROR | 500 | Server error |

## Development Commands

```bash
# Start server
npm start

# Start with auto-reload
npm run dev

# Check health
curl http://localhost:3000/api/health
```

## Browser API Client

```javascript
const api = new SurakshAPI();

// Login and set token
const res = await api.auth.login('aisha@suraksha.app', 'password123');
api.setToken(res.token);

// Use any API method
await api.contacts.list();
await api.sos.trigger(31.5204, 74.3587);
await api.ride.start('Car', 'Home', 'Office', 31.5204, 74.3587);
```

## File Structure

```
Safety/
├── server.js                # Main app
├── package.json            # Dependencies
├── src/
│   ├── middleware/         # Auth, validation, errors
│   ├── routes/             # API endpoints (32 total)
│   └── models/             # Data store
└── public/
    ├── index.html          # Frontend
    └── api-client.js       # API helper
```

## Common Issues

### Port 3000 already in use?
```bash
# Change port
PORT=3001 npm start
```

### Module not found?
```bash
# Reinstall
rm -rf node_modules package-lock.json
npm install
```

### JWT Secret issues?
```bash
# Set in .env
JWT_SECRET=your-secret-key
```

## Next Steps

1. **Start Server**: `npm start`
2. **Open Browser**: http://localhost:3000
3. **Login**: Use test account above
4. **Test API**: Use browser console with `api` object
5. **Read Docs**: Check README.md and INTEGRATION.md

## Support

- **API Docs**: See README.md
- **Integration**: See INTEGRATION.md
- **Full Guide**: See SETUP_COMPLETE.md
- **Examples**: See INTEGRATION.md data flow section

---

✨ **Suraksha Backend is Ready!** ✨
