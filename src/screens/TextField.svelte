<script lang="ts">
  import { changed, clearMarks, continueList, renderMath, renumber, showLists, toggleList, toHtml, toggle, unlist, type List, type Mark } from '../lib/format';
  import { paragraphs } from '../lib/script';
  import { caretAt } from '../lib/caret';

  // A Write cell (mock-up 8): while typing you see the marks (**bold**); elsewhere they show as formatting. Selecting
  // text shows a toolbar; Ctrl+B, I, U and K work too.
  let {
    value = $bindable(),
    label,
    placeholder,
    oninput,
    onparagraphs,
    lists = false,
  }: {
    // `apart`: a change of formatting, its own step for Write's Ctrl+Z rather than part of the typing (lib/steps.ts).
    value: string; label: string; placeholder: string; oninput: (apart?: boolean) => void;
    // Bullet, number and tick box buttons always shown, and the marks shown as • ☐ ☑ (the planning panel, AP-24).
    // Enter, Backspace and renumbering work on lists in every field (AP-29).
    lists?: boolean;
    // Pasting two or more paragraphs hands them over, with the text before and after the selection (AP-13).
    onparagraphs?: (lines: string[], head: string, tail: string) => void;
  } = $props();

  let box = $state<HTMLTextAreaElement>();
  let apart = false; // a formatting button or key is putting its change in
  let focused = $state(false);
  let selecting = $state(false);
  const html = $derived(toHtml(lists ? showLists(value) : value));

  const TOOLS: { mark: Mark | 'clear'; text: string; name: string; keys?: string }[] = [
    { mark: 'bold', text: 'B', name: 'Bold', keys: 'Ctrl+B' },
    { mark: 'italic', text: 'I', name: 'Italic', keys: 'Ctrl+I' },
    { mark: 'underline', text: 'U', name: 'Underline', keys: 'Ctrl+U' },
    { mark: 'strike', text: 'S', name: 'Strikethrough' },
    { mark: 'link', text: 'Link', name: 'Link', keys: 'Ctrl+K' },
    { mark: 'equation', text: '∑ x', name: 'Equation (LaTeX)' },
    { mark: 'clear', text: 'Clear', name: 'Clear formatting' },
  ];
  const LISTS: { kind: List; text: string; name: string }[] = [
    { kind: 'bullet', text: '•', name: 'Bulleted list' },
    { kind: 'number', text: '1.', name: 'Numbered list' },
    { kind: 'tick', text: '☐', name: 'Tick box (again to tick it)' },
  ];
  const KEYS: Record<string, Mark> = { b: 'bold', i: 'italic', u: 'underline', k: 'link' };

  function math(node: HTMLElement, _html: string) {
    renderMath(node);
    return { update: () => renderMath(node) };
  }

  function look() {
    selecting = !!box && box.selectionStart !== box.selectionEnd;
    if (selecting) place();
  }

  // The toolbar sits just above the selected words, from where they start (UX-7, board 73); with no room above (under
  // the column names or the top bar) it goes just below them. It slides in to stay inside the window.
  let toolbar = $state<HTMLElement>();
  let at = $state({ x: 0, y: 0 });
  const GAP = 8;
  function place() {
    if (!box) return;
    const start = caretAt(box, box.selectionStart);
    const end = caretAt(box, box.selectionEnd);
    const rect = box.getBoundingClientRect();
    const high = (toolbar?.offsetHeight || 42) + GAP;
    const wide = toolbar?.offsetWidth || 300;
    const below = rect.top + start.top - high < ceiling(box);
    const y = below ? end.top + end.height + GAP : start.top - high;
    const x = Math.min(Math.max(start.left, 8 - rect.left), innerWidth - rect.left - wide - 8);
    at = { x, y };
  }
  // The lowest thing stuck to the top of the window over the box: Write's column names, else the top bar.
  function ceiling(el: HTMLElement): number {
    const head = el.closest('.table')?.querySelector<HTMLElement>(':scope > .head');
    if (head) return head.getBoundingClientRect().bottom;
    return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--bar-h')) || 0;
  }

  function apply(mark: Mark | 'clear' | List) {
    if (!box) return;
    const [start, end] = [box.selectionStart, box.selectionEnd];
    const next = mark === 'bullet' || mark === 'number' || mark === 'tick'
      ? toggleList(value, start, end, mark)
      : mark === 'clear'
      ? (() => {
          const cleared = clearMarks(value.slice(start, end));
          return { text: value.slice(0, start) + cleared + value.slice(end), start, end: start + cleared.length };
        })()
      : toggle(value, start, end, mark);
    box.focus();
    apart = true;
    put(next.text, next.start, next.end);
    apart = false;
    look();
  }

  // Puts in a new text through the browser's own typing, so Ctrl+Z undoes it. Only the stretch that differs is
  // typed over, so the box doesn't scroll and the browser keeps the rest.
  function put(text: string, start: number, end = start) {
    if (!box || text === value) return box?.setSelectionRange(start, end);
    const diff = changed(value, text);
    box.setSelectionRange(diff.start, diff.start + diff.old);
    const typed = diff.added ? document.execCommand('insertText', false, diff.added) : document.execCommand('delete');
    if (!typed) {
      value = text;
      oninput(apart);
    }
    box.setSelectionRange(start, end);
  }

  // After every change, numbered lists count again from their first line (AP-29). Not after Ctrl+Z or Ctrl+Y, or
  // undoing the renumbering would renumber again and Ctrl+Z could never go back past it.
  function input(e: Event) {
    if (box) value = box.value;
    oninput(apart);
    const kind = (e as InputEvent).inputType;
    if (!box || kind === 'historyUndo' || kind === 'historyRedo') return;
    const next = renumber(value);
    if (next === value) return;
    const at = box.selectionStart;
    const diff = changed(value, next);
    put(next, at <= diff.start ? at : at + diff.added.length - diff.old);
  }

  function paste(e: ClipboardEvent) {
    const lines = paragraphs(e.clipboardData?.getData('text/plain') ?? '');
    if (!onparagraphs || !box || lines.length < 2) return;
    e.preventDefault();
    onparagraphs(lines, value.slice(0, box.selectionStart), value.slice(box.selectionEnd));
  }

  function keydown(e: KeyboardEvent) {
    const plain = !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey;
    if (box && plain && (e.key === 'Enter' || e.key === 'Backspace') && box.selectionStart === box.selectionEnd) {
      const next = (e.key === 'Enter' ? continueList : unlist)(value, box.selectionStart);
      if (next) {
        e.preventDefault();
        put(next.text, next.at);
        return;
      }
    }
    const mark = (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey ? KEYS[e.key.toLowerCase()] : undefined;
    if (!mark) return;
    e.preventDefault();
    apply(mark);
  }
</script>

{#if lists}
  <div class="lists" role="toolbar" aria-label="Lists">
    {#each LISTS as tool (tool.kind)}
      <button class="tool" aria-label={tool.name} title={tool.name} onmousedown={(e) => e.preventDefault()} onclick={() => apply(tool.kind)}>{tool.text}</button>
    {/each}
  </div>
{/if}
<div class="field" class:focused class:empty={!value}>
  {#if focused && selecting}
    <div class="toolbar" role="toolbar" aria-label="Formatting" bind:this={toolbar} style:left="{at.x}px" style:top="{at.y}px"
      {@attach () => place()}>
      {#each TOOLS as tool (tool.mark)}
        <button class="tool {tool.mark}" aria-label={tool.name} title={tool.keys ? `${tool.name} (${tool.keys})` : tool.name}
          onmousedown={(e) => e.preventDefault()} onclick={() => apply(tool.mark)}>{tool.text}</button>
      {/each}
    </div>
  {/if}
  <textarea bind:this={box} bind:value aria-label={label} {placeholder} oninput={input} onkeydown={keydown} onpaste={paste}
    onfocus={() => (focused = true)} onblur={() => ((focused = false), (selecting = false))}
    onmouseup={look} onkeyup={look} onselect={look}></textarea>
  <div class="shown" aria-hidden="true" data-hide use:math={html}>{@html html}</div>
</div>

<style>
  .field { position: relative; display: grid; }
  textarea, .shown { grid-area: 1 / 1; min-width: 0; }
  textarea { width: 100%; box-sizing: border-box; margin: 0; padding: 0; border: 0; resize: none; field-sizing: content; min-height: 1.55em;
    font: inherit; line-height: 1.55; color: inherit; background: none; }
  textarea:focus { outline: none; background: #f7f9ff; box-shadow: 0 0 0 6px #f7f9ff; border-radius: 2px; }
  /* Not being typed in: the formatted text shows, over a see-through text box that still takes the click. */
  .shown { white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.55; pointer-events: none; }
  .field:not(.focused):not(.empty) textarea { opacity: 0; }
  .focused .shown, .empty .shown { visibility: hidden; }
  .shown :global(a) { color: var(--accent); }
  .shown :global(s) { color: #8a8a8a; }
  .toolbar { position: absolute; z-index: 3; display: flex; align-items: center; gap: 2px; padding: 4px;
    border: 1px solid var(--line); border-radius: 8px; background: #fff; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1); }
  .tool { min-width: 32px; height: 32px; padding: 0 8px; border: 0; border-radius: 6px; background: none; color: var(--ink); font-size: 14px; }
  .tool:hover { background: #f0f3fc; color: var(--accent); }
  .lists { display: flex; gap: 2px; margin: 0 0 10px -8px; }
  .lists .tool { color: var(--muted); }
  .bold { font-weight: 700; }
  .italic { font-style: italic; font-family: Georgia, serif; }
  .underline { text-decoration: underline; }
  .strike { text-decoration: line-through; }
  .link, .clear { font-size: 13px; }
  .equation { font-style: italic; font-family: Georgia, serif; }
  .clear { color: var(--muted); }
  .equation, .clear { margin-left: 6px; }
</style>
