// Boot and the one loop: input is read every frame, the duel advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what
// is there. The game moves between four screens: title, play, paused and game over.
// The rival plays one card a beat at a time, so her turn reads like a turn, not a jump.
//
// ?seed=N fixes the deal. ?shot=start|play|win|loss (with &seed=N) stages that scene
// instead of running the loop, paints it twice and sets window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createDuel, SIDE_PLAYER, SIDE_RIVAL } from './duel.js';
import { playBestCard } from './ai.js';
import { ACTION_CONFIRM, ACTION_END, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { createSound } from './sound.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;
/** Seconds between the rival's cards, so her turn is watchable. */
const AI_BEAT = 0.75;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const duel = createDuel(createRandom(seed));
const renderer = createRenderer(canvas);
const sound = createSound();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, duel);
  // Paint many frames with advancing time, so the hand cards finish gliding into
  // their slots and the played card lands on the mat before the screenshot.
  const ui = { hoverCard: -1, floaters: [], time: 1.2 };
  const best = readBest();
  let painted = 0;
  function paint() {
    renderer.draw(duel.state, scene.screen, best, ui);
    painted += 1;
    ui.time += 1 / 60;
    if (painted < 40) requestAnimationFrame(paint);
    else {
      window.__shotReady = true;
      window.__layout = renderer.layout(duel.state);
      window.__positions = renderer.debugPositions();
      window.__hand = duel.state.player.hand.map((c) => c.uid);
      window.__shotState = {
        screen: scene.screen,
        winner: duel.state.winner,
        turn: duel.state.turn,
        playerHp: duel.state.player.hp,
        rivalHp: duel.state.rival.hp,
        score: duel.score(),
      };
    }
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas, (x, y) => renderer.toTable(x, y));
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let aiTimer = 0;
  const floaters = [];

  function announce(message) {
    status.textContent = message;
  }

  function addFloater(x, y, text, color) {
    floaters.push({ x, y, text, color, age: 0, life: 1.1 });
  }

  /** The numbers that rise off the table when a card lands. */
  function showResult(result) {
    if (!result) return;
    const foeTop = result.side === SIDE_PLAYER;
    if (result.damage > 0) {
      addFloater(160, foeTop ? 130 : 520, `-${result.damage}`, '#ff6b5e');
      sound.hit();
    }
    if (result.blocked > 0) {
      addFloater(300, foeTop ? 130 : 520, `blocked ${result.blocked}`, '#7fb3d5');
    }
    if (result.heal > 0) {
      addFloater(160, result.side === SIDE_PLAYER ? 520 : 130, `+${result.heal}`, '#7ed491');
      sound.heal();
    }
    if (result.shield > 0) {
      addFloater(300, result.side === SIDE_PLAYER ? 520 : 130, `+${result.shield} shield`, '#7fb3d5');
      sound.shield();
    }
    if (result.drawn > 0) sound.draw();
    if (result.damage === 0 && result.heal === 0 && result.shield === 0) sound.play();
  }

  function startGame() {
    duel.reset();
    floaters.length = 0;
    aiTimer = 0;
    screen = SCREEN_PLAY;
    sound.unlock();
    sound.turn();
    announce('Playing. Your move, challenger.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    const final = duel.score();
    if (duel.state.winner === SIDE_PLAYER) {
      if (final > best) {
        best = final;
        saveBest(best);
      }
      sound.win();
      announce(`Victory. Score ${final}. Best ${best}.`);
    } else {
      sound.lose();
      announce(`Defeat. Score ${final}. Best ${best}.`);
    }
  }

  function playPlayerCard(index) {
    if (screen !== SCREEN_PLAY || duel.state.phase !== 'player') return;
    const result = duel.playCard(SIDE_PLAYER, index);
    if (!result) return;
    showResult(result);
    if (result.over) endGame();
  }

  function endPlayerTurn() {
    if (screen !== SCREEN_PLAY || duel.state.phase !== 'player') return;
    if (duel.endPlayerTurn()) {
      aiTimer = 0;
      sound.turn();
      announce("Asha's turn.");
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = sound.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (actions & ACTION_CONFIRM) {
      if (screen === SCREEN_TITLE || screen === SCREEN_OVER) startGame();
      else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
    if (actions & ACTION_END) {
      if (screen === SCREEN_PLAY) endPlayerTurn();
      else if (screen === SCREEN_TITLE || screen === SCREEN_OVER) startGame();
    }
    for (const index of input.takeCardKeys()) playPlayerCard(index);
    for (const point of input.takeClicks()) {
      sound.unlock();
      if (screen === SCREEN_TITLE || screen === SCREEN_OVER) {
        startGame();
        continue;
      }
      if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
        continue;
      }
      if (screen !== SCREEN_PLAY) continue;
      const hit = renderer.hitTest(duel.state, screen, point.x, point.y);
      if (!hit) continue;
      if (hit.kind === 'card') playPlayerCard(hit.index);
      else if (hit.kind === 'end') endPlayerTurn();
    }
  }

  function hoverCard() {
    const point = input.hoverPoint();
    if (!point || screen !== SCREEN_PLAY || duel.state.phase !== 'player') return -1;
    const hit = renderer.hitTest(duel.state, screen, point.x, point.y);
    return hit && hit.kind === 'card' ? hit.index : -1;
  }

  function step() {
    if (duel.state.phase === 'rival' && screen === SCREEN_PLAY) {
      aiTimer += STEP;
      if (aiTimer >= AI_BEAT) {
        aiTimer = 0;
        const result = playBestCard(duel, SIDE_RIVAL, 1);
        if (result) {
          showResult(result);
          if (result.over) endGame();
        } else {
          duel.endRivalTurn();
          sound.turn();
          announce(`Round ${duel.state.turn}. Your move.`);
        }
      }
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    for (const floater of floaters) floater.age += dt;
    while (floaters.length && floaters[0].age >= floaters[0].life) floaters.shift();
    handleActions();
    accumulator += dt;
    while (accumulator >= STEP) {
      step();
      accumulator -= STEP;
    }
    renderer.draw(duel.state, screen, best, {
      hoverCard: hoverCard(),
      floaters,
      time: now / 1000,
    });
  }

  // Leaving the tab pauses a running game rather than letting Asha play unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  // A handle for play-testing: the live duel and screen, read-only in spirit.
  window.__game = { duel, get screen() { return screen; } };
  announce('Ember Court. Press Space or click to begin the duel.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
