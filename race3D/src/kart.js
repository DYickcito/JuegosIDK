import * as THREE from 'three';
import { sounds } from './sound.js';

export class Kart {
  constructor(scene, track, color = '#ff007f', isPlayer = false) {
    this.scene = scene;
    this.track = track;
    this.color = color;
    this.isPlayer = isPlayer;

    // --- PARÁMETROS FÍSICOS ---
    this.position = new THREE.Vector3(0, 0, 0);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.speed = 0;
    this.yaw = Math.PI; // Dirección angular
    this.roll = 0;
    this.pitch = 0;
    
    // Ajustes de conducción (arcade mejorada y más rápida)
    this.maxSpeed = 48;
    this.maxReverseSpeed = -18;
    this.acceleration = 25;
    this.braking = 42;
    this.friction = 7;
    this.gravity = 50;
    this.turnSpeedBase = 1.95;
    
    // Mecánica de Derrape (Drift)
    this.isDrifting = false;
    this.driftDirection = 0; // -1 Izquierda, 1 Derecha
    this.driftCharge = 0; // Tiempo cargando derrape
    this.driftAngle = 0; // Ángulo visual de derrape
    this.boostTime = 0; // Duración restante del turbo
    this.boostPower = 0;

    // Nuevos estados de Habilidades/Poderes
    this.starTime = 0.0;    // Invencibilidad arcoíris
    this.isShrunk = false;  // Encogido por rayo
    this.shrunkTimer = 0.0;

    // Estados de control / efectos
    this.frozen = false;   // Congelar controles/físicas al inicio
    this.spinoutTimer = 0; // Temporizador al ser golpeado
    this.respawnTimer = 0; // Proceso de recolocación
    this.lastSafeSegment = 0;
    this.prevSegment = undefined; // Usado para conteo de vueltas
    this.radius = 1.6; // Radio para colisiones
    this.currentLap = 1;
    this.raceFinished = false;
    
    // Equipamiento de Items
    this.equippedItem = null; // 'mushroom', 'banana', 'shell', 'star', 'lightning'

    // Entradas del teclado
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      drift: false,
      useItem: false
    };

    // Crear modelo visual 3D
    this.createModel();

    if (this.isPlayer) {
      this.setupControls();
    }
  }

  // --- MODELO 3D PROCEDIMENTAL DEL KART ---
  createModel() {
    this.mesh = new THREE.Group();

    // 1. Chasis del vehículo
    const bodyGeom = new THREE.BoxGeometry(2, 0.5, 3.2);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(this.color),
      roughness: 0.2,
      metalness: 0.8
    });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    body.position.y = 0.4;
    body.castShadow = true;
    body.receiveShadow = true;
    this.mesh.add(body);

    this.bodyMaterial = bodyMat; // Guardar referencia para efectos de color (Estrella)

    // Cabina/Asiento
    const seatGeom = new THREE.BoxGeometry(1.2, 0.8, 1);
    const seatMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.9 });
    const seat = new THREE.Mesh(seatGeom, seatMat);
    seat.position.set(0, 0.8, 0);
    seat.castShadow = true;
    this.mesh.add(seat);

    // Motor
    const engineGeom = new THREE.BoxGeometry(1.2, 0.8, 1);
    const engineMat = new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.9, roughness: 0.3 });
    const engine = new THREE.Mesh(engineGeom, engineMat);
    engine.position.set(0, 0.7, 1);
    engine.castShadow = true;
    this.mesh.add(engine);

    // 2. Alerón (Spoiler)
    const spoilerBarGeom = new THREE.BoxGeometry(0.1, 1.2, 0.1);
    const spoilerBarMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
    const barLeft = new THREE.Mesh(spoilerBarGeom, spoilerBarMat);
    barLeft.position.set(-0.8, 1.1, 1.4);
    const barRight = new THREE.Mesh(spoilerBarGeom, spoilerBarMat);
    barRight.position.set(0.8, 1.1, 1.4);

    const wingGeom = new THREE.BoxGeometry(2.4, 0.15, 0.8);
    const wing = new THREE.Mesh(wingGeom, bodyMat);
    wing.position.set(0, 1.7, 1.4);
    wing.castShadow = true;
    this.mesh.add(barLeft, barRight, wing);

    // 3. Ruedas (4 Cilindros con animación de giro)
    const wheelGeom = new THREE.CylinderGeometry(0.5, 0.5, 0.45, 12);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
    wheelGeom.rotateZ(Math.PI / 2);

    this.wheels = [];
    const wheelOffsets = [
      { name: 'fl', x: -1.1, y: 0.3, z: -1.1, front: true },
      { name: 'fr', x: 1.1, y: 0.3, z: -1.1, front: true },
      { name: 'rl', x: -1.1, y: 0.3, z: 1.1, front: false },
      { name: 'rr', x: 1.1, y: 0.3, z: 1.1, front: false }
    ];

    wheelOffsets.forEach((offset) => {
      const wheelMesh = new THREE.Mesh(wheelGeom, wheelMat);
      wheelMesh.position.set(offset.x, offset.y, offset.z);
      wheelMesh.castShadow = true;
      this.mesh.add(wheelMesh);
      
      this.wheels.push({
        mesh: wheelMesh,
        isFront: offset.front,
        baseX: offset.x
      });
    });

    // 4. Luces delanteras (faros)
    const headlightGeom = new THREE.BoxGeometry(0.3, 0.2, 0.2);
    const headlightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const hlLeft = new THREE.Mesh(headlightGeom, headlightMat);
    hlLeft.position.set(-0.7, 0.5, -1.55);
    const hlRight = new THREE.Mesh(headlightGeom, headlightMat);
    hlRight.position.set(0.7, 0.5, -1.55);
    this.mesh.add(hlLeft, hlRight);

    // 5. Tubos de escape
    const pipeGeom = new THREE.CylinderGeometry(0.12, 0.12, 0.5, 8);
    pipeGeom.rotateX(Math.PI / 2);
    const pipeMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.9 });
    this.exhaustPipes = [
      new THREE.Mesh(pipeGeom, pipeMat),
      new THREE.Mesh(pipeGeom, pipeMat)
    ];
    this.exhaustPipes[0].position.set(-0.4, 0.2, 1.6);
    this.exhaustPipes[1].position.set(0.4, 0.2, 1.6);
    this.mesh.add(this.exhaustPipes[0], this.exhaustPipes[1]);

    // Contenedor visual
    this.visualContainer = new THREE.Group();
    this.visualContainer.add(this.mesh);
    this.scene.add(this.visualContainer);

    this.particles = [];
  }

  // --- CONFIGURACIÓN DE TECLADO ---
  setupControls() {
    window.addEventListener('keydown', (e) => {
      sounds.init();
      switch (e.code) {
        case 'ArrowUp':
        case 'KeyW': this.keys.forward = true; break;
        case 'ArrowDown':
        case 'KeyS': this.keys.backward = true; break;
        case 'ArrowLeft':
        case 'KeyA': this.keys.left = true; break;
        case 'ArrowRight':
        case 'KeyD': this.keys.right = true; break;
        case 'Space':
          e.preventDefault(); // Evitar desplazamiento vertical de la página
        case 'ShiftLeft':
        case 'ShiftRight': this.keys.drift = true; break;
        case 'Enter':
          e.preventDefault(); // Evitar disparar clicks en botones enfocados
          this.keys.useItem = true;
          break;
      }
    });

    window.addEventListener('keyup', (e) => {
      switch (e.code) {
        case 'ArrowUp':
        case 'KeyW': this.keys.forward = false; break;
        case 'ArrowDown':
        case 'KeyS': this.keys.backward = false; break;
        case 'ArrowLeft':
        case 'KeyA': this.keys.left = false; break;
        case 'ArrowRight':
        case 'KeyD': this.keys.right = false; break;
        case 'Space':
        case 'ShiftLeft':
        case 'ShiftRight': this.keys.drift = false; break;
        case 'Enter': this.keys.useItem = false; break;
      }
    });
  }

  // --- ACTUALIZACIÓN GLOBAL (Ejecutada por fotograma) ---
  update(deltaTime) {
    // 1. Efecto visual y de velocidad de Estrella Invencible
    if (this.starTime > 0) {
      this.starTime -= deltaTime;
      const hue = (Date.now() * 0.004) % 1.0;
      const rainbowColor = new THREE.Color().setHSL(hue, 1.0, 0.5);
      this.bodyMaterial.color.copy(rainbowColor);
      this.bodyMaterial.emissive.copy(rainbowColor).multiplyScalar(0.65);

      if (this.starTime <= 0) {
        this.bodyMaterial.color.set(this.color);
        this.bodyMaterial.emissive.setHex(0x000000);
      }
    }

    // 2. Efecto de encogimiento por Rayo
    if (this.shrunkTimer > 0) {
      this.shrunkTimer -= deltaTime;
      if (this.shrunkTimer <= 0) {
        this.isShrunk = false;
        this.mesh.scale.set(1.0, 1.0, 1.0);
      }
    }

    if (this.respawnTimer > 0) {
      this.updateRespawn(deltaTime);
    } else if (this.spinoutTimer > 0) {
      this.updateSpinout(deltaTime);
    } else if (!this.frozen) {
      this.handleInput(deltaTime);
      this.applyPhysics(deltaTime);
      this.handleDrifting(deltaTime);
      this.checkCollisions(deltaTime);
    }

    // Mantener la alineación visual, renderizado de humo y ruedas siempre activos
    this.snapToRoad(deltaTime);
    this.updateParticles(deltaTime);
    this.animateWheels(deltaTime);
  }

  handleInput(deltaTime) {
    if (this.raceFinished) {
      this.keys.forward = false;
      this.keys.left = false;
      this.keys.right = false;
      this.speed = Math.max(0, this.speed - this.braking * 0.5 * deltaTime);
      return;
    }

    // Comprobar si estamos sobre pasto (fuera de carretera) para aplicar fricción
    const roadInfo = this.track.getRoadHeightAndNormal(this.position);
    const grassSlowdown = (!roadInfo.isOnRoad && this.boostTime <= 0 && this.starTime <= 0); // La estrella ignora el pasto!
    
    // Velocidad máxima según estado (Estrella añade turbo pasivo, Rayo reduce a la mitad)
    let baseMax = this.maxSpeed;
    if (this.starTime > 0) baseMax += 12;
    if (this.isShrunk) baseMax *= 0.55;

    const currentMaxSpeed = grassSlowdown ? 16 : (this.boostTime > 0 ? baseMax + this.boostPower : baseMax);

    if (this.keys.forward) {
      let accel = this.acceleration;
      if (this.boostTime > 0) accel *= 1.8;
      if (this.starTime > 0) accel *= 1.4; // Aceleración mejorada
      if (grassSlowdown) accel *= 0.5; // Aceleración más pesada
      if (this.isShrunk) accel *= 0.6;
      
      this.speed = Math.min(currentMaxSpeed, this.speed + accel * deltaTime);
    } else if (this.keys.backward) {
      const activeReverse = grassSlowdown ? this.maxReverseSpeed * 0.5 : this.maxReverseSpeed;
      const finalReverse = this.isShrunk ? activeReverse * 0.6 : activeReverse;
      this.speed = Math.max(finalReverse, this.speed - this.braking * deltaTime);
    } else {
      if (this.speed > 0) {
        this.speed = Math.max(0, this.speed - this.friction * deltaTime);
      } else if (this.speed < 0) {
        this.speed = Math.min(0, this.speed + this.friction * deltaTime);
      }
    }

    // Frenado rápido si salimos de carretera a alta velocidad al pasto
    if (this.speed > currentMaxSpeed) {
      this.speed = Math.max(currentMaxSpeed, this.speed - this.braking * 1.5 * deltaTime);
    }

    if (Math.abs(this.speed) > 0.5) {
      const turnDir = this.speed > 0 ? 1 : -1;
      let actualTurnSpeed = this.turnSpeedBase;

      if (grassSlowdown) {
        actualTurnSpeed = this.turnSpeedBase * 0.75; // Menor agarre en pasto
      }

      if (this.isDrifting) {
        actualTurnSpeed = this.turnSpeedBase * 1.45;
      }

      if (this.keys.left) {
        this.yaw += actualTurnSpeed * turnDir * deltaTime;
      }
      if (this.keys.right) {
        this.yaw -= actualTurnSpeed * turnDir * deltaTime;
      }
    }
  }

  applyPhysics(deltaTime) {
    if (this.boostTime > 0) {
      this.boostTime -= deltaTime;
      if (this.boostTime <= 0) {
        this.boostPower = 0;
      }
    }

    const moveAngle = this.yaw + this.driftAngle;
    const forwardX = -Math.sin(moveAngle);
    const forwardZ = -Math.cos(moveAngle);
    
    this.velocity.set(forwardX * this.speed, 0, forwardZ * this.speed);
    this.position.addScaledVector(this.velocity, deltaTime);
  }

  handleDrifting(deltaTime) {
    const isTurning = this.keys.left || this.keys.right;

    if (this.keys.drift && isTurning && !this.isDrifting && this.speed > 14) {
      this.isDrifting = true;
      this.driftDirection = this.keys.left ? -1 : 1;
      this.driftCharge = 0;
      if (this.isPlayer) sounds.playDriftScreech(true);
    }

    if (this.isDrifting) {
      this.driftCharge += deltaTime;

      const targetDriftAngle = this.driftDirection * 0.42;
      this.driftAngle += (targetDriftAngle - this.driftAngle) * 0.1;
      this.mesh.rotation.z = -this.driftDirection * 0.08;

      this.spawnDriftSparks();

      if (!this.keys.drift || this.speed < 9) {
        this.releaseDrift();
      }
    } else {
      this.driftAngle += (0 - this.driftAngle) * 0.15;
      this.mesh.rotation.z += (0 - this.mesh.rotation.z) * 0.15;
    }
    this.mesh.rotation.y = this.driftAngle;
  }

  releaseDrift() {
    this.isDrifting = false;
    if (this.isPlayer) sounds.playDriftScreech(false);

    if (this.driftCharge > 1.5) {
      this.activateBoost(1.3, 16);
    } else if (this.driftCharge > 0.75) {
      this.activateBoost(0.6, 9);
    }
    this.driftCharge = 0;
  }

  activateBoost(duration, power) {
    this.boostTime = duration;
    this.boostPower = power;
    this.speed = Math.max(this.speed + power * 0.7, this.maxSpeed + power * 0.35);
    if (this.isPlayer) {
      sounds.playBoost();
      const lines = document.getElementById('speed-lines');
      if (lines) {
        lines.classList.add('active');
        setTimeout(() => lines.classList.remove('active'), duration * 1000);
      }
    }
  }

  snapToRoad(deltaTime) {
    const roadInfo = this.track.getRoadHeightAndNormal(this.position);

    if (roadInfo.isOnRoad) {
      this.lastSafeSegment = roadInfo.segmentIndex;
    }

    // Si está fuera de carretera, se sitúa a ras del pasto (Y = 0)
    const targetY = roadInfo.isOnRoad ? roadInfo.height + 0.12 : 0.12;
    this.position.y += (targetY - this.position.y) * 12 * deltaTime;

    // Normal plana (0,1,0) en pasto o normal inclinada en carretera
    const targetUp = roadInfo.isOnRoad ? roadInfo.normal : new THREE.Vector3(0, 1, 0);
    const forwardVec = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).normalize();
    const rightVec = new THREE.Vector3().crossVectors(forwardVec, targetUp).normalize();
    const realForward = new THREE.Vector3().crossVectors(targetUp, rightVec).normalize();

    const backVec = new THREE.Vector3().copy(realForward).multiplyScalar(-1);
    const rotationMatrix = new THREE.Matrix4().makeBasis(rightVec, targetUp, backVec);
    const targetQuaternion = new THREE.Quaternion().setFromRotationMatrix(rotationMatrix);
    
    this.visualContainer.position.copy(this.position);
    this.visualContainer.quaternion.slerp(targetQuaternion, 10 * deltaTime);

    if (this.position.y < -35) {
      this.triggerRespawn();
    }
  }

  checkCollisions(deltaTime) {
    // 1. Colisión lateral con setos vivos (si hubiera)
    const barrierCol = this.track.checkBarrierCollision(this.position, this.radius);
    if (barrierCol.collided) {
      this.position.add(barrierCol.correction);
      
      // Rebote y pérdida de velocidad
      this.speed = -this.speed * 0.2;
      this.driftCharge = 0;
      if (this.isDrifting) {
        this.isDrifting = false;
        if (this.isPlayer) sounds.playDriftScreech(false);
      }

      if (this.isPlayer && Math.abs(this.speed) > 2) {
        sounds.playCrash();
      }
    }

    // 1.5 Colisión con obstáculos estáticos del parque (árboles y columnas de meta)
    this.track.decorations.forEach((dec) => {
      const dx = this.position.x - dec.position.x;
      const dz = this.position.z - dec.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const minDist = this.radius + dec.radius;
      
      if (dist < minDist) {
        // Empujar hacia afuera del objeto sólido
        const overlap = minDist - dist;
        const normalX = dx / (dist || 1);
        const normalZ = dz / (dist || 1);
        
        this.position.x += normalX * overlap;
        this.position.z += normalZ * overlap;
        
        // Rebote y pérdida de velocidad
        this.speed = -this.speed * 0.25;
        this.driftCharge = 0;
        if (this.isDrifting) {
          this.isDrifting = false;
          if (this.isPlayer) sounds.playDriftScreech(false);
        }
        
        if (this.isPlayer && Math.abs(this.speed) > 1.5) {
          sounds.playCrash();
        }
      }
    });

    // 2. Turbos
    this.track.boostPads.forEach((pad) => {
      const dist = this.position.distanceTo(pad.position);
      if (dist < 4.8 && this.boostTime <= 0) {
        this.activateBoost(1.3, 20);
      }
    });

    // 3. Burbujas de Items
    this.track.itemBoxes.forEach((box) => {
      if (box.active) {
        const dist = this.position.distanceTo(box.mesh.position);
        if (dist < 2.5) {
          box.active = false;
          box.mesh.visible = false;
          box.respawnTimer = 5.0;
          
          if (this.isPlayer) {
            sounds.playItemPickup();
            this.rollItem();
          } else {
            const aiItems = ['mushroom', 'banana', 'shell', 'star', 'lightning'];
            this.equippedItem = aiItems[Math.floor(Math.random() * aiItems.length)];
          }
        }
      }
    });
  }

  rollItem() {
    if (this.equippedItem) return;
    const hudIcon = document.getElementById('item-icon');
    if (!hudIcon) return;

    hudIcon.className = 'roulette';

    setTimeout(() => {
      const items = ['mushroom', 'banana', 'shell', 'star', 'lightning'];
      const chosen = items[Math.floor(Math.random() * items.length)];
      this.equippedItem = chosen;
      hudIcon.className = chosen;
    }, 1200);
  }

  useItem(spawnCallback) {
    if (!this.equippedItem) return;
    if (this.isPlayer) sounds.playShoot();

    if (this.equippedItem === 'mushroom') {
      this.activateBoost(1.5, 24); // Turbo rápido
    } else if (this.equippedItem === 'star') {
      this.activateStar(6.5); // 6.5s de invencibilidad arcoíris
    } else {
      spawnCallback(this.equippedItem, this);
    }

    this.equippedItem = null;
    if (this.isPlayer) {
      const hudIcon = document.getElementById('item-icon');
      if (hudIcon) hudIcon.className = 'empty';
    }
  }

  activateStar(duration) {
    this.starTime = duration;
    if (this.isPlayer) {
      sounds.playBoost(); // Sonido especial para el inicio de estrella
    }
  }

  hitByLightning() {
    // La estrella te hace completamente inmune al rayo!
    if (this.starTime > 0) return;

    this.isShrunk = true;
    this.shrunkTimer = 6.0; // 6 segundos de encojimiento
    this.mesh.scale.set(0.42, 0.42, 0.42);

    // Perder objeto equipado si lo tuviera
    this.equippedItem = null;
    if (this.isPlayer) {
      const hudIcon = document.getElementById('item-icon');
      if (hudIcon) hudIcon.className = 'empty';
    }

    // Efecto de giro y freno instantáneo
    this.hitByObstacle();
  }

  hitByObstacle() {
    if (this.respawnTimer > 0 || this.spinoutTimer > 0) return;
    this.spinoutTimer = 1.2;
    this.speed = 0;
    this.isDrifting = false;
    this.driftCharge = 0;
    
    if (this.isPlayer) {
      sounds.playSpinout();
      sounds.playDriftScreech(false);
    }
  }

  updateSpinout(deltaTime) {
    this.spinoutTimer -= deltaTime;
    this.speed = 0;
    
    this.mesh.rotation.y = Math.sin(this.spinoutTimer * 10) * Math.PI * 2;
    if (this.spinoutTimer <= 0) {
      this.mesh.rotation.y = 0;
    }
  }

  triggerRespawn() {
    if (this.respawnTimer > 0) return;
    this.respawnTimer = 2.0;
    this.speed = 0;
    this.isDrifting = false;
    this.driftCharge = 0;
    if (this.isPlayer) sounds.playDriftScreech(false);
  }

  updateRespawn(deltaTime) {
    this.respawnTimer -= deltaTime;
    this.speed = 0;

    if (this.respawnTimer <= 0.8 && this.respawnTimer + deltaTime > 0.8) {
      const safePoint = this.track.curve.getPointAt(this.lastSafeSegment / this.track.segments);
      const tangent = this.track.curve.getTangentAt(this.lastSafeSegment / this.track.segments).normalize();

      this.position.copy(safePoint).add(new THREE.Vector3(0, 5, 0));
      this.yaw = Math.atan2(-tangent.x, -tangent.z);
    }
  }

  spawnDriftSparks() {
    const sparkColor = this.driftCharge > 1.5 ? 0xffaa00 : 0x00d2ff; // Amarillo o Celeste bubble
    const particleGeom = new THREE.BoxGeometry(0.2, 0.2, 0.2);
    const particleMat = new THREE.MeshBasicMaterial({ color: sparkColor });

    const rearLeftWheel = this.wheels[2].mesh;
    const rearRightWheel = this.wheels[3].mesh;

    const spawnSpark = (wheelMesh) => {
      const spark = new THREE.Mesh(particleGeom, particleMat);
      const worldPos = new THREE.Vector3();
      wheelMesh.getWorldPosition(worldPos);
      
      worldPos.add(new THREE.Vector3(
        (Math.random() - 0.5) * 0.4,
        -0.3,
        (Math.random() - 0.5) * 0.4
      ));

      spark.position.copy(worldPos);
      
      const vX = (Math.random() - 0.5) * 8 - Math.sin(this.yaw) * 4;
      const vY = Math.random() * 6 + 2;
      const vZ = (Math.random() - 0.5) * 8 - Math.cos(this.yaw) * 4;

      this.scene.add(spark);
      this.particles.push({
        mesh: spark,
        velocity: new THREE.Vector3(vX, vY, vZ),
        life: 0.35,
        maxLife: 0.35
      });
    };

    spawnSpark(rearLeftWheel);
    spawnSpark(rearRightWheel);
  }

  createExhaustSmoke(deltaTime) {
    if (this.speed < 1 && Math.random() > 0.1) return;

    const smokeGeom = new THREE.SphereGeometry(0.18, 5, 5);
    const smokeMat = new THREE.MeshBasicMaterial({
      color: this.boostTime > 0 ? 0xffaa00 : 0x99bb99, // Humo de color con boost
      transparent: true,
      opacity: 0.35
    });

    this.exhaustPipes.forEach((pipe) => {
      const worldPos = new THREE.Vector3();
      pipe.getWorldPosition(worldPos);

      const smoke = new THREE.Mesh(smokeGeom, smokeMat);
      smoke.position.copy(worldPos);

      const moveAngle = this.yaw + this.driftAngle;
      const vX = Math.sin(moveAngle) * 5 + (Math.random() - 0.5) * 2;
      const vY = Math.random() * 2 + 1;
      const vZ = Math.cos(moveAngle) * 5 + (Math.random() - 0.5) * 2;

      this.scene.add(smoke);
      this.particles.push({
        mesh: smoke,
        velocity: new THREE.Vector3(vX, vY, vZ),
        life: 0.5,
        maxLife: 0.5
      });
    });
  }

  updateParticles(deltaTime) {
    this.createExhaustSmoke(deltaTime);

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= deltaTime;
      
      p.mesh.position.addScaledVector(p.velocity, deltaTime);
      p.velocity.y -= 9.8 * deltaTime;

      const scale = p.life / p.maxLife;
      p.mesh.scale.set(scale, scale, scale);

      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
        this.particles.splice(i, 1);
      }
    }
  }

  animateWheels(deltaTime) {
    const wheelRotSpeed = (this.speed / 0.5) * deltaTime;

    this.wheels.forEach((w) => {
      w.mesh.rotation.x -= wheelRotSpeed;

      if (w.isFront) {
        let steeringAngle = 0;
        if (this.keys.left) steeringAngle = 0.35;
        if (this.keys.right) steeringAngle = -0.35;
        
        w.mesh.rotation.y += (steeringAngle - w.mesh.rotation.y) * 0.15;
      }
    });
  }

  destroy() {
    this.scene.remove(this.visualContainer);
    this.particles.forEach((p) => this.scene.remove(p.mesh));
  }
}
