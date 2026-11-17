# CRICBETUL RPL Season 5 — Ready-to-Deploy Guide

This repository contains the RPL Season 5 cricket tournament website and auction system. It is **not** the separate CRICBETUL bulk messaging product.

## Netlify project setup

A root-level `netlify.toml` now points Netlify to the application folder automatically:

- Base directory: `CRICBETUL_RPL5_NETLIFY`
- Build command: `npm run build`
- Publish directory: `public`
- Functions directory: `netlify/functions`
- Node: `22.13.0`

Import the GitHub repository `Rahul5649/cricbetul-rpl-season5` into Netlify. If Netlify asks for manual settings, use the exact values above. The root configuration should be retained.

## Database

This project uses Netlify Database (managed PostgreSQL) and Netlify Blobs. Netlify Database is available on credit-based plans and database compute/bandwidth use can consume credits. Confirm the feature is available in your Netlify account before collecting registrations or payments.

The SQL migration is at:
`CRICBETUL_RPL5_NETLIFY/netlify/database/migrations/0001_create_rpl_state.sql`

Netlify applies committed migrations as part of deploy. Do not manually delete or reset a production database to troubleshoot a deployment.

## Organizer secret

After creating the Netlify site, add an Environment Variable:

- Key: `RPL_ADMIN_TOKEN`
- Value: generate a unique random value at least 32 characters long (64 hex characters recommended)
- Scope: Functions / Runtime

On a Mac terminal, generate a value with:

```bash
openssl rand -hex 32
```

Do not paste this token into GitHub, source files, chat, screenshots, or the public site. Add it only in Netlify's environment-variable settings, then trigger a new deploy so the Function runtime receives it.

## First deployment validation

After deploy, open these paths on the Netlify domain:

1. `/` — public tournament website
2. `/setup-check.html` — database and organizer configuration
3. `/admin.html` — organizer control room
4. `/auction.html` — auction navigation
5. `/display.html` — LED display
6. `/overlay.html` — OBS browser overlay

Before going public, complete all of these checks with test records:

- Setup page reports database connected and organizer configured.
- Register a test player and verify it appears in Admin.
- Approve the player and confirm public listing only shows approved players.
- Register and approve a test team.
- Submit a test UTR; it must remain pending until verified by the organizer against the receiving bank/UPI account.
- Upload a test player photo and team logo; confirm they render from another device.
- Run a test auction: nominate, bid, timer, sold/unsold, purse and squad limit.
- Confirm LED and OBS pages update from a separate device/browser.
- Export an admin backup and CSV files.
- Remove test records before opening registration to the public.

## Important limits before public launch

The existing app is a working tournament foundation, not a finished multi-tenant SaaS product. It currently has one shared Organizer Token, no independent Super Admin/Admin/Reseller/Customer identities, no UPI gateway or automatic bank reconciliation, and no complete admin audit log. Public registration and image upload endpoints also need rate-limit/anti-abuse protection before being exposed to large-scale traffic. Whole-state admin saves can conflict when two operators edit the same record concurrently; use one auction operator until versioned writes are implemented.

The existing smoke test checks expected files and JavaScript syntax; it is not a full end-to-end test. The added GitHub Actions workflow runs that smoke test on pushes and pull requests. A successful CI run does not replace the live deployment checks listed above.

## Payment account caution

The QR asset in the project identifies a beneficiary different from the tournament organizer. Obtain written authorization from the actual account holder and confirm the exact beneficiary/UPI ID before collecting any public payment. Payment verification in this version is manual.

## Rollback

This change is provided on the `ready-to-deploy` branch and should be reviewed through its pull request. The existing `main` branch is not replaced. If the new deployment configuration causes a problem, disconnect the deploy or return the Netlify site to the prior deploy; do not delete the database.
