import { Weapons } from './Weapon.js';

export class Player {
  constructor(game) {
    this.game = game;
    this.width = 30;
    this.height = 45; // Ligeramente más bajo para el nuevo diseño
    this.x = 50;
    this.y = 100;
    
    this.vx = 0;
    this.vy = 0;
    this.speed = 5;
    this.jumpForce = -12;
    this.gravity = 0.6;
    
    this.onGround = false;
    this.direction = 1; // 1 = right, -1 = left
    
    this.hp = 100;
    this.maxHp = 100;
    this.weapon = Weapons.Pistol;
    
    this.invincible = false;
    this.invincibleTimer = 0;
    this.invincibleDuration = 1000;
  }

  update(input, deltaTime) {
    // Horizontal Movement
    if (input.isDown('ArrowRight') || input.isDown('KeyD')) {
      this.vx = this.speed;
      this.direction = 1;
    } else if (input.isDown('ArrowLeft') || input.isDown('KeyA')) {
      this.vx = -this.speed;
      this.direction = -1;
    } else {
      this.vx = 0;
    }

    this.x += this.vx;

    // Boundary horizontal (solo lado izquierdo para no salir del mapa hacia atrás)
    if (this.x < 0) this.x = 0;

    // Vertical Movement (Gravity & Jump)
    if ((input.isDown('ArrowUp') || input.isDown('KeyW') || input.isDown('Space')) && this.onGround) {
      this.vy = this.jumpForce;
      this.onGround = false;
    }

    this.vy += this.gravity;
    this.y += this.vy;

    this.onGround = false;

    // If player falls out of bottom (Game Over / Lose HP)
    if (this.y > this.game.height + 100) {
      this.takeDamage(100); // Instant death
    }

    // Shooting
    if (input.isDown('KeyK') || input.mouse.down) {
      this.shoot();
    }

    // Invincibility Timer
    if (this.invincible) {
      this.invincibleTimer += deltaTime;
      if (this.invincibleTimer >= this.invincibleDuration) {
        this.invincible = false;
        this.invincibleTimer = 0;
      }
    }
  }

  draw(ctx) {
    if (this.invincible && Math.floor(this.invincibleTimer / 100) % 2 === 0) {
      return;
    }

    ctx.save();
    // Trasladar al centro del jugador para aplicar rotaciones/escalas direccionales
    ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
    // Escalar en X para voltear el sprite dependiendo de la dirección
    ctx.scale(this.direction, 1);

    // DIBUJAR SOLDADO RETRO
    // Todo se dibuja relativo al centro (0, 0)
    
    // Casco (Verde militar)
    ctx.fillStyle = '#3a4a2a';
    ctx.fillRect(-15, -22, 26, 12); // Base del casco
    ctx.fillRect(-10, -25, 18, 5);  // Cúpula
    ctx.fillRect(10, -18, 5, 4);    // Visera

    // Cara (Color piel retro)
    ctx.fillStyle = '#e5c298';
    ctx.fillRect(-12, -10, 20, 10);
    
    // Ojo / Visor protector (Negro)
    ctx.fillStyle = '#111';
    ctx.fillRect(0, -8, 8, 4);

    // Torso (Chaleco táctico marrón/verde)
    ctx.fillStyle = '#4a5043';
    ctx.fillRect(-10, 0, 18, 16);
    // Cinturón
    ctx.fillStyle = '#222';
    ctx.fillRect(-11, 12, 20, 4);

    // Brazo y arma (Gris oscuro/Metal)
    ctx.fillStyle = '#6b705c';
    ctx.fillRect(-2, 4, 12, 6); // Brazo
    ctx.fillStyle = '#333';
    ctx.fillRect(8, 2, 16, 6); // Arma
    
    // Si dispara escopeta o arma especial, pintar un detalle
    if (this.weapon.name === 'Escopeta') {
       ctx.fillStyle = '#a33c3c';
       ctx.fillRect(10, 2, 8, 2);
    } else if (this.weapon.name === 'Metralleta') {
       ctx.fillStyle = '#c9b161';
       ctx.fillRect(12, 4, 10, 2);
    }

    // Piernas (Pantalones camuflaje/verde oscuro)
    ctx.fillStyle = '#2a3a1a';
    // Pierna trasera
    ctx.fillRect(-8, 16, 6, 10);
    // Pierna delantera
    ctx.fillRect(2, 16, 6, 10);

    ctx.restore();
  }

  shoot() {
    let startX = this.direction === 1 ? this.x + this.width + 5 : this.x - 5;
    let startY = this.y + this.height / 2 - 2;
    this.weapon.fire(startX, startY, this.direction, this.game.gameTime, this.game.bullets);
    
    document.getElementById('weapon-val').innerText = this.weapon.name;
  }

  takeDamage(amount) {
    if (this.invincible) return;
    this.hp -= amount;
    this.invincible = true;
    if (this.hp <= 0) {
      this.hp = 0;
      this.game.triggerGameOver();
    }
    document.getElementById('hp-val').innerText = this.hp;
  }

  heal(amount) {
    this.hp += amount;
    if (this.hp > this.maxHp) this.hp = this.maxHp;
    document.getElementById('hp-val').innerText = this.hp;
  }
}
