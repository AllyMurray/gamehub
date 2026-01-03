import type { Position } from '../types';

export interface BoggleBoard {
  grid: string[][];
  size: number;
}

export interface WordsByLength {
  [length: number]: {
    found: number;
    total: number;
  };
}

export interface BoggleState {
  board: BoggleBoard | null;
  foundWords: string[];
  currentPath: Position[];
  currentWord: string;
  score: number;
  gameOver: boolean;
  isLoading: boolean;
  possibleWords: string[];
  maxScore: number;
  wordsByLength: WordsByLength;
}

export interface TrieNode {
  children: Map<string, TrieNode>;
  isWord: boolean;
}

export type { Position };
