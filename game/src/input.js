// Keyboard and pointer input. One-shot presses (a key, a click) are queued and taken
// once by the loop, so a press between two frames is never lost and never counted
// twice. The pointer's position is kept in table coordinates, so hovering a card
// and clicking it use the same numbers the renderer draws with.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_END = 4;
export const ACTION_MUTE = 8;

const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const END = new Set(['Enter', 'KeyE']);
const MUTE = new Set(['KeyM']);
const CARD_KEYS = new Set(['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7']);

export function createInput(target, toTable) {
  let actions = 0;
  const keys = [];
  const clicks = [];
  let hover = null;

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    if (CONFIRM.has(event.code)) actions |= ACTION_CONFIRM;
    else if (PAUSE.has(event.code)) actions |= ACTION_PAUSE;
    else if (END.has(event.code)) actions |= ACTION_END;
    else if (MUTE.has(event.code)) actions |= ACTION_MUTE;
    else if (CARD_KEYS.has(event.code)) keys.push(event.code);
    else return;
    event.preventDefault();
  });
  window.addEventListener('blur', () => {
    hover = null;
  });
  target.addEventListener('pointermove', (event) => {
    hover = toTable(event.clientX, event.clientY);
  });
  target.addEventListener('pointerdown', (event) => {
    clicks.push(toTable(event.clientX, event.clientY));
    event.preventDefault();
  });
  target.addEventListener('pointerleave', () => {
    hover = null;
  });

  return {
    /** The pointer's table position, or null when it is not over the canvas. */
    hoverPoint() {
      return hover;
    },
    /** The one-shot action flags since the last call. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** Card-number keys pressed since the last call, as 0-based hand indexes. */
    takeCardKeys() {
      const taken = keys.splice(0).map((code) => Number(code.slice(5)) - 1);
      return taken;
    },
    /** Click points since the last call, in table coordinates. */
    takeClicks() {
      return clicks.splice(0);
    },
  };
}
