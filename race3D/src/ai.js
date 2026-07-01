import * as THREE from 'three';
import { Kart } from './kart.js';

export class AIKart extends Kart {
  constructor(scene, track, color = '#ffb700', index = 1) {
    super(scene, track, color, false);

    this.aiIndex = index;
    
    // --- PARÁMETROS PERSONALIZADOS DE IA ---
    this.maxSpeed = 43 + Math.random() * 5;
    this.acceleration = 23 + Math.random() * 4;
    this.laneOffset = (index - 2.0) * 4.5; // -4.5, 0, 4.5 metros de offset
    this.lookAheadDistance = 0.035;
    
    this.itemUseCooldown = 1.5 + Math.random() * 3.5;
    this.skillLevel = 0.8 + Math.random() * 0.2;

    // --- SISTEMA ANTIBLOQUEO / ANTICHOQUES ---
    this.stuckTimer = 0;      // Tiempo bloqueado contra muro
    this.unstuckTimer = 0;    // Tiempo restante de la maniobra de evasión
    this.unstuckDir = 1;      // Dirección del giro de retroceso (-1 o 1)
  }

  handleInput(deltaTime) {
    const roadInfo = this.track.getRoadHeightAndNormal(this.position);
    if (this.raceFinished) {
      this.keys.forward = false;
      this.keys.left = false;
      this.keys.right = false;
      super.handleInput(deltaTime);
      return;
    }

    if (this.respawnTimer > 0 || this.spinoutTimer > 0) {
      this.keys.forward = false;
      this.keys.left = false;
      this.keys.right = false;
      this.stuckTimer = 0;
      this.unstuckTimer = 0;
      super.handleInput(deltaTime);
      return;
    }

    // --- MANIOBRA ANTIBLOQUEO (Si la IA se queda atascada) ---
    // Si la velocidad es casi nula mientras acelera hacia adelante
    if (this.speed < 2.0 && this.keys.forward) {
      this.stuckTimer += deltaTime;
    } else {
      this.stuckTimer = 0;
    }

    // Activar retroceso o recolocación si está atascado más de 1.5s
    if (this.stuckTimer > 1.5) {
      if (!roadInfo.isOnRoad) {
        // Si está fuera de pista, recolocar (respawn) en la carretera
        this.triggerRespawn();
      } else {
        // Si está en pista, intentar la maniobra normal de marcha atrás
        this.unstuckTimer = 1.2; // Retroceder durante 1.2 segundos
        this.unstuckDir = Math.random() > 0.5 ? 1 : -1;
      }
      this.stuckTimer = 0;
    }

    // Lógica durante el retroceso
    if (this.unstuckTimer > 0) {
      this.unstuckTimer -= deltaTime;
      
      // Marcha atrás y girar hacia afuera
      this.keys.forward = false;
      this.keys.backward = true;
      
      if (this.unstuckDir > 0) {
        this.keys.left = true;
        this.keys.right = false;
      } else {
        this.keys.left = false;
        this.keys.right = true;
      }
      super.handleInput(deltaTime);
      return; // Interrumpir e ignorar el seguimiento normal de ruta
    }

    // --- MOVIMIENTO NORMAL (Seguimiento de Spline) ---
    // (roadInfo ya fue inicializado al principio del método)
    
    let targetProgress = (roadInfo.progress + this.lookAheadDistance) % 1.0;
    if (targetProgress < 0) targetProgress += 1.0;

    const targetPoint = this.track.curve.getPointAt(targetProgress);
    const targetTangent = this.track.curve.getTangentAt(targetProgress).normalize();
    const targetBinormal = new THREE.Vector3().crossVectors(targetTangent, new THREE.Vector3(0, 1, 0)).normalize();

    const finalTarget = new THREE.Vector3()
      .copy(targetPoint)
      .addScaledVector(targetBinormal, this.laneOffset);

    const toTarget = new THREE.Vector3().subVectors(finalTarget, this.position);
    const targetYaw = Math.atan2(-toTarget.x, -toTarget.z);
    
    let angleDiff = targetYaw - this.yaw;
    angleDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));

    // Giro simulado
    const tolerance = 0.08;
    if (angleDiff > tolerance) {
      this.keys.left = true;
      this.keys.right = false;
    } else if (angleDiff < -tolerance) {
      this.keys.right = true;
      this.keys.left = false;
    } else {
      this.keys.left = false;
      this.keys.right = false;
    }

    // Aceleración / Curvas cerradas
    const isSharpCurve = Math.abs(angleDiff) > 0.45;
    if (isSharpCurve && this.speed > 18) {
      this.keys.forward = false;
      this.keys.backward = true;
    } else {
      this.keys.forward = true;
      this.keys.backward = false;
    }

    // Derrape estético ocasional para IA
    if (isSharpCurve && this.speed > 22 && Math.random() < 0.03 && !this.isDrifting) {
      this.keys.drift = true;
    }
    
    if (this.isDrifting && (Math.abs(angleDiff) < 0.15 || this.speed < 12)) {
      this.keys.drift = false;
    }

    // Uso de items
    if (this.equippedItem) {
      this.itemUseCooldown -= deltaTime;
      if (this.itemUseCooldown <= 0) {
        if (this.onUseItemCallback) {
          this.useItem(this.onUseItemCallback);
        }
        this.itemUseCooldown = 3.0 + Math.random() * 4.0;
      }
    }
    
    super.handleInput(deltaTime);
  }

  setUseItemCallback(callback) {
    this.onUseItemCallback = callback;
  }
}
