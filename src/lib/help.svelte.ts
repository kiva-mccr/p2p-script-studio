// The ? menu (SB-5, board 77) asks Feedback mode (AP-48) to start: Feedback.svelte watches `asked`.
// tour: what the tour's step shows (issue #202): 'menu' holds the ? menu open, 'feedback' shows Feedback mode in use.
export const feedback = $state<{ asked: number; tour: 'menu' | 'feedback' | null }>({ asked: 0, tour: null });

// See the example in the ? menu (issue #239, board 87): App.svelte watches `asked` and opens the example, and sets
// `open` while it is shown, which hides the item.
export const example = $state<{ asked: number; open: boolean }>({ asked: 0, open: false });
