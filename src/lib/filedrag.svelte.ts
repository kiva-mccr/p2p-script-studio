// Files dragged in from Explorer (#262, board 81): `fileDrag.on` is true while files are over the page, so every row's
// Images & files shows a dashed outline; the one under the pointer turns solid (FilesCell.svelte). Anywhere else, the
// drop is refused, so a stray drop never opens the file in place of the app.
export const fileDrag = $state({ on: false });

let timer = 0;

// dragover fires every few dozen milliseconds while files are over the page, even when the pointer is still; when it
// stops (the drag left the window or was cancelled), the outlines go.
function over(e: DragEvent) {
  if (!e.dataTransfer?.types.includes('Files')) return;
  fileDrag.on = true;
  clearTimeout(timer);
  timer = window.setTimeout(() => (fileDrag.on = false), 250);
  if (!e.defaultPrevented) {
    e.preventDefault(); // a drop target took it already (a row, a comment's files); elsewhere, refuse it
    e.dataTransfer.dropEffect = 'none';
  }
}

function done() {
  clearTimeout(timer);
  fileDrag.on = false;
}

if (typeof window !== 'undefined') {
  window.addEventListener('dragover', over);
  window.addEventListener('drop', done);
  window.addEventListener('dragend', done);
}
