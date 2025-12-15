import { useState, type KeyboardEvent, type ChangeEvent } from 'react';
import './Lobby.css';

interface LobbyProps {
  onHost: () => void;
  onJoin: (code: string) => void;
  onPlaySolo: () => void;
}

const Lobby = ({ onHost, onJoin, onPlaySolo }: LobbyProps) => {
  const [joinCode, setJoinCode] = useState('');
  const [showJoin, setShowJoin] = useState(false);

  const handleJoin = (): void => {
    if (joinCode.trim().length === 6) {
      onJoin(joinCode.trim().toUpperCase());
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      handleJoin();
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setJoinCode(e.target.value.toUpperCase().slice(0, 6));
  };

  return (
    <div className="lobby" role="main" aria-label="Wordle game lobby">
      <div className="lobby-content">
        <h1 className="lobby-title">Wordle</h1>
        <p className="lobby-subtitle">Play together with a partner</p>

        <div className="lobby-buttons" role="group" aria-label="Game mode selection">
          <button
            className="lobby-btn primary"
            onClick={onPlaySolo}
            aria-label="Play solo game"
          >
            Play Solo
          </button>

          <button
            className="lobby-btn host"
            onClick={onHost}
            aria-label="Host a multiplayer game"
          >
            Host Game
          </button>

          {!showJoin ? (
            <button
              className="lobby-btn join"
              onClick={() => setShowJoin(true)}
              aria-label="Join an existing multiplayer game"
            >
              Join Game
            </button>
          ) : (
            <div
              className="join-input-container"
              role="group"
              aria-label="Join game form"
            >
              <label htmlFor="join-code" className="sr-only">
                Enter 6-character session code
              </label>
              <input
                id="join-code"
                type="text"
                className="join-input"
                placeholder="Enter 6-digit code"
                value={joinCode}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                maxLength={6}
                autoFocus
                aria-describedby="join-code-hint"
              />
              <span id="join-code-hint" className="sr-only">
                {joinCode.length} of 6 characters entered
              </span>
              <div className="join-actions">
                <button
                  className="lobby-btn join-confirm"
                  onClick={handleJoin}
                  disabled={joinCode.length !== 6}
                  aria-label="Confirm and join game"
                >
                  Join
                </button>
                <button
                  className="lobby-btn cancel"
                  onClick={() => {
                    setShowJoin(false);
                    setJoinCode('');
                  }}
                  aria-label="Cancel joining game"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Lobby;
