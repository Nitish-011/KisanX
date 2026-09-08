# KisanX (CropGuard) Frontend Integration Guide

This guide is designed for the Frontend Developer (using Antigravity or standard React/React Native) to seamlessly integrate with the KisanX FastAPI backend.

## 1. Environment & Setup

### Base API URL
The backend is currently running locally and is exposed to the internet via **Ngrok**.
- Check the terminal where `ngrok http 8000` is running to find the current public URL.
- Format: `https://<random-string>.ngrok-free.app`
- *Note: This URL changes every time Ngrok is restarted. Update your frontend environment variables accordingly.*

### Swagger / OpenAPI Docs
A highly interactive documentation UI is available at:
`{NGROK_URL}/docs`
You can use this to test APIs directly from your browser and view exact response schemas.

---

## 2. Authentication (Supabase)

The backend relies on **Supabase** for user management and authentication. The frontend should connect directly to Supabase.

### Configuration
```env
SUPABASE_URL=https://eahcutkkosdvyztdmyot.supabase.co
SUPABASE_ANON_KEY=sb_publishable_DCCVzTYD37zpFvqo2ZlNaA_5CEYdJcC
```

### Authentication Flow
1. **Login/Signup**: Use the Supabase Client SDK in the frontend to authenticate the user.
2. **Access Token**: Upon successful login, Supabase returns a session object containing an `access_token` (JWT).
3. **Backend Authorization**: For every request to the KisanX backend, include this token in the header:
```javascript
const headers = {
    "Authorization": `Bearer ${session.access_token}`,
    "Content-Type": "application/json"
}
```

---

## 3. Full API Endpoint Reference

All endpoints below require the `Authorization` header unless explicitly stated otherwise.

### 🌐 System & Health
Endpoints to check if the server is running. No Auth required.

- **`GET /`** - Root Endpoint. Returns API version.
- **`GET /health`** - Healthcheck. Returns `{"status": "ok"}`.

---

### 🌾 Farms, Plots & Crops
Manages the user's agricultural assets.

**`POST /api/farms/register`**
- **Purpose**: Registers a farmer, their first plot, and their first crop cycle all in one atomic transaction.
- **Request Body (JSON)**:
```json
{
  "farm": {
    "name": "My Farm",
    "village": "Sangamner",
    "district": "Ahmednagar",
    "latitude": 19.5682,
    "longitude": 74.2111,
    "area_acres": 5.0
  },
  "plot": {
    "name": "Plot A",
    "area_acres": 2.5,
    "latitude": 19.5682,
    "longitude": 74.2111
  },
  "crop_cycle": {
    "crop_name": "sugarcane",
    "variety": "co-86032",
    "planting_date": "2026-06-15",
    "soil_type": "black_cotton"
  }
}
```
- **Response**: `201 Created` with the newly created `farm`, `plot`, and `crop_cycle` objects. Save the `crop_cycle.id` as it is needed for other endpoints.

---

### 🦠 AI Disease Diagnosis (USP 1 & 5)
Automated disease detection via image upload.

**`POST /api/diagnoses`**
- **Purpose**: Uploads a photo of a sick leaf, saves it to Supabase Storage, and returns an AI disease prediction and treatment prescription.
- **Content-Type**: `multipart/form-data`
- **Fields**:
  - `file`: (File) The image file.
  - `crop_cycle_id`: (String) ID of the crop cycle.
  - `latitude`: (String) e.g., "19.5682"
  - `longitude`: (String) e.g., "74.2111"
  - `language`: (String, Optional) e.g., "en" or "hi".
- **Response**: `200 OK` with the `prediction` (disease, confidence) and `prescription` (treatment steps).

**`GET /api/diagnoses`**
- **Purpose**: Retrieves a history of all diagnoses made by the authenticated user.
- **Response**: `200 OK` with a list of diagnoses.

**`GET /api/diagnoses/{id}`**
- **Purpose**: Fetches a single diagnosis record by its ID, including its associated prescription.

---

### 🪤 Pest Trap Scanning (USP 2)
Automated pest counting from sticky trap photos.

**`POST /api/trap-counts`**
- **Purpose**: Uploads a photo of a pest trap, saves it to storage, and counts the number of pests. Checks if the count exceeds the Economic Threshold Level (ETL).
- **Content-Type**: `multipart/form-data`
- **Fields**:
  - `file`: (File) The image file.
  - `crop_cycle_id`: (String)
  - `pest_species`: (String) e.g., "pink_bollworm"
  - `crop`: (String) e.g., "cotton"
- **Response**: `200 OK` with `count`, `etl_threshold`, and `action_needed` (boolean).

**`GET /api/trap-counts/{crop_cycle_id}`**
- **Purpose**: Gets the history of trap counts for a specific crop cycle.

---

### ⚠️ Risk Scores & Hotspots (USP 3 & 4)
Real-time environmental risk assessment.

**`GET /api/risk-score/{crop_cycle_id}`**
- **Purpose**: Calculates a risk score (0-100) based on location and crop type. Returns a color warning (green/yellow/red) and the crop's current growth stage.
- **Response**: `200 OK` with `score`, `color_code`, and `stage_name`.

**`POST /api/hotspot-reports`**
- **Purpose**: Manually report a confirmed disease outbreak to alert nearby farmers.
- **Request Body (JSON)**:
```json
{
  "diagnosis_id": "uuid-of-diagnosis",
  "latitude": 19.5682,
  "longitude": 74.2111,
  "disease": "RedRot",
  "confirmed_by": "farmer"
}
```

**`GET /api/hotspots?days=30`**
- **Purpose**: Retrieves regional disease hotspots (useful for rendering a Heatmap on the frontend).
- **Response**: `200 OK` with a summary of diseases and coordinates.

---

### 💬 Feedback System (USP 7)
Allows farmers to rate the AI diagnoses, improving future accuracy.

**`POST /api/feedback`**
- **Purpose**: Submit feedback for a specific diagnosis.
- **Request Body (JSON)**:
```json
{
  "diagnosis_id": "uuid",
  "outcome": "yes", // or "no"
  "comment": "Worked well"
}
```

**`GET /api/feedback/{diagnosis_id}`**
- **Purpose**: Get feedback history for a specific diagnosis.

---

### 🛒 Crop Marketplace (USP 8)
Platform for farmers to sell their produce to buyers.

**`POST /api/market/listings`**
- **Purpose**: Create a new crop listing. AI automatically assigns a `quality_score`.
- **Request Body (JSON)**:
```json
{
  "crop_type": "sugarcane",
  "variety": "Co-86032",
  "grade": "A",
  "quantity": 100.0,
  "unit": "quintal",
  "asking_price": 3500.0,
  "latitude": 19.5682,
  "longitude": 74.2111,
  "district": "Ahmednagar",
  "harvest_date": "2026-12-15"
}
```

**`GET /api/market/listings`**
- **Purpose**: Fetch available crop listings. (Optional query param: `?sort=quality` or `?sort=price_asc`).

**`GET /api/market/listings/{id}`**
- **Purpose**: Get details of a single listing.

**`PATCH /api/market/listings/{id}`**
- **Purpose**: Update a listing (e.g., modifying `asking_price`).

**`POST /api/market/orders`**
- **Purpose**: Place an order for a crop listing.

---

### 🚜 Input Marketplace (USP 9)
Buy agricultural inputs (seeds, fertilizers) from registered sellers.

**`POST /api/inputs/sellers`**
- **Purpose**: Register a new seller (requires admin approval pending status).
- **Request Body (JSON)**:
```json
{
  "name": "Agri Inputs Pvt Ltd",
  "license_no": "MH-AH-2026-1234",
  "cib_registration_ref": "CIB/2026/5678",
  "district": "Ahmednagar",
  "phone": "+919876543210"
}
```

**`GET /api/inputs/products`**
- **Purpose**: Fetch a catalog of available farming inputs.

---

### 👨‍🌾 Agronomist Consultation (USP 10)
Connect farmers with agricultural experts.

**`GET /api/agronomists`**
- **Purpose**: List available agronomists.

**`POST /api/consultations`**
- **Purpose**: Book a consultation with an expert.
- **Request Body (JSON)**:
```json
{
  "agronomist_id": "uuid",
  "diagnosis_id": "uuid", // Optional, ties the chat to a specific disease
  "channel": "chat" // or "video"
}
```

---

## 4. Frontend Developer Integration Tips
- **Image Uploads**: You do not need to interact with the Supabase Storage API directly from the frontend. Just use `FormData` to send the image file to our `/api/diagnoses` or `/api/trap-counts` endpoints, and the backend will handle uploading the image to the correct bucket and linking the URL.
- **Handling Errors**: Ensure you catch `401 Unauthorized` responses and log the user out or refresh their Supabase token on the frontend if their session expires.
- **CORS Setup**: The backend currently permits requests from `http://localhost:3000` and `http://localhost:8081`. If your local setup uses a different port, ask the backend developer to update the `CORS_ORIGINS` variable in `.env`.
