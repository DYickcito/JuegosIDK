// JUEGO WORDLE EN ESPAÑOL - LÓGICA DE CONTROL

// Configuración de niveles
const DIFFICULTY_CONFIG = {
  4: { name: "Fácil", letters: 4, attempts: 6, hasClues: true },
  5: { name: "Medio", letters: 5, attempts: 6, hasClues: false },
  6: { name: "Difícil", letters: 6, attempts: 6, hasClues: false },
  7: { name: "Experto", letters: 7, attempts: 5, hasClues: false }
};

// Teclado QWERTY español
const KEYBOARD_LAYOUT = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L", "Ñ"],
  ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "ENVIAR"] // ENVIAR will map to ENTER, BACKSPACE mapped as icon
];

// Estado global del juego
let currentDiff = 5; // Dificultad actual (defecto: 5 letras)
let targetWordObj = null; // Objeto de palabra actual { word, clue }
let guesses = []; // Lista de intentos realizados
let currentGuess = ""; // Intento actual escribiéndose
let gameState = "PLAYING"; // PLAYING, WON, LOST
let keyStatuses = {}; // Estado de los colores en el teclado

// Preferencias de usuario
let settings = {
  highContrast: false,
  strictMode: false,
  validateDict: true
};

// Estadísticas persistentes
let stats = {};

// Confetti Effect
let confettiEffect = null;

// ELEMENTOS DEL DOM
const gameBoard = document.getElementById("game-board");
const keyboard = document.getElementById("keyboard");
const toastContainer = document.getElementById("toast-container");
const hintBtn = document.getElementById("hint-btn");
const statsBtn = document.getElementById("stats-btn");
const helpBtn = document.getElementById("help-btn");
const settingsBtn = document.getElementById("settings-btn");

// Modales
const helpModal = document.getElementById("help-modal");
const statsModal = document.getElementById("stats-modal");
const settingsModal = document.getElementById("settings-modal");
const gameoverModal = document.getElementById("gameover-modal");

// Elementos de Toggles
const contrastToggle = document.getElementById("contrast-toggle");
const dictionaryToggle = document.getElementById("dictionary-toggle");

// INICIALIZACIÓN
document.addEventListener("DOMContentLoaded", () => {
  loadSettings();
  loadStats();
  initConfetti();
  setupEventListeners();
  startGame(5); // Iniciar por defecto en Medio
});

// Obtener palabra aleatoria evitando repeticiones en lo más mínimo
function getUniqueTargetWord(diff) {
  const wordList = WORDS[diff];
  
  // Cargar historial de palabras jugadas desde LocalStorage
  let playedHistory = {};
  const storedHistory = localStorage.getItem("wordle_es_played_history");
  if (storedHistory) {
    try {
      playedHistory = JSON.parse(storedHistory);
    } catch (e) {
      playedHistory = {};
    }
  }
  
  // Inicializar para esta dificultad si no existe
  if (!playedHistory[diff] || !Array.isArray(playedHistory[diff])) {
    playedHistory[diff] = [];
  }
  
  // Filtrar palabras de la lista original que no hayan sido jugadas
  let availableWords = wordList.filter(w => !playedHistory[diff].includes(w.word.toUpperCase()));
  
  // Si ya se jugaron todas las palabras de esta dificultad, reiniciamos el historial
  if (availableWords.length === 0) {
    playedHistory[diff] = [];
    availableWords = wordList;
  }
  
  // Seleccionar una palabra aleatoria de las disponibles
  const chosenObj = availableWords[Math.floor(Math.random() * availableWords.length)];
  
  // Añadir al historial de palabras jugadas y guardar en LocalStorage
  playedHistory[diff].push(chosenObj.word.toUpperCase());
  localStorage.setItem("wordle_es_played_history", JSON.stringify(playedHistory));
  
  return chosenObj;
}

// CARGAR E INICIAR JUEGO
function startGame(diff) {
  currentDiff = parseInt(diff);
  gameState = "PLAYING";
  guesses = [];
  currentGuess = "";
  keyStatuses = {};

  // Actualizar selector de dificultad en UI
  document.querySelectorAll(".diff-btn").forEach(btn => {
    if (parseInt(btn.dataset.diff) === currentDiff) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  // Obtener palabra aleatoria evitando repeticiones
  targetWordObj = getUniqueTargetWord(currentDiff);
  
  // Modo estricto removido por petición del usuario
  settings.strictMode = false;

  // Habilitar o deshabilitar botón de pista
  if (DIFFICULTY_CONFIG[currentDiff].hasClues) {
    hintBtn.classList.remove("hidden-hint");
    hintBtn.style.opacity = "1";
    hintBtn.style.pointerEvents = "auto";
  } else {
    hintBtn.classList.add("hidden-hint");
    hintBtn.style.opacity = "0.3";
    hintBtn.style.pointerEvents = "none";
  }

  // Generar Tablero
  renderBoard();
  
  // Generar Teclado
  renderKeyboard();

  // Ocultar modales y limpiar confetti
  closeAllModals();
  if (confettiEffect) confettiEffect.stop();

  console.log(`[DEV] Palabra correcta: ${targetWordObj.word}`);
}

// DIBUJAR EL TABLERO
function renderBoard() {
  gameBoard.innerHTML = "";
  const rows = DIFFICULTY_CONFIG[currentDiff].attempts;
  const cols = DIFFICULTY_CONFIG[currentDiff].letters;

  gameBoard.style.setProperty("--rows", rows);
  gameBoard.style.setProperty("--cols", cols);
  gameBoard.dataset.length = cols;

  for (let r = 0; r < rows; r++) {
    const rowDiv = document.createElement("div");
    rowDiv.className = "board-row";
    rowDiv.dataset.row = r;

    for (let c = 0; c < cols; c++) {
      const tileDiv = document.createElement("div");
      tileDiv.className = "board-tile";
      tileDiv.dataset.col = c;
      rowDiv.appendChild(tileDiv);
    }
    gameBoard.appendChild(rowDiv);
  }
}

// DIBUJAR EL TECLADO VIRTUAL
function renderKeyboard() {
  keyboard.innerHTML = "";
  
  KEYBOARD_LAYOUT.forEach(row => {
    const rowDiv = document.createElement("div");
    rowDiv.className = "keyboard-row";

    row.forEach(keyVal => {
      const keyBtn = document.createElement("button");
      keyBtn.className = "key";
      
      if (keyVal === "ENTER" || keyVal === "ENVIAR") {
        keyBtn.classList.add("wide");
        keyBtn.textContent = "ENTER";
        keyBtn.id = "key-enter";
      } else if (keyVal === "BACKSPACE" || keyVal === "BORRAR") {
        // En KEYBOARD_LAYOUT cambié el final por ENVIAR y agregaremos borrar manualmente
        // pero vamos a estructurarlo dinámicamente
      } else {
        keyBtn.textContent = keyVal;
        keyBtn.dataset.key = keyVal;
        
        // Aplicar estado de color si existe
        if (keyStatuses[keyVal]) {
          keyBtn.classList.add(keyStatuses[keyVal]);
        }
      }

      keyBtn.addEventListener("click", () => handleKeyPress(keyVal));
      rowDiv.appendChild(keyBtn);
    });

    // Agregar tecla borrar al final de la última fila
    if (row === KEYBOARD_LAYOUT[2]) {
      // Reemplazamos el último elemento por Borrar con icono
      const lastBtn = rowDiv.lastChild;
      lastBtn.innerHTML = '<i data-lucide="delete"></i>';
      lastBtn.classList.add("wide");
      lastBtn.textContent = "";
      lastBtn.appendChild(document.createElement("span")); // placeholder
      lastBtn.innerHTML = '<i data-lucide="delete"></i>';
      lastBtn.dataset.key = "BACKSPACE";
      
      // Re-escuchador para delete
      lastBtn.addEventListener("click", () => handleKeyPress("BACKSPACE"));
    }

    keyboard.appendChild(rowDiv);
  });
  
  lucide.createIcons();
}

// GESTIÓN DE ENTRADA (TECLADO FÍSICO Y VIRTUAL)
function handleKeyPress(key) {
  if (gameState !== "PLAYING") return;

  const maxLen = DIFFICULTY_CONFIG[currentDiff].letters;

  if (key === "ENTER" || key === "ENVIAR") {
    submitGuess();
  } else if (key === "BACKSPACE" || key === "BORRAR" || key === "Backspace") {
    deleteLetter();
  } else {
    // Es una letra
    const letter = cleanSpanishChar(key);
    if (letter && letter.length === 1 && /^[A-ZÑ]$/.test(letter)) {
      insertLetter(letter);
    }
  }
}

function insertLetter(letter) {
  const maxLen = DIFFICULTY_CONFIG[currentDiff].letters;
  if (currentGuess.length < maxLen) {
    currentGuess += letter;
    updateTileUI();
  }
}

function deleteLetter() {
  if (currentGuess.length > 0) {
    currentGuess = currentGuess.slice(0, -1);
    updateTileUI();
  }
}

function updateTileUI() {
  const rowIdx = guesses.length;
  const rowDiv = gameBoard.children[rowIdx];
  const maxLen = DIFFICULTY_CONFIG[currentDiff].letters;

  for (let c = 0; c < maxLen; c++) {
    const tile = rowDiv.children[c];
    if (c < currentGuess.length) {
      if (tile.textContent !== currentGuess[c]) {
        tile.textContent = currentGuess[c];
        tile.classList.add("pop");
        // Quitar clase pop después de que termine la animación
        setTimeout(() => tile.classList.remove("pop"), 150);
      }
    } else {
      tile.textContent = "";
    }
  }
}

// PROCESAR INTENTO (Usando API RAE)
async function submitGuess() {
  const maxLen = DIFFICULTY_CONFIG[currentDiff].letters;
  const attempts = DIFFICULTY_CONFIG[currentDiff].attempts;

  // 1. Validar longitud
  if (currentGuess.length < maxLen) {
    showToast("No hay suficientes letras");
    shakeRow(guesses.length);
    return;
  }

  const normalizedGuess = currentGuess.toUpperCase();
  const cleanGuess = cleanSpanishWord(normalizedGuess);

  // 2. Validar Diccionario usando la API RAE
  if (settings.validateDict) {
    // Cambiar estado del juego para evitar doble entrada mientras carga
    gameState = "CHECKING_API";
    showToast("Consultando RAE...");

    try {
      const response = await fetch(`https://rae-api.com/api/words/${cleanGuess.toLowerCase()}`);
      
      if (response.status === 404) {
        showToast("La palabra no está en el diccionario RAE");
        shakeRow(guesses.length);
        gameState = "PLAYING";
        return;
      } else if (!response.ok) {
        // En caso de que falle la API por límites de cuota, etc., permitimos jugar
        console.warn(`[RAE API] Error de respuesta: ${response.status}. Permitiendo palabra.`);
      }
    } catch (error) {
      // En caso de estar desconectado o error de red
      console.warn("[RAE API] Error de red. Permitiendo palabra.", error);
    }
  }

  // Restaurar el estado de juego
  gameState = "PLAYING";

  // 3. Registrar intento
  guesses.push(normalizedGuess);
  revealRow(guesses.length - 1);
}

// REVELACIÓN DE FILA CON ANIMACIONES 3D
function revealRow(rowIdx) {
  const rowDiv = gameBoard.children[rowIdx];
  const guess = guesses[rowIdx];
  const target = targetWordObj.word;
  const colors = checkGuessColors(guess, target);
  
  // Deshabilitar entrada durante la animación de revelado
  gameState = "ANIMATING";

  for (let c = 0; c < colors.length; c++) {
    const tile = rowDiv.children[c];
    const letter = guess[c];
    const state = colors[c];

    // Animación flip escalonada
    setTimeout(() => {
      tile.classList.add("flip");

      // Cambiar el color de fondo en la mitad del giro de la animación
      setTimeout(() => {
        tile.classList.add(state);
        updateKeyboardKey(letter, state);
      }, 250);
      
    }, c * 200);
  }

  // Esperar a que termine de revelarse toda la fila
  const animationDuration = (colors.length * 200) + 500;
  setTimeout(() => {
    gameState = "PLAYING";
    currentGuess = "";

    // Comprobar victoria o derrota
    if (guess === cleanSpanishWord(target)) {
      endGame(true);
    } else if (guesses.length >= DIFFICULTY_CONFIG[currentDiff].attempts) {
      endGame(false);
    }
  }, animationDuration);
}

// ALGORITMO DE COMPARACIÓN DE WORDLE (Manejo óptimo de letras duplicadas)
function checkGuessColors(guess, target) {
  const cleanGuess = cleanSpanishWord(guess);
  const cleanTarget = cleanSpanishWord(target);
  const len = cleanTarget.length;
  
  const result = Array(len).fill("absent");
  const targetCounts = {};

  // Contar frecuencias en el objetivo
  for (let char of cleanTarget) {
    targetCounts[char] = (targetCounts[char] || 0) + 1;
  }

  // Primer paso: marcar letras correctas (verdes)
  for (let i = 0; i < len; i++) {
    if (cleanGuess[i] === cleanTarget[i]) {
      result[i] = "correct";
      targetCounts[cleanGuess[i]]--;
    }
  }

  // Segundo paso: marcar letras presentes (amarillas)
  for (let i = 0; i < len; i++) {
    if (result[i] !== "correct") {
      const char = cleanGuess[i];
      if (targetCounts[char] && targetCounts[char] > 0) {
        result[i] = "present";
        targetCounts[char]--;
      }
    }
  }

  return result;
}

// ACTUALIZAR TECLA DEL TECLADO
function updateKeyboardKey(letter, state) {
  const current = keyStatuses[letter];
  
  if (!current) {
    keyStatuses[letter] = state;
  } else if (current === "present" && state === "correct") {
    keyStatuses[letter] = "correct";
  } else if (current === "absent" && (state === "present" || state === "correct")) {
    keyStatuses[letter] = state;
  }

  // Actualizar en UI
  const keyBtn = keyboard.querySelector(`[data-key="${letter}"]`);
  if (keyBtn) {
    keyBtn.className = `key ${keyStatuses[letter]}`;
  }
}

// MANEJO DE FIN DEL JUEGO
function endGame(isWin) {
  gameState = isWin ? "WON" : "LOST";
  
  // Guardar y actualizar estadísticas
  saveGameStats(isWin, guesses.length);

  // Actualizar Modal
  const title = document.getElementById("gameover-title");
  const revealedWord = document.getElementById("revealed-word");
  const wordClue = document.getElementById("word-clue");
  const attemptsLabel = document.getElementById("gameover-attempts");

  title.textContent = isWin ? "¡Excelente! Has Ganado" : "Fin de la Partida";
  title.style.color = isWin ? "var(--state-correct)" : "#ef4444";
  revealedWord.textContent = targetWordObj.word.toUpperCase();
  wordClue.textContent = targetWordObj.clue;
  
  attemptsLabel.textContent = isWin 
    ? `Intentos: ${guesses.length}/${DIFFICULTY_CONFIG[currentDiff].attempts}`
    : "No lograste adivinar la palabra.";

  // Mostrar modal tras un breve retraso
  setTimeout(() => {
    openModal(gameoverModal);
    if (isWin) {
      if (confettiEffect) confettiEffect.start();
    }
  }, 800);
}

// PISTAS (SÓLO DIFICULTAD FÁCIL)
function requestHint() {
  if (currentDiff !== 4) {
    showToast("Las pistas sólo están disponibles en dificultad Fácil");
    return;
  }
  showToast(`Pista: ${targetWordObj.clue}`);
}

// EFECTO SHAKE EN CASO DE ERROR
function shakeRow(rowIdx) {
  const rowDiv = gameBoard.children[rowIdx];
  rowDiv.classList.add("shake");
  setTimeout(() => rowDiv.classList.remove("shake"), 500);
}

// TOAST NOTIFICATIONS
function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = "fadeIn 0.2s reverse forwards";
    setTimeout(() => toast.remove(), 200);
  }, 2000);
}

// NORMALIZACIÓN DE CARACTERES
function cleanSpanishChar(char) {
  const map = {
    'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U', 'Ü': 'U',
    'á': 'A', 'é': 'E', 'í': 'I', 'ó': 'O', 'ú': 'U', 'ü': 'U'
  };
  const upper = char.toUpperCase();
  return map[upper] || upper;
}

function cleanSpanishWord(word) {
  return word.split('').map(char => cleanSpanishChar(char)).join('');
}

// AJUSTES Y CONFIGURACIÓN LOCALSTORAGE
function loadSettings() {
  settings.highContrast = localStorage.getItem("highContrast") === "true";
  settings.strictMode = false;
  settings.validateDict = localStorage.getItem("validateDict") !== "false";

  contrastToggle.checked = settings.highContrast;
  dictionaryToggle.checked = settings.validateDict;

  applyTheme();
}

function saveSetting(key, val) {
  settings[key] = val;
  localStorage.setItem(key, val);
  applyTheme();
}

function applyTheme() {
  if (settings.highContrast) {
    document.body.classList.add("high-contrast");
  } else {
    document.body.classList.remove("high-contrast");
  }
}

// ESTADÍSTICAS PERSISTENTES
function loadStats() {
  const stored = localStorage.getItem("wordle_es_stats");
  if (stored) {
    stats = JSON.parse(stored);
  } else {
    // Inicializar vacías por dificultad
    stats = {
      4: { played: 0, wins: 0, streak: 0, maxStreak: 0, guesses: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 } },
      5: { played: 0, wins: 0, streak: 0, maxStreak: 0, guesses: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 } },
      6: { played: 0, wins: 0, streak: 0, maxStreak: 0, guesses: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 } },
      7: { played: 0, wins: 0, streak: 0, maxStreak: 0, guesses: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } }
    };
  }
}

function saveGameStats(isWin, attemptCount) {
  const diffStats = stats[currentDiff];
  diffStats.played++;
  
  if (isWin) {
    diffStats.wins++;
    diffStats.streak++;
    if (diffStats.streak > diffStats.maxStreak) {
      diffStats.maxStreak = diffStats.streak;
    }
    diffStats.guesses[attemptCount]++;
  } else {
    diffStats.streak = 0;
  }

  localStorage.setItem("wordle_es_stats", JSON.stringify(stats));
  updateStatsModalUI();
}

function resetStats() {
  localStorage.removeItem("wordle_es_stats");
  loadStats();
  updateStatsModalUI();
  showToast("Estadísticas restablecidas");
}

function updateStatsModalUI() {
  const diffStats = stats[currentDiff];
  document.getElementById("stat-played").textContent = diffStats.played;
  
  const winPercent = diffStats.played > 0 ? Math.round((diffStats.wins / diffStats.played) * 100) : 0;
  document.getElementById("stat-winpercent").textContent = winPercent + "%";
  
  document.getElementById("stat-streak").textContent = diffStats.streak;
  document.getElementById("stat-maxstreak").textContent = diffStats.maxStreak;

  // Graficar distribución de intentos
  const distributionDiv = document.getElementById("guess-distribution");
  distributionDiv.innerHTML = "";

  const attemptsLimit = DIFFICULTY_CONFIG[currentDiff].attempts;
  
  // Buscar el intento con el valor más alto para escalar las barras proporcionalmente
  let maxGuessCount = 0;
  for (let i = 1; i <= attemptsLimit; i++) {
    if (diffStats.guesses[i] > maxGuessCount) {
      maxGuessCount = diffStats.guesses[i];
    }
  }

  for (let i = 1; i <= attemptsLimit; i++) {
    const row = document.createElement("div");
    row.className = "graph-row";

    const label = document.createElement("div");
    label.className = "graph-num";
    label.textContent = i;
    row.appendChild(label);

    const bar = document.createElement("div");
    bar.className = "graph-bar";

    const fill = document.createElement("div");
    fill.className = "graph-fill";
    
    // Si este intento fue el que terminó el último juego (si ganamos), lo resaltamos
    if (gameState === "WON" && guesses.length === i) {
      fill.classList.add("highlight");
    }

    const count = diffStats.guesses[i] || 0;
    fill.textContent = count;
    
    // Ancho porcentual según el máximo para estética
    const percentWidth = maxGuessCount > 0 ? Math.max(7, Math.round((count / maxGuessCount) * 100)) : 7;
    fill.style.width = percentWidth + "%";

    bar.appendChild(fill);
    row.appendChild(bar);
    distributionDiv.appendChild(row);
  }
}

// CONTROL DE MODALES
function openModal(modal) {
  modal.classList.add("active");
  if (modal === statsModal) {
    updateStatsModalUI();
  }
}

function closeModal(modal) {
  modal.classList.remove("active");
}

function closeAllModals() {
  document.querySelectorAll(".modal").forEach(modal => modal.classList.remove("active"));
}

// EVENT LISTENERS SETUP
function setupEventListeners() {
  // Teclado físico
  document.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    
    // Solo procesar si no hay modales activos
    const hasActiveModal = Array.from(document.querySelectorAll(".modal")).some(m => m.classList.contains("active"));
    if (hasActiveModal) return;

    if (e.key === "Enter") {
      handleKeyPress("ENTER");
    } else if (e.key === "Backspace") {
      handleKeyPress("BACKSPACE");
    } else {
      handleKeyPress(e.key);
    }
  });

  // Selectores de Dificultad
  document.querySelectorAll(".diff-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const diff = btn.dataset.diff;
      startGame(diff);
    });
  });

  // Botones del Header
  helpBtn.addEventListener("click", () => openModal(helpModal));
  statsBtn.addEventListener("click", () => openModal(statsModal));
  settingsBtn.addEventListener("click", () => openModal(settingsModal));
  hintBtn.addEventListener("click", requestHint);

  // Cerrar modales con clic en la cruz o fuera del contenido
  document.querySelectorAll(".close-modal").forEach(btn => {
    btn.addEventListener("click", (e) => closeModal(e.target.closest(".modal")));
  });

  document.querySelectorAll(".modal").forEach(modal => {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal(modal);
    });
  });

  // Ajustes toggles
  contrastToggle.addEventListener("change", (e) => {
    saveSetting("highContrast", e.target.checked);
  });

  // Evento strictToggle removido por eliminación del control

  dictionaryToggle.addEventListener("change", (e) => {
    saveSetting("validateDict", e.target.checked);
  });

  // Botón Reiniciar Estadísticas
  document.getElementById("reset-stats-btn").addEventListener("click", () => {
    if (confirm("¿Estás seguro de que quieres borrar todas tus estadísticas? Esta acción no se puede deshacer.")) {
      resetStats();
    }
  });

  // Botones fin del juego
  document.getElementById("play-again-btn").addEventListener("click", () => {
    startGame(currentDiff);
  });

  document.getElementById("share-btn").addEventListener("click", shareResults);
}

// COMPARTIR RESULTADOS (COPIAR CUADÍCULA EMOJIS)
function shareResults() {
  const target = targetWordObj.word;
  const attempts = guesses.length;
  const maxAttempts = DIFFICULTY_CONFIG[currentDiff].attempts;
  
  let shareText = `Wordle ES (Dificultad: ${DIFFICULTY_CONFIG[currentDiff].name}) ${attempts}/${maxAttempts}\n\n`;

  guesses.forEach(guess => {
    const colors = checkGuessColors(guess, target);
    const rowEmojis = colors.map(state => {
      if (state === "correct") {
        return settings.highContrast ? "🧡" : "🟩";
      } else if (state === "present") {
        return settings.highContrast ? "💙" : "🟨";
      } else {
        return "⬛";
      }
    }).join("");
    shareText += rowEmojis + "\n";
  });

  shareText += "\nJuega aquí: [Tu URL]";
  
  navigator.clipboard.writeText(shareText)
    .then(() => showToast("¡Resultados copiados al portapapeles!"))
    .catch(() => showToast("Error al copiar resultados"));
}

// CONFIGURACIÓN DE CONFETTI (CUSTOM PERFORMANCE ENGINE)
function initConfetti() {
  const canvas = document.getElementById("confetti-canvas");
  if (!canvas) return;

  confettiEffect = {
    canvas: canvas,
    ctx: canvas.getContext("2d"),
    particles: [],
    animationId: null,
    
    start: function() {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
      this.particles = [];

      const colors = ["#a5b4fc", "#818cf8", "#6366f1", "#10b981", "#f59e0b", "#ec4899"];

      for (let i = 0; i < 150; i++) {
        this.particles.push({
          x: Math.random() * this.canvas.width,
          y: Math.random() * this.canvas.height - this.canvas.height,
          r: Math.random() * 6 + 4,
          d: Math.random() * this.canvas.height,
          color: colors[Math.floor(Math.random() * colors.length)],
          tilt: Math.random() * 10 - 5,
          tiltAngleIncremental: Math.random() * 0.07 + 0.02,
          tiltAngle: 0
        });
      }

      if (this.animationId) cancelAnimationFrame(this.animationId);
      this.animate();
    },

    stop: function() {
      if (this.animationId) {
        cancelAnimationFrame(this.animationId);
        this.animationId = null;
      }
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    },

    animate: function() {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      let active = false;

      this.particles.forEach(p => {
        p.tiltAngle += p.tiltAngleIncremental;
        p.y += (Math.cos(p.d) + 3 + p.r / 2) / 2;
        p.x += Math.sin(p.tiltAngle);
        p.tilt = Math.sin(p.tiltAngle - p.r / 2) * 15;

        if (p.y < this.canvas.height) {
          active = true;
        }

        this.ctx.beginPath();
        this.ctx.lineWidth = p.r;
        this.ctx.strokeStyle = p.color;
        this.ctx.moveTo(p.x + p.tilt + p.r / 2, p.y);
        this.ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r / 2);
        this.ctx.stroke();
      });

      if (active) {
        this.animationId = requestAnimationFrame(() => this.animate());
      }
    }
  };

  // Redimensionar canvas si la pantalla cambia
  window.addEventListener("resize", () => {
    if (confettiEffect.animationId) {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
  });
}
