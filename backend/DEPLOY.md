# Putting the Vetri Mart backend online (Render free + TiDB Cloud + Brevo)

What runs where:

| Part | Where | Why |
|---|---|---|
| Django API and admin | **Render** (free web service) | `render.yaml` in the project root describes it |
| Database (and the pictures) | **TiDB Cloud** (free cluster) | MySQL compatible. Pictures are kept in the database too, because Render's free disk is wiped on every restart |
| Emails (OTP, order updates) | **Brevo** web API | Render's free plan blocks SMTP, so Gmail login cannot be used there |
| Payments | Razorpay test keys | Saved in Admin → Payment settings |

Secrets (passwords, keys) are typed on the Render dashboard. They are never in git.

## 1. TiDB Cloud: get the connection details

1. Open your cluster → **Connect**. Create a database called `vetrimart` (SQL Editor: `CREATE DATABASE vetrimart;`).
2. In the Connect dialog choose **Public**, **General**/**Python** and **Generate password**. Note the **host**, **port (4000)**, **user** (looks like `abc123.root`) and password.
3. Click **Download CA cert** (a file such as `isrgrootx1.pem`). Save it, for example in `E:\certs\`.

## 2. Load your data into TiDB (from your laptop, once)

**Easy way:** in PowerShell, in the `backend` folder, run the script below. It asks for the TiDB details (the password is typed hidden), then exports your local data, creates the tables in TiDB, loads the data and saves the pictures.

```powershell
powershell -ExecutionPolicy Bypass -File .\load-to-tidb.ps1
```

**Manual way** (same steps, if you prefer to see each one):

Open PowerShell in the `backend` folder. The variables below only last for this window and are not written anywhere:

```powershell
$env:DB_HOST = "gateway01.xxxx.prod.aws.tidbcloud.com"
$env:DB_PORT = "4000"
$env:DB_USER = "abc123.root"
$env:DB_PASSWORD = "your-tidb-password"
$env:DB_NAME = "vetrimart"
$env:DB_SSL_CA = "E:\certs\isrgrootx1.pem"
$env:PYTHONUTF8 = "1"

venv\Scripts\python manage.py migrate
```

Export from your local MySQL **in a new PowerShell window** (without the variables above), then load into TiDB in the first window:

```powershell
venv\Scripts\python manage.py dumpdata --natural-foreign --natural-primary -e contenttypes -e auth.permission -e admin.logentry -e sessions -e token_blacklist -e siteconfig.mediafile --indent 1 -o data.json
```
```powershell
venv\Scripts\python manage.py loaddata data.json
venv\Scripts\python manage.py import_media
```

`import_media` copies every picture from `backend\media` into the database. Do not commit `data.json`: it holds customer data.

Your own admin login is part of the data, so it works online with the same password.

## 3. Brevo (emails)

1. Make a free account at brevo.com.
2. **Senders, Domains & Dedicated IPs → Senders → Add a sender:** use the Gmail address you want emails to come from and click the link Brevo emails you.
3. **SMTP & API → API keys → Generate a new API key** (name it `vetrimart`). Copy it for step 5. This is the API key, not the SMTP key.

## 4. GitHub

Create an empty **private** repository, for example `vetri-mart`. Then, in the project root folder:

```powershell
git init
git add .
git commit -m "Vetri Mart"
git branch -M main
git remote add origin https://github.com/YOUR-NAME/vetri-mart.git
git push -u origin main
```

`.gitignore` already keeps `.env`, `venv`, `media` and your data export out of git.

## 5. Render

1. render.com → **New → Blueprint** → connect your GitHub repository. Render reads `render.yaml`.
2. It asks for the values marked secret:
   - `DB_HOST`, `DB_NAME` (`vetrimart`), `DB_USER`, `DB_PASSWORD`: from step 1.
   - `SETTINGS_ENCRYPTION_KEY`: the same value as in your laptop `backend\.env` (so the saved Razorpay secret still works).
   - `BREVO_API_KEY`: from step 3.
3. Click **Apply**. The first build takes a few minutes. The address will be `https://vetrimart-api.onrender.com` (or similar).
4. Check: `/api/v1/health/` says `{"status":"ok"...}`, then `/api/docs/` (the API link for your team lead) and `/admin/`.

## 6. After it is online

- **Admin → Email settings:** tick "Send real emails", set the sender name and the **sender email (the one verified in Brevo)**, then use "Send a test email to". The SMTP boxes are not used online.
- **Admin → Payment settings:** check the Razorpay test keys are there.
- **Stop the server sleeping:** the free plan sleeps after 15 minutes without a request, and the first request then takes about a minute. A free monitor at uptimerobot.com that opens `/api/v1/health/` every 5 minutes keeps it awake.
- **App:** set `EXPO_PUBLIC_API_URL=https://vetrimart-api.onrender.com/api/v1` in `frontend/.env`, then restart Expo.

## Updating later

Push the change to GitHub; Render builds and deploys it. If the change adds database tables, run `migrate` from your laptop against TiDB (the variables in step 2) before or right after the push.

## Good to know

- A picture added in the admin or a profile photo is saved in TiDB, so it survives restarts.
- TiDB treats upper and lower case letters as different when comparing text. The app saves emails in lower case, but if a login or search behaves differently online, tell me.
- Everything is on free plans. Render's free service has about 750 hours a month, which covers one service running all month.
