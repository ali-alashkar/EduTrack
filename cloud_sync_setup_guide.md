# 📖 EduTrack — Complete Google Drive Sync Setup & Multi-User Guide

This guide covers everything step-by-step: initial setup, daily auto-sync usage, offline handling, and setting up a secondary user/PC to share the same database.

---

## 📌 Phase 1: One-Time Google Cloud Setup (Main PC)

### Step 1.1: Create a Google Cloud Project & Client ID
1. Open your browser and go to [https://console.cloud.google.com/credentials](https://console.cloud.google.com/credentials).
2. Create a new project (name it **EduTrack**).
3. Click **Create Credentials** → select **OAuth 2.0 Client ID**.
4. Set Application Type to **Desktop app**.
5. Give it a name (e.g. `EduTrack App`) and click **Create**.
6. Copy both your **Client ID** and **Client Secret**.

### Step 1.2: Enable Google Drive API
1. Go to [https://console.developers.google.com/apis/api/drive.googleapis.com](https://console.developers.google.com/apis/api/drive.googleapis.com).
2. Click the blue **ENABLE** button.

### Step 1.3: Add Your Gmail as a Test User
1. Go to [https://console.cloud.google.com/auth/audience](https://console.cloud.google.com/auth/audience).
2. Under **Test users**, click **+ ADD USERS**.
3. Type your **Gmail address** and click **Save**.

---

## 📌 Phase 2: Connecting EduTrack on Main PC

1. Open EduTrack on your PC.
2. Go to **Backup & Restore** → scroll down to **☁️ Google Drive Cloud Sync**.
3. Enter your **Client ID** and **Client Secret**.
4. Click **Open Google Authorization Page**.
5. Your browser will open. Select your Gmail account, click **Advanced** → **Go to EduTrack (unsafe)** → **Continue**.
6. Copy the **Authorization Code** generated on screen.
7. Paste the code into EduTrack and click **Connect**.
8. You will see **🟢 Connected**!
9. Click **Upload Now** to create your first cloud backup.

---

## 📌 Phase 3: How Cloud Sync Works Automatically

- **On App Startup**: Checks Google Drive. If Drive has newer data, it downloads it automatically before opening the UI.
- **Every 3 Minutes**: Uploads any new local changes to Google Drive in the background.
- **On App Close**: Flushes any remaining unsaved local changes to Google Drive.
- **Offline / No WiFi**: Skips sync quietly, marks status as `📶 Offline` or `⏳ Pending Upload`. It automatically retries as soon as internet is reconnected.

---

## 📌 Phase 4: Adding a New User / Secondary PC

If you have an assistant or a second computer that needs to access and sync with the same database:

### Step 4.1: Add Their Gmail to Google Cloud Project
1. Go to [https://console.cloud.google.com/auth/audience](https://console.cloud.google.com/auth/audience).
2. Under **Test users**, click **+ ADD USERS**.
3. Enter the **new user's Gmail address** and click **Save**.

### Step 4.2: Create Their User Account in EduTrack
1. On the main PC, open EduTrack → go to **Users & System Settings**.
2. Click **Create New User**.
3. Set a **Username**, **Password**, and assign their role (**Staff** or **Admin**).

### Step 4.3: Setup EduTrack on Their PC
1. Install and open EduTrack on the secondary PC.
2. Go to **Backup & Restore** → **Google Drive Cloud Sync**.
3. Enter the **SAME Client ID** and **Client Secret** from Phase 1.
4. Click **Open Google Authorization Page**.
5. Sign in with **their Gmail account**, grant permissions, and copy the authorization code.
6. Paste the code into EduTrack and click **Connect**.
7. Click **Download Now** to fetch all existing student data.

Now, both PCs will share, update, and auto-sync student records continuously! 🚀
