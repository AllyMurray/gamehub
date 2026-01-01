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

  const handlePointerDown = useCallback(
    (event: React.PointerEvent, row: number, col: number) => {
      if (disabled) return;
      isDraggingRef.current = true;
      setIsSelecting(true);
      // Capture pointer to receive events even when pointer leaves the board
      (event.target as HTMLElement).setPointerCapture(event.pointerId);
      onTileSelect({ row, col });
    },
    [disabled, onTileSelect]
  );

  const handlePointerEnter = useCallback(
    (row: number, col: number) => {
      if (disabled || !isDraggingRef.current) return;
      onTileSelect({ row, col });
    },
    [disabled, onTileSelect]
  );

  const handlePointerUp = useCallback(
    (event: React.PointerEvent) => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        setIsSelecting(false);
        // Release pointer capture
        (event.target as HTMLElement).releasePointerCapture(event.pointerId);
        if (selectedPath.length >= 3) {
          onSubmit();
        }
      }
    },
    [selectedPath.length, onSubmit]
  );

  return (
    <div className="boggle-board-container">
      {currentWord && <div className="current-word">{currentWord}</div>}
      <div
        ref={boardRef}
        className={`boggle-board ${isSelecting ? 'boggle-board--selecting' : ''}`}
        role="grid"
        aria-label="Boggle board"
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
                  onPointerDown={(e) => handlePointerDown(e, rowIndex, colIndex)}
                  onPointerEnter={() => handlePointerEnter(rowIndex, colIndex)}
                  onPointerUp={handlePointerUp}
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
