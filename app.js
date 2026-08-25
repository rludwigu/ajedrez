"use strict";

const PIECES = {
  K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙",
  k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟",
};

const PIECE_VALUE = { p: 100, n: 320, b: 335, r: 500, q: 900, k: 20000 };
const LEVEL_NAMES = { basic: "Básico", intermediate: "Intermedio", advanced: "Avanzado" };
const FILES = "abcdefgh";
const PROMOTIONS = ["q", "r", "b", "n"];

const setupScreen = document.querySelector("#setupScreen");
const gameScreen = document.querySelector("#gameScreen");
const gameSetup = document.querySelector("#gameSetup");
const boardElement = document.querySelector("#chessboard");
const gameStatus = document.querySelector("#gameStatus");
const statusIcon = document.querySelector("#statusIcon");
const moveHistory = document.querySelector("#moveHistory");
const moveCount = document.querySelector("#moveCount");
const historyBackButton = document.querySelector("#historyBackButton");
const historyForwardButton = document.querySelector("#historyForwardButton");
const historyPosition = document.querySelector("#historyPosition");
const undoButton = document.querySelector("#undoButton");
const flipButton = document.querySelector("#flipButton");
const newGameButton = document.querySelector("#newGameButton");
const botThinkingElement = document.querySelector("#botThinking");
const playerBar = document.querySelector("#playerBar");
const opponentBar = document.querySelector("#opponentBar");
const colorLabel = document.querySelector("#colorLabel");
const levelBadge = document.querySelector("#levelBadge");
const playerCaptured = document.querySelector("#playerCaptured");
const botCaptured = document.querySelector("#botCaptured");
const promotionPicker = document.querySelector("#promotionPicker");
const resultModal = document.querySelector("#resultModal");
const resultPiece = document.querySelector("#resultPiece");
const resultTitle = document.querySelector("#resultTitle");
const resultText = document.querySelector("#resultText");
const playAgainButton = document.querySelector("#playAgainButton");
const closeResultButton = document.querySelector("#closeResultButton");

let game = createInitialGame();
let playerColor = "w";
let botColor = "b";
let difficulty = "intermediate";
let selectedSquare = null;
let selectedMoves = [];
let boardFlipped = false;
let botThinking = false;
let gameOver = false;
let botTimer = null;
let viewedPly = 0;
let resultAnnounced = false;

function createInitialGame() {
  return {
    board: [
      "r", "n", "b", "q", "k", "b", "n", "r",
      "p", "p", "p", "p", "p", "p", "p", "p",
      null, null, null, null, null, null, null, null,
      null, null, null, null, null, null, null, null,
      null, null, null, null, null, null, null, null,
      null, null, null, null, null, null, null, null,
      "P", "P", "P", "P", "P", "P", "P", "P",
      "R", "N", "B", "Q", "K", "B", "N", "R",
    ],
    sideToMove: "w",
    castling: { K: true, Q: true, k: true, q: true },
    enPassant: null,
    halfmove: 0,
    fullmove: 1,
    history: [],
    lastMove: null,
  };
}

function pieceColor(piece) {
  if (!piece) return null;
  return piece === piece.toUpperCase() ? "w" : "b";
}

function opponent(color) {
  return color === "w" ? "b" : "w";
}

function rowOf(index) { return Math.floor(index / 8); }
function colOf(index) { return index % 8; }
function indexOf(row, col) { return row * 8 + col; }
function inside(row, col) { return row >= 0 && row < 8 && col >= 0 && col < 8; }
function squareName(index) { return `${FILES[colOf(index)]}${8 - rowOf(index)}`; }

function cloneForSearch(source) {
  return {
    board: [...source.board],
    sideToMove: source.sideToMove,
    castling: { ...source.castling },
    enPassant: source.enPassant,
    halfmove: source.halfmove,
    fullmove: source.fullmove,
    history: [],
    lastMove: source.lastMove ? { ...source.lastMove } : null,
  };
}

function snapshot(source) {
  return {
    board: [...source.board],
    sideToMove: source.sideToMove,
    castling: { ...source.castling },
    enPassant: source.enPassant,
    halfmove: source.halfmove,
    fullmove: source.fullmove,
    lastMove: source.lastMove ? { ...source.lastMove } : null,
  };
}

function restoreSnapshot(source, saved) {
  source.board = [...saved.board];
  source.sideToMove = saved.sideToMove;
  source.castling = { ...saved.castling };
  source.enPassant = saved.enPassant;
  source.halfmove = saved.halfmove;
  source.fullmove = saved.fullmove;
  source.lastMove = saved.lastMove ? { ...saved.lastMove } : null;
}

function isSquareAttacked(position, square, byColor) {
  const board = position.board;
  const row = rowOf(square);
  const col = colOf(square);

  const pawnSourceRow = row + (byColor === "w" ? 1 : -1);
  const pawn = byColor === "w" ? "P" : "p";
  for (const dc of [-1, 1]) {
    const sourceCol = col + dc;
    if (inside(pawnSourceRow, sourceCol) && board[indexOf(pawnSourceRow, sourceCol)] === pawn) return true;
  }

  const knight = byColor === "w" ? "N" : "n";
  const knightSteps = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
  for (const [dr, dc] of knightSteps) {
    const r = row + dr;
    const c = col + dc;
    if (inside(r, c) && board[indexOf(r, c)] === knight) return true;
  }

  const directions = [
    [-1, 0, "rq"], [1, 0, "rq"], [0, -1, "rq"], [0, 1, "rq"],
    [-1, -1, "bq"], [-1, 1, "bq"], [1, -1, "bq"], [1, 1, "bq"],
  ];
  for (const [dr, dc, types] of directions) {
    let r = row + dr;
    let c = col + dc;
    while (inside(r, c)) {
      const piece = board[indexOf(r, c)];
      if (piece) {
        if (pieceColor(piece) === byColor && types.includes(piece.toLowerCase())) return true;
        break;
      }
      r += dr;
      c += dc;
    }
  }

  const king = byColor === "w" ? "K" : "k";
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (dr === 0 && dc === 0) continue;
      const r = row + dr;
      const c = col + dc;
      if (inside(r, c) && board[indexOf(r, c)] === king) return true;
    }
  }
  return false;
}

function kingSquare(position, color) {
  return position.board.indexOf(color === "w" ? "K" : "k");
}

function isInCheck(position, color) {
  const square = kingSquare(position, color);
  return square >= 0 && isSquareAttacked(position, square, opponent(color));
}

function addPawnMove(moves, from, to, isCapture, color, extras = {}) {
  const promotionRow = color === "w" ? 0 : 7;
  if (rowOf(to) === promotionRow) {
    for (const promotion of PROMOTIONS) moves.push({ from, to, piece: "p", capture: isCapture, promotion, ...extras });
  } else {
    moves.push({ from, to, piece: "p", capture: isCapture, ...extras });
  }
}

function generatePseudoMoves(position) {
  const moves = [];
  const board = position.board;
  const color = position.sideToMove;

  for (let from = 0; from < 64; from += 1) {
    const piece = board[from];
    if (!piece || pieceColor(piece) !== color) continue;
    const type = piece.toLowerCase();
    const row = rowOf(from);
    const col = colOf(from);

    if (type === "p") {
      const direction = color === "w" ? -1 : 1;
      const startRow = color === "w" ? 6 : 1;
      const nextRow = row + direction;
      if (inside(nextRow, col) && !board[indexOf(nextRow, col)]) {
        addPawnMove(moves, from, indexOf(nextRow, col), false, color);
        const doubleRow = row + direction * 2;
        if (row === startRow && !board[indexOf(doubleRow, col)]) {
          moves.push({ from, to: indexOf(doubleRow, col), piece: "p", doublePawn: true });
        }
      }
      for (const dc of [-1, 1]) {
        const captureCol = col + dc;
        if (!inside(nextRow, captureCol)) continue;
        const to = indexOf(nextRow, captureCol);
        if (board[to] && pieceColor(board[to]) !== color) addPawnMove(moves, from, to, true, color);
        if (to === position.enPassant) addPawnMove(moves, from, to, true, color, { enPassant: true });
      }
      continue;
    }

    if (type === "n") {
      const steps = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
      for (const [dr, dc] of steps) {
        const r = row + dr;
        const c = col + dc;
        if (!inside(r, c)) continue;
        const to = indexOf(r, c);
        if (!board[to] || pieceColor(board[to]) !== color) moves.push({ from, to, piece: type, capture: Boolean(board[to]) });
      }
      continue;
    }

    if (type === "b" || type === "r" || type === "q") {
      const directions = [];
      if (type === "b" || type === "q") directions.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
      if (type === "r" || type === "q") directions.push([-1, 0], [1, 0], [0, -1], [0, 1]);
      for (const [dr, dc] of directions) {
        let r = row + dr;
        let c = col + dc;
        while (inside(r, c)) {
          const to = indexOf(r, c);
          if (!board[to]) {
            moves.push({ from, to, piece: type, capture: false });
          } else {
            if (pieceColor(board[to]) !== color) moves.push({ from, to, piece: type, capture: true });
            break;
          }
          r += dr;
          c += dc;
        }
      }
      continue;
    }

    if (type === "k") {
      for (let dr = -1; dr <= 1; dr += 1) {
        for (let dc = -1; dc <= 1; dc += 1) {
          if (dr === 0 && dc === 0) continue;
          const r = row + dr;
          const c = col + dc;
          if (!inside(r, c)) continue;
          const to = indexOf(r, c);
          if (!board[to] || pieceColor(board[to]) !== color) moves.push({ from, to, piece: type, capture: Boolean(board[to]) });
        }
      }

      const enemy = opponent(color);
      if (!isInCheck(position, color)) {
        if (color === "w" && from === 60) {
          if (position.castling.K && board[61] === null && board[62] === null && board[63] === "R" &&
              !isSquareAttacked(position, 61, enemy) && !isSquareAttacked(position, 62, enemy)) {
            moves.push({ from: 60, to: 62, piece: "k", castle: "K" });
          }
          if (position.castling.Q && board[59] === null && board[58] === null && board[57] === null && board[56] === "R" &&
              !isSquareAttacked(position, 59, enemy) && !isSquareAttacked(position, 58, enemy)) {
            moves.push({ from: 60, to: 58, piece: "k", castle: "Q" });
          }
        }
        if (color === "b" && from === 4) {
          if (position.castling.k && board[5] === null && board[6] === null && board[7] === "r" &&
              !isSquareAttacked(position, 5, enemy) && !isSquareAttacked(position, 6, enemy)) {
            moves.push({ from: 4, to: 6, piece: "k", castle: "k" });
          }
          if (position.castling.q && board[3] === null && board[2] === null && board[1] === null && board[0] === "r" &&
              !isSquareAttacked(position, 3, enemy) && !isSquareAttacked(position, 2, enemy)) {
            moves.push({ from: 4, to: 2, piece: "k", castle: "q" });
          }
        }
      }
    }
  }
  return moves;
}

function generateLegalMoves(position) {
  const movingColor = position.sideToMove;
  return generatePseudoMoves(position).filter((move) => {
    const next = cloneForSearch(position);
    applyMove(next, move, false);
    return !isInCheck(next, movingColor);
  });
}

function updateCastlingRights(position, piece, from, to, capturedPiece) {
  if (piece === "K") { position.castling.K = false; position.castling.Q = false; }
  if (piece === "k") { position.castling.k = false; position.castling.q = false; }
  if (piece === "R" && from === 63) position.castling.K = false;
  if (piece === "R" && from === 56) position.castling.Q = false;
  if (piece === "r" && from === 7) position.castling.k = false;
  if (piece === "r" && from === 0) position.castling.q = false;
  if (capturedPiece === "R" && to === 63) position.castling.K = false;
  if (capturedPiece === "R" && to === 56) position.castling.Q = false;
  if (capturedPiece === "r" && to === 7) position.castling.k = false;
  if (capturedPiece === "r" && to === 0) position.castling.q = false;
}

function notationForMove(move, before, after, capturedPiece) {
  const moved = before.board[move.from];
  const type = moved.toLowerCase();
  const pieceLetter = type === "p" ? "" : type.toUpperCase();
  const pawnFile = type === "p" && (capturedPiece || move.enPassant) ? FILES[colOf(move.from)] : "";
  const capture = capturedPiece || move.enPassant ? "x" : "";
  const promotion = move.promotion ? `=${move.promotion.toUpperCase()}` : "";
  const enemy = after.sideToMove;
  let suffix = "";
  if (isInCheck(after, enemy)) suffix = generateLegalMoves(after).length === 0 ? "#" : "+";
  if (move.castle) return `${move.to > move.from ? "O-O" : "O-O-O"}${suffix}`;

  let disambiguation = "";
  if (type !== "p" && type !== "k") {
    const alternatives = generateLegalMoves(before).filter((candidate) =>
      candidate.from !== move.from && candidate.to === move.to &&
      before.board[candidate.from]?.toLowerCase() === type
    );
    if (alternatives.length) {
      const sameFile = alternatives.some((candidate) => colOf(candidate.from) === colOf(move.from));
      const sameRank = alternatives.some((candidate) => rowOf(candidate.from) === rowOf(move.from));
      if (!sameFile) disambiguation = FILES[colOf(move.from)];
      else if (!sameRank) disambiguation = String(8 - rowOf(move.from));
      else disambiguation = squareName(move.from);
    }
  }
  return `${pieceLetter}${disambiguation}${pawnFile}${capture}${squareName(move.to)}${promotion}${suffix}`;
}

function applyMove(position, move, record = true) {
  const before = record ? snapshot(position) : null;
  const movingColor = position.sideToMove;
  const piece = position.board[move.from];
  const capturedPiece = move.enPassant
    ? position.board[move.to + (movingColor === "w" ? 8 : -8)]
    : position.board[move.to];

  position.board[move.to] = piece;
  position.board[move.from] = null;

  if (move.enPassant) position.board[move.to + (movingColor === "w" ? 8 : -8)] = null;
  if (move.castle) {
    const rookFrom = move.to > move.from ? move.from + 3 : move.from - 4;
    const rookTo = move.to > move.from ? move.from + 1 : move.from - 1;
    position.board[rookTo] = position.board[rookFrom];
    position.board[rookFrom] = null;
  }
  if (move.promotion) position.board[move.to] = movingColor === "w" ? move.promotion.toUpperCase() : move.promotion;

  updateCastlingRights(position, piece, move.from, move.to, capturedPiece);
  position.enPassant = move.doublePawn ? (move.from + move.to) / 2 : null;
  position.halfmove = piece.toLowerCase() === "p" || capturedPiece ? 0 : position.halfmove + 1;
  if (movingColor === "b") position.fullmove += 1;
  position.sideToMove = opponent(movingColor);
  position.lastMove = { from: move.from, to: move.to };

  if (record) {
    const notation = notationForMove(move, before, position, capturedPiece);
    position.history.push({ snapshot: before, move: { ...move }, notation, color: movingColor, captured: capturedPiece });
  }
}

function evaluatePosition(position, perspective) {
  let score = 0;
  for (let square = 0; square < 64; square += 1) {
    const piece = position.board[square];
    if (!piece) continue;
    const color = pieceColor(piece);
    const type = piece.toLowerCase();
    let value = PIECE_VALUE[type];
    const row = rowOf(square);
    const col = colOf(square);
    const centerDistance = Math.abs(3.5 - row) + Math.abs(3.5 - col);
    if (type === "n" || type === "b") value += Math.round((7 - centerDistance) * 4);
    if (type === "p") {
      const advance = color === "w" ? 6 - row : row - 1;
      value += advance * 7;
    }
    score += color === perspective ? value : -value;
  }
  if (isInCheck(position, opponent(perspective))) score += 22;
  if (isInCheck(position, perspective)) score -= 22;
  return score;
}

function moveOrderingScore(position, move) {
  const victim = move.enPassant ? "p" : position.board[move.to]?.toLowerCase();
  const attacker = position.board[move.from]?.toLowerCase();
  let score = victim ? 10 * PIECE_VALUE[victim] - PIECE_VALUE[attacker] : 0;
  if (move.promotion) score += PIECE_VALUE[move.promotion];
  if (move.castle) score += 70;
  return score;
}

function minimax(position, depth, alpha, beta, perspective) {
  const moves = generateLegalMoves(position);
  if (moves.length === 0) {
    if (isInCheck(position, position.sideToMove)) {
      return position.sideToMove === perspective ? -100000 - depth : 100000 + depth;
    }
    return 0;
  }
  if (depth === 0) return evaluatePosition(position, perspective);

  moves.sort((a, b) => moveOrderingScore(position, b) - moveOrderingScore(position, a));
  const maximizing = position.sideToMove === perspective;
  if (maximizing) {
    let best = -Infinity;
    for (const move of moves) {
      const next = cloneForSearch(position);
      applyMove(next, move, false);
      best = Math.max(best, minimax(next, depth - 1, alpha, beta, perspective));
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  }

  let best = Infinity;
  for (const move of moves) {
    const next = cloneForSearch(position);
    applyMove(next, move, false);
    best = Math.min(best, minimax(next, depth - 1, alpha, beta, perspective));
    beta = Math.min(beta, best);
    if (beta <= alpha) break;
  }
  return best;
}

function chooseBotMove(position) {
  const legalMoves = generateLegalMoves(position);
  if (legalMoves.length === 0) return null;

  if (difficulty === "basic") {
    const weighted = legalMoves.flatMap((move) => Array(move.capture || move.promotion ? 3 : 1).fill(move));
    return weighted[Math.floor(Math.random() * weighted.length)];
  }

  const depth = difficulty === "advanced" ? 3 : 2;
  const scored = legalMoves.map((move) => {
    const next = cloneForSearch(position);
    applyMove(next, move, false);
    return { move, score: minimax(next, depth - 1, -Infinity, Infinity, botColor) };
  }).sort((a, b) => b.score - a.score);

  if (difficulty === "intermediate") {
    const candidates = scored.filter((entry) => entry.score >= scored[0].score - 45).slice(0, 4);
    return candidates[Math.floor(Math.random() * candidates.length)].move;
  }
  return scored[0].move;
}

function renderBoard() {
  boardElement.innerHTML = "";
  const position = displayedPosition();
  const displayOrder = boardFlipped
    ? Array.from({ length: 64 }, (_, i) => 63 - i)
    : Array.from({ length: 64 }, (_, i) => i);
  const checkedKing = isInCheck(position, position.sideToMove) ? kingSquare(position, position.sideToMove) : -1;
  const legalTargets = new Map();
  for (const move of selectedMoves) {
    if (!legalTargets.has(move.to)) legalTargets.set(move.to, move);
  }

  for (const index of displayOrder) {
    const row = rowOf(index);
    const col = colOf(index);
    const square = document.createElement("button");
    square.type = "button";
    square.className = `square ${(row + col) % 2 === 0 ? "light" : "dark"}`;
    square.dataset.index = String(index);
    square.setAttribute("role", "gridcell");
    square.setAttribute("aria-label", `${squareName(index)}${position.board[index] ? `, ${pieceAriaName(position.board[index])}` : ""}`);

    if (selectedSquare === index) square.classList.add("selected");
    if (position.lastMove && (position.lastMove.from === index || position.lastMove.to === index)) square.classList.add("last-move");
    if (checkedKing === index) square.classList.add("in-check");

    const piece = position.board[index];
    if (piece) {
      const pieceSpan = document.createElement("span");
      pieceSpan.className = `piece piece-${pieceColor(piece) === "w" ? "white" : "black"}`;
      pieceSpan.textContent = PIECES[piece];
      pieceSpan.setAttribute("aria-hidden", "true");
      square.append(pieceSpan);
    }

    if (legalTargets.has(index)) {
      const marker = document.createElement("span");
      marker.className = position.board[index] || legalTargets.get(index).enPassant ? "capture-ring" : "legal-dot";
      marker.setAttribute("aria-hidden", "true");
      square.append(marker);
    }

    const visualRow = Math.floor(displayOrder.indexOf(index) / 8);
    const visualCol = displayOrder.indexOf(index) % 8;
    if (visualCol === 0) {
      const rank = document.createElement("span");
      rank.className = "coord coord-rank";
      rank.textContent = String(8 - row);
      square.append(rank);
    }
    if (visualRow === 7) {
      const file = document.createElement("span");
      file.className = "coord coord-file";
      file.textContent = FILES[col];
      square.append(file);
    }
    boardElement.append(square);
  }
}

function pieceAriaName(piece) {
  const names = { p: "peón", n: "caballo", b: "alfil", r: "torre", q: "dama", k: "rey" };
  return `${names[piece.toLowerCase()]} ${pieceColor(piece) === "w" ? "blanco" : "negro"}`;
}

function isViewingLivePosition() {
  return viewedPly === game.history.length;
}

function displayedPosition() {
  if (isViewingLivePosition() || game.history.length === 0) return game;
  return game.history[viewedPly].snapshot;
}

function renderHistory() {
  if (game.history.length === 0) {
    moveHistory.innerHTML = '<div class="empty-history"><span aria-hidden="true">♙</span><p>La partida está por comenzar.</p></div>';
    moveCount.textContent = "0 jugadas";
    return;
  }
  const rows = [];
  for (let i = 0; i < game.history.length; i += 2) {
    rows.push({ white: game.history[i]?.notation || "", black: game.history[i + 1]?.notation || "" });
  }
  moveHistory.innerHTML = rows.map((row, index) => `
    <div class="move-row ${index === rows.length - 1 ? "latest" : ""}">
      <span>${index + 1}.</span>
      <span class="${viewedPly === index * 2 + 1 ? "viewed-move" : ""}">${row.white}</span>
      <span class="${viewedPly === index * 2 + 2 ? "viewed-move" : ""}">${row.black}</span>
    </div>`).join("");
  moveCount.textContent = `${game.history.length} ${game.history.length === 1 ? "jugada" : "jugadas"}`;
  moveHistory.scrollTop = moveHistory.scrollHeight;
}

function capturedBy(color) {
  const captured = game.history.slice(0, viewedPly).filter((entry) => entry.color === color && entry.captured).map((entry) => entry.captured);
  const order = { q: 0, r: 1, b: 2, n: 3, p: 4 };
  captured.sort((a, b) => order[a.toLowerCase()] - order[b.toLowerCase()]);
  return captured.map((piece) => PIECES[piece]).join("");
}

function positionKey(position) {
  const board = position.board.map((piece) => piece || ".").join("");
  const castling = Object.entries(position.castling).filter(([, allowed]) => allowed).map(([side]) => side).join("") || "-";
  return `${board}|${position.sideToMove}|${castling}|${position.enPassant ?? "-"}`;
}

function isThreefoldRepetition() {
  const current = positionKey(game);
  let occurrences = 1;
  for (const entry of game.history) {
    if (positionKey(entry.snapshot) === current) occurrences += 1;
  }
  return occurrences >= 3;
}

function isInsufficientMaterial(position) {
  const nonKings = [];
  for (let square = 0; square < 64; square += 1) {
    const piece = position.board[square];
    if (piece && piece.toLowerCase() !== "k") nonKings.push({ piece, square });
  }
  if (nonKings.length === 0) return true;
  if (nonKings.length === 1 && ["b", "n"].includes(nonKings[0].piece.toLowerCase())) return true;
  if (nonKings.every(({ piece }) => piece.toLowerCase() === "b")) {
    return nonKings.every(({ square }) => (rowOf(square) + colOf(square)) % 2 === (rowOf(nonKings[0].square) + colOf(nonKings[0].square)) % 2);
  }
  return false;
}

function renderCaptured() {
  playerCaptured.textContent = capturedBy(playerColor);
  botCaptured.textContent = capturedBy(botColor);
}

function renderReplayControls() {
  historyBackButton.disabled = botThinking || viewedPly <= 0;
  historyForwardButton.disabled = botThinking || viewedPly >= game.history.length;
  historyPosition.textContent = isViewingLivePosition()
    ? "Posición actual"
    : viewedPly === 0
      ? "Posición inicial"
      : `Jugada ${viewedPly} de ${game.history.length}`;
}

function updateStatus() {
  if (!isViewingLivePosition()) {
    gameStatus.textContent = viewedPly === 0 ? "Posición inicial" : `Revisando jugada ${viewedPly}`;
    statusIcon.textContent = "↶";
    playerBar.classList.remove("active-player");
    opponentBar.classList.remove("active-player");
    document.querySelector(".turn-marker").textContent = "Modo revisión";
    botThinkingElement.hidden = true;
    undoButton.disabled = true;
    return;
  }

  const legal = generateLegalMoves(game);
  const checked = isInCheck(game, game.sideToMove);
  const repeated = isThreefoldRepetition();
  const insufficient = isInsufficientMaterial(game);
  gameOver = legal.length === 0 || game.halfmove >= 100 || repeated || insufficient;

  if (legal.length === 0) {
    if (checked) {
      const playerWon = game.sideToMove === botColor;
      gameStatus.textContent = playerWon ? "¡Jaque mate!" : "La máquina gana";
      statusIcon.textContent = playerWon ? "♛" : "♚";
      announceResult(playerWon ? "win" : "loss");
    } else {
      gameStatus.textContent = "Tablas por ahogado";
      statusIcon.textContent = "½";
      announceResult("draw");
    }
  } else if (game.halfmove >= 100) {
    gameStatus.textContent = "Tablas: regla de 50 movimientos";
    statusIcon.textContent = "½";
    announceResult("draw");
  } else if (repeated) {
    gameStatus.textContent = "Tablas por repetición";
    statusIcon.textContent = "½";
    announceResult("draw");
  } else if (insufficient) {
    gameStatus.textContent = "Tablas: material insuficiente";
    statusIcon.textContent = "½";
    announceResult("draw");
  } else if (botThinking) {
    gameStatus.textContent = "La máquina piensa…";
    statusIcon.textContent = "♞";
  } else if (game.sideToMove === playerColor) {
    gameStatus.textContent = checked ? "Estás en jaque" : "Tu turno";
    statusIcon.textContent = checked ? "!" : (playerColor === "w" ? "♙" : "♟");
  } else {
    gameStatus.textContent = checked ? "Máquina en jaque" : "Turno de la máquina";
    statusIcon.textContent = "♞";
  }

  const playerActive = !gameOver && game.sideToMove === playerColor && !botThinking;
  playerBar.classList.toggle("active-player", playerActive);
  opponentBar.classList.toggle("active-player", !playerActive && !gameOver);
  document.querySelector(".turn-marker").textContent = playerActive ? "Tu turno" : gameOver ? "Finalizada" : "En espera";
  botThinkingElement.hidden = !botThinking;
  undoButton.disabled = botThinking || game.history.length < 2;
}

function renderAll() {
  renderBoard();
  renderHistory();
  renderCaptured();
  renderReplayControls();
  updateStatus();
}

function handleSquareClick(event) {
  const square = event.target.closest(".square");
  if (!square || !isViewingLivePosition() || botThinking || gameOver || game.sideToMove !== playerColor || !promotionPicker.hidden) return;
  const index = Number(square.dataset.index);
  const piece = game.board[index];

  if (selectedSquare !== null) {
    const matching = selectedMoves.filter((move) => move.to === index);
    if (matching.length > 0) {
      if (matching.length > 1 && matching.some((move) => move.promotion)) {
        showPromotionPicker(matching);
      } else {
        makeHumanMove(matching[0]);
      }
      return;
    }
  }

  if (piece && pieceColor(piece) === playerColor) {
    selectedSquare = index;
    selectedMoves = generateLegalMoves(game).filter((move) => move.from === index);
  } else {
    selectedSquare = null;
    selectedMoves = [];
  }
  renderBoard();
}

function showPromotionPicker(moves) {
  promotionPicker.innerHTML = "";
  const color = playerColor;
  for (const promotion of PROMOTIONS) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = PIECES[color === "w" ? promotion.toUpperCase() : promotion];
    button.setAttribute("aria-label", `Promocionar a ${pieceAriaName(color === "w" ? promotion.toUpperCase() : promotion).split(" ")[0]}`);
    button.addEventListener("click", () => {
      promotionPicker.hidden = true;
      makeHumanMove(moves.find((move) => move.promotion === promotion));
    });
    promotionPicker.append(button);
  }
  promotionPicker.hidden = false;
}

function makeHumanMove(move) {
  applyMove(game, move, true);
  viewedPly = game.history.length;
  selectedSquare = null;
  selectedMoves = [];
  renderAll();
  if (!gameOver) scheduleBotMove();
}

function scheduleBotMove(delay = 520) {
  if (gameOver || game.sideToMove !== botColor) return;
  botThinking = true;
  renderReplayControls();
  updateStatus();
  clearTimeout(botTimer);
  botTimer = window.setTimeout(() => {
    const move = chooseBotMove(game);
    if (move) applyMove(game, move, true);
    viewedPly = game.history.length;
    botThinking = false;
    renderAll();
  }, delay);
}

function undoTurn() {
  if (!isViewingLivePosition() || botThinking || game.history.length < 2) return;
  resultModal.hidden = true;
  gameOver = false;
  resultAnnounced = false;
  const movesToUndo = game.sideToMove === playerColor ? 2 : 1;
  for (let i = 0; i < movesToUndo && game.history.length > 0; i += 1) {
    const entry = game.history.pop();
    restoreSnapshot(game, entry.snapshot);
  }
  viewedPly = game.history.length;
  selectedSquare = null;
  selectedMoves = [];
  renderAll();
}

function navigateHistory(direction) {
  if (botThinking || game.history.length === 0) return;
  const nextPly = Math.max(0, Math.min(game.history.length, viewedPly + direction));
  if (nextPly === viewedPly) return;
  viewedPly = nextPly;
  selectedSquare = null;
  selectedMoves = [];
  promotionPicker.hidden = true;
  resultModal.hidden = true;
  renderAll();
}

function announceResult(result) {
  if (resultAnnounced) return;
  resultAnnounced = true;
  window.setTimeout(() => showResult(result), 420);
}

function showResult(result) {
  if (!gameOver) return;
  if (result === "win") {
    resultPiece.textContent = playerColor === "w" ? "♕" : "♛";
    resultTitle.textContent = "¡Victoria!";
    resultText.textContent = "Has dado jaque mate a la máquina. Una partida para recordar.";
  } else if (result === "loss") {
    resultPiece.textContent = "♚";
    resultTitle.textContent = "Buena partida";
    resultText.textContent = "La máquina ha dado jaque mate. Cada partida afina tu estrategia.";
  } else {
    resultPiece.textContent = "♔";
    resultTitle.textContent = "Tablas";
    resultText.textContent = "Ningún bando se lleva la victoria esta vez.";
  }
  resultModal.hidden = false;
}

function startGame(event) {
  event?.preventDefault();
  playerColor = new FormData(gameSetup).get("playerColor") || "w";
  botColor = opponent(playerColor);
  difficulty = new FormData(gameSetup).get("difficulty") || "intermediate";
  game = createInitialGame();
  selectedSquare = null;
  selectedMoves = [];
  boardFlipped = playerColor === "b";
  botThinking = false;
  gameOver = false;
  viewedPly = 0;
  resultAnnounced = false;
  clearTimeout(botTimer);
  resultModal.hidden = true;
  promotionPicker.hidden = true;
  colorLabel.textContent = playerColor === "w" ? "Blancas" : "Negras";
  levelBadge.textContent = LEVEL_NAMES[difficulty];
  setupScreen.hidden = true;
  gameScreen.hidden = false;
  renderAll();
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (botColor === "w") scheduleBotMove(700);
}

function returnToSetup() {
  clearTimeout(botTimer);
  botThinking = false;
  gameOver = true;
  resultModal.hidden = true;
  gameScreen.hidden = true;
  setupScreen.hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function syncOptionStyles(name, selector) {
  document.querySelectorAll(selector).forEach((option) => {
    option.classList.toggle("is-selected", option.querySelector(`input[name="${name}"]`).checked);
  });
}

gameSetup.addEventListener("change", (event) => {
  if (event.target.name === "playerColor") syncOptionStyles("playerColor", ".color-option");
  if (event.target.name === "difficulty") syncOptionStyles("difficulty", ".difficulty-option");
});
gameSetup.addEventListener("submit", startGame);
boardElement.addEventListener("click", handleSquareClick);
historyBackButton.addEventListener("click", () => navigateHistory(-1));
historyForwardButton.addEventListener("click", () => navigateHistory(1));
undoButton.addEventListener("click", undoTurn);
flipButton.addEventListener("click", () => { boardFlipped = !boardFlipped; renderBoard(); });
newGameButton.addEventListener("click", returnToSetup);
playAgainButton.addEventListener("click", returnToSetup);
closeResultButton.addEventListener("click", () => { resultModal.hidden = true; });
document.querySelector(".brand").addEventListener("click", (event) => {
  event.preventDefault();
  if (!gameScreen.hidden) returnToSetup();
});
