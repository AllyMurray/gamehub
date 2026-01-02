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
}

export const BoggleBoard = memo(function BoggleBoard({
  board,
  selectedPath,
  currentWord,
  onTileSelect,
  onSubmit,
  disabled,
}: BoggleBoardProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const lastTileRef = useRef<{ row: number; col: number } | null>(null);
  const pointerIdRef = useRef<number | null>(null);
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
      const element = document.elementFromPoint(x, y);
      if (!element) return null;

      // Find the tile button (could be the button or a child span)
      const tile = element.closest('.boggle-tile') as HTMLElement | null;
      if (!tile) return null;

      // Get position from data attributes
      const row = tile.dataset.row;
      const col = tile.dataset.col;
      if (row === undefined || col === undefined) return null;

      return { row: parseInt(row, 10), col: parseInt(col, 10) };
    },
    []
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent, row: number, col: number) => {
      if (disabled) return;
      event.preventDefault();
      isDraggingRef.current = true;
      lastTileRef.current = { row, col };
      pointerIdRef.current = event.pointerId;
      setIsSelecting(true);
      // Capture pointer on the board container to receive all events
      boardRef.current?.setPointerCapture(event.pointerId);
      onTileSelect({ row, col });
    },
    [disabled, onTileSelect]
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent) => {
      if (disabled || !isDraggingRef.current) return;

      const tile = getTileFromPoint(event.clientX, event.clientY);
      if (!tile) return;

      // Only trigger if we moved to a different tile
      const last = lastTileRef.current;
      if (last && last.row === tile.row && last.col === tile.col) return;

      lastTileRef.current = tile;
      onTileSelect({ row: tile.row, col: tile.col });
    },
    [disabled, onTileSelect, getTileFromPoint]
  );

  const handlePointerUp = useCallback(() => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      lastTileRef.current = null;
      setIsSelecting(false);
      // Release pointer capture from board
      if (pointerIdRef.current !== null) {
        boardRef.current?.releasePointerCapture(pointerIdRef.current);
        pointerIdRef.current = null;
      }
      if (selectedPath.length >= 3) {
        onSubmit();
      }
    }
  }, [selectedPath.length, onSubmit]);

  return (
    <div className="boggle-board-container">
      {currentWord && <div className="current-word">{currentWord}</div>}
      <div
        ref={boardRef}
        className={`boggle-board ${isSelecting ? 'boggle-board--selecting' : ''}`}
        role="grid"
        aria-label="Boggle board"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
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
