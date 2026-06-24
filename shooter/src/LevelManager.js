import { Platform } from './Platform.js';
import { Enemy } from './Enemy.js';
import { Pickup } from './Pickup.js';
import { Weapons } from './Weapon.js';

export const LevelManager = {
  loadLevel(levelIndex, game) {
    game.platforms = [];
    game.enemies = [];
    game.bullets = [];
    game.pickups = [];
    
    // Nivel 1 (3500px de ancho)
    if (levelIndex === 1) {
      // Suelos base (Altura 500)
      game.platforms.push(new Platform(0, 500, 800, 100)); // Inicio seguro
      game.platforms.push(new Platform(900, 500, 400, 100)); // Salto 1
      game.platforms.push(new Platform(1400, 500, 800, 100)); // Suelo intermedio
      game.platforms.push(new Platform(2400, 500, 1200, 100)); // Zona final extensa

      // Plataformas elevadas (Aportan verticalidad y ahora tienen un propósito)
      game.platforms.push(new Platform(400, 420, 100, 20)); 
      game.platforms.push(new Platform(650, 340, 150, 20)); 
      game.platforms.push(new Platform(1100, 420, 100, 20)); 
      game.platforms.push(new Platform(1500, 420, 200, 20)); 
      game.platforms.push(new Platform(1750, 340, 150, 20)); 
      game.platforms.push(new Platform(2000, 260, 150, 20)); 
      game.platforms.push(new Platform(2500, 400, 150, 20)); // Inicio ascenso final
      game.platforms.push(new Platform(2700, 300, 150, 20)); 
      game.platforms.push(new Platform(2900, 200, 150, 20)); 
      game.platforms.push(new Platform(3200, 150, 300, 50)); // Plataforma de la meta

      // Enemigos con distintas armas
      game.enemies.push(new Enemy(500, 450, 'walker'));
      game.enemies.push(new Enemy(750, 300, 'shooter', Weapons.MachineGun)); // Dispara ráfagas
      game.enemies.push(new Enemy(1100, 450, 'walker'));
      game.enemies.push(new Enemy(1600, 380, 'shooter', Weapons.Shotgun)); // Dispara perdigones
      game.enemies.push(new Enemy(1900, 450, 'walker'));
      game.enemies.push(new Enemy(2200, 450, 'shooter', Weapons.MachineGun));
      game.enemies.push(new Enemy(2800, 250, 'shooter', Weapons.Shotgun)); // Protegiendo ascenso

      // Pickups
      game.pickups.push(new Pickup(700, 310, 'weapon', Weapons.MachineGun)); 
      game.pickups.push(new Pickup(1450, 470, 'health')); 
      game.pickups.push(new Pickup(2600, 470, 'weapon', Weapons.Shotgun)); 
      
      // Goal Platform (Elevada al final del mapa)
      game.goal = { x: 3300, y: 100, width: 50, height: 50 };
      
      // Reset player pos
      game.player.x = 50;
      game.player.y = 100;
      game.player.hp = game.player.maxHp;
      document.getElementById('hp-val').innerText = game.player.hp;
      game.player.weapon = Weapons.Pistol; // Reset arma inicial
      document.getElementById('weapon-val').innerText = game.player.weapon.name;
    }
    // Nivel 2 (3000px de ancho)
    else if (levelIndex === 2) {
      // Lava en casi todo el nivel inferior
      game.platforms.push(new Platform(0, 580, 3000, 20, 'lava'));

      // Pilares de salto (Ajustados a distancias alcanzables)
      game.platforms.push(new Platform(0, 500, 200, 100)); // Suelo 500
      game.platforms.push(new Platform(300, 450, 100, 200)); // Suelo 450
      game.platforms.push(new Platform(500, 400, 100, 300)); // Suelo 400
      game.platforms.push(new Platform(750, 350, 150, 20));  // Suelo 350
      game.platforms.push(new Platform(1000, 450, 100, 200)); // Baja a 450
      game.platforms.push(new Platform(1300, 450, 300, 150)); // Suelo 450 (termina en 1600)
      game.platforms.push(new Platform(1770, 400, 100, 250)); // Antes 1800 (Gap de 170px)
      game.platforms.push(new Platform(2000, 350, 150, 20));  // Antes 2100
      game.platforms.push(new Platform(2370, 500, 600, 100)); // Antes 2400 (Zona final segura)

      // Enemigos
      game.enemies.push(new Enemy(320, 400, 'shooter'));
      game.enemies.push(new Enemy(800, 300, 'shooter'));
      game.enemies.push(new Enemy(1400, 400, 'walker'));
      game.enemies.push(new Enemy(1500, 400, 'walker'));
      game.enemies.push(new Enemy(1790, 350, 'shooter'));
      game.enemies.push(new Enemy(2170, 300, 'shooter'));

      // Pickups
      game.pickups.push(new Pickup(520, 370, 'weapon', Weapons.Shotgun)); // Escopeta
      game.pickups.push(new Pickup(1450, 420, 'health')); // Cura
      game.pickups.push(new Pickup(2120, 320, 'health')); // Cura
      
      game.goal = { x: 2870, y: 450, width: 50, height: 50 };
      
      game.player.x = 50;
      game.player.y = 100;
    }
  }
};
