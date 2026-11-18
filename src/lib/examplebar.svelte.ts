// The example's bar (issue #203): its height while it shows, 0 otherwise. It stays at the top of the window, so the
// script's top bar sticks under it and counts it in --bar-h (Header.svelte).
export const exampleBar = $state({ height: 0 });
