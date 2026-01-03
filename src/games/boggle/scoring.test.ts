import { describe, it, expect } from 'vitest';
import { calculateWordScore, calculateTotalScore } from './scoring';

describe('calculateWordScore', () => {
  it('should return 0 for words under 3 letters', () => {
    expect(calculateWordScore('A')).toBe(0);
    expect(calculateWordScore('IT')).toBe(0);
  });

  it('should return length - 2 for valid words', () => {
    expect(calculateWordScore('CAT')).toBe(1); // 3 letters = 1pt
    expect(calculateWordScore('DOGS')).toBe(2); // 4 letters = 2pt
    expect(calculateWordScore('APPLE')).toBe(3); // 5 letters = 3pt
    expect(calculateWordScore('BANANA')).toBe(4); // 6 letters = 4pt
    expect(calculateWordScore('DRAGONS')).toBe(5); // 7 letters = 5pt
    expect(calculateWordScore('ABSOLUTE')).toBe(6); // 8 letters = 6pt
    expect(calculateWordScore('STRAWBERRY')).toBe(8); // 10 letters = 8pt
  });
});

describe('calculateTotalScore', () => {
  it('should return 0 for empty list', () => {
    expect(calculateTotalScore([])).toBe(0);
  });

  it('should sum scores for multiple words', () => {
    // CAT (1) + APPLE (3) + BANANA (4) = 8
    expect(calculateTotalScore(['CAT', 'APPLE', 'BANANA'])).toBe(8);
  });

  it('should handle mixed lengths', () => {
    // THE (1) + HOUSE (3) + DRAGONS (5) = 9
    expect(calculateTotalScore(['THE', 'HOUSE', 'DRAGONS'])).toBe(9);
  });
});
