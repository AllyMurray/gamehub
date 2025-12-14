import Tile from './Tile';
import './Row.css';

const Row = ({ guess, currentGuess, wordLength, isCurrentRow, shake }) => {
  // If this row has a submitted guess
  if (guess) {
    return (
      <div className="row">
        {guess.word.split('').map((letter, i) => (
          <Tile key={i} letter={letter} status={guess.status[i]} position={i} />
        ))}
      </div>
    );
  }

  // If this is the current row being typed
  if (isCurrentRow) {
    const letters = currentGuess.split('');
    return (
      <div className={`row ${shake ? 'shake' : ''}`}>
        {Array(wordLength)
          .fill('')
          .map((_, i) => (
            <Tile key={i} letter={letters[i] || ''} isCurrentRow={true} position={i} />
          ))}
      </div>
    );
  }

  // Empty row
  return (
    <div className="row">
      {Array(wordLength)
        .fill('')
        .map((_, i) => (
          <Tile key={i} letter="" position={i} />
        ))}
    </div>
  );
};

export default Row;
