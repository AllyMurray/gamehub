import Row from './Row';
import './Board.css';

const Board = ({ guesses, currentGuess, maxGuesses, wordLength, shake }) => {
  return (
    <div className="board">
      {Array(maxGuesses)
        .fill(null)
        .map((_, i) => {
          const isCurrentRow = i === guesses.length;
          return (
            <Row
              key={i}
              guess={guesses[i]}
              currentGuess={isCurrentRow ? currentGuess : ''}
              wordLength={wordLength}
              isCurrentRow={isCurrentRow}
              shake={isCurrentRow && shake}
            />
          );
        })}
    </div>
  );
};

export default Board;
