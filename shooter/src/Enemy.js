import { Bullet } from './Bullet.js';
import { Weapons } from './Weapon.js';

export class Enemy {
  constructor(x, y, type = 'walker', weapon = null) {
    this.x = x;
    this.y = y;
    this.type = type; 
    this.width = 30;
    this.height = 45; // Mismo tamaño que el player
    
    this.vx = 2; 
    this.vy = 0;
    this.hp = 30;
    
    this.direction = -1; // Por defecto miran a la izquierda
    this.patrolDist = 150;
    this.startX = x;

    // Asignar arma o usar pistola por defecto
    this.weapon = weapon || Weapons.Pistol;
  }

  update(deltaTime, gameTime, bulletArray, player, platforms) {
    if (this.type === 'walker') {
      this.x += this.vx * this.direction;
      if (Math.abs(this.x - this.startX) > this.patrolDist) {
        this.direction *= -1;
      }
      this.vy += 0.5;
      this.y += this.vy;
      
      // Los caminantes podrían disparar si están cerca y miran al jugador
      let distToPlayer = Math.abs(this.x - player.x);
      if (distToPlayer < 200 && ((this.direction === -1 && player.x < this.x) || (this.direction === 1 && player.x > this.x))) {
        this.shoot(gameTime, bulletArray);
      }
    } 
    else if (this.type === 'shooter') {
      let distToPlayer = Math.abs(this.x - player.x);
      this.direction = this.x < player.x ? 1 : -1;
      
      this.vy += 0.5;
      this.y += this.vy;

      if (distToPlayer < 450) {
        this.shoot(gameTime, bulletArray);
      }
    }
  }

  shoot(gameTime, bulletArray) {
    let startX = this.direction === 1 ? this.x + this.width + 5 : this.x - 5;
    let startY = this.y + this.height / 2 - 2;
    // Disparar usando el arma. Sobrescribir el color para que sea enemigo.
    let oldColor = this.weapon.bulletColor;
    this.weapon.bulletColor = '#c9b161'; // Balas enemigas amarillentas
    this.weapon.fire(startX, startY, this.direction, gameTime, bulletArray);
    this.weapon.bulletColor = oldColor;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
    ctx.scale(this.direction, 1);

    // DIBUJAR SOLDADO ENEMIGO (Tonos verdosos-amarillentos)
    // Casco
    ctx.fillStyle = '#6a7a2a'; // Verde-amarillento
    ctx.fillRect(-15, -22, 26, 12); 
    ctx.fillRect(-10, -25, 18, 5);  
    ctx.fillRect(10, -18, 5, 4);    

    // Cara (Color piel pálida)
    ctx.fillStyle = '#d5b288';
    ctx.fillRect(-12, -10, 20, 10);
    
    // Ojo rojo de enemigo
    ctx.fillStyle = '#a33c3c';
    ctx.fillRect(0, -8, 8, 4);

    // Torso 
    ctx.fillStyle = '#7a8043';
    ctx.fillRect(-10, 0, 18, 16);
    // Cinturón
    ctx.fillStyle = '#333';
    ctx.fillRect(-11, 12, 20, 4);

    // Brazo y arma
    ctx.fillStyle = '#6a7a2a';
    ctx.fillRect(-2, 4, 12, 6); 
    ctx.fillStyle = '#111';
    ctx.fillRect(8, 2, 16, 6); 
    
    // Piernas 
    ctx.fillStyle = '#5a6a1a';
    ctx.fillRect(-8, 16, 6, 10);
    ctx.fillRect(2, 16, 6, 10);

    ctx.restore();
  }
}
