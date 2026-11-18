# `src/lib/feedback.ts`

Feedback mode (AP-48, board 71): what the clicked part is (`describe`: its name, the `.svelte` file from `data-c`,
the nearest `data-tour`, a selector, the row and column, the screen) and the GitHub issue that carries it
(`issueTitle`, `issueBody`, `issueUrl`, `plainText`). `coverWords` covers the script's words and people's names in the
picture's copy of the page with solid grey boxes. Built so the issue can be acted on straight away (the user's ask): always the same shape, `feedback` label.

- **Used by:** `screens/Feedback.svelte`, `lib/feedbackshot.ts`. **Tests:** `tests/unit/feedback.test.ts`,
  `tests/e2e/feedback.spec.ts`.

## Rules and pitfalls

- The repo is public: nothing from the script goes in unless the person ticks Say which script (then the script's
  folder name and the page's address). A part's name comes from its label (aria-label, title, a button's own words),
  never a text box's contents; a name that looks like a file or path ("leaf.jpg", "../x") becomes "(a file)".
- A click on an icon's drawing means the button it's in (`partOf`).
- A menu item (`role="menuitem"`) or option is named by its own words, like a button (AP-49); before, a link in a
  menu was only "link".
- The selector starts from the nearest id, row (`data-row`) or a `data-tour` used only once: `data-tour="row"` is on
  every row, so it found the wrong one.
- The row number is read from a label inside the row ("Dialogue, row 3"), since `data-block` counts sections too.
- Svelte drops a space just before `{/if}`: "Sam ·just now" in the list. A space next to a block goes in `{' · '}`.
- `coverWords` runs on modern-screenshot's copy, whose elements may belong to another document: no `instanceof`.
- Never a blur (the user, 2026-11-16: it can be undone): opaque grey boxes, and the text under them is swapped for
  x's, so it is not in the copy at all. The copy carries every element's styles inline, so the box's styles need
  `!important` (without it the words showed through). A text box is swapped for a div of the same look.
- A control's own words (button, label, tab…) are the app's and are never covered, in rows too (issue #257: Cover hid
  "Clear", "Choose a file…", "From other scripts…"). So the script's words or a name inside a control go in a
  `data-hide` span: a file's chip (FilesCell, Attached), an asset's label (Assets), Export's title and rows, a
  template's name (List), the folder's name (Setup), Presence's buttons, Review's folded note. A new control that
  shows the script's words or a name must mark them.
- The app's own words outside controls ("In review", "Saved", the list's statuses, Changed / New on a row,
  "commented · row 4" on a card) get `data-keep`; a name inside a `data-keep` part (the Changed mark's who) still
  needs `data-hide`. Row numbers are the app's too (the user: not identifying).
- A box on one line that cuts off (a file's chip, `white-space: nowrap`) is an inline-block cut to fit, or its
  rounded end was sliced square (x's are wider than most letters).
- Pictures are the script's too (the user): every img, video, canvas and iframe becomes a grey box of its size,
  unless inside `data-keep`. The app's icons are inline SVG, so they stay.
- `onScrollbar` measures the bar from the box's sizes: an SVG drawing has a clientWidth of 0, so without checking that
  a bar is there at all every click on an icon counted as a scroll bar. An inline span has a clientWidth of 0 too
  (a file's name in its chip picked the span, not the button), so only a box whose overflow scrolls is measured.
  Overlay bars (no width) aren't caught.
- The note is cut at 2,000 characters so the link stays well under GitHub's length limit.
- The `feedback` label in the link is only applied for people who may label issues; others' issues come unlabelled.
