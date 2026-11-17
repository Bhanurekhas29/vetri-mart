# Vetri Mart: Working Rules for Claude

Read `PLAN.md` first. It holds all decisions made so far.

## How to work with me (always)
1. **Discuss, confirm, then code.** For any code generation: explain the approach, ask questions, wait for my confirmation, and only then write code.
2. **After code, list test cases** for me to run (happy path, edge cases, failure cases).
3. Ask me questions and give suggestions. I am a solo developer and want to plan page by page, section by section.
4. Do not change decisions recorded in `PLAN.md` without asking. When a decision is made, update `PLAN.md`.

## Project
- Single-store e-commerce Android app for a client demo (not a Play Store release), India, INR.
- Frontend: React Native with Expo, in `frontend/`.
- Backend: Django + Django REST Framework, project name `vetrimart`, in `backend/`.
- Database: MySQL.
- Only two top-level folders: `frontend` and `backend`.

## Rules
- All content shown in the app (products, home sections, banners, offers) comes from the backend and is managed in the admin panel. Do not hardcode it in the app.
- No duplicated data in the schema; use unique constraints and foreign keys.
- Passwords and OTPs are always hashed. Never store card details.
- Money is DECIMAL. Timestamps are UTC.
- Discount percentages are calculated from MRP and price, not stored.
- Order items store the price paid at purchase time.
- Media files are stored in cloud storage; the DB holds URLs only.
- Keep secrets (DB password, SMTP, Razorpay keys, Django SECRET_KEY) in environment variables, never in git.

## Brand
Navy `#0B1F4B`, Orange `#F57C00`, background `#F7F8FC`, text `#1B1F2A`. Orange is for buttons and badges, not text on white.

## Current stage
Planning screens. Next: the Home page. No code written yet.
