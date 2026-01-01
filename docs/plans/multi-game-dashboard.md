# Multi-Game Dashboard Architecture Plan

## Overview

This plan outlines the architectural changes required to transform the current Wordle-only application into a multi-game platform with a dashboard landing page. The first additional game will be Boggle.

## Current State Summary

- **Framework**: React 19 + TypeScript + Vite (SPA deployed to GitHub Pages)
- **State Management**: 4 Zustand stores (game, multiplayer, stats, ui)
- **Routing**: URL-based with query params (no router library)
- **Multiplayer**: PeerJS (WebRTC), lazy-loaded
- **Components**: Well-organized, React.memo optimized
- **PWA**: Service worker for offline support

---

## Phase 1: Core Infrastructure

### 1.1 Add React Router

Install and configure React Router for proper navigation between dashboard and games.

**Files to create/modify:**
- `src/router.tsx` - Route configuration
- `src/App.tsx` - Wrap with RouterProvider
- `src/main.tsx` - Update entry point

**Route Structure:**
```
/                     → Dashboard (game selection)
/wordle               → Wordle game (lobby + gameplay)
/wordle?join=CODE     → Join Wordle multiplayer session
/boggle               → Boggle game (lobby + gameplay)
/boggle?join=CODE     → Join Boggle multiplayer session
```

### 1.2 Shared Types

Define common types used across games. Each game defines its own state and logic types internally.

**New file: `src/games/types.ts`**
```typescript
/**
 * Shared types for the multi-game platform.
 *
 * Philosophy: Games share infrastructure (router, multiplayer, timer, stats)
 * but implement their own game logic. No forced interface for game mechanics.
 */

export type GameId = 'wordle' | 'boggle';

/**
 * Metadata for dashboard display. No game logic here.
 */
export interface GameMetadata {
  id: GameId;
  name: string;
  description: string;
  icon: string;
  route: string;
  supportsMultiplayer: boolean;
}

/**
 * Common position type for grid-based games.
 */
export interface Position {
  row: number;
  col: number;
}
```

### 1.3 Theme CSS Variables

Define CSS custom properties for consistent theming across all games. These extend any existing theme variables.

**Modified: `src/index.css`** (add to existing file)
```css
:root {
  /* Base colors */
  --bg: #ffffff;
  --bg-secondary: #f5f5f5;
  --text-primary: #1a1a1a;
  --text-secondary: #6b7280;

  /* Tile colors */
  --tile-bg: #ffffff;
  --tile-border: #d3d6da;
  --tile-border-empty: #d3d6da;
  --tile-border-filled: #878a8c;
  --tile-text: #1a1a1a;
  --tile-hover: #e5e5e5;

  /* Game state colors */
  --correct: #6aaa64;
  --present: #c9b458;
  --absent: #787c7e;

  /* Keyboard colors */
  --key-bg: #d3d6da;
  --key-text: #1a1a1a;

  /* Selection colors (Boggle) */
  --tile-selected: #c9b458;
  --selection-line: #c9b458;

  /* UI elements */
  --button-primary: #6aaa64;
  --button-secondary: #d3d6da;
  --error: #dc2626;
  --warning: #f59e0b;
}

/* Dark theme */
[data-theme="dark"] {
  --bg: #121213;
  --bg-secondary: #1a1a1b;
  --text-primary: #ffffff;
  --text-secondary: #9ca3af;

  --tile-bg: #121213;
  --tile-border: #3a3a3c;
  --tile-border-empty: #3a3a3c;
  --tile-border-filled: #565758;
  --tile-text: #ffffff;
  --tile-hover: #2a2a2c;

  --correct: #538d4e;
  --present: #b59f3b;
  --absent: #3a3a3c;

  --key-bg: #818384;
  --key-text: #ffffff;

  --tile-selected: #b59f3b;
  --selection-line: #b59f3b;
}

/* High contrast mode (accessibility) */
[data-theme="high-contrast"] {
  --correct: #f5793a;
  --present: #85c0f9;
  --absent: #787c7e;
}
```

### 1.4 Create Game Registry

Simple registry for dashboard display. No game logic coupling.

**New file: `src/games/registry.ts`**
```typescript
import type { GameMetadata, GameId } from './types';

/**
 * Static metadata for all games. Used by dashboard only.
 * Games are lazy-loaded separately - this doesn't import game modules.
 */
export const gameRegistry: GameMetadata[] = [
  {
    id: 'wordle',
    name: 'Wordle',
    description: 'Guess the 5-letter word in 6 tries',
    icon: '🟩',
    route: '/wordle',
    supportsMultiplayer: true,
  },
  {
    id: 'boggle',
    name: 'Boggle',
    description: 'Find as many words as you can in 3 minutes',
    icon: '🔤',
    route: '/boggle',
    supportsMultiplayer: true,
  },
];

export const getGameMetadata = (id: GameId): GameMetadata | undefined =>
  gameRegistry.find(g => g.id === id);

export const getAllGames = (): GameMetadata[] => gameRegistry;
```

---

## Phase 2: Wordle Game Module

### 2.1 Extract Wordle Into Game Module

Move Wordle-specific logic into its own module. Wordle owns its types, state, and logic.

**New directory structure:**
```
src/games/wordle/
├── index.ts              # Re-exports for external use
├── WordleGame.tsx        # Main game component (default export for lazy loading)
├── store.ts              # Zustand store with all Wordle state/logic
├── words.ts              # Move from src/data/words.ts
├── logic.ts              # Pure functions (getLetterStatus, isValidWord)
├── types.ts              # Wordle-specific types
└── components/
    ├── WordleBoard.tsx
    └── WordleKeyboard.tsx
```

**Key extractions from current codebase:**
- `getLetterStatus()` from `gameStore.ts` → `logic.ts`
- `WORDS` array from `src/data/words.ts` → `words.ts`
- `Guess`, `LetterStatus` types from `types.ts` → Wordle `types.ts`
- Game state logic from `gameStore.ts` → `store.ts`

### 2.2 Wordle Types

**New file: `src/games/wordle/types.ts`**
```typescript
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
```

### 2.3 Wordle Store

Each game has its own store with its own logic. No shared interface.

**New file: `src/games/wordle/store.ts`**
```typescript
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { WordleState, Guess } from './types';
import { WORDS } from './words';
import { getLetterStatus, isValidWord } from './logic';

interface WordleStore extends WordleState {
  // Actions
  initGame: () => void;
  addLetter: (letter: string) => void;
  removeLetter: () => void;
  submitGuess: () => boolean;
  resetGame: () => void;

  // For multiplayer sync
  getState: () => WordleState;
  setState: (state: WordleState) => void;
}

const createInitialState = (): WordleState => ({
  solution: WORDS[Math.floor(Math.random() * WORDS.length)],
  guesses: [],
  currentGuess: '',
  gameOver: false,
  won: false,
  message: null,
  shake: false,
});

export const useWordleStore = create<WordleStore>()(
  subscribeWithSelector((set, get) => ({
    ...createInitialState(),

    initGame: () => set(createInitialState()),

    addLetter: (letter: string) => {
      const { currentGuess, gameOver } = get();
      if (gameOver || currentGuess.length >= 5) return;
      set({ currentGuess: currentGuess + letter.toUpperCase() });
    },

    removeLetter: () => {
      const { currentGuess } = get();
      set({ currentGuess: currentGuess.slice(0, -1) });
    },

    submitGuess: () => {
      const { currentGuess, solution, guesses, gameOver } = get();

      if (gameOver) return false;

      if (currentGuess.length !== 5) {
        set({ shake: true, message: 'Not enough letters' });
        setTimeout(() => set({ shake: false, message: null }), 500);
        return false;
      }

      if (!isValidWord(currentGuess)) {
        set({ shake: true, message: 'Not in word list' });
        setTimeout(() => set({ shake: false, message: null }), 500);
        return false;
      }

      const status = getLetterStatus(currentGuess, solution);
      const newGuess: Guess = { word: currentGuess, status };
      const newGuesses = [...guesses, newGuess];
      const won = currentGuess === solution;
      const isGameOver = won || newGuesses.length >= 6;

      set({
        guesses: newGuesses,
        currentGuess: '',
        won,
        gameOver: isGameOver,
        message: won ? 'Congratulations!' : isGameOver ? solution : null,
      });

      return true;
    },

    resetGame: () => set(createInitialState()),

    getState: () => {
      const { solution, guesses, currentGuess, gameOver, won, message, shake } = get();
      return { solution, guesses, currentGuess, gameOver, won, message, shake };
    },

    setState: (state: WordleState) => set(state),
  }))
);
```

### 2.4 Wordle Logic

Pure functions extracted from current gameStore.

**New file: `src/games/wordle/logic.ts`**
```typescript
import type { LetterStatus } from './types';
import { WORDS } from './words';

/**
 * Check if a word is in the word list.
 */
export function isValidWord(word: string): boolean {
  return WORDS.includes(word.toUpperCase());
}

/**
 * Calculate letter statuses for a guess against the solution.
 * Returns array of statuses: 'correct', 'present', or 'absent'.
 */
export function getLetterStatus(guess: string, solution: string): LetterStatus[] {
  const result: LetterStatus[] = Array(5).fill('absent');
  const solutionChars = solution.split('');
  const guessChars = guess.toUpperCase().split('');

  // First pass: mark correct letters
  for (let i = 0; i < 5; i++) {
    if (guessChars[i] === solutionChars[i]) {
      result[i] = 'correct';
      solutionChars[i] = '#'; // Mark as used
    }
  }

  // Second pass: mark present letters
  for (let i = 0; i < 5; i++) {
    if (result[i] === 'correct') continue;

    const idx = solutionChars.indexOf(guessChars[i]);
    if (idx !== -1) {
      result[i] = 'present';
      solutionChars[idx] = '#'; // Mark as used
    }
  }

  return result;
}
```

### 2.5 WordleGame Component

Main component for Wordle, used as default export for lazy loading.

**New file: `src/games/wordle/WordleGame.tsx`**
```typescript
import { useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useWordleStore } from './store';
import { useMultiplayerStore } from '../../stores';
import { useStatsStore } from '../../stores/statsStore';
import { GameLayout } from '../../components/GameLayout/GameLayout';
import { WordleBoard } from './components/WordleBoard';
import { WordleKeyboard } from './components/WordleKeyboard';
import './WordleGame.css';

export default function WordleGame() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Game state
  const {
    guesses,
    currentGuess,
    gameOver,
    won,
    message,
    shake,
    initGame,
    addLetter,
    removeLetter,
    submitGuess,
    getState,
    setState,
  } = useWordleStore();

  // Multiplayer state
  const role = useMultiplayerStore((s) => s.role);
  const sessionCode = useMultiplayerStore((s) => s.sessionCode);
  const partnerConnected = useMultiplayerStore((s) => s.partnerConnected);

  // Stats
  const recordGame = useStatsStore((s) => s.recordGame);

  // Initialize game on mount
  useEffect(() => {
    initGame();

    // Check for join code in URL
    const joinCode = searchParams.get('join');
    if (joinCode) {
      // Handle multiplayer join
    }
  }, [initGame, searchParams]);

  // Record stats when game ends
  useEffect(() => {
    if (gameOver) {
      recordGame('wordle', {
        won,
        guessCount: guesses.length,
      });
    }
  }, [gameOver, won, guesses.length, recordGame]);

  // Keyboard input handler
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (gameOver) return;
      if (role === 'viewer') return; // Viewers can't input

      if (e.key === 'Enter') {
        submitGuess();
      } else if (e.key === 'Backspace') {
        removeLetter();
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        addLetter(e.key);
      }
    },
    [gameOver, role, submitGuess, removeLetter, addLetter]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleBack = () => navigate('/');

  return (
    <GameLayout gameId="wordle" gameName="Wordle" onBack={handleBack}>
      {message && <div className="game-message">{message}</div>}

      <WordleBoard
        guesses={guesses}
        currentGuess={currentGuess}
        shake={shake}
      />

      <WordleKeyboard
        guesses={guesses}
        onKey={addLetter}
        onEnter={submitGuess}
        onBackspace={removeLetter}
        disabled={gameOver || role === 'viewer'}
      />

      {sessionCode && (
        <div className="multiplayer-status">
          {partnerConnected ? 'Partner connected' : 'Waiting for partner...'}
        </div>
      )}
    </GameLayout>
  );
}
```

### 2.6 WordleGame Styles

**New file: `src/games/wordle/WordleGame.css`**
```css
.wordle-game {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  padding: 1rem;
  max-width: 500px;
  margin: 0 auto;
}

.game-message {
  position: fixed;
  top: 80px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--tile-text);
  color: var(--bg);
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: bold;
  z-index: 100;
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

.multiplayer-status {
  font-size: 0.875rem;
  color: var(--text-secondary);
  padding: 0.5rem 1rem;
  background: var(--tile-bg);
  border-radius: 20px;
}

/* Board shake animation */
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
  20%, 40%, 60%, 80% { transform: translateX(4px); }
}

.wordle-board--shake {
  animation: shake 0.5s ease-in-out;
}
```

### 2.7 WordleBoard Component

**New file: `src/games/wordle/components/WordleBoard.tsx`**
```typescript
import { memo } from 'react';
import type { Guess } from '../types';
import './WordleBoard.css';

interface WordleBoardProps {
  guesses: Guess[];
  currentGuess: string;
  shake: boolean;
}

export const WordleBoard = memo(function WordleBoard({
  guesses,
  currentGuess,
  shake,
}: WordleBoardProps) {
  // Build 6 rows: submitted guesses + current guess row + empty rows
  const rows: (Guess | string | null)[] = [
    ...guesses,
    guesses.length < 6 ? currentGuess : null,
    ...Array(Math.max(0, 5 - guesses.length)).fill(null),
  ];

  return (
    <div
      className={`wordle-board ${shake ? 'wordle-board--shake' : ''}`}
      role="grid"
      aria-label="Game board"
    >
      {rows.slice(0, 6).map((row, rowIndex) => (
        <div key={rowIndex} className="wordle-row" role="row">
          {Array.from({ length: 5 }, (_, colIndex) => {
            // Determine cell content and status
            if (row === null) {
              // Empty row
              return (
                <div
                  key={colIndex}
                  className="wordle-tile wordle-tile--empty"
                  role="gridcell"
                  aria-label="Empty"
                />
              );
            }

            if (typeof row === 'string') {
              // Current guess row (in progress)
              const letter = row[colIndex] || '';
              return (
                <div
                  key={colIndex}
                  className={`wordle-tile ${letter ? 'wordle-tile--filled' : 'wordle-tile--empty'}`}
                  role="gridcell"
                  aria-label={letter || 'Empty'}
                >
                  {letter}
                </div>
              );
            }

            // Submitted guess row
            const { word, status } = row;
            const letter = word[colIndex];
            const letterStatus = status[colIndex];

            return (
              <div
                key={colIndex}
                className={`wordle-tile wordle-tile--${letterStatus}`}
                role="gridcell"
                aria-label={`${letter}, ${letterStatus}`}
                style={{ animationDelay: `${colIndex * 100}ms` }}
              >
                {letter}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
});
```

**New file: `src/games/wordle/components/WordleBoard.css`**
```css
.wordle-board {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.wordle-row {
  display: flex;
  gap: 5px;
}

.wordle-tile {
  width: 62px;
  height: 62px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  font-weight: bold;
  text-transform: uppercase;
  border: 2px solid var(--tile-border);
  background: var(--tile-bg);
  color: var(--tile-text);
  user-select: none;
}

.wordle-tile--empty {
  border-color: var(--tile-border-empty);
}

.wordle-tile--filled {
  border-color: var(--tile-border-filled);
  animation: pop 0.1s ease-out;
}

.wordle-tile--correct {
  background: var(--correct);
  border-color: var(--correct);
  color: white;
  animation: flip 0.5s ease-out forwards;
}

.wordle-tile--present {
  background: var(--present);
  border-color: var(--present);
  color: white;
  animation: flip 0.5s ease-out forwards;
}

.wordle-tile--absent {
  background: var(--absent);
  border-color: var(--absent);
  color: white;
  animation: flip 0.5s ease-out forwards;
}

@keyframes pop {
  0% { transform: scale(1); }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); }
}

@keyframes flip {
  0% { transform: rotateX(0deg); }
  50% { transform: rotateX(90deg); }
  100% { transform: rotateX(0deg); }
}

/* Responsive sizing */
@media (max-width: 400px) {
  .wordle-tile {
    width: 52px;
    height: 52px;
    font-size: 1.75rem;
  }
}
```

### 2.8 WordleKeyboard Component

**New file: `src/games/wordle/components/WordleKeyboard.tsx`**
```typescript
import { memo, useMemo } from 'react';
import type { Guess, LetterStatus } from '../types';
import './WordleKeyboard.css';

interface WordleKeyboardProps {
  guesses: Guess[];
  onKey: (letter: string) => void;
  onEnter: () => void;
  onBackspace: () => void;
  disabled?: boolean;
}

const KEYBOARD_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'BACK'],
];

export const WordleKeyboard = memo(function WordleKeyboard({
  guesses,
  onKey,
  onEnter,
  onBackspace,
  disabled,
}: WordleKeyboardProps) {
  // Build letter status map from all guesses
  const letterStatuses = useMemo(() => {
    const statuses = new Map<string, LetterStatus>();

    // Priority: correct > present > absent
    const priority: Record<LetterStatus, number> = {
      correct: 3,
      present: 2,
      absent: 1,
    };

    for (const guess of guesses) {
      for (let i = 0; i < guess.word.length; i++) {
        const letter = guess.word[i];
        const status = guess.status[i];
        const current = statuses.get(letter);

        if (!current || priority[status] > priority[current]) {
          statuses.set(letter, status);
        }
      }
    }

    return statuses;
  }, [guesses]);

  const handleClick = (key: string) => {
    if (disabled) return;

    if (key === 'ENTER') {
      onEnter();
    } else if (key === 'BACK') {
      onBackspace();
    } else {
      onKey(key);
    }
  };

  return (
    <div className="wordle-keyboard" role="group" aria-label="Keyboard">
      {KEYBOARD_ROWS.map((row, rowIndex) => (
        <div key={rowIndex} className="keyboard-row">
          {row.map((key) => {
            const status = letterStatuses.get(key);
            const isWide = key === 'ENTER' || key === 'BACK';

            return (
              <button
                key={key}
                className={`keyboard-key ${status ? `keyboard-key--${status}` : ''} ${isWide ? 'keyboard-key--wide' : ''}`}
                onClick={() => handleClick(key)}
                disabled={disabled}
                aria-label={key === 'BACK' ? 'Backspace' : key}
              >
                {key === 'BACK' ? '⌫' : key}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
});
```

**New file: `src/games/wordle/components/WordleKeyboard.css`**
```css
.wordle-keyboard {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  width: 100%;
  max-width: 500px;
}

.keyboard-row {
  display: flex;
  gap: 6px;
  width: 100%;
  justify-content: center;
}

.keyboard-key {
  min-width: 43px;
  height: 58px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: var(--key-bg);
  color: var(--key-text);
  font-size: 1rem;
  font-weight: bold;
  text-transform: uppercase;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.1s;
  flex: 1;
  max-width: 43px;
}

.keyboard-key--wide {
  min-width: 65px;
  max-width: 65px;
  font-size: 0.75rem;
}

.keyboard-key:hover:not(:disabled) {
  opacity: 0.9;
}

.keyboard-key:active:not(:disabled) {
  transform: scale(0.95);
}

.keyboard-key:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.keyboard-key--correct {
  background: var(--correct);
  color: white;
}

.keyboard-key--present {
  background: var(--present);
  color: white;
}

.keyboard-key--absent {
  background: var(--absent);
  color: white;
}

/* Responsive sizing */
@media (max-width: 500px) {
  .keyboard-key {
    min-width: 32px;
    max-width: 32px;
    height: 50px;
    font-size: 0.875rem;
  }

  .keyboard-key--wide {
    min-width: 50px;
    max-width: 50px;
    font-size: 0.65rem;
  }

  .keyboard-row {
    gap: 4px;
  }
}
```

---

## Phase 3: Boggle Game Module

### 3.1 Boggle Game Structure

Boggle owns its types, state, and logic. Uses shared timer infrastructure.

**New directory structure:**
```
src/games/boggle/
├── index.ts              # Re-exports for external use
├── BoggleGame.tsx        # Main game component (default export for lazy loading)
├── store.ts              # Zustand store with Boggle state/logic
├── types.ts              # Boggle-specific types
├── dictionary.ts         # Dictionary with Trie for prefix checking
├── wordlist.ts           # Word array (lazy-loaded, ~128K words)
├── board.ts              # Board generation with dice
├── solver.ts             # Path validation and word finding
├── scoring.ts            # Boggle scoring rules
└── components/
    ├── BoggleBoard.tsx   # 4x4 grid with drag selection
    ├── BoggleTile.tsx    # Individual letter tile
    ├── WordList.tsx      # Found words display
    ├── KeyboardInput.tsx # Accessibility input mode
    └── BoggleGame.css
```

### 3.2 Boggle Dictionary Strategy

The dictionary is a critical component requiring careful handling due to size.

#### Dictionary Source: English Open Word List (EOWL)

**Recommended: [EOWL](https://github.com/kloge/The-English-Open-Word-List)**

| Attribute | Details |
|-----------|---------|
| **Words** | ~128,985 words |
| **Max length** | 10 letters (sufficient for Boggle) |
| **Language** | British English |
| **License** | Free to use with attribution |
| **Source** | UK Advanced Cryptics Dictionary by J Ross Beresford |
| **Format** | UTF-8, Unix line endings |

**Alternative sources:**
- [Wordnik Wordlist](https://github.com/wordnik/wordlist) - MIT licensed, game-focused
- [dwyl/english-words](https://github.com/dwyl/english-words) - 479K words, larger but includes obscure terms

**License requirement:** Include attribution in app:
> Word list derived from the UK Advanced Cryptics Dictionary, Copyright © J Ross Beresford 1993-1999

#### What is a Trie?

A **Trie** (pronounced "try", from "retrieval") is a tree data structure for efficient string operations:

```
Root
├── C
│   ├── A
│   │   ├── T ✓ (CAT)
│   │   └── R ✓ (CAR)
│   │       └── S ✓ (CARS)
│   └── O
│       └── W ✓ (COW)
└── D
    └── O
        └── G ✓ (DOG)
```

**Why use a Trie for Boggle?**

| Operation | Array/Set | Trie |
|-----------|-----------|------|
| Check if word exists | O(n) or O(1) | O(k) where k = word length |
| Check if prefix exists | O(n) scan | O(k) - **critical for pruning** |
| Memory | Lower | Higher but acceptable |

The key advantage: when exploring the board with DFS, we can check "does any word start with 'QU'?" in O(2) time. If no words start with that prefix, we prune the entire branch - massively reducing search space.

#### Strategy: Lazy-loaded with Trie structure

**New file: `src/games/boggle/dictionary.ts`**
```typescript
/**
 * Boggle Dictionary Module
 *
 * Uses a Trie (prefix tree) for O(1) prefix checking during board solving.
 * Dictionary is lazy-loaded to avoid impacting initial bundle size.
 *
 * Source: English Open Word List (EOWL) - ~128K British English words
 * License: Free with attribution to J Ross Beresford (UK Advanced Cryptics Dictionary)
 * Compressed size: ~150KB gzipped
 */

export interface TrieNode {
  children: Map<string, TrieNode>;
  isWord: boolean;
}

let dictionary: Set<string> | null = null;
let trie: TrieNode | null = null;
let loadPromise: Promise<void> | null = null;

/**
 * Lazy load the dictionary. Called when entering Boggle game.
 * Returns cached promise if already loading.
 */
export async function loadDictionary(): Promise<void> {
  if (dictionary) return;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    // Dynamic import of word list (code-split by Vite)
    const { BOGGLE_WORDS } = await import('./wordlist.ts');
    // Normalize to lowercase for Set (validation uses lowercase)
    dictionary = new Set(BOGGLE_WORDS.map(w => w.toLowerCase()));
    // Trie uses uppercase for solver matching
    trie = buildTrie(BOGGLE_WORDS);
  })();

  return loadPromise;
}

/**
 * Build a Trie from word list for efficient prefix checking.
 */
function buildTrie(words: string[]): TrieNode {
  const root: TrieNode = { children: new Map(), isWord: false };

  for (const word of words) {
    let node = root;
    for (const char of word.toUpperCase()) {
      if (!node.children.has(char)) {
        node.children.set(char, { children: new Map(), isWord: false });
      }
      node = node.children.get(char)!;
    }
    node.isWord = true;
  }

  return root;
}

/**
 * Check if a word exists in the dictionary.
 */
export function isValidWord(word: string): boolean {
  if (!dictionary) {
    throw new Error('Dictionary not loaded. Call loadDictionary() first.');
  }
  return dictionary.has(word.toLowerCase());
}

/**
 * Check if a prefix could lead to a valid word (for solver optimization).
 */
export function isValidPrefix(prefix: string): boolean {
  if (!trie) return false;

  let node = trie;
  for (const char of prefix.toUpperCase()) {
    if (!node.children.has(char)) return false;
    node = node.children.get(char)!;
  }
  return true;
}

/**
 * Get the Trie for solver use.
 */
export function getTrie(): TrieNode {
  if (!trie) {
    throw new Error('Dictionary not loaded. Call loadDictionary() first.');
  }
  return trie;
}
```

**Word list source**: Use a subset of SOWPODS or TWL (Tournament Word List).
- Filter to words 3-16 letters
- Remove obscure/offensive words
- Final size: ~80,000 words, ~170KB gzipped

**New file: `src/games/boggle/wordlist.ts`**
```typescript
/**
 * Boggle word list - English Open Word List (EOWL)
 *
 * Source: https://github.com/kloge/The-English-Open-Word-List
 * License: Free to use with attribution
 * Attribution: UK Advanced Cryptics Dictionary, Copyright © J Ross Beresford 1993-1999
 *
 * Processing steps applied:
 * 1. Filter to words 3-10 letters (Boggle optimal range)
 * 2. Convert to uppercase
 * 3. Remove words with non-alphabetic characters
 * 4. Remove offensive/inappropriate words
 *
 * To generate this file:
 * 1. Download EOWL from GitHub
 * 2. Run: node scripts/process-wordlist.js
 *
 * This file is ~800KB uncompressed, ~150KB gzipped.
 * It's code-split and only loaded when entering Boggle.
 */

export const BOGGLE_WORDS: string[] = [
  // ~128,000 words go here
  // Example entries:
  'AAH',
  'AAL',
  'AAS',
  'ABA',
  'ABB',
  'ABO',
  'ABS',
  'ABY',
  // ... (full list populated during build)
  'ZAP',
  'ZAS',
  'ZAX',
  'ZED',
  'ZEE',
  'ZEK',
  'ZEN',
  'ZEP',
];

// Alternatively, load from JSON for easier updates:
// import wordlistJson from './wordlist.json';
// export const BOGGLE_WORDS: string[] = wordlistJson;
```

**Build script to process word list:**

**New file: `scripts/process-wordlist.js`**
```javascript
#!/usr/bin/env node
/**
 * Process EOWL word list for Boggle
 *
 * Usage:
 *   1. Download EOWL: git clone https://github.com/kloge/The-English-Open-Word-List
 *   2. Run: node scripts/process-wordlist.js path/to/EOWL/words.txt
 *   3. Output: src/games/boggle/wordlist.ts
 */

const fs = require('fs');
const path = require('path');

const inputFile = process.argv[2] || 'words.txt';
const outputFile = path.join(__dirname, '../src/games/boggle/wordlist.ts');

// Read and process words
const words = fs.readFileSync(inputFile, 'utf-8')
  .split('\n')
  .map(w => w.trim().toUpperCase())
  .filter(w => {
    // Only alphabetic characters
    if (!/^[A-Z]+$/.test(w)) return false;
    // Length 3-10 (optimal for Boggle)
    if (w.length < 3 || w.length > 10) return false;
    return true;
  })
  .sort();

// Remove duplicates
const uniqueWords = [...new Set(words)];

console.log(`Processed ${uniqueWords.length} words`);

// Generate TypeScript file
const output = `/**
 * Boggle word list - auto-generated from EOWL
 * Generated: ${new Date().toISOString()}
 * Word count: ${uniqueWords.length}
 */
export const BOGGLE_WORDS: string[] = ${JSON.stringify(uniqueWords, null, 2)};
`;

fs.writeFileSync(outputFile, output);
console.log(`Written to ${outputFile}`);
```

### 3.3 Boggle Types

**New file: `src/games/boggle/types.ts`**
```typescript
import type { Position } from '../types';

export interface BoggleBoard {
  grid: string[][];
  size: number;
}

export interface BoggleState {
  board: BoggleBoard;
  foundWords: string[];
  currentSelection: Position[];
  score: number;
  gameOver: boolean;
  message: string | null;
}
```

### 3.4 Boggle Store

**New file: `src/games/boggle/store.ts`**
```typescript
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { Position } from '../types';
import type { BoggleState, BoggleBoard } from './types';
import { generateBoard } from './board';
import { isValidPath, getWordFromPath } from './solver';
import { calculateWordScore } from './scoring';
import { isValidWord, loadDictionary } from './dictionary';

interface BoggleStore extends BoggleState {
  // Actions
  initGame: () => Promise<void>;
  submitWord: (positions: Position[]) => { success: boolean; message?: string };
  setSelection: (positions: Position[]) => void;
  endGame: () => void;
  resetGame: () => Promise<void>;

  // For multiplayer sync
  getState: () => BoggleState;
  setState: (state: BoggleState) => void;
}

const createInitialState = (): BoggleState => ({
  board: { grid: [], size: 0 },  // Populated after dictionary loads
  foundWords: [],
  currentSelection: [],
  score: 0,
  gameOver: false,
  message: null,
});

export const useBoggleStore = create<BoggleStore>()(
  subscribeWithSelector((set, get) => ({
    ...createInitialState(),

    initGame: async () => {
      await loadDictionary();
      set({
        ...createInitialState(),
        board: generateBoard(4, 4),
      });
    },

    submitWord: (positions: Position[]) => {
      const { board, foundWords, score, gameOver } = get();
      if (gameOver) return { success: false };

      // Validate path
      if (!isValidPath(positions)) {
        return { success: false, message: 'Invalid path' };
      }

      const word = getWordFromPath(positions, board).toUpperCase();

      // Validate word
      if (word.length < 3) {
        return { success: false, message: 'Too short' };
      }
      if (!isValidWord(word)) {
        return { success: false, message: 'Not a word' };
      }
      if (foundWords.includes(word)) {
        return { success: false, message: 'Already found' };
      }

      // Add word
      const wordScore = calculateWordScore(word);
      set({
        foundWords: [...foundWords, word],
        currentSelection: [],
        score: score + wordScore,
      });

      return { success: true };
    },

    setSelection: (positions: Position[]) => {
      set({ currentSelection: positions });
    },

    endGame: () => {
      const { score } = get();
      set({
        gameOver: true,
        message: `Time's up! Final score: ${score}`,
      });
    },

    resetGame: async () => {
      await loadDictionary();
      set({
        ...createInitialState(),
        board: generateBoard(4, 4),
      });
    },

    getState: () => {
      const { board, foundWords, currentSelection, score, gameOver, message } = get();
      return { board, foundWords, currentSelection, score, gameOver, message };
    },

    setState: (state: BoggleState) => set(state),
  }))
);

/**
 * Helper to extract word from path on board.
 */
export function getWordFromPath(positions: Position[], board: BoggleBoard): string {
  return positions.map(p => board.grid[p.row][p.col]).join('');
}
```

### 3.5 Boggle Board Generation

**New file: `src/games/boggle/board.ts`**
```typescript
import type { BoggleBoard } from './types';

// Classic Boggle dice (16 dice for 4x4 board)
const BOGGLE_DICE = [
  'AAEEGN', 'ABBJOO', 'ACHOPS', 'AFFKPS',
  'AOOTTW', 'CIMOTU', 'DEILRX', 'DELRVY',
  'DISTTY', 'EEGHNW', 'EEINSU', 'EHRTVW',
  'EIOSST', 'ELRTTY', 'HIMNQU', 'HLNNRZ',
];

export function generateBoard(rows: number, cols: number): BoggleBoard {
  const shuffledDice = [...BOGGLE_DICE].sort(() => Math.random() - 0.5);
  const grid: string[][] = [];

  let dieIndex = 0;
  for (let r = 0; r < rows; r++) {
    const row: string[] = [];
    for (let c = 0; c < cols; c++) {
      const die = shuffledDice[dieIndex++];
      const face = die[Math.floor(Math.random() * 6)];
      row.push(face === 'Q' ? 'Qu' : face);
    }
    grid.push(row);
  }

  return { grid, size: rows };
}
```

### 3.6 Boggle Path Validation & Solver

**New file: `src/games/boggle/solver.ts`**
```typescript
import type { BoggleBoard } from './types';
import type { Position } from '../types';
import { getTrie, isValidPrefix, type TrieNode } from './dictionary';

/**
 * Validate that a selection path is valid (all adjacent, no revisits).
 */
export function isValidPath(selection: Position[]): boolean {
  if (selection.length === 0) return false;

  const visited = new Set<string>();

  for (let i = 0; i < selection.length; i++) {
    const pos = selection[i];
    const key = `${pos.row},${pos.col}`;

    // Check for revisit
    if (visited.has(key)) return false;
    visited.add(key);

    // Check adjacency (skip first position)
    if (i > 0) {
      const prev = selection[i - 1];
      const rowDiff = Math.abs(prev.row - pos.row);
      const colDiff = Math.abs(prev.col - pos.col);

      // Must be adjacent (including diagonals) but not same position
      if (rowDiff > 1 || colDiff > 1 || (rowDiff === 0 && colDiff === 0)) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Find all valid words on the board using DFS with Trie pruning.
 *
 * Algorithm:
 * 1. Start DFS from each cell
 * 2. At each step, check if current prefix exists in Trie
 * 3. If prefix doesn't exist, prune this branch (no valid words possible)
 * 4. If prefix is a complete word (3+ letters), add to results
 * 5. Continue exploring adjacent unvisited cells
 *
 * Time complexity: O(N * 8^L) where N = cells, L = max word length
 * With Trie pruning, practical complexity is much lower.
 */
export function findAllWords(board: BoggleBoard): string[] {
  const trie = getTrie();
  const words = new Set<string>();
  const size = board.size;

  // Direction vectors for 8 adjacent cells
  const directions = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1],
  ];

  function dfs(
    row: number,
    col: number,
    node: TrieNode,
    path: string,
    visited: Set<string>
  ): void {
    const cell = board.grid[row][col];
    const key = `${row},${col}`;

    // Handle 'Qu' tile (counts as two letters)
    const chars = cell.toUpperCase();

    // Traverse Trie for each character in cell
    let currentNode: TrieNode | undefined = node;
    for (const char of chars) {
      currentNode = currentNode?.children.get(char);
      if (!currentNode) return; // Prefix not in dictionary, prune
    }

    const newPath = path + chars;

    // If this is a complete word (3+ letters), record it
    if (currentNode.isWord && newPath.length >= 3) {
      words.add(newPath);
    }

    // Mark current cell as visited
    visited.add(key);

    // Explore all 8 adjacent cells
    for (const [dr, dc] of directions) {
      const newRow = row + dr;
      const newCol = col + dc;
      const newKey = `${newRow},${newCol}`;

      // Bounds check and visited check
      if (
        newRow >= 0 && newRow < size &&
        newCol >= 0 && newCol < size &&
        !visited.has(newKey)
      ) {
        dfs(newRow, newCol, currentNode, newPath, visited);
      }
    }

    // Backtrack: unmark current cell
    visited.delete(key);
  }

  // Start DFS from every cell
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      dfs(row, col, trie, '', new Set());
    }
  }

  return Array.from(words).sort((a, b) => b.length - a.length || a.localeCompare(b));
}

/**
 * Calculate how many possible words remain unfound.
 * Useful for end-game statistics.
 */
export function getMissedWords(board: BoggleBoard, foundWords: string[]): string[] {
  const allWords = findAllWords(board);
  const foundSet = new Set(foundWords.map(w => w.toUpperCase()));
  return allWords.filter(word => !foundSet.has(word));
}
```

### 3.7 Boggle Scoring

**New file: `src/games/boggle/scoring.ts`**
```typescript
// Standard Boggle scoring
export function calculateWordScore(word: string): number {
  const length = word.length;
  if (length <= 2) return 0;
  if (length === 3 || length === 4) return 1;
  if (length === 5) return 2;
  if (length === 6) return 3;
  if (length === 7) return 5;
  return 11;  // 8+ letters
}
```

### 3.8 Boggle Touch/Drag Interaction

The Boggle board requires a different input model than Wordle's keyboard. Users select letters by dragging across adjacent tiles.

#### Interaction States

```
IDLE          → User not interacting
SELECTING     → User is dragging/touching to build a word
SUBMITTING    → Word submitted, showing validation feedback
```

#### Mouse Interaction

| Event | Action |
|-------|--------|
| `mousedown` on tile | Start selection, add tile to path |
| `mouseenter` on tile (while mouse down) | If adjacent to last tile and not visited, add to path |
| `mouseup` anywhere | Submit current selection |
| `mouseleave` from board (while selecting) | Cancel selection |

#### Touch Interaction

| Event | Action |
|-------|--------|
| `touchstart` on tile | Start selection, add tile to path |
| `touchmove` | Use `elementFromPoint()` to detect tile under finger |
| `touchend` | Submit current selection |
| `touchcancel` | Cancel selection |

**New file: `src/games/boggle/hooks/useGridSelection.ts`**
```typescript
import { useState, useCallback, useRef, useEffect } from 'react';
import type { Position } from '../../types';

interface UseGridSelectionOptions {
  gridSize: number;
  onSelectionComplete: (positions: Position[]) => void;
}

interface UseGridSelectionReturn {
  selection: Position[];
  isSelecting: boolean;
  handlers: {
    onMouseDown: (pos: Position) => void;
    onMouseEnter: (pos: Position) => void;
    onMouseUp: () => void;
    onTouchStart: (e: React.TouchEvent, pos: Position) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: () => void;
  };
  isSelected: (pos: Position) => boolean;
  getSelectionIndex: (pos: Position) => number;
}

export function useGridSelection({
  gridSize,
  onSelectionComplete,
}: UseGridSelectionOptions): UseGridSelectionReturn {
  const [selection, setSelection] = useState<Position[]>([]);
  const [isSelecting, setIsSelecting] = useState(false);
  const boardRef = useRef<HTMLElement | null>(null);

  // Check if position is already in selection
  const isSelected = useCallback(
    (pos: Position) => selection.some(p => p.row === pos.row && p.col === pos.col),
    [selection]
  );

  // Get index in selection (for visual feedback)
  const getSelectionIndex = useCallback(
    (pos: Position) => selection.findIndex(p => p.row === pos.row && p.col === pos.col),
    [selection]
  );

  // Check if two positions are adjacent (including diagonals)
  const isAdjacent = (a: Position, b: Position): boolean => {
    const rowDiff = Math.abs(a.row - b.row);
    const colDiff = Math.abs(a.col - b.col);
    return rowDiff <= 1 && colDiff <= 1 && !(rowDiff === 0 && colDiff === 0);
  };

  // Add position to selection if valid
  const addToSelection = useCallback((pos: Position) => {
    setSelection(prev => {
      if (prev.length === 0) return [pos];

      const lastPos = prev[prev.length - 1];

      // Already selected - ignore
      if (prev.some(p => p.row === pos.row && p.col === pos.col)) {
        return prev;
      }

      // Not adjacent - ignore
      if (!isAdjacent(lastPos, pos)) {
        return prev;
      }

      return [...prev, pos];
    });
  }, []);

  // Mouse handlers
  const onMouseDown = useCallback((pos: Position) => {
    setIsSelecting(true);
    setSelection([pos]);
  }, []);

  const onMouseEnter = useCallback((pos: Position) => {
    if (isSelecting) {
      addToSelection(pos);
    }
  }, [isSelecting, addToSelection]);

  const onMouseUp = useCallback(() => {
    if (isSelecting && selection.length > 0) {
      onSelectionComplete(selection);
    }
    setIsSelecting(false);
    setSelection([]);
  }, [isSelecting, selection, onSelectionComplete]);

  // Touch handlers
  const onTouchStart = useCallback((e: React.TouchEvent, pos: Position) => {
    e.preventDefault(); // Prevent scrolling
    setIsSelecting(true);
    setSelection([pos]);
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isSelecting) return;
    e.preventDefault();

    const touch = e.touches[0];
    const element = document.elementFromPoint(touch.clientX, touch.clientY);

    // Find tile from element (data attribute)
    const row = element?.getAttribute('data-row');
    const col = element?.getAttribute('data-col');

    if (row !== null && col !== null) {
      addToSelection({ row: parseInt(row, 10), col: parseInt(col, 10) });
    }
  }, [isSelecting, addToSelection]);

  const onTouchEnd = useCallback(() => {
    if (isSelecting && selection.length > 0) {
      onSelectionComplete(selection);
    }
    setIsSelecting(false);
    setSelection([]);
  }, [isSelecting, selection, onSelectionComplete]);

  // Cancel on mouse leave from window
  useEffect(() => {
    const handleMouseUp = () => {
      if (isSelecting) {
        onMouseUp();
      }
    };
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [isSelecting, onMouseUp]);

  return {
    selection,
    isSelecting,
    handlers: {
      onMouseDown,
      onMouseEnter,
      onMouseUp,
      onTouchStart,
      onTouchMove,
      onTouchEnd,
    },
    isSelected,
    getSelectionIndex,
  };
}
```

#### Visual Feedback

```css
/* Tile states */
.boggle-tile {
  transition: transform 0.1s, background-color 0.1s;
  user-select: none;
  touch-action: none; /* Prevent browser gestures */
}

.boggle-tile--selected {
  background-color: var(--tile-selected);
  transform: scale(1.1);
}

.boggle-tile--selecting {
  cursor: grabbing;
}

/* Draw line connecting selected tiles */
.selection-path {
  position: absolute;
  pointer-events: none;
  stroke: var(--selection-line);
  stroke-width: 4;
  stroke-linecap: round;
}
```

#### BoggleBoard Component

**New file: `src/games/boggle/components/BoggleBoard.tsx`**
```typescript
import { memo } from 'react';
import type { Position } from '../../types';
import type { BoggleBoard as BoardType } from '../types';
import { useGridSelection } from '../hooks/useGridSelection';
import { BoggleTile } from './BoggleTile';
import './BoggleBoard.css';

interface BoggleBoardProps {
  board: BoardType;
  onWordSubmit: (positions: Position[]) => void;
}

export const BoggleBoard = memo(function BoggleBoard({
  board,
  onWordSubmit,
}: BoggleBoardProps) {
  const {
    selection,
    isSelecting,
    handlers,
    isSelected,
    getSelectionIndex,
  } = useGridSelection({
    gridSize: board.size,
    onSelectionComplete: onWordSubmit,
  });

  // Build current word from selection
  const currentWord = selection
    .map((pos) => board.grid[pos.row][pos.col])
    .join('');

  return (
    <div className="boggle-board-container">
      {/* Current word preview */}
      {selection.length > 0 && (
        <div className="current-word" aria-live="polite">
          {currentWord}
        </div>
      )}

      <div
        className={`boggle-board ${isSelecting ? 'boggle-board--selecting' : ''}`}
        role="application"
        aria-label="Boggle game board"
      >
        {board.grid.map((row, r) => (
          <div key={r} className="boggle-row" role="row">
            {row.map((letter, c) => {
              const pos = { row: r, col: c };
              const selected = isSelected(pos);
              const selectionIndex = getSelectionIndex(pos);

              return (
                <BoggleTile
                  key={c}
                  letter={letter}
                  position={pos}
                  selected={selected}
                  selectionIndex={selectionIndex}
                  handlers={handlers}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
});
```

**New file: `src/games/boggle/components/BoggleTile.tsx`**
```typescript
import { memo } from 'react';
import type { Position } from '../../types';

interface BoggleTileProps {
  letter: string;
  position: Position;
  selected: boolean;
  selectionIndex: number;
  handlers: {
    onMouseDown: (pos: Position) => void;
    onMouseEnter: (pos: Position) => void;
    onTouchStart: (e: React.TouchEvent, pos: Position) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: () => void;
  };
}

export const BoggleTile = memo(function BoggleTile({
  letter,
  position,
  selected,
  selectionIndex,
  handlers,
}: BoggleTileProps) {
  return (
    <div
      className={`boggle-tile ${selected ? 'boggle-tile--selected' : ''}`}
      role="gridcell"
      aria-label={`${letter}, row ${position.row + 1}, column ${position.col + 1}`}
      aria-selected={selected}
      data-row={position.row}
      data-col={position.col}
      onMouseDown={() => handlers.onMouseDown(position)}
      onMouseEnter={() => handlers.onMouseEnter(position)}
      onTouchStart={(e) => handlers.onTouchStart(e, position)}
      onTouchMove={handlers.onTouchMove}
      onTouchEnd={handlers.onTouchEnd}
    >
      <span className="boggle-tile__letter">{letter}</span>
      {selected && selectionIndex >= 0 && (
        <span className="boggle-tile__index">{selectionIndex + 1}</span>
      )}
    </div>
  );
});
```

### 3.9 Boggle Accessibility

Boggle's drag-to-select interaction is inherently inaccessible to keyboard and screen reader users. We provide an alternative input mode as an accessibility option.

#### Accessibility Setting

Keyboard input mode is **off by default** to keep the UI clean for mouse/touch users. Users enable it via:

1. **Settings menu** - Toggle "Keyboard Input Mode"
2. **Keyboard shortcut** - Press `Tab` to focus the hidden input, which auto-enables keyboard mode
3. **Screen reader detection** - Auto-enable if `prefers-reduced-motion` or screen reader detected

**Store the preference in `uiStore`:**
```typescript
interface UIState {
  // ... existing fields
  accessibilityMode: boolean;  // Persisted to localStorage
}
```

#### Input Modes

| Mode | Default | For | UI |
|------|---------|-----|-----|
| **Drag Mode** | Yes | Mouse/touch users | Grid only |
| **Keyboard Mode** | No (opt-in) | Keyboard/screen reader | Grid + text input |

#### Enabling Keyboard Mode

**Settings toggle:**
```tsx
<div className="settings-section">
  <label htmlFor="keyboard-mode">
    <input
      id="keyboard-mode"
      type="checkbox"
      checked={accessibilityMode}
      onChange={(e) => setAccessibilityMode(e.target.checked)}
    />
    Enable keyboard input (accessibility)
  </label>
  <p className="settings-hint">
    Type words instead of dragging. Recommended for keyboard or screen reader users.
  </p>
</div>
```

**Auto-detect screen reader (heuristic):**
```typescript
// In BoggleGame.tsx or a hook
useEffect(() => {
  // Check for reduced motion preference (common with screen readers)
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Check if user is navigating with keyboard (Tab key usage)
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Tab' && !accessibilityMode) {
      setAccessibilityMode(true);
    }
  };

  if (prefersReducedMotion) {
    setAccessibilityMode(true);
  }

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [accessibilityMode, setAccessibilityMode]);
```

#### Conditional Rendering

```tsx
function BoggleGame() {
  const accessibilityMode = useUIStore((s) => s.accessibilityMode);

  return (
    <GameLayout gameId="boggle" gameName="Boggle">
      <Timer />
      <BoggleBoard {...gridSelectionHandlers} />

      {/* Only show when accessibility mode enabled */}
      {accessibilityMode && (
        <KeyboardInput
          board={board}
          onSubmit={handleWordSubmit}
          foundWords={foundWords}
        />
      )}

      <WordList words={foundWords} />
      <Score score={score} />
    </GameLayout>
  );
}
```

#### Keyboard Mode Implementation

1. User types letters in an input field
2. As they type, system highlights valid paths on the board
3. If multiple paths exist, show disambiguation
4. Press Enter to submit

**New file: `src/games/boggle/components/KeyboardInput.tsx`**
```typescript
import { useState, useEffect } from 'react';
import type { Position } from '../../types';
import type { BoggleBoard } from '../types';
import { findWordPaths } from '../solver';

interface KeyboardInputProps {
  board: BoggleBoard;
  onSubmit: (positions: Position[]) => void;
  foundWords: string[];
}

export function KeyboardInput({ board, onSubmit, foundWords }: KeyboardInputProps) {
  const [input, setInput] = useState('');
  const [paths, setPaths] = useState<Position[][]>([]);
  const [selectedPathIndex, setSelectedPathIndex] = useState(0);

  // Find all valid paths for the typed word
  useEffect(() => {
    if (input.length >= 3) {
      const validPaths = findWordPaths(input.toUpperCase(), board);
      setPaths(validPaths);
      setSelectedPathIndex(0);
    } else {
      setPaths([]);
    }
  }, [input, board]);

  const handleSubmit = () => {
    if (paths.length > 0) {
      onSubmit(paths[selectedPathIndex]);
      setInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      // Cycle through paths if multiple exist
      if (paths.length > 1) {
        e.preventDefault();
        setSelectedPathIndex(prev =>
          e.key === 'ArrowUp'
            ? (prev - 1 + paths.length) % paths.length
            : (prev + 1) % paths.length
        );
      }
    }
  };

  const alreadyFound = foundWords.includes(input.toUpperCase());
  const noValidPath = input.length >= 3 && paths.length === 0;

  return (
    <div className="keyboard-input" role="search">
      <label htmlFor="word-input" className="sr-only">
        Type a word you see on the board
      </label>
      <input
        id="word-input"
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value.toUpperCase())}
        onKeyDown={handleKeyDown}
        placeholder="Type word..."
        aria-describedby="input-status"
        aria-invalid={noValidPath || alreadyFound}
        autoComplete="off"
        autoCapitalize="characters"
      />
      <div id="input-status" aria-live="polite">
        {alreadyFound && 'Already found'}
        {noValidPath && 'Word not on board'}
        {paths.length > 1 && `${paths.length} paths found. Use arrows to select.`}
      </div>
      <button
        onClick={handleSubmit}
        disabled={paths.length === 0 || alreadyFound}
      >
        Submit
      </button>
    </div>
  );
}
```

#### Screen Reader Announcements

```typescript
// Announce board state on game start
const boardDescription = `4 by 4 Boggle board.
  Row 1: ${board.grid[0].join(', ')}.
  Row 2: ${board.grid[1].join(', ')}.
  Row 3: ${board.grid[2].join(', ')}.
  Row 4: ${board.grid[3].join(', ')}.`;

// Announce found words
const foundAnnouncement = `Found ${word} for ${points} points.
  Total score: ${score}. ${foundWords.length} words found.`;

// Announce timer
const timerAnnouncement = timeRemaining <= 30
  ? `${timeRemaining} seconds remaining`
  : null; // Only announce when low
```

#### ARIA Attributes

```tsx
<div
  className="boggle-board"
  role="application"
  aria-label="Boggle game board"
  aria-describedby="board-instructions"
>
  <div id="board-instructions" className="sr-only">
    Drag across adjacent letters to form words, or use the text input below.
    Words must be at least 3 letters. Each letter can only be used once per word.
  </div>

  {board.grid.map((row, r) => (
    <div key={r} role="row">
      {row.map((letter, c) => (
        <div
          key={c}
          role="gridcell"
          aria-label={`${letter}, row ${r + 1}, column ${c + 1}`}
          aria-selected={isSelected({ row: r, col: c })}
          data-row={r}
          data-col={c}
        >
          {letter}
        </div>
      ))}
    </div>
  ))}
</div>

{/* Keyboard input shown only when accessibility mode enabled */}
{accessibilityMode && (
  <KeyboardInput board={board} onSubmit={handleSubmit} foundWords={foundWords} />
)}
```

#### Path Finding for Keyboard Mode

**Add to `src/games/boggle/solver.ts`:**
```typescript
/**
 * Find all valid paths that spell a given word on the board.
 * Used for keyboard input mode to validate and highlight.
 */
export function findWordPaths(word: string, board: BoggleBoard): Position[][] {
  const paths: Position[][] = [];
  const size = board.size;
  const target = word.toUpperCase();

  const directions = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1],
  ];

  function dfs(
    row: number,
    col: number,
    index: number,
    path: Position[],
    visited: Set<string>
  ): void {
    // Handle 'Qu' tile
    const cell = board.grid[row][col].toUpperCase();
    const cellLen = cell.length;

    // Check if cell matches next character(s) in target
    if (target.substring(index, index + cellLen) !== cell) {
      return;
    }

    const newIndex = index + cellLen;
    const newPath = [...path, { row, col }];
    const key = `${row},${col}`;

    // Found complete word
    if (newIndex === target.length) {
      paths.push(newPath);
      return;
    }

    visited.add(key);

    // Explore adjacent cells
    for (const [dr, dc] of directions) {
      const newRow = row + dr;
      const newCol = col + dc;
      const newKey = `${newRow},${newCol}`;

      if (
        newRow >= 0 && newRow < size &&
        newCol >= 0 && newCol < size &&
        !visited.has(newKey)
      ) {
        dfs(newRow, newCol, newIndex, newPath, visited);
      }
    }

    visited.delete(key);
  }

  // Start from each cell that matches first character(s)
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      dfs(r, c, 0, [], new Set());
    }
  }

  return paths;
}
```

### 3.10 BoggleGame Component

Main component for Boggle, used as default export for lazy loading.

**New file: `src/games/boggle/BoggleGame.tsx`**
```typescript
import { useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useBoggleStore } from './store';
import { useTimerStore } from '../../stores/timerStore';
import { useMultiplayerStore } from '../../stores';
import { useStatsStore } from '../../stores/statsStore';
import { useUIStore } from '../../stores/uiStore';
import { GameLayout } from '../../components/GameLayout/GameLayout';
import { BoggleBoard } from './components/BoggleBoard';
import { WordList } from './components/WordList';
import { Timer } from './components/Timer';
import { KeyboardInput } from './components/KeyboardInput';
import type { Position } from '../types';
import './components/BoggleGame.css';

const GAME_DURATION = 180; // 3 minutes

export default function BoggleGame() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Game state
  const {
    board,
    foundWords,
    score,
    gameOver,
    message,
    initGame,
    submitWord,
    endGame,
    getState,
    setState,
  } = useBoggleStore();

  // Timer state
  const timeRemaining = useTimerStore((s) => s.timeRemaining);
  const isRunning = useTimerStore((s) => s.isRunning);
  const startTimer = useTimerStore((s) => s.start);
  const resetTimer = useTimerStore((s) => s.reset);

  // Multiplayer state
  const role = useMultiplayerStore((s) => s.role);
  const sessionCode = useMultiplayerStore((s) => s.sessionCode);
  const partnerConnected = useMultiplayerStore((s) => s.partnerConnected);

  // UI state
  const accessibilityMode = useUIStore((s) => s.accessibilityMode);

  // Stats
  const recordGame = useStatsStore((s) => s.recordGame);

  // Initialize game on mount
  useEffect(() => {
    const init = async () => {
      await initGame();
      startTimer(GAME_DURATION);
    };
    init();

    // Check for join code in URL
    const joinCode = searchParams.get('join');
    if (joinCode) {
      // Handle multiplayer join
    }

    // Cleanup timer on unmount
    return () => {
      resetTimer(0);
    };
  }, [initGame, startTimer, resetTimer, searchParams]);

  // End game when timer expires
  useEffect(() => {
    if (timeRemaining === 0 && !isRunning && board.size > 0 && !gameOver) {
      endGame();
    }
  }, [timeRemaining, isRunning, board.size, gameOver, endGame]);

  // Record stats when game ends
  useEffect(() => {
    if (gameOver) {
      recordGame('boggle', {
        won: score > 0,
        score,
      });
    }
  }, [gameOver, score, recordGame]);

  // Handle word submission from drag selection
  const handleWordSubmit = useCallback(
    (positions: Position[]) => {
      if (gameOver) return;
      if (role === 'viewer') return;

      const result = submitWord(positions);
      // Could show feedback based on result.message
    },
    [gameOver, role, submitWord]
  );

  const handleBack = () => {
    resetTimer(0);
    navigate('/');
  };

  // Show loading state while dictionary loads
  if (board.size === 0) {
    return (
      <GameLayout gameId="boggle" gameName="Boggle" onBack={handleBack}>
        <div className="loading">Loading dictionary...</div>
      </GameLayout>
    );
  }

  return (
    <GameLayout gameId="boggle" gameName="Boggle" onBack={handleBack}>
      <Timer timeRemaining={timeRemaining} />

      {message && <div className="game-message">{message}</div>}

      <div className="boggle-content">
        <BoggleBoard board={board} onWordSubmit={handleWordSubmit} />

        {accessibilityMode && (
          <KeyboardInput
            board={board}
            onSubmit={handleWordSubmit}
            foundWords={foundWords}
          />
        )}

        <div className="boggle-sidebar">
          <div className="score-display">
            Score: <strong>{score}</strong>
          </div>
          <WordList words={foundWords} />
        </div>
      </div>

      {sessionCode && (
        <div className="multiplayer-status">
          {partnerConnected ? 'Partner connected' : 'Waiting for partner...'}
        </div>
      )}
    </GameLayout>
  );
}
```

### 3.11 WordList Component

Displays found words with scores.

**New file: `src/games/boggle/components/WordList.tsx`**
```typescript
import { memo } from 'react';
import { calculateWordScore } from '../scoring';

interface WordListProps {
  words: string[];
}

export const WordList = memo(function WordList({ words }: WordListProps) {
  if (words.length === 0) {
    return (
      <div className="word-list word-list--empty">
        <p>No words found yet</p>
        <p className="hint">Drag across letters to form words</p>
      </div>
    );
  }

  // Sort by score (length), then alphabetically
  const sortedWords = [...words].sort((a, b) => {
    const scoreDiff = calculateWordScore(b) - calculateWordScore(a);
    return scoreDiff !== 0 ? scoreDiff : a.localeCompare(b);
  });

  return (
    <div className="word-list" role="list" aria-label="Found words">
      <h3 className="word-list__title">
        Found: {words.length} word{words.length !== 1 ? 's' : ''}
      </h3>
      <ul className="word-list__items">
        {sortedWords.map((word) => (
          <li key={word} className="word-list__item">
            <span className="word-list__word">{word}</span>
            <span className="word-list__score">+{calculateWordScore(word)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
});
```

### 3.12 Timer Component

Visual timer display that uses the shared timer store.

**New file: `src/games/boggle/components/Timer.tsx`**
```typescript
import { memo } from 'react';

interface TimerProps {
  timeRemaining: number;
}

export const Timer = memo(function Timer({ timeRemaining }: TimerProps) {
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const isLow = timeRemaining <= 30;

  return (
    <div
      className={`timer ${isLow ? 'timer--low' : ''}`}
      role="timer"
      aria-live={isLow ? 'assertive' : 'polite'}
      aria-label={`${minutes} minutes ${seconds} seconds remaining`}
    >
      <span className="timer__display">
        {minutes}:{seconds.toString().padStart(2, '0')}
      </span>
      {isLow && <span className="timer__warning">Time running out!</span>}
    </div>
  );
});
```

### 3.13 Boggle Styles

**New file: `src/games/boggle/components/BoggleGame.css`**
```css
.boggle-game {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
}

.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  font-size: 1.1rem;
  color: var(--text-secondary);
}

.boggle-content {
  display: flex;
  gap: 2rem;
  width: 100%;
  max-width: 800px;
  justify-content: center;
}

@media (max-width: 768px) {
  .boggle-content {
    flex-direction: column;
    align-items: center;
  }
}

.boggle-sidebar {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-width: 200px;
}

.score-display {
  font-size: 1.5rem;
  text-align: center;
  padding: 0.5rem 1rem;
  background: var(--tile-bg);
  border-radius: 8px;
}

.score-display strong {
  color: var(--correct);
}

/* Timer styles */
.timer {
  font-size: 2rem;
  font-weight: bold;
  font-variant-numeric: tabular-nums;
  padding: 0.5rem 1rem;
  background: var(--tile-bg);
  border-radius: 8px;
  text-align: center;
}

.timer--low {
  color: #dc2626;
  animation: pulse 1s infinite;
}

.timer__warning {
  display: block;
  font-size: 0.75rem;
  font-weight: normal;
  color: #dc2626;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

/* Word list styles */
.word-list {
  background: var(--tile-bg);
  border-radius: 8px;
  padding: 1rem;
  max-height: 300px;
  overflow-y: auto;
}

.word-list--empty {
  text-align: center;
  color: var(--text-secondary);
}

.word-list--empty .hint {
  font-size: 0.85rem;
  margin-top: 0.5rem;
}

.word-list__title {
  font-size: 0.9rem;
  margin-bottom: 0.75rem;
  color: var(--text-secondary);
}

.word-list__items {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.word-list__item {
  display: flex;
  justify-content: space-between;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  background: var(--bg);
}

.word-list__word {
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.word-list__score {
  color: var(--correct);
  font-weight: bold;
}

/* Boggle board styles */
.boggle-board-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.current-word {
  font-size: 1.5rem;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  min-height: 2rem;
  padding: 0.25rem 1rem;
  background: var(--present);
  color: white;
  border-radius: 4px;
}

.boggle-board {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
  padding: 8px;
  background: var(--tile-border);
  border-radius: 8px;
}

.boggle-board--selecting {
  cursor: grabbing;
}

.boggle-row {
  display: contents;
}

.boggle-tile {
  width: 70px;
  height: 70px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--tile-bg);
  border-radius: 8px;
  font-size: 1.75rem;
  font-weight: bold;
  text-transform: uppercase;
  cursor: pointer;
  user-select: none;
  touch-action: none;
  position: relative;
  transition: transform 0.1s, background-color 0.1s;
}

.boggle-tile:hover {
  background: var(--tile-hover, #e5e5e5);
}

.boggle-tile--selected {
  background: var(--present);
  color: white;
  transform: scale(1.05);
}

.boggle-tile__letter {
  pointer-events: none;
}

.boggle-tile__index {
  position: absolute;
  top: 4px;
  right: 6px;
  font-size: 0.65rem;
  opacity: 0.7;
  pointer-events: none;
}

/* Accessibility keyboard input */
.keyboard-input {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem;
  background: var(--tile-bg);
  border-radius: 8px;
  width: 100%;
  max-width: 300px;
}

.keyboard-input input {
  padding: 0.75rem;
  font-size: 1.25rem;
  text-transform: uppercase;
  text-align: center;
  border: 2px solid var(--tile-border);
  border-radius: 8px;
  letter-spacing: 0.1em;
}

.keyboard-input input:focus {
  outline: none;
  border-color: var(--present);
}

.keyboard-input input[aria-invalid="true"] {
  border-color: #dc2626;
}

#input-status {
  font-size: 0.85rem;
  text-align: center;
  min-height: 1.2em;
  color: var(--text-secondary);
}

.keyboard-input button {
  padding: 0.75rem;
  background: var(--correct);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: bold;
  cursor: pointer;
}

.keyboard-input button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Responsive sizing */
@media (max-width: 500px) {
  .boggle-tile {
    width: 60px;
    height: 60px;
    font-size: 1.5rem;
  }

  .boggle-content {
    gap: 1rem;
  }

  .boggle-sidebar {
    min-width: 100%;
  }
}
```

---

## Phase 4: Dashboard Component

### 4.1 Dashboard Page

**New file: `src/features/dashboard/Dashboard.tsx`**
```typescript
import { Link } from 'react-router-dom';
import { getAllGames } from '../../games/registry';
import { ThemeToggle } from '../../components/ThemeToggle';
import './Dashboard.css';

export function Dashboard() {
  const games = getAllGames();

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Game Hub</h1>
        <ThemeToggle />
      </header>

      <main className="game-grid">
        {games.map(game => (
          <Link
            key={game.id}
            to={game.route}
            className="game-card"
          >
            <span className="game-icon">{game.icon}</span>
            <h2 className="game-name">{game.name}</h2>
            <p className="game-description">{game.description}</p>
            {game.supportsMultiplayer && (
              <span className="multiplayer-badge">Multiplayer</span>
            )}
          </Link>
        ))}
      </main>

      <footer className="dashboard-footer">
        <button onClick={() => /* open stats modal */}>
          View Statistics
        </button>
      </footer>
    </div>
  );
}
```

### 4.2 Dashboard Styles

**New file: `src/features/dashboard/Dashboard.css`**
```css
.dashboard {
  min-height: 100vh;
  padding: 2rem;
  display: flex;
  flex-direction: column;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.game-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
  flex: 1;
}

.game-card {
  background: var(--tile-bg);
  border: 2px solid var(--tile-border);
  border-radius: 12px;
  padding: 2rem;
  text-decoration: none;
  color: inherit;
  transition: transform 0.2s, box-shadow 0.2s;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.game-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}

.game-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.game-name {
  font-size: 1.5rem;
  margin-bottom: 0.5rem;
}

.game-description {
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.multiplayer-badge {
  margin-top: 1rem;
  padding: 0.25rem 0.75rem;
  background: var(--correct);
  color: white;
  border-radius: 12px;
  font-size: 0.8rem;
}
```

### 4.3 Game-Agnostic Lobby

The lobby handles multiplayer setup before entering a game. It's game-agnostic and receives the game ID as a prop.

**New file: `src/features/lobby/Lobby.tsx`**
```typescript
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMultiplayerStore } from '../../stores';
import type { GameId } from '../../games/types';
import { getGameMetadata } from '../../games/registry';
import './Lobby.css';

interface LobbyProps {
  gameId: GameId;
  onStartGame: () => void;
}

export function Lobby({ gameId, onStartGame }: LobbyProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [joinCode, setJoinCode] = useState('');
  const [pin, setPin] = useState('');
  const [showPinInput, setShowPinInput] = useState(false);

  const gameMeta = getGameMetadata(gameId);

  // Multiplayer state
  const {
    role,
    sessionCode,
    connectionStatus,
    partnerConnected,
    error,
    hostGame,
    joinGame,
    leaveSession,
  } = useMultiplayerStore();

  // Check for join code in URL
  useEffect(() => {
    const code = searchParams.get('join');
    if (code) {
      setJoinCode(code);
      // Could auto-join here
    }
  }, [searchParams]);

  // Start game when partner connects (for host)
  useEffect(() => {
    if (role === 'host' && partnerConnected) {
      onStartGame();
    }
  }, [role, partnerConnected, onStartGame]);

  // Start game immediately when joining successfully
  useEffect(() => {
    if (role === 'viewer' && connectionStatus === 'connected') {
      onStartGame();
    }
  }, [role, connectionStatus, onStartGame]);

  const handleHost = useCallback(() => {
    hostGame(gameId, pin || undefined);
  }, [hostGame, gameId, pin]);

  const handleJoin = useCallback(() => {
    if (!joinCode.trim()) return;
    joinGame(gameId, joinCode.trim(), pin || undefined);
  }, [joinGame, gameId, joinCode, pin]);

  const handleBack = () => {
    leaveSession();
    navigate('/');
  };

  const handlePlaySolo = () => {
    onStartGame();
  };

  // Waiting for partner (host view)
  if (role === 'host' && sessionCode) {
    const shareUrl = `${window.location.origin}${window.location.pathname}#/${gameId}?join=${sessionCode}`;

    return (
      <div className="lobby lobby--waiting">
        <h2>Waiting for Partner</h2>
        <p>Share this code with a friend:</p>
        <div className="session-code">{sessionCode}</div>
        <button
          className="copy-button"
          onClick={() => navigator.clipboard.writeText(shareUrl)}
        >
          Copy Link
        </button>
        <p className="status">{connectionStatus}</p>
        <button className="cancel-button" onClick={handleBack}>
          Cancel
        </button>
      </div>
    );
  }

  // Connecting (viewer view)
  if (role === 'viewer' && connectionStatus === 'connecting') {
    return (
      <div className="lobby lobby--connecting">
        <h2>Connecting...</h2>
        <p className="status">{connectionStatus}</p>
        <button className="cancel-button" onClick={handleBack}>
          Cancel
        </button>
      </div>
    );
  }

  // Main lobby view
  return (
    <div className="lobby">
      <button className="back-button" onClick={handleBack}>
        ← Back
      </button>

      <h1>{gameMeta?.name ?? gameId}</h1>
      <p className="game-description">{gameMeta?.description}</p>

      {error && <div className="error-message">{error}</div>}

      <div className="lobby-options">
        <section className="lobby-section">
          <h2>Play Solo</h2>
          <button className="primary-button" onClick={handlePlaySolo}>
            Start Game
          </button>
        </section>

        <div className="divider">or</div>

        <section className="lobby-section">
          <h2>Play with a Friend</h2>

          <div className="multiplayer-options">
            <div className="option-group">
              <h3>Host a Game</h3>
              <button className="secondary-button" onClick={handleHost}>
                Create Session
              </button>
            </div>

            <div className="option-group">
              <h3>Join a Game</h3>
              <input
                type="text"
                placeholder="Enter session code"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                maxLength={20}
              />
              <button
                className="secondary-button"
                onClick={handleJoin}
                disabled={!joinCode.trim()}
              >
                Join Session
              </button>
            </div>
          </div>

          <button
            className="toggle-pin"
            onClick={() => setShowPinInput(!showPinInput)}
          >
            {showPinInput ? 'Hide PIN options' : 'Add PIN protection (optional)'}
          </button>

          {showPinInput && (
            <input
              type="password"
              placeholder="Optional PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              maxLength={6}
            />
          )}
        </section>
      </div>
    </div>
  );
}
```

**New file: `src/features/lobby/Lobby.css`**
```css
.lobby {
  max-width: 500px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
}

.lobby h1 {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.game-description {
  color: var(--text-secondary);
  margin-bottom: 2rem;
}

.lobby-options {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.lobby-section {
  background: var(--tile-bg);
  border: 1px solid var(--tile-border);
  border-radius: 12px;
  padding: 1.5rem;
}

.lobby-section h2 {
  font-size: 1.2rem;
  margin-bottom: 1rem;
}

.multiplayer-options {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}

.option-group {
  flex: 1;
  min-width: 150px;
}

.option-group h3 {
  font-size: 0.9rem;
  margin-bottom: 0.5rem;
  color: var(--text-secondary);
}

.divider {
  color: var(--text-secondary);
  font-style: italic;
}

.session-code {
  font-size: 2rem;
  font-family: monospace;
  background: var(--tile-bg);
  padding: 1rem 2rem;
  border-radius: 8px;
  margin: 1rem 0;
  letter-spacing: 0.2em;
}

.primary-button {
  background: var(--correct);
  color: white;
  border: none;
  padding: 1rem 2rem;
  border-radius: 8px;
  font-size: 1.1rem;
  cursor: pointer;
  width: 100%;
}

.secondary-button {
  background: var(--tile-bg);
  border: 2px solid var(--tile-border);
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  cursor: pointer;
  width: 100%;
  margin-top: 0.5rem;
}

.secondary-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.lobby input[type="text"],
.lobby input[type="password"] {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid var(--tile-border);
  border-radius: 8px;
  font-size: 1rem;
  text-align: center;
}

.toggle-pin {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 0.85rem;
  margin-top: 1rem;
}

.error-message {
  background: #fee;
  color: #c00;
  padding: 0.75rem;
  border-radius: 8px;
  margin-bottom: 1rem;
}

.status {
  color: var(--text-secondary);
  font-size: 0.9rem;
  margin: 1rem 0;
}

.cancel-button {
  background: none;
  border: 2px solid var(--tile-border);
  padding: 0.5rem 1rem;
  border-radius: 8px;
  cursor: pointer;
}

.copy-button {
  background: var(--present);
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  cursor: pointer;
}
```

---

## Phase 5: Shared Infrastructure Stores

Each game has its own store (defined in Phase 2 and 3). This phase covers shared infrastructure stores that games can use.

### 5.1 Architecture Note

**No generic factories.** Each game defines:
- Its own types (`types.ts`)
- Its own store (`store.ts`)
- Its own components

Games share:
- Timer store (for timed games)
- Stats store (per-game statistics)
- Multiplayer store (PeerJS connection management)
- UI store (theme, accessibility settings)

This keeps each game fully typed with no interface gymnastics.

### 5.2 Timer Store

Shared timer for any time-limited game. Boggle uses this; Wordle doesn't.

**New file: `src/stores/timerStore.ts`**
```typescript
import { create } from 'zustand';

interface TimerState {
  timeRemaining: number;
  isRunning: boolean;
  intervalId: number | null;

  start: (duration: number) => void;
  pause: () => void;
  resume: () => void;
  reset: (duration: number) => void;
  tick: () => void;
}

export const useTimerStore = create<TimerState>((set, get) => ({
  timeRemaining: 0,
  isRunning: false,
  intervalId: null,

  start: (duration: number) => {
    const { intervalId } = get();
    if (intervalId) clearInterval(intervalId);

    const id = window.setInterval(() => {
      get().tick();
    }, 1000);

    set({ timeRemaining: duration, isRunning: true, intervalId: id });
  },

  pause: () => {
    const { intervalId } = get();
    if (intervalId) {
      clearInterval(intervalId);
      set({ isRunning: false, intervalId: null });
    }
  },

  resume: () => {
    const { isRunning, timeRemaining } = get();
    if (!isRunning && timeRemaining > 0) {
      const id = window.setInterval(() => {
        get().tick();
      }, 1000);
      set({ isRunning: true, intervalId: id });
    }
  },

  reset: (duration: number) => {
    const { intervalId } = get();
    if (intervalId) clearInterval(intervalId);
    set({ timeRemaining: duration, isRunning: false, intervalId: null });
  },

  tick: () => {
    const { timeRemaining, intervalId } = get();
    if (timeRemaining <= 1) {
      if (intervalId) clearInterval(intervalId);
      set({ timeRemaining: 0, isRunning: false, intervalId: null });
    } else {
      set({ timeRemaining: timeRemaining - 1 });
    }
  },
}));

// Pause timer when tab loses focus (fairness in multiplayer)
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    const { isRunning, pause, resume } = useTimerStore.getState();
    if (document.hidden && isRunning) {
      pause();
    }
  });
}
```

**Timer Integration with Boggle:**

The timer store is the single source of truth for time. Boggle subscribes to it:

```typescript
// In BoggleGame.tsx
import { useTimerStore } from '../../stores/timerStore';
import { useBoggleStore } from './store';

export default function BoggleGame() {
  const timeRemaining = useTimerStore((s) => s.timeRemaining);
  const isRunning = useTimerStore((s) => s.isRunning);
  const startTimer = useTimerStore((s) => s.start);
  const endGame = useBoggleStore((s) => s.endGame);

  // Start timer when game initializes
  useEffect(() => {
    startTimer(180); // 3 minutes
  }, [startTimer]);

  // End game when timer expires
  useEffect(() => {
    if (timeRemaining === 0 && !isRunning) {
      endGame();
    }
  }, [timeRemaining, isRunning, endGame]);

  return (/* ... */);
}
```

### 5.3 Statistics Store Update

Extend statistics to support multiple games with migration.

**Modified: `src/stores/statsStore.ts`**
```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GameId } from '../games/types';

interface GameStatistics {
  gamesPlayed: number;
  gamesWon: number;
  currentStreak: number;
  maxStreak: number;
  lastPlayedDate: string | null;
  // Game-specific stats
  guessDistribution?: number[];  // Wordle: wins by guess count
  highScore?: number;            // Boggle: best score
  averageScore?: number;         // Boggle: running average
  totalScore?: number;           // Boggle: for calculating average
}

interface StatsState {
  stats: Record<GameId, GameStatistics>;
  version: number;  // For migrations

  getStats: (gameId: GameId) => GameStatistics;
  recordGame: (gameId: GameId, result: GameResult) => void;
}

interface GameResult {
  won: boolean;
  score?: number;
  guessCount?: number;  // For Wordle
}

const DEFAULT_STATS: GameStatistics = {
  gamesPlayed: 0,
  gamesWon: 0,
  currentStreak: 0,
  maxStreak: 0,
  lastPlayedDate: null,
};

export const useStatsStore = create<StatsState>()(
  persist(
    (set, get) => ({
      stats: {
        wordle: { ...DEFAULT_STATS, guessDistribution: [0, 0, 0, 0, 0, 0] },
        boggle: { ...DEFAULT_STATS, highScore: 0, averageScore: 0, totalScore: 0 },
      },
      version: 2,

      getStats: (gameId) => get().stats[gameId] ?? DEFAULT_STATS,

      recordGame: (gameId, result) => {
        set((state) => {
          const current = state.stats[gameId] ?? { ...DEFAULT_STATS };
          const today = new Date().toISOString().split('T')[0];
          const isConsecutive = isConsecutiveDay(current.lastPlayedDate, today);

          const updated: GameStatistics = {
            ...current,
            gamesPlayed: current.gamesPlayed + 1,
            gamesWon: current.gamesWon + (result.won ? 1 : 0),
            currentStreak: result.won
              ? (isConsecutive ? current.currentStreak + 1 : 1)
              : 0,
            maxStreak: Math.max(
              current.maxStreak,
              result.won ? (isConsecutive ? current.currentStreak + 1 : 1) : current.currentStreak
            ),
            lastPlayedDate: today,
          };

          // Game-specific updates
          if (gameId === 'wordle' && result.guessCount !== undefined && result.won) {
            const dist = [...(current.guessDistribution ?? [0, 0, 0, 0, 0, 0])];
            dist[result.guessCount - 1]++;
            updated.guessDistribution = dist;
          }

          if (gameId === 'boggle' && result.score !== undefined) {
            const totalScore = (current.totalScore ?? 0) + result.score;
            updated.totalScore = totalScore;
            updated.averageScore = totalScore / updated.gamesPlayed;
            updated.highScore = Math.max(current.highScore ?? 0, result.score);
          }

          return {
            stats: { ...state.stats, [gameId]: updated },
          };
        });
      },
    }),
    {
      name: 'game-statistics',
      version: 2,
      migrate: (persisted: unknown, version: number) => {
        // Migrate from v1 (Wordle-only) to v2 (multi-game)
        if (version === 1 || version === 0) {
          const old = persisted as Record<string, unknown>;
          return {
            stats: {
              wordle: {
                gamesPlayed: old.gamesPlayed ?? 0,
                gamesWon: old.gamesWon ?? 0,
                currentStreak: old.currentStreak ?? 0,
                maxStreak: old.maxStreak ?? 0,
                guessDistribution: old.guessDistribution ?? [0, 0, 0, 0, 0, 0],
                lastPlayedDate: old.lastPlayedDate ?? null,
              },
              boggle: { ...DEFAULT_STATS, highScore: 0, averageScore: 0, totalScore: 0 },
            },
            version: 2,
          };
        }
        return persisted as StatsState;
      },
    }
  )
);

function isConsecutiveDay(lastDate: string | null, currentDate: string): boolean {
  if (!lastDate) return false;
  const last = new Date(lastDate);
  const current = new Date(currentDate);
  const diffTime = current.getTime() - last.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays === 1;
}
```

### 5.4 Multiplayer Store Update

Add game type awareness and updated message protocol.

**Modified: `src/stores/multiplayerStore.ts`**
```typescript
interface MultiplayerState {
  // Existing fields...
  gameId: GameId | null;  // Which game this session is for

  hostGame: (gameId: GameId, pin?: string) => void;
  joinGame: (gameId: GameId, code: string, pin?: string) => void;
}
```

**Updated session code format:**
```
wordle-XXXXXX-xxxxxx   (Wordle session)
boggle-XXXXXX-xxxxxx   (Boggle session)
```

**Updated PeerMessage types (in `src/types.ts`):**
```typescript
// Add game handshake message
type PeerMessage =
  | { type: 'game-handshake'; gameId: GameId; version: string }
  | { type: 'game-mismatch'; expected: GameId; received: GameId }
  // ... existing message types
  | { type: 'game-state'; gameId: GameId; state: GameState }
  | { type: 'timer-sync'; timeRemaining: number }  // For Boggle
  ;

// Zod schema update
const GameHandshakeSchema = z.object({
  type: z.literal('game-handshake'),
  gameId: z.enum(['wordle', 'boggle']),
  version: z.string(),
});
```

**Connection flow with game validation:**
```
1. Viewer connects to host
2. Viewer sends: { type: 'game-handshake', gameId: 'boggle', version: '1.0' }
3. Host validates gameId matches session
4. If mismatch: Host sends { type: 'game-mismatch', ... } and disconnects
5. If match: Host sends { type: 'auth-success' } (or auth-request if PIN)
6. Continue with normal game state sync
```

### 5.5 Multiplayer State Sync Pattern

Each game component subscribes to multiplayer messages and syncs state. This keeps sync logic within the game module.

**Example: Wordle multiplayer sync (in WordleGame.tsx)**
```typescript
// Subscribe to multiplayer state updates
useEffect(() => {
  const unsubscribe = useMultiplayerStore.subscribe(
    (state) => state.lastMessage,
    (message) => {
      if (!message) return;

      if (message.type === 'game-state' && message.gameId === 'wordle') {
        // Apply remote state from partner
        setState(message.state as WordleState);
      }
    }
  );

  return unsubscribe;
}, [setState]);

// Broadcast state changes to partner (host only)
useEffect(() => {
  if (role !== 'host' || !partnerConnected) return;

  const unsubscribe = useWordleStore.subscribe(
    (state) => state.guesses,
    () => {
      const state = getState();
      sendMessage({ type: 'game-state', gameId: 'wordle', state });
    }
  );

  return unsubscribe;
}, [role, partnerConnected, getState]);
```

**Example: Boggle timer sync (in BoggleGame.tsx)**
```typescript
// Host broadcasts timer
useEffect(() => {
  if (role !== 'host' || !partnerConnected) return;

  const unsubscribe = useTimerStore.subscribe(
    (state) => state.timeRemaining,
    (timeRemaining) => {
      sendMessage({ type: 'timer-sync', timeRemaining });
    }
  );

  return unsubscribe;
}, [role, partnerConnected]);

// Viewer syncs to host timer
useEffect(() => {
  const unsubscribe = useMultiplayerStore.subscribe(
    (state) => state.lastMessage,
    (message) => {
      if (message?.type === 'timer-sync' && role === 'viewer') {
        // Only sync if difference is significant (>2s drift)
        const drift = Math.abs(timeRemaining - message.timeRemaining);
        if (drift > 2) {
          useTimerStore.getState().reset(message.timeRemaining);
          useTimerStore.getState().resume();
        }
      }
    }
  );

  return unsubscribe;
}, [role, timeRemaining]);
```

---

## Phase 6: Shared Components

### 6.1 Generalized Board Component

**New file: `src/components/GameBoard/GameBoard.tsx`**
```typescript
interface GameBoardProps {
  type: 'rows' | 'grid';
  rows: number;
  cols: number;
  renderCell: (row: number, col: number) => ReactNode;
  className?: string;
}

export function GameBoard({ type, rows, cols, renderCell, className }: GameBoardProps) {
  return (
    <div className={`game-board game-board--${type} ${className || ''}`}>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="game-board-row">
          {Array.from({ length: cols }, (_, c) => (
            <div key={c} className="game-board-cell">
              {renderCell(r, c)}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
```

### 6.2 Game Layout Component

**New file: `src/components/GameLayout/GameLayout.tsx`**
```typescript
import type { ReactNode } from 'react';
import { ThemeToggle } from '../ThemeToggle';
import './GameLayout.css';

interface GameLayoutProps {
  gameId: string;
  gameName: string;
  children: ReactNode;
  onBack: () => void;
  headerActions?: ReactNode;
}

export function GameLayout({ gameId, gameName, children, onBack, headerActions }: GameLayoutProps) {
  return (
    <div className="game-layout">
      <header className="game-header">
        <button onClick={onBack} className="back-button">
          ← Back
        </button>
        <h1>{gameName}</h1>
        <div className="header-actions">
          {headerActions}
          <ThemeToggle />
        </div>
      </header>
      <main className="game-main">
        {children}
      </main>
    </div>
  );
}
```

**New file: `src/components/GameLayout/GameLayout.css`**
```css
.game-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg);
  color: var(--text-primary);
}

.game-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  border-bottom: 1px solid var(--tile-border);
  background: var(--bg);
  position: sticky;
  top: 0;
  z-index: 10;
}

.game-header h1 {
  font-size: 1.5rem;
  font-weight: bold;
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.back-button {
  background: none;
  border: none;
  color: var(--text-primary);
  font-size: 1rem;
  cursor: pointer;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.back-button:hover {
  background: var(--bg-secondary);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.game-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1rem;
}

/* Loading state */
.game-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
}

.loading-spinner {
  width: 48px;
  height: 48px;
  border: 4px solid var(--tile-border);
  border-top-color: var(--correct);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Responsive adjustments */
@media (max-width: 500px) {
  .game-header {
    padding: 0.75rem;
  }

  .game-header h1 {
    font-size: 1.25rem;
  }

  .back-button {
    padding: 0.25rem 0.5rem;
    font-size: 0.9rem;
  }
}
```

### 6.3 Error Boundary Component

Catches JavaScript errors in game components and displays a fallback UI.

**New file: `src/components/ErrorBoundary/ErrorBoundary.tsx`**
```typescript
import { Component, type ReactNode, type ErrorInfo } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="error-boundary">
          <h2>Something went wrong</h2>
          <p className="error-message">
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <div className="error-actions">
            <button onClick={this.handleRetry} className="retry-button">
              Try Again
            </button>
            <button onClick={() => window.location.href = '/'} className="home-button">
              Go to Dashboard
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
```

**New file: `src/components/ErrorBoundary/ErrorBoundary.css`**
```css
.error-boundary {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 50vh;
  padding: 2rem;
  text-align: center;
}

.error-boundary h2 {
  font-size: 1.5rem;
  margin-bottom: 1rem;
  color: var(--text-primary);
}

.error-message {
  color: var(--text-secondary);
  margin-bottom: 2rem;
  max-width: 400px;
}

.error-actions {
  display: flex;
  gap: 1rem;
}

.retry-button {
  background: var(--correct);
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
}

.retry-button:hover {
  opacity: 0.9;
}

.home-button {
  background: var(--tile-bg);
  color: var(--text-primary);
  border: 2px solid var(--tile-border);
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
}

.home-button:hover {
  background: var(--bg-secondary);
}
```

**Usage in router (wrap lazy-loaded games):**
```typescript
// In router.tsx
import { ErrorBoundary } from './components/ErrorBoundary/ErrorBoundary';

// Wrap each game route
{
  path: '/wordle',
  element: (
    <ErrorBoundary>
      <Suspense fallback={<GameLoadingFallback />}>
        <WordleGame />
      </Suspense>
    </ErrorBoundary>
  ),
}
```

---

## Phase 7: Routing Implementation

### 7.1 GitHub Pages SPA Routing Solution

GitHub Pages doesn't support client-side routing natively (returns 404 for non-root paths).

**Recommended approach: Hash Router**

Using `createHashRouter` instead of `createBrowserRouter` is the simplest solution:
- URLs become `/#/wordle` instead of `/wordle`
- Works without any server configuration
- No 404 issues on refresh

**Alternative: 404.html Redirect Hack**

If clean URLs are required, use the spa-github-pages approach:

1. Create `public/404.html` that redirects to index with path info:
```html
<!DOCTYPE html>
<html>
  <head>
    <script>
      // Redirect 404 to index.html with path preserved
      const path = window.location.pathname;
      const search = window.location.search;
      const hash = window.location.hash;
      // Store path and redirect to root
      sessionStorage.setItem('spa-redirect', path + search + hash);
      window.location.replace('/');
    </script>
  </head>
</html>
```

2. Add redirect handler in `main.tsx`:
```typescript
// Check for SPA redirect from 404.html
const redirect = sessionStorage.getItem('spa-redirect');
if (redirect) {
  sessionStorage.removeItem('spa-redirect');
  window.history.replaceState(null, '', redirect);
}
```

### 7.2 Router Configuration

**New file: `src/router.tsx`**
```typescript
import { lazy, Suspense } from 'react';
import { createHashRouter, RouterProvider, Navigate } from 'react-router-dom';
import { Dashboard } from './features/dashboard/Dashboard';

/**
 * Lazy load game modules - they won't be downloaded until user navigates to them.
 * This keeps the initial bundle small (just dashboard + shared code).
 */
const WordleGame = lazy(() => import('./games/wordle/WordleGame'));
const BoggleGame = lazy(() => import('./games/boggle/BoggleGame'));

/**
 * Loading fallback shown while game chunk is downloading.
 */
function GameLoadingFallback() {
  return (
    <div className="game-loading">
      <div className="loading-spinner" aria-label="Loading game..." />
    </div>
  );
}

/**
 * Using Hash Router for GitHub Pages compatibility.
 * URLs will be: /#/, /#/wordle, /#/boggle
 */
const router = createHashRouter([
  {
    path: '/',
    element: <Dashboard />,
  },
  {
    path: '/wordle',
    element: (
      <Suspense fallback={<GameLoadingFallback />}>
        <WordleGame />
      </Suspense>
    ),
  },
  {
    path: '/boggle',
    element: (
      <Suspense fallback={<GameLoadingFallback />}>
        <BoggleGame />
      </Suspense>
    ),
  },
  {
    // Catch-all redirect to dashboard
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
```

**Game module exports (must use default export for lazy loading):**

```typescript
// src/games/wordle/WordleGame.tsx
export default function WordleGame() {
  // ...
}

// src/games/boggle/BoggleGame.tsx
export default function BoggleGame() {
  // ...
}
```

**Bundle structure after lazy loading:**

```
dist/
├── index.html
├── assets/
│   ├── main-[hash].js        # Dashboard + router + shared (~50KB)
│   ├── wordle-[hash].js      # Wordle game chunk (~30KB)
│   └── boggle-[hash].js      # Boggle game chunk (~200KB with dictionary)
```

**Preload on hover (optional optimization):**

```tsx
// In Dashboard.tsx - start loading game when user hovers over card
import type { GameMetadata } from '../games/types';

function GameCard({ game }: { game: GameMetadata }) {
  const preloadGame = () => {
    if (game.id === 'wordle') {
      import('../games/wordle/WordleGame');
    } else if (game.id === 'boggle') {
      import('../games/boggle/BoggleGame');
    }
  };

  return (
    <Link
      to={game.route}
      className="game-card"
      onMouseEnter={preloadGame}
      onFocus={preloadGame}
    >
      {/* ... */}
    </Link>
  );
}
```

### 7.3 Updated App Entry

**Modified: `src/App.tsx`**
```typescript
import { AppRouter } from './router';

export default function App() {
  return <AppRouter />;
}
```

### 7.4 Update Multiplayer Join URLs

With hash routing, share URLs become:
```
https://username.github.io/wordle/#/wordle?join=CODE
https://username.github.io/wordle/#/boggle?join=CODE
```

**Updated share button logic:**
```typescript
const getShareUrl = (gameId: GameId, sessionCode: string): string => {
  const base = window.location.origin + window.location.pathname;
  return `${base}#/${gameId}?join=${sessionCode}`;
};
```

### 7.5 Backward Compatibility Redirect

Handle old Wordle-only URLs that used query params on root:

**Add to router or App.tsx:**
```typescript
import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

function LegacyRedirect() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // Check for old-style join URL: /?join=CODE
    const joinCode = searchParams.get('join');
    if (joinCode && window.location.hash === '') {
      // Redirect to new Wordle URL (assume old links were Wordle)
      navigate(`/wordle?join=${joinCode}`, { replace: true });
    }
  }, [searchParams, navigate]);

  return null;
}
```

---

## Phase 8: Migration Strategy

### Step 1: Infrastructure (Non-breaking)
1. Install `react-router-dom`
2. Create `src/games/types.ts` with game interfaces
3. Create `src/games/index.ts` registry
4. Create dashboard component structure

### Step 2: Extract Wordle
1. Create `src/games/wordle/` directory
2. Move word list to `src/games/wordle/words.ts`
3. Extract letter status logic to `src/games/wordle/logic.ts`
4. Create `wordleGame` definition
5. Create `WordleGame` component wrapper

### Step 3: Add Routing
1. Create router configuration
2. Update `App.tsx` to use router
3. Add redirect from old URL structure to new
4. Update multiplayer join URLs

### Step 4: Add Boggle
1. Create `src/games/boggle/` directory with all files
2. Add boggle to game registry
3. Create BoggleGame component

### Step 5: Update Multiplayer
1. Add gameId to session codes
2. Update PeerJS message schemas
3. Add game compatibility check on join

### Step 6: Update Statistics
1. Migrate stats store to per-game format
2. Add migration for existing localStorage data
3. Update stats modal to show per-game stats

---

## File Structure After Refactor

```
src/
├── main.tsx
├── App.tsx
├── router.tsx
├── index.css
│
├── games/
│   ├── types.ts                    # Shared types (GameId, GameMetadata, Position)
│   ├── registry.ts                 # Game metadata for dashboard
│   │
│   ├── wordle/
│   │   ├── index.ts                # Re-exports
│   │   ├── WordleGame.tsx          # Main component (default export)
│   │   ├── store.ts                # Zustand store with game logic
│   │   ├── words.ts                # Word list
│   │   ├── logic.ts                # Pure functions (getLetterStatus, isValidWord)
│   │   ├── types.ts                # WordleState, Guess, LetterStatus
│   │   └── components/
│   │       ├── WordleBoard.tsx
│   │       └── WordleKeyboard.tsx
│   │
│   └── boggle/
│       ├── index.ts                # Re-exports
│       ├── BoggleGame.tsx          # Main component (default export)
│       ├── store.ts                # Zustand store with game logic
│       ├── types.ts                # BoggleState, BoggleBoard
│       ├── dictionary.ts           # Trie-based dictionary
│       ├── wordlist.ts             # Word array (~128K words)
│       ├── board.ts                # Board generation
│       ├── solver.ts               # Path validation, findAllWords
│       ├── scoring.ts              # Score calculation
│       ├── hooks/
│       │   └── useGridSelection.ts # Touch/drag interaction
│       └── components/
│           ├── BoggleBoard.tsx
│           ├── BoggleTile.tsx
│           ├── WordList.tsx
│           ├── Timer.tsx           # Timer display (uses timerStore)
│           ├── KeyboardInput.tsx   # Accessibility input
│           └── BoggleGame.css
│
├── features/
│   ├── dashboard/
│   │   ├── Dashboard.tsx
│   │   └── Dashboard.css
│   │
│   └── lobby/
│       ├── Lobby.tsx               # Game-agnostic lobby
│       └── Lobby.css
│
├── components/
│   ├── GameBoard/
│   │   ├── GameBoard.tsx           # Shared grid component
│   │   └── GameBoard.css
│   ├── GameLayout/
│   │   ├── GameLayout.tsx          # Shared layout with back button
│   │   └── GameLayout.css
│   ├── Keyboard/                   # Shared keyboard (used by Wordle)
│   ├── Stats/                      # Multi-game stats modal
│   ├── ThemeToggle/
│   ├── ErrorBoundary/
│   └── ScreenReaderAnnouncement/
│
├── stores/
│   ├── index.ts                    # Re-exports shared stores
│   ├── timerStore.ts               # Shared timer for timed games
│   ├── multiplayerStore.ts         # PeerJS connection management
│   ├── statsStore.ts               # Per-game statistics
│   └── uiStore.ts                  # Theme, accessibility settings
│
├── hooks/
│   ├── useGameAnnouncements.ts     # Screen reader announcements
│   └── useLatest.ts                # Ref helper
│
├── types.ts                        # PeerMessage schemas, GAME_CONFIG
│
└── test/
    └── setup.ts
```

---

## Testing Strategy

### Test Migration

Current tests are in `src/test/`. Migrate as follows:

| Current Location | New Location | Notes |
|-----------------|--------------|-------|
| `src/test/gameStore.test.ts` | `src/games/wordle/store.test.ts` | Test Wordle-specific logic |
| `src/test/multiplayerStore.test.ts` | `src/stores/multiplayerStore.test.ts` | Keep in shared stores |
| `src/test/components/*.test.tsx` | `src/games/wordle/components/*.test.tsx` | Move Wordle components |

### Unit Tests

Each game module has its own tests. Examples:

#### Wordle Store Tests

**New file: `src/games/wordle/store.test.ts`**
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useWordleStore } from './store';

describe('useWordleStore', () => {
  beforeEach(() => {
    // Reset store before each test
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

      'ABCDEF'.split('').forEach(letter => addLetter(letter));
      expect(useWordleStore.getState().currentGuess).toBe('ABCDE');
    });

    it('should not add letters when game is over', () => {
      useWordleStore.setState({ gameOver: true, currentGuess: '' });
      const { addLetter } = useWordleStore.getState();

      addLetter('A');
      expect(useWordleStore.getState().currentGuess).toBe('');
    });
  });

  describe('submitGuess', () => {
    it('should reject words not in word list', () => {
      const { addLetter, submitGuess } = useWordleStore.getState();

      'XXXXX'.split('').forEach(letter => addLetter(letter));
      const result = submitGuess();

      expect(result).toBe(false);
      expect(useWordleStore.getState().message).toBe('Not in word list');
    });

    it('should mark game as won when correct word guessed', () => {
      const solution = useWordleStore.getState().solution;
      const { addLetter, submitGuess } = useWordleStore.getState();

      solution.split('').forEach(letter => addLetter(letter));
      submitGuess();

      expect(useWordleStore.getState().won).toBe(true);
      expect(useWordleStore.getState().gameOver).toBe(true);
    });
  });
});
```

#### Wordle Logic Tests

**New file: `src/games/wordle/logic.test.ts`**
```typescript
import { describe, it, expect } from 'vitest';
import { getLetterStatus, isValidWord } from './logic';

describe('getLetterStatus', () => {
  it('should mark correct letters', () => {
    const result = getLetterStatus('APPLE', 'APPLE');
    expect(result).toEqual(['correct', 'correct', 'correct', 'correct', 'correct']);
  });

  it('should mark present letters', () => {
    const result = getLetterStatus('LEAPT', 'APPLE');
    // L is present (in APPLE), E is present, A is present, P is present, T is absent
    expect(result).toEqual(['present', 'present', 'present', 'present', 'absent']);
  });

  it('should mark absent letters', () => {
    const result = getLetterStatus('XXXXX', 'APPLE');
    expect(result).toEqual(['absent', 'absent', 'absent', 'absent', 'absent']);
  });

  it('should handle duplicate letters correctly', () => {
    // ALLOY guessed against APPLE
    // A: correct (position 0)
    // L: present (one L in APPLE at position 3)
    // L: absent (only one L in APPLE, already used)
    // O: absent
    // Y: absent
    const result = getLetterStatus('ALLOY', 'APPLE');
    expect(result).toEqual(['correct', 'present', 'absent', 'absent', 'absent']);
  });

  it('should prioritize correct over present', () => {
    // APPLE guessed against PZZZZ
    // A: absent, P: correct (position 0 in solution), P: absent, L: absent, E: absent
    const result = getLetterStatus('APPLE', 'PZZZZ');
    expect(result).toEqual(['absent', 'correct', 'absent', 'absent', 'absent']);
  });
});

describe('isValidWord', () => {
  it('should return true for valid words', () => {
    expect(isValidWord('APPLE')).toBe(true);
    expect(isValidWord('CRANE')).toBe(true);
  });

  it('should return false for invalid words', () => {
    expect(isValidWord('XXXXX')).toBe(false);
    expect(isValidWord('ZZZZZ')).toBe(false);
  });

  it('should be case insensitive', () => {
    expect(isValidWord('apple')).toBe(true);
    expect(isValidWord('Apple')).toBe(true);
  });
});
```

#### Boggle Solver Tests

**New file: `src/games/boggle/solver.test.ts`**
```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { isValidPath, findAllWords } from './solver';
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
});

describe('findAllWords', () => {
  beforeAll(async () => {
    await loadDictionary();
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

    // Should find common words like CAT, DOG, RAT, etc.
    expect(words).toContain('CAT');
    expect(words).toContain('DOG');
    expect(words).toContain('RAT');
  });

  it('should handle Qu tiles correctly', () => {
    const board: BoggleBoard = {
      grid: [
        ['Qu', 'I', 'T', 'E'],
        ['A', 'B', 'C', 'D'],
        ['E', 'F', 'G', 'H'],
        ['I', 'J', 'K', 'L'],
      ],
      size: 4,
    };

    const words = findAllWords(board);

    // Should find QUIT (Qu + I + T)
    expect(words).toContain('QUIT');
    expect(words).toContain('QUITE');
  });
});
```

#### Boggle Scoring Tests

**New file: `src/games/boggle/scoring.test.ts`**
```typescript
import { describe, it, expect } from 'vitest';
import { calculateWordScore } from './scoring';

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
  });

  it('should return 3 for 6 letter words', () => {
    expect(calculateWordScore('BANANA')).toBe(3);
  });

  it('should return 5 for 7 letter words', () => {
    expect(calculateWordScore('DRAGONS')).toBe(5);
  });

  it('should return 11 for 8+ letter words', () => {
    expect(calculateWordScore('STRAWBERRY')).toBe(11);
    expect(calculateWordScore('AARDVARKS')).toBe(11);
  });
});
```

#### Timer Store Tests

**New file: `src/stores/timerStore.test.ts`**
```typescript
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useTimerStore } from './timerStore';

describe('useTimerStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useTimerStore.getState().reset(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should start timer with given duration', () => {
    const { start } = useTimerStore.getState();

    start(180);

    expect(useTimerStore.getState().timeRemaining).toBe(180);
    expect(useTimerStore.getState().isRunning).toBe(true);
  });

  it('should tick down every second', () => {
    const { start } = useTimerStore.getState();

    start(180);
    vi.advanceTimersByTime(1000);

    expect(useTimerStore.getState().timeRemaining).toBe(179);
  });

  it('should stop at zero', () => {
    const { start } = useTimerStore.getState();

    start(3);
    vi.advanceTimersByTime(5000);

    expect(useTimerStore.getState().timeRemaining).toBe(0);
    expect(useTimerStore.getState().isRunning).toBe(false);
  });

  it('should pause and resume correctly', () => {
    const { start, pause, resume } = useTimerStore.getState();

    start(180);
    vi.advanceTimersByTime(2000);
    pause();

    expect(useTimerStore.getState().timeRemaining).toBe(178);
    expect(useTimerStore.getState().isRunning).toBe(false);

    vi.advanceTimersByTime(5000); // Time passes but timer paused
    expect(useTimerStore.getState().timeRemaining).toBe(178);

    resume();
    vi.advanceTimersByTime(3000);
    expect(useTimerStore.getState().timeRemaining).toBe(175);
  });
});
```

### Integration Tests

#### Router Navigation Tests

**New file: `src/test/router.test.tsx`**
```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '../router';

describe('Router', () => {
  it('should render dashboard on root path', () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/'] });
    render(<RouterProvider router={router} />);

    expect(screen.getByText('Game Hub')).toBeInTheDocument();
  });

  it('should navigate to Wordle from dashboard', async () => {
    const user = userEvent.setup();
    const router = createMemoryRouter(routes, { initialEntries: ['/'] });
    render(<RouterProvider router={router} />);

    await user.click(screen.getByText('Wordle'));

    expect(screen.getByText('Wordle')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/wordle');
  });

  it('should navigate to Boggle from dashboard', async () => {
    const user = userEvent.setup();
    const router = createMemoryRouter(routes, { initialEntries: ['/'] });
    render(<RouterProvider router={router} />);

    await user.click(screen.getByText('Boggle'));

    expect(router.state.location.pathname).toBe('/boggle');
  });

  it('should redirect invalid paths to dashboard', () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/invalid'] });
    render(<RouterProvider router={router} />);

    expect(router.state.location.pathname).toBe('/');
  });
});
```

#### Statistics Integration Tests

**New file: `src/test/stats.integration.test.ts`**
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useStatsStore } from '../stores/statsStore';

describe('Statistics Integration', () => {
  beforeEach(() => {
    localStorage.clear();
    // Reset store
    useStatsStore.setState({
      stats: {
        wordle: {
          gamesPlayed: 0,
          gamesWon: 0,
          currentStreak: 0,
          maxStreak: 0,
          lastPlayedDate: null,
          guessDistribution: [0, 0, 0, 0, 0, 0],
        },
        boggle: {
          gamesPlayed: 0,
          gamesWon: 0,
          currentStreak: 0,
          maxStreak: 0,
          lastPlayedDate: null,
          highScore: 0,
          averageScore: 0,
          totalScore: 0,
        },
      },
      version: 2,
    });
  });

  it('should record Wordle game with guess distribution', () => {
    const { recordGame, getStats } = useStatsStore.getState();

    recordGame('wordle', { won: true, guessCount: 3 });

    const stats = getStats('wordle');
    expect(stats.gamesPlayed).toBe(1);
    expect(stats.gamesWon).toBe(1);
    expect(stats.guessDistribution?.[2]).toBe(1); // Index 2 = 3 guesses
  });

  it('should record Boggle game with score tracking', () => {
    const { recordGame, getStats } = useStatsStore.getState();

    recordGame('boggle', { won: true, score: 45 });
    recordGame('boggle', { won: true, score: 55 });

    const stats = getStats('boggle');
    expect(stats.gamesPlayed).toBe(2);
    expect(stats.highScore).toBe(55);
    expect(stats.averageScore).toBe(50);
    expect(stats.totalScore).toBe(100);
  });

  it('should track streaks separately per game', () => {
    const { recordGame, getStats } = useStatsStore.getState();

    recordGame('wordle', { won: true });
    recordGame('boggle', { won: false, score: 10 });

    expect(getStats('wordle').currentStreak).toBe(1);
    expect(getStats('boggle').currentStreak).toBe(0);
  });
});
```

### E2E Tests (Optional)

For Playwright/Cypress end-to-end tests:

**New file: `e2e/wordle.spec.ts`**
```typescript
import { test, expect } from '@playwright/test';

test.describe('Wordle Game', () => {
  test('should complete a game', async ({ page }) => {
    await page.goto('/#/wordle');

    // Type a word using keyboard
    await page.keyboard.type('CRANE');
    await page.keyboard.press('Enter');

    // Verify guess was submitted
    const tiles = page.locator('.wordle-tile');
    await expect(tiles.first()).not.toHaveClass(/wordle-tile--empty/);
  });

  test('should show message for invalid word', async ({ page }) => {
    await page.goto('/#/wordle');

    await page.keyboard.type('XXXXX');
    await page.keyboard.press('Enter');

    await expect(page.locator('.game-message')).toContainText('Not in word list');
  });
});
```

**New file: `e2e/boggle.spec.ts`**
```typescript
import { test, expect } from '@playwright/test';

test.describe('Boggle Game', () => {
  test('should load dictionary and show timer', async ({ page }) => {
    await page.goto('/#/boggle');

    // Wait for dictionary to load
    await expect(page.locator('.timer')).toBeVisible();
    await expect(page.locator('.boggle-board')).toBeVisible();
  });

  test('should accept word via keyboard input in accessibility mode', async ({ page }) => {
    await page.goto('/#/boggle');

    // Enable accessibility mode via settings or Tab key
    await page.keyboard.press('Tab');

    // Type a word
    await page.fill('#word-input', 'CAT');
    await page.keyboard.press('Enter');

    // Word should appear in found list (if valid on board)
    // This depends on board state
  });
});
```

---

## Dependencies to Add

```json
{
  "dependencies": {
    "react-router-dom": "^7.x"
  }
}
```

---

## Backward Compatibility

1. **Existing Wordle URLs**: Redirect `/?join=CODE` to `/wordle?join=CODE`
2. **Existing localStorage stats**: Migrate to `{ wordle: existingStats }` format on first load
3. **Existing multiplayer sessions**: Old format codes (without game prefix) default to Wordle

---

## PWA and Service Worker Updates

The current app has PWA support. Updates needed for multi-game:

### Route Caching

Update `vite.config.ts` PWA configuration to handle new routes:

```typescript
// vite.config.ts
VitePWA({
  // ... existing config
  workbox: {
    navigateFallback: 'index.html',
    // Cache game chunks separately
    runtimeCaching: [
      {
        urlPattern: /^.*\/assets\/wordle-.*\.js$/,
        handler: 'CacheFirst',
        options: { cacheName: 'wordle-game' },
      },
      {
        urlPattern: /^.*\/assets\/boggle-.*\.js$/,
        handler: 'CacheFirst',
        options: { cacheName: 'boggle-game' },
      },
    ],
  },
})
```

### Offline Dictionary

For Boggle's dictionary, consider:
1. Pre-cache during service worker install (larger initial cache)
2. Lazy-cache on first Boggle game (better initial load, requires online first play)

Recommended: Lazy-cache. Most users won't play Boggle on first visit.

---

## Future Game Considerations

This architecture easily supports adding more games:

1. Create new directory in `src/games/{game-name}/`
2. Create game types, store, and components
3. Add metadata to `src/games/registry.ts`
4. Add lazy route in `src/router.tsx`

Potential future games:
- **Connections** (NYT word grouping game)
- **Spelling Bee** (find words with specific letters)
- **Crossword Mini** (small crossword puzzles)
