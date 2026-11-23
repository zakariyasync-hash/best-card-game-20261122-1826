// The screenshot scenes behind ?shot=start|play|win|loss. Each one plays the real
// rules forward from a fresh duel, both sides steered by the same brain the rival
// uses in a live game — only the eagerness differs, so the frame is what a real
// game looks like and the same seed always gives the same frame. A staged win is
// a strong player against a rival who holds back; a staged loss is the reverse.
import { PHASE_OVER } from './duel.js';
import { SIDE_PLAYER, SIDE_RIVAL } from './duel.js';
import { playBestCard } from './ai.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

/** One full turn for `side`: play the best card until she passes, then end it. */
function runTurn(duel, side, eagerness) {
  while (playBestCard(duel, side, eagerness)) {
    if (duel.state.phase === PHASE_OVER) return;
  }
  if (side === SIDE_PLAYER) duel.endPlayerTurn();
  else duel.endRivalTurn();
}

/** Play until the duel ends (or the guard trips), both pilots at their eagerness. */
function playOut(duel, playerSkill, rivalSkill, maxTurns = 200) {
  let guard = 0;
  while (duel.state.phase !== PHASE_OVER && guard < maxTurns) {
    runTurn(duel, SIDE_PLAYER, playerSkill);
    if (duel.state.phase === PHASE_OVER) break;
    runTurn(duel, SIDE_RIVAL, rivalSkill);
    guard += 1;
  }
}

/**
 * Set `duel` to the named scene and return the screen to draw over it and the
 * best score to show. Any other name is the title scene.
 */
export function stageShot(name, duel) {
  duel.reset();
  if (name !== 'play' && name !== 'win' && name !== 'loss') {
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'play') {
    // A mid-duel table: three full rounds in, both sides bloodied, cards in hand.
    let guard = 0;
    while (duel.state.turn < 4 && duel.state.phase !== PHASE_OVER && guard < 40) {
      runTurn(duel, SIDE_PLAYER, 1);
      if (duel.state.phase === PHASE_OVER) break;
      runTurn(duel, SIDE_RIVAL, 1);
      guard += 1;
    }
    return { screen: SCREEN_PLAY, best: duel.score() };
  }
  if (name === 'win') {
    playOut(duel, 1, 0.4);
    if (duel.state.winner !== SIDE_PLAYER) {
      duel.reset();
      playOut(duel, 1, 0);
    }
    return { screen: SCREEN_OVER, best: duel.score() };
  }
  playOut(duel, 0.4, 1);
  if (duel.state.winner !== SIDE_RIVAL) {
    duel.reset();
    playOut(duel, 0, 1);
  }
  return { screen: SCREEN_OVER, best: duel.score() };
}
