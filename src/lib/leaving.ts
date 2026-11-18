// A script screen that closes still saves for a moment after (`leave()`, then "… was here"). The example's Start over
// and its Undo swap the whole folder, so they wait for that first: a screen closed by the swap wrote its own text into
// the folder just put back, and Undo lost the edits (a flaky example.spec test).

const pending = new Set<Promise<unknown>>();

// The Editor hands over what it still writes as it closes.
export function closing(work: Promise<unknown>): void {
  const done = work.catch(() => {}).finally(() => pending.delete(done));
  pending.add(done);
}

// Resolves once every closed screen has finished writing.
export async function closed(): Promise<void> {
  while (pending.size) await Promise.all(pending);
}
