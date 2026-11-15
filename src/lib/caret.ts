// Where a place in a text box's text is drawn (UX-7): a hidden copy of the box with the same width, font and
// wrapping, and a mark at that place. Top and left are from the box's own top left, as it is scrolled now.
const COPIED = ['boxSizing', 'width', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderTopWidth', 'borderRightWidth',
  'borderBottomWidth', 'borderLeftWidth', 'borderStyle', 'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'fontVariant', 'letterSpacing',
  'lineHeight', 'textTransform', 'wordSpacing', 'tabSize', 'textIndent', 'overflowWrap', 'wordBreak'] as const;

export function caretAt(box: HTMLTextAreaElement, at: number): { top: number; left: number; height: number } {
  const css = getComputedStyle(box);
  const copy = document.createElement('div');
  for (const name of COPIED) copy.style[name] = css[name];
  Object.assign(copy.style, { position: 'absolute', visibility: 'hidden', top: '0', left: '-9999px', whiteSpace: 'pre-wrap' });
  copy.textContent = box.value.slice(0, at);
  const mark = document.createElement('span');
  mark.textContent = box.value.slice(at) || '​';
  copy.append(mark);
  document.body.append(copy);
  const place = { top: mark.offsetTop - box.scrollTop, left: mark.offsetLeft - box.scrollLeft, height: parseFloat(css.lineHeight) || mark.offsetHeight };
  copy.remove();
  return place;
}
