import { memo } from 'react';
import { calculateWordScore } from '../scoring';
import './WordList.css';

interface WordListProps {
  words: string[];
  totalScore: number;
}

export const WordList = memo(function WordList({ words, totalScore }: WordListProps) {
  if (words.length === 0) {
    return (
      <div className="word-list word-list--empty">
        <p>No words found yet</p>
        <p className="hint">Drag across tiles to form words</p>
      </div>
    );
  }

  return (
    <div className="word-list">
      <div className="word-list__header">
        <span className="word-list__title">Found Words ({words.length})</span>
        <span className="word-list__score">Score: {totalScore}</span>
      </div>
      <ul className="word-list__items">
        {words.map((word) => (
          <li key={word} className="word-list__item">
            <span className="word-list__word">{word}</span>
            <span className="word-list__points">+{calculateWordScore(word)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
});
