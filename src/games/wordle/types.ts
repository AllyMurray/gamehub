export type LetterStatus = 'correct' | 'present' | 'absent';

export interface Guess {
  word: string;
  status: LetterStatus[];
}

export interface WordleState {
  solution: string;
  guesses: Guess[];
  currentGuess: string;
  gameOver: boolean;
  won: boolean;
  message: string | null;
  shake: boolean;
}

export type KeyboardStatus = Record<string, LetterStatus>;
