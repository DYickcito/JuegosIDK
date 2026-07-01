import * as THREE from 'three';

// --- CLASE: PLÁTANO (TRAMPA EN EL SUELO) ---
class Banana {
  constructor(scene, position) {
    this.scene = scene;
    this.position = new THREE.Vector3().copy(position);
    this.radius = 1.5;
    this.shouldDestroy = false;

    // Crear malla visual (plátano estilizado de neón amarillo)
    this.mesh = new THREE.Group();

    // Cuerpo curvado del plátano (tres pequeñas cajas amarillas anguladas)
    const peelMat = new THREE.MeshStandardMaterial({
      color: 0xffff00,
      roughness: 0.1,
      metalness: 0.1,
      emissive: 0x555500
    });

    const boxGeom = new THREE.BoxGeometry(0.4, 0.2, 1.4);
    
    const peel1 = new THREE.Mesh(boxGeom, peelMat);
    peel1.rotation.y = 0.2;
    peel1.position.x = -0.3;

    const peel2 = new THREE.Mesh(boxGeom, peelMat);
    peel2.rotation.y = -0.2;
    peel2.position.x = 0.3;

    const stemGeom = new THREE.CylinderGeometry(0.1, 0.1, 0.4, 5);
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x33aa00 });
    const stem = new THREE.Mesh(stemGeom, stemMat);
    stem.position.set(0, 0.1, -0.7);
    stem.rotation.x = Math.PI / 2;

    this.mesh.add(peel1, peel2, stem);
    this.mesh.position.copy(this.position);
    // Levantar un poco para que no quede enterrado
    this.mesh.position.y += 0.2;
    
    // Rotación aleatoria en el suelo
    this.mesh.rotation.y = Math.random() * Math.PI * 2;

    this.scene.add(this.mesh);
  }

  update(deltaTime, karts) {
    // Rotar lentamente
    this.mesh.rotation.y += 0.5 * deltaTime;

    // Comprobar colisión con todos los Karts (jugador e IA)
    for (let i = 0; i < karts.length; i++) {
      const kart = karts[i];
      if (kart.respawnTimer > 0 || kart.spinoutTimer > 0) continue;

      const dist = this.position.distanceTo(kart.position);
      if (dist < (this.radius + kart.radius)) {
        // Impacto!
        kart.hitByObstacle();
        this.shouldDestroy = true;
        break;
      }
    }
  }

  destroy() {
    this.scene.remove(this.mesh);
    this.mesh.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    });
  }
}

// --- CLASE: CAPARAZÓN (PROYECTIL SEGUIDOR DE PISTA) ---
class Shell {
  constructor(scene, track, startProgress, laneOffset) {
    this.scene = scene;
    this.track = track;
    this.progress = startProgress; // Progreso en la spline del circuito (0.0 a 1.0)
    this.laneOffset = laneOffset;  // Desplazamiento lateral de carril
    
    this.speed = 70; // Velocidad de viaje del proyectil (muy rápido)
    this.radius = 1.8;
    this.lifeTime = 6.0; // 6 segundos de vida antes de desvanecerse
    this.shouldDestroy = false;

    // Crear malla visual (Caparazón de neón verde con forma de domo aplastado)
    this.mesh = new THREE.Group();

    const shellMat = new THREE.MeshStandardMaterial({
      color: 0x00ff66,
      roughness: 0.2,
      metalness: 0.7,
      emissive: 0x005522
    });

    const domeGeom = new THREE.SphereGeometry(1.0, 12, 12);
    const dome = new THREE.Mesh(domeGeom, shellMat);
    dome.scale.set(1.1, 0.6, 1.3); // Forma ovalada y chata
    dome.castShadow = true;
    this.mesh.add(dome);

    // Borde inferior (Cinturón negro)
    const rimGeom = new THREE.CylinderGeometry(1.2, 1.2, 0.2, 12);
    const rimMat = new THREE.MeshStandardMaterial({ color: 0x0f0f0f });
    const rim = new THREE.Mesh(rimGeom, rimMat);
    rim.position.y = -0.25;
    this.mesh.add(rim);

    // Luz parpadeante
    const lightGeom = new THREE.SphereGeometry(0.2, 5, 5);
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    this.indicatorLight = new THREE.Mesh(lightGeom, lightMat);
    this.indicatorLight.position.set(0, 0.4, -0.6);
    this.mesh.add(this.indicatorLight);

    // Calcular posición inicial
    this.updatePosition();
    this.scene.add(this.mesh);
  }

  updatePosition() {
    // Obtener información de la pista según el progreso de la spline
    const p = this.track.curve.getPointAt(this.progress);
    const tangent = this.track.curve.getTangentAt(this.progress).normalize();
    const binormal = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();

    // Situar el caparazón en el carril y a ras del suelo
    this.position = new THREE.Vector3()
      .copy(p)
      .addScaledVector(binormal, this.laneOffset)
      .add(new THREE.Vector3(0, 0.5, 0)); // Levantar ligeramente

    this.mesh.position.copy(this.position);

    // Orientar en la dirección del movimiento (tangente de la pista)
    const lookTarget = new THREE.Vector3().copy(this.position).add(tangent);
    this.mesh.lookAt(lookTarget);
  }

  update(deltaTime, karts) {
    this.lifeTime -= deltaTime;
    if (this.lifeTime <= 0) {
      this.shouldDestroy = true;
      return;
    }

    // Luz parpadeante de advertencia
    this.indicatorLight.visible = (Math.floor(Date.now() / 100) % 2 === 0);

    // Avanzar a lo largo del spline de la pista
    // Para calcular el delta de progreso: deltaProgress = (velocidad * dt) / longitud de la curva
    const curveLength = this.track.curve.getLength();
    const deltaProgress = (this.speed * deltaTime) / curveLength;
    
    this.progress = (this.progress + deltaProgress) % 1.0;

    // Actualizar posición 3D
    this.updatePosition();

    // Comprobar colisión con todos los Karts (jugador e IA)
    for (let i = 0; i < karts.length; i++) {
      const kart = karts[i];
      if (kart.respawnTimer > 0 || kart.spinoutTimer > 0) continue;

      const dist = this.position.distanceTo(kart.position);
      if (dist < (this.radius + kart.radius)) {
        // Choque frontal contra el Kart!
        kart.hitByObstacle();
        this.shouldDestroy = true;
        break;
      }
    }
  }

  destroy() {
    this.scene.remove(this.mesh);
    this.mesh.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    });
  }
}

// --- GESTOR GLOBAL DE ITEMS ---
export class ItemManager {
  constructor(scene, track) {
    this.scene = scene;
    this.track = track;
    
    this.bananas = [];
    this.shells = [];
  }

  // Disparar o soltar objeto
  spawnItem(type, owner, allKarts) {
    const roadInfo = this.track.getRoadHeightAndNormal(owner.position);
    
    if (type === 'banana') {
      // Soltar plátano justo detrás del Kart
      const backwardVec = new THREE.Vector3(-Math.sin(owner.yaw), 0, -Math.cos(owner.yaw)).normalize().multiplyScalar(-3.5);
      const spawnPos = new THREE.Vector3().copy(owner.position).add(backwardVec);
      
      const banana = new Banana(this.scene, spawnPos);
      this.bananas.push(banana);
    } 
    else if (type === 'shell') {
      // Disparar caparazón al frente del Kart, alineado con el carril de la pista
      // Calcular laneOffset del dueño en base al binormal
      const splinePos = this.track.curve.getPointAt(roadInfo.progress);
      const toOwnerVec = new THREE.Vector3().subVectors(owner.position, splinePos).projectOnVector(roadInfo.binormal);
      const laneOffset = toOwnerVec.dot(roadInfo.binormal);

      // Lanzar un poco por delante del progreso actual del dueño
      const spawnProgress = (roadInfo.progress + 0.015) % 1.0;

      const shell = new Shell(this.scene, this.track, spawnProgress, laneOffset);
      this.shells.push(shell);
    }
    else if (type === 'lightning') {
      // El rayo afecta a todos los karts excepto al dueño
      if (allKarts) {
        allKarts.forEach((kart) => {
          if (kart !== owner) {
            kart.hitByLightning();
          }
        });
      }
    }
  }

  // Actualizar físicas y colisiones de todos los proyectiles/trampas
  update(deltaTime, karts) {
    // 1. Procesar plátanos
    for (let i = this.bananas.length - 1; i >= 0; i--) {
      const b = this.bananas[i];
      b.update(deltaTime, karts);
      if (b.shouldDestroy) {
        b.destroy();
        this.bananas.splice(i, 1);
      }
    }

    // 2. Procesar caparazones
    for (let i = this.shells.length - 1; i >= 0; i--) {
      const s = this.shells[i];
      s.update(deltaTime, karts);
      if (s.shouldDestroy) {
        s.destroy();
        this.shells.splice(i, 1);
      }
    }
  }

  // Limpiar todos los objetos al reiniciar la carrera
  clearAll() {
    this.bananas.forEach(b => b.destroy());
    this.shells.forEach(s => s.destroy());
    this.bananas = [];
    this.shells = [];
  }
}
