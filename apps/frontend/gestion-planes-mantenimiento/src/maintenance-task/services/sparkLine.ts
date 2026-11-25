export function sparkline(seed: string, count = 15) {
    let hash = 2166136261;
    for (let index = 0; index < seed.length; index += 1) {
        hash ^= seed.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    let state = hash >>> 0;
    const points = Array.from({ length: count }, (_, index) => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        const noise = state / 4294967295;
        const trend = (index / (count - 1)) * 6;
        const x = (index / (count - 1)) * 120;
        const y = 42 - (10 + noise * 22 + trend);
        return [x, y] as const;
    });
    const line = points
        .map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
        .join(" ");
    return { line, area: `${line} L 120,42 L 0,42 Z` };
}