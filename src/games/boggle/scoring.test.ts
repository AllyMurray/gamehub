import { describe, it, expect } from 'vitest';
import { calculateWordScore, calculateTotalScore } from './scoring';

describe('calculateWordScore', () => {
  it('should return 0 for words under 3 letters', () => {
    expect(calculateWordScore('A')).toBe(0);
    expect(calculateWordScore('IT')).toBe(0);
  });

  it('should return 1 for 3-4 letter words', () => {
    expect(calculateWordScore('CAT')).toBe(1);
    expect(calculateWordScore('DOGS')).toBe(1);
  });

  it('should return 2 for 5 letter words', () => {
    expect(calculateWordScore('APPLE')).toBe(2);
    expect(calculateWordScore('HOUSE')).toBe(2);
  });

  it('should return 3 for 6 letter words', () => {
    expect(calculateWordScore('BANANA')).toBe(3);
    expect(calculateWordScore('GARDEN')).toBe(3);
  });

  it('should return 5 for 7 letter words', () => {
    expect(calculateWordScore('DRAGONS')).toBe(5);
    expect(calculateWordScore('PERFECT')).toBe(5);
  });

  it('should return 11 for 8+ letter words', () => {
    expect(calculateWordScore('ABSOLUTE')).toBe(11);
    expect(calculateWordScore('STRAWBERRY')).toBe(11);
    expect(calculateWordScore('AARDVARKS')).toBe(11);
  });
});

describe('calculateTotalScore', () => {
  it('should return 0 for empty list', () => {
    expect(calculateTotalScore([])).toBe(0);
  });

  it('should sum scores for multiple words', () => {
    // CAT (1) + APPLE (2) + BANANA (3) = 6
    expect(calculateTotalScore(['CAT', 'APPLE', 'BANANA'])).toBe(6);
  });

  it('should handle mixed lengths', () => {
    // THE (1) + HOUSE (2) + DRAGONS (5) = 8
    expect(calculateTotalScore(['THE', 'HOUSE', 'DRAGONS'])).toBe(8);
  });
});
