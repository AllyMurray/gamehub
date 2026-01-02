import { useEffect, useCallback, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useBoggleStore } from './store';
import { useTimerStore } from '../../stores/timerStore';
import { BoggleBoard, Timer, WordList } from './components';
import { GameLayout } from '../../components/GameLayout/GameLayout';
import Lobby from '../../components/Lobby';
import ErrorBoundary from '../../components/ErrorBoundary';
import { useMultiplayerStore, useStatsStore } from '../../stores';
import { useMultiplayerReconnection } from '../../hooks/useMultiplayerReconnection';
import { getJoinCodeFromUrl, generateShareUrl, generateWhatsAppUrl } from '../../utils/shareUrl';
import type { GameMode } from '../../types';
import './BoggleGame.css';

const GAME_DURATION = 180; // 3 minutes

type GamePhase = 'lobby' | 'loading' | 'playing' | 'gameOver';

export default function BoggleGame() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [copyFeedback, setCopyFeedback] = useState(false);

  // Game phase state machine: lobby → loading → playing → gameOver
  const [gamePhase, setGamePhase] = useState<GamePhase>('lobby');

  // Track which mode (solo/multiplayer) for UI purposes
  const [localGameMode, setLocalGameMode] = useState<GameMode>(null);

  // Boggle store state
  const board = useBoggleStore((s) => s.board);
  const foundWords = useBoggleStore((s) => s.foundWords);
  const currentPath = useBoggleStore((s) => s.currentPath);
  const currentWord = useBoggleStore((s) => s.currentWord);
  const score = useBoggleStore((s) => s.score);

  const initGame = useBoggleStore((s) => s.initGame);
  const selectTile = useBoggleStore((s) => s.selectTile);
  const submitWord = useBoggleStore((s) => s.submitWord);
  const endGame = useBoggleStore((s) => s.endGame);
  const resetGame = useBoggleStore((s) => s.resetGame);
  const rotateBoard = useBoggleStore((s) => s.rotateBoard);

  // Timer store state
  const timeRemaining = useTimerStore((s) => s.timeRemaining);
  const startTimer = useTimerStore((s) => s.start);
  const stopTimer = useTimerStore((s) => s.stop);

  // Multiplayer store
  const role = useMultiplayerStore((s) => s.role);
  const sessionCode = useMultiplayerStore((s) => s.sessionCode);
  const sessionPin = useMultiplayerStore((s) => s.sessionPin);
  const connectionStatus = useMultiplayerStore((s) => s.connectionStatus);
  const errorMessage = useMultiplayerStore((s) => s.errorMessage);
  const partnerConnected = useMultiplayerStore((s) => s.partnerConnected);

  const hostGame = useMultiplayerStore((s) => s.hostGame);
  const joinGame = useMultiplayerStore((s) => s.joinGame);
  const leaveSession = useMultiplayerStore((s) => s.leaveSession);

  // Stats
  const recordBoggleGame = useStatsStore((s) => s.recordBoggleGame);

  // Track game completion for stats
  const lastRecordedGameRef = useRef<string | null>(null);

  // Rotation animation state
  const [rotationAnimation, setRotationAnimation] = useState<'left' | 'right' | null>(null);

  // Ref to track current game phase for use in subscriptions (avoids stale closures)
  const gamePhaseRef = useRef(gamePhase);
  useEffect(() => {
    gamePhaseRef.current = gamePhase;
  }, [gamePhase]);

  const isHost = role === 'host';
  const isViewer = role === 'viewer';

  // Handle loading → playing transition
  useEffect(() => {
    if (gamePhase !== 'loading') return;

    let cancelled = false;

    initGame()
      .then(() => {
        if (!cancelled) {
          setGamePhase('playing');
          startTimer(GAME_DURATION);
        }
      })
      .catch(() => {
        if (!cancelled) {
          // On error, return to lobby
          setGamePhase('lobby');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [gamePhase, initGame, startTimer]);

  // Handle playing → gameOver transition when timer reaches zero
  // Uses subscription pattern to avoid setState in effect body
  useEffect(() => {
    const unsubscribe = useTimerStore.subscribe(
      (state) => state.timeRemaining,
      (timeRemaining) => {
        if (gamePhaseRef.current === 'playing' && timeRemaining === 0) {
          setGamePhase('gameOver');
          endGame();
        }
      }
    );
    return unsubscribe;
  }, [endGame]);

  // Record stats when game ends
  useEffect(() => {
    const isGameOver = gamePhase === 'gameOver';
    const gameIdentifier = isGameOver ? `${score}-${foundWords.length}` : null;

    if (
      isGameOver &&
      localGameMode &&
      !isViewer &&
      gameIdentifier !== null &&
      lastRecordedGameRef.current !== gameIdentifier
    ) {
      lastRecordedGameRef.current = gameIdentifier;
      recordBoggleGame(score, foundWords.length, localGameMode === 'solo' ? 'solo' : 'multiplayer');
    }

    if (!isGameOver && lastRecordedGameRef.current !== null) {
      lastRecordedGameRef.current = null;
    }
  }, [gamePhase, localGameMode, isViewer, score, foundWords.length, recordBoggleGame]);

  // Handle page visibility changes for connection restoration
  useMultiplayerReconnection();

  const handleBack = useCallback(() => {
    stopTimer();
    navigate('/');
  }, [navigate, stopTimer]);

  const handleBackToLobby = useCallback(() => {
    stopTimer();
    resetGame();
    leaveSession();
    setLocalGameMode(null);
    setGamePhase('lobby');
  }, [stopTimer, resetGame, leaveSession]);

  const handleNewGame = useCallback(() => {
    setGamePhase('loading');
  }, []);

  const handleSubmit = useCallback(() => {
    submitWord();
  }, [submitWord]);

  const handleRotateLeft = useCallback(() => {
    if (rotationAnimation) return; // Prevent double-rotation
    setRotationAnimation('left');
  }, [rotationAnimation]);

  const handleRotateRight = useCallback(() => {
    if (rotationAnimation) return; // Prevent double-rotation
    setRotationAnimation('right');
  }, [rotationAnimation]);

  const handleRotationAnimationEnd = useCallback(() => {
    if (rotationAnimation) {
      rotateBoard(rotationAnimation);
      setRotationAnimation(null);
    }
  }, [rotationAnimation, rotateBoard]);

  // Game mode handlers - all transition to 'loading' phase
  const handlePlaySolo = useCallback(() => {
    setLocalGameMode('solo');
    setGamePhase('loading');
  }, []);

  const handleHost = useCallback(
    (pin?: string) => {
      hostGame('boggle', pin);
      setLocalGameMode('multiplayer');
      setGamePhase('loading');
    },
    [hostGame]
  );

  const handleJoin = useCallback(
    (code: string, pin?: string) => {
      joinGame('boggle', code, pin);
      setLocalGameMode('multiplayer');
      setGamePhase('loading');
    },
    [joinGame]
  );

  // Handle copy link to clipboard
  const handleCopyLink = useCallback((): void => {
    if (sessionCode) {
      const shareUrl = generateShareUrl(sessionCode);
      navigator.clipboard.writeText(shareUrl).then(() => {
        setCopyFeedback(true);
        setTimeout(() => setCopyFeedback(false), 2000);
      });
    }
  }, [sessionCode]);

  // Handle WhatsApp share
  const handleWhatsAppShare = useCallback((): void => {
    if (sessionCode) {
      const whatsappUrl = generateWhatsAppUrl(sessionCode, 'Boggle');
      window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    }
  }, [sessionCode]);

  // Get initial join code from URL
  const initialJoinCode = getJoinCodeFromUrl(searchParams);

  // Render based on game phase
  if (gamePhase === 'lobby') {
    return (
      <Lobby
        gameName="Boggle"
        gameDescription="Find words in a grid of letters"
        onHost={handleHost}
        onJoin={handleJoin}
        onPlaySolo={handlePlaySolo}
        onBack={handleBack}
        initialJoinCode={initialJoinCode}
      />
    );
  }

  if (gamePhase === 'loading' || !board) {
    return (
      <GameLayout gameId="boggle" gameName="Boggle" onBack={handleBackToLobby}>
        <div className="boggle-game">
          <div className="loading">Loading dictionary...</div>
        </div>
      </GameLayout>
    );
  }

  return (
    <GameLayout gameId="boggle" gameName="Boggle" onBack={handleBackToLobby}>
      <div className="boggle-game">
        {/* Connection status for multiplayer */}
        {localGameMode === 'multiplayer' && (
          <ErrorBoundary
            compact
            message="Connection status unavailable. The game may still work."
          >
            <div className="connection-status">
              {isHost && (
                <div className="session-info">
                  <span className="session-label">Share code:</span>
                  <span className="session-code">{sessionCode}</span>
                  {sessionPin && (
                    <span className="session-pin-indicator" title={`PIN: ${sessionPin}`}>
                      🔒
                    </span>
                  )}
                  <div className="share-buttons">
                    <button
                      className="share-btn copy"
                      onClick={handleCopyLink}
                      aria-label="Copy game link to clipboard"
                      title="Copy link"
                    >
                      {copyFeedback ? 'Copied!' : 'Copy Link'}
                    </button>
                    <button
                      className="share-btn whatsapp"
                      onClick={handleWhatsAppShare}
                      aria-label="Share game link via WhatsApp"
                      title="Share on WhatsApp"
                    >
                      WhatsApp
                    </button>
                  </div>
                  {partnerConnected ? (
                    <span className="partner-status connected">Partner connected</span>
                  ) : (
                    <span className="partner-status waiting">Waiting for partner...</span>
                  )}
                </div>
              )}
              {isViewer && (
                <div className="session-info">
                  <span className="viewer-label">Playing with partner</span>
                  {connectionStatus === 'connecting' && (
                    <span className="partner-status waiting">Connecting...</span>
                  )}
                  {connectionStatus === 'connected' && (
                    <span className="partner-status connected">Connected</span>
                  )}
                  {connectionStatus === 'error' && (
                    <span className="partner-status error">{errorMessage}</span>
                  )}
                </div>
              )}
            </div>
          </ErrorBoundary>
        )}

        <div className="boggle-game-bar">
          <div className="boggle-stats-row">
            <Timer timeRemaining={timeRemaining} />
            <div className="score-display">
              <strong>{score}</strong> pts
            </div>
          </div>
          <div className="boggle-controls">
            <button
              className="control-btn rotate-btn"
              onClick={handleRotateLeft}
              disabled={gamePhase === 'gameOver'}
              aria-label="Rotate board left 90 degrees"
              title="Rotate left"
            >
              <span className="rotate-icon">↺</span>
            </button>
            <button
              className="control-btn new-game-btn"
              onClick={handleNewGame}
              aria-label="Start a new game"
            >
              New Game
            </button>
            <button
              className="control-btn rotate-btn"
              onClick={handleRotateRight}
              disabled={gamePhase === 'gameOver'}
              aria-label="Rotate board right 90 degrees"
              title="Rotate right"
            >
              <span className="rotate-icon">↻</span>
            </button>
          </div>
        </div>

        <div className="boggle-content">
          <div className={`current-word${currentWord ? '' : ' current-word--empty'}`}>
            {currentWord || '\u00A0'}
          </div>
          <BoggleBoard
            board={board}
            selectedPath={currentPath}
            currentWord={currentWord}
            onTileSelect={selectTile}
            onSubmit={handleSubmit}
            disabled={gamePhase === 'gameOver'}
            rotationAnimation={rotationAnimation}
            onRotationAnimationEnd={handleRotationAnimationEnd}
            showCurrentWord={false}
          />
          <div className="boggle-sidebar">
            <WordList words={foundWords} totalScore={score} />
          </div>
        </div>

        {gamePhase === 'gameOver' && (
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
