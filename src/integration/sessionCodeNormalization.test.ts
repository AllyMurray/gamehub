/**
 * Integration tests for session code normalization in the connection flow.
 *
 * These tests verify that the Unicode normalization (dashes, look-alike characters)
 * works correctly through the entire join flow, ensuring users can connect even
 * when session codes contain substituted characters from different platforms.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  sanitizeSessionCode,
  isValidSessionCode,
  GAME_CONFIG,
} from '../types';
import { generateSessionCode } from '../stores/peerConnection';

// Mock PeerJS to avoid actual network connections
vi.mock('peerjs', () => ({
  default: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    connect: vi.fn().mockReturnValue({
      on: vi.fn(),
      send: vi.fn(),
      close: vi.fn(),
      open: true,
    }),
    destroy: vi.fn(),
  })),
}));

describe('Session Code Normalization Integration', () => {
  describe('End-to-end session code flow', () => {
    it('should generate valid session codes', () => {
      const code = generateSessionCode();

      // Code should match expected format
      expect(code).toMatch(/^[A-Z0-9]{6}-[a-f0-9]{6}$/);
      expect(code.length).toBe(GAME_CONFIG.FULL_SESSION_CODE_LENGTH);
      expect(isValidSessionCode(code)).toBe(true);
    });

    it('should handle WhatsApp en-dash substitution in full flow', () => {
      // Generate a real session code
      const originalCode = generateSessionCode();

      // Simulate WhatsApp substitution (hyphen-minus → en-dash)
      const whatsappCode = originalCode.replace('-', '\u2013');

      // The codes should look different at byte level
      expect(whatsappCode).not.toBe(originalCode);

      // But sanitization should normalize them to be identical
      const sanitized = sanitizeSessionCode(whatsappCode);
      expect(sanitized).toBe(originalCode);
      expect(isValidSessionCode(sanitized)).toBe(true);
    });

    it('should handle all dash variants that messaging apps might substitute', () => {
      const originalCode = generateSessionCode();
      const dashVariants = [
        '\u2010', // HYPHEN
        '\u2011', // NON-BREAKING HYPHEN
        '\u2012', // FIGURE DASH
        '\u2013', // EN DASH (WhatsApp)
        '\u2014', // EM DASH
        '\u2015', // HORIZONTAL BAR
        '\u2212', // MINUS SIGN
        '\uFE58', // SMALL EM DASH
        '\uFE63', // SMALL HYPHEN-MINUS
        '\uFF0D', // FULLWIDTH HYPHEN-MINUS
      ];

      for (const dash of dashVariants) {
        const modifiedCode = originalCode.replace('-', dash);
        const sanitized = sanitizeSessionCode(modifiedCode);
        expect(sanitized).toBe(originalCode);
        expect(isValidSessionCode(sanitized)).toBe(true);
      }
    });

    it('should handle Cyrillic character substitution from Russian keyboards', () => {
      const originalCode = generateSessionCode();

      // Map Latin to Cyrillic look-alikes that might occur
      const latinToCyrillic: Record<string, string> = {
        'A': '\u0410', 'B': '\u0412', 'C': '\u0421', 'E': '\u0415',
        'H': '\u041D', 'K': '\u041A', 'M': '\u041C', 'P': '\u0420',
        'T': '\u0422', 'X': '\u0425', 'Y': '\u0423',
        'a': '\u0430', 'c': '\u0441', 'e': '\u0435', 'p': '\u0440',
        'x': '\u0445', 'y': '\u0443',
      };

      // Substitute all possible characters
      let cyrillicCode = '';
      for (const char of originalCode) {
        cyrillicCode += latinToCyrillic[char] ?? char;
      }

      // Sanitization should normalize back to original
      const sanitized = sanitizeSessionCode(cyrillicCode);
      expect(sanitized).toBe(originalCode);
      expect(isValidSessionCode(sanitized)).toBe(true);
    });

    it('should handle Greek character substitution', () => {
      const originalCode = generateSessionCode();

      const latinToGreek: Record<string, string> = {
        'A': '\u0391', 'B': '\u0392', 'E': '\u0395', 'H': '\u0397',
        'K': '\u039A', 'M': '\u039C', 'N': '\u039D', 'P': '\u03A1',
        'T': '\u03A4', 'X': '\u03A7', 'Y': '\u03A5', 'Z': '\u0396',
      };

      let greekCode = '';
      for (const char of originalCode) {
        greekCode += latinToGreek[char] ?? char;
      }

      const sanitized = sanitizeSessionCode(greekCode);
      expect(sanitized).toBe(originalCode);
      expect(isValidSessionCode(sanitized)).toBe(true);
    });

    it('should handle fullwidth characters from Asian keyboards', () => {
      const originalCode = generateSessionCode();

      // Convert to fullwidth
      let fullwidthCode = '';
      for (const char of originalCode) {
        const code = char.charCodeAt(0);
        if (code >= 0x41 && code <= 0x5A) {
          // Uppercase A-Z → Fullwidth
          fullwidthCode += String.fromCharCode(code - 0x41 + 0xFF21);
        } else if (code >= 0x61 && code <= 0x7A) {
          // Lowercase a-z → Fullwidth
          fullwidthCode += String.fromCharCode(code - 0x61 + 0xFF41);
        } else if (code >= 0x30 && code <= 0x39) {
          // Digits 0-9 → Fullwidth
          fullwidthCode += String.fromCharCode(code - 0x30 + 0xFF10);
        } else if (char === '-') {
          // Hyphen → Fullwidth hyphen-minus
          fullwidthCode += '\uFF0D';
        } else {
          fullwidthCode += char;
        }
      }

      const sanitized = sanitizeSessionCode(fullwidthCode);
      expect(sanitized).toBe(originalCode);
      expect(isValidSessionCode(sanitized)).toBe(true);
    });

    it('should handle combined substitutions (Cyrillic + en-dash)', () => {
      const originalCode = generateSessionCode();

      // Apply both Cyrillic substitution AND en-dash
      let mixedCode = originalCode.replace('-', '\u2013'); // en-dash
      mixedCode = mixedCode.replace(/A/g, '\u0410'); // Cyrillic А
      mixedCode = mixedCode.replace(/a/g, '\u0430'); // Cyrillic а

      const sanitized = sanitizeSessionCode(mixedCode);
      expect(sanitized).toBe(originalCode);
      expect(isValidSessionCode(sanitized)).toBe(true);
    });

    it('should maintain code validity through multiple sanitization passes', () => {
      const originalCode = generateSessionCode();

      // Apply various transformations
      let code = originalCode;
      code = sanitizeSessionCode(code); // First pass
      code = sanitizeSessionCode(code); // Second pass (should be idempotent)
      code = sanitizeSessionCode(code); // Third pass

      expect(code).toBe(originalCode);
      expect(isValidSessionCode(code)).toBe(true);
    });
  });

  describe('Connection flow simulation', () => {
    it('should produce matching peer IDs when viewer uses normalized code', () => {
      // Simulate host generating code
      const hostCode = generateSessionCode();
      const hostPeerId = `wordle-${hostCode}`;

      // Simulate viewer receiving code via WhatsApp (with en-dash)
      const receivedCode = hostCode.replace('-', '\u2013');

      // Viewer sanitizes the code
      const sanitizedCode = sanitizeSessionCode(receivedCode);

      // Viewer creates peer ID from sanitized code
      const viewerTargetPeerId = `wordle-${sanitizedCode}`;

      // The peer IDs should match
      expect(viewerTargetPeerId).toBe(hostPeerId);
    });

    it('should produce matching peer IDs with Cyrillic substitution', () => {
      const hostCode = generateSessionCode();
      const hostPeerId = `wordle-${hostCode}`;

      // Simulate code copied with Cyrillic characters
      let cyrillicCode = hostCode;
      cyrillicCode = cyrillicCode.replace(/A/g, '\u0410');
      cyrillicCode = cyrillicCode.replace(/B/g, '\u0412');
      cyrillicCode = cyrillicCode.replace(/C/g, '\u0421');
      cyrillicCode = cyrillicCode.replace(/E/g, '\u0415');
      cyrillicCode = cyrillicCode.replace(/a/g, '\u0430');
      cyrillicCode = cyrillicCode.replace(/c/g, '\u0441');
      cyrillicCode = cyrillicCode.replace(/e/g, '\u0435');

      const sanitizedCode = sanitizeSessionCode(cyrillicCode);
      const viewerTargetPeerId = `wordle-${sanitizedCode}`;

      expect(viewerTargetPeerId).toBe(hostPeerId);
    });

    it('should work with URL-encoded session codes', () => {
      const hostCode = generateSessionCode();

      // Simulate URL encoding (hyphen stays the same in URLs)
      const urlEncoded = encodeURIComponent(hostCode);
      const decoded = decodeURIComponent(urlEncoded);

      expect(decoded).toBe(hostCode);
      expect(isValidSessionCode(decoded)).toBe(true);
    });

    it('should handle URL with substituted characters', () => {
      const hostCode = generateSessionCode();

      // User might manually type URL with different keyboard
      const typedCode = hostCode.replace('-', '\u2013').replace(/A/g, '\u0410');

      // Even if URL-decoded, sanitization should fix it
      const sanitized = sanitizeSessionCode(typedCode);
      expect(sanitized).toBe(hostCode);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty input', () => {
      expect(sanitizeSessionCode('')).toBe('');
    });

    it('should handle input with only invalid characters', () => {
      expect(sanitizeSessionCode('!!!@@@###')).toBe('');
    });

    it('should handle extremely long input by truncating', () => {
      const longInput = 'A'.repeat(100) + '-' + 'a'.repeat(100);
      const sanitized = sanitizeSessionCode(longInput);
      expect(sanitized).toBe('AAAAAA-aaaaaa');
    });

    it('should handle multiple separators by using first one', () => {
      const input = 'ABCDEF-abc-def';
      const sanitized = sanitizeSessionCode(input);
      // Should split on first separator
      expect(sanitized).toBe('ABCDEF-abcdef');
    });

    it('should filter ambiguous characters (0, O, 1, I) from readable part', () => {
      // These characters are intentionally excluded from SESSION_CODE_CHARS
      const input = 'A0O1IB-abcdef';
      const sanitized = sanitizeSessionCode(input);
      // 0, O, 1, I should be filtered out
      expect(sanitized).toBe('AB-abcdef');
    });

    it('should preserve case correctly (uppercase readable, lowercase secret)', () => {
      const input = 'abcdef-ABCDEF';
      const sanitized = sanitizeSessionCode(input);
      expect(sanitized).toBe('ABCDEF-abcdef');
    });
  });

  describe('Real-world scenarios', () => {
    it('scenario: User copies code from WhatsApp on iPhone', () => {
      const hostCode = 'XYZ234-a1b2c3';

      // iPhone WhatsApp often substitutes hyphen with en-dash
      const iphoneCode = 'XYZ234\u2013a1b2c3';

      const sanitized = sanitizeSessionCode(iphoneCode);
      expect(sanitized).toBe(hostCode);
      expect(isValidSessionCode(sanitized)).toBe(true);
    });

    it('scenario: User types code on Russian keyboard without switching', () => {
      // On Russian keyboard, some keys produce Cyrillic instead of Latin
      // User sees "АВС234" but it's actually Cyrillic АВС
      const hostCode = 'ABC234-a1b2c3';
      const russianTyped = '\u0410\u0412\u0421234-\u04301b2c3'; // АВС234-а1b2c3

      const sanitized = sanitizeSessionCode(russianTyped);
      expect(sanitized).toBe(hostCode);
    });

    it('scenario: User copies from Japanese IME with fullwidth characters', () => {
      const hostCode = 'DEF789-d4e5f6';

      // Japanese IME might produce fullwidth characters
      const fullwidthCode = '\uFF24\uFF25\uFF26\uFF17\uFF18\uFF19\uFF0D\uFF44\uFF14\uFF45\uFF15\uFF46\uFF16';

      const sanitized = sanitizeSessionCode(fullwidthCode);
      expect(sanitized).toBe(hostCode);
    });

    it('scenario: Code passed through multiple messaging apps', () => {
      const hostCode = generateSessionCode();

      // Simulating code going through WhatsApp → Telegram → SMS
      let mangled = hostCode;
      mangled = mangled.replace('-', '\u2014'); // em-dash from one app
      mangled = mangled.replace(/A/g, '\u0391'); // Greek Alpha from autocorrect

      const sanitized = sanitizeSessionCode(mangled);
      expect(sanitized).toBe(hostCode);
      expect(isValidSessionCode(sanitized)).toBe(true);
    });
  });
});
