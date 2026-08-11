# Bugs & Issues Found

This file captures known issues and suspicious code patterns found during a quick repo review. It is not exhaustive — I recommend running the app and exercising interactive flows to surface runtime bugs.

1. Missing project README content
  - `README.md` is placeholder text. Add usage, deploy, and development instructions.

2. Hardcoded dates and duplicated constants
  - `startDate` / `endDate` are hardcoded in `src/components/Timeline.tsx` and a similar `endDate` is hardcoded in `src/hooks/useDragAndResize.ts`. This duplication can easily lead to inconsistent behavior. Move timeline bounds to a single source of truth.

3. Magic numbers (layout/time mapping)
  - The app uses `240` px/hour and `64` px/slot in multiple places. These should be centralized as constants/config to allow responsive tuning and avoid mismatch bugs.

4. Import behavior replaces instead of merges
  - `useEventPersistence.importEvents` loads validated events and calls `setEvents(validEvents)`, which replaces existing events. Users likely expect an option to merge or to confirm replace.

12. ID generation and collision risk
  - New events use `Date.now().toString()` for `id`. On very fast successive additions or if system clock adjustments occur, collisions are possible. Prefer UUIDs (`crypto.randomUUID()` or a UUID lib) for stronger uniqueness.

13. Inconsistent date handling and serialization assumptions
  - Several places assume `Date` objects on rehydration; import/export and `localStorage` read/write rely on JSON date strings and manual `new Date(...)` conversions. Edge cases with invalid date strings could produce `Invalid Date` objects without clear validation.

14. Tight coupling of UI constants and logic
  - `useDragAndResize` and `Timeline` both encode layout constants (240px/hour, 64px/slot). This coupling increases risk of layout/behavior mismatch if one file is changed.

15. Missing input validation and UX confirmations
  - Destructive actions like `clearAllEvents` are executed without confirmation in some menus (confirm UX may be desirable).

16. Accessibility and keyboard controls
  - No explicit keyboard handling for moving/resizing events; drag/resize is pointer-only which reduces accessibility.

17. `.github` workflow expectations
  - The packing-checklist project uses `.github/log/` and expects Copilot-driven edits there. If we adopt that, ensure we follow the same conventions and do not accidentally leave tracking files out of `.gitignore`.

Suggestions and fixes (prioritized)

- Use `crypto.randomUUID()` for new IDs to avoid collision risk.
- Centralize timeline constants into `src/config/timeline.ts` and import them in `Timeline.tsx` and `useDragAndResize.ts`.
- Add input validation for imported events: types, valid date ranges, non-overlap options, and user confirmation before replacing existing data.
- Add basic keyboard accessibility for event selection and nudging (arrow keys ±30 minutes, modifier for slot changes).
- Add a confirmation prompt for `clearAllEvents` and other destructive actions.


5. Local timezone handling
  - The app assumes local Date behavior. If users are in different timezones or import schedules with timezone offsets, times may shift. Consider normalizing to UTC or a configured timezone (DragonCon = America/New_York) and clearly storing timezone metadata.

6. Duplicate or inconsistent `endDate` in `useDragAndResize`
  - `endDate` there is set to a concrete date (Sept 2, 2025) and may desync from `Timeline` if `Timeline` is changed.

7. Potential UX issue: auto-scroll centering math
  - Auto-scroll centers the current time by setting `scrollLeft = hoursFromStart * 240 - 400`. This constant `400` may not correctly center on different viewport sizes and could scroll too far left (negative) or not center.

8. No server-side persistence / no multi-user support
  - Not a bug per se, but a functional limitation — all data is local to the browser.

9. Limited validation on import
  - Import validates presence of `id`, `title`, `startTime`, `endTime` but not types or time ordering; malformed dates may be silently accepted or produce errors later.

10. Performance/large-data concerns
  - The timeline renders every time slot as an absolutely positioned element. For very long ranges or huge numbers of time slots, rendering cost and DOM size could grow large.

11. Missing/unclear tests
  - There are no unit tests in the repo to verify hooks, utils, or drag/resize math.

Suggestions and fixes

- Centralize configuration: move magic numbers and date-range config to a single module (e.g. `src/config/timeline.ts`).
- Consolidate timeline bounds: pass `startDate`/`endDate` into `useDragAndResize` rather than having duplicated constants.
- Add import options: merge vs replace, and validate timestamps and overlaps.
- Add timezone-aware storage (ISO with timezone or store milliseconds + timezone identifier).
- Add unit tests for `timelineUtils`, hooks, and `useDragAndResize` math.

Status: actions taken

- IDs: event and location ID generation updated to use `crypto.randomUUID()` where available.
- Centralized constants: `src/config/timeline.ts` added and used by timeline components and utils.
- Import behavior: `useEventPersistence.importEvents` now validates input and merges by default (with a `replace` option).
- Timeline management: Added `useTimelinePersistence` and `TimelineSelector` to support multiple timelines and switching.

Remaining work

- Timezone normalization: still recommended to store timestamps with timezone awareness and normalize on import/export.
- Accessibility keyboard controls for dragging/resizing remain to be implemented.
- Full Supabase integration and RLS policies are planned under `docs/plans/upgrade-to-auth.md` and require Supabase project env vars.
