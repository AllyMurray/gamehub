import type { ReactNode } from 'react';
import ThemeToggle from '../ThemeToggle';
import './GameLayout.css';

interface GameLayoutProps {
  gameId: string;
  gameName: string;
  children: ReactNode;
  onBack: () => void;
  headerActions?: ReactNode;
}

export function GameLayout({
  gameName,
  children,
  onBack,
  headerActions,
}: GameLayoutProps) {
  return (
    <div className="game-layout">
      <header className="game-header">
        <button onClick={onBack} className="back-button" aria-label="Back to dashboard">
          ← Back
        </button>
        <h1>{gameName}</h1>
        <div className="header-actions">
          {headerActions}
          <ThemeToggle />
        </div>
      </header>
      <main className="game-main">{children}</main>
    </div>
  );
}
