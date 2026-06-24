import { Bullet } from './Bullet.js';

export class Weapon {
  constructor(name, fireRate, damage, bulletSpeed, bulletColor, bulletsPerShot = 1) {
    this.name = name;
    this.fireRate = fireRate; 
    this.damage = damage;
    this.bulletSpeed = bulletSpeed;
    this.bulletColor = bulletColor;
    this.bulletsPerShot = bulletsPerShot;
    
    this.lastShotTime = 0;
  }

  fire(x, y, direction, gameTime, bulletArray) {
    if (gameTime - this.lastShotTime > this.fireRate) {
      if (this.bulletsPerShot === 1) {
        bulletArray.push(new Bullet(x, y, direction, 0, this.bulletSpeed, this.damage, this.bulletColor));
      } else {
        for (let i = 0; i < this.bulletsPerShot; i++) {
          let spreadY = (Math.random() - 0.5) * 0.4;
          bulletArray.push(new Bullet(x, y, direction, spreadY, this.bulletSpeed, this.damage, this.bulletColor));
        }
      }
      this.lastShotTime = gameTime;
      return true;
    }
    return false;
  }
}

export const Weapons = {
  get Pistol() { return new Weapon("Pistola", 400, 20, 10, "#e5e5e5"); },
  get MachineGun() { return new Weapon("Metralleta", 100, 10, 12, "#e5b555"); },
  get Shotgun() { return new Weapon("Escopeta", 800, 15, 8, "#a33c3c", 5); }
};
