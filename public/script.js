(() => {
  // Configurações do Jogador e Sala
  const urlParams = new URLSearchParams(window.location.search);
  let roomId = urlParams.get('sala');

  if (!roomId) {
    // Se não tem sala na URL, gera um código amigável
    roomId = 'jogar-' + Math.floor(1000 + Math.random() * 9000);
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('sala', roomId);
    window.history.replaceState({}, '', newUrl.toString());
  }

  // ID persistente do jogador no navegador
  let playerId = localStorage.getItem('jdv_player_id');
  if (!playerId) {
    playerId = 'p_' + Math.random().toString(36).substring(2, 10);
    localStorage.setItem('jdv_player_id', playerId);
  }

  let playerName = localStorage.getItem('jdv_player_name');
  if (!playerName) {
    playerName = 'Jogador ' + Math.floor(10 + Math.random() * 90);
    localStorage.setItem('jdv_player_name', playerName);
  }

  let myRole = null; // 'X', 'O' ou 'spectator'
  let currentState = null;
  let soundEnabled = localStorage.getItem('jdv_sound') !== 'false';

  // Elementos do DOM
  const roomNameDisplay = document.getElementById('roomNameDisplay');
  const btnShareRoom = document.getElementById('btnShareRoom');
  const btnSound = document.getElementById('btnSound');
  const cardPlayerX = document.getElementById('cardPlayerX');
  const cardPlayerO = document.getElementById('cardPlayerO');
  const labelPlayerX = document.getElementById('labelPlayerX');
  const labelPlayerO = document.getElementById('labelPlayerO');
  const statusPlayerX = document.getElementById('statusPlayerX');
  const statusPlayerO = document.getElementById('statusPlayerO');
  const scoreX = document.getElementById('scoreX');
  const scoreO = document.getElementById('scoreO');
  const scoreDraws = document.getElementById('scoreDraws');
  const statusBanner = document.getElementById('statusBanner');
  const statusMessage = document.getElementById('statusMessage');
  const waitingSpinner = document.getElementById('waitingSpinner');
  const boardEl = document.getElementById('board');
  const cells = document.querySelectorAll('.cell');
  const gameActions = document.getElementById('gameActions');
  const btnRestart = document.getElementById('btnRestart');
  const btnResetScore = document.getElementById('btnResetScore');
  const myRoleBadge = document.getElementById('myRoleBadge');
  const btnChangeName = document.getElementById('btnChangeName');
  const shareModal = document.getElementById('shareModal');
  const shareUrlInput = document.getElementById('shareUrlInput');
  const btnCopyLink = document.getElementById('btnCopyLink');
  const btnWhatsApp = document.getElementById('btnWhatsApp');
  const btnCloseModal = document.getElementById('btnCloseModal');
  const reactionsOverlay = document.getElementById('reactionsOverlay');
  const reactionButtons = document.querySelectorAll('.btn-reaction');
  const confettiCanvas = document.getElementById('confettiCanvas');

  roomNameDisplay.textContent = roomId;
  btnSound.textContent = soundEnabled ? '🔊' : '🔇';

  // Sistema de Som Sintetizado (Web Audio API - sem arquivos externos)
  let audioCtx = null;
  function getAudioContext() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) audioCtx = new AudioContext();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playSound(type) {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;

      if (type === 'move-x') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.12);
      } else if (type === 'move-o') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(587, now);
        osc.frequency.exponentialRampToValueAtTime(293, now + 0.1);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.12);
      } else if (type === 'win') {
        // Mini fanfarra alegre
        const notes = [523.25, 659.25, 783.99, 1046.50];
        notes.forEach((freq, idx) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.connect(g);
          g.connect(ctx.destination);
          o.type = 'triangle';
          o.frequency.setValueAtTime(freq, now + idx * 0.1);
          g.gain.setValueAtTime(0.2, now + idx * 0.1);
          g.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.1 + 0.25);
          o.start(now + idx * 0.1);
          o.stop(now + idx * 0.1 + 0.25);
        });
      } else if (type === 'draw') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.linearRampToValueAtTime(150, now + 0.3);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
      } else if (type === 'emoji') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.08);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
      }
    } catch {
      // Ignora falhas de áudio
    }
  }

  function vibrate(pattern) {
    if ('vibrate' in navigator) {
      try { navigator.vibrate(pattern); } catch {}
    }
  }

  // Efeito de Confetes Simples em Canvas
  let confettiAnimationId = null;
  function triggerConfetti() {
    const canvas = confettiCanvas;
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;

    const colors = ['#38bdf8', '#f43f5e', '#eab308', '#22c55e', '#a855f7'];
    const particles = Array.from({ length: 60 }).map(() => ({
      x: canvas.width / 2,
      y: canvas.height / 2,
      vx: (Math.random() - 0.5) * 8,
      vy: (Math.random() - 0.8) * 10,
      size: Math.random() * 8 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: 1,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 10
    }));

    if (confettiAnimationId) cancelAnimationFrame(confettiAnimationId);

    function update() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.25; // gravidade
        p.alpha -= 0.012;
        p.rotation += p.rotationSpeed;

        if (p.alpha > 0) {
          alive = true;
          ctx.save();
          ctx.globalAlpha = p.alpha;
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
          ctx.restore();
        }
      });

      if (alive) {
        confettiAnimationId = requestAnimationFrame(update);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    update();
  }

  // Emojis Flutuantes
  let lastSeenReactionTime = 0;
  function showFloatingEmoji(emoji) {
    const el = document.createElement('div');
    el.className = 'floating-emoji';
    el.textContent = emoji;
    el.style.left = Math.floor(20 + Math.random() * 60) + '%';
    reactionsOverlay.appendChild(el);
    playSound('emoji');
    setTimeout(() => el.remove(), 2000);
  }

  // Conexão Server-Sent Events (SSE)
  let eventSource = null;

  function connectSSE() {
    if (eventSource) eventSource.close();

    const streamUrl = `/api/stream?sala=${encodeURIComponent(roomId)}&jogador=${encodeURIComponent(playerId)}&nome=${encodeURIComponent(playerName)}`;
    eventSource = new EventSource(streamUrl);

    eventSource.addEventListener('role', (e) => {
      try {
        const data = JSON.parse(e.data);
        myRole = data.role;
        updateRoleBadge();
      } catch {}
    });

    eventSource.onmessage = (e) => {
      try {
        const state = JSON.parse(e.data);
        handleStateUpdate(state);
      } catch (err) {
        console.error('Erro ao processar estado:', err);
      }
    };

    eventSource.onerror = () => {
      statusPlayerX.textContent = 'Reconectando...';
      statusPlayerO.textContent = 'Reconectando...';
    };
  }

  function updateRoleBadge() {
    if (myRole === 'X') {
      myRoleBadge.innerHTML = 'Você é: <strong style="color: var(--color-x)">❌ Jogador 1 (X)</strong>';
    } else if (myRole === 'O') {
      myRoleBadge.innerHTML = 'Você é: <strong style="color: var(--color-o)">⭕ Jogador 2 (O)</strong>';
    } else {
      myRoleBadge.innerHTML = 'Você é: <strong>👁️ Espectador</strong>';
    }
  }

  // Enviar ações para o servidor
  async function sendAction(actionData) {
    try {
      await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sala: roomId,
          jogador: playerId,
          ...actionData
        })
      });
    } catch (err) {
      console.error('Erro na requisição:', err);
    }
  }

  // Renderizar o tabuleiro e o estado geral
  function handleStateUpdate(state) {
    const prevState = currentState;
    currentState = state;

    // Atualiza nomes e conexões dos jogadores
    labelPlayerX.textContent = state.players.X.name || 'Jogador 1';
    labelPlayerO.textContent = state.players.O.name || 'Jogador 2';

    statusPlayerX.textContent = state.players.X.connected ? '● Online' : '○ Offline';
    statusPlayerX.className = 'player-status ' + (state.players.X.connected ? 'connected' : '');

    statusPlayerO.textContent = state.players.O.connected ? '● Online' : (state.players.O.active ? '○ Offline' : 'Aguardando...');
    statusPlayerO.className = 'player-status ' + (state.players.O.connected ? 'connected' : '');

    // Atualiza placar
    scoreX.textContent = state.scores.X;
    scoreO.textContent = state.scores.O;
    scoreDraws.textContent = state.scores.draws;

    // Atualiza tabuleiro
    state.board.forEach((val, idx) => {
      const cell = cells[idx];
      cell.textContent = val;
      cell.className = 'cell';
      if (val === 'X') cell.classList.add('cell-x');
      if (val === 'O') cell.classList.add('cell-o');

      if (state.winningLine && state.winningLine.includes(idx)) {
        cell.classList.add('winning-cell');
      }

      cell.disabled = !!val || !!state.winner || myRole === 'spectator';
    });

    // Sons de jogadas recentes
    if (prevState && prevState.board) {
      state.board.forEach((val, idx) => {
        if (val && !prevState.board[idx]) {
          playSound(val === 'X' ? 'move-x' : 'move-o');
          vibrate(40);
        }
      });
    }

    // Som e celebração de vitória / empate
    if (state.winner && (!prevState || !prevState.winner)) {
      if (state.winner === 'draw') {
        playSound('draw');
      } else {
        playSound('win');
        triggerConfetti();
        vibrate([100, 50, 100, 50, 150]);
      }
    }

    // Atualiza cartões de turno ativo
    cardPlayerX.classList.toggle('active-turn', state.turn === 'X' && !state.winner);
    cardPlayerO.classList.toggle('active-turn', state.turn === 'O' && !state.winner);

    // Banner de status
    statusBanner.className = 'status-banner';
    waitingSpinner.classList.remove('show');

    const nephewWaiting = !state.players.O.connected && !state.players.O.active;

    if (state.winner) {
      statusBanner.classList.add('winner');
      gameActions.classList.add('show');
      if (state.winner === 'draw') {
        statusMessage.textContent = '🤝 Deu Velha! Empate!';
      } else if (state.winner === myRole) {
        statusMessage.textContent = '🎉 Parabéns! Você VENCEU!';
      } else {
        const winnerName = state.winner === 'X' ? state.players.X.name : state.players.O.name;
        statusMessage.textContent = `🏆 ${winnerName} venceu a partida!`;
      }
    } else if (nephewWaiting) {
      waitingSpinner.classList.add('show');
      statusMessage.textContent = 'Aguardando o 2º jogador entrar...';
      gameActions.classList.remove('show');
    } else {
      gameActions.classList.remove('show');
      if (state.turn === myRole) {
        statusBanner.classList.add('my-turn');
        statusMessage.textContent = '👉 Sua vez de jogar!';
      } else {
        statusBanner.classList.add('other-turn');
        const opponentName = state.turn === 'X' ? state.players.X.name : state.players.O.name;
        statusMessage.textContent = `Aguardando jogada de ${opponentName}...`;
      }
    }

    // Reações em tempo real
    if (state.lastReaction && state.lastReaction.time > lastSeenReactionTime) {
      lastSeenReactionTime = state.lastReaction.time;
      showFloatingEmoji(state.lastReaction.emoji);
    }
  }

  // Clique em uma casa do tabuleiro
  cells.forEach(cell => {
    cell.addEventListener('click', () => {
      const index = cell.getAttribute('data-index');
      if (!currentState || currentState.winner) return;
      if (currentState.turn !== myRole) {
        vibrate([30, 30]);
        return;
      }
      sendAction({ action: 'move', index });
    });
  });

  // Botões de ação
  btnRestart.addEventListener('click', () => {
    sendAction({ action: 'restart' });
  });

  btnResetScore.addEventListener('click', () => {
    if (confirm('Deseja zerar o placar da sala?')) {
      sendAction({ action: 'reset_scores' });
    }
  });

  // Trocar nome/apelido
  btnChangeName.addEventListener('click', () => {
    const current = localStorage.getItem('jdv_player_name') || playerName;
    const novoNome = prompt('Digite seu nome ou apelido (ex: Tio Paulo, Sobrinho Lucas):', current);
    if (novoNome && novoNome.trim()) {
      playerName = novoNome.trim().slice(0, 20);
      localStorage.setItem('jdv_player_name', playerName);
      connectSSE();
    }
  });

  // Toggle de Som
  btnSound.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    localStorage.setItem('jdv_sound', soundEnabled);
    btnSound.textContent = soundEnabled ? '🔊' : '🔇';
    if (soundEnabled) playSound('emoji');
  });

  // Reações Rápidas
  reactionButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const emoji = btn.getAttribute('data-emoji');
      sendAction({ action: 'reaction', emoji });
      vibrate(25);
    });
  });

  // Compartilhamento da Sala (WhatsApp e Link Direto)
  function openShareDialog() {
    const shareUrl = window.location.href;
    shareUrlInput.value = shareUrl;

    const shareText = `Bora jogar um Jogo da Velha comigo no celular? Clica aqui para entrar na minha sala: ${shareUrl}`;
    btnWhatsApp.href = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;

    // Tenta compartilhamento nativo do celular (Web Share API)
    if (navigator.share) {
      navigator.share({
        title: 'Jogo da Velha Online 🎮',
        text: 'Bora jogar um Jogo da Velha comigo pelo celular?',
        url: shareUrl
      }).catch(() => {
        // Se usuário cancelar ou falhar, abre modal
        shareModal.showModal();
      });
    } else {
      shareModal.showModal();
    }
  }

  btnShareRoom.addEventListener('click', openShareDialog);

  btnCopyLink.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(shareUrlInput.value);
      btnCopyLink.textContent = 'Copiado! ✓';
      setTimeout(() => { btnCopyLink.textContent = 'Copiar'; }, 2000);
    } catch {
      shareUrlInput.select();
      document.execCommand('copy');
      btnCopyLink.textContent = 'Copiado! ✓';
      setTimeout(() => { btnCopyLink.textContent = 'Copiar'; }, 2000);
    }
  });

  btnCloseModal.addEventListener('click', () => {
    shareModal.close();
  });

  // Inicia conexão SSE
  connectSSE();
})();

