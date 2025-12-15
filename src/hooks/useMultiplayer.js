import { useState, useEffect, useRef, useCallback } from 'react';
import Peer from 'peerjs';

// Generate a short, readable session code
const generateSessionCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

export const useMultiplayer = () => {
  const [role, setRole] = useState(null); // 'host' | 'viewer' | null
  const [sessionCode, setSessionCode] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('disconnected'); // 'disconnected' | 'connecting' | 'connected' | 'error'
  const [errorMessage, setErrorMessage] = useState('');
  const [partnerConnected, setPartnerConnected] = useState(false);
  const [pendingSuggestion, setPendingSuggestion] = useState(null); // { word: string } from viewer

  const peerRef = useRef(null);
  const connectionRef = useRef(null);
  const gameStateCallbackRef = useRef(null);
  const suggestionResponseCallbackRef = useRef(null);
  const hostGameRef = useRef(null);

  // Cleanup peer connection
  const cleanup = useCallback(() => {
    if (connectionRef.current) {
      connectionRef.current.close();
      connectionRef.current = null;
    }
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
    setPartnerConnected(false);
    setPendingSuggestion(null);
  }, []);

  // Host a new game session
  const hostGame = useCallback(() => {
    cleanup();
    setRole('host');
    setConnectionStatus('connecting');
    setErrorMessage('');

    const code = generateSessionCode();
    const peerId = `wordle-${code}`;

    const peer = new Peer(peerId, {
      debug: 0,
    });

    peer.on('open', () => {
      setSessionCode(code);
      setConnectionStatus('connected');
    });

    peer.on('connection', (conn) => {
      // Close old connection if exists (for rejoin support)
      if (connectionRef.current) {
        connectionRef.current.close();
      }
      connectionRef.current = conn;
      setPendingSuggestion(null); // Clear any pending suggestion from old viewer

      conn.on('open', () => {
        setPartnerConnected(true);
      });

      conn.on('data', (data) => {
        if (data.type === 'request-state') {
          // State request handled by App.jsx useEffect
        } else if (data.type === 'suggest-word') {
          setPendingSuggestion({ word: data.word });
        } else if (data.type === 'clear-suggestion') {
          setPendingSuggestion(null);
        }
      });

      conn.on('close', () => {
        // Only set disconnected if this is still the current connection
        if (connectionRef.current === conn) {
          setPartnerConnected(false);
          setPendingSuggestion(null);
        }
      });

      conn.on('error', () => {
        if (connectionRef.current === conn) {
          setPartnerConnected(false);
          setPendingSuggestion(null);
        }
      });
    });

    peer.on('error', (err) => {
      console.error('Peer error:', err);
      if (err.type === 'unavailable-id') {
        // Session code already taken, try again
        setConnectionStatus('disconnected');
        setTimeout(() => hostGameRef.current?.(), 100);
      } else {
        setConnectionStatus('error');
        setErrorMessage('Connection error. Please try again.');
      }
    });

    peerRef.current = peer;
  }, [cleanup]);

  // Store hostGame in ref for self-reference in error handler
  useEffect(() => {
    hostGameRef.current = hostGame;
  }, [hostGame]);

  // Join an existing game session
  const joinGame = useCallback((code) => {
    cleanup();
    setRole('viewer');
    setConnectionStatus('connecting');
    setErrorMessage('');
    setSessionCode(code.toUpperCase());

    const peerId = `wordle-viewer-${Date.now()}`;
    const hostPeerId = `wordle-${code.toUpperCase()}`;

    const peer = new Peer(peerId, {
      debug: 0,
    });

    peer.on('open', () => {
      const conn = peer.connect(hostPeerId, { reliable: true });

      conn.on('open', () => {
        connectionRef.current = conn;
        setConnectionStatus('connected');
        setPartnerConnected(true);

        // Request initial game state
        conn.send({ type: 'request-state' });
      });

      conn.on('data', (data) => {
        if (data.type === 'game-state' && gameStateCallbackRef.current) {
          gameStateCallbackRef.current(data.state);
        } else if (data.type === 'suggestion-accepted' || data.type === 'suggestion-rejected') {
          if (suggestionResponseCallbackRef.current) {
            suggestionResponseCallbackRef.current(data.type === 'suggestion-accepted');
          }
        }
      });

      conn.on('close', () => {
        setConnectionStatus('disconnected');
        setPartnerConnected(false);
        setErrorMessage('Host disconnected');
      });

      conn.on('error', () => {
        setConnectionStatus('error');
        setErrorMessage('Connection lost');
      });
    });

    peer.on('error', (err) => {
      console.error('Peer error:', err);
      setConnectionStatus('error');
      if (err.type === 'peer-unavailable') {
        setErrorMessage('Game not found. Check the code and try again.');
      } else {
        setErrorMessage('Connection error. Please try again.');
      }
    });

    peerRef.current = peer;
  }, [cleanup]);

  // Send game state to viewer (called by host)
  const sendGameState = useCallback((state) => {
    if (role === 'host' && connectionRef.current && connectionRef.current.open) {
      connectionRef.current.send({ type: 'game-state', state });
    }
  }, [role]);

  // Register callback for receiving game state (used by viewer)
  const onGameStateReceived = useCallback((callback) => {
    gameStateCallbackRef.current = callback;
  }, []);

  // Send a word suggestion to host (called by viewer)
  const sendSuggestion = useCallback((word) => {
    if (role === 'viewer' && connectionRef.current && connectionRef.current.open) {
      connectionRef.current.send({ type: 'suggest-word', word });
    }
  }, [role]);

  // Clear suggestion on host (called by viewer when typing changes)
  const clearSuggestion = useCallback(() => {
    if (role === 'viewer' && connectionRef.current && connectionRef.current.open) {
      connectionRef.current.send({ type: 'clear-suggestion' });
    }
  }, [role]);

  // Accept the pending suggestion (called by host)
  const acceptSuggestion = useCallback(() => {
    if (role === 'host' && connectionRef.current && connectionRef.current.open && pendingSuggestion) {
      connectionRef.current.send({ type: 'suggestion-accepted' });
      const word = pendingSuggestion.word;
      setPendingSuggestion(null);
      return word;
    }
    return null;
  }, [role, pendingSuggestion]);

  // Reject the pending suggestion (called by host)
  const rejectSuggestion = useCallback(() => {
    if (role === 'host' && connectionRef.current && connectionRef.current.open) {
      connectionRef.current.send({ type: 'suggestion-rejected' });
      setPendingSuggestion(null);
    }
  }, [role]);

  // Register callback for suggestion response (used by viewer)
  const onSuggestionResponse = useCallback((callback) => {
    suggestionResponseCallbackRef.current = callback;
  }, []);

  // Leave the current session
  const leaveSession = useCallback(() => {
    cleanup();
    setRole(null);
    setSessionCode('');
    setConnectionStatus('disconnected');
    setErrorMessage('');
  }, [cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  return {
    role,
    sessionCode,
    connectionStatus,
    errorMessage,
    partnerConnected,
    pendingSuggestion,
    hostGame,
    joinGame,
    leaveSession,
    sendGameState,
    onGameStateReceived,
    sendSuggestion,
    clearSuggestion,
    acceptSuggestion,
    rejectSuggestion,
    onSuggestionResponse,
    isHost: role === 'host',
    isViewer: role === 'viewer',
    isConnected: connectionStatus === 'connected',
  };
};
