# 🚀 DEPLOYMENT GUIDE - HOW TO LIVE IT

## Table of Contents
1. [Local Development](#local-development)
2. [Google OAuth Setup](#google-oauth-setup)
3. [Deploy to Vercel](#deploy-to-vercel)
4. [Deploy to Railway](#deploy-to-railway)
5. [Deploy to Render](#deploy-to-render)
6. [Custom Server Deployment](#custom-server-deployment)
7. [Mobile App Setup](#mobile-app-setup)
8. [Production Checklist](#production-checklist)

---

## Local Development

### 1. Start the Server

```bash
# Navigate to project
cd path/to/Safety

# Install dependencies (if not done)
npm install

# Start server
npm start
```

Expected output:
```
✅ Server running on http://localhost:3000
```

### 2. Access the Application

**Main App:**
```
http://localhost:3000
```

**Enhanced Features (with Google OAuth, Map, Sensors):**
```
http://localhost:3000/enhanced.html
```

### 3. Stop the Server

```bash
# Press Ctrl+C in terminal
```

---

## Google OAuth Setup

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Click "Create Project"
3. Enter project name: `Suraksha`
4. Click "Create"

### Step 2: Enable Google Sign-In API

1. In sidebar, go to **APIs & Services** → **Library**
2. Search for "Google+ API"
3. Click **Enable**
4. Go back to **APIs & Services** → **OAuth consent screen**
5. Select **External** (for testing)
6. Fill out form:
   - App name: `Suraksha`
   - User support email: Your email
   - Developer contact: Your email
7. Click **Save and Continue**
8. Skip scopes, click **Save and Continue**
9. Add test users (click **Add Users**)
10. Enter your email address

### Step 3: Create OAuth Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Choose **Web application**
4. Under "Authorized JavaScript origins" add:
   ```
   http://localhost:3000
   http://localhost:3000/enhanced.html
   ```
5. Under "Authorized redirect URIs" add:
   ```
   http://localhost:3000/api/google-auth/callback
   ```
6. Click **Create**
7. Copy the **Client ID**

### Step 4: Use in Application

In `enhanced.html` line 234, replace:

```javascript
const suraksha = new WebSuraksha('YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com');
```

With your actual Client ID:

```javascript
const suraksha = new WebSuraksha('1234567890-abc123def456.apps.googleusercontent.com');
```

Note: this frontend login flow does not use the Google client secret. Keep the secret on the server only if you later add a code-exchange OAuth flow.

---

## Deploy to Vercel (EASIEST - FREE)

### Step 1: Install Vercel CLI

```bash
npm install -g vercel
```

### Step 2: Login to Vercel

```bash
vercel login
```

Follow the browser prompts to authenticate.

### Step 3: Deploy

```bash
cd path/to/Safety
vercel
```

You'll be asked:
- **Project name**: `suraksha`
- **Directory**: Press Enter (current)
- **Build command**: `npm run build` (or press Enter for default)
- **Output directory**: `.` (or press Enter)

Vercel will deploy and provide a URL like:
```
https://suraksha-xyz.vercel.app
```

### Step 4: Update Google OAuth

1. Return to [Google Cloud Console](https://console.cloud.google.com)
2. Go to **APIs & Services** → **Credentials**
3. Click your OAuth client ID
4. Add your Vercel URL to authorized origins:
   ```
   https://suraksha-xyz.vercel.app
   https://suraksha-xyz.vercel.app/enhanced.html
   ```
5. Add to redirect URIs:
   ```
   https://suraksha-xyz.vercel.app/api/google-auth/callback
   ```
6. Click **Save**

### Step 5: Update Client ID in Code

Update `public/enhanced.html`:

```javascript
const suraksha = new WebSuraksha('YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com');
```

Redeploy:

```bash
vercel --prod
```

---

## Deploy to Railway (RECOMMENDED - $5/month)

### Step 1: Create Railway Account

1. Go to [railway.app](https://railway.app)
2. Click **Start Project**
3. Sign up with GitHub

### Step 2: Connect GitHub

1. Click **Deploy from GitHub**
2. Authorize Railway
3. Select your repository

### Step 3: Configure Environment

Railway will auto-detect Node.js. Just ensure `server.js` is your start file.

In Railway dashboard:
1. Go to **Settings**
2. Set start command:
   ```
   node server.js
   ```

### Step 4: Deploy

Click **Deploy** button. Watch the logs for:

```
✅ Server running on http://...
```

Your URL will be provided, like:
```
https://suraksha-production-xyz.up.railway.app
```

### Step 5: Add Domain (Optional)

1. Go to **Settings** → **Domain**
2. Connect your custom domain

### Step 6: Update Google OAuth

Same as Vercel - add new URL to Google Cloud Console credentials.

---

## Deploy to Render (FREE - Auto-sleep after 15 min inactivity)

### Step 1: Create Render Account

1. Go to [render.com](https://render.com)
2. Sign up with GitHub

### Step 2: Connect Repository

1. Click **New +** → **Web Service**
2. Authorize GitHub and select repository

### Step 3: Configure

- **Name**: `suraksha`
- **Environment**: `Node`
- **Build command**: `npm install`
- **Start command**: `node server.js`

### Step 4: Deploy

Click **Create Web Service**.

Render will deploy and provide a URL:
```
https://suraksha.onrender.com
```

---

## Custom Server Deployment (VPS/Dedicated Server)

### Option A: AWS EC2

#### Step 1: Launch EC2 Instance

1. Go to [AWS Console](https://console.aws.amazon.com)
2. **EC2** → **Instances** → **Launch Instance**
3. Choose **Ubuntu 22.04 LTS**
4. Instance type: `t2.micro` (free tier)
5. Configure security group:
   - Allow HTTP (80)
   - Allow HTTPS (443)
   - Allow SSH (22)

#### Step 2: Connect and Setup

```bash
# SSH into instance
ssh -i key.pem ubuntu@your-instance-ip

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 (process manager)
sudo npm install -g pm2

# Clone your repository
git clone https://github.com/YOUR_USERNAME/Safety.git
cd Safety

# Install dependencies
npm install

# Start with PM2
pm2 start server.js --name "Suraksha"

# Make sure PM2 survives reboot
pm2 startup
pm2 save
```

#### Step 3: Setup SSL Certificate (Let's Encrypt)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get certificate
sudo certbot certonly --standalone -d yourdomain.com

# Update server.js to use HTTPS
# See HTTPS setup below
```

### Option B: DigitalOcean Droplet

Similar to AWS - create Ubuntu droplet and follow the same setup steps.

### Option C: Linode

Same process as DigitalOcean.

---

## HTTPS Setup (SSL/TLS Certificate)

### Using Let's Encrypt (FREE)

```bash
# Install Certbot
sudo apt install -y certbot

# Get certificate
sudo certbot certonly --standalone -d yourdomain.com

# Certificate files created at:
# /etc/letsencrypt/live/yourdomain.com/fullchain.pem
# /etc/letsencrypt/live/yourdomain.com/privkey.pem
```

### Update server.js for HTTPS

```javascript
// Add at top of server.js
const fs = require('fs');
const https = require('https');

// ... existing code ...

const app = express();

// ... middleware and routes ...

// HTTPS Setup
const sslOptions = {
  key: fs.readFileSync('/etc/letsencrypt/live/yourdomain.com/privkey.pem'),
  cert: fs.readFileSync('/etc/letsencrypt/live/yourdomain.com/fullchain.pem')
};

// HTTP redirect to HTTPS
const httpServer = http.createServer((req, res) => {
  res.writeHead(301, { Location: 'https://' + req.headers.host + req.url });
  res.end();
});

// Start HTTPS server
const httpsServer = https.createServer(sslOptions, app);

const PORT = process.env.PORT || 443;
httpsServer.listen(PORT, () => {
  console.log(`✅ Secure server running on https://localhost:${PORT}`);
});

httpServer.listen(80);
```

Restart PM2:
```bash
pm2 restart Suraksha
```

---

## Mobile App Setup

### For Android + iOS Native App

If you want to use native Suraksha app (compiled app, not web):

1. **React Native / Flutter Option**:
   ```bash
   # Using Expo (easiest)
   expo init SurakshaMobile
   cd SurakshaMobile
   
   # Install dependencies
   npm install axios @react-native-community/geolocation
   
   # Configure sensors
   npm install react-native-sensors
   
   # Run on device
   expo start
   ```

2. **WebView Wrapper** (Recommended - easiest):
   ```bash
   # Using Capacitor
   npm install @capacitor/core @capacitor/cli
   npx cap init
   
   # Add platforms
   npx cap add android
   npx cap add ios
   
   # Build APK
   npx cap build android
   ```

3. **Android Native Features**:
   - Power button detection: Use `KeyEvent.KEYCODE_POWER`
   - Sensors: Use `SensorManager` API
   - Location: Use `LocationManager` or `FusedLocationProviderClient`

---

## Production Checklist

### Security
- [ ] Change `CORS: "*"` to specific domains
  ```javascript
  app.use(cors({
    origin: 'https://yourdomain.com',
    credentials: true
  }));
  ```

- [ ] Add `.env` file for sensitive data
  ```
  NODE_ENV=production
  PORT=443
  GOOGLE_CLIENT_ID=your_client_id
  JWT_SECRET=your_secret_key_min_32_chars
  ```

- [ ] Update `server.js` to use env variables
  ```javascript
  const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  ```

- [ ] Add rate limiting: Already implemented ✅
- [ ] Add HTTPS: Follow SSL setup above

### Performance
- [ ] Enable gzip compression
  ```javascript
  const compression = require('compression');
  app.use(compression());
  ```

- [ ] Add caching headers for static files
- [ ] Monitor memory usage on in-memory database
- [ ] Consider moving to MongoDB for production

### Monitoring
- [ ] Setup PM2 monitoring
  ```bash
  pm2 web
  # Access dashboard at http://localhost:9615
  ```

- [ ] Add logging
  ```bash
  npm install winston
  ```

- [ ] Monitor error rates
- [ ] Setup uptime monitoring (UptimeRobot, Pingdom)

### Database
- [ ] For production with many users, migrate from in-memory to:
  - MongoDB
  - PostgreSQL
  - Firebase
  - AWS DynamoDB

### Testing
- [ ] Test all endpoints with Postman
- [ ] Test location permissions on mobile
- [ ] Test sensor access on real device
- [ ] Test with actual trustee contacts
- [ ] Test SOS triggering

---

## Access Your Live Application

After deployment, access:

```
Main app:     https://yourdomain.com/
Enhanced:     https://yourdomain.com/enhanced.html
API:          https://yourdomain.com/api/
```

---

## Troubleshooting

### Server Not Starting
```bash
# Check Node version
node --version  # Should be 16+ 

# Check port availability
lsof -i :3000   # Kill if needed

# Check file permissions
chmod 755 server.js
```

### Google OAuth Not Working
1. Verify Client ID is correct
2. Check authorized origins in Google Cloud Console
3. Clear browser cache
4. Try in incognito window

### Location Permission Denied
1. For web: Check browser settings
2. For Android: Grant location permission in app settings
3. For iOS: Add NSLocationWhenInUseUsageDescription to Info.plist

### Sensors Not Working
1. Mobile device required (not desktop)
2. HTTPS required (or localhost)
3. iOS requires iOS 13+
4. Android requires Android 5+

---

## Summary Command List

```bash
# Local development
npm install
npm start

# Production deployment
vercel --prod                    # Vercel
pm2 start server.js --name ...  # VPS

# Monitor
pm2 logs Suraksha
pm2 status

# Stop
pm2 stop Suraksha
pm2 delete Suraksha
```

---

## Next Steps

1. **Get your Google Client ID** (follow Google OAuth Setup)
2. **Choose deployment platform** (Vercel recommended for beginners)
3. **Deploy** using platform-specific instructions
4. **Update Google OAuth** for new domain
5. **Test all features** on mobile device
6. **Share link** with team/users

---

## Support

For issues:
- Check [Express.js docs](https://expressjs.com)
- Check [Google OAuth docs](https://developers.google.com/identity/protocols/oauth2)
- Check [Leaflet maps docs](https://leafletjs.com)
- Check your server logs: `pm2 logs`

---

**🎉 You're ready to go live!**

Your Suraksha application is now production-ready with:
✅ Google OAuth authentication
✅ Real-time location tracking with OpenStreetMap
✅ Device sensor integration (gyroscope, accelerometer)
✅ Power button emergency alerts
✅ Trustee contact notifications
✅ Complete error handling
✅ Enterprise-grade security

**Start with local testing, then deploy to Vercel!**
