# PulmCrit IQ

PulmCrit IQ is a pulmonary and critical care teaching website with a public learning grid, auto-fed PCCM articles, guideline buckets, landmark trials, image atlas uploads, and an admin backend.

## Deploy on Vercel

1. Import this GitHub repository into Vercel.
2. In Vercel, add this environment variable:

   `PULMCRIT_ADMIN_KEY=05062407med`

3. Deploy.

## Project Layout

- `public/` contains the website pages, styles, scripts, icons, and packaged upload assets.
- `api/` routes requests into the Node backend for Vercel.
- `server.js` powers article feeds, guidelines, uploads, admin content, and deletion.
- `content-library.json`, `articles-cache.json`, and `guidelines-cache.json` provide packaged starter data.

## Notes

Vercel's filesystem is temporary during runtime. Admin uploads and edits work as packaged/runtime content, but long-term production storage should eventually move to persistent storage such as Vercel Blob, Supabase, or another database/storage service.
