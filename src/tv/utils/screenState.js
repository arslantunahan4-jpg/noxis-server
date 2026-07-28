const screenState = new Map();

export const readScreenState = (key) => screenState.get(key) || null;

export const writeScreenState = (key, value) => {
    screenState.set(key, value);
    return value;
};

export const isScreenStateFresh = (value, ttl = 5 * 60 * 1000) => (
    Boolean(value?.loadedAt) && Date.now() - value.loadedAt < ttl
);

export const mapWithConcurrency = async (items, limit, task) => {
    const queue = items.slice();
    const workerCount = Math.min(Math.max(limit, 1), queue.length);
    const workers = Array.from({ length: workerCount }, async () => {
        while (queue.length > 0) {
            const item = queue.shift();
            try {
                await task(item);
            } catch {
                // Individual rails fail independently; the page keeps usable content.
            }
        }
    });
    await Promise.all(workers);
};
