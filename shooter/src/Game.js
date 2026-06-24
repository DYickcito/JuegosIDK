import { Player } from './Player.js';
import { InputHandler } from './InputHandler.js';
import { Physics } from './Physics.js';
import { LevelManager } from './LevelManager.js';
import { Weapons } from './Weapon.js';

export class Game {
  constructor(canvasWidth, canvasHeight) {
    this.width = canvasWidth;
    this.height = canvasHeight;
    this.input = new InputHandler();
    this.player = new Player(this);
    
    this.platforms = [];
    this.enemies = [];
    this.bullets = []; 
    this.pickups = []; // Cajas de armas/vida
    this.goal = null;
    
    this.currentLevel = 1;
    this.maxLevel = 2;
    this.score = 0;
    this.gameTime = 0;
    
    this.cameraX = 0; // Seguimiento de cámara
    
    this.state = 'PLAYING'; 
    
    LevelManager.loadLevel(this.currentLevel, this);
  }

  update(deltaTime) {
    if (this.state !== 'PLAYING') return;

    this.gameTime += deltaTime;
    this.player.update(this.input, deltaTime);

    // Actualizar cámara para seguir al jugador (centrado aprox a la izquierda)
    // El jugador estará a unos 300px del borde izquierdo de la pantalla.
    this.cameraX = this.player.x - 300;
    if (this.cameraX < 0) this.cameraX = 0;

    // Platform Collisions (Player)
    this.player.onGround = false;
    for (let platform of this.platforms) {
      if (Physics.checkCollision(this.player, platform)) {
        if (platform.type === 'lava' || platform.type === 'spikes') {
          this.player.takeDamage(10);
          this.player.vy = -10; 
        } else {
          Physics.resolvePlatformCollision(this.player, platform);
        }
      }
    }

    // Pickups Collisions
    for (let pickup of this.pickups) {
      if (Physics.checkCollision(this.player, pickup)) {
        if (pickup.type === 'weapon') {
          this.player.weapon = pickup.weapon;
          document.getElementById('weapon-val').innerText = this.player.weapon.name;
        } else if (pickup.type === 'health') {
          this.player.heal(20); // Cura 20%
        }
        pickup.markedForDeletion = true;
      }
    }

    // Platform Collisions (Enemies)
    for (let enemy of this.enemies) {
      for (let platform of this.platforms) {
        if (platform.type === 'solid' && Physics.checkCollision(enemy, platform)) {
           if (enemy.vy > 0 && enemy.y + enemy.height - enemy.vy <= platform.y + 5) {
             enemy.y = platform.y - enemy.height;
             enemy.vy = 0;
           }
        }
      }
    }

    // Goal Collision
    if (this.goal && Physics.checkCollision(this.player, this.goal)) {
      this.state = 'LEVEL_COMPLETE';
      document.getElementById('level-complete-screen').classList.remove('hidden');
    }

    // Enemy Updates
    this.enemies.forEach(enemy => {
      enemy.update(deltaTime, this.gameTime, this.bullets, this.player, this.platforms);
      
      if (Physics.checkCollision(this.player, enemy)) {
        this.player.takeDamage(10);
      }
    });

    // Bullets Updates
    this.bullets.forEach(bullet => {
      bullet.update();
      
      for (let platform of this.platforms) {
        if (platform.type === 'solid' && Physics.checkCollision(bullet, platform)) {
          bullet.markedForDeletion = true;
        }
      }
      
      if (bullet.color === '#c9b161' && Physics.checkCollision(bullet, this.player)) { 
        this.player.takeDamage(bullet.damage);
        bullet.markedForDeletion = true;
      }
      
      if (bullet.color !== '#c9b161') { 
        for (let enemy of this.enemies) {
          if (Physics.checkCollision(bullet, enemy)) {
            enemy.hp -= bullet.damage;
            bullet.markedForDeletion = true;
            if (enemy.hp <= 0) {
              enemy.markedForDeletion = true;
              this.score += 50;
              document.getElementById('score-val').innerText = this.score;
            }
          }
        }
      }
    });

    // Cleanup marked entities
    this.enemies = this.enemies.filter(e => !e.markedForDeletion);
    this.bullets = this.bullets.filter(b => !b.markedForDeletion);
    this.pickups = this.pickups.filter(p => !p.markedForDeletion);
  }

  draw(ctx) {
    ctx.clearRect(0, 0, this.width, this.height);

    ctx.save();
    // Desplazamiento de cámara
    ctx.translate(-this.cameraX, 0);

    if (this.goal) {
      ctx.fillStyle = '#8c9c61'; 
      ctx.fillRect(this.goal.x, this.goal.y, this.goal.width, this.goal.height);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillText("META", this.goal.x + 5, this.goal.y + 25);
    }

    this.platforms.forEach(platform => platform.draw(ctx));
    this.pickups.forEach(pickup => pickup.draw(ctx));
    this.enemies.forEach(enemy => enemy.draw(ctx));
    this.bullets.forEach(bullet => bullet.draw(ctx));
    this.player.draw(ctx);

    ctx.restore();
  }

  triggerGameOver() {
    this.state = 'GAMEOVER';
    document.getElementById('game-over-screen').classList.remove('hidden');
  }

  reset() {
    this.state = 'PLAYING';
    document.getElementById('game-over-screen').classList.add('hidden');
    document.getElementById('level-complete-screen').classList.add('hidden');
    
    LevelManager.loadLevel(this.currentLevel, this);
  }

  nextLevel() {
    this.currentLevel++;
    if (this.currentLevel > this.maxLevel) {
      alert("¡Juego Completado! Misión Exitosa.");
      this.currentLevel = 1;
    }
    this.reset();
  }
}
