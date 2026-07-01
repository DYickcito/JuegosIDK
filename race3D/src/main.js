import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Track } from './track.js';
import { Kart } from './kart.js';
import { AIKart } from './ai.js';
import { ItemManager } from './items.js';
import { UIManager } from './ui.js';
import { sounds } from './sound.js';

// --- ESTADOS DEL JUEGO ---
const STATES = {
  MENU: 'menu',
  COUNTDOWN: 'countdown',
  RACING: 'racing',
  FINISHED: 'finished',
  PAUSED: 'paused'
};

class Game {
  constructor() {
    this.state = STATES.MENU; // Mostrar el menú al inicio
    
    // Tiempos de carrera
    this.totalRaceTime = 0;
    this.lastLapTime = 0;
    this.bestLapTime = Infinity;
    this.lapTimes = [];
    
    this.countdownVal = 3;
    this.countdownTimer = 0;
    this.cameraZoomDistance = 9.5; // Distancia de cámara de seguimiento ajustable
    this.totalLaps = 3; // Límite de vueltas de carrera por defecto
    
    // Configuración inicial de Three.js
    this.initEngine();
    
    // Inicializar pista y gestores
    this.track = new Track(this.scene);
    this.itemManager = new ItemManager(this.scene, this.track);
    this.ui = new UIManager(this.track);
    
    // Configurar oponentes e iluminación
    this.setupLights();
    this.setupKarts('#ff007f'); // Color rosa por defecto al inicio

    // Inicializar controles de cámara orbital libre (OrbitControls)
    this.initOrbitControls();

    // Configuración de vista interactiva por arrastre de ratón
    this.initMouseLook();

    // Iniciar sonido del motor con la primera tecla o click en pantalla (política del navegador)
    const startAudioOnInteraction = () => {
      sounds.init();
      sounds.startEngine();
      window.removeEventListener('keydown', startAudioOnInteraction);
      window.removeEventListener('mousedown', startAudioOnInteraction);
      window.removeEventListener('touchstart', startAudioOnInteraction);
    };
    window.addEventListener('keydown', startAudioOnInteraction);
    window.addEventListener('mousedown', startAudioOnInteraction);
    window.addEventListener('touchstart', startAudioOnInteraction);

    // Escuchar eventos de cambio de color en el HUD/menú si se abre
    this.bindUIEvents();
    
    // Bucle principal
    this.clock = new THREE.Clock();
    this.animate();
  }

  // --- CONFIGURACIÓN DEL RENDERIZADOR ---
  initEngine() {
    this.container = document.getElementById('game-canvas-container');
    
    // Escena con niebla suave y clara estilo día de parque soleado
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xa0d8ef); // Celeste pastel cielo
    this.scene.fog = new THREE.FogExp2(0xa0d8ef, 0.002); // Niebla suave que funde las colinas

    // Cámara
    this.camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.5, 1200);
    
    // Renderizador WebGL
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    this.container.appendChild(this.renderer.domElement);

    // Redimensionado de ventana
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  setupLights() {
    // Luz ambiental cálida (amarillo-verde suave)
    const ambientLight = new THREE.AmbientLight(0xe5ebd3, 1.0);
    this.scene.add(ambientLight);

    // Luz del sol (Direccional cálida y potente con sombras)
    this.dirLight = new THREE.DirectionalLight(0xfffaeb, 1.6);
    this.dirLight.position.set(120, 180, 60);
    this.dirLight.castShadow = true;
    
    // Ajustar sombras
    this.dirLight.shadow.mapSize.width = 2048;
    this.dirLight.shadow.mapSize.height = 2048;
    this.dirLight.shadow.camera.near = 0.5;
    this.dirLight.shadow.camera.far = 500;
    
    const d = 120;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.dirLight.shadow.bias = -0.0004;

    this.scene.add(this.dirLight);

    // Luz de hemisferio (Cielo celeste a suelo verdoso para realismo del parque)
    const hemisphereLight = new THREE.HemisphereLight(0xbce2ff, 0x9de093, 0.5);
    this.scene.add(hemisphereLight);
  }

  // Inicializar OrbitControls para cámara libre
  initOrbitControls() {
    this.orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbitControls.enabled = false;
    this.orbitControls.enableDamping = true;
    this.orbitControls.dampingFactor = 0.05;
    this.orbitControls.maxDistance = 300;
    this.orbitControls.minDistance = 3;
    
    this.freeCameraActive = false;

    // Tecla C para alternar cámara libre
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyC') {
        this.freeCameraActive = !this.freeCameraActive;
        this.orbitControls.enabled = this.freeCameraActive;
        
        if (this.freeCameraActive) {
          // Enfocar en la posición actual del jugador
          this.orbitControls.target.copy(this.player.position);
          // Ocultar indicador del drift en cámara libre
          this.ui.dom.driftIndicator.classList.remove('active');
        }
      }
    });
  }

  // Cámara interactiva por arrastre de ratón
  initMouseLook() {
    this.mouseLook = {
      active: false,
      startX: 0,
      startY: 0,
      yaw: 0,       // Desfase horizontal acumulado
      pitch: 0.35,  // Altura/Inclinación (radianes)
      minPitch: 0.05,
      maxPitch: 1.1
    };

    const canvas = this.renderer.domElement;

    canvas.addEventListener('mousedown', (e) => {
      if (this.freeCameraActive) return; // Ignorar si OrbitControls está activo
      this.mouseLook.active = true;
      this.mouseLook.startX = e.clientX;
      this.mouseLook.startY = e.clientY;
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.mouseLook.active || this.freeCameraActive) return;
      const dx = e.clientX - this.mouseLook.startX;
      const dy = e.clientY - this.mouseLook.startY;
      
      this.mouseLook.startX = e.clientX;
      this.mouseLook.startY = e.clientY;

      // Sensibilidad de órbita manual
      this.mouseLook.yaw -= dx * 0.006;
      this.mouseLook.pitch = Math.max(
        this.mouseLook.minPitch,
        Math.min(this.mouseLook.maxPitch, this.mouseLook.pitch + dy * 0.005)
      );
    });

    window.addEventListener('mouseup', () => {
      this.mouseLook.active = false;
    });
  }

  // --- CONFIGURACIÓN DE LOS KARTS ---
  setupKarts(playerColor) {
    if (this.player) this.player.destroy();
    if (this.aiKarts) {
      this.aiKarts.forEach(ai => ai.destroy());
    }

    const startPoint = this.track.curve.getPointAt(0);
    const tangent = this.track.curve.getTangentAt(0).normalize();
    const binormal = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();
    const startYaw = Math.atan2(-tangent.x, -tangent.z);

    // 1. Jugador Principal
    this.player = new Kart(this.scene, this.track, playerColor, true);
    this.player.position.copy(startPoint).addScaledVector(binormal, -6).add(new THREE.Vector3(0, 1, 0));
    this.player.yaw = startYaw;
    this.player.lastSafeSegment = 0;
    this.player.prevSegment = undefined;
    this.player.lapsCompleted = 0;
    this.player.currentLap = 1;
    this.player.raceFinished = false;
    this.player.hasVisitedMidpoint = false;

    // 2. Corredores de IA (3 Competidores)
    this.aiKarts = [];
    const aiConfigs = [
      { color: '#00f0ff', name: 'AI_Cian', laneOffset: 6, startOffsetDist: -8 },
      { color: '#ffb700', name: 'AI_Amarillo', laneOffset: -3, startOffsetDist: -16 },
      { color: '#39ff14', name: 'AI_Verde', laneOffset: 3, startOffsetDist: -24 }
    ];

    aiConfigs.forEach((config, idx) => {
      const startT = (1.0 - (Math.abs(config.startOffsetDist) / this.track.curve.getLength())) % 1.0;
      const spawnP = this.track.curve.getPointAt(startT);
      const spawnT = this.track.curve.getTangentAt(startT).normalize();
      const spawnBin = new THREE.Vector3().crossVectors(spawnT, new THREE.Vector3(0, 1, 0)).normalize();

      const ai = new AIKart(this.scene, this.track, config.color, idx + 1);
      ai.position.copy(spawnP).addScaledVector(spawnBin, config.laneOffset).add(new THREE.Vector3(0, 1, 0));
      ai.yaw = Math.atan2(-spawnT.x, -spawnT.z);
      ai.lastSafeSegment = 0;
      ai.prevSegment = undefined;
      ai.lapsCompleted = -1; // Empiezan detrás de la línea de meta
      ai.currentLap = 1;
      ai.raceFinished = false;
      ai.hasVisitedMidpoint = false;
      
      ai.setUseItemCallback((itemType, owner) => {
        this.itemManager.spawnItem(itemType, owner, [this.player, ...this.aiKarts]);
      });

      this.aiKarts.push(ai);
    });

    this.totalRaceTime = 0;
    this.lastLapTime = 0;
    this.bestLapTime = Infinity;
    this.lapTimes = [];
  }

  // --- ASOCIACIÓN DE EVENTOS DE INTERFAZ ---
  bindUIEvents() {
    const kartButtons = document.querySelectorAll('.kart-btn');
    kartButtons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        if (e && e.currentTarget) e.currentTarget.blur();
        kartButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const color = btn.getAttribute('data-color');
        this.setupKarts(color);
      });
    });

    // Selección de cantidad de vueltas
    const lapButtons = document.querySelectorAll('.lap-btn');
    lapButtons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        if (e && e.currentTarget) e.currentTarget.blur();
        lapButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.totalLaps = parseInt(btn.getAttribute('data-laps')) || 3;
      });
    });

    this.ui.dom.startBtn.addEventListener('click', (e) => {
      if (e && e.currentTarget) e.currentTarget.blur();
      sounds.init();
      this.startCountdown();
    });

    this.ui.dom.restartBtn.addEventListener('click', (e) => {
      if (e && e.currentTarget) e.currentTarget.blur();
      this.ui.showStartScreen();
      this.setupKarts(this.player.color);
      this.itemManager.clearAll();
      this.state = STATES.MENU;
    });

    // Botones de la Pantalla de Pausa
    this.ui.dom.resumeBtn.addEventListener('click', (e) => {
      if (e && e.currentTarget) e.currentTarget.blur();
      this.togglePause();
    });

    this.ui.dom.exitBtn.addEventListener('click', (e) => {
      if (e && e.currentTarget) e.currentTarget.blur();
      this.togglePause(); // Quitar la pausa
      this.ui.showStartScreen();
      this.setupKarts(this.player.color);
      this.itemManager.clearAll();
      this.state = STATES.MENU;
    });

    // Escuchar teclas Esc y P para pausar la carrera
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (this.state === STATES.RACING || this.state === STATES.PAUSED) {
          this.togglePause();
        }
      }
    });

    // Control de zoom con la rueda del ratón para la cámara de persecución
    window.addEventListener('wheel', (e) => {
      if (this.freeCameraActive) return;
      const zoomStep = 0.65;
      if (e.deltaY > 0) {
        // Scroll abajo -> Zoom Out
        this.cameraZoomDistance = Math.min(24.0, this.cameraZoomDistance + zoomStep);
      } else {
        // Scroll arriba -> Zoom In
        this.cameraZoomDistance = Math.max(4.5, this.cameraZoomDistance - zoomStep);
      }
    });

    // Cuenta atrás flotante
    this.countdownEl = document.createElement('div');
    this.countdownEl.id = 'countdown-timer';
    this.countdownEl.style.position = 'absolute';
    this.countdownEl.style.top = '50%';
    this.countdownEl.style.left = '50%';
    this.countdownEl.style.transform = 'translate(-50%, -50%) scale(0.5)';
    this.countdownEl.style.fontFamily = "'Outfit', sans-serif";
    this.countdownEl.style.fontWeight = '900';
    this.countdownEl.style.fontSize = '8rem';
    this.countdownEl.style.color = '#fff';
    this.countdownEl.style.textShadow = '0 0 20px #ffaa00, 0 0 40px #ff3300';
    this.countdownEl.style.zIndex = '100';
    this.countdownEl.style.pointerEvents = 'none';
    this.countdownEl.style.opacity = '0';
    this.countdownEl.style.transition = 'all 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
    document.body.appendChild(this.countdownEl);
  }

  // --- SISTEMA DE CUENTA ATRÁS ---
  startCountdown() {
    this.state = STATES.COUNTDOWN;
    this.ui.showHUD();
    
    this.countdownVal = 3;
    this.countdownTimer = 0;
    this.updateCountdownDisplay();
    sounds.playBeepLow();

    // Congelar todos los karts
    this.player.frozen = true;
    this.player.speed = 0;
    this.aiKarts.forEach((ai) => {
      ai.frozen = true;
      ai.speed = 0;
      ai.stuckTimer = 0;
      ai.unstuckTimer = 0;
    });
  }

  updateCountdown(deltaTime) {
    this.countdownTimer += deltaTime;
    if (this.countdownTimer >= 1.0) {
      this.countdownTimer = 0;
      this.countdownVal--;

      if (this.countdownVal > 0) {
        sounds.playBeepLow();
        this.updateCountdownDisplay();
      } else if (this.countdownVal === 0) {
        sounds.playBeepHigh();
        this.updateCountdownDisplay("¡GO!");
        this.state = STATES.RACING;
        sounds.startEngine();

        // Descongelar todos los karts
        this.player.frozen = false;
        this.aiKarts.forEach((ai) => {
          ai.frozen = false;
        });
        
        // Ocultar texto "¡GO!" automáticamente tras 1.2 segundos
        setTimeout(() => {
          this.countdownEl.style.opacity = '0';
          this.countdownEl.style.transform = 'translate(-50%, -50%) scale(0.5)';
        }, 1200);
      }
    }
  }

  updateCountdownDisplay(text) {
    const val = text || this.countdownVal;
    this.countdownEl.textContent = val;
    this.countdownEl.style.opacity = '1';
    this.countdownEl.style.transform = 'translate(-50%, -50%) scale(1)';
    
    setTimeout(() => {
      if (this.countdownVal !== val && val !== "¡GO!") return;
      this.countdownEl.style.opacity = '0.8';
      this.countdownEl.style.transform = 'translate(-50%, -50%) scale(0.9)';
    }, 400);
  }

  // --- CÁMARA DE SEGUIMIENTO E INTERACTIVA ---
  updateCamera(deltaTime) {
    if (this.freeCameraActive) {
      // Si la cámara libre con OrbitControls está activa, actualizarla e ignorar la persecución
      this.orbitControls.update();
      return;
    }

    const target = this.player;

    if (this.state === STATES.MENU) {
      // Cámara en menú orbita lenta
      const time = Date.now() * 0.0008;
      const radius = 9;
      this.camera.position.set(
        target.position.x + Math.sin(time) * radius,
        target.position.y + 3.0 + Math.sin(time * 0.5) * 1.5,
        target.position.z + Math.cos(time) * radius
      );
      this.camera.lookAt(new THREE.Vector3().copy(target.position).add(new THREE.Vector3(0, 0.8, 0)));
      return;
    }

    // --- CÁMARA PERSECUCIÓN CON ARRASTRE DE MOUSE (RETORNO DE RESORTE) ---
    const backDist = this.cameraZoomDistance;

    // Si el usuario no arrastra el ratón, devolver gradualmente el desfase yaw/pitch a sus valores por defecto
    if (!this.mouseLook.active) {
      this.mouseLook.yaw += (0 - this.mouseLook.yaw) * 4 * deltaTime;
      this.mouseLook.pitch += (0.35 - this.mouseLook.pitch) * 4 * deltaTime;
    }

    // Ángulo absoluto de la cámara (dirección del kart + desfase del ratón)
    const totalYaw = target.yaw + this.mouseLook.yaw;
    const totalPitch = this.mouseLook.pitch;

    // Alejamiento extra si el turbo está activo
    const activeBackDist = this.player.boostTime > 0 ? backDist + 1.8 : backDist;

    // Invertir el signo para posicionar la cámara DETRÁS del kart (vista de persecución estándar)
    const xOffset = Math.sin(totalYaw) * Math.cos(totalPitch) * activeBackDist;
    const zOffset = Math.cos(totalYaw) * Math.cos(totalPitch) * activeBackDist;
    const yOffset = Math.sin(totalPitch) * activeBackDist;

    const desiredCamPos = new THREE.Vector3()
      .copy(target.position)
      .add(new THREE.Vector3(xOffset, yOffset, zOffset));

    // Suavizado suave (Lerp)
    this.camera.position.lerp(desiredCamPos, 8 * deltaTime);

    // FOV dinámico con el turbo
    const targetFOV = this.player.boostTime > 0 ? 82 : 65;
    this.camera.fov += (targetFOV - this.camera.fov) * 8 * deltaTime;
    this.camera.updateProjectionMatrix();

    // Mirar al centro de gravedad del Kart
    const lookTarget = new THREE.Vector3().copy(target.position).add(new THREE.Vector3(0, 0.6, 0));
    this.camera.lookAt(lookTarget);

    // Sombras alrededor del jugador
    this.dirLight.position.set(
      target.position.x + 80,
      target.position.y + 120,
      target.position.z + 40
    );
    this.dirLight.target = this.player.visualContainer;
  }

  // --- DETECCIÓN DE VUELTAS (CORREGIDA Y DESACOPLADA) ---
  checkLaps(kart) {
    if (kart.raceFinished) return;
    const roadInfo = this.track.getRoadHeightAndNormal(kart.position);
    const currentSegment = roadInfo.segmentIndex;

    // Inicializar segmento de comparación
    if (kart.prevSegment === undefined) {
      kart.prevSegment = currentSegment;
      return;
    }

    // Registrar paso por la mitad del circuito para evitar exploits de marcha atrás
    if (currentSegment > 120 && currentSegment < 180) {
      kart.hasVisitedMidpoint = true;
    }

    // Detección de meta: pasar de los segmentos finales (>275) a los iniciales (<25)
    if (kart.prevSegment > 275 && currentSegment < 25) {
      if (kart.lapsCompleted === undefined) {
        kart.lapsCompleted = 0;
      }
      
      // El primer cruce de la IA (para empezar vuelta 1) no requiere midpoint,
      // pero los cruces normales de vueltas siguientes sí.
      const isInitialAICross = (kart.lapsCompleted === -1);
      
      if (isInitialAICross || kart.hasVisitedMidpoint) {
        kart.lapsCompleted++;
        kart.hasVisitedMidpoint = false; // Resetear para la siguiente vuelta
        
        // La vuelta visible es lapsCompleted + 1
        kart.currentLap = Math.max(1, kart.lapsCompleted + 1);

        if (kart.isPlayer) {
          const currentLapTime = this.totalRaceTime - this.lastLapTime;
          this.lastLapTime = this.totalRaceTime;
          this.lapTimes.push(currentLapTime);

          if (currentLapTime < this.bestLapTime) {
            this.bestLapTime = currentLapTime;
          }

          sounds.playItemPickup();
        }

        if (kart.currentLap > this.totalLaps) {
          kart.raceFinished = true;
          kart.currentLap = this.totalLaps;
          
          if (kart.isPlayer) {
            this.finishRace();
          } else {
            // Comprobar si TODOS los karts han finalizado la carrera
            const allKarts = [this.player, ...this.aiKarts];
            if (allKarts.every(k => k.raceFinished)) {
              this.finishRace();
            }
          }
        }
      }
    }
    
    kart.prevSegment = currentSegment;
  }

  finishRace() {
    this.state = STATES.FINISHED;
    sounds.playVictoryJingle();
    
    const allKarts = [this.player, ...this.aiKarts];
    allKarts.sort((a, b) => b.totalProgress - a.totalProgress);
    const finalRank = allKarts.indexOf(this.player) + 1;

    setTimeout(() => {
      this.ui.showEndScreen(finalRank, this.totalRaceTime, this.bestLapTime);
    }, 1500);
  }

  // --- COLISIÓN ENTRE VEHÍCULOS (KART VS KART) ---
  handleKartCollisions() {
    const allKarts = [this.player, ...this.aiKarts];
    
    for (let i = 0; i < allKarts.length - 1; i++) {
      for (let j = i + 1; j < allKarts.length; j++) {
        const kartA = allKarts[i];
        const kartB = allKarts[j];
        
        const dx = kartB.position.x - kartA.position.x;
        const dz = kartB.position.z - kartA.position.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        
        const minDist = kartA.radius + kartB.radius;
        
        if (distance < minDist) {
          // 1. Empujar para separar y evitar solapamiento
          const overlap = minDist - distance;
          const normalX = dx / (distance || 1);
          const normalZ = dz / (distance || 1);
          
          const pushX = normalX * overlap * 0.5;
          const pushZ = normalZ * overlap * 0.5;
          
          kartA.position.x -= pushX;
          kartA.position.z -= pushZ;
          kartB.position.x += pushX;
          kartB.position.z += pushZ;
          
          // 2. Intercambio de velocidades estilo choque de arcade
          const speedA = kartA.speed;
          const speedB = kartB.speed;
          
          kartA.speed = -speedA * 0.35 + speedB * 0.3;
          kartB.speed = -speedB * 0.35 + speedA * 0.3;
          
          // 3. Cancelar derrapes del impacto
          kartA.driftCharge = 0;
          kartB.driftCharge = 0;
          if (kartA.isDrifting) {
            kartA.isDrifting = false;
            if (kartA.isPlayer) sounds.playDriftScreech(false);
          }
          if (kartB.isDrifting) {
            kartB.isDrifting = false;
            if (kartB.isPlayer) sounds.playDriftScreech(false);
          }
          
          // 4. Sonido de colisión si involucra al jugador y el impacto es fuerte
          if ((kartA.isPlayer || kartB.isPlayer) && (Math.abs(speedA) > 2.5 || Math.abs(speedB) > 2.5)) {
            sounds.playCrash();
          }
        }
      }
    }
  }

  // Activa o desactiva la pausa
  togglePause() {
    if (this.state === STATES.RACING) {
      this.state = STATES.PAUSED;
      this.ui.showPauseScreen();
      sounds.stopEngine();
    } else if (this.state === STATES.PAUSED) {
      this.state = STATES.RACING;
      this.ui.hidePauseScreen();
      sounds.startEngine();
    }
  }

  // --- BUCLE PRINCIPAL ---
  animate() {
    requestAnimationFrame(() => this.animate());

    // Si la carrera está pausada, congelamos la física y el reloj pero seguimos renderizando la escena
    if (this.state === STATES.PAUSED) {
      this.renderer.render(this.scene, this.camera);
      return;
    }

    const deltaTime = Math.min(this.clock.getDelta(), 0.1);

    // 1. Estados especiales y bloqueo de cuenta atrás
    if (this.state === STATES.COUNTDOWN) {
      this.updateCountdown(deltaTime);
      
      // Congelar vehículos a velocidad 0 y limpiar aceleraciones durante 3-2-1
      this.player.speed = 0;
      this.player.keys.forward = false;
      this.player.keys.backward = false;
      this.aiKarts.forEach((ai) => {
        ai.speed = 0;
        ai.keys.forward = false;
        ai.keys.backward = false;
      });
    }
    
    if (this.state === STATES.RACING) {
      this.totalRaceTime += deltaTime;
      
      if (this.player.keys.useItem) {
        this.player.useItem((itemType, owner) => {
          this.itemManager.spawnItem(itemType, owner, [this.player, ...this.aiKarts]);
        });
      }
    }

    // 2. Actualizar objetos e items
    this.track.update(deltaTime);
    this.itemManager.update(deltaTime, [this.player, ...this.aiKarts]);

    // 3. Actualizar Karts (sólo si no estamos en menú)
    if (this.state !== STATES.MENU) {
      this.player.update(deltaTime);
      this.checkLaps(this.player);

      this.aiKarts.forEach((ai) => {
        ai.update(deltaTime);
        this.checkLaps(ai);
      });

      // Procesar colisiones mutuas entre vehículos
      this.handleKartCollisions();

      sounds.updateEngineSpeed(this.player.speed / this.player.maxSpeed);
    }

    // 4. Actualizar Cámara
    this.updateCamera(deltaTime);

    // 5. HUD e interfaz
    if (this.state !== STATES.MENU && this.state !== STATES.FINISHED) {
      this.ui.update(this.player, this.aiKarts, this.totalRaceTime, this.lapTimes, this.totalLaps);
    }

    // 6. Renderizado
    this.renderer.render(this.scene, this.camera);
  }
}

// Inicializar el juego
new Game();
