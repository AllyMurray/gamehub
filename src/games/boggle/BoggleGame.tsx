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

export default function BoggleGame() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [copyFeedback, setCopyFeedback] = useState(false);

  // Local game mode state (separate from global UI store for Boggle)
  const [localGameMode, setLocalGameMode] = useState<GameMode>(null);

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
  const resetGame = useBoggleStore((s) => s.resetGame);

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

  // Track if timer has been started (to avoid false "time up" on initial load)
  const timerHasStartedRef = useRef(false);

  const isHost = role === 'host';
  const isViewer = role === 'viewer';

  // Start game when entering a mode
  useEffect(() => {
    if (localGameMode && !board) {
      initGame().then(() => {
        timerHasStartedRef.current = true;
        startTimer(GAME_DURATION);
      });
    }
  }, [localGameMode, board, initGame, startTimer]);

  // End game when timer reaches zero (only if timer was actually started)
  useEffect(() => {
    if (timeRemaining === 0 && !gameOver && !isLoading && localGameMode && timerHasStartedRef.current) {
      timerHasStartedRef.current = false;
      endGame();
    }
  }, [timeRemaining, gameOver, isLoading, localGameMode, endGame]);

  // Record stats when game ends
  useEffect(() => {
    const gameIdentifier = gameOver ? `${score}-${foundWords.length}` : null;

    if (
      gameOver &&
      localGameMode &&
      !isViewer &&
      gameIdentifier !== null &&
      lastRecordedGameRef.current !== gameIdentifier
    ) {
      lastRecordedGameRef.current = gameIdentifier;
      recordBoggleGame(score, foundWords.length, localGameMode === 'solo' ? 'solo' : 'multiplayer');
    }

    if (!gameOver && lastRecordedGameRef.current !== null) {
      lastRecordedGameRef.current = null;
    }
  }, [gameOver, localGameMode, isViewer, score, foundWords.length, recordBoggleGame]);

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
  }, [stopTimer, resetGame, leaveSession]);

  const handleNewGame = useCallback(() => {
    initGame().then(() => {
      timerHasStartedRef.current = true;
      startTimer(GAME_DURATION);
    });
  }, [initGame, startTimer]);

  const handleSubmit = useCallback(() => {
    submitWord();
  }, [submitWord]);

  // Game mode handlers
  const handlePlaySolo = useCallback(() => {
    setLocalGameMode('solo');
  }, []);

  const handleHost = useCallback(
    (pin?: string) => {
      hostGame('boggle', pin);
      setLocalGameMode('multiplayer');
    },
    [hostGame]
  );

  const handleJoin = useCallback(
    (code: string, pin?: string) => {
      joinGame('boggle', code, pin);
      setLocalGameMode('multiplayer');
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

  // Show lobby if no game mode selected
  if (!localGameMode) {
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

  // Loading state
  if (isLoading || !board) {
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
