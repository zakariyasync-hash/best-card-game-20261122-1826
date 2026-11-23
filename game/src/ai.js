// Asha, the Cinder Queen: the rival's brain. She looks at her hand, weighs each card
// against the table — her hearts, your hearts, the shield on either side — and plays
// the card that buys her the most, while she still has the energy for it. She is
// readable on purpose: hurt, she heals; ahead, she presses; threatened, she guards.
import { defById } from './cards.js';
import { SIDE_PLAYER, SIDE_RIVAL } from './duel.js';

/** How much a card is worth to the side about to play it, in rough points. */
export function valueCard(duel, side, handIndex) {
  const me = duel.sideState(side);
  const foe = duel.sideState(side === SIDE_RIVAL ? SIDE_PLAYER : SIDE_RIVAL);
  const def = defById(me.hand[handIndex].id);
  let value = 0;

  if (def.damage) {
    // Damage is worth more the closer the foe is to falling, and less when a
    // shield would swallow it.
    const lethal = foe.hp - Math.max(0, def.damage - foe.shield) <= 0 ? 6 : 0;
    const throughShield = Math.max(0, def.damage - foe.shield);
    value += throughShield * 1.1 + lethal;
  }
  if (def.heal) {
    // Healing matters when hurt, and is nearly wasted at full hearts.
    const missing = me.maxHp - me.hp;
    value += Math.min(def.heal, missing) * (me.hp <= me.maxHp * 0.6 ? 1.3 : 0.4);
  }
  if (def.shield) {
    // A shield is worth most when the foe can hit hard next turn.
    value += def.shield * (foe.hand.length >= 3 ? 0.9 : 0.6);
  }
  if (def.draw) {
    // Drawing is worth more with an empty hand than a full one.
    value += def.draw * (me.hand.length <= 3 ? 1.6 : 0.7);
  }
  // A cheap card that does something beats an expensive one that does the same.
  return value / def.cost;
}

/**
 * The best card the side can afford right now, or -1 when nothing in hand is
 * worth its energy. `eagerness` below 1 makes her hold back; above 1 she spends
 * freely. The screenshot pilots use it to stage a win or a loss.
 */
export function chooseCard(duel, side, eagerness = 1) {
  const me = duel.sideState(side);
  let bestIndex = -1;
  let bestValue = 1.0 * eagerness;
  for (let index = 0; index < me.hand.length; index += 1) {
    const def = defById(me.hand[index].id);
    if (def.cost > me.energy) continue;
    const value = valueCard(duel, side, index);
    if (value > bestValue) {
      bestValue = value;
      bestIndex = index;
    }
  }
  return bestIndex;
}

/** Play one card for the side, or -1 when she passes. */
export function playBestCard(duel, side, eagerness = 1) {
  const index = chooseCard(duel, side, eagerness);
  if (index < 0) return null;
  return duel.playCard(side, index);
}
