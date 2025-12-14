import { useEffect, useCallback } from 'react';
import Board from './components/Board';
import Keyboard from './components/Keyboard';
import { useWordle } from './hooks/useWordle';
import './App.css';

function App() {
  const {
    guesses,
    currentGuess,
    gameOver,
    won,
    shake,
    message,
    handleKeyPress,
    getKeyboardStatus,
    newGame,
    maxGuesses,
    wordLength
  } = useWordle();

  // Handle physical keyboard input
  const handleKeyDown = useCallback((e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    if (e.key === 'Enter') {
      handleKeyPress('ENTER');
    } else if (e.key === 'Backspace') {
      handleKeyPress('BACKSPACE');
    } else if (/^[a-zA-Z]$/.test(e.key)) {
      handleKeyPress(e.key.toUpperCase());
    }
  }, [handleKeyPress]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="app">
      <header className="header">
        <h1>Wordle</h1>
      </header>

      <main className="main">
        {message && (
          <div className={`message ${won ? 'won' : ''}`}>
            {message}
          </div>
        )}

        <Board
          guesses={guesses}
          currentGuess={currentGuess}
          maxGuesses={maxGuesses}
          wordLength={wordLength}
          shake={shake}
        />

        {gameOver && (
          <button className="play-again" onClick={newGame}>
            Play Again
          </button>
        )}

        <Keyboard
          onKeyPress={handleKeyPress}
          keyboardStatus={getKeyboardStatus()}
        />
      </main>
    </div>
  );
}

export default App;
