import * as THREE from 'three';

export class UIManager {
  constructor(track) {
    this.track = track;
    
    // Elementos DOM del HUD
    this.dom = {
      hud: document.getElementById('hud'),
      position: document.querySelector('#position-indicator .rank'),
      lap: document.getElementById('lap-counter'),
      timer: document.getElementById('timer'),
      speed: document.getElementById('speed-val'),
      driftIndicator: document.getElementById('drift-indicator'),
      boostBarFill: document.getElementById('boost-bar-fill'),
      itemIcon: document.getElementById('item-icon'),
      
      // Pantallas
      startScreen: document.getElementById('start-screen'),
      endScreen: document.getElementById('end-screen'),
      pauseScreen: document.getElementById('pause-screen'),
      startBtn: document.getElementById('start-btn'),
      restartBtn: document.getElementById('restart-btn'),
      resumeBtn: document.getElementById('resume-btn'),
      exitBtn: document.getElementById('exit-btn'),
      
      // Resultados finales
      endTitle: document.getElementById('end-title'),
      finalPos: document.getElementById('final-pos'),
      finalTime: document.getElementById('final-time'),
      bestLap: document.getElementById('best-lap')
    };

    // Configuración del Minimapa Canvas
    this.minimapCanvas = document.getElementById('minimap-canvas');
    this.minimapCtx = this.minimapCanvas.getContext('2d');
    
    this.precomputeMinimapBounds();
  }

  // Precalcula el escalado de coordenadas 3D (X, Z) a coordenadas 2D del Canvas
  precomputeMinimapBounds() {
    let minX = Infinity, maxX = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    // Recorrer los puntos de la pista para encontrar los límites
    const curvePoints = this.track.curve.getSpacedPoints(100);
    curvePoints.forEach((p) => {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.z < minZ) minZ = p.z;
      if (p.z > maxZ) maxZ = p.z;
    });

    const padding = 15; // Margen en el canvas (píxeles)
    const mapWidth = maxX - minX;
    const mapHeight = maxZ - minZ;

    // Guardar límites y factores de escala
    this.mapBounds = {
      minX, minZ,
      width: mapWidth,
      height: mapHeight,
      scaleX: (this.minimapCanvas.width - padding * 2) / mapWidth,
      scaleZ: (this.minimapCanvas.height - padding * 2) / mapHeight,
      padding
    };

    // Precalcular los puntos proyectados de la pista para dibujarlos rápido
    this.minimapTrackPoints = curvePoints.map((p) => this.worldToMinimapCoords(p.x, p.z));
  }

  // Convierte coordenadas 3D del mundo a coordenadas 2D de píxeles del canvas del minimapa
  worldToMinimapCoords(worldX, worldZ) {
    const b = this.mapBounds;
    const canvasX = b.padding + (worldX - b.minX) * b.scaleX;
    // Invertir el eje Z para que arriba sea el norte convencional
    const canvasY = b.padding + (worldZ - b.minZ) * b.scaleZ;
    return { x: canvasX, y: canvasY };
  }

  // Formatea el tiempo en MM:SS.CC (Minutos:Segundos.Centésimas)
  formatTime(timeSeconds) {
    const min = Math.floor(timeSeconds / 60);
    const sec = Math.floor(timeSeconds % 60);
    const hun = Math.floor((timeSeconds % 1) * 100);

    const pad = (num) => String(num).padStart(2, '0');
    return `${pad(min)}:${pad(sec)}.${pad(hun)}`;
  }

  // --- DIBUJADO DEL MINIMAPA ---
  drawMinimap(player, aiKarts) {
    const ctx = this.minimapCtx;
    const width = this.minimapCanvas.width;
    const height = this.minimapCanvas.height;

    // 1. Limpiar canvas con transparencia
    ctx.clearRect(0, 0, width, height);

    // 2. Dibujar circuito (carretera)
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    this.minimapTrackPoints.forEach((p, idx) => {
      if (idx === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.closePath();
    ctx.stroke();

    // Dibujar línea central neon del circuito
    ctx.beginPath();
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 1.5;
    this.minimapTrackPoints.forEach((p, idx) => {
      if (idx === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.closePath();
    ctx.stroke();

    // 3. Dibujar oponentes de IA (Círculos pequeños)
    aiKarts.forEach((ai) => {
      const coords = this.worldToMinimapCoords(ai.position.x, ai.position.z);
      
      ctx.beginPath();
      ctx.arc(coords.x, coords.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = ai.color;
      ctx.shadowColor = ai.color;
      ctx.shadowBlur = 4;
      ctx.fill();
      ctx.shadowBlur = 0; // Reset sombra
    });

    // 4. Dibujar jugador principal (Círculo más grande y llamativo)
    const pCoords = this.worldToMinimapCoords(player.position.x, player.position.z);
    ctx.beginPath();
    ctx.arc(pCoords.x, pCoords.y, 6.5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = player.color;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = player.color;
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0; // Reset sombra
  }

  // --- ACTUALIZACIÓN DE HUD Y ESTADÍSTICAS ---
  update(player, aiKarts, totalRaceTime, lapTimes, totalLaps = 3) {
    // 1. Velocímetro
    // Convertir la velocidad escalar a un número entero estético de KM/H
    const speedKmh = Math.max(0, Math.round(Math.abs(player.speed) * 4.5));
    this.dom.speed.textContent = speedKmh;

    // 2. Contador de vueltas
    const displayLap = Math.min(totalLaps, player.currentLap);
    this.dom.lap.textContent = `${displayLap}/${totalLaps}`;

    // 3. Temporizador de carrera
    this.dom.timer.textContent = this.formatTime(totalRaceTime);

    // 4. Indicador de Derrape (Drift Boost)
    if (player.isDrifting) {
      this.dom.driftIndicator.classList.add('active');
      // Carga porcentual de 0 a 1 (se activa turbo completo a 1.6s)
      const chargePct = Math.min(100, (player.driftCharge / 1.6) * 100);
      this.dom.boostBarFill.style.width = `${chargePct}%`;

      // Cambiar colores dinámicos de la barra de turbo según nivel de carga
      if (player.driftCharge > 1.6) {
        this.dom.boostBarFill.style.background = 'linear-gradient(90deg, #ffb700, #ff007f)';
        this.dom.boostBarFill.style.boxShadow = '0 0 10px #ff007f';
      } else if (player.driftCharge > 0.8) {
        this.dom.boostBarFill.style.background = 'linear-gradient(90deg, #00f0ff, #39ff14)';
        this.dom.boostBarFill.style.boxShadow = '0 0 10px #39ff14';
      } else {
        this.dom.boostBarFill.style.background = '#00f0ff';
        this.dom.boostBarFill.style.boxShadow = 'none';
      }
    } else {
      this.dom.driftIndicator.classList.remove('active');
      this.dom.boostBarFill.style.width = '0%';
    }

    // 5. Tabla de Clasificación en tiempo real
    this.updateRaceStandings(player, aiKarts);

    // 6. Redibujar Minimapa
    this.drawMinimap(player, aiKarts);
  }

  // Ordena a los corredores según la distancia total recorrida
  updateRaceStandings(player, aiKarts) {
    const allKarts = [player, ...aiKarts];

    allKarts.forEach((kart) => {
      const roadInfo = this.track.getRoadHeightAndNormal(kart.position);
      
      const relativeProgress = roadInfo.progress;
      const laps = kart.lapsCompleted !== undefined ? kart.lapsCompleted : (kart.currentLap - 1);
      kart.totalProgress = laps + relativeProgress;
    });

    // Ordenar de mayor a menor progreso total
    allKarts.sort((a, b) => b.totalProgress - a.totalProgress);

    // Encontrar posición del jugador
    const playerRank = allKarts.indexOf(player) + 1;
    
    // Actualizar HUD
    this.dom.position.textContent = playerRank;
  }

  // --- TRANSICIONES DE PANTALLAS ---
  showStartScreen() {
    this.dom.startScreen.classList.add('active');
    this.dom.hud.classList.remove('active');
    this.dom.endScreen.classList.remove('active');
  }

  showHUD() {
    this.dom.startScreen.classList.remove('active');
    this.dom.hud.classList.add('active');
    this.dom.endScreen.classList.remove('active');
    this.dom.pauseScreen.classList.remove('active');
  }

  showPauseScreen() {
    this.dom.pauseScreen.classList.add('active');
  }

  hidePauseScreen() {
    this.dom.pauseScreen.classList.remove('active');
  }

  showEndScreen(playerRank, totalTime, bestLapTime) {
    this.dom.startScreen.classList.remove('active');
    this.dom.hud.classList.remove('active');
    this.dom.endScreen.classList.add('active');

    // Modificar textos según posición
    if (playerRank === 1) {
      this.dom.endTitle.textContent = '¡VICTORIA!';
      this.dom.endTitle.style.textShadow = '0 0 10px #fff, 0 0 20px #39ff14, 0 0 35px #39ff14';
      this.dom.endTitle.style.color = '#fff';
    } else {
      this.dom.endTitle.textContent = '¡FIN DE CARRERA!';
      this.dom.endTitle.style.textShadow = '0 0 10px #fff, 0 0 20px #ff007f, 0 0 35px #ff007f';
      this.dom.endTitle.style.color = '#fff';
    }

    this.dom.finalPos.textContent = `${playerRank}º`;
    this.dom.finalTime.textContent = this.formatTime(totalTime);
    this.dom.bestLap.textContent = bestLapTime > 0 ? this.formatTime(bestLapTime) : '--:--.--';
  }
}
