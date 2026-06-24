export class Bullet {
  constructor(x, y, dirX, dirY, speed, damage, color = '#e5e5e5', size = 4) {
    this.x = x;
    this.y = y;
    this.width = size;
    this.height = size;
    this.vx = dirX * speed;
    this.vy = dirY * speed;
    this.damage = damage;
    this.color = color;
    this.markedForDeletion = false;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    
    // Nivel extendido, eliminamos bala si sale muy lejos (ej. -500 a 4000)
    if (this.x < -500 || this.x > 4000 || this.y < -500 || this.y > 2000) {
      this.markedForDeletion = true;
    }
  }

  draw(ctx) {
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x, this.y, this.width, this.height);
  }
}
