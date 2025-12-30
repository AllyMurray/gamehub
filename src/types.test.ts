import { describe, it, expect } from 'vitest';
import {
  sanitizeSessionCode,
  isValidSessionCode,
  parseSessionCode,
  sanitizeSessionPin,
  isValidSessionPin,
  GAME_CONFIG,
} from './types';

describe('Session Code Functions', () => {
  describe('sanitizeSessionCode', () => {
    it('should pass through valid session codes unchanged', () => {
      expect(sanitizeSessionCode('ABCDEF-a3f2b1')).toBe('ABCDEF-a3f2b1');
    });

    it('should convert lowercase readable part to uppercase', () => {
      expect(sanitizeSessionCode('abcdef-a3f2b1')).toBe('ABCDEF-a3f2b1');
    });

    it('should convert uppercase secret part to lowercase', () => {
      expect(sanitizeSessionCode('ABCDEF-A3F2B1')).toBe('ABCDEF-a3f2b1');
    });

    it('should filter out invalid characters from readable part', () => {
      // 0, O, 1, I are not in SESSION_CODE_CHARS
      expect(sanitizeSessionCode('ABC0EF-a3f2b1')).toBe('ABCEF-a3f2b1');
      expect(sanitizeSessionCode('ABCOEF-a3f2b1')).toBe('ABCEF-a3f2b1');
      expect(sanitizeSessionCode('ABC1EF-a3f2b1')).toBe('ABCEF-a3f2b1');
      expect(sanitizeSessionCode('ABCIEF-a3f2b1')).toBe('ABCEF-a3f2b1');
    });

    it('should filter out invalid characters from secret part', () => {
      // Only hex chars (0-9, a-f) are valid
      expect(sanitizeSessionCode('ABCDEF-a3g2b1')).toBe('ABCDEF-a32b1');
      expect(sanitizeSessionCode('ABCDEF-a3z2b1')).toBe('ABCDEF-a32b1');
    });

    it('should handle input without separator as readable-only', () => {
      expect(sanitizeSessionCode('ABCDEF')).toBe('ABCDEF');
      expect(sanitizeSessionCode('abcdefgh')).toBe('ABCDEF'); // Truncated to 6 chars
    });

    describe('dash character normalization', () => {
      it('should normalize en-dash (U+2013) to hyphen-minus', () => {
        expect(sanitizeSessionCode('ABCDEF\u2013a3f2b1')).toBe('ABCDEF-a3f2b1');
      });

      it('should normalize em-dash (U+2014) to hyphen-minus', () => {
        expect(sanitizeSessionCode('ABCDEF\u2014a3f2b1')).toBe('ABCDEF-a3f2b1');
      });

      it('should normalize figure dash (U+2012) to hyphen-minus', () => {
        expect(sanitizeSessionCode('ABCDEF\u2012a3f2b1')).toBe('ABCDEF-a3f2b1');
      });

      it('should normalize minus sign (U+2212) to hyphen-minus', () => {
        expect(sanitizeSessionCode('ABCDEF\u2212a3f2b1')).toBe('ABCDEF-a3f2b1');
      });

      it('should normalize non-breaking hyphen (U+2011) to hyphen-minus', () => {
        expect(sanitizeSessionCode('ABCDEF\u2011a3f2b1')).toBe('ABCDEF-a3f2b1');
      });

      it('should normalize hyphen (U+2010) to hyphen-minus', () => {
        expect(sanitizeSessionCode('ABCDEF\u2010a3f2b1')).toBe('ABCDEF-a3f2b1');
      });

      it('should normalize horizontal bar (U+2015) to hyphen-minus', () => {
        expect(sanitizeSessionCode('ABCDEF\u2015a3f2b1')).toBe('ABCDEF-a3f2b1');
      });

      it('should normalize small em dash (U+FE58) to hyphen-minus', () => {
        expect(sanitizeSessionCode('ABCDEF\uFE58a3f2b1')).toBe('ABCDEF-a3f2b1');
      });

      it('should normalize small hyphen-minus (U+FE63) to hyphen-minus', () => {
        expect(sanitizeSessionCode('ABCDEF\uFE63a3f2b1')).toBe('ABCDEF-a3f2b1');
      });

      it('should normalize fullwidth hyphen-minus (U+FF0D) to hyphen-minus', () => {
        expect(sanitizeSessionCode('ABCDEF\uFF0Da3f2b1')).toBe('ABCDEF-a3f2b1');
      });
    });

    describe('look-alike character normalization', () => {
      it('should normalize Cyrillic uppercase letters to Latin', () => {
        // А (U+0410) -> A, С (U+0421) -> C, Е (U+0415) -> E
        expect(sanitizeSessionCode('\u0410\u0421\u0415DEF-a3f2b1')).toBe('ACEDEF-a3f2b1');
      });

      it('should normalize Cyrillic lowercase letters to Latin in secret part', () => {
        // а (U+0430) -> a, с (U+0441) -> c, е (U+0435) -> e
        expect(sanitizeSessionCode('ABCDEF-\u0430\u0441\u0435def')).toBe('ABCDEF-acedef');
      });

      it('should normalize Greek uppercase letters to Latin', () => {
        // Α (U+0391) -> A, Β (U+0392) -> B, Ε (U+0395) -> E
        expect(sanitizeSessionCode('\u0391\u0392\u0395DEF-a3f2b1')).toBe('ABEDEF-a3f2b1');
      });

      it('should normalize fullwidth uppercase letters to ASCII', () => {
        // Ａ (U+FF21) -> A, Ｂ (U+FF22) -> B, Ｃ (U+FF23) -> C
        expect(sanitizeSessionCode('\uFF21\uFF22\uFF23DEF-a3f2b1')).toBe('ABCDEF-a3f2b1');
      });

      it('should normalize fullwidth lowercase letters to ASCII in secret part', () => {
        // ａ (U+FF41) -> a, ｂ (U+FF42) -> b, ｃ (U+FF43) -> c
        expect(sanitizeSessionCode('ABCDEF-\uFF41\uFF42\uFF43def')).toBe('ABCDEF-abcdef');
      });

      it('should normalize fullwidth digits to ASCII in secret part', () => {
        // ３ (U+FF13) -> 3, ２ (U+FF12) -> 2
        expect(sanitizeSessionCode('ABCDEF-a\uFF13f\uFF12b1')).toBe('ABCDEF-a3f2b1');
      });

      it('should handle mixed Cyrillic and Latin characters', () => {
        // Mix of Cyrillic А (U+0410), В (U+0412) with Latin CDEF
        expect(sanitizeSessionCode('\u0410\u0412CDEF-a3f2b1')).toBe('ABCDEF-a3f2b1');
      });

      it('should handle fully Cyrillic readable part that looks like Latin', () => {
        // АВСDЕF with А, В, С, Е as Cyrillic
        expect(sanitizeSessionCode('\u0410\u0412\u0421D\u0415F-a3f2b1')).toBe('ABCDEF-a3f2b1');
      });

      it('should normalize look-alikes combined with dash normalization', () => {
        // Cyrillic А (U+0410) + en-dash (U+2013) + Cyrillic а (U+0430)
        expect(sanitizeSessionCode('\u0410BCDEF\u2013\u0430bcdef')).toBe('ABCDEF-abcdef');
      });
    });
  });

  describe('isValidSessionCode', () => {
    it('should return true for valid session codes', () => {
      expect(isValidSessionCode('ABCDEF-a3f2b1')).toBe(true);
      expect(isValidSessionCode('XYZ234-000000')).toBe(true);
    });

    it('should return false for codes with wrong length', () => {
      expect(isValidSessionCode('ABCDE-a3f2b1')).toBe(false); // 5 + 6
      expect(isValidSessionCode('ABCDEFG-a3f2b1')).toBe(false); // 7 + 6
      expect(isValidSessionCode('ABCDEF-a3f2b')).toBe(false); // 6 + 5
    });

    it('should return false for codes with invalid readable characters', () => {
      expect(isValidSessionCode('ABC0EF-a3f2b1')).toBe(false); // 0 not allowed
      expect(isValidSessionCode('ABCOEF-a3f2b1')).toBe(false); // O not allowed
      expect(isValidSessionCode('ABC1EF-a3f2b1')).toBe(false); // 1 not allowed
      expect(isValidSessionCode('ABCIEF-a3f2b1')).toBe(false); // I not allowed
    });

    it('should return false for codes with invalid secret characters', () => {
      expect(isValidSessionCode('ABCDEF-g3f2b1')).toBe(false); // g not hex
      expect(isValidSessionCode('ABCDEF-A3f2b1')).toBe(false); // uppercase not allowed
    });

    it('should return false for codes without separator', () => {
      expect(isValidSessionCode('ABCDEFa3f2b1')).toBe(false);
    });
  });

  describe('parseSessionCode', () => {
    it('should parse valid session codes', () => {
      expect(parseSessionCode('ABCDEF-a3f2b1')).toEqual({
        readable: 'ABCDEF',
        secret: 'a3f2b1',
      });
    });

    it('should return null for invalid codes', () => {
      expect(parseSessionCode('ABCDEF')).toBeNull();
      expect(parseSessionCode('ABCDEF-')).toBeNull();
      expect(parseSessionCode('-a3f2b1')).toBeNull();
      expect(parseSessionCode('ABC-a3f2b1')).toBeNull();
      expect(parseSessionCode('ABCDEF-a3f')).toBeNull();
    });
  });
});

describe('Session PIN Functions', () => {
  describe('sanitizeSessionPin', () => {
    it('should pass through valid PINs unchanged', () => {
      expect(sanitizeSessionPin('1234')).toBe('1234');
      expect(sanitizeSessionPin('12345678')).toBe('12345678');
    });

    it('should remove non-numeric characters', () => {
      expect(sanitizeSessionPin('12a34')).toBe('1234');
      expect(sanitizeSessionPin('1-2-3-4')).toBe('1234');
    });

    it('should truncate to max length', () => {
      expect(sanitizeSessionPin('123456789')).toBe('12345678');
    });
  });

  describe('isValidSessionPin', () => {
    it('should return true for empty PIN (no authentication)', () => {
      expect(isValidSessionPin('')).toBe(true);
    });

    it('should return true for valid PINs', () => {
      expect(isValidSessionPin('1234')).toBe(true);
      expect(isValidSessionPin('12345678')).toBe(true);
    });

    it('should return false for PINs shorter than minimum', () => {
      expect(isValidSessionPin('123')).toBe(false);
    });

    it('should return false for PINs longer than maximum', () => {
      expect(isValidSessionPin('123456789')).toBe(false);
    });

    it('should return false for PINs with non-numeric characters', () => {
      expect(isValidSessionPin('12a4')).toBe(false);
    });
  });
});

describe('GAME_CONFIG constants', () => {
  it('should have correct session code configuration', () => {
    expect(GAME_CONFIG.SESSION_CODE_LENGTH).toBe(6);
    expect(GAME_CONFIG.PEER_SECRET_LENGTH).toBe(6);
    expect(GAME_CONFIG.FULL_SESSION_CODE_LENGTH).toBe(13); // 6 + 1 + 6
    expect(GAME_CONFIG.SESSION_CODE_SEPARATOR).toBe('-');
  });

  it('should have SESSION_CODE_CHARS without ambiguous characters', () => {
    expect(GAME_CONFIG.SESSION_CODE_CHARS).not.toContain('0');
    expect(GAME_CONFIG.SESSION_CODE_CHARS).not.toContain('O');
    expect(GAME_CONFIG.SESSION_CODE_CHARS).not.toContain('1');
    expect(GAME_CONFIG.SESSION_CODE_CHARS).not.toContain('I');
  });
});
