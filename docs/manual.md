# Con-Timeline — Manual

## Summary

Con-Timeline is a React + Vite timeline scheduling app focused on multi-day event planning (currently configured for Dragon Con 2025 dates). It provides an interactive horizontal timeline with draggable/resizable events, JSON import/export, location management, and browser `localStorage` persistence. The project is structured to be migrated to a Supabase-backed, authenticated persistence model similar to the `International-Packing-Checklist` app.

## Quick start

- Install: `npm install`
- Dev: `npm run dev`
- Build: `npm run build`

## Project structure (key files)

- `package.json` — project scripts and deps.
- `src/main.tsx` — app entry.
- `src/App.tsx` — top-level component, mounts `Timeline`.
- `src/components/Timeline.tsx` — main UI: header, timeline grid, controls, modals.
- `src/components/*` — small components: `TimelineEvent`, `EventModal`, `LocationManager`, `EventManagementMenu`, `DragonConImporter`.
- `src/hooks/useEventPersistence.ts` — localStorage persistence for events (load/save/import/export).
- `src/hooks/useLocationPersistence.ts` — localStorage persistence for locations with defaults.
- `src/hooks/useDragAndResize.ts` — drag/resize logic and cascading position updates.
- `src/utils/timelineUtils.ts` — time/position calculations, helpers for rounding and cascading.
- `src/types/timeline.ts` — core `TimelineEvent` and `Location` types.

Additionally, the repo follows some conventions inspired by the `International-Packing-Checklist` project:

- `.github/` may contain long-running session handoff and project-specific instructions. See `/home/joshlamont/Code/packing-checklist/.github/project-specific.instructions.md` for an example of how Supabase-backed projects are documented.
- `.github/log/` is used in that project for ongoing work logs and checklists. If we adopt the same workflow, we can track multi-step tasks there.

## How it works — high level

- Timeline range: set by `startDate` and `endDate` in `Timeline.tsx` (currently hardcoded to Aug 27 — Sept 2, 2025).
- The timeline maps time to pixels using 240 px per hour. Vertical slots are arranged in 64px rows.
- Events are stored in state managed by `useEventPersistence` and kept in `localStorage` under the `timeline-events` key.
- Dragging/resizing is handled by `useDragAndResize`, which translates pointer deltas to 30-minute increments and to slot changes, then applies updates via `onEventUpdate` or batched updates for cascades.
- Import/export: users can export a JSON snapshot or import a file. Import replaces the events list with validated entries.

## How this maps to a Supabase-backed app (if migrated)

- Replace `useEventPersistence` with a mutation layer that treats local state as the UI engine and Supabase as the source-of-truth (similar to `usePackingList` from the packing-checklist project).
- Keep import/export snapshot format compatible with a server snapshot shape so users can migrate local data into their account on first sign-in.
- Implement Row-Level Security (RLS) policies in Supabase so `events` and `locations` are scoped to the authenticated `user.id`.

## Data persistence

- Local-only persistence: everything is kept in `localStorage` using JSON. Dates are stringified and rehydrated to `Date` objects on read.
- No user accounts or server sync in the current version.

## Known configuration and build notes

- Built with Vite + React (SWC React plugin). Use `npm run dev` to develop.
- Output for production is produced by `vite build`.

## Important constants and magic numbers

- 240 px per hour — used by `getTimePosition` and timeline layout.
- 64 px per vertical slot — used for vertical positioning and drag-to-slot mapping.
- Hardcoded `startDate` / `endDate` in `Timeline.tsx` and duplicated in `useDragAndResize` (`endDate`), which should be consolidated.

## Development workflow notes

- Follow the `.github/project-specific.instructions.md` pattern if we adopt a longer-lived Copilot-driven workflow: create per-chunk checklists in `.github/log/` and append action logs there.
- Keep secrets out of the repo. Use Vercel environment variables for `VITE_TIMELINE_SUPABASE_URL` and `VITE_TIMELINE_SUPABASE_ANON_KEY` (or the `VITE_SUPABASE_*` aliases for client exposure).


## Extensibility points

- Replace `useEventPersistence` and `useLocationPersistence` with a server-backed persistence (Supabase, Firebase, or custom API) to enable multi-device sync and per-user data.
- Add authentication and a backend DB to support shared lists and deployments (see docs/plans/upgrade-to-auth.md).
- Make the timeline range, slot sizes, and timezone configurable.

Recent changes

- Multiple timelines: `useTimelinePersistence` and `TimelineSelector` added to create, rename, delete, and switch timelines; events are namespaced in `localStorage` by timeline id.
- Centralized constants: `src/config/timeline.ts` added for pixel/slot and default date values.
- ID stability: event and location IDs now use `crypto.randomUUID()` when available.
- Import behavior: import now validates input and merges by default (option to replace).
- Auth scaffolding: `src/lib/supabase.ts` and `src/components/AuthGate.tsx` were added to integrate Supabase auth (uses `VITE_TIMELINE_SUPABASE_URL` and `VITE_TIMELINE_SUPABASE_ANON_KEY`, with `VITE_SUPABASE_*` aliases supported).
- Tests: initial `vitest` test and scripts added; starter tests for `timelineUtils` were added.

## TODOs (taken from README and code comments)

- Add date shift/reset feature.
- Lock or translate all times to DragonCon timezone (EST) or provide timezone option.
- Support saving named datasets and switching between conventions (other cons).

## Where to look in code for common tasks

- Add server persistence: `src/hooks/useEventPersistence.ts` and `src/hooks/useLocationPersistence.ts`.
- Change timeline range: `src/components/Timeline.tsx` — `startDate` and `endDate`.
- Add tests: see `docs/plans/unit-testing.md`.

---

If you want, I can expand any section into more detail, include class/props diagrams, or generate a developer onboarding checklist.
