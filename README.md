# Rhythm Stream

A vibrant, modern music streaming platform built with React (TypeScript), FastAPI (Python), and Vanilla CSS.

## Features
- **Browse Top Tracks:** Explore the latest hits via the Deezer API.
- **Track Previews:** Listen to short snippets of your favorite songs.
- **Vibrant UI:** Stylized glassmorphic design with neon colors and smooth transitions.
- **User Profiles (Planned):** Save favorites and get personalized recommendations.

## Tech Stack
- **Frontend:** React, Vite, TypeScript, Vanilla CSS.
- **Backend:** FastAPI, Python, SQLModel (SQLite).
- **API:** Deezer API Proxy.

## Getting Started

### 1. Backend Setup
1. Navigate to the `backend` directory:
   ```bash
   cd rhythm-stream/backend
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Start the server:
   ```bash
   python -m uvicorn main:app --reload --port 8000 --ssl-keyfile ../key.pem --ssl-certfile ../cert.pem
   ```
   The backend will be running at `https://localhost:8000`.

### 2. Frontend Setup
1. Navigate to the `frontend` directory:
   ```bash
   cd rhythm-stream/frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the dev server:
   ```bash
   npm run dev
   ```
   The frontend will be running at `https://localhost:5174`.

## Architecture
- **Deezer API Proxy:** The backend acts as a bridge to the Deezer API to handle music metadata and avoid CORS issues.
- **Persistent Player:** A global audio state ensures music continues playing as you navigate.
- **Vibrant Design:** Pure Vanilla CSS implementation of modern design trends like Glassmorphism.
