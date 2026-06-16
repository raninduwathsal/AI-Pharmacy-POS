# Deployment Guide: AI-Pharmacy-POS

This document provides a comprehensive, step-by-step guide to deploying the AI-Pharmacy-POS application to production using **Aiven** (Database), **Render** (Backend), and **Vercel** (Frontend).

## Architecture Overview
- **Database:** Hosted MySQL on Aiven.
- **Backend:** Node.js API hosted on Render (using Infrastructure as Code via `render.yaml`).
- **Frontend:** React + Vite application hosted on Vercel.

---

## Phase 1: Database Setup (Aiven)

> [!IMPORTANT]
> The backend connects to the database via the `DATABASE_URL` environment variable. Our implementation automatically handles the strict SSL requirements enforced by Aiven.

1. **Create the Service:** Log in to your Aiven Console and create a new **MySQL** service.
2. **Retrieve Connection URI:** Once the service is running, locate your **Service URI** in the connection details. It should look like this:
   `mysql://avnadmin:your_password@host-name.aivencloud.com:port/defaultdb?ssl-mode=REQUIRED`
3. **Seed the Database:**
   Before the backend can be used, the database schema and default permissions must be seeded. You can run this from your local machine using the Aiven URI:
   ```bash
   cd backend
   DATABASE_URL="mysql://avnadmin:your_password@host..." npm run seed
   ```

---

## Phase 2: Backend Deployment (Render)

We have provided a `render.yaml` Blueprint to fully automate the backend infrastructure setup.

> [!TIP]
> The Blueprint automatically configures the Node.js environment, installs dependencies, maps the start commands, and generates a secure random `JWT_SECRET` for authentication.

1. **Connect to Render:** Log in to your [Render Dashboard](https://dashboard.render.com/).
2. **Deploy via Blueprint:** 
   - Click **New +** and select **Blueprint**.
   - Connect your Git repository containing this project.
   - Render will detect the `render.yaml` file in the root directory.
3. **Configure Environment:**
   During the Blueprint setup, Render will prompt you for the `DATABASE_URL`. Paste the **Service URI** you copied from Aiven in Phase 1.
4. **Deploy:** Click **Apply**. Render will build and deploy the `ai-pharmacy-backend` web service.
5. **Get Backend URL:** Once deployed, copy the public URL of your service (e.g., `https://ai-pharmacy-backend.onrender.com`).

---

## Phase 3: Frontend Deployment (Vercel)

1. **Import Project:** Log in to your [Vercel Dashboard](https://vercel.com/) and click **Add New... > Project**.
2. **Select Repository:** Import the repository containing your project.
3. **Configure Build Settings:**
   - **Framework Preset:** Vercel should automatically detect **Vite**.
   - **Root Directory:** Edit this and select the `frontend` folder.
4. **Configure Environment Variables:**
   Expand the **Environment Variables** section and add the following:
   - **Name:** `VITE_API_URL`
   - **Value:** Your Render backend URL from Phase 2, with `/api` appended (e.g., `https://ai-pharmacy-backend.onrender.com/api`).
5. **Deploy:** Click **Deploy**. Vercel will build the React application and provide you with a live URL.

---

## Phase 4: Post-Deployment Verification

1. **Visit your live Vercel URL.**
2. Attempt to log in using the default admin credentials (which were created during the seed process).
3. Open the **Financial Analytics** or **Audit Logs** tabs to verify that historical/seeded data is populating correctly, which confirms the database connection is healthy.

> [!NOTE]
> If you need to develop locally, your existing `./setup.sh` and `./start.sh` commands will still spin up a local Docker database and run the servers locally without interfering with the production configuration.
