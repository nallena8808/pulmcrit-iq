# PulmCrit IQ Vercel Package

This folder is ready to upload or import into Vercel. This version places the frontend in `public/`, which is the safest Vercel layout if a previous deployment showed `Not Found`.

## Deploy

1. Create a new Vercel project from this folder, or upload the public-layout zip.
2. Set the environment variable `PULMCRIT_ADMIN_KEY` to your admin key: `05062407med`.
3. Deploy.

## Notes

- Public pages and API routes are included. API requests are routed through `api/index.js`.
- Live article/guideline routes run through Vercel serverless functions.
- The packaged backend writes temporary runtime files under `/tmp` on Vercel, which avoids read-only filesystem deployment errors.
- Vercel's filesystem is not persistent. Admin uploads and content edits made after deployment should eventually be moved to persistent storage such as Vercel Blob, Supabase, or another database/storage service.
- Included `content-library.json`, caches, and uploaded files are packaged as the initial deployed content.
