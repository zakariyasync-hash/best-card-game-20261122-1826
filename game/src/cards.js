// The card catalogue: every card Ember Court can deal, and the deck built from it.
// A card is one idea: a suit (told by colour and by glyph, never by text alone),
// an energy cost, and an effect written in plain words on the card itself.
// Effects are data, not code: { damage, heal, shield, draw }.
import { SUITS } from './config.js';

/**
 * id, name, suit, cost, and the effect. `power` is the headline number on the
 * card: the damage it deals, or the hearts or shield it gives when it deals none.
 */
export const CARD_DEFS = [
  { id: 'ember-strike', name: 'Ember Strike', suit: 'flame', cost: 1, damage: 4, text: 'Deal 4 damage.' },
  { id: 'cinder-slash', name: 'Cinder Slash', suit: 'flame', cost: 1, damage: 3, draw: 1, text: 'Deal 3 damage. Draw a card.' },
  { id: 'wildfire', name: 'Wildfire', suit: 'flame', cost: 2, damage: 7, text: 'Deal 7 damage.' },
  { id: 'phoenix-rise', name: 'Phoenix Rise', suit: 'flame', cost: 3, damage: 6, heal: 3, text: 'Deal 6 damage. Heal 3 hearts.' },
  { id: 'thorn-vine', name: 'Thorn Vine', suit: 'leaf', cost: 1, damage: 2, heal: 3, text: 'Deal 2 damage. Heal 3 hearts.' },
  { id: 'bloom', name: 'Bloom', suit: 'leaf', cost: 1, heal: 5, text: 'Heal 5 hearts.' },
  { id: 'root-shield', name: 'Root Shield', suit: 'leaf', cost: 2, shield: 6, heal: 2, text: 'Gain 6 shield. Heal 2 hearts.' },
  { id: 'spore-burst', name: 'Spore Burst', suit: 'leaf', cost: 2, damage: 5, heal: 2, text: 'Deal 5 damage. Heal 2 hearts.' },
  { id: 'tide-draw', name: 'Tide Draw', suit: 'wave', cost: 1, draw: 2, text: 'Draw 2 cards.' },
  { id: 'frost-shard', name: 'Frost Shard', suit: 'wave', cost: 1, damage: 3, shield: 2, text: 'Deal 3 damage. Gain 2 shield.' },
  { id: 'deep-current', name: 'Deep Current', suit: 'wave', cost: 2, damage: 4, draw: 1, text: 'Deal 4 damage. Draw a card.' },
  { id: 'mist-veil', name: 'Mist Veil', suit: 'wave', cost: 1, shield: 5, text: 'Gain 5 shield.' },
  { id: 'stone-wall', name: 'Stone Wall', suit: 'stone', cost: 1, shield: 6, text: 'Gain 6 shield.' },
  { id: 'boulder-throw', name: 'Boulder Throw', suit: 'stone', cost: 2, damage: 6, text: 'Deal 6 damage.' },
  { id: 'quake', name: 'Quake', suit: 'stone', cost: 3, damage: 9, text: 'Deal 9 damage.' },
  { id: 'granite-guard', name: 'Granite Guard', suit: 'stone', cost: 2, shield: 4, damage: 3, text: 'Gain 4 shield. Deal 3 damage.' },
];

/** The headline number printed big on the card face. */
export function cardPower(def) {
  if (def.damage) return def.damage;
  if (def.heal) return def.heal;
  if (def.shield) return def.shield;
  return def.draw;
}

/** The word under the headline number: what the power is. */
export function cardPowerWord(def) {
  if (def.damage) return 'DMG';
  if (def.heal) return 'HEAL';
  if (def.shield) return 'SHIELD';
  return 'DRAW';
}

/** A fresh 32-card deck: two copies of every card in the catalogue. */
export function buildDeck() {
  const deck = [];
  for (const def of CARD_DEFS) {
    deck.push(def.id, def.id);
  }
  return deck;
}

export function defById(id) {
  return CARD_DEFS.find((def) => def.id === id);
}

/** The suit's display data for a card. */
export function suitOf(def) {
  return SUITS[def.suit];
}

/** Fisher-Yates shuffle, in place, using the duel's seeded random. */
export function shuffle(deck, random) {
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const held = deck[i];
    deck[i] = deck[j];
    deck[j] = held;
  }
  return deck;
}
