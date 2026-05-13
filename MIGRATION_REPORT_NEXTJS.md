# Next.js Frontend Migration Report

## Scope
- Migrated frontend from Vite React to Next.js App Router under `frontend-nextjs/`.
- Preserved backend (`backend/`) unchanged.
- Added `shared/` root folder per target architecture.

## Route Mapping
- `/` -> `app/[[...slug]]/page.tsx` (client-rendered route switch)
- `/login` -> `app/[[...slug]]/page.tsx`
- `/seller/register` -> `app/[[...slug]]/page.tsx`
- `/buyer/register` -> `app/[[...slug]]/page.tsx`
- `/admin/register` -> `app/[[...slug]]/page.tsx`
- `/dashboard` -> `app/[[...slug]]/page.tsx`
- `/seller/onboarding` -> `app/[[...slug]]/page.tsx`
- `/seller/tenders` -> `app/[[...slug]]/page.tsx`
- `/seller/tenders/:id/bid` -> `app/[[...slug]]/page.tsx`
- `/seller/settings` -> `app/[[...slug]]/page.tsx`
- `/buyer/onboarding` -> `app/[[...slug]]/page.tsx`
- `/buyer/profile` -> `app/[[...slug]]/page.tsx`
- `/buyer/tenders` -> `app/[[...slug]]/page.tsx`
- `/buyer/vendors` -> `app/[[...slug]]/page.tsx`
- `/buyer/orders` -> `app/[[...slug]]/page.tsx`
- `/buyer/tracking` -> `app/[[...slug]]/page.tsx`
- `/quotations` -> `app/[[...slug]]/page.tsx`
- `/profile` -> `app/[[...slug]]/page.tsx`
- `/admin/onboarding` -> `app/[[...slug]]/page.tsx`
- `/admin/procurement` -> `app/[[...slug]]/page.tsx`
- `/admin/compliance` -> `app/[[...slug]]/page.tsx`
- `/admin/reports` -> `app/[[...slug]]/page.tsx`

## Auth and Middleware
- Added Next middleware in `frontend-nextjs/middleware.ts` for protected path guard based on token cookie.
- Auth provider now syncs JWT to cookie for middleware compatibility while preserving localStorage behavior.

## Env Migration
- `VITE_API_URL` replaced with `NEXT_PUBLIC_API_URL` in frontend API utility.
- Added `frontend-nextjs/.env.example`.

## Deployment
1. `npm install`
2. `npm run dev --workspace=frontend-nextjs`
3. `npm run dev --workspace=backend`
4. `npm run build --workspace=frontend-nextjs`
5. `npm run start --workspace=frontend-nextjs`

## Notes
- Existing backend Express + Prisma business logic remains intact.
- UI classes/components reused from existing frontend source tree.
