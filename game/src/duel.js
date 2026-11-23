// The duel's rules and state, with no drawing and no browser in it: two sides, each
// with hearts, shield, energy, a deck, a hand and a discard pile; turns, draws,
// card effects, and the win and the loss. Every move returns what happened, so the
// caller can show it, sound it and log it without the duel knowing about screens.
import {
  DRAW_PER_TURN, ENERGY_PER_TURN, MAX_HAND, OPENING_HAND, START_HEARTS,
} from './config.js';
import { buildDeck, defById, shuffle } from './cards.js';

export const SIDE_PLAYER = 'player';
export const SIDE_RIVAL = 'rival';

export const PHASE_PLAYER = 'player';
export const PHASE_RIVAL = 'rival';
export const PHASE_OVER = 'over';

let nextUid = 1;

function makeSide(random) {
  return {
    hp: START_HEARTS,
    maxHp: START_HEARTS,
    shield: 0,
    energy: ENERGY_PER_TURN,
    deck: shuffle(buildDeck(), random),
    hand: [],
    discard: [],
  };
}

function makeCard(id) {
  const card = { uid: nextUid, id };
  nextUid += 1;
  return card;
}

export function createDuel(random) {
  const state = {
    player: makeSide(random),
    rival: makeSide(random),
    phase: PHASE_PLAYER,
    turn: 1,
    winner: null,
    log: [],
    lastPlay: null,
    damageDealt: 0,
    cardsPlayed: 0,
  };

  function sideState(side) {
    return side === SIDE_PLAYER ? state.player : state.rival;
  }

  function otherSide(side) {
    return side === SIDE_PLAYER ? SIDE_RIVAL : SIDE_PLAYER;
  }

  function say(line) {
    state.log.unshift(line);
    if (state.log.length > 4) state.log.length = 4;
  }

  /** Draw `count` cards, reshuffling the discard pile when the deck runs out. */
  function drawCards(side, count) {
    const me = sideState(side);
    let drawn = 0;
    for (let n = 0; n < count; n += 1) {
      if (me.deck.length === 0) {
        if (me.discard.length === 0) break;
        me.deck = shuffle(me.discard.splice(0), random);
      }
      if (me.hand.length >= MAX_HAND) {
        me.deck.shift();
        continue;
      }
      me.hand.push(makeCard(me.deck.shift()));
      drawn += 1;
    }
    return drawn;
  }

  /** Shield guards you through the other side's turn, then fades as yours begins. */
  function beginTurn(side) {
    const me = sideState(side);
    me.shield = 0;
    me.energy = ENERGY_PER_TURN;
    drawCards(side, DRAW_PER_TURN);
  }

  function reset() {
    nextUid = 1;
    state.player = makeSide(random);
    state.rival = makeSide(random);
    state.phase = PHASE_PLAYER;
    state.turn = 1;
    state.winner = null;
    state.log = [];
    state.lastPlay = null;
    state.damageDealt = 0;
    state.cardsPlayed = 0;
    drawCards(SIDE_PLAYER, OPENING_HAND);
    drawCards(SIDE_RIVAL, OPENING_HAND);
    say('The duel begins. Your move, challenger.');
  }

  /** Shield soaks damage first; what is left takes hearts. Returns hearts lost. */
  function applyDamage(side, amount) {
    const me = sideState(side);
    const blocked = Math.min(me.shield, amount);
    me.shield -= blocked;
    const dealt = amount - blocked;
    me.hp = Math.max(0, me.hp - dealt);
    return { blocked, dealt };
  }

  function checkEnd() {
    if (state.rival.hp <= 0) {
      state.winner = SIDE_PLAYER;
      state.phase = PHASE_OVER;
      say('The Cinder Queen falls. Victory is yours!');
      return true;
    }
    if (state.player.hp <= 0) {
      state.winner = SIDE_RIVAL;
      state.phase = PHASE_OVER;
      say('Your hearts are spent. The court keeps its queen.');
      return true;
    }
    return false;
  }

  /**
   * Play the card at `handIndex` for `side`. Returns null when the move is not
   * legal (wrong turn, not enough energy), else what the card did.
   */
  function playCard(side, handIndex) {
    const me = sideState(side);
    if (state.phase === PHASE_OVER) return null;
    if ((side === SIDE_PLAYER) !== (state.phase === PHASE_PLAYER)) return null;
    const card = me.hand[handIndex];
    if (!card) return null;
    const def = defById(card.id);
    if (me.energy < def.cost) return null;

    me.energy -= def.cost;
    me.hand.splice(handIndex, 1);
    me.discard.push(card.id);
    state.cardsPlayed += 1;
    state.lastPlay = { side, def, uid: card.uid };

    const who = side === SIDE_PLAYER ? 'You' : 'Asha';
    const result = { side, def, uid: card.uid, damage: 0, blocked: 0, heal: 0, shield: 0, drawn: 0, over: false };

    if (def.damage) {
      const hit = applyDamage(otherSide(side), def.damage);
      result.damage = hit.dealt;
      result.blocked = hit.blocked;
      if (side === SIDE_PLAYER) state.damageDealt += hit.dealt;
      say(`${who} played ${def.name} — ${hit.dealt} damage${hit.blocked ? ` (${hit.blocked} blocked)` : ''}.`);
    }
    if (def.heal) {
      const healed = Math.min(def.heal, me.maxHp - me.hp);
      me.hp += healed;
      result.heal = healed;
      if (healed > 0) say(`${who} played ${def.name} — healed ${healed}.`);
      else if (!def.damage && !def.shield && !def.draw) say(`${who} played ${def.name} — already at full hearts.`);
    }
    if (def.shield) {
      me.shield += def.shield;
      result.shield = def.shield;
      say(`${who} played ${def.name} — +${def.shield} shield.`);
    }
    if (def.draw) {
      result.drawn = drawCards(side, def.draw);
      say(`${who} played ${def.name} — drew ${result.drawn}.`);
    }
    if (!def.damage && !def.heal && !def.shield && !def.draw) say(`${who} played ${def.name}.`);
    result.over = checkEnd();
    return result;
  }

  /** The player ends their turn; the rival's turn begins. */
  function endPlayerTurn() {
    if (state.phase !== PHASE_PLAYER) return false;
    state.phase = PHASE_RIVAL;
    beginTurn(SIDE_RIVAL);
    say('Asha takes her turn.');
    return true;
  }

  /** The rival is done; a new round begins for the player. */
  function endRivalTurn() {
    if (state.phase !== PHASE_RIVAL) return false;
    state.turn += 1;
    state.phase = PHASE_PLAYER;
    beginTurn(SIDE_PLAYER);
    say(`Round ${state.turn}. Your move.`);
    return true;
  }

  function score() {
    const winBonus = state.winner === SIDE_PLAYER ? 100 + state.player.hp * 5 : 0;
    return state.damageDealt + state.cardsPlayed * 2 + winBonus;
  }

  reset();
  return {
    state,
    reset,
    playCard,
    endPlayerTurn,
    endRivalTurn,
    score,
    sideState,
  };
}
