import { memo, useCallback, useRef, useState } from 'react';
import type { BoggleBoard as BoggleBoardType, Position } from '../types';
import './BoggleBoard.css';

interface BoggleBoardProps {
  board: BoggleBoardType;
  selectedPath: Position[];
  currentWord: string;
  onTileSelect: (pos: Position) => void;
  onSubmit: () => void;
  disabled?: boolean;
  rotationAnimation?: 'left' | 'right' | null;
  onRotationAnimationEnd?: () => void;
  showCurrentWord?: boolean;
}

export const BoggleBoard = memo(function BoggleBoard({
  board,
  selectedPath,
  currentWord,
  onTileSelect,
  onSubmit,
  disabled,
  rotationAnimation,
  onRotationAnimationEnd,
  showCurrentWord = true,
}: BoggleBoardProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const lastTileRef = useRef<{ row: number; col: number } | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const draggedToMultipleTilesRef = useRef(false);
  const [isSelecting, setIsSelecting] = useState(false);

  const isSelected = useCallback(
    (row: number, col: number): boolean => {
      return selectedPath.some((p) => p.row === row && p.col === col);
    },
    [selectedPath]
  );

  const getSelectionIndex = useCallback(
    (row: number, col: number): number => {
      return selectedPath.findIndex((p) => p.row === row && p.col === col);
    },
    [selectedPath]
  );

  const getTileFromPoint = useCallback(
    (x: number, y: number): { row: number; col: number } | null => {
      const board = boardRef.current;
      if (!board) return null;

      const rect = board.getBoundingClientRect();
      const relX = x - rect.left;
      const relY = y - rect.top;

      // Get computed styles for accurate measurements
      const style = getComputedStyle(board);
      const padding = parseFloat(style.paddingLeft) || 12; // var(--space-3)
      const gap = 6; // From CSS
      const gridSize = 4;

      // Calculate tile size from available space
      const availableSpace = rect.width - padding * 2;
      const tileSize = (availableSpace - gap * (gridSize - 1)) / gridSize;

      // Calculate which tile based on position
      const col = Math.floor((relX - padding) / (tileSize + gap));
      const row = Math.floor((relY - padding) / (tileSize + gap));

      // Validate bounds
      if (row < 0 || row >= gridSize || col < 0 || col >= gridSize) {
        return null;
      }

      return { row, col };
    },
    []
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent, row: number, col: number) => {
      if (disabled) return;
      event.preventDefault();

      // Check if clicking on the last selected tile - this submits the word
      const lastInPath = selectedPath.length > 0 ? selectedPath[selectedPath.length - 1] : null;
      if (lastInPath && lastInPath.row === row && lastInPath.col === col) {
        if (selectedPath.length >= 3) {
          onSubmit();
        }
        return;
      }

      isDraggingRef.current = true;
      lastTileRef.current = { row, col };
      pointerIdRef.current = event.pointerId;
      draggedToMultipleTilesRef.current = false;
      setIsSelecting(true);
      // Capture pointer on the board container to receive all events
      boardRef.current?.setPointerCapture(event.pointerId);
      onTileSelect({ row, col });
    },
    [disabled, onTileSelect, selectedPath, onSubmit]
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent) => {
      if (disabled || !isDraggingRef.current) return;

      const tile = getTileFromPoint(event.clientX, event.clientY);
      if (!tile) return;

      // Only trigger if we moved to a different tile
      const last = lastTileRef.current;
      if (last && last.row === tile.row && last.col === tile.col) return;

      // Track that user actually dragged to multiple tiles
      draggedToMultipleTilesRef.current = true;
      lastTileRef.current = tile;
      onTileSelect({ row: tile.row, col: tile.col });
    },
    [disabled, onTileSelect, getTileFromPoint]
  );

  const handlePointerUp = useCallback(() => {
    if (isDraggingRef.current) {
      const didDragMultiple = draggedToMultipleTilesRef.current;
      isDraggingRef.current = false;
      lastTileRef.current = null;
      draggedToMultipleTilesRef.current = false;
      setIsSelecting(false);
      // Release pointer capture from board
      if (pointerIdRef.current !== null) {
        boardRef.current?.releasePointerCapture(pointerIdRef.current);
        pointerIdRef.current = null;
      }
      // Only auto-submit if user actually dragged to select multiple tiles
      // Individual clicks should add to path without auto-submitting
      if (didDragMultiple && selectedPath.length >= 3) {
        onSubmit();
      }
    }
  }, [selectedPath.length, onSubmit]);

  return (
    <div className="boggle-board-container">
      {showCurrentWord && (
        <div className={`current-word${currentWord ? '' : ' current-word--empty'}`}>
          {currentWord || '\u00A0'}
        </div>
      )}
      <div
        ref={boardRef}
        className={`boggle-board ${isSelecting ? 'boggle-board--selecting' : ''}${rotationAnimation === 'left' ? ' boggle-board--rotate-left' : ''}${rotationAnimation === 'right' ? ' boggle-board--rotate-right' : ''}`}
        role="grid"
        aria-label="Boggle board"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onAnimationEnd={onRotationAnimationEnd}
      >
        {board.grid.map((row, rowIndex) => (
          <div key={rowIndex} className="boggle-row" role="row">
            {row.map((letter, colIndex) => {
              const selected = isSelected(rowIndex, colIndex);
              const selectionIndex = getSelectionIndex(rowIndex, colIndex);

              return (
                <button
                  key={colIndex}
                  className={`boggle-tile ${selected ? 'boggle-tile--selected' : ''}`}
                  data-row={rowIndex}
                  data-col={colIndex}
                  onPointerDown={(e) => handlePointerDown(e, rowIndex, colIndex)}
                  disabled={disabled}
                  role="gridcell"
                  aria-label={`${letter}${selected ? ', selected' : ''}`}
                >
                  <span className="boggle-tile__letter">{letter}</span>
                  {selected && (
                    <span className="boggle-tile__index">{selectionIndex + 1}</span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
});
