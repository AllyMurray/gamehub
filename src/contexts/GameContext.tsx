/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, type ReactNode } from 'react';
import { useGameSession, type UseGameSessionReturn } from '../hooks/useGameSession';
import {
  useStatsStore,
  useUIStore,
} from '../stores';
import type { GameMode, ConnectionStatus, GameStatistics } from '../types';

// Stats return type (for backwards compatibility)
interface StatsReturn {
  stats: GameStatistics;
  winPercentage: number;
  recordGame: (won: boolean, guessCount: number, gameMode: Exclude<GameMode, null>) => void;
  resetStats: () => void;
  maxDistributionValue: number;
}

// Context value type - exposes game mode and multiplayer status
export interface GameContextValue {
  // Game mode
  gameMode: GameMode;

  // Multiplayer status (commonly accessed across components)
  isHost: boolean;
  isViewer: boolean;
  partnerConnected: boolean;
  sessionCode: string;
  sessionPin: string;
  connectionStatus: ConnectionStatus;

  // Statistics
  stats: StatsReturn;
  isStatsOpen: boolean;
  openStats: () => void;
  closeStats: () => void;

  // Full session (for components that need everything)
  session: UseGameSessionReturn;
}

// Create context with undefined default (will be provided by GameProvider)
const GameContext = createContext<GameContextValue | undefined>(undefined);

// Provider props
interface GameProviderProps {
  children: ReactNode;
}

/**
 * GameProvider component - wraps children and provides game context.
 *
 * This provider integrates with Zustand stores while maintaining
 * backwards compatibility with components that use useGameContext().
 *
 * Note: Components can also access stores directly via:
 * - useGameStore() for game state
 * - useMultiplayerStore() for multiplayer state
 * - useStatsStore() for statistics
 * - useUIStore() for UI state
 */
export const GameProvider = ({ children }: GameProviderProps) => {
  const session = useGameSession();

  // Stats from Zustand store
  const statsData = useStatsStore((s) => s.stats);
  const recordGame = useStatsStore((s) => s.recordGame);
  const resetStats = useStatsStore((s) => s.resetStats);

  // UI state from Zustand store
  const isStatsOpen = useUIStore((s) => s.isStatsOpen);
  const openStats = useUIStore((s) => s.openStats);
  const closeStats = useUIStore((s) => s.closeStats);

  // Calculate derived stats
  const winPercentage =
    statsData.gamesPlayed > 0
      ? Math.round((statsData.gamesWon / statsData.gamesPlayed) * 100)
      : 0;
  const maxDistributionValue = Math.max(...statsData.guessDistribution, 1);

  const stats: StatsReturn = {
    stats: statsData,
    winPercentage,
    recordGame,
    resetStats,
    maxDistributionValue,
  };

  const value: GameContextValue = {
    // Game mode
    gameMode: session.gameMode,

    // Multiplayer status shortcuts for easy access
    isHost: session.isHost,
    isViewer: session.isViewer,
    partnerConnected: session.partnerConnected,
    sessionCode: session.sessionCode,
    sessionPin: session.sessionPin,
    connectionStatus: session.connectionStatus as ConnectionStatus,

    // Statistics
    stats,
    isStatsOpen,
    openStats,
    closeStats,

    // Full session for components that need complete access
    session,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};

// Custom hook to use game context
export const useGameContext = (): GameContextValue => {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGameContext must be used within a GameProvider');
  }
  return context;
};
