import { memo, useCallback, useState } from 'react';
import { calculateWordScore } from '../scoring';
import './AllWordsList.css';

interface AllWordsListProps {
  possibleWords: string[];
  foundWords: string[];
  selectedWord: string | null;
  onWordSelect: (word: string | null) => void;
}

export const AllWordsList = memo(function AllWordsList({
  possibleWords,
  foundWords,
  selectedWord,
  onWordSelect,
}: AllWordsListProps) {
  const [showMissed, setShowMissed] = useState(true);
  const foundSet = new Set(foundWords);
  const missedWords = possibleWords.filter((word) => !foundSet.has(word));

  const handleWordClick = useCallback(
    (word: string) => {
      if (selectedWord === word) {
        onWordSelect(null);
      } else {
        onWordSelect(word);
      }
    },
    [selectedWord, onWordSelect]
  );

  return (
    <div className="all-words-list">
      <div className="all-words-list__header">
        <span className="all-words-list__title">All Words</span>
        <span className="all-words-list__stats">
          {foundWords.length} / {possibleWords.length}
        </span>
      </div>

      <div className="all-words-list__tabs">
        <button
          className={`all-words-list__tab ${!showMissed ? 'all-words-list__tab--active' : ''}`}
          onClick={() => setShowMissed(false)}
        >
          Found ({foundWords.length})
        </button>
        <button
          className={`all-words-list__tab ${showMissed ? 'all-words-list__tab--active' : ''}`}
          onClick={() => setShowMissed(true)}
        >
          Missed ({missedWords.length})
        </button>
      </div>

      <ul className="all-words-list__items">
        {(showMissed ? missedWords : foundWords).map((word) => (
          <li key={word}>
            <button
              className={`all-words-list__item ${selectedWord === word ? 'all-words-list__item--selected' : ''} ${!showMissed ? 'all-words-list__item--found' : ''}`}
              onClick={() => handleWordClick(word)}
            >
              <span className="all-words-list__word">{word}</span>
              <span className="all-words-list__points">+{calculateWordScore(word)}</span>
            </button>
          </li>
        ))}
      </ul>

      {selectedWord && (
        <div className="all-words-list__hint">Tap word again to deselect</div>
      )}
    </div>
  );
});
