<script lang="ts">
  // The sealed app (SE-10) opens no website: a click on a link to one (a script's link, a file's link) copies the
  // address instead, with a note, so it can be pasted into a browser on purpose. Mounted by App in the sealed app only.
  let note = $state('');
  let timer: ReturnType<typeof setTimeout> | undefined;

  function onClick(e: MouseEvent) {
    const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
    const to = a && new URL(a.href, location.href);
    // The app's own links (#/a script) stay in the page, wherever the file is opened from.
    if (!to || !/^https?:$/.test(to.protocol) || (to.origin === location.origin && to.pathname === location.pathname)) return;
    e.preventDefault();
    navigator.clipboard.writeText(a.href).then(
      () => (note = `Link copied: ${a.href}. The sealed app doesn't open websites; paste it into a browser if you want it.`),
      () => (note = `The sealed app doesn't open websites. The link is ${a.href}`),
    );
    clearTimeout(timer);
    timer = setTimeout(() => (note = ''), 6000);
  }
</script>

<svelte:document onclickcapture={onClick} onauxclickcapture={onClick} />

{#if note}<p class="note" role="status">{note}</p>{/if}

<style>
  .note { position: fixed; z-index: 30; left: 50%; bottom: 24px; transform: translateX(-50%); width: min(640px, calc(100% - 32px));
    box-sizing: border-box; margin: 0; padding: 10px 16px; border: 1px solid var(--line); border-radius: 10px; background: var(--ground);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08); font-size: 14px; line-height: 1.5; overflow-wrap: anywhere; }
</style>
