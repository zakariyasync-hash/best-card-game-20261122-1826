// Drawing only: the duel's state and the current screen in, pixels out. The 1280x720
// table is scaled to fit the window and centred. Cards are drawn by hand on the
// canvas — no image files — each suit told by its colour and its glyph, never by
// text alone. Hand cards glide toward their slots, a played card flies to the mat,
// and floating numbers rise off the table where the damage landed.
import { FIELD, FONT, FONT_UI, PALETTE, SUITS } from './config.js';
import { cardPower, cardPowerWord, defById, suitOf } from './cards.js';
import { SIDE_PLAYER, SIDE_RIVAL } from './duel.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const CARD_W = 118;
const CARD_H = 164;
const BACK_W = 72;
const BACK_H = 100;

/** Where the End Turn button sits, in table coordinates. */
const END_BUTTON = { x: 1016, y: 556, w: 232, h: 64 };
const MAT = { x: 316, y: 196, w: 648, h: 252 };

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** The four suit glyphs, drawn as paths so they read at any size. */
export function drawGlyph(ctx, glyph, cx, cy, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  if (glyph === 'flame') {
    ctx.moveTo(cx, cy - r);
    ctx.bezierCurveTo(cx + r * 0.85, cy - r * 0.25, cx + r * 0.55, cy + r * 0.45, cx, cy + r * 0.8);
    ctx.bezierCurveTo(cx - r * 0.55, cy + r * 0.45, cx - r * 0.85, cy - r * 0.25, cx, cy - r);
    ctx.moveTo(cx, cy + r * 0.55);
    ctx.bezierCurveTo(cx + r * 0.3, cy + r * 0.1, cx + r * 0.18, cy - r * 0.3, cx, cy - r * 0.55);
    ctx.bezierCurveTo(cx - r * 0.18, cy - r * 0.3, cx - r * 0.3, cy + r * 0.1, cx, cy + r * 0.55);
  } else if (glyph === 'leaf') {
    ctx.moveTo(cx, cy - r);
    ctx.bezierCurveTo(cx + r, cy - r * 0.4, cx + r * 0.7, cy + r * 0.7, cx, cy + r);
    ctx.bezierCurveTo(cx - r * 0.7, cy + r * 0.7, cx - r, cy - r * 0.4, cx, cy - r);
    ctx.moveTo(cx, cy - r * 0.7);
    ctx.lineTo(cx, cy + r * 0.8);
  } else if (glyph === 'wave') {
    ctx.moveTo(cx, cy - r);
    ctx.bezierCurveTo(cx + r * 0.75, cy - r * 0.1, cx + r * 0.6, cy + r * 0.75, cx, cy + r * 0.85);
    ctx.bezierCurveTo(cx - r * 0.6, cy + r * 0.75, cx - r * 0.75, cy - r * 0.1, cx, cy - r);
  } else {
    // stone: a cut gem
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r * 0.8, cy - r * 0.3);
    ctx.lineTo(cx + r * 0.55, cy + r * 0.8);
    ctx.lineTo(cx - r * 0.55, cy + r * 0.8);
    ctx.lineTo(cx - r * 0.8, cy - r * 0.3);
    ctx.closePath();
  }
  ctx.fill();
}

function drawHeart(ctx, cx, cy, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, cy + r * 0.9);
  ctx.bezierCurveTo(cx - r * 1.3, cy, cx - r * 0.7, cy - r, cx, cy - r * 0.25);
  ctx.bezierCurveTo(cx + r * 0.7, cy - r, cx + r * 1.3, cy, cx, cy + r * 0.9);
  ctx.fill();
}

function drawShieldBadge(ctx, cx, cy, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx + r * 0.85, cy - r * 0.55);
  ctx.lineTo(cx + r * 0.85, cy + r * 0.1);
  ctx.bezierCurveTo(cx + r * 0.85, cy + r * 0.7, cx + r * 0.3, cy + r, cx, cy + r * 1.15);
  ctx.bezierCurveTo(cx - r * 0.3, cy + r, cx - r * 0.85, cy + r * 0.7, cx - r * 0.85, cy + r * 0.1);
  ctx.lineTo(cx - r * 0.85, cy - r * 0.55);
  ctx.closePath();
  ctx.fill();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  /** Card uid -> current top-left, gliding toward its slot each frame. */
  const positions = new Map();
  /** The card last played, and where its flight began. */
  let shownPlay = null;
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  function text(value, x, y, size, color, align, font = FONT_UI, weight = '') {
    const key = `${weight}|${size}|${font}`;
    if (!fonts.has(key)) fonts.set(key, `${weight} ${size}px ${font}`.trim());
    ctx.font = fonts.get(key);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(value, x, y);
  }

  function wrapText(value, x, y, maxWidth, lineHeight, size, color, align = 'center') {
    const words = value.split(' ');
    const lines = [''];
    for (const word of words) {
      const trial = lines[lines.length - 1] ? `${lines[lines.length - 1]} ${word}` : word;
      ctx.font = `${size}px ${FONT_UI}`;
      if (ctx.measureText(trial).width > maxWidth && lines[lines.length - 1]) lines.push(word);
      else lines[lines.length - 1] = trial;
    }
    lines.forEach((line, i) => text(line, x, y + i * lineHeight, size, color, align));
  }

  /** The slots the hand cards glide into, and the End Turn button's rect. */
  function layout(state) {
    const hand = state.player.hand;
    const span = Math.min(CARD_W + 10, (640 - CARD_W) / Math.max(1, hand.length - 1 || 1));
    const total = CARD_W + span * (hand.length - 1);
    const startX = 640 - total / 2;
    const cards = hand.map((card, i) => ({
      card,
      index: i,
      x: startX + i * span,
      y: 524,
      hover: false,
    }));
    return { cards, endButton: END_BUTTON };
  }

  function drawCardFace(def, x, y, w, h, opts = {}) {
    const suit = suitOf(def);
    const scale = w / CARD_W;
    ctx.save();
    if (opts.lift) ctx.translate(0, -18 * scale);
    if (opts.tilt) ctx.rotate(opts.tilt);
    roundRect(ctx, x, y, w, h, 12 * scale);
    ctx.fillStyle = PALETTE.cardFace;
    ctx.fill();
    ctx.lineWidth = 2 * scale;
    ctx.strokeStyle = opts.glow ? PALETTE.trim : suit.dark;
    ctx.stroke();
    // Suit band
    roundRect(ctx, x + 3 * scale, y + 3 * scale, w - 6 * scale, 30 * scale, 8 * scale);
    ctx.fillStyle = suit.color;
    ctx.fill();
    text(suit.name.toUpperCase(), x + w / 2, y + 23 * scale, 13 * scale, '#fff', 'center', FONT_UI, 'bold');
    drawGlyph(ctx, suit.glyph, x + w - 20 * scale, y + 18 * scale, 8 * scale, 'rgba(255,255,255,0.9)');
    // Cost gem
    ctx.beginPath();
    ctx.arc(x + 16 * scale, y + 16 * scale, 15 * scale, 0, Math.PI * 2);
    ctx.fillStyle = opts.cantAfford ? '#8a8a8a' : PALETTE.energy;
    ctx.fill();
    ctx.lineWidth = 2 * scale;
    ctx.strokeStyle = '#5c4a12';
    ctx.stroke();
    text(String(def.cost), x + 16 * scale, y + 21.5 * scale, 17 * scale, '#241d16', 'center', FONT_UI, 'bold');
    // Headline power
    ctx.globalAlpha = 0.16;
    drawGlyph(ctx, suit.glyph, x + w / 2, y + h * 0.48, 34 * scale, suit.color);
    ctx.globalAlpha = 1;
    text(String(cardPower(def)), x + w / 2, y + h * 0.52, 44 * scale, suit.dark, 'center', FONT, 'bold');
    text(cardPowerWord(def), x + w / 2, y + h * 0.52 + 20 * scale, 11 * scale, suit.dark, 'center', FONT_UI, 'bold');
    // Name and effect
    text(def.name, x + w / 2, y + h - 38 * scale, 14 * scale, PALETTE.cardInk, 'center', FONT, 'bold');
    wrapText(def.text, x + w / 2, y + h - 22 * scale, w - 14 * scale, 13 * scale, 11 * scale, '#5c4a36');
    if (opts.dim) {
      roundRect(ctx, x, y, w, h, 12 * scale);
      ctx.fillStyle = 'rgba(20,16,12,0.45)';
      ctx.fill();
    }
    ctx.restore();
  }

  function drawCardBack(x, y, w, h) {
    roundRect(ctx, x, y, w, h, 9);
    ctx.fillStyle = PALETTE.cardBack;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = PALETTE.cardBackEdge;
    ctx.stroke();
    roundRect(ctx, x + 6, y + 6, w - 12, h - 12, 6);
    ctx.strokeStyle = 'rgba(201,162,39,0.6)';
    ctx.stroke();
    drawGlyph(ctx, 'flame', x + w / 2, y + h / 2, Math.min(w, h) * 0.26, PALETTE.trim);
  }

  function drawHearts(side, data, x, y, w) {
    const label = side === SIDE_PLAYER ? 'YOU' : 'ASHA · CINDER QUEEN';
    text(label, x, y, 16, PALETTE.text, 'left', FONT_UI, 'bold');
    const barY = y + 12;
    roundRect(ctx, x, barY, w, 18, 9);
    ctx.fillStyle = '#0e0a07';
    ctx.fill();
    const frac = Math.max(0, data.hp / data.maxHp);
    if (frac > 0) {
      roundRect(ctx, x + 2, barY + 2, (w - 4) * frac, 14, 7);
      ctx.fillStyle = PALETTE.hearts;
      ctx.fill();
    }
    drawHeart(ctx, x + 14, barY + 40, 9, PALETTE.hearts);
    text(`${data.hp} / ${data.maxHp}`, x + 30, barY + 44, 18, PALETTE.text, 'left', FONT_UI, 'bold');
    if (data.shield > 0) {
      drawShieldBadge(ctx, x + 116, barY + 40, 11, PALETTE.shield);
      text(`+${data.shield}`, x + 132, barY + 44, 18, PALETTE.shield, 'left', FONT_UI, 'bold');
    }
  }

  function drawEnergy(side, x, y) {
    text('ENERGY', x, y, 13, PALETTE.muted, 'left', FONT_UI, 'bold');
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.arc(x + 12 + i * 30, y + 16, 11, 0, Math.PI * 2);
      ctx.fillStyle = i < side.energy ? PALETTE.energy : PALETTE.energyEmpty;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#5c4a12';
      ctx.stroke();
    }
  }

  function drawEndButton(state, screen) {
    const b = END_BUTTON;
    const rivalTurn = state.phase === 'rival';
    roundRect(ctx, b.x, b.y, b.w, b.h, 12);
    ctx.fillStyle = rivalTurn || screen !== SCREEN_PLAY ? PALETTE.buttonDisabled : PALETTE.button;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = PALETTE.trimDark;
    ctx.stroke();
    text(rivalTurn ? "ASHA'S TURN…" : 'END TURN  ⏎', b.x + b.w / 2, b.y + 40, 20, rivalTurn ? PALETTE.muted : PALETTE.buttonText, 'center', FONT_UI, 'bold');
  }

  function drawTable(state) {
    ctx.fillStyle = PALETTE.felt;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.fillStyle = PALETTE.feltDark;
    ctx.beginPath();
    ctx.ellipse(FIELD.width / 2, FIELD.height / 2, 560, 300, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.trimDark;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(FIELD.width / 2, FIELD.height / 2, 560, 300, 0, 0, Math.PI * 2);
    ctx.stroke();
    // The mat where played cards land
    roundRect(ctx, MAT.x, MAT.y, MAT.w, MAT.h, 16);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(201,162,39,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function drawTopBar(state, best) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 0, FIELD.width, 48);
    text('EMBER COURT', 24, 32, 20, PALETTE.trim, 'left', FONT, 'bold');
    text(`SCORE  ${state.damageDealt + state.cardsPlayed * 2 + (state.winner === SIDE_PLAYER ? 100 + state.player.hp * 5 : 0)}`, 340, 31, 17, PALETTE.text, 'left', FONT_UI, 'bold');
    text(`ROUND  ${state.turn}`, 640, 31, 17, PALETTE.text, 'center', FONT_UI, 'bold');
    text(`BEST  ${best}`, 1256, 31, 17, PALETTE.muted, 'right', FONT_UI, 'bold');
  }

  function drawLog(state) {
    text('THE TABLE TALKS', 1000, 220, 13, PALETTE.muted, 'left', FONT_UI, 'bold');
    state.log.forEach((line, i) => {
      text(fitLine(line, 264), 1000, 244 + i * 22, 13.5, i === 0 ? PALETTE.log : 'rgba(216,203,166,0.55)', 'left');
    });
    if (!state.log.length) text('No cards played yet.', 1000, 244, 13.5, PALETTE.muted, 'left');
  }

  /** Shorten a log line with an ellipsis so it stays inside the log column. */
  function fitLine(line, maxWidth) {
    ctx.font = `13.5px ${FONT_UI}`;
    if (ctx.measureText(line).width <= maxWidth) return line;
    let cut = line;
    while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) cut = cut.slice(0, -1);
    return `${cut}…`;
  }

  function drawPanel(title, lines, prompt, accent) {
    const width = 680;
    const height = 150 + lines.length * 34;
    const x = (FIELD.width - width) / 2;
    const y = (FIELD.height - height) / 2;
    roundRect(ctx, x, y, width, height, 18);
    ctx.fillStyle = PALETTE.panel;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = accent;
    ctx.stroke();
    text(title, FIELD.width / 2, y + 72, 46, accent, 'center', FONT, 'bold');
    lines.forEach((line, i) => {
      text(line, FIELD.width / 2, y + 118 + i * 34, 19, PALETTE.muted, 'center');
    });
    text(prompt, FIELD.width / 2, y + height - 30, 20, PALETTE.trim, 'center', FONT_UI, 'bold');
  }

  function drawTitleBackdrop() {
    const defs = [
      { id: 'wildfire', name: 'Wildfire', suit: 'flame', cost: 2, damage: 7, text: 'Deal 7 damage.' },
      { id: 'bloom', name: 'Bloom', suit: 'leaf', cost: 1, heal: 5, text: 'Heal 5 hearts.' },
      { id: 'deep-current', name: 'Deep Current', suit: 'wave', cost: 2, damage: 4, draw: 1, text: 'Deal 4 damage. Draw a card.' },
      { id: 'quake', name: 'Quake', suit: 'stone', cost: 3, damage: 9, text: 'Deal 9 damage.' },
    ];
    defs.forEach((def, i) => {
      const x = 300 + i * 190;
      ctx.save();
      ctx.translate(x + CARD_W / 2, 560);
      ctx.rotate((i - 1.5) * 0.1);
      ctx.translate(-CARD_W / 2, -CARD_H / 2);
      drawCardFace(def, 0, 0, CARD_W, CARD_H, {});
      ctx.restore();
    });
  }

  function drawFloaters(floaters) {
    for (const f of floaters) {
      const p = f.age / f.life;
      if (p >= 1) continue;
      ctx.globalAlpha = 1 - p;
      text(f.text, f.x, f.y - p * 46, 30, f.color, 'center', FONT, 'bold');
      ctx.globalAlpha = 1;
    }
  }

  /** Paint one frame. `ui` carries hover, floaters, time and the played-card flight. */
  function draw(state, screen, best, ui) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawTable(state);

    if (screen === SCREEN_TITLE) {
      drawTitleBackdrop();
      const lines = [
        'A duel of cards against Asha, the Cinder Queen.',
        'Play cards with the mouse or keys 1–7. Each round refills 3 energy.',
        'Take her 24 hearts to zero before she takes yours.',
        best > 0 ? `Best score: ${best}` : 'No duels won yet — the court awaits.',
      ];
      drawPanel('EMBER COURT', lines, 'Click or press Space to begin', PALETTE.trim);
      return;
    }

    drawTopBar(state, best);
    // Rival's side
    drawHearts(SIDE_RIVAL, state.rival, 32, 78, 260);
    const backs = state.rival.hand.length;
    const backSpan = Math.min(BACK_W + 6, 380 / Math.max(1, backs));
    const backStart = 640 - (BACK_W + backSpan * (backs - 1)) / 2;
    for (let i = 0; i < backs; i += 1) drawCardBack(backStart + i * backSpan, 66, BACK_W, BACK_H);

    // The played card flies to the mat, then rests there.
    const play = state.lastPlay;
    if (play) {
      if (!shownPlay || shownPlay.uid !== play.uid) {
        const fromY = play.side === SIDE_PLAYER ? 560 : 90;
        shownPlay = { uid: play.uid, def: play.def, side: play.side, fromX: 640 - CARD_W / 2, fromY, at: ui.time };
      }
      const p = Math.min(1, (ui.time - shownPlay.at) / 0.35);
      const ease = 1 - (1 - p) * (1 - p);
      const cx = 640 - CARD_W / 2;
      const cy = MAT.y + (MAT.h - CARD_H) / 2;
      const x = shownPlay.fromX + (cx - shownPlay.fromX) * ease;
      const y = shownPlay.fromY + (cy - shownPlay.fromY) * ease;
      drawCardFace(shownPlay.def, x, y, CARD_W, CARD_H, { tilt: (1 - ease) * (shownPlay.side === SIDE_PLAYER ? 0.25 : -0.25) });
      text(play.side === SIDE_PLAYER ? 'YOU PLAYED' : 'ASHA PLAYED', 640, MAT.y + MAT.h - 6, 12, PALETTE.muted, 'center', FONT_UI, 'bold');
    } else {
      text('The mat waits for the first card.', 640, MAT.y + MAT.h / 2, 17, 'rgba(244,234,210,0.5)', 'center');
    }

    drawLog(state);
    drawFloaters(ui.floaters);

    // Player's side
    drawHearts(SIDE_PLAYER, state.player, 32, 470, 260);
    drawEnergy(state.player, 32, 560);
    text('M mute · P pause', 32, 660, 13, PALETTE.muted, 'left');
    drawEndButton(state, screen);

    const lay = layout(state);
    // Glide each hand card toward its slot; a hovered card rises.
    for (const slot of lay.cards) {
      const def = defById(slot.card.id);
      const hovered = ui.hoverCard === slot.index;
      const targetY = hovered ? slot.y - 26 : slot.y;
      let pos = positions.get(slot.card.uid);
      if (!pos) {
        pos = { x: 1180, y: 620 };
        positions.set(slot.card.uid, pos);
      }
      pos.x += (slot.x - pos.x) * 0.22;
      pos.y += (targetY - pos.y) * 0.22;
      const affordable = state.player.energy >= def.cost && state.phase === 'player' && screen === SCREEN_PLAY;
      drawCardFace(def, pos.x, pos.y, CARD_W, CARD_H, {
        lift: false,
        glow: hovered && affordable,
        dim: !affordable,
        cantAfford: state.player.energy < def.cost,
      });
    }
    // Drop positions of cards no longer in hand.
    for (const uid of [...positions.keys()]) {
      if (!state.player.hand.some((card) => card.uid === uid)) positions.delete(uid);
    }

    if (screen === SCREEN_PAUSED) {
      drawPanel('PAUSED', ['The cards will wait for you.'], 'Press P or click to resume', PALETTE.trim);
    } else if (screen === SCREEN_OVER) {
      const won = state.winner === SIDE_PLAYER;
      const finalScore = state.damageDealt + state.cardsPlayed * 2 + (won ? 100 + state.player.hp * 5 : 0);
      if (won) {
        // A little gold ember drift over a win.
        for (let i = 0; i < 40; i += 1) {
          const px = (i * 173.3 + ui.time * 22) % FIELD.width;
          const py = (i * 97.7 + ui.time * 46) % FIELD.height;
          ctx.globalAlpha = 0.35 + 0.3 * Math.sin(ui.time * 2 + i);
          ctx.fillStyle = PALETTE.energy;
          ctx.beginPath();
          ctx.arc(px, FIELD.height - py, 3, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      drawPanel(
        won ? 'VICTORY' : 'DEFEAT',
        won
          ? [`Asha bows. The Ember Court is yours.`, `Score ${finalScore}  ·  Best ${Math.max(best, finalScore)}`, `Damage dealt ${state.damageDealt}  ·  Cards played ${state.cardsPlayed}  ·  Rounds ${state.turn}`]
          : [`Asha keeps her throne — this time.`, `Score ${finalScore}  ·  Best ${best}`, `Damage dealt ${state.damageDealt}  ·  Cards played ${state.cardsPlayed}  ·  Rounds ${state.turn}`],
        'Click or press Space to duel again',
        won ? PALETTE.trim : PALETTE.hearts,
      );
    }
  }

  /** What, if anything, sits under table point (x, y): a hand card, the End Turn button, or nothing. */
  function hitTest(state, screen, x, y) {
    if (screen === SCREEN_TITLE || screen === SCREEN_OVER) return { kind: 'confirm' };
    if (screen !== SCREEN_PLAY) return null;
    const lay = layout(state);
    // Topmost card first: the rightmost drawn last.
    for (let i = lay.cards.length - 1; i >= 0; i -= 1) {
      const slot = lay.cards[i];
      const cy = slot.y - 26;
      if (x >= slot.x && x <= slot.x + CARD_W && y >= Math.min(slot.y, cy) && y <= slot.y + CARD_H) {
        return { kind: 'card', index: slot.index };
      }
    }
    const b = lay.endButton;
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return { kind: 'end' };
    return null;
  }

  /** Convert a client (window) point to table coordinates. */
  function toTable(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    return {
      x: ((clientX - rect.left) * ratio - view.x) / view.scale,
      y: ((clientY - rect.top) * ratio - view.y) / view.scale,
    };
  }

  resize();
  window.addEventListener('resize', resize);
  return {
    draw, hitTest, toTable, layout,
    /** Debug handle: current gliding positions of the hand cards, by uid. */
    debugPositions() {
      return [...positions.entries()].map(([uid, pos]) => ({ uid, x: Math.round(pos.x), y: Math.round(pos.y) }));
    },
  };
}
