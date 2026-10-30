const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

// MIME types suportados
const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// Armazenamento em memória das salas
// Estrutura: { [roomId]: { board, players, turn, winner, winningLine, scores, clients, lastReaction, updatedAt } }
const rooms = new Map();

const WINNING_COMBOS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // Linhas
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // Colunas
  [0, 4, 8], [2, 4, 6]             // Diagonais
];

function checkWinner(board) {
  for (const combo of WINNING_COMBOS) {
    const [a, b, c] = combo;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], winningLine: combo };
    }
  }
  if (board.every(cell => cell !== null && cell !== '')) {
    return { winner: 'draw', winningLine: null };
  }
  return null;
}

function getOrCreateRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      id: roomId,
      board: Array(9).fill(''),
      players: {
        X: { id: null, name: 'Jogador 1 (X)', connected: false },
        O: { id: null, name: 'Jogador 2 (O)', connected: false }
      },
      turn: 'X',
      winner: null,
      winningLine: null,
      scores: { X: 0, O: 0, draws: 0 },
      clients: new Set(),
      lastReaction: null,
      updatedAt: Date.now()
    });
  }
  return rooms.get(roomId);
}

function sanitizeRoomData(room) {
  return {
    id: room.id,
    board: room.board,
    players: {
      X: { name: room.players.X.name, connected: room.players.X.connected, active: !!room.players.X.id },
      O: { name: room.players.O.name, connected: room.players.O.connected, active: !!room.players.O.id }
    },
    turn: room.turn,
    winner: room.winner,
    winningLine: room.winningLine,
    scores: room.scores,
    lastReaction: room.lastReaction
  };
}

function broadcastRoom(room) {
  room.updatedAt = Date.now();
  const data = JSON.stringify(sanitizeRoomData(room));
  const payload = `data: ${data}\n\n`;
  for (const client of room.clients) {
    try {
      client.res.write(payload);
    } catch {
      // Ignora erro de socket fechado
    }
  }
}

// Limpeza de salas inativas a cada 30 minutos (inativas há mais de 2 horas)
setInterval(() => {
  const now = Date.now();
  for (const [roomId, room] of rooms.entries()) {
    if (room.clients.size === 0 && now - room.updatedAt > 2 * 60 * 60 * 1000) {
      rooms.delete(roomId);
    }
  }
}, 30 * 60 * 1000);

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // SSE: Fluxo em tempo real de eventos do jogo
  if (pathname === '/api/stream') {
    const roomId = (parsedUrl.query.sala || 'principal').toString().trim().toLowerCase().slice(0, 32);
    const playerId = (parsedUrl.query.jogador || '').toString().trim().slice(0, 64);
    const playerName = (parsedUrl.query.nome || '').toString().trim().slice(0, 32);

    if (!playerId) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('ID de jogador necessário');
      return;
    }

    const room = getOrCreateRoom(roomId);

    // Configura headers do Server-Sent Events
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    res.write(': conexao-estabelecida\n\n');

    // Atribuição de vaga (X ou O)
    let assignedRole = null;
    if (room.players.X.id === playerId) {
      assignedRole = 'X';
      room.players.X.connected = true;
      if (playerName) room.players.X.name = playerName;
    } else if (room.players.O.id === playerId) {
      assignedRole = 'O';
      room.players.O.connected = true;
      if (playerName) room.players.O.name = playerName;
    } else if (!room.players.X.id) {
      assignedRole = 'X';
      room.players.X.id = playerId;
      room.players.X.connected = true;
      if (playerName) room.players.X.name = playerName;
    } else if (!room.players.O.id) {
      assignedRole = 'O';
      room.players.O.id = playerId;
      room.players.O.connected = true;
      if (playerName) room.players.O.name = playerName;
    } else {
      assignedRole = 'spectator';
    }

    // Notifica o cliente sobre seu papel
    res.write(`event: role\ndata: ${JSON.stringify({ role: assignedRole })}\n\n`);

    const client = { id: playerId, role: assignedRole, res };
    room.clients.add(client);

    // Envia estado atual da sala para todos
    broadcastRoom(room);

    // Keep-alive ping para manter conexões móveis vivas
    const pingInterval = setInterval(() => {
      try {
        res.write(': ping\n\n');
      } catch {
        clearInterval(pingInterval);
      }
    }, 15000);

    req.on('close', () => {
      clearInterval(pingInterval);
      room.clients.delete(client);
      if (room.players.X.id === playerId) {
        room.players.X.connected = false;
      }
      if (room.players.O.id === playerId) {
        room.players.O.connected = false;
      }
      broadcastRoom(room);
    });

    return;
  }

  // API de Ações: Jogadas, Reiniciar, Reações
  if (pathname === '/api/action' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 10240) req.destroy(); // Protege contra payloads grandes
    });

    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        const roomId = (data.sala || 'principal').toString().trim().toLowerCase().slice(0, 32);
        const playerId = (data.jogador || '').toString().trim();
        const action = data.action;

        if (!rooms.has(roomId)) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Sala não encontrada' }));
          return;
        }

        const room = rooms.get(roomId);
        let playerRole = null;
        if (room.players.X.id === playerId) playerRole = 'X';
        if (room.players.O.id === playerId) playerRole = 'O';

        if (action === 'move') {
          const index = parseInt(data.index, 10);
          if (isNaN(index) || index < 0 || index > 8) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Posição inválida' }));
            return;
          }

          // Validações de turno e jogada
          if (room.winner) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'A partida já terminou' }));
            return;
          }

          if (!playerRole) {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Apenas jogadores na partida podem jogar' }));
            return;
          }

          if (room.turn !== playerRole) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Não é a sua vez' }));
            return;
          }

          if (room.board[index] !== '') {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Casa já preenchida' }));
            return;
          }

          // Efetua a jogada
          room.board[index] = playerRole;

          // Verifica se houve vencedor ou empate
          const result = checkWinner(room.board);
          if (result) {
            room.winner = result.winner;
            room.winningLine = result.winningLine;
            if (result.winner === 'X') room.scores.X++;
            else if (result.winner === 'O') room.scores.O++;
            else if (result.winner === 'draw') room.scores.draws++;
          } else {
            room.turn = room.turn === 'X' ? 'O' : 'X';
          }

          broadcastRoom(room);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
          return;
        }

        if (action === 'restart') {
          // Reinicia tabuleiro mantendo placar
          room.board = Array(9).fill('');
          room.winner = null;
          room.winningLine = null;
          room.turn = 'X'; // Começa com X
          room.lastReaction = null;

          broadcastRoom(room);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
          return;
        }

        if (action === 'reaction') {
          const emoji = (data.emoji || '').slice(0, 10);
          if (emoji) {
            room.lastReaction = {
              emoji,
              playerRole: playerRole || 'espectador',
              time: Date.now()
            };
            broadcastRoom(room);
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
          return;
        }

        if (action === 'reset_scores') {
          room.scores = { X: 0, O: 0, draws: 0 };
          room.board = Array(9).fill('');
          room.winner = null;
          room.winningLine = null;
          room.turn = 'X';

          broadcastRoom(room);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
          return;
        }

        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Ação desconhecida' }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'JSON inválido' }));
      }
    });
    return;
  }

  // Servir arquivos estáticos (Frontend)
  let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  if (safePath === '/' || safePath === '') {
    safePath = '/index.html';
  }

  const filePath = path.join(PUBLIC_DIR, safePath);

  // Previne Directory Traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Acesso proibido');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Se não encontrou o arquivo, serve o index.html (SPA fallback)
      const indexPath = path.join(PUBLIC_DIR, 'index.html');
      fs.readFile(indexPath, (readErr, content) => {
        if (readErr) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=UTF-8' });
          res.end('Página não encontrada');
        } else {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=UTF-8' });
          res.end(content);
        }
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Erro interno do servidor');
        return;
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n===========================================`);
  console.log(`🎮 Jogo da Velha Online rodando com sucesso!`);
  console.log(`📡 Porta: ${PORT}`);
  console.log(`🌐 Local: http://localhost:${PORT}`);
  console.log(`📱 Pronto para ser compartilhado no Codespaces!`);
  console.log(`===========================================\n`);
});

