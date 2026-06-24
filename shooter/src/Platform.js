import { Physics } from './Physics.js';

export class Platform {
  constructor(x, y, width, height, type = 'solid') {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.type = type; // 'solid', 'lava', 'spikes'
  }

  draw(ctx) {
    if (this.type === 'solid') {
      ctx.fillStyle = '#4a5043'; // Dark brown/gray dirt
    } else if (this.type === 'lava') {
      ctx.fillStyle = '#a33c3c'; // Lava red
    } else if (this.type === 'spikes') {
      ctx.fillStyle = '#888';
    }
    ctx.fillRect(this.x, this.y, this.width, this.height);
  }
}
