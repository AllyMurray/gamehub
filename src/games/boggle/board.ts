import type { BoggleBoard } from './types';

/**
 * Boggle dice configuration (standard 4x4 Boggle)
 * Each die has 6 faces represented as an array of letters
 */
const DICE: string[][] = [
  ['R', 'I', 'F', 'O', 'B', 'X'],
  ['I', 'F', 'E', 'H', 'E', 'Y'],
  ['D', 'E', 'N', 'O', 'W', 'S'],
  ['U', 'T', 'O', 'K', 'N', 'D'],
  ['H', 'M', 'S', 'R', 'A', 'O'],
  ['L', 'U', 'P', 'E', 'T', 'S'],
  ['A', 'C', 'I', 'T', 'O', 'A'],
  ['Y', 'L', 'G', 'K', 'U', 'E'],
  ['Qu', 'B', 'M', 'J', 'O', 'A'],
  ['E', 'H', 'I', 'S', 'P', 'N'],
  ['V', 'E', 'T', 'I', 'G', 'N'],
  ['B', 'A', 'L', 'I', 'Y', 'T'],
  ['E', 'Z', 'A', 'V', 'N', 'D'],
  ['R', 'A', 'L', 'E', 'S', 'C'],
  ['U', 'W', 'I', 'L', 'R', 'G'],
  ['P', 'A', 'C', 'E', 'M', 'D'],
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
