/** Distance from the article start until the end of the post's body enters the viewport. */
function readingDistance(start: number, end: number, viewport: number) {
  return Math.max(1, end - start - viewport)
}

/** Progress stops at the end of the body, before FAQ, references and post actions. */
export function readFraction(start: number, end: number, viewport: number, scroll: number) {
  return Math.min(1, Math.max(0, (scroll - start) / readingDistance(start, end, viewport)))
}

/** Inverse of readFraction so resuming uses the same reading boundary. */
export function scrollForFraction(start: number, end: number, viewport: number, fraction: number) {
  return start + readingDistance(start, end, viewport) * Math.min(1, Math.max(0, fraction))
}
