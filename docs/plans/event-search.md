# Event Search

## Goal

Add search for events in the active timeline, with compact entry points on desktop and mobile and view-aware navigation from each result.

## Search behavior

- Search only events in the active timeline.
- Match case-insensitive substrings after trimming the submitted query.
- Do not run a search for an empty query.
- Search all active-timeline events, including intangible events and events hidden by the current priority color filter.
- Search is submit-driven. Changing the query or filters does not replace the displayed results until Search is submitted again.
- Clear the query and results when the active timeline changes.
- Keep the submitted query, filters, and sorting while the pane remains open.

## Entry points

### Desktop

- Place a compact search field immediately to the left of the timeline selector.
- Pressing Enter opens the search pane and runs a complete search for the submitted term.
- The header field has no separate search button.

### Mobile

- Keep the toolbar on one line.
- Order the trailing controls as import/export, calendar mode, search, and account.
- Add a fixed-size magnifying-glass button that opens the search pane before any search is run.
- Let the timeline selector consume the remaining width so adding the search button reduces it by exactly one button and one gap.

## Search pane

- Use a right-side drawer on desktop and a full-screen sheet on mobile.
- Include a close button and sticky search controls above a scrolling result list.
- The first row contains a search field and Search button.
- Provide Title, Description, and Location checkboxes. All are enabled initially.
- One, two, or three fields may be selected, but never zero. Disable the final selected checkbox until another field is selected.
- On mobile, filters occupy the row below the search field and button.
- Put two fixed-size sort controls beside the filters where space permits and on their own aligned row when needed.
- The direction control toggles ascending and descending using arrow icons.
- The field control cycles through:
  1. Title, shown as a serif `T`.
  2. Start time, shown with a clock.
  3. Location, shown with a map pin.
  4. Duration, shown with an hourglass.
- Tooltips and accessible labels identify the current sort and the action each button performs.
- Show a result count after a search, a prompt before the first search, and a useful no-results message.
- Render results in one column with title, date/time, duration, location, and a description excerpt when available.

## Sorting

- Title and location sorting are case-insensitive and locale-aware.
- Blank locations sort after named locations in either direction.
- Start-time sorting is chronological.
- Duration sorting uses `endTime - startTime`.
- Resolve equal primary values by start time and then title for stable ordering.

## Selecting a result

- Close the search pane first.
- In timeline view, horizontally center the event start time and briefly highlight the selected event.
- In a mobile day-column view, switch to the event's day, vertically center its rendered card, and briefly highlight it.
- If the event is hidden by the priority color filter, switch to daily-columns view so it can be displayed.
- In a desktop day-column view, open the existing edit modal for that event.

## Implementation outline

1. Add pure search and sorting utilities with focused unit tests.
2. Add a responsive `EventSearchPane` component.
3. Add desktop and mobile entry points to `Timeline` and reorganize the mobile toolbar.
4. Add stable event DOM identifiers and selected-result highlighting to timeline and day-column event renderers.
5. Implement view-aware centering after the destination view has rendered.
6. Run unit tests, TypeScript build, lint, and responsive browser verification.

## Acceptance checks

- Enter in the desktop header performs search and opens populated results.
- The mobile search button opens an unsearched pane with the input focused.
- The last enabled filter cannot be unchecked.
- Both sort controls update existing results without requiring another search.
- Selecting a result follows the correct behavior in all three view/device combinations.
- Header controls fit without overlap at desktop and narrow mobile widths.
- Search controls and result text remain readable without horizontal overflow.