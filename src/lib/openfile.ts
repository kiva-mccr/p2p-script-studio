// Opening a file from the script's folder (SE-3). A blob: page has the app's own address, so a file that is a page
// (.html, .svg, .xml…) would run inside the app. Only kinds that can't run are opened in a tab, with their type
// named here rather than taken from the file; anything else downloads under its own name.

const SHOWN: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif',
  bmp: 'image/bmp', pdf: 'application/pdf', txt: 'text/plain;charset=utf-8', md: 'text/plain;charset=utf-8',
  csv: 'text/plain;charset=utf-8', mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', m4v: 'video/mp4',
  ogv: 'video/ogg', mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', ogg: 'audio/ogg', oga: 'audio/ogg',
  opus: 'audio/ogg', aac: 'audio/aac', flac: 'audio/flac',
};

/** The type a file is opened in a tab with, or null when it downloads instead. */
export function shownType(name: string): string | null {
  return SHOWN[/\.([a-z0-9]+)$/i.exec(name)?.[1].toLowerCase() ?? ''] ?? null;
}

export function openFile(file: Blob, name: string) {
  const type = shownType(name);
  const url = URL.createObjectURL(type ? new Blob([file], { type }) : file);
  if (type) window.open(url, '_blank', 'noopener');
  else Object.assign(document.createElement('a'), { href: url, download: name.split('/').at(-1) }).click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
