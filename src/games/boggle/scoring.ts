/**
 * Calculate the score for a word based on official Boggle scoring:
 * - 3-4 letters: 1 point
 * - 5 letters: 2 points
 * - 6 letters: 3 points
 * - 7 letters: 5 points
 * - 8+ letters: 11 points
 */
export function calculateWordScore(word: string): number {
  const length = word.length;

  if (length < 3) return 0;
  if (length <= 4) return 1;
  if (length === 5) return 2;
  if (length === 6) return 3;
  if (length === 7) return 5;
  return 11;
}

/**
 * Calculate total score for a list of words.
 */
export function calculateTotalScore(words: string[]): number {
  return words.reduce((total, word) => total + calculateWordScore(word), 0);
}
