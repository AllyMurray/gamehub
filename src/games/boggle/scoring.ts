/**
 * Calculate the score for a word based on length:
 * - 3 letters: 1 point
 * - 4 letters: 2 points
 * - 5 letters: 3 points
 * - etc. (length - 2)
 */
export function calculateWordScore(word: string): number {
  const length = word.length;

  if (length < 3) return 0;
  return length - 2;
}

/**
 * Calculate total score for a list of words.
 */
export function calculateTotalScore(words: string[]): number {
  return words.reduce((total, word) => total + calculateWordScore(word), 0);
}
