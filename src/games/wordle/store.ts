import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { WordleState, Guess, KeyboardStatus } from './types';
import { getRandomWord } from './words';
import { getLetterStatus, isValidWord } from './logic';

const WORD_LENGTH = 5;
const MAX_GUESSES = 6;
const SHAKE_DURATION_MS = 500;

interface WordleStoreState extends WordleState {
  // Actions
  addLetter: (letter: string) => void;
  removeLetter: () => void;
  submitGuess: () => boolean;
  resetGame: () => void;
  setMessage: (message: string | null) => void;

  // For multiplayer state sync
  getState: () => WordleState;
  setState: (state: Partial<WordleState>) => void;

  // Utilities
  getKeyboardStatus: () => KeyboardStatus;
}

// Timer for shake/message cleanup
let shakeTimerId: ReturnType<typeof setTimeout> | null = null;

const scheduleShakeReset = (
  set: (state: Partial<Pick<WordleStoreState, 'shake' | 'message'>>) => void
): void => {
  if (shakeTimerId !== null) {
    clearTimeout(shakeTimerId);
  }
  shakeTimerId = setTimeout(() => {
    set({ shake: false, message: null });
    shakeTimerId = null;
  }, SHAKE_DURATION_MS);
};

export const useWordleStore = create<WordleStoreState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    solution: getRandomWord(),
    guesses: [],
    currentGuess: '',
    gameOver: false,
    won: false,
    message: null,
    shake: false,

    addLetter: (letter: string) => {
      const { currentGuess, gameOver } = get();
      if (gameOver || currentGuess.length >= WORD_LENGTH) return;
      set({ currentGuess: currentGuess + letter.toUpperCase() });
    },

    removeLetter: () => {
      const { currentGuess, gameOver } = get();
      if (gameOver || currentGuess.length === 0) return;
      set({ currentGuess: currentGuess.slice(0, -1) });
    },

    submitGuess: () => {
      const { currentGuess, solution, guesses, gameOver } = get();

      if (gameOver) return false;

      if (currentGuess.length !== WORD_LENGTH) {
        set({ message: 'Not enough letters', shake: true });
        scheduleShakeReset(set);
        return false;
      }

      if (!isValidWord(currentGuess)) {
        set({ message: 'Not in word list', shake: true });
        scheduleShakeReset(set);
        return false;
      }

      const status = getLetterStatus(currentGuess, solution);
      const newGuess: Guess = { word: currentGuess, status };
      const newGuesses = [...guesses, newGuess];

      const isWin = currentGuess.toUpperCase() === solution.toUpperCase();
      const isLoss = newGuesses.length >= MAX_GUESSES && !isWin;

      set({
        guesses: newGuesses,
        currentGuess: '',
        won: isWin,
        gameOver: isWin || isLoss,
        message: isWin ? 'Excellent!' : isLoss ? `The word was ${solution}` : null,
      });

      return true;
    },

    resetGame: () => {
      if (shakeTimerId !== null) {
        clearTimeout(shakeTimerId);
        shakeTimerId = null;
      }
      set({
        solution: getRandomWord(),
        guesses: [],
        currentGuess: '',
        gameOver: false,
        won: false,
        message: null,
        shake: false,
      });
    },

    setMessage: (message: string | null) => set({ message }),

    getState: () => {
      const { solution, guesses, currentGuess, gameOver, won, message, shake } = get();
      return { solution, guesses, currentGuess, gameOver, won, message, shake };
    },

    setState: (state: Partial<WordleState>) => {
      set((current) => ({ ...current, ...state }));
    },

    getKeyboardStatus: () => {
      const { guesses } = get();
      const status: KeyboardStatus = {};

      for (const guess of guesses) {
        for (let i = 0; i < guess.word.length; i++) {
          const letter = guess.word[i]!;
          const letterStatus = guess.status[i]!;
          const existing = status[letter];

          // Priority: correct > present > absent
          if (letterStatus === 'correct') {
            status[letter] = 'correct';
          } else if (letterStatus === 'present' && existing !== 'correct') {
            status[letter] = 'present';
          } else if (!existing) {
            status[letter] = 'absent';
          }
        }
      }

      return status;
    },
  }))
);
