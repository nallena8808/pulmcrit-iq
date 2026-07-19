# PulmCrit IQ Vercel Package

This folder is ready to upload or import into Vercel. This version places the frontend in `public/`, which is the safest Vercel layout if a previous deployment showed `Not Found`.

## Deploy

1. Create a new Vercel project from this folder, or upload the public-layout zip.
2. Set the environment variable `PULMCRIT_ADMIN_KEY` to your admin key: `05062407med`.
3. Create/connect Vercel Blob storage and add the Blob environment variable:
   `BLOB_READ_WRITE_TOKEN=<your Vercel Blob read/write token>`.
4. Add account recovery email variables:
   `RESEND_API_KEY=<your Resend API key>`
   `VERIFY_EMAIL_FROM=PulmCrit IQ <your-verified-sender@yourdomain.com>`
5. Deploy.

## Notes

- Public pages and API routes are included. API requests are routed through `api/index.js`.
- Live article/guideline routes run through Vercel serverless functions.
- The packaged backend uses Vercel Blob for new uploaded files and the admin content library when `BLOB_READ_WRITE_TOKEN` is present.
- If Blob is not configured, Vercel falls back to temporary runtime files under `/tmp`, and new admin uploads will not persist reliably.
- Included `content-library.json`, caches, and uploaded files are packaged as the initial deployed content.
- After deploying, open `admin.html`, unlock admin, and check the Storage panel. It should say `Vercel Blob` and `Permanent storage is active`.
- User registration creates the account immediately after checking email and username clashes. `RESEND_API_KEY` is used for forgot username/password recovery emails.
