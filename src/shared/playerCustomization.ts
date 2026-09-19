export const AVATAR_CATEGORIES = [
  { id: 'animals', label: 'Animals' },
  { id: 'robots', label: 'Robots' },
  { id: 'fantasy', label: 'Fantasy' },
  { id: 'space', label: 'Space' },
  { id: 'food', label: 'Food' },
  { id: 'monsters', label: 'Monsters' },
  { id: 'objects', label: 'Objects' },
  { id: 'retro', label: 'Retro' },
  { id: 'weird', label: 'Weird' },
  { id: 'abstract', label: 'Abstract' }
] as const;

export type AvatarCategoryId = typeof AVATAR_CATEGORIES[number]['id'];

export interface AvatarOption {
  id: string;
  label: string;
  category: AvatarCategoryId;
  fallback: string;
  primary: string;
  secondary: string;
  variant: number;
}

export const AVATAR_CATALOG: readonly AvatarOption[] = [
  { id: 'fox', label: 'Fox', category: 'animals', fallback: '🦊', primary: '#ff8a4c', secondary: '#fff0d9', variant: 0 },
  { id: 'owl', label: 'Owl', category: 'animals', fallback: '🦉', primary: '#a77b5b', secondary: '#f4dfb6', variant: 1 },
  { id: 'frog', label: 'Frog', category: 'animals', fallback: '🐸', primary: '#5ed17d', secondary: '#d7ffd9', variant: 2 },
  { id: 'shark', label: 'Shark', category: 'animals', fallback: '🦈', primary: '#5c9fd6', secondary: '#d8eefc', variant: 3 },
  { id: 'panda', label: 'Panda', category: 'animals', fallback: '🐼', primary: '#e9eef2', secondary: '#17283a', variant: 4 },

  { id: 'bot-atlas', label: 'Atlas Bot', category: 'robots', fallback: '🤖', primary: '#7eb6ff', secondary: '#d9f3ff', variant: 0 },
  { id: 'bot-bolt', label: 'Bolt Bot', category: 'robots', fallback: '⚙️', primary: '#f0b84f', secondary: '#fff3c4', variant: 1 },
  { id: 'bot-cube', label: 'Cube Bot', category: 'robots', fallback: '🧊', primary: '#72e2d1', secondary: '#d7fff8', variant: 2 },
  { id: 'bot-scout', label: 'Scout Bot', category: 'robots', fallback: '📡', primary: '#c49cff', secondary: '#f1e6ff', variant: 3 },
  { id: 'bot-byte', label: 'Byte Bot', category: 'robots', fallback: '💾', primary: '#ff7fb1', secondary: '#ffe1ed', variant: 4 },

  { id: 'mage', label: 'Mage', category: 'fantasy', fallback: '🧙', primary: '#7f6cf2', secondary: '#e7e1ff', variant: 0 },
  { id: 'knight', label: 'Knight', category: 'fantasy', fallback: '🛡️', primary: '#6d8ca7', secondary: '#e6edf4', variant: 1 },
  { id: 'dragon', label: 'Dragon', category: 'fantasy', fallback: '🐉', primary: '#4bc58e', secondary: '#d9ffec', variant: 2 },
  { id: 'rune', label: 'Rune Spirit', category: 'fantasy', fallback: '🔮', primary: '#b16ce6', secondary: '#f4ddff', variant: 3 },
  { id: 'crown', label: 'Crownling', category: 'fantasy', fallback: '👑', primary: '#f0bd46', secondary: '#fff2bd', variant: 4 },

  { id: 'astro', label: 'Astronaut', category: 'space', fallback: '🧑‍🚀', primary: '#d9e4ef', secondary: '#76b5ff', variant: 0 },
  { id: 'alien', label: 'Alien', category: 'space', fallback: '👽', primary: '#83e58b', secondary: '#d9ffdc', variant: 1 },
  { id: 'comet', label: 'Comet', category: 'space', fallback: '☄️', primary: '#ff9b55', secondary: '#ffe0b8', variant: 2 },
  { id: 'satellite', label: 'Satellite', category: 'space', fallback: '🛰️', primary: '#839ab7', secondary: '#e3edf8', variant: 3 },
  { id: 'planet', label: 'Planet', category: 'space', fallback: '🪐', primary: '#8b7be8', secondary: '#ffc86b', variant: 4 },

  { id: 'taco', label: 'Taco', category: 'food', fallback: '🌮', primary: '#efbb5c', secondary: '#78c66b', variant: 0 },
  { id: 'donut', label: 'Donut', category: 'food', fallback: '🍩', primary: '#e782a9', secondary: '#ffd9e8', variant: 1 },
  { id: 'sushi', label: 'Sushi', category: 'food', fallback: '🍣', primary: '#f47f73', secondary: '#fff3e2', variant: 2 },
  { id: 'pizza', label: 'Pizza', category: 'food', fallback: '🍕', primary: '#efb84c', secondary: '#d7594b', variant: 3 },
  { id: 'berry', label: 'Berry', category: 'food', fallback: '🍓', primary: '#dd4b64', secondary: '#8dda77', variant: 4 },

  { id: 'ghost', label: 'Ghost', category: 'monsters', fallback: '👻', primary: '#d7e6f4', secondary: '#8eb1cc', variant: 0 },
  { id: 'cyclops', label: 'Cyclops', category: 'monsters', fallback: '👁️', primary: '#8a72d6', secondary: '#ffe05c', variant: 1 },
  { id: 'slime', label: 'Slime', category: 'monsters', fallback: '🟢', primary: '#58d58d', secondary: '#d7ffe8', variant: 2 },
  { id: 'horned', label: 'Horned Beast', category: 'monsters', fallback: '👹', primary: '#d95d66', secondary: '#ffd0d4', variant: 3 },
  { id: 'yeti', label: 'Yeti', category: 'monsters', fallback: '❄️', primary: '#d8edf5', secondary: '#65a9c9', variant: 4 },

  { id: 'camera', label: 'Camera', category: 'objects', fallback: '📷', primary: '#667b91', secondary: '#d9e5ee', variant: 0 },
  { id: 'cassette', label: 'Cassette', category: 'objects', fallback: '📼', primary: '#8f7bd7', secondary: '#e9e1ff', variant: 1 },
  { id: 'lamp', label: 'Lamp', category: 'objects', fallback: '💡', primary: '#f0c54d', secondary: '#fff0a8', variant: 2 },
  { id: 'trophy', label: 'Trophy', category: 'objects', fallback: '🏆', primary: '#e6b341', secondary: '#fff0a8', variant: 3 },
  { id: 'boombox', label: 'Boombox', category: 'objects', fallback: '📻', primary: '#d15f8f', secondary: '#ffd9e8', variant: 4 },

  { id: 'pixel-hero', label: 'Pixel Hero', category: 'retro', fallback: '🕹️', primary: '#65c6ff', secondary: '#dff5ff', variant: 0 },
  { id: 'joystick', label: 'Joystick', category: 'retro', fallback: '🕹️', primary: '#db5e6e', secondary: '#ffe0e4', variant: 1 },
  { id: 'arcade', label: 'Arcade', category: 'retro', fallback: '🎮', primary: '#8f70e8', secondary: '#eae0ff', variant: 2 },
  { id: 'pixel-alien', label: 'Pixel Alien', category: 'retro', fallback: '👾', primary: '#7fda73', secondary: '#e1ffdc', variant: 3 },
  { id: 'floppy', label: 'Floppy', category: 'retro', fallback: '💾', primary: '#5579c8', secondary: '#dfe8ff', variant: 4 },

  { id: 'eyeball', label: 'Eyeball', category: 'weird', fallback: '👁️', primary: '#f3eadc', secondary: '#6ac2ef', variant: 0 },
  { id: 'sock', label: 'Sock', category: 'weird', fallback: '🧦', primary: '#e6718e', secondary: '#ffdce5', variant: 1 },
  { id: 'cloud', label: 'Cloud', category: 'weird', fallback: '☁️', primary: '#dbe9f2', secondary: '#8cc0dd', variant: 2 },
  { id: 'noodle', label: 'Noodle', category: 'weird', fallback: '🍜', primary: '#f0b453', secondary: '#fff0bd', variant: 3 },
  { id: 'cone', label: 'Cone', category: 'weird', fallback: '🔺', primary: '#ff875c', secondary: '#ffe1d4', variant: 4 },

  { id: 'prism', label: 'Prism', category: 'abstract', fallback: '🔷', primary: '#67bfff', secondary: '#c8eaff', variant: 0 },
  { id: 'orb', label: 'Orb', category: 'abstract', fallback: '🔵', primary: '#6f83f3', secondary: '#dce1ff', variant: 1 },
  { id: 'spark', label: 'Spark', category: 'abstract', fallback: '✨', primary: '#f0c752', secondary: '#fff2b7', variant: 2 },
  { id: 'wave', label: 'Wave', category: 'abstract', fallback: '🌊', primary: '#49b8d7', secondary: '#d6f7ff', variant: 3 },
  { id: 'void', label: 'Void', category: 'abstract', fallback: '⚫', primary: '#5d4d8c', secondary: '#b4a6e8', variant: 4 }
];

export const PLAYER_ACCENTS = [
  { color: '#ffd166', label: 'Gold' },
  { color: '#5eead4', label: 'Mint' },
  { color: '#93c5fd', label: 'Sky' },
  { color: '#f9a8d4', label: 'Rose' },
  { color: '#c4b5fd', label: 'Violet' },
  { color: '#fb923c', label: 'Orange' },
  { color: '#86efac', label: 'Green' },
  { color: '#67e8f9', label: 'Cyan' }
] as const;
export const ACCENT_COLORS = PLAYER_ACCENTS.map((item) => item.color);

export const FRAME_STYLES = [
  { id: 'clean', label: 'Clean' },
  { id: 'halo', label: 'Halo' },
  { id: 'bracket', label: 'Bracket' },
  { id: 'neon', label: 'Neon' }
] as const;
export type PlayerFrameStyle = typeof FRAME_STYLES[number]['id'];

export const PLAYER_TITLES = [
  { id: 'none', label: 'No title' },
  { id: 'wildcard', label: 'Wildcard' },
  { id: 'speed-demon', label: 'Speed Demon' },
  { id: 'professor', label: 'Professor' },
  { id: 'clutch', label: 'Clutch' },
  { id: 'night-owl', label: 'Night Owl' },
  { id: 'chaos-agent', label: 'Chaos Agent' },
  { id: 'ace', label: 'Ace' }
] as const;
export type PlayerTitle = typeof PLAYER_TITLES[number]['id'];

export const BUZZER_SOUNDS = [
  { id: 'classic', label: 'Classic' },
  { id: 'laser', label: 'Laser' },
  { id: 'chime', label: 'Chime' },
  { id: 'arcade', label: 'Arcade' }
] as const;
export type PlayerBuzzerSound = typeof BUZZER_SOUNDS[number]['id'];

export const SCORE_EFFECTS = [
  { id: 'pulse', label: 'Pulse' },
  { id: 'spark', label: 'Spark' },
  { id: 'wave', label: 'Wave' }
] as const;
export type PlayerScoreEffect = typeof SCORE_EFFECTS[number]['id'];

export const VICTORY_EFFECTS = [
  { id: 'confetti', label: 'Confetti' },
  { id: 'spotlight', label: 'Spotlight' },
  { id: 'stars', label: 'Stars' }
] as const;
export type PlayerVictoryEffect = typeof VICTORY_EFFECTS[number]['id'];

export interface PlayerCustomizationFields {
  avatarId?: string;
  frameStyle?: PlayerFrameStyle;
  title?: PlayerTitle;
  buzzerSound?: PlayerBuzzerSound;
  scoreEffect?: PlayerScoreEffect;
  victoryEffect?: PlayerVictoryEffect;
}

export const DEFAULT_PLAYER_CUSTOMIZATION = {
  avatarId: 'fox',
  frameStyle: 'clean',
  title: 'wildcard',
  buzzerSound: 'classic',
  scoreEffect: 'pulse',
  victoryEffect: 'confetti'
} as const satisfies Required<PlayerCustomizationFields>;

function optionId<T extends readonly { id: string }[]>(options: T, value: unknown, fallback: T[number]['id']): T[number]['id'] {
  return typeof value === 'string' && options.some((option) => option.id === value) ? value as T[number]['id'] : fallback;
}

export function getAvatarOption(avatarId?: string | null): AvatarOption {
  return AVATAR_CATALOG.find((avatar) => avatar.id === avatarId) ?? AVATAR_CATALOG[0];
}

export function getPlayerTitleLabel(title?: string | null): string | null {
  const item = PLAYER_TITLES.find((candidate) => candidate.id === title);
  return !item || item.id === 'none' ? null : item.label;
}

export function normalizePlayerCustomization(value: PlayerCustomizationFields | null | undefined): Required<PlayerCustomizationFields> {
  return {
    avatarId: getAvatarOption(value?.avatarId).id,
    frameStyle: optionId(FRAME_STYLES, value?.frameStyle, DEFAULT_PLAYER_CUSTOMIZATION.frameStyle) as PlayerFrameStyle,
    title: optionId(PLAYER_TITLES, value?.title, DEFAULT_PLAYER_CUSTOMIZATION.title) as PlayerTitle,
    buzzerSound: optionId(BUZZER_SOUNDS, value?.buzzerSound, DEFAULT_PLAYER_CUSTOMIZATION.buzzerSound) as PlayerBuzzerSound,
    scoreEffect: optionId(SCORE_EFFECTS, value?.scoreEffect, DEFAULT_PLAYER_CUSTOMIZATION.scoreEffect) as PlayerScoreEffect,
    victoryEffect: optionId(VICTORY_EFFECTS, value?.victoryEffect, DEFAULT_PLAYER_CUSTOMIZATION.victoryEffect) as PlayerVictoryEffect
  };
}
