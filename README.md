# Suraksha Backend - Complete Setup Guide

## 📋 Project Overview

Suraksha is a comprehensive women's safety platform with:
- ✅ User authentication with JWT
- ✅ Emergency SOS alert system
- ✅ Emergency contact management
- ✅ Safe ride tracking & monitoring
- ✅ GPS location sharing
- ✅ Activity feed
- ✅ Complete error handling & validation
- ✅ Rate limiting & security

## 🏗️ Project Structure

```
Safety/
├── server.js                 # Main Express server
├── package.json             # Dependencies
├── src/
│   ├── middleware/          # Shared middleware
│   │   ├── errorHandler.js  # Centralized error handling
│   │   ├── auth.js          # JWT authentication
│   │   ├── rateLimiter.js   # Rate limiting
│   │   └── validate.js      # Input validation & sanitization
│   ├── models/
│   │   └── store.js         # In-memory data store
│   └── routes/              # API endpoints
│       ├── auth.js          # Authentication routes
│       ├── contacts.js      # Emergency contact routes
│       ├── sos.js           # SOS alert routes
│       ├── ride.js          # Safe ride routes
│       ├── location.js      # Location routes
│       ├── settings.js      # User settings routes
│       └── activity.js      # Activity feed routes
├── public/                  # Frontend files
│   └── index.html           # Main HTML (SPA)
└── README.md               # This file
```

## 🚀 Setup Instructions

### 1. Install Dependencies
```bash
cd c:\Users\user\Downloads\Safety
npm install
```

### 2. Set Environment Variables (Optional)
Create a `.env` file in the project root:
```
PORT=3000
NODE_ENV=development
JWT_SECRET=your-secret-key
JWT_EXPIRY=7d
```

### 3. Start the Server
```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

Server will be available at: `http://localhost:3000`

## 🔐 API Documentation

### Authentication Endpoints

#### Register
```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "Aisha Khan",
  "email": "aisha@example.com",
  "password": "password123",
  "phone": "+92 300 111 2233"
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "aisha@example.com",
  "password": "password123"
}
```

#### Get Current User
```http
GET /api/auth/me
Authorization: Bearer <token>
```

#### Logout
```http
POST /api/auth/logout
Authorization: Bearer <token>
```

#### Update Profile
```http
PATCH /api/auth/profile
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Updated Name",
  "phone": "+92 300 111 2233"
}
```

#### Change Password
```http
PATCH /api/auth/password
Authorization: Bearer <token>
Content-Type: application/json

{
  "currentPassword": "oldpass123",
  "newPassword": "newpass123"
}
```

### Emergency Contacts

#### Get All Contacts
```http
GET /api/contacts
Authorization: Bearer <token>
```

#### Add Contact
```http
POST /api/contacts
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Sister",
  "relation": "Sister",
  "phone": "+92 300 111 2233",
  "primary": true
}
```

#### Update Contact
```http
PUT /api/contacts/{id}
Authorization: Bearer <token>

{
  "name": "Updated Name",
  "phone": "+92 300 111 2233"
}
```

#### Delete Contact
```http
DELETE /api/contacts/{id}
Authorization: Bearer <token>
```

### SOS Alerts

#### Trigger SOS
```http
POST /api/sos/trigger
Authorization: Bearer <token>
Content-Type: application/json

{
  "latitude": 31.5204,
  "longitude": 74.3587,
  "source": "manual",
  "accuracy": 10
}
```

#### Cancel SOS
```http
POST /api/sos/cancel
Authorization: Bearer <token>

{
  "eventId": "event-id-optional"
}
```

#### Get SOS History
```http
GET /api/sos/history?limit=20
Authorization: Bearer <token>
```

### Safe Ride Routes

#### Start Ride
```http
POST /api/ride/start
Authorization: Bearer <token>

{
  "rideType": "Car",
  "originName": "Home",
  "destinationName": "Office",
  "latitude": 31.5204,
  "longitude": 74.3587
}
```

#### End Ride
```http
POST /api/ride/end
Authorization: Bearer <token>

{
  "durationSeconds": 1200
}
```

#### Update Location
```http
PATCH /api/ride/location
Authorization: Bearer <token>

{
  "latitude": 31.5204,
  "longitude": 74.3587,
  "accuracy": 10
}
```

### Settings

#### Get Settings
```http
GET /api/settings
Authorization: Bearer <token>
```

#### Update Settings
```http
PATCH /api/settings
Authorization: Bearer <token>

{
  "settings": {
    "gyroscopeEnabled": true,
    "gpsEnabled": true,
    "tripleTapEnabled": false
  }
}
```

#### Toggle Protection
```http
PATCH /api/settings/protection
Authorization: Bearer <token>

{
  "enabled": true
}
```

## 🛡️ Error Handling

All errors follow a consistent format:

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

### Common Error Codes
- `VALIDATION_ERROR` (422): Invalid input data
- `AUTH_ERROR` (401): Authentication failed
- `INVALID_TOKEN` (401): Invalid JWT token
- `TOKEN_EXPIRED` (401): Token has expired
- `CONFLICT` (409): Resource already exists
- `NOT_FOUND` (404): Resource not found
- `RATE_LIMIT_EXCEEDED` (429): Too many requests
- `INTERNAL_ERROR` (500): Server error

## 🔒 Security Features

1. **JWT Authentication**: Secure token-based authentication
2. **Password Hashing**: bcryptjs with salt rounds 12
3. **Input Validation**: Comprehensive validation for all inputs
4. **Sanitization**: HTML tag removal and XSS prevention
5. **Rate Limiting**: 
   - General: 200 requests per 15 minutes
   - Auth: 10 attempts per 15 minutes
   - SOS: 20 alerts per minute
6. **CORS Protection**: Configurable origin policy
7. **Helmet**: HTTP headers security

## 🧪 Test Account

Use this account to test the API:

**Email**: aisha@suraksha.app  
**Password**: password123

## 🔧 Frontend Integration

The frontend HTML file should be placed in the `public/` folder as `index.html`.

API endpoints are automatically served from the backend:
- Frontend: `http://localhost:3000/`
- API: `http://localhost:3000/api/*`
- Health: `http://localhost:3000/api/health`

### Frontend Request Example

```javascript
// Get auth token from login response
const token = response.data.token;

// Make authenticated request
fetch('/api/contacts', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
})
.then(res => res.json())
.then(data => console.log(data));
```

## 📊 Data Storage

Currently using in-memory storage. For production, replace with:
- MongoDB
- PostgreSQL
- MySQL
- Firebase
- AWS DynamoDB

See `src/models/store.js` for the data interface.

## 🐛 Debugging

Enable verbose logging:
```bash
NODE_ENV=development npm run dev
```

Check logs for:
- `[ERROR]` - Server errors
- `[WARN]` - Client errors
- `[INFO]` - General information

## 📝 License

MIT License - See LICENSE file for details

## 👥 Support

For issues or questions, please create an issue on the GitHub repository.

---

**Built with ❤️ for women's safety**
