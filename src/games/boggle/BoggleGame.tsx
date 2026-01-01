import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBoggleStore } from './store';
import { useTimerStore } from '../../stores/timerStore';
import { BoggleBoard, Timer, WordList } from './components';
import { GameLayout } from '../../components/GameLayout/GameLayout';
import './BoggleGame.css';

const GAME_DURATION = 180; // 3 minutes

export default function BoggleGame() {
  const navigate = useNavigate();

  // Boggle store state
  const board = useBoggleStore((s) => s.board);
  const foundWords = useBoggleStore((s) => s.foundWords);
  const currentPath = useBoggleStore((s) => s.currentPath);
  const currentWord = useBoggleStore((s) => s.currentWord);
  const score = useBoggleStore((s) => s.score);
  const gameOver = useBoggleStore((s) => s.gameOver);
  const isLoading = useBoggleStore((s) => s.isLoading);

  const initGame = useBoggleStore((s) => s.initGame);
  const selectTile = useBoggleStore((s) => s.selectTile);
  const submitWord = useBoggleStore((s) => s.submitWord);
  const endGame = useBoggleStore((s) => s.endGame);

  // Timer store state
  const timeRemaining = useTimerStore((s) => s.timeRemaining);
  const startTimer = useTimerStore((s) => s.start);
  const stopTimer = useTimerStore((s) => s.stop);

  // Initialize game on mount
  useEffect(() => {
    initGame().then(() => {
      startTimer(GAME_DURATION);
    });

    return () => {
      stopTimer();
    };
  }, [initGame, startTimer, stopTimer]);

  // End game when timer reaches zero
  useEffect(() => {
    if (timeRemaining === 0 && !gameOver && !isLoading) {
      endGame();
    }
  }, [timeRemaining, gameOver, isLoading, endGame]);

  const handleBack = useCallback(() => {
    stopTimer();
    navigate('/');
  }, [navigate, stopTimer]);

  const handleNewGame = useCallback(() => {
    initGame().then(() => {
      startTimer(GAME_DURATION);
    });
  }, [initGame, startTimer]);

  const handleSubmit = useCallback(() => {
    submitWord();
  }, [submitWord]);

  if (isLoading || !board) {
    return (
      <GameLayout gameId="boggle" gameName="Boggle" onBack={handleBack}>
        <div className="boggle-game">
          <div className="loading">Loading dictionary...</div>
        </div>
      </GameLayout>
    );
  }

  return (
    <GameLayout gameId="boggle" gameName="Boggle" onBack={handleBack}>
      <div className="boggle-game">
        <div className="boggle-header">
          <Timer timeRemaining={timeRemaining} />
          <div className="score-display">
            Score: <strong>{score}</strong>
          </div>
        </div>

        <div className="boggle-content">
          <BoggleBoard
            board={board}
            selectedPath={currentPath}
            currentWord={currentWord}
            onTileSelect={selectTile}
            onSubmit={handleSubmit}
            disabled={gameOver}
          />

          <div className="boggle-sidebar">
            <WordList words={foundWords} totalScore={score} />
          </div>
        </div>

        {gameOver && (
          <div className="game-over-panel">
            <h2>Time's Up!</h2>
            <p>
              Final Score: <strong>{score}</strong>
            </p>
            <p>Words Found: {foundWords.length}</p>
            <button className="play-again-btn" onClick={handleNewGame}>
              Play Again
            </button>
          </div>
        )}
      </div>
    </GameLayout>
  );
}
