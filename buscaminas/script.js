const difficulties = {
    easy: { rows: 8, cols: 8, mines: 10 },
    medium: { rows: 10, cols: 10, mines: 15 },
    hard: { rows: 12, cols: 12, mines: 25 }
};

let currentDiff = 'easy';
let board = [];
let gameStarted = false;
let gameOver = false;
let minesLeft = 0;
let cellsRevealed = 0;
let timerInterval = null;
let seconds = 0;

// DOM Elements
const boardEl = document.getElementById('game-board');
const flagCountEl = document.getElementById('flag-count');
const timerEl = document.getElementById('timer');
const difficultySelect = document.getElementById('difficulty');
const restartBtn = document.getElementById('restart-btn');
const modal = document.getElementById('game-over-modal');
const modalTitle = document.getElementById('modal-title');
const modalMessage = document.getElementById('modal-message');
const modalRestartBtn = document.getElementById('modal-restart-btn');

function init() {
    // Bind events
    difficultySelect.addEventListener('change', (e) => {
        currentDiff = e.target.value;
        startNewGame();
    });
    
    restartBtn.addEventListener('click', startNewGame);
    modalRestartBtn.addEventListener('click', startNewGame);
    
    // Prevent context menu anywhere in the game board container
    document.querySelector('.game-board-container').addEventListener('contextmenu', e => e.preventDefault());
    
    startNewGame();
}

function startNewGame() {
    stopTimer();
    seconds = 0;
    updateTimerDisplay();
    
    gameStarted = false;
    gameOver = false;
    cellsRevealed = 0;
    const { rows, cols, mines } = difficulties[currentDiff];
    minesLeft = mines;
    updateFlagDisplay();
    
    modal.classList.add('hidden');
    
    // Set CSS grid size
    boardEl.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    
    createBoard(rows, cols);
    renderBoard();
}

function createBoard(rows, cols) {
    board = [];
    for (let r = 0; r < rows; r++) {
        const row = [];
        for (let c = 0; c < cols; c++) {
            row.push({
                r, c,
                isMine: false,
                isRevealed: false,
                isFlagged: false,
                neighborCount: 0
            });
        }
        board.push(row);
    }
}

function placeMines(firstRow, firstCol) {
    const { rows, cols, mines } = difficulties[currentDiff];
    let minesPlaced = 0;
    
    while (minesPlaced < mines) {
        const r = Math.floor(Math.random() * rows);
        const c = Math.floor(Math.random() * cols);
        
        // Don't place mine on the first clicked cell or its immediate neighbors to ensure a good start
        const isFirstClickArea = Math.abs(r - firstRow) <= 1 && Math.abs(c - firstCol) <= 1;
        
        if (!board[r][c].isMine && !isFirstClickArea) {
            board[r][c].isMine = true;
            minesPlaced++;
        }
    }
    
    calculateNeighbors();
}

function calculateNeighbors() {
    const { rows, cols } = difficulties[currentDiff];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (board[r][c].isMine) continue;
            
            let count = 0;
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    const nr = r + dr;
                    const nc = c + dc;
                    if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && board[nr][nc].isMine) {
                        count++;
                    }
                }
            }
            board[r][c].neighborCount = count;
        }
    }
}

function renderBoard() {
    boardEl.innerHTML = '';
    const { rows, cols } = difficulties[currentDiff];
    
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const cellEl = document.createElement('div');
            cellEl.classList.add('cell');
            cellEl.dataset.r = r;
            cellEl.dataset.c = c;
            
            cellEl.addEventListener('mousedown', (e) => {
                if (e.button === 0) handleLeftClick(r, c); // Left click
                if (e.button === 2) handleRightClick(r, c); // Right click
            });
            
            boardEl.appendChild(cellEl);
        }
    }
}

function getCellEl(r, c) {
    const { cols } = difficulties[currentDiff];
    return boardEl.children[r * cols + c];
}

function handleLeftClick(r, c) {
    if (gameOver || board[r][c].isFlagged || board[r][c].isRevealed) return;
    
    if (!gameStarted) {
        gameStarted = true;
        startTimer();
        placeMines(r, c);
    }
    
    revealCell(r, c);
    checkWin();
}

function handleRightClick(r, c) {
    if (gameOver || board[r][c].isRevealed) return;
    
    const cell = board[r][c];
    if (!cell.isFlagged && minesLeft > 0) {
        cell.isFlagged = true;
        minesLeft--;
        const el = getCellEl(r, c);
        el.classList.add('flagged');
        el.textContent = '🚩';
    } else if (cell.isFlagged) {
        cell.isFlagged = false;
        minesLeft++;
        const el = getCellEl(r, c);
        el.classList.remove('flagged');
        el.textContent = '';
    }
    
    updateFlagDisplay();
}

function revealCell(r, c) {
    const cell = board[r][c];
    if (cell.isRevealed || cell.isFlagged) return;
    
    cell.isRevealed = true;
    cellsRevealed++;
    
    const el = getCellEl(r, c);
    el.classList.add('revealed');
    
    if (cell.isMine) {
        el.classList.add('mine');
        el.textContent = '💣';
        createExplosion(el);
        triggerGameOver(false);
        return;
    }
    
    if (cell.neighborCount > 0) {
        el.dataset.value = cell.neighborCount;
        el.textContent = cell.neighborCount;
    } else {
        // Flood fill empty cells
        const { rows, cols } = difficulties[currentDiff];
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                const nr = r + dr;
                const nc = c + dc;
                if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
                    revealCell(nr, nc);
                }
            }
        }
    }
}

function checkWin() {
    if (gameOver) return;
    const { rows, cols, mines } = difficulties[currentDiff];
    if (cellsRevealed === (rows * cols) - mines) {
        triggerGameOver(true);
    }
}

function triggerGameOver(win) {
    gameOver = true;
    stopTimer();
    
    if (win) {
        setTimeout(() => showModal(true), 1200);
        return;
    }
    
    // Reveal all mines and false flags
    const { rows, cols } = difficulties[currentDiff];
    const unrevealedMines = [];
    
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const cell = board[r][c];
            if (cell.isMine) {
                if (!cell.isFlagged && !cell.isRevealed) {
                    unrevealedMines.push({r, c});
                }
            } else if (cell.isFlagged) {
                const el = getCellEl(r, c);
                el.classList.add('revealed');
                el.style.backgroundColor = 'rgba(239, 68, 68, 0.4)'; // Wrong flag
                el.textContent = '❌';
            }
        }
    }
    
    unrevealedMines.sort(() => Math.random() - 0.5); // Shuffle for random explosion order
    
    unrevealedMines.forEach((mine, index) => {
        setTimeout(() => {
            const el = getCellEl(mine.r, mine.c);
            el.classList.add('revealed', 'mine');
            el.textContent = '💣';
            createExplosion(el);
        }, 100 * (index + 1)); // Sequentially explode
    });
    
    setTimeout(() => {
        showModal(false);
    }, 100 * unrevealedMines.length + 800);
}

function showModal(win) {
    modalTitle.textContent = win ? '¡Ganaste!' : '¡Game Over!';
    modalTitle.className = win ? 'win-title' : 'lose-title';
    modalMessage.textContent = win 
        ? `¡Despejaste el campo en ${seconds} segundos!` 
        : 'Pisaste una mina... ¡Inténtalo de nuevo!';
    modal.classList.remove('hidden');
}

function createExplosion(cellEl) {
    const rect = cellEl.getBoundingClientRect();
    const explosion = document.createElement('div');
    explosion.classList.add('explosion-effect');
    explosion.style.left = `${rect.left + rect.width / 2}px`;
    explosion.style.top = `${rect.top + rect.height / 2}px`;
    document.body.appendChild(explosion);
    
    for (let i = 0; i < 8; i++) {
        const particle = document.createElement('div');
        particle.classList.add('particle');
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 60 + 20;
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;
        
        particle.style.setProperty('--vx', `${vx}px`);
        particle.style.setProperty('--vy', `${vy}px`);
        
        explosion.appendChild(particle);
    }
    
    setTimeout(() => {
        explosion.remove();
    }, 600);
}

function startTimer() {
    timerInterval = setInterval(() => {
        seconds++;
        if (seconds > 999) seconds = 999;
        updateTimerDisplay();
    }, 1000);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

function updateTimerDisplay() {
    timerEl.textContent = seconds.toString().padStart(3, '0');
}

function updateFlagDisplay() {
    flagCountEl.textContent = minesLeft.toString().padStart(3, '0');
}

// Start
init();
