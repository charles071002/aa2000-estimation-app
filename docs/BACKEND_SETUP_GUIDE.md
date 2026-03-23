# Step-by-Step Guide: Backend with MongoDB Atlas

This guide walks you through adding a backend server to your AA2000 Site Survey app and storing data in **MongoDB Atlas** (cloud database) so that finalized reports and project data can be shared across devices.

---

## Part 1: MongoDB Atlas (Database in the Cloud)

### Step 1.1 – Create a MongoDB Atlas account

1. Go to **[https://www.mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)**.
2. Click **“Try Free”** and sign up (email or Google).
3. Log in to the Atlas dashboard.

### Step 1.2 – Create a free cluster

1. Choose **“Build a Database”** (or “Create”).
2. Select **“M0 FREE”** (Shared) – no credit card required.
3. Pick a **cloud provider and region** (e.g. **AWS** and a region near you, e.g. **Singapore**).
4. Click **“Create Cluster”** and wait 1–2 minutes until it’s ready.

### Step 1.3 – Create a database user (for your app to log in)

1. In the cluster view, click **“Database Access”** (left sidebar) → **“Add New Database User”**.
2. Choose **“Password”** authentication.
3. Set a **username** (e.g. `aa2000app`) and a **strong password** (save it somewhere safe).
4. Under “Database User Privileges”, leave **“Read and write to any database”** (or choose “Atlas admin” for this learning project).
5. Click **“Add User”**.

### Step 1.4 – Allow your app (and your PC) to connect to the cluster

1. Click **“Network Access”** (left sidebar) → **“Add IP Address”**.
2. For development:
   - Click **“Allow Access from Anywhere”** (adds `0.0.0.0/0`).
   - Confirm. (For production you’d restrict this to your server IP only.)
3. Click **“Finish”**.

### Step 1.5 – Get your connection string

1. Go back to **“Database”** (left sidebar).
2. On your cluster, click **“Connect”**.
3. Choose **“Connect your application”**.
4. Select **Driver: Node.js** and copy the connection string. It looks like:
   ```text
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
5. Replace `<username>` with your database user (e.g. `aa2000app`) and `<password>` with that user’s password.  
   If the password has special characters (e.g. `#`, `@`), encode them (e.g. `#` → `%23`).
6. Save this string somewhere safe – you’ll put it in your backend as an environment variable (e.g. `MONGO_URI`).

---

## Part 2: Backend Server (Node.js + Express)

Your backend will run on your PC (or a server when you deploy). It will use this MongoDB Atlas database.

### Step 2.1 – Create the backend folder

In your project root (same level as `package.json` for the frontend), create a backend folder:

```bash
mkdir backend
cd backend
```

### Step 2.2 – Initialize the backend project

Inside `backend/`:

```bash
npm init -y
```

### Step 2.3 – Install backend dependencies

```bash
npm install express mongoose cors dotenv multer
```

- **express** – web server and API routes  
- **mongoose** – connect to MongoDB and define models  
- **cors** – allow your frontend (different origin) to call the API  
- **dotenv** – load environment variables (e.g. `MONGO_URI`)  
- **multer** – handle file uploads (e.g. estimation .docx)

### Step 2.4 – Create environment file (never commit the real password)

In `backend/`, create a file named **`.env`**:

```env
PORT=4000
MONGO_URI=mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/aa2000?retryWrites=true&w=majority
```

- Replace the whole `MONGO_URI` value with your real Atlas connection string from Step 1.5.
- Use the database name you want (e.g. `aa2000` in the path before `?`).

Create **`.env.example`** (safe to commit) so others know what variables are needed:

```env
PORT=4000
MONGO_URI=your_mongodb_atlas_connection_string_here
```

Add `backend/.env` to your **`.gitignore`** so the real URI and password are never pushed to Git.

### Step 2.5 – Create the main server file

In `backend/`, create **`server.js`** (or `index.js`):

```javascript
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;

// Allow frontend (e.g. localhost:3002) to call this API
app.use(cors({ origin: ['http://localhost:3002', 'http://localhost:3000'] }));
app.use(express.json({ limit: '10mb' }));

// Connect to MongoDB Atlas
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Connected to MongoDB Atlas'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Optional: health check
app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'Backend is running' });
});

// ---------- ROUTES WILL BE ADDED HERE (projects, upload, etc.) ----------

app.listen(PORT, () => {
  console.log(`Backend server running at http://localhost:${PORT}`);
});
```

### Step 2.6 – Test that the backend runs and connects to Atlas

1. From the `backend/` folder run:

   ```bash
   node server.js
   ```

2. You should see:
   - `Connected to MongoDB Atlas`
   - `Backend server running at http://localhost:4000`
3. In a browser, open: **http://localhost:4000/api/health**  
   You should get JSON: `{ "ok": true, "message": "Backend is running" }`.
4. Stop the server with **Ctrl+C**.

---

## Part 3: Store “Projects” in MongoDB (replace localStorage)

Next you define a **Project** model and API so the app can save/load projects from Atlas instead of localStorage.

### Step 3.1 – Create a projects model

In `backend/`, create folder **`models`** and file **`models/Project.js`**:

```javascript
const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  technicianName: String,
  clientName: String,
  clientContact: String,
  location: String,
  date: String,
  status: String,
  // Store the same structure your frontend uses (cctvData, faData, estimations, etc.)
  cctvData: mongoose.Schema.Types.Mixed,
  faData: mongoose.Schema.Types.Mixed,
  fpData: mongoose.Schema.Types.Mixed,
  acData: mongoose.Schema.Types.Mixed,
  baData: mongoose.Schema.Types.Mixed,
  otherData: mongoose.Schema.Types.Mixed,
  estimations: mongoose.Schema.Types.Mixed,
  estimationData: mongoose.Schema.Types.Mixed,
  techNotes: String,
  remarks: Array,
}, { timestamps: true });

module.exports = mongoose.model('Project', projectSchema);
```

### Step 3.2 – Add project API routes

In **`server.js`**, add after the health route:

```javascript
const Project = require('./models/Project');

// Get all projects (replaces reading from localStorage)
app.get('/api/projects', async (req, res) => {
  try {
    const projects = await Project.find().sort({ createdAt: -1 });
    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save or update one project (replaces saving to localStorage)
app.post('/api/projects', async (req, res) => {
  try {
    const payload = req.body;
    const project = await Project.findOneAndUpdate(
      { id: payload.project?.id || payload.id },
      { $set: payload },
      { new: true, upsert: true }
    );
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a project
app.delete('/api/projects/:id', async (req, res) => {
  try {
    await Project.deleteOne({ id: req.params.id });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

Restart the backend and test with Postman or curl:

- **GET** `http://localhost:4000/api/projects` → list of projects (initially `[]`).
- **POST** `http://localhost:4000/api/projects` with JSON body `{ "project": { "id": "test-1" }, "techNotes": "Hello" }` → saves to Atlas.

---

## Part 4: Point Your Frontend to the Backend

So far data is still in localStorage. To use the backend:

1. **Backend URL**  
   When running locally: `http://localhost:4000` (or whatever `PORT` you set in `backend/.env`).

2. **Frontend env**  
   In your frontend root `.env`, add (or update):

   ```env
   VITE_API_BASE_URL=http://localhost:4000
   ```

3. **Use the API instead of localStorage**  
   Where you currently do:
   - `localStorage.getItem('aa2000_saved_projects')`  
   replace with a **GET** request to `VITE_API_BASE_URL/api/projects`.
   - `localStorage.setItem('aa2000_saved_projects', ...)`  
   replace with a **POST** request to `VITE_API_BASE_URL/api/projects` with the project payload.

   You can keep a small layer that:
   - On load: fetch projects from `/api/projects` and then use them like you did with localStorage.
   - On save: POST the current project (or full list, depending on your API design) to `/api/projects`.

After this, data is in **MongoDB Atlas**, so any device that uses the same frontend URL and backend URL will see the same projects (no localStorage).

---

## Part 5: File Upload (e.g. Estimation .docx) to backend

You already have an upload to an external URL. To do it through your own backend and optionally store in Atlas (or on disk):

1. In `server.js`, add multer and a folder for uploads:

   ```javascript
   const multer = require('multer');
   const upload = multer({ dest: 'uploads/' });
   ```

2. Add a route, e.g.:

   ```javascript
   app.post('/api/estimation/upload', upload.single('estimationDoc'), (req, res) => {
     if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
     // Optionally save file path or metadata to MongoDB
     res.json({ ok: true, path: req.file.path });
   });
   ```

3. In the frontend, set `VITE_API_BASE_URL` to `http://localhost:4000` and POST the file to `VITE_API_BASE_URL/api/estimation/upload` with field name `estimationDoc`.

---

## Part 6: Run Frontend and Backend Together (local)

1. **Terminal 1 – Backend**
   ```bash
   cd backend
   node server.js
   ```
2. **Terminal 2 – Frontend**
   ```bash
   npm run dev
   ```
3. Use the app at `http://localhost:3002` (or the port Vite shows). It will read/save projects via the backend, and the backend will read/write **MongoDB Atlas**.

---

## Part 7: When You Deploy

- **Frontend:** Deploy the Vite build (e.g. to Vercel/Netlify). Set `VITE_API_BASE_URL` to your **backend’s public URL** (e.g. `https://your-backend.railway.app`).
- **Backend:** Deploy the `backend/` app to a Node host (Railway, Render, Fly.io, etc.). Set `MONGO_URI` and `PORT` in the host’s environment (same as in `.env`).
- **MongoDB Atlas:** Already in the cloud; no extra deploy. For production, in Atlas “Network Access” restrict IPs to your backend server’s IP if possible.

---

## Quick checklist

| Step | What you do |
|------|------------------|
| 1 | Create MongoDB Atlas account and M0 FREE cluster |
| 2 | Create DB user and get connection string; add IP allow list |
| 3 | Create `backend/`, `npm init`, install express, mongoose, cors, dotenv, multer |
| 4 | Add `backend/.env` with `MONGO_URI` and `PORT`; add `server.js` and connect to Atlas |
| 5 | Add `Project` model and GET/POST/DELETE `/api/projects` routes |
| 6 | In frontend, set `VITE_API_BASE_URL` and replace localStorage with API calls |
| 7 | Run backend + frontend; confirm projects save and load from Atlas |
| 8 | (Optional) Add `/api/estimation/upload` and point frontend upload there |
| 9 | Deploy backend and frontend; set env vars in production |

If you tell me which step you’re on (e.g. “Step 2.5” or “adding Project model”), I can give you exact code tailored to your current project structure (e.g. your `aa2000_saved_projects` format).
