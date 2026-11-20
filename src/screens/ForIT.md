# `src/screens/ForIT.svelte`

For IT (SE-8, board 93): ? › For IT (`#for-it`, App.svelte), on the website and in the sealed file. Shows
`lib/forit.ts`: a contents list on the left that stays pinned as the page scrolls, lights the section being read and
jumps to a section when clicked; the data-flow drawing (inline SVG, one for each); Print or save as PDF.

- **Used by:** `App.svelte`. **Tests:** `tests/e2e/forit.spec.ts`, a step in `tests/e2e/cover.spec.ts`.

## Rules and pitfalls

- The window scrolls, not a box: `nav` is `position: sticky`, so the header scrolls away and the contents stay.
- A click's smooth scroll passes other sections: for 0.8 s the scroll handler leaves the clicked entry lit.
- At the bottom of the page the last section is lit, even if its heading can't reach the top.
- The drawings' boxes are drawn after the arrows that touch them, white-filled: an arrowhead under a box vanishes
  (the website's arrow did, first time round).
- In the sealed file its links are copied rather than opened (`SealedLinks.svelte`), like every other link there.
- Printing hides the header and the contents list.
- Tables lay out by their headings: two columns, three with a narrow last one, or the ASVS table (a `Status` second
  heading) with a narrow middle one. The first live version gave Status the wide column.
