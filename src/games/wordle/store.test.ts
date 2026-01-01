import { describe, it, expect, beforeEach } from 'vitest';
import { useWordleStore } from './store';

describe('useWordleStore', () => {
  beforeEach(() => {
    useWordleStore.getState().resetGame();
  });

  describe('addLetter', () => {
    it('should add a letter to current guess', () => {
      const { addLetter } = useWordleStore.getState();

      addLetter('A');
      expect(useWordleStore.getState().currentGuess).toBe('A');

      addLetter('B');
      expect(useWordleStore.getState().currentGuess).toBe('AB');
    });

    it('should not add more than 5 letters', () => {
      const { addLetter } = useWordleStore.getState();

      'ABCDEF'.split('').forEach((letter) => addLetter(letter));
      expect(useWordleStore.getState().currentGuess).toBe('ABCDE');
    });

    it('should not add letters when game is over', () => {
      useWordleStore.setState({ gameOver: true, currentGuess: '' });
      const { addLetter } = useWordleStore.getState();

      addLetter('A');
      expect(useWordleStore.getState().currentGuess).toBe('');
    });

    it('should convert letters to uppercase', () => {
      const { addLetter } = useWordleStore.getState();

      addLetter('a');
      expect(useWordleStore.getState().currentGuess).toBe('A');
    });
  });

  describe('removeLetter', () => {
    it('should remove the last letter', () => {
      const { addLetter, removeLetter } = useWordleStore.getState();

      addLetter('A');
      addLetter('B');
      removeLetter();
      expect(useWordleStore.getState().currentGuess).toBe('A');
    });

    it('should do nothing when guess is empty', () => {
      const { removeLetter } = useWordleStore.getState();

      removeLetter();
      expect(useWordleStore.getState().currentGuess).toBe('');
    });
  });

  describe('submitGuess', () => {
    it('should reject words with not enough letters', () => {
      const { addLetter, submitGuess } = useWordleStore.getState();

      addLetter('A');
      addLetter('B');
      const result = submitGuess();

      expect(result).toBe(false);
      expect(useWordleStore.getState().message).toBe('Not enough letters');
      expect(useWordleStore.getState().shake).toBe(true);
    });

    it('should reject words not in word list', () => {
      const { addLetter, submitGuess } = useWordleStore.getState();

      'XXXXX'.split('').forEach((letter) => addLetter(letter));
      const result = submitGuess();

      expect(result).toBe(false);
      expect(useWordleStore.getState().message).toBe('Not in word list');
    });

    it('should accept valid words and add to guesses', () => {
      const { addLetter, submitGuess } = useWordleStore.getState();

      'CRANE'.split('').forEach((letter) => addLetter(letter));
      const result = submitGuess();

      expect(result).toBe(true);
      expect(useWordleStore.getState().guesses).toHaveLength(1);
      expect(useWordleStore.getState().guesses[0]?.word).toBe('CRANE');
      expect(useWordleStore.getState().currentGuess).toBe('');
    });

    it('should mark game as won when correct word guessed', () => {
      const solution = useWordleStore.getState().solution;
      const { addLetter, submitGuess } = useWordleStore.getState();

      solution.split('').forEach((letter) => addLetter(letter));
      submitGuess();

      expect(useWordleStore.getState().won).toBe(true);
      expect(useWordleStore.getState().gameOver).toBe(true);
      expect(useWordleStore.getState().message).toBe('Excellent!');
    });
  });

  describe('resetGame', () => {
    it('should reset all game state', () => {
      const { addLetter, submitGuess, resetGame } = useWordleStore.getState();

      'CRANE'.split('').forEach((letter) => addLetter(letter));
      submitGuess();
      resetGame();

      const state = useWordleStore.getState();
      expect(state.guesses).toHaveLength(0);
      expect(state.currentGuess).toBe('');
      expect(state.gameOver).toBe(false);
      expect(state.won).toBe(false);
      expect(state.message).toBeNull();
    });
  });

  describe('getKeyboardStatus', () => {
    it('should return empty object initially', () => {
      const status = useWordleStore.getState().getKeyboardStatus();
      expect(Object.keys(status)).toHaveLength(0);
    });

    it('should track letter statuses after guesses', () => {
      // Reset and set a known solution
      useWordleStore.getState().resetGame();
      useWordleStore.setState({ solution: 'CRANE' });

      const { addLetter, submitGuess, getKeyboardStatus } = useWordleStore.getState();

      // Guess TRACE - T absent, R correct, A correct, C present, E correct
      'TRACE'.split('').forEach((letter) => addLetter(letter));
      submitGuess();

      const status = getKeyboardStatus();
      expect(status['T']).toBe('absent');
      expect(status['R']).toBe('correct');
      expect(status['A']).toBe('correct');
      expect(status['C']).toBe('present');
      expect(status['E']).toBe('correct');
    });
  });
});
