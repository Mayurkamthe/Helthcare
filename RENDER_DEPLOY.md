# Render Deployment Guide

## Prerequisites
- Free account at [render.com](https://render.com)
- This repo pushed to GitHub

---

## Option A — Blueprint (Recommended, One-Click)

1. Go to **render.com → New → Blueprint**
2. Connect your GitHub account and select **Mayurkamthe/Helthcare**
3. Render reads `render.yaml` and creates:
   - A **Web Service** (`medico-app`)
   - A **MySQL Database** (`medico-db`) — free tier
4. Click **Apply** — Render provisions everything automatically
5. Once the build finishes, open your URL and register a doctor account

> The `buildCommand` in `render.yaml` runs `npm install && node src/config/migrate.js`
> which creates all tables automatically on first deploy.

---

## Option B — Manual Setup

### Step 1 — Create MySQL Database
1. Render dashboard → **New → PostgreSQL** (select **MySQL** if available, else use PlanetScale below)
2. Name: `medico-db`
3. Copy the **Internal Connection String** details (host, port, user, password, database)

> **Tip:** Render's free tier offers PostgreSQL natively. For MySQL, use **PlanetScale** free tier (see below).

### Step 2 — Create Web Service
1. Render dashboard → **New → Web Service**
2. Connect repo: `Mayurkamthe/Helthcare`
3. Settings:
   - **Environment:** Node
   - **Build Command:** `npm install && node src/config/migrate.js`
   - **Start Command:** `node src/app.js`
   - **Plan:** Free

### Step 3 — Set Environment Variables
In the Web Service → **Environment** tab, add:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `PORT` | `10000` |
| `DB_HOST` | *(from database)* |
| `DB_PORT` | `3306` |
| `DB_USER` | *(from database)* |
| `DB_PASSWORD` | *(from database)* |
| `DB_NAME` | `medico_db` |
| `JWT_SECRET` | *(generate: 64-char random string)* |
| `SESSION_SECRET` | *(generate: 64-char random string)* |
| `IOT_API_KEY` | `medico-iot-key-2024` |

### Step 4 — Deploy
Click **Save and Deploy**. First deploy takes ~2 minutes.

---

## Using PlanetScale (Free MySQL)

PlanetScale offers a free MySQL-compatible database:

1. Create account at [planetscale.com](https://planetscale.com)
2. New database → name it `medico-db`
3. Create a branch `main` → **Connect** → select **Node.js**
4. Copy the connection string details into Render env vars
5. Add `?ssl={"rejectUnauthorized":true}` to your DB connection if required

Update `src/config/db.js` for PlanetScale SSL:
```js
const pool = mysql2.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: true },   // add this line
  waitForConnections: true,
  connectionLimit: 10,
});
```

---

## After Deployment

1. Visit your Render URL (e.g. `https://medico-app.onrender.com`)
2. Register a new doctor account
3. Add patients, assign device IDs
4. Point your ESP32 to: `https://medico-app.onrender.com/api/iot/vitals`

> **Note:** Free Render web services spin down after 15 minutes of inactivity.
> The first request after sleeping takes ~30 seconds to wake up.
> Upgrade to Starter ($7/mo) for always-on hosting.

---

## Verify Deployment

```bash
# Health check
curl https://your-app.onrender.com/

# Test IoT endpoint
curl -X POST https://your-app.onrender.com/api/iot/vitals \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: medico-iot-key-2024" \
  -d '{"deviceId":"ESP32-001","heartRate":75,"spo2":98,"temperature":36.6}'
```
