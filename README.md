# CoffeeDay Cafe - Full-Stack QR Ordering MVP

A dynamic, mobile-optimized, high-density, static dark-themed cafe QR ordering application. Customers can scan table QR codes to view the active cafe menu in real-time, adjust items in a compact shopping cart, and place orders instantly. Cafe owners can manage orders in a live prepared-queue feed and perform complete CRUD operations on menu items (add, edit, delete, and toggle in-stock availability) in the Admin Console.

---

## 🛠️ Tech Stack
* **Frontend**: React (Vite), React Router v6, HSL Dynamic Variable Design System
* **Backend**: Node.js, Express.js
* **Database**: MongoDB (Mongoose Schema with automatic seeding)
* **API Client**: Axios (Dynamic runtime base URL discovery)

---

## 📁 Repository Structure
```text
CoffeeDayCafe/
├── README.md                          # Root project documentation
└── restaurant-qr-app/                 # Main full-stack application folder
    ├── client/                        # React Frontend (Vite)
    │   ├── src/                       # Client source code
    │   └── dist/                      # Production compiled assets
    └── server/                        # Express Backend
        ├── models/                    # Mongoose database schemas
        ├── controllers/               # API route handlers
        └── config/                    # DB connection & Seeding logic
```

---

## 🚀 Quick Start Instructions

### 1. Database Configuration
Make sure your MongoDB server is running locally (default: `mongodb://127.0.0.1:27017/coffeedaycafe`) or set your cloud MongoDB connection string in `restaurant-qr-app/server/.env`:
```env
MONGO_URI=mongodb://127.0.0.1:27017/coffeedaycafe
PORT=5000
```

### 2. Run in Development Mode
To run the full-stack system in development (frontend and backend running as hot-reloading separate processes):

**Backend Server (Port 5000):**
```bash
cd restaurant-qr-app/server
npm install
node server.js
```

**Frontend Client (Port 5173):**
```bash
cd restaurant-qr-app/client
npm install
npm run dev
```

---

## 📦 Production Deployment

The Express server is configured to compile and serve the frontend statically under a **single Node process on port 5000**.

### 1. Compile the static frontend assets:
```bash
cd restaurant-qr-app/client
npm run build
```

### 2. Start the production full-stack server:
```bash
cd restaurant-qr-app/server
NODE_ENV=production node server.js
```
* **Customer Menu**: `http://localhost:5000/?table=3` (or your production IP/domain)
* **Owner Dashboard**: `http://localhost:5000/admin` (or your production IP/domain)

---

## 📋 Features Checklist
* [x] **Dynamic Mongoose Database Model**: Seamless Hex `_id` to virtual `id` conversions.
* [x] **Automatic DB Seeding**: Self-populating database with 5 default items on first start.
* [x] **High-Density 2-Column Mobile Grid**: Shortened image heights, truncated single-line description clamps, and full-width touch adjustments showing 4-6 items at once.
* [x] **Owner Dashboard CRUD Management**: Full Add, Edit, Delete, and Instant Availability Toggle switches at `/admin`.
* [x] **Dynamic Base URL Resolution**: Dynamic runtime API matching for staging or mobile local IP testing.
