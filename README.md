# DriveTo

DriveTo is a modern personal cloud storage app built with Next.js, Tailwind CSS, and Supabase. It includes secure auth, a drive-style dashboard, folders, uploads, previews, native text and CSV editing, share links, version history, search, recent files, trash recovery, realtime updates, and ONLYOFFICE-powered Office editing for collaborative `.docx` and `.xlsx` sessions.

## Stack

- Next.js App Router
- React 19
- Tailwind CSS
- Supabase Auth
- Supabase Database
- Supabase Storage
- Supabase Realtime
- ONLYOFFICE Document Server

## Features

- Email/password authentication with Supabase
- Dark SaaS-style dashboard with responsive sidebar layout
- Folder creation and nested organization
- Drag-and-drop file moves into folders
- Upload via drag and drop or file picker
- File metadata with name, size, upload date, and last opened date
- Browser preview for images, PDFs, text documents, spreadsheets, and supported Office files
- In-browser editing for text documents, CSV sheets, `.docx`, and `.xlsx`
- ONLYOFFICE-backed editing for `.docx` and `.xlsx` with real-time collaboration, presence, comments, and high-fidelity Office UX
- Share links with `view` or `edit` permissions
- Version history stored in Supabase
- Recent files and trash recovery views
- Realtime syncing for drive items and share links

## Project Structure

```text
app/
  dashboard/page.tsx
  share/[token]/page.tsx
  signin/page.tsx
components/
  auth/
  dashboard/
  editors/
  share/
lib/
  constants.ts
  drive.ts
  onlyoffice.ts
  types.ts
  utils.ts
  supabase/
  server/
pages/
  api/
app/
  api/onlyoffice/
supabase/
  schema.sql
proxy.ts
```

## Local Setup

1. Install dependencies:

```bash
npm install
```

Requirements:

- Node.js `20.9+`
- On Windows, keep the project on an `NTFS` drive. Next.js builds can fail on `exFAT` volumes with `EISDIR/readlink` errors during compilation.

2. Create `.env.local` from `.env.example`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_ONLYOFFICE_URL=http://localhost:8080
ONLYOFFICE_JWT_SECRET=replace-with-your-onlyoffice-jwt-secret
ONLYOFFICE_CALLBACK_URL=http://host.docker.internal:3000
```

3. In Supabase:

- Create a new project.
- Open the SQL editor and run [`supabase/schema.sql`](./supabase/schema.sql).
- In Authentication, enable email/password sign-ins.
- Confirm the storage bucket exists as `user-files`.
- In Database Replication, make sure `drive_items`, `share_links`, and `file_versions` are included in realtime.
- If you want collaborative Office editing, run an ONLYOFFICE Document Server instance and configure the three ONLYOFFICE environment variables above.

4. Start the app:

```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000).

## Supabase Notes

- `NEXT_PUBLIC_SUPABASE_ANON_KEY` is used for auth, database access, and authenticated storage access from the browser.
- `SUPABASE_SERVICE_ROLE_KEY` is used only on the server for public share routes and shared editing endpoints.
- Storage objects are saved under a per-user prefix: `auth.uid()/uuid-filename`.

## ONLYOFFICE Setup

1. Start ONLYOFFICE Document Server locally or on a reachable host. A simple Docker option is:

```bash
docker run -i -t -d -p 8080:80 -e JWT_ENABLED=true -e JWT_SECRET=replace-with-your-onlyoffice-jwt-secret onlyoffice/documentserver
```

2. Set the matching env values:

- `NEXT_PUBLIC_ONLYOFFICE_URL`: the browser-facing Document Server URL, for example `http://localhost:8080`
- `ONLYOFFICE_JWT_SECRET`: the same JWT secret configured in Document Server
- `ONLYOFFICE_CALLBACK_URL`: the URL Document Server can call back into for saves, for example `http://host.docker.internal:3000` in Docker-based local development

3. Restart the app after changing env values.

4. Open a `.docx` or `.xlsx` file from the dashboard. DriveTo will keep the existing layout and embed ONLYOFFICE inside the current editor surface.

## ONLYOFFICE Integration Notes

- DriveTo uses signed Supabase storage URLs to load the Office document into ONLYOFFICE.
- ONLYOFFICE save callbacks write the updated file back into the canonical Supabase object and also create immutable version snapshots in `file_versions`.
- Public share links reuse the same integration and respect `view` versus `edit` permission when building the editor config.
- Comments and collaborative cursors come from ONLYOFFICE itself; DriveTo adds an outer auto-save state, last-edited timestamp, and lightweight presence avatars without redesigning the app shell.
- If ONLYOFFICE is not configured, DriveTo falls back to the existing built-in `.docx` and `.xlsx` editor path so current functionality does not break.

## Important Implementation Notes

- Browser editing now supports text files, CSV/TSV sheets, `.docx`, and `.xlsx`.
- `.docx` edits are written back into the original document package so the file remains `.docx`.
- `.xlsx` edits are written back into spreadsheet workbooks so the file remains `.xlsx`.
- When ONLYOFFICE is configured, `.docx` and `.xlsx` open in a true collaborative Office editor while still saving back in the original format.
- This is still not a full Microsoft Office or WPS rendering engine. Advanced layout, macros, formula behavior, comments, and complex formatting may not round-trip perfectly for every Office file.
- Trash is implemented as soft delete using `deleted_at`, so users can restore items quickly.
- Version entries are created on upload and on each in-browser save.
- Share links are public URLs backed by server-side validation and signed storage URLs.

## Dependency Note

- The current `.xlsx` editing path uses the `xlsx` package. `npm audit` reports a high-severity upstream advisory on that package with no automatic fix available at the time of writing.
- For a personal-storage app where files are owner-controlled, this may be an acceptable tradeoff. If you plan to process untrusted spreadsheets broadly, consider replacing that dependency with a safer alternative or isolating workbook parsing further.

## Deployment

This app is ready for Vercel:

- Add the same environment variables in Vercel project settings.
- Deploy as a standard Next.js app.
- Point it at the same Supabase project.

## Windows Build Note

This workspace is currently on `E:` formatted as `exFAT`. I verified the codebase with:

- `npx tsc --noEmit`
- dependency installation on the upgraded stack

But `next build` still fails locally on this drive because Next.js expects filesystem link behavior that `exFAT` does not provide reliably on Windows. Moving the project to an `NTFS` volume such as `C:` should unblock local production builds.

## Build Lock Recovery

DriveTo now includes a cleanup flow for stale Next.js and cache locks:

- `npm run clean`: stops Node processes, removes `.next`, and removes `node_modules/.cache` when present
- `npm run clean:reinstall`: same cleanup plus removal of `node_modules` and `package-lock.json`
- `npm run reinstall`: full cleanup followed by a fresh `npm install`
- `npm run build`: runs cleanup first, then runs the real Next build
- `npm run dev`: runs cleanup first, then starts the dev server

Supporting scripts:

- Windows PowerShell: [`scripts/cleanup.ps1`](./scripts/cleanup.ps1)
- macOS/Linux shell: [`scripts/cleanup.sh`](./scripts/cleanup.sh)
- Cross-platform dispatcher used by `package.json`: [`scripts/manage-build.mjs`](./scripts/manage-build.mjs)

## Why Stale Locks Happen

- Next.js writes build state under `.next` and can leave lock state behind if a build is interrupted or a process exits uncleanly.
- Filesystems such as `exFAT` are more prone to problematic locking and link behavior on Windows than `NTFS`.
- Background `node` or `next` processes can keep files open even after a terminal window is closed.
- Cached bundler state in `.next` or `node_modules/.cache` can confuse subsequent builds after abrupt shutdowns.

## Best Practices

- Keep the project on an `NTFS` drive on Windows rather than `exFAT`.
- Avoid running multiple `next build` commands at the same time.
- Shut down dev servers cleanly instead of closing the terminal abruptly.
- Use `npm run clean` if a build appears stuck or reports another build is already running.
- Use `npm run reinstall` if cleanup alone is not enough and dependencies may be corrupted.
