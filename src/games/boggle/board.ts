import type { BoggleBoard } from './types';

/**
 * Boggle dice configuration (standard 4x4 Boggle)
 * Each die has 6 faces represented as an array of letters
 *
 * This uses the "New Boggle" dice distribution (1987-present), which replaced
 * the original 1976 dice. The redesign increased vowel frequency and improved
 * letter combinations, resulting in ~12% more findable words per board.
 *
 * Source: https://www.bananagrammer.com/2013/10/the-boggle-cube-redesign-and-its-effect.html
 */
const DICE: string[][] = [
  ['A', 'A', 'E', 'E', 'G', 'N'],
  ['A', 'B', 'B', 'J', 'O', 'O'],
  ['A', 'C', 'H', 'O', 'P', 'S'],
  ['A', 'F', 'F', 'K', 'P', 'S'],
  ['A', 'O', 'O', 'T', 'T', 'W'],
  ['C', 'I', 'M', 'O', 'T', 'U'],
  ['D', 'E', 'I', 'L', 'R', 'X'],
  ['D', 'E', 'L', 'R', 'V', 'Y'],
  ['D', 'I', 'S', 'T', 'T', 'Y'],
  ['E', 'E', 'G', 'H', 'N', 'W'],
  ['E', 'E', 'I', 'N', 'S', 'U'],
  ['E', 'H', 'R', 'T', 'V', 'W'],
  ['E', 'I', 'O', 'S', 'S', 'T'],
  ['E', 'L', 'R', 'T', 'T', 'Y'],
  ['H', 'I', 'M', 'N', 'U', 'Qu'],
  ['H', 'L', 'N', 'N', 'R', 'Z'],
];

/**
 * Shuffle an array in place using Fisher-Yates algorithm.
 */
function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

/**
 * Generate a random Boggle board by:
 * 1. Shuffling the dice
 * 2. Rolling each die to get a random face
 */
export function generateBoard(): BoggleBoard {
  const shuffledDice = shuffle(DICE);
  const grid: string[][] = [];

  for (let row = 0; row < 4; row++) {
    const gridRow: string[] = [];
    for (let col = 0; col < 4; col++) {
      const dieIndex = row * 4 + col;
      const die = shuffledDice[dieIndex]!;
      const faceIndex = Math.floor(Math.random() * 6);
      gridRow.push(die[faceIndex]!);
    }
    grid.push(gridRow);
  }

  return { grid, size: 4 };
}

/**
 * Get the letter at a position on the board.
 */
export function getLetter(board: BoggleBoard, row: number, col: number): string | null {
  if (row < 0 || row >= board.size || col < 0 || col >= board.size) {
    return null;
  }
  return board.grid[row]?.[col] ?? null;
}
