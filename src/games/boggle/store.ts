import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { BoggleState, Position } from './types';
import { generateBoard } from './board';
import { validateWord, getWordFromPath, canFormWord } from './solver';
import { calculateWordScore } from './scoring';
import { loadDictionary, isDictionaryLoaded, isWord } from './dictionary';

interface BoggleStoreState extends BoggleState {
  // Actions
  initGame: () => Promise<void>;
  selectTile: (pos: Position) => void;
  deselectTile: () => void;
  submitWord: () => { success: boolean; word?: string | undefined; reason?: string | undefined };
  submitWordByText: (word: string) => { success: boolean; word?: string | undefined; reason?: string | undefined };
  clearSelection: () => void;
  endGame: () => void;
  resetGame: () => void;
  rotateBoard: (direction: 'left' | 'right') => void;

  // State getters
  getState: () => BoggleState;
}

export const useBoggleStore = create<BoggleStoreState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    board: null,
    foundWords: [],
    currentPath: [],
    currentWord: '',
    score: 0,
    gameOver: false,
    isLoading: true,

    initGame: async () => {
      set({ isLoading: true });

      // Load dictionary if not already loaded
      if (!isDictionaryLoaded()) {
        loadDictionary();
      }

      // Generate new board
      const board = generateBoard();

      set({
        board,
        foundWords: [],
        currentPath: [],
        currentWord: '',
        score: 0,
        gameOver: false,
        isLoading: false,
      });
    },

    selectTile: (pos: Position) => {
      const { board, currentPath, gameOver } = get();
      if (!board || gameOver) return;

      // Check if this position is already in the path
      const existingIndex = currentPath.findIndex(
        (p) => p.row === pos.row && p.col === pos.col
      );

      if (existingIndex !== -1) {
        // If clicking on the last tile, ignore (or could submit)
        if (existingIndex === currentPath.length - 1) {
          return;
        }
        // If clicking on a previous tile, truncate path to that point
        const newPath = currentPath.slice(0, existingIndex + 1);
        const newWord = getWordFromPath(board, newPath);
        set({ currentPath: newPath, currentWord: newWord });
        return;
      }

      // Check if new position is adjacent to last position
      if (currentPath.length > 0) {
        const lastPos = currentPath[currentPath.length - 1]!;
        const rowDiff = Math.abs(pos.row - lastPos.row);
        const colDiff = Math.abs(pos.col - lastPos.col);
        const isAdjacent = rowDiff <= 1 && colDiff <= 1;

        if (!isAdjacent) {
          // Start new path from this position
          const letter = board.grid[pos.row]?.[pos.col] ?? '';
          set({ currentPath: [pos], currentWord: letter.toUpperCase() });
          return;
        }
      }

      // Add to path
      const newPath = [...currentPath, pos];
      const newWord = getWordFromPath(board, newPath);
      set({ currentPath: newPath, currentWord: newWord });
    },

    deselectTile: () => {
      const { currentPath, board } = get();
      if (currentPath.length === 0 || !board) return;

      const newPath = currentPath.slice(0, -1);
      const newWord = newPath.length > 0 ? getWordFromPath(board, newPath) : '';
      set({ currentPath: newPath, currentWord: newWord });
    },

    submitWord: () => {
      const { board, currentPath, foundWords, score } = get();

      if (!board || currentPath.length < 3) {
        set({ currentPath: [], currentWord: '' });
        return { success: false, reason: 'Word must be at least 3 letters' };
      }

      const result = validateWord(board, currentPath);

      if (!result.valid) {
        set({ currentPath: [], currentWord: '' });
        return { success: false, reason: result.reason };
      }

      // Check if already found
      if (foundWords.includes(result.word)) {
        set({ currentPath: [], currentWord: '' });
        return { success: false, word: result.word, reason: 'Already found' };
      }

      // Add word and update score
      const wordScore = calculateWordScore(result.word);
      set({
        foundWords: [...foundWords, result.word],
        score: score + wordScore,
        currentPath: [],
        currentWord: '',
      });

      return { success: true, word: result.word };
    },

    submitWordByText: (word: string) => {
      const { board, foundWords, score } = get();

      if (!board) {
        return { success: false, reason: 'Game not initialized' };
      }

      const upperWord = word.toUpperCase();

      if (upperWord.length < 3) {
        return { success: false, reason: 'Word must be at least 3 letters' };
      }

      // Check if in dictionary
      if (!isWord(upperWord)) {
        return { success: false, word: upperWord, reason: 'Not in dictionary' };
      }

      // Check if already found
      if (foundWords.includes(upperWord)) {
        return { success: false, word: upperWord, reason: 'Already found' };
      }

      // Check if word can be formed on board
      if (!canFormWord(board, upperWord)) {
        return { success: false, word: upperWord, reason: 'Not on board' };
      }

      // Add word and update score
      const wordScore = calculateWordScore(upperWord);
      set({
        foundWords: [...foundWords, upperWord],
        score: score + wordScore,
        currentPath: [],
        currentWord: '',
      });

      return { success: true, word: upperWord };
    },

    clearSelection: () => {
      set({ currentPath: [], currentWord: '' });
    },

    endGame: () => {
      set({ gameOver: true, currentPath: [], currentWord: '' });
    },

    resetGame: () => {
      set({
        board: null,
        foundWords: [],
        currentPath: [],
        currentWord: '',
        score: 0,
        gameOver: false,
        isLoading: true,
      });
    },

    rotateBoard: (direction: 'left' | 'right') => {
      const { board } = get();
      if (!board) return;

      const { grid, size } = board;
      const newGrid: string[][] = Array(size)
        .fill(null)
        .map(() => Array(size).fill(''));

      for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
          const letter = grid[row]?.[col] ?? '';
          if (direction === 'right') {
            // Rotate right 90°: [row][col] -> [col][size-1-row]
            const targetRow = newGrid[col];
            if (targetRow) {
              targetRow[size - 1 - row] = letter;
            }
          } else {
            // Rotate left 90°: [row][col] -> [size-1-col][row]
            const targetRow = newGrid[size - 1 - col];
            if (targetRow) {
              targetRow[row] = letter;
            }
          }
        }
      }

      // Clear current selection when rotating
      set({
        board: { grid: newGrid, size },
        currentPath: [],
        currentWord: '',
      });
    },

    getState: () => {
      const { board, foundWords, currentPath, currentWord, score, gameOver, isLoading } =
        get();
      return { board, foundWords, currentPath, currentWord, score, gameOver, isLoading };
    },
  }))
);
