import './Tile.css';

const Tile = ({ letter, status, position }) => {
  const hasLetter = letter !== '';

  return (
    <div
      className={`tile ${status || ''} ${hasLetter && !status ? 'filled' : ''}`}
      style={{ animationDelay: status ? `${position * 100}ms` : '0ms' }}
    >
      {letter}
    </div>
  );
};

export default Tile;
