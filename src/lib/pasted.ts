// The name of a picture pasted into a row (#304): "pasted 2026-11-18 21-14.png", local time. The extension comes
// from the picture's type (a screen grab is image/png), else from its own name.
const EXT: Record<string, string> = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif', 'image/webp': '.webp',
  'image/bmp': '.bmp', 'image/svg+xml': '.svg', 'image/tiff': '.tif' };

export function pastedName(file: { name: string; type: string }, at: Date): string {
  const dot = file.name.lastIndexOf('.');
  const ext = EXT[file.type] ?? (dot > 0 ? file.name.slice(dot).toLowerCase() : '.png');
  const two = (n: number) => String(n).padStart(2, '0');
  return `pasted ${at.getFullYear()}-${two(at.getMonth() + 1)}-${two(at.getDate())} ${two(at.getHours())}-${two(at.getMinutes())}${ext}`;
}
