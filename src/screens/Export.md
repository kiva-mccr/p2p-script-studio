# `src/screens/Export.svelte`

The export screen (EX-9, board 27): opened from an item under Export in Export / Share, in place of the script.
Formats on the left (Print / PDF, Fountain, Final Draft, Voice-over, Resolve / Premiere, Video), the real result in the middle, settings and
Print… or Save on the right. Back to the script, the title in the breadcrumb, or Esc returns.

- **Used by:** `screens/Editor.svelte` (`openExport`, which saves what is waiting and works out the version first).
  **Tests:** `tests/e2e/export.spec.ts`, `print.spec.ts`, `editor.spec.ts`, `voice.spec.ts`, `editexport.spec.ts`.
  Voice-over's preview is `VoicePreview.svelte`.

## Rules and pitfalls

- The preview is drawn from the same code as the file: Print is `Print.svelte` with `onScreen`, Fountain shows the
  text `toFountain` gives, voice-over plays the WAV that Save writes. Only the "screenplay look" (`look` snippet)
  is drawn here, roughly as the apps show it, and must follow `lib/fountain.ts` and `lib/fdx.ts` when they change.
- Settings are remembered with `keep`/`recall`: Print keeps its keys from before (`print-notes`, `print-lines`,
  `print-line-count` (EX-15, 2 to 8, kept while the lines are off), `print-scale`, `print-hide` for EX-16's hidden columns, in the order they were unticked, and `print-page`, "landscape" or empty (EX-18)); the others are JSON (`export-fountain`, `export-fdx`, `export-voice`), merged over the defaults so a
  setting added later gets its default. Defaults are what the exports did before EX-9.
- Final Draft's one checkbox, "Row numbers and files", sets both `numbers` and `files` (board 27 drew one).
- Voice-over takes are decoded once, the first time the format is picked; the settings only line them up again
  (`lineUp`, `wavFile`), so ticking a box doesn't decode again. The file is made a slice at a time (PF-6); Save
  stays greyed until it's ready, and a newer setting drops a file still being made. Silence for a row lasts its read time at the speaking
  speed (Settings). A row in the list plays the file from where that row starts.
- Voice-over saves an .mp3 by default (#237, `voiceHow.mp3`, kept in `export-voice`; an older saved setting without it
  gets .mp3). The .mp3 is encoded in a worker from the same clips (`mp3File`) while the preview plays the WAV; Save
  says "Making the .mp3…" until it's ready. The caption gives the file's size once made.
- Esc goes back, but not from a text field (the speaker name).
- Printing still goes through the Editor (`onPrint`): it mounts the real `Print.svelte` at the top level, which
  the print CSS needs. The preview's own Print sits inside this screen, hidden when printing.
- Print's preview is one Letter page in CSS px (816 × 1056, turned for landscape) with Print's margins as padding
  (53, 45 and 60 px: the 725 / 965 px the rows print at), shrunk with `zoom` to fit the box's width and 75% of the
  window's height, never under 60% so the words stay readable. Change both if Print's margins change. The page keeps
  the paper's shape: Notes lines take room at its foot and the rows scroll above them (issue #356).
- Fountain's two previews (the file and the look) share one height cap, so both are `box-sizing: border-box`; without
  it the file's padding and border made it 34 px taller (issue #236).
- Under Print… a help line says to pick "Microsoft Print to PDF" if words can't be selected in the PDF (issue #266:
  Adobe PDF's printer, with some settings, makes a PDF of pictures of text).
- Messages (no takes, takes that can't be read) are shown in the preview, not as the Editor's toasts.
- The Credits switch (AP-31) is one setting for Print, Fountain and Final Draft (`printing.credits`, kept as
  `export-credits`), shown only when the script has credits.
- Frame size and Frames per second for Resolve / Premiere and Video are `FrameChoices.svelte` (#217), bound to
  `edit` and `video`; Save stays greyed while a Custom box isn't a size or rate (`editReady`, `videoReady`).
- Resolve / Premiere (EX-19): the takes are read once (`readTakes`) for their lengths, the plan is redrawn as the
  settings change, and the media are only made on Save .zip (`editZip`). Its preview is `EditPreview.svelte`.
  Settings are kept as `export-edit`. Files that couldn't be read are named under the preview after saving.
- Video (SB-3): the same plan as Resolve / Premiere (collages as one picture, no markers), laid out again with rows
  with no take at 0 s when they're left out. Its shape is the script's (`shapeOf`), its other settings are kept as
  `export-video`. Save video makes it (`makeVideo`), downloads it, and hands it to the preview to play; Stop asks
  `makeVideo` to cancel between frames. Its preview is `VideoPreview.svelte`.
  Its cards list what their row still has to find (#227, `video.find`, on by default) from `missing`, the Editor's
  check of the folder (`lostFiles`), so a file is listed as missing only once that check has run.
- Fountain and Final Draft's card (#221): with more than one voice, "Speaker name" reads "Narrator's name" (rows with
  no speaker) and a list gives each speaker's rows and read time (`cast`), the narrator first.
