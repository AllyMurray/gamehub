import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWordleStore } from './store';
import { WordleBoard, WordleKeyboard } from './components';
import { GameLayout } from '../../components/GameLayout/GameLayout';
import './WordleGame.css';

export default function WordleGame() {
  const navigate = useNavigate();
  const guesses = useWordleStore((s) => s.guesses);
  const currentGuess = useWordleStore((s) => s.currentGuess);
  const gameOver = useWordleStore((s) => s.gameOver);
  const won = useWordleStore((s) => s.won);
  const shake = useWordleStore((s) => s.shake);
  const message = useWordleStore((s) => s.message);

  const addLetter = useWordleStore((s) => s.addLetter);
  const removeLetter = useWordleStore((s) => s.removeLetter);
  const submitGuess = useWordleStore((s) => s.submitGuess);
  const resetGame = useWordleStore((s) => s.resetGame);
  const getKeyboardStatus = useWordleStore((s) => s.getKeyboardStatus);

  // Handle physical keyboard input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === 'Enter') {
        e.preventDefault();
        submitGuess();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        removeLetter();
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        addLetter(e.key);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [addLetter, removeLetter, submitGuess]);

  const handleBack = useCallback(() => {
    navigate('/');
  }, [navigate]);

  const handleNewGame = useCallback(() => {
    resetGame();
  }, [resetGame]);

  return (
    <GameLayout gameId="wordle" gameName="Wordle" onBack={handleBack}>
      <div className="wordle-game">
        {message && (
          <div className={`game-message ${won ? 'game-message--won' : ''}`}>
            {message}
          </div>
        )}

        <WordleBoard
          guesses={guesses}
          currentGuess={currentGuess}
          shake={shake}
        />

        {gameOver && (
          <button className="play-again-btn" onClick={handleNewGame}>
            Play Again
          </button>
        )}

        <WordleKeyboard
          keyboardStatus={getKeyboardStatus()}
          onKey={addLetter}
          onEnter={submitGuess}
          onBackspace={removeLetter}
          disabled={gameOver}
        />
      </div>
    </GameLayout>
  );
}
