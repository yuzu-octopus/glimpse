export function compareEngagement(
  a: { score: number; comments: number },
  b: { score: number; comments: number },
): number {
  return b.score + b.comments - (a.score + a.comments);
}
