import { describe, it, expect, beforeAll } from 'vitest';
import { isValidPath, getWordFromPath, findAllWords } from './solver';
import { loadDictionary } from './dictionary';
import type { BoggleBoard } from './types';

describe('isValidPath', () => {
  it('should accept valid adjacent path', () => {
    const path = [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 1, col: 1 },
    ];
    expect(isValidPath(path)).toBe(true);
  });

  it('should accept diagonal adjacency', () => {
    const path = [
      { row: 0, col: 0 },
      { row: 1, col: 1 },
      { row: 2, col: 2 },
    ];
    expect(isValidPath(path)).toBe(true);
  });

  it('should reject non-adjacent tiles', () => {
    const path = [
      { row: 0, col: 0 },
      { row: 0, col: 2 }, // Skipped column 1
    ];
    expect(isValidPath(path)).toBe(false);
  });

  it('should reject revisited tiles', () => {
    const path = [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 0 }, // Revisited
    ];
    expect(isValidPath(path)).toBe(false);
  });

  it('should reject empty path', () => {
    expect(isValidPath([])).toBe(false);
  });

  it('should accept single tile path', () => {
    const path = [{ row: 0, col: 0 }];
    expect(isValidPath(path)).toBe(true);
  });
});

describe('getWordFromPath', () => {
  it('should build word from path', () => {
    const board: BoggleBoard = {
      grid: [
        ['C', 'A', 'T', 'S'],
        ['D', 'O', 'G', 'E'],
        ['R', 'A', 'T', 'S'],
        ['B', 'I', 'R', 'D'],
      ],
      size: 4,
    };

    const path = [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
    ];

    expect(getWordFromPath(board, path)).toBe('CAT');
  });

  it('should handle Qu tiles', () => {
    const board: BoggleBoard = {
      grid: [
        ['Qu', 'I', 'T', 'E'],
        ['A', 'B', 'C', 'D'],
        ['E', 'F', 'G', 'H'],
        ['I', 'J', 'K', 'L'],
      ],
      size: 4,
    };

    const path = [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
    ];

    expect(getWordFromPath(board, path)).toBe('QUIT');
  });
});

describe('findAllWords', () => {
  beforeAll(() => {
    loadDictionary();
  });

  it('should find words on a simple board', () => {
    const board: BoggleBoard = {
      grid: [
        ['C', 'A', 'T', 'S'],
        ['D', 'O', 'G', 'E'],
        ['R', 'A', 'T', 'S'],
        ['B', 'I', 'R', 'D'],
      ],
      size: 4,
    };

    const words = findAllWords(board);

    // Should find common words
    expect(words).toContain('CAT');
    expect(words).toContain('DOG');
    expect(words).toContain('RAT');
  });

  it('should not return words shorter than 3 letters', () => {
    const board: BoggleBoard = {
      grid: [
        ['A', 'B', 'C', 'D'],
        ['E', 'F', 'G', 'H'],
        ['I', 'J', 'K', 'L'],
        ['M', 'N', 'O', 'P'],
      ],
      size: 4,
    };

    const words = findAllWords(board);

    // All words should be 3+ letters
    for (const word of words) {
      expect(word.length).toBeGreaterThanOrEqual(3);
    }
  });
});
