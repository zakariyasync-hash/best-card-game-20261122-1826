// Every tuning number and colour for Ember Court lives here. The table is a fixed
// 1280x720 logical area; the renderer scales it to the window, so no rule below
// depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** A duel is won by taking the other side's hearts to zero. */
export const START_HEARTS = 24;
/** Cards drawn when a side's turn begins (after the opening hand). */
export const DRAW_PER_TURN = 2;
/** Cards in the opening hand. */
export const OPENING_HAND = 4;
/** The most cards a hand may hold; a draw past this is lost. */
export const MAX_HAND = 7;
/** Energy refilled at the start of each of your turns; every card spends some. */
export const ENERGY_PER_TURN = 3;

export const SUITS = {
  flame: { name: 'Flame', color: '#d84a35', dark: '#8f2418', light: '#f6b8a6', glyph: 'flame' },
  leaf: { name: 'Leaf', color: '#3f9e4d', dark: '#1f5c28', light: '#bfe8c2', glyph: 'leaf' },
  wave: { name: 'Wave', color: '#2f7fc4', dark: '#174a78', light: '#bcd9f2', glyph: 'wave' },
  stone: { name: 'Stone', color: '#8a7a5c', dark: '#54452c', light: '#ddd2b8', glyph: 'stone' },
};

export const PALETTE = {
  backdrop: '#14100c',
  felt: '#1d4a2f',
  feltDark: '#143722',
  feltLight: '#2a5c3d',
  trim: '#c9a227',
  trimDark: '#8a6d1a',
  panel: '#241d16',
  panelEdge: '#4a3a26',
  text: '#f4ead2',
  muted: '#b3a586',
  cardFace: '#f7f1de',
  cardInk: '#2b2118',
  cardBack: '#7e2a1e',
  cardBackEdge: '#c9a227',
  energy: '#e8b93c',
  energyEmpty: '#5c4f33',
  hearts: '#e5484d',
  shield: '#7fb3d5',
  button: '#c9a227',
  buttonText: '#241d16',
  buttonDisabled: '#5c4f33',
  log: '#d8cba6',
};

export const FONT = 'Georgia, "Times New Roman", serif';
export const FONT_UI = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'ember-court.best';
