// Several folder reads at once (PF-10): a network drive answers each call slowly but answers several calls about as
// fast as one, so files read one after another spend most of their time waiting.

export const AT_ONCE = 8;

// `work` for every item, at most `limit` running at a time; the results in the items' order. Stops starting new work
// once one fails, and fails with it (callers catch per item when one bad file shouldn't stop the rest).
export async function eachAtOnce<T, R>(items: readonly T[], work: (item: T, index: number) => Promise<R>, limit = AT_ONCE): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  let failed = false;
  const worker = async () => {
    while (!failed && next < items.length) {
      const i = next++;
      try {
        results[i] = await work(items[i], i);
      } catch (error) {
        failed = true;
        throw error;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
