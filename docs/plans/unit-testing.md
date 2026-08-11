# Unit testing plan

Goal: Add tests to validate core logic (time math, drag/resize cascading, persistence) and UI interactions.

Suggested test stack

- Unit tests: `vitest` + `@testing-library/react`
- Mocking network/DB: `msw`
- E2E: `cypress` (or Playwright) for interaction tests like dragging/resizing and import/export.

Concrete setup

- Install:
   - `npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom msw`
- Add `package.json` scripts:
   - `"test": "vitest"
   - `"test:watch": "vitest --watch"

Starter tests to add now

- `src/utils/timelineUtils.test.ts` — arithmetic tests for `getTimePosition`, `roundToNearestHalfHour`, and `cascadeEventPositions`.
- `src/hooks/useEventPersistence.test.ts` — test localStorage load/save and `importEvents` validation.

E2E guidance

- Use Playwright or Cypress to simulate pointer-based drag/resize only after unit tests cover the math. Mock storage or run against a dev server.

CI

- Add a GitHub Actions workflow or Vercel test step to run `npm test` on PRs.


Test list (high priority)

1. `timelineUtils` unit tests
   - `getTimePosition` / `roundToNearestHalfHour` arithmetic correctness for several edge times.
   - `cascadeEventPositions` behavior when events overlap — ensure predicted cascade updates match expected.

2. `useDragAndResize` tests
   - Start a drag and simulate `handleMouseMove` deltas: verify `onEventUpdate` calls with correct time/position and rounding.
   - Test resize-start and resize-end behaviors and enforcement of minimum duration (30 minutes).

3. `useEventPersistence` tests
   - Loading from `localStorage` with date strings converts to `Date` objects.
   - Saving writes proper JSON shape.
   - `importEvents` handles valid files and rejects invalid formats; test replace vs merge behavior (if implemented).

4. `useLocationPersistence` tests
   - Default locations are set when no storage present.
   - Add/update/delete functions behave as expected.

5. Component tests (RTL)
   - `Timeline` renders headers and slot grid for configured range.
   - Adding a new event via the `EventModal` updates state and results in a rendered `TimelineEvent`.
   - Event `onEdit` opens modal with populated data.

6. Integration / E2E tests
   - Import/export roundtrip: export triggers a download (mocked) and import with the same data restores events.
   - Drag and resize flows: simulate pointer events to move/resize an event and verify position/time updates persist.

7. Accessibility checks
   - Basic a11y smoke tests with `axe` for key screens.

Implementation notes

- Start by adding `vitest` and a `test` script in `package.json`.
- Isolate logic-heavy functions (`timelineUtils`) and write tests first (fast feedback loop).
- For drag/resize, prefer testing the math in unit tests and use a small number of E2E tests to verify browser behavior.
