# Medico — Medical IoT Monitoring System

A full-stack **Node.js + EJS + MySQL** web application for doctors to monitor patients' real-time vitals from IoT devices (ESP32), manage health alerts, and generate PDF reports.

## Tech Stack
| Layer | Technology |
|---|---|
| Runtime | Node.js 18+ |
| Framework | Express.js |
| Views | EJS |
| Styling | Tailwind CSS (CDN) |
| Database | MySQL 8+ |
| Auth | express-session + bcryptjs |
| IoT Auth | X-Api-Key header |
| PDF | pdfkit |

## Features
- Doctor Auth (Register / Login / Logout)
- Patient CRUD with device assignment
- IoT REST endpoint for ESP32 vitals
- Manual vital entry
- Auto-generated health alerts
- Rule-based disease matching (7 conditions)
- Disease history tracking
- PDF patient reports
- Responsive sidebar layout

## Quick Start

```bash
git clone https://github.com/Mayurkamthe/Helthcare.git
cd Helthcare
npm install
cp .env.example .env   # fill in your MySQL creds
npm run migrate        # create tables
npm run seed           # optional demo data
npm run dev            # http://localhost:3000
```

Demo login: `demo@medico.com` / `password123`

## IoT API

**POST** `/api/iot/vitals`  
Header: `X-Api-Key: medico-iot-key-2024`
```json
{ "deviceId": "ESP32-001", "heartRate": 78, "spo2": 98, "temperature": 36.7 }
```

## Deploy on Render
See `render.yaml` — supports one-click Blueprint deploy with free MySQL database.
