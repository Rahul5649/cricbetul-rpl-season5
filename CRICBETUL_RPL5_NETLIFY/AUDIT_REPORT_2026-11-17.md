# CRICBETUL RPL Season 5 — Source Audit
Date: 2026-11-17
Audited branch: main
Audited commit: 926cb3e8095b3b4839d5d109663678f31448ce9e

## Project identity
This repository is an RPL Season 5 cricket tournament registration and auction website, not a bulk messaging platform.

## Verified repository structure
- public/index.html — public tournament portal and organizer UI
- public/admin.html — redirect into organizer control room
- public/auction.html — auction launchpad
- public/display.html — LED display
- public/overlay.html — OBS overlay
- public/setup-check.html — backend/database status page
- netlify/functions/api.mjs — registration, payment UTR, admin state API
- netlify/functions/media.mjs — Netlify Blobs media retrieval
- netlify/database/migrations/0001_create_rpl_state.sql — initial JSONB state row
- scripts/smoke-test.mjs — file presence and JavaScript syntax checks
- netlify.toml — Netlify build/publish/functions configuration

## Configuration found
- Node.js >=22.13.0
- Build: npm run build
- Publish: public
- Functions: netlify/functions
- Dependencies: @netlify/blobs 11.0.3, @netlify/database 2.0.3
- One migration creates a single rpl_state JSONB row.

## Implemented in source
- Player registration with RPL5 registration ID
- Team registration
- Payment UTR submission and pending state
- Public state filtering to approved players/teams
- Organizer access using RPL_ADMIN_TOKEN
- Admin approval/rejection, payment review, settings, exports and backup
- Auction nomination, bidding, sold/unsold, purse and squad limit controls
- LED and OBS display pages
- Image uploads to Netlify Blobs
- PostgreSQL transaction with SELECT FOR UPDATE for registration/admin state mutations

## Risks and gaps identified
1. Single shared organizer token; no true Super Admin/Admin/Reseller/Customer identity and RBAC model.
2. Admin sends whole-state snapshots. Server merges incoming item lists by ID but incoming versions win; simultaneous edits can overwrite an item.
3. Client persist() does not await admin-save completion; UI can show local state before cloud persistence is confirmed.
4. Public player/team/payment and image-upload actions have no visible rate limiting, abuse throttling, CAPTCHA or idempotency mechanism.
5. Image upload endpoint is public; storage quota/abuse controls are needed.
6. Payment UTR is manually submitted and verified; no gateway, bank reconciliation or automatic confirmation.
7. No visible audit trail for admin decisions, payment approvals, bids or settings changes.
8. One JSONB document stores all players, teams, payments and auction state; acceptable for a modest event but not ideal for concurrent/high-volume workflows.
9. Local preview uses localStorage; it does not exercise Netlify Functions or PostgreSQL.
10. The smoke test validates required files, syntax and basic migration/API markers, not end-to-end browser or deployed API behavior.
11. No GitHub Actions workflow runs were found during this audit.

## Deployment
The repository root contains the application under CRICBETUL_RPL5_NETLIFY. Netlify Base directory must be set to that folder unless the project is moved to repository root. Current netlify.toml specifies build command npm run build, publish public, functions netlify/functions, Node 22.13.0.

## Production acceptance checks still required
- Netlify deploy succeeds and migration is applied
- /setup-check.html reports database connected and organizer configured
- player registration from one device appears in admin from another
- team registration and approval
- image upload and retrieval
- payment UTR pending/verified/rejected flow
- two simultaneous admin edits do not lose data
- auction nomination, bid, timer, sold/unsold, purse and squad limits
- LED/OBS sync from a second browser/device
- admin token never appears in public HTML, logs or repository
- backups can be exported and restored via a controlled process

## Important scope distinction
This repository is for RPL tournament operations. It is not the separate CRICBETUL Messaging Pro SaaS application.
