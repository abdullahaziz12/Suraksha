# Frontend-Backend Integration Guide

## Overview

The Suraksha platform is a full-stack application with:
- **Backend**: Node.js/Express API with complete error handling  
- **Frontend**: HTML5 SPA with responsive UI
- **Communication**: REST API with JWT authentication

## Project Setup

### Directory Structure

```
Safety/
├── server.js                 # Main Express app
├── package.json             # Dependencies
├── src/
│   ├── middleware/
│   ├── routes/
│   └── models/
├── public/
│   ├── index.html           # Frontend (SPA)
│   └── api-client.js        # API helper library
└── README.md
```

## Installation & Running

### 1. Install Dependencies

```bash
cd c:\Users\user\Downloads\Safety
npm install
```

This installs:
- **express** - Web framework
- **jsonwebtoken** - JWT authentication
- **bcryptjs** - Password hashing
- **cors** - Cross-origin support
- **helmet** - Security headers
- **express-rate-limit** - Rate limiting

### 2. Start the Backend

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

Output:
```
╔════════════════════════════════════════════╗
║          🛡️  SURAKSHA BACKEND             ║
╚════════════════════════════════════════════╝

✅  Server running on http://localhost:3000
📡  API available at http://localhost:3000/api
🌐  Frontend served at http://localhost:3000
❤️   Health check: http://localhost:3000/api/health
```

## API Communication

### Authentication Flow

#### 1. Register/Login

**Frontend Request:**
```javascript
// Using the provided API client
const api = new SurakshAPI();

const response = await api.auth.login('aisha@suraksha.app', 'password123');
api.setToken(response.token);
```

**What Happens:**
1. Frontend sends credentials to `/api/auth/login`
2. Backend validates inputs
3. Backend compares password hash
4. Backend generates JWT token
5. Frontend stores token in localStorage
6. Frontend uses token for authenticated requests

**Backend Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "user-001",
      "name": "Aisha Khan",
      "email": "aisha@suraksha.app",
      "protectionEnabled": true
    }
  }
}
```

#### 2. Authenticated Requests

**Frontend:**
```javascript
// All subsequent requests include the token
const contacts = await api.contacts.list();

// Header automatically includes:
// Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Backend Auth Flow:**
1. Request arrives with `Authorization: Bearer <token>`
2. Middleware extracts token
3. Middleware verifies JWT signature
4. Middleware checks token isn't revoked
5. Middleware attaches user to `req.user`
6. Route handler processes with user context

### Error Handling

**Unified Error Response Format:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "name is required",
    "field": "name"
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Frontend Error Handling:**
```javascript
try {
  await api.contacts.add('Alice', '+92 300 111 2233');
} catch (err) {
  console.error(`[${err.code}] ${err.message}`);
  
  if (err.code === 'VALIDATION_ERROR') {
    showFieldError(err.field, err.message);
  } else if (err.code === 'RATE_LIMIT_EXCEEDED') {
    showWarning('Too many requests. Please wait.');
  } else if (err.status === 401) {
    redirectToLogin();
  }
}
```

## Feature API Integration

### 1. Emergency Contacts

**Frontend Workflow:**
```javascript
// Add contact
const newContact = await api.contacts.add(
  'Sister',
  '+92 300 111 2233',
  'Sister',
  true  // Set as primary
);

// Get all contacts
const contacts = await api.contacts.list();

// Share location with contact
await api.contacts.shareLocation(contactId);

// Update contact
await api.contacts.update(contactId, {
  name: 'Updated Name',
  smsAlertsOn: true
});

// Delete contact
await api.contacts.delete(contactId);
```

**Backend Validation:**
- Phone number format validation
- Max 10 contacts per user
- Duplicate phone check
- Sanitization of all inputs
- XSS prevention

### 2. SOS Alerts

**Frontend Workflow:**
```javascript
// Trigger SOS with location
const sos = await api.sos.trigger(
  31.5204,      // latitude
  74.3587,      // longitude
  'manual',     // source
  10            // accuracy in meters
);

// Cancel SOS
await api.sos.cancel(sosEventId);

// Get SOS history
const events = await api.sos.getHistory(20);

// Check if SOS is active
const { active, event } = await api.sos.getActive();
```

**Backend Processing:**
- Rate limit: 20 alerts/minute
- Location validation
- Contact notification
- Authority alerting (simulated)
- Event logging

### 3. Safe Ride

**Frontend Workflow:**
```javascript
// Start ride
const ride = await api.ride.start(
  'Car',
  'Home',
  'Office',
  31.5204,
  74.3587
);

// Update ride location in real-time
setInterval(async () => {
  await api.ride.updateLocation(lat, lng, accuracy);
}, 5000);

// End ride
await api.ride.end(durationInSeconds);

// Get ride history
const history = await api.ride.getHistory(20);
```

**Backend Features:**
- Prevent multiple active rides
- Contact notification
- Real-time location tracking
- Duration calculation
- Ride analytics

### 4. Settings Management

**Frontend Workflow:**
```javascript
// Get all settings
const settings = await api.settings.get();

// Update multiple settings
await api.settings.update({
  gyroscopeEnabled: true,
  gpsEnabled: true,
  tripleTapSpeed: 'fast',
  sensitivityLevel: 'high'
});

// Toggle protection
await api.settings.toggleProtection(true);

// Set SOS countdown
await api.settings.setSosCountdown(5);  // seconds
```

**Backend Validation:**
- Type checking (boolean, enum, integer)
- Range validation (3-30 for countdown)
- Enum validation for settings
- User preference isolation

### 5. Location Tracking

**Frontend Workflow:**
```javascript
// Send location update
await api.location.update(
  latitude,
  longitude,
  accuracy,
  altitude,
  heading,
  speed
);

// Get current location
const current = await api.location.getCurrent();

// Get location history
const history = await api.location.getHistory(50);
```

**Backend Storage:**
- Max 500 location points per user
- Automatic old record cleanup
- Coordinate precision (8 decimals)
- Timestamp tracking

## Security Implementation

### 1. Authentication

**JWT Tokens:**
- Algorithm: HS256
- Expiry: 7 days
- Revocation: Token blacklist on logout
- Stored in: localStorage (frontend)

**Password Security:**
- Hash algorithm: bcryptjs
- Salt rounds: 12
- Never stored in plain text
- Compared using timing-safe function

### 2. Input Validation

**Every Route Validates:**
```javascript
// Email validation
isEmail(email)  // Checks format

// Phone validation
isPhone(phone)  // International format

// Location validation
isLatitude(lat)    // -90 to 90
isLongitude(lng)   // -180 to 180

// String sanitization
sanitizeString(input)  // Remove HTML, trim whitespace

// Length checks
minLength(password, 8)
maxLength(name, 60)
```

### 3. XSS Prevention

**Sanitization Applied:**
```javascript
// Removes HTML tags
'<script>alert("xss")</script>' → 'scriptalertxssscript'

// Trims whitespace
'  name  ' → 'name'

// Prevents attribute injection
'input" onclick="alert(1)' → 'input onclick=alert1'
```

### 4. Rate Limiting

**Configured Per Endpoint:**
- General API: 200 req/15min
- Auth: 10 attempts/15min
- SOS: 20 alerts/minute
- Contacts: 100 ops/15min
- Location: 60 updates/minute
- Ride: 50 ops/15min

## Data Flow Examples

### Example 1: User Login

```
User clicks login
│
├─→ Frontend: FETCH POST /api/auth/login
│                  {email, password}
│
├─→ Backend: Validate inputs
│  ├─→ Check email format
│  ├─→ Check password length
│  └─→ Sanitize email
│
├─→ Backend: Find user by email
│  └─→ Check if exists
│
├─→ Backend: Verify password
│  └─→ bcrypt.compare()
│
├─→ Backend: Generate JWT
│  └─→ jwt.sign({userId, iat})
│
├─→ Response: 200 OK
│  {
│    "success": true,
│    "data": {"token": "...", "user": {...}}
│  }
│
└─→ Frontend: Store token
   localStorage.setItem('suraksha_token', token)
```

### Example 2: Add Emergency Contact

```
User submits contact form
│
├─→ Frontend: FETCH POST /api/contacts
│                  {name, phone, relation, primary}
│                  Header: Authorization: Bearer <token>
│
├─→ Backend: Authenticate
│  ├─→ Extract token from header
│  ├─→ Verify JWT signature
│  └─→ Get user from database
│
├─→ Backend: Validate inputs
│  ├─→ required(name, 'name')
│  ├─→ isPhone(phone)
│  ├─→ maxLength(name, 60)
│  └─→ sanitizeString(name)
│
├─→ Backend: Check business rules
│  ├─→ Max 10 contacts per user?
│  ├─→ Duplicate phone number?
│  └─→ User exists?
│
├─→ Backend: Create contact
│  ├─→ Generate UUID
│  ├─→ Assign color
│  └─→ Store in memory
│
├─→ Backend: Log activity
│  └─→ addActivity('Contact Added', ...)
│
├─→ Response: 201 Created
│  {
│    "success": true,
│    "message": "Sister added as emergency contact",
│    "data": {"contact": {...}}
│  }
│
└─→ Frontend: Update UI
   ├─→ Refresh contacts list
   └─→ Show success toast
```

## Testing the Integration

### 1. Start Backend
```bash
npm run dev
```

### 2. Open Frontend
```
http://localhost:3000
```

### 3. Test Login
- Email: aisha@suraksha.app
- Password: password123

### 4. Test API Endpoints

**Using API Client (in browser console):**
```javascript
// Check API health
await api.health();

// Get current user
const user = await api.auth.me();

// List contacts
const contacts = await api.contacts.list();

// Trigger SOS
const sos = await api.sos.trigger(31.5204, 74.3587);
```

**Using cURL:**
```bash
# Health check
curl http://localhost:3000/api/health

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"aisha@suraksha.app","password":"password123"}'

# Get contacts (with token)
curl http://localhost:3000/api/contacts \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Error Scenarios & Handling

### Scenario 1: Invalid Email on Login
```javascript
try {
  await api.auth.login('invalid-email', 'password');
} catch (err) {
  // err.code === 'VALIDATION_ERROR'
  // err.message === 'email must be a valid email address'
  // err.field === 'email'
  showFieldError('email', err.message);
}
```

### Scenario 2: Duplicate Contact
```javascript
try {
  await api.contacts.add('Alice', '+92 300 111 2233');
  await api.contacts.add('Alice2', '+92 300 111 2233'); // Same phone
} catch (err) {
  // err.code === 'CONFLICT'
  // err.message === 'A contact with this phone number already exists'
  showWarning(err.message);
}
```

### Scenario 3: Token Expired
```javascript
try {
  await api.contacts.list();
} catch (err) {
  if (err.code === 'TOKEN_EXPIRED') {
    // Redirect to login
    window.location.href = '/login';
  }
}
```

### Scenario 4: Rate Limit Exceeded
```javascript
try {
  // 11th login attempt in 15 minutes
  await api.auth.login(email, password);
} catch (err) {
  // err.code === 'AUTH_RATE_LIMIT'
  // err.status === 429
  showWarning('Too many attempts. Wait 15 minutes.');
}
```

## Production Deployment

### Before Going Live

1. **Environment Setup**
   - Create `.env` file with production values
   - Change `JWT_SECRET` to random string
   - Set `NODE_ENV=production`

2. **Database Migration**
   - Replace in-memory store with MongoDB/PostgreSQL
   - Update `src/models/store.js`

3. **SMS Integration**
   - Add SMS service (Twilio, AWS SNS)
   - Update SOS trigger logic

4. **HTTPS/SSL**
   - Obtain SSL certificate
   - Configure CORS for production domain
   - Update frontend API URL

5. **Monitoring**
   - Set up error tracking (Sentry)
   - Enable request logging
   - Monitor rate limits

6. **Testing**
   - Complete API test suite
   - Load testing
   - Security audit

## Support

For issues or questions:
1. Check error codes in response
2. Review logs in terminal
3. Check README.md
4. Open GitHub issue

---

**Happy coding! 🛡️**
