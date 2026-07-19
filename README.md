# PulmCrit IQ

PulmCrit IQ is a pulmonary and critical care teaching website with a public learning grid, auto-fed PCCM articles, guideline buckets, landmark trials, image atlas uploads, and an admin backend.

## Deploy on Vercel

1. Import this GitHub repository into Vercel.
2. In Vercel, add these environment variables:

   `PULMCRIT_ADMIN_KEY=05062407med`

   `BLOB_READ_WRITE_TOKEN=<your Vercel Blob read/write token>`

   `RESEND_API_KEY=<your Resend API key>`

   `VERIFY_EMAIL_FROM=PulmCrit IQ <your-verified-sender@yourdomain.com>`

3. Deploy.

## Project Layout

- `public/` contains the website pages, styles, scripts, icons, and packaged upload assets.
- `api/` routes requests into the Node backend for Vercel.
- `server.js` powers article feeds, guidelines, Blob-backed uploads, admin content, and deletion.
- `content-library.json`, `articles-cache.json`, and `guidelines-cache.json` provide packaged starter data.

## Notes

Vercel Blob is used for uploaded files and for the admin content library JSON when `BLOB_READ_WRITE_TOKEN` is present. Without that token, Vercel can only use temporary runtime storage, so uploads will not persist reliably.

After deployment, open `admin.html`, unlock admin, and check the Storage panel. It should show `Vercel Blob` and `Permanent storage is active`.

User registration creates the account immediately after checking email and username clashes. Vercel Blob must be active before accounts, notebooks, uploads, and visit analytics will persist. In production, configure `RESEND_API_KEY` and `VERIFY_EMAIL_FROM` for forgot username/password recovery emails.
