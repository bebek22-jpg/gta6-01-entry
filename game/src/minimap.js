// Solmar Heat — the minimap: a 2D canvas that draws the street grid once,
// then the player arrow, mission marker, police, enemies and traffic.

import { CITY } from './config.js';

export class Minimap {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.size = canvas.width;
    this.scale = this.size / (CITY.EDGE * 2 + 60);
    this.cx = this.size / 2;
    this.cy = this.size / 2;
    this._drawStatic();
  }

  _toMap(x, z) {
    return [this.cx + x * this.scale, this.cy + z * this.scale];
  }

  _drawStatic() {
    const ctx = this.ctx;
    ctx.fillStyle = '#101c26';
    ctx.fillRect(0, 0, this.size, this.size);
    // The bay, south edge.
    const [, wy] = this._toMap(0, CITY.WATER_START);
    ctx.fillStyle = '#1d6f96';
    ctx.fillRect(0, wy, this.size, this.size - wy);
    const [, sy] = this._toMap(0, CITY.BEACH_START);
    ctx.fillStyle = '#d9c287';
    ctx.fillRect(0, sy, this.size, wy - sy);
    // City blocks.
    ctx.fillStyle = '#24384a';
    for (const bx of CITY.BLOCK_CENTERS) {
      for (const bz of CITY.BLOCK_CENTERS) {
        const [x, y] = this._toMap(bx - CITY.BLOCK_HALF - 2, bz - CITY.BLOCK_HALF - 2);
        const w = (CITY.BLOCK_HALF + 2) * 2 * this.scale;
        ctx.fillRect(x, y, w, w);
      }
    }
    // Roads.
    ctx.strokeStyle = '#5a6d7d';
    ctx.lineWidth = Math.max(2, CITY.ROAD_HALF * 2 * this.scale);
    for (const line of CITY.ROAD_LINES) {
      const [x] = this._toMap(line, 0);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.size);
      ctx.stroke();
      const [, y] = this._toMap(0, line);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.size, y);
      ctx.stroke();
    }
    this.staticFrame = ctx.getImageData(0, 0, this.size, this.size);
  }

  draw(state) {
    const ctx = this.ctx;
    ctx.putImageData(this.staticFrame, 0, 0);
    // Traffic as faint dots.
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (const t of state.traffic) {
      const [x, y] = this._toMap(t.x, t.z);
      ctx.fillRect(x - 1, y - 1, 2, 2);
    }
    // Mission marker: a blinking yellow diamond.
    if (state.marker && Math.floor(state.time * 2.5) % 2 === 0) {
      const [x, y] = this._toMap(state.marker.x, state.marker.z);
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      ctx.moveTo(x, y - 6);
      ctx.lineTo(x + 5, y);
      ctx.lineTo(x, y + 6);
      ctx.lineTo(x - 5, y);
      ctx.closePath();
      ctx.fill();
    }
    // Police blips flash blue/red; enemies are red.
    for (const b of state.blips) {
      const [x, y] = this._toMap(b.x, b.z);
      ctx.fillStyle = b.kind === 'police'
        ? (Math.floor(state.time * 3) % 2 === 0 ? '#3b82ff' : '#ff3b3b')
        : '#ff4444';
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // The player: a white arrow that points where they face.
    const [px, py] = this._toMap(state.playerX, state.playerZ);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(Math.atan2(state.headingX, -state.headingZ) + Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    // North tick.
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('N', this.size / 2, 12);
  }
}
