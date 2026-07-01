// --- SINTETIZADOR DE AUDIO RETRO PARA CYBERKART 3D ---

class SoundManager {
  constructor() {
    this.ctx = null;
    this.engineOsc = null;
    this.engineFilter = null;
    this.engineGain = null;
    this.isMuted = false;
    this.isEnabled = false;
  }

  // Inicializa el AudioContext después de un click del usuario
  init() {
    if (this.isEnabled) return;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContextClass();
      this.isEnabled = true;
      this.setupEngineSound();
    } catch (e) {
      console.warn("La Web Audio API no está soportada o fue bloqueada:", e);
    }
  }

  // --- SONIDO CONTINUO DEL MOTOR ---
  setupEngineSound() {
    if (!this.ctx) return;

    // Crear un oscilador de sierra para un tono de motor áspero
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 60; // Frecuencia de ralentí (idle)

    // Filtro pasa-bajos para suavizar los armónicos agudos
    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 250;

    // Control de volumen
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0.0; // Silenciado al inicio

    // Conectar nodos
    this.engineOsc.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.ctx.destination);

    // Iniciar oscilador
    this.engineOsc.start(0);
  }

  // Activa o desactiva el sonido del motor
  startEngine() {
    this.init();
    if (!this.ctx || this.isMuted) return;
    
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    if (this.engineGain) {
      // Fade in suave
      this.engineGain.gain.setTargetAtTime(0.08, this.ctx.currentTime, 0.1);
    }
  }

  stopEngine() {
    if (this.engineGain && this.ctx) {
      this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
    }
  }

  // Actualiza la frecuencia del motor basado en la velocidad (0 a 1)
  updateEngineSpeed(speedRatio) {
    if (!this.ctx || !this.engineOsc || !this.engineFilter || this.isMuted) return;

    // Frecuencia base 60Hz a velocidad cero, hasta 220Hz a velocidad máxima
    const targetFreq = 50 + speedRatio * 180;
    this.engineOsc.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.1);

    // Abrir el filtro a mayor velocidad para que suene más agudo y potente
    const filterFreq = 200 + speedRatio * 800;
    this.engineFilter.frequency.setTargetAtTime(filterFreq, this.ctx.currentTime, 0.1);

    // Aumentar ligeramente el volumen a máxima velocidad
    const targetVolume = 0.05 + speedRatio * 0.07;
    this.engineGain.gain.setTargetAtTime(targetVolume, this.ctx.currentTime, 0.15);
  }

  // --- EFECTOS DE SONIDO DE DISPARO RÁPIDO (ONE-SHOTS) ---

  // Sonido de cuenta atrás (3, 2, 1)
  playBeepLow() {
    this.init();
    if (!this.ctx || this.isMuted) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.value = 523.25; // Nota C5
    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.25);
  }

  // Sonido de salida (¡YA! / GO!)
  playBeepHigh() {
    this.init();
    if (!this.ctx || this.isMuted) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.value = 1046.50; // Nota C6
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.55);
  }

  // Chillido de derrape (Drift)
  playDriftScreech(active = true) {
    if (!this.ctx || this.isMuted) return;

    if (active) {
      if (this.driftOsc) return; // Ya sonando
      
      this.driftOsc = this.ctx.createOscillator();
      this.driftGain = this.ctx.createGain();
      
      this.driftOsc.type = 'triangle';
      this.driftOsc.frequency.value = 850; // Frecuencia alta y chillona
      
      // Añadir un vibrato rápido para simular la fricción
      const vibrato = this.ctx.createOscillator();
      const vibratoGain = this.ctx.createGain();
      vibrato.frequency.value = 45; // 45 Hz vibrato
      vibratoGain.gain.value = 25;  // Desviación de 25Hz
      
      vibrato.connect(vibratoGain);
      vibratoGain.connect(this.driftOsc.frequency);
      
      this.driftGain.gain.setValueAtTime(0.02, this.ctx.currentTime);

      this.driftOsc.connect(this.driftGain);
      this.driftGain.connect(this.ctx.destination);
      
      vibrato.start();
      this.driftOsc.start();
      
      this.driftVibrato = vibrato;
    } else {
      if (!this.driftOsc) return;
      
      const osc = this.driftOsc;
      const gain = this.driftGain;
      const vib = this.driftVibrato;
      
      this.driftOsc = null;
      this.driftGain = null;
      this.driftVibrato = null;
      
      if (gain) {
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);
      }
      
      setTimeout(() => {
        try {
          osc.stop();
          vib.stop();
        } catch(e) {}
      }, 200);
    }
  }

  // Sonido de choque (Collision)
  playCrash() {
    this.init();
    if (!this.ctx || this.isMuted) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(30, this.ctx.currentTime + 0.3);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(180, this.ctx.currentTime);

    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.4);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.45);
  }

  // Turbo / Champiñón (Boost)
  playBoost() {
    this.init();
    if (!this.ctx || this.isMuted) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, this.ctx.currentTime + 0.6);

    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.6);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.65);
  }

  // Recoger Caja de Item (Chime)
  playItemPickup() {
    this.init();
    if (!this.ctx || this.isMuted) return;

    const now = this.ctx.currentTime;
    const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5 (Arpegio Mayor)

    notes.forEach((freq, index) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.value = freq;
      
      const startTime = now + index * 0.08;
      
      gain.gain.setValueAtTime(0, now);
      gain.gain.setValueAtTime(0.12, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.2);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.25);
    });
  }

  // Lanzar Proyectil / Usar Item
  playShoot() {
    this.init();
    if (!this.ctx || this.isMuted) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(800, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(150, this.ctx.currentTime + 0.3);

    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.35);
  }

  // Trompo / Resbalón con Plátano (Spinout)
  playSpinout() {
    this.init();
    if (!this.ctx || this.isMuted) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    
    // Frecuencia modulada descendente y trémola
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.linearRampToValueAtTime(200, now + 0.8);

    // Trémolo manual modulando la ganancia
    gain.gain.setValueAtTime(0.15, now);
    for (let i = 0; i < 8; i++) {
      gain.gain.setValueAtTime(0.15, now + i * 0.1);
      gain.gain.setValueAtTime(0.02, now + i * 0.1 + 0.05);
    }
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(now + 0.9);
  }

  // Música o fanfarria de victoria
  playVictoryJingle() {
    this.init();
    if (!this.ctx || this.isMuted) return;
    this.stopEngine();

    const now = this.ctx.currentTime;
    const notes = [
      { f: 523.25, d: 0.15 }, // C5
      { f: 523.25, d: 0.15 }, // C5
      { f: 523.25, d: 0.15 }, // C5
      { f: 523.25, d: 0.4 },  // C5 (largo)
      { f: 415.30, d: 0.3 },  // G#4
      { f: 466.16, d: 0.3 },  // A#4
      { f: 523.25, d: 0.2 },  // C5
      { f: 466.16, d: 0.15 }, // A#4
      { f: 523.25, d: 0.6 }   // C5 (sostenido)
    ];

    let accumulatedTime = 0;
    notes.forEach((note) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.value = note.f;

      const noteStart = now + accumulatedTime;
      gain.gain.setValueAtTime(0, now);
      gain.gain.setValueAtTime(0.15, noteStart);
      gain.gain.exponentialRampToValueAtTime(0.001, noteStart + note.d);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(noteStart);
      osc.stop(noteStart + note.d + 0.05);

      accumulatedTime += note.d + 0.02;
    });
  }

  // Música o fanfarria de derrota
  playDefeatJingle() {
    this.init();
    if (!this.ctx || this.isMuted) return;
    this.stopEngine();

    const now = this.ctx.currentTime;
    const notes = [
      { f: 392.00, d: 0.3 }, // G4
      { f: 349.23, d: 0.3 }, // F4
      { f: 311.13, d: 0.3 }, // D#4
      { f: 293.66, d: 0.6 }  // D4 (triste y sostenido)
    ];

    let accumulatedTime = 0;
    notes.forEach((note) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.value = note.f;

      const noteStart = now + accumulatedTime;
      gain.gain.setValueAtTime(0, now);
      gain.gain.setValueAtTime(0.12, noteStart);
      gain.gain.exponentialRampToValueAtTime(0.001, noteStart + note.d);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(noteStart);
      osc.stop(noteStart + note.d + 0.05);

      accumulatedTime += note.d + 0.05;
    });
  }
}

export const sounds = new SoundManager();
