import type { GameMetadata, GameId } from './types';

/**
 * Static metadata for all games. Used by dashboard only.
 * Games are lazy-loaded separately - this doesn't import game modules.
 */
export const gameRegistry: GameMetadata[] = [
  {
    id: 'wordle',
    name: 'Wordle',
    description: 'Guess the 5-letter word in 6 tries',
    icon: '🟩',
    route: '/wordle',
    supportsSinglePlayer: true,
    supportsMultiplayer: true,
  },
  {
    id: 'boggle',
    name: 'Boggle',
    description: 'Find as many words as you can in 3 minutes',
    icon: '🔤',
    route: '/boggle',
    supportsSinglePlayer: true,
    supportsMultiplayer: true,
  },
];

export const getGameMetadata = (id: GameId): GameMetadata | undefined =>
  gameRegistry.find((g) => g.id === id);

export const getAllGames = (): GameMetadata[] => gameRegistry;
