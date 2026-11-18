// Solmar Heat — keyboard and mouse input.
// Tracks held keys, drag-to-orbit camera deltas, and click-vs-drag so a tap
// fires the pistol while a drag swings the camera.

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set();
    this.mouseDown = false;
    this.downX = 0;
    this.downY = 0;
    this.dragX = 0;
    this.dragY = 0;
    this.dragged = false;
    this.clicked = false;
    this.wheel = 0;
    this.canvas = canvas;
    this._bind(canvas);
  }

  _bind(canvas) {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressed.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.mouseDown = false; });

    canvas.addEventListener('mousedown', (e) => {
      this.mouseDown = true;
      this.dragged = false;
      this.downX = e.clientX;
      this.downY = e.clientY;
    });
    window.addEventListener('mousemove', (e) => {
      if (!this.mouseDown) return;
      this.dragX += e.movementX;
      this.dragY += e.movementY;
      if (Math.abs(e.clientX - this.downX) + Math.abs(e.clientY - this.downY) > 6) this.dragged = true;
    });
    window.addEventListener('mouseup', (e) => {
      if (!this.mouseDown) return;
      this.mouseDown = false;
      if (!this.dragged && e.target === this.canvas) this.clicked = true;
    });
    canvas.addEventListener('wheel', (e) => { this.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  down(code) { return this.keys.has(code); }
  wasPressed(code) { return this.pressed.has(code); }

  // WASD / arrows as a -1..1 pair, x = strafe right, y = forward.
  moveAxes() {
    const strafe = (this.down('KeyD') || this.down('ArrowRight') ? 1 : 0) - (this.down('KeyA') || this.down('ArrowLeft') ? 1 : 0);
    const forward = (this.down('KeyW') || this.down('ArrowUp') ? 1 : 0) - (this.down('KeyS') || this.down('ArrowDown') ? 1 : 0);
    return { x: strafe, y: forward };
  }

  // Consume the frame's drag deltas (pixels since last frame).
  takeDrag() {
    const d = { x: this.dragX, y: this.dragY };
    this.dragX = 0;
    this.dragY = 0;
    return d;
  }

  takeWheel() {
    const w = this.wheel;
    this.wheel = 0;
    return w;
  }

  takeClick() {
    const c = this.clicked;
    this.clicked = false;
    return c;
  }

  endFrame() {
    this.pressed.clear();
  }
}
