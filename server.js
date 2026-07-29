const http = require('http');
const fs = require('fs');
const path = require('path');
const { Server } = require('socket.io');
const gameLogic = require('./gameLogic');

function getListenPort() {
  const parsed = Number.parseInt(process.env.PORT, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 3000;
}

function getContentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  switch (extension) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.js':
      return 'application/javascript; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.svg':
      return 'image/svg+xml';
    default:
      return 'application/octet-stream';
  }
}

function handleHttpRequest(req, res) {
  const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname = decodeURIComponent(requestUrl.pathname);

  const legacyPathMap = {
    '/': '/domishiny.html',
    '/new_game.html': '/domishiny.html',
    '/new_game': '/domishiny.html',
    '/index.html': '/domishiny.html',
    '/new_game.css': '/domishiny.css',
    '/new_game.js': '/domishiny.js'
  };

  if (legacyPathMap[pathname]) {
    pathname = legacyPathMap[pathname];
  }

  const normalizedPath = pathname.replace(/^\/+/, '');
  const absolutePath = path.join(__dirname, normalizedPath);

  if (!absolutePath.startsWith(__dirname)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  if (!fs.existsSync(absolutePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
    return;
  }

  const stats = fs.statSync(absolutePath);
  if (stats.isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
    return;
  }

  const fileContents = fs.readFileSync(absolutePath);
  res.writeHead(200, { 'Content-Type': getContentType(absolutePath) });
  res.end(fileContents);
}

const server = http.createServer(handleHttpRequest);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const SPECIAL_CARDS = gameLogic.SPECIAL_CARDS;
const MAX_GAME_LOG_ENTRIES = gameLogic.MAX_GAME_LOG_ENTRIES;

function appendGameLogEntry(game, message) {
  return gameLogic.appendGameLogEntry(game, message);
}

function createPlayer(name, id) {
  return gameLogic.createPlayer(name, id);
}

function getOwnedUnitMembers(player, unitName) {
  return gameLogic.getOwnedUnitMembers(player, unitName);
}

function checkUnitCompletion(player, game) {
  return gameLogic.checkUnitCompletion(player, game);
}

function getEffectiveCardCost(player, card) {
  return gameLogic.getEffectiveCardCost(player, card);
}

function applyMarketCardEffect(player, card, game) {
  return gameLogic.applyMarketCardEffect(player, card, game);
}

function clearTurnEffects(player) {
  return gameLogic.clearTurnEffects(player);
}

function shuffle(array) {
  return gameLogic.shuffle(array);
}

function addCardToDiscard(player, card, game) {
  return gameLogic.addCardToDiscard(player, card, game);
}

function addCardToHand(player, card, game) {
  return gameLogic.addCardToHand(player, card, game);
}

function applyCardPlayEffect(player, card, game) {
  return gameLogic.applyCardPlayEffect(player, card, game);
}

function loadCardDefinitions() {
  return gameLogic.loadCardDefinitions();
}

function findCardTemplateByName(name) {
  return gameLogic.findCardTemplateByName(name);
}

function createMarket() {
  return gameLogic.createMarket();
}

function buildDeck() {
  return gameLogic.buildDeck();
}

function buildIdleDeck() {
  return gameLogic.buildIdleDeck();
}

function setupPlayerDeck(player) {
  return gameLogic.setupPlayerDeck(player);
}

function drawInitialHandForTurn(player) {
  return gameLogic.drawInitialHandForTurn(player);
}

function refreshRoomGameState(roomId, game) {
  return gameLogic.refreshRoomGameState(roomId, game);
}

function calculateFinalScores(game) {
  return gameLogic.calculateFinalScores(game);
}

function checkGameEnd(game, currentPlayerId) {
  return gameLogic.checkGameEnd(game, currentPlayerId);
}

function endGame(roomId, game) {
  return gameLogic.endGame(roomId, game);
}

function createInitialGameState(roomId) {
  return gameLogic.createInitialGameState(roomId);
}

function createInitialGame(roomId) {
  return createInitialGameState(roomId);
}

function emitGameUpdate(roomId, game) {
  io.to(roomId).emit('game_update', game);
}

const rooms = new Map();

io.on('connection', (socket) => {
  console.log('プレイヤーが接続しました！ ID:', socket.id);

  socket.on('create_room', ({ roomId, playerId }) => {
    const normalizedRoomId = roomId || 'demo-room';
    if (rooms.has(normalizedRoomId)) {
      socket.emit('room_error', { message: 'この部屋はすでに存在します。' });
      return;
    }

    const game = createInitialGame(normalizedRoomId);
    game.market = createMarket();
    setupPlayerDeck(game.players[playerId || 'player1']);
    game.players[playerId || 'player1'].connected = true;
    drawInitialHandForTurn(game.players[playerId || 'player1']);
    // no stored debug bonuses; immediate-add button handles resource grants
    rooms.set(normalizedRoomId, { game, players: new Set([socket.id]) });
    socket.join(normalizedRoomId);
    socket.emit('room_ready', { roomId: normalizedRoomId, playerId: playerId || 'player1', game });
    emitGameUpdate(normalizedRoomId, game);
  });

  socket.on('join_room', ({ roomId, playerId }) => {
    const normalizedRoomId = roomId || 'demo-room';
    const room = rooms.get(normalizedRoomId);
    if (!room) {
      socket.emit('room_error', { message: '部屋が見つかりません。先に部屋を作成してください。' });
      return;
    }

    if (room.players.size >= 2) {
      socket.emit('room_error', { message: 'この部屋は満員です。' });
      return;
    }

    room.players.add(socket.id);
    socket.join(normalizedRoomId);
    const game = room.game;
    game.market = createMarket();
    setupPlayerDeck(game.players[playerId || 'player2']);
    game.players[playerId || 'player2'].connected = true;
    game.players[playerId || 'player2'].name = playerId === 'player2' ? 'P2' : 'P2';
    game.status = 'playing';
    game.currentTurn = 'player1';
    game.message = 'P1のターンです。';
    game.log = [];
    game.specialCardPurchases = {};
    appendGameLogEntry(game, 'P1のターン');
    emitGameUpdate(normalizedRoomId, game);
    socket.emit('room_ready', { roomId: normalizedRoomId, playerId: playerId || 'player2', game });
  });

  socket.on('play_card', ({ roomId, playerId, cardIndex }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    const game = room.game;
    if (game.currentTurn !== playerId || game.status !== 'playing') return;

    const player = game.players[playerId];
    const card = player?.hand?.[cardIndex];
    const cardPPCost = Number.isFinite(card?.ppCost) ? card.ppCost : card?.cost || 0;
    const effectiveCostFromEffect = getEffectiveCardCost(player, card);
    const effectiveCost = Number.isFinite(effectiveCostFromEffect) ? effectiveCostFromEffect : cardPPCost;
    if (!card || effectiveCost > player.energy) return;

    player.energy -= effectiveCost;
    player.hand.splice(cardIndex, 1);
    player.playedThisTurn.push(card);

    applyCardPlayEffect(player, card, game);

    game.message = `${player.name}が${card.name}を使用しました。`;
    emitGameUpdate(roomId, game);
  });

  socket.on('end_turn', ({ roomId, playerId }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    const game = room.game;
    if (game.currentTurn !== playerId || game.status !== 'playing') return;

    // 1. ターン終了ボタンを押した瞬間の状態で終了条件を判定
    if (checkGameEnd(game, playerId)) {
      // 終了する場合は、現在のリソースや場・手札のカードをすべて片付けてから集計
      const currentPlayer = game.players[playerId];
      if (currentPlayer) {
        currentPlayer.discard = [
          ...(currentPlayer.discard || []),
          ...(currentPlayer.hand || []),
          ...(currentPlayer.playedThisTurn || [])
        ];
        currentPlayer.hand = [];
        currentPlayer.playedThisTurn = [];
        currentPlayer.resources = { ap: 0, m: 0 };
      }

      endGame(roomId, game);
      emitGameUpdate(roomId, game);
      return;
    }

    // 2. 終了条件を満たしていない場合は通常通り次のターンへ遷移
    const currentPlayer = game.players[playerId];
    if (currentPlayer) {
      currentPlayer.discard = [
        ...(currentPlayer.discard || []),
        ...(currentPlayer.hand || []),
        ...(currentPlayer.playedThisTurn || [])
      ];
      currentPlayer.hand = [];
      currentPlayer.playedThisTurn = [];
      currentPlayer.resources = { ap: 0, m: 0 };
      clearTurnEffects(currentPlayer);
    }

    const nextTurn = playerId === 'player1' ? 'player2' : 'player1';
    game.currentTurn = nextTurn;
    const nextPlayer = game.players[nextTurn];
    nextPlayer.playedThisTurn = [];
    nextPlayer.energy = 3;
    nextPlayer.resources = { ap: 0, m: 0 };
    drawInitialHandForTurn(nextPlayer);

    game.message = `${nextPlayer.name}のターンです。`;
    appendGameLogEntry(game, `${nextPlayer.name}のターン`);
    emitGameUpdate(roomId, game);
  });

  socket.on('force_end_condition', ({ roomId, playerId }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    const game = room.game;
    if (game.currentTurn !== playerId || game.status !== 'playing') return;

    const currentPlayer = game.players[playerId];
    if (currentPlayer) {
      currentPlayer.resources = currentPlayer.resources || { ap: 0, m: 0 };
      currentPlayer.resources.m = Math.max(50, currentPlayer.resources.m || 0);
      currentPlayer.energy = 0;
      game.message = 'デバッグ: 終了条件が満たされました。ターン終了で決着します。';
      appendGameLogEntry(game, `${currentPlayer.name}が終了条件を満たしました。`);
    }

    emitGameUpdate(roomId, game);
  });

  

  // Debug: immediate add resources to current turn player
  socket.on('debug_add_resources', ({ roomId, ap = 0, m = 0 } = {}) => {
    try {
      const room = rooms.get(roomId);
      if (!room) {
        socket.emit('debug_ack', { ok: false, message: 'ルームが見つかりません' });
        return;
      }
      const game = room.game;
      if (!game) {
        socket.emit('debug_ack', { ok: false, message: 'ゲームが存在しません' });
        return;
      }
      const current = game.currentTurn;
      const player = game.players && game.players[current];
      if (!player) {
        socket.emit('debug_ack', { ok: false, message: '現在のプレイヤーが見つかりません' });
        return;
      }
      player.resources = player.resources || { ap: 0, m: 0 };
      const apAdd = Number(ap) || 0;
      const mAdd = Number(m) || 0;
      player.resources.ap = (player.resources.ap || 0) + apAdd;
      player.resources.m = (player.resources.m || 0) + mAdd;
      player.totalEarnedAp = (player.totalEarnedAp || 0) + apAdd;
      player.totalEarnedM = (player.totalEarnedM || 0) + mAdd;
      if (game) appendGameLogEntry(game, `${player.name}にデバッグで AP+${apAdd} M+${mAdd} を付与`);
      socket.emit('debug_ack', { ok: true, message: `AP+${apAdd} M+${mAdd} を ${player.name} に付与しました`, ap: player.resources.ap, m: player.resources.m, totalEarnedAp: player.totalEarnedAp, totalEarnedM: player.totalEarnedM });
      emitGameUpdate(roomId, game);
    } catch (e) {
      socket.emit('debug_ack', { ok: false, message: String(e) });
    }
  });

  socket.on('debug_add_cards_to_hand', ({ roomId, cardNames } = {}) => {
    try {
      const room = rooms.get(roomId);
      if (!room) {
        socket.emit('debug_ack', { ok: false, message: 'ルームが見つかりません' });
        return;
      }
      const game = room.game;
      if (!game) {
        socket.emit('debug_ack', { ok: false, message: 'ゲームが存在しません' });
        return;
      }
      const current = game.currentTurn;
      const player = game.players && game.players[current];
      if (!player) {
        socket.emit('debug_ack', { ok: false, message: '現在のプレイヤーが見つかりません' });
        return;
      }
      if (!Array.isArray(cardNames) || cardNames.length === 0) {
        socket.emit('debug_ack', { ok: false, message: '追加するカードを1つ以上選択してください' });
        return;
      }
      player.hand = Array.isArray(player.hand) ? player.hand : [];
      let addedCount = 0;
      for (const name of cardNames) {
        const tpl = findCardTemplateByName(name) || { name, cost: 0 };
        player.hand.push({ ...tpl });
        addedCount += 1;
      }
      if (addedCount === 0) {
        socket.emit('debug_ack', { ok: false, message: '追加するカードがありません' });
        return;
      }
      if (game) appendGameLogEntry(game, `${player.name}にデバッグで ${addedCount} 枚のカードを手札に追加しました`);
      socket.emit('debug_ack', { ok: true, message: `${player.name}の手札にカードを ${addedCount} 枚追加しました` });
      emitGameUpdate(roomId, game);
    } catch (e) {
      socket.emit('debug_ack', { ok: false, message: String(e) });
    }
  });

  // debug_set_room_mode removed — debug operations apply immediately

  // Debug: list available card names from definitions

  socket.on('buy_market_card', ({ roomId, playerId, cardIndex }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    const game = room.game;
    if (game.currentTurn !== playerId || game.status !== 'playing') return;

    const player = game.players[playerId];
    const card = game.market?.[cardIndex];
    if (!card || card.soldOut || (typeof card.purchaseLimit === 'number' && (card.purchaseCount || 0) >= card.purchaseLimit)) return;
    let available = player.resources?.ap || 0;
    if (card.currency === 'm') {
      available = player.resources?.m || 0;
    }
    const effectiveCost = ['ドームライブ', 'アリーナツアー', 'ワンマンライブ'].includes(card.name)
      ? 0
      : card.cost;
    if (effectiveCost > available) {
      game.message = `${card.name}を購入するには${card.currency === 'm' ? 'M' : 'AP'}が足りません。`;
      emitGameUpdate(roomId, game);
      return;
    }

    if (card.currency === 'ap') {
      player.resources = player.resources || { ap: 0, m: 0 };
      player.resources.ap = (player.resources.ap || 0) - effectiveCost;
    } else if (card.currency === 'm') {
      player.resources = player.resources || { ap: 0, m: 0 };
      player.resources.m = (player.resources.m || 0) - card.cost;
    }

    if (card.type === 'screening' || card.type === 'audition') {
      if ((player.idleDeck?.length || 0) === 0) {
        game.message = `${player.name}が${card.name}を購入できませんでした。アイドル山札が0枚です。`;
        emitGameUpdate(roomId, game);
        return;
      }
      const drawCount = card.type === 'screening' ? 5 : 10;
      const drawn = [];
      for (let i = 0; i < drawCount; i += 1) {
        if ((player.idleDeck?.length || 0) === 0) break;
        drawn.push(player.idleDeck.shift());
      }
      game.pendingMarketSelection = { playerId, cardIndex, cardName: card.name, drawn };
      game.message = `${player.name}が${card.name}を購入。選択してください。`;
    } else {
      const skipLogCards = ['街中スカウト', '書類選考', '事務所オーディション'];
      
      if (card.type === 'scout') {
        const selected = player.idleDeck?.pop();
        if (selected) {
          player.discard.push(selected);
          appendGameLogEntry(game, `${player.name}が${selected.name}をスカウト`);
          checkUnitCompletion(player, game);
        }
      } else {
        // スカウトカード以外は捨て札に追加
        player.discard.push(card);
      }

      if (card.currency === 'ap' && typeof card.value === 'number') {
        player.totalEarnedAp = (player.totalEarnedAp || 0) + card.value;
      }
      if (card.currency === 'm' && typeof card.value === 'number') {
        player.totalEarnedM = (player.totalEarnedM || 0) + card.value;
      }

      if (card.type === 'reset_hand_to_deck') {
        if (Array.isArray(player.hand) && player.hand.length) {
          player.deck = [...player.deck, ...player.hand];
          player.hand = [];
          const extraDrawCount = (card.effectValue || 1) + 1;
          for (let i = 0; i < extraDrawCount; i += 1) {
            if (player.deck.length === 0) {
              if (player.discard.length === 0) break;
              player.deck = shuffle(player.discard);
              player.discard = [];
            }
            const drawn = player.deck.pop();
            if (drawn) player.hand.push(drawn);
          }
        }
      }
      game.message = `${player.name}が${card.name}を購入。`;
    }

    card.purchaseCount = (card.purchaseCount || 0) + 1;
    if (typeof card.purchaseLimit === 'number' && card.purchaseCount >= card.purchaseLimit) {
      card.soldOut = true;
    }
    const skipLogCards = ['街中スカウト', '書類選考', '事務所オーディション'];
    if (!skipLogCards.includes(card.name)) {
      appendGameLogEntry(game, `${player.name}が${card.name}を購入`);
    }
    emitGameUpdate(roomId, game);
  });

  socket.on('confirm_market_selection', ({ roomId, playerId, choiceIndex }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    const game = room.game;
    const pending = game.pendingMarketSelection;
    if (!pending || pending.playerId !== playerId) return;

    const drawn = Array.isArray(pending.drawn) ? pending.drawn : [];
    if (choiceIndex < 0 || choiceIndex >= drawn.length) return;

    const player = game.players[playerId];
    const chosen = drawn[choiceIndex];
    if (chosen) {
      player.discard.push(chosen);
      appendGameLogEntry(game, `${player.name}が${chosen.name}をスカウト`);
      checkUnitCompletion(player, game);
    }
    player.idleDeck = shuffle([...(player.idleDeck || []), ...drawn.filter((_, index) => index !== choiceIndex)]);
    delete game.pendingMarketSelection;
    game.message = `${player.name}がカードを選択しました。`;
    emitGameUpdate(roomId, game);
  });

  socket.on('buy_special_card', ({ roomId, playerId, cardName }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    const game = room.game;
    if (game.currentTurn !== playerId || game.status !== 'playing') return;

    const player = game.players[playerId];
    const card = SPECIAL_CARDS.find((c) => c.name === cardName);
    if (!card) return;

    let available = player.resources?.ap || 0;
    if (card.currency === 'm') {
      available = player.resources?.m || 0;
    }

    const cost = card.cost;
    if (cost > available) {
      game.message = `${card.name}を購入するには${card.currency === 'm' ? 'M' : 'AP'}が足りません。`;
      emitGameUpdate(roomId, game);
      return;
    }

    // Deduct resources
    if (card.currency === 'ap') {
      player.resources = player.resources || { ap: 0, m: 0 };
      player.resources.ap = (player.resources.ap || 0) - cost;
    } else if (card.currency === 'm') {
      player.resources = player.resources || { ap: 0, m: 0 };
      player.resources.m = (player.resources.m || 0) - cost;
    }

    // Check purchase limit
    if (!game.specialCardPurchases) game.specialCardPurchases = {};
    if (!game.specialCardPurchases[cardName]) game.specialCardPurchases[cardName] = 0;
    
    const cardDef = SPECIAL_CARDS.find((c) => c.name === cardName);
    if (cardDef && typeof cardDef.purchaseLimit === 'number' && game.specialCardPurchases[cardName] >= cardDef.purchaseLimit) {
      game.message = `${cardName}は売り切れです。`;
      emitGameUpdate(roomId, game);
      return;
    }

    // Add card to discard
    player.discard.push({ ...card });
    if (card.currency === 'ap' && typeof card.value === 'number') {
      player.totalEarnedAp = (player.totalEarnedAp || 0) + card.value;
    }
    if (card.currency === 'm' && typeof card.value === 'number') {
      player.totalEarnedM = (player.totalEarnedM || 0) + card.value;
    }
    game.specialCardPurchases[cardName] = (game.specialCardPurchases[cardName] || 0) + 1;

    // Log purchase (excluding scout cards)
    const skipLogCards = ['街中スカウト', '書類選考', '事務所オーディション'];
    if (!skipLogCards.includes(card.name)) {
      appendGameLogEntry(game, `${player.name}が${card.name}を購入`);
    }

    game.message = `${player.name}が${card.name}を購入。`;
    emitGameUpdate(roomId, game);
  });

  socket.on('refresh_room_state', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    refreshRoomGameState(roomId, room.game);
    emitGameUpdate(roomId, room.game);
  });

  socket.on('reload_market_cards', ({ roomId }) => {
    console.log('reload_market_cards received for room:', roomId);
    const room = rooms.get(roomId);
    if (!room) return;

    room.game.market = createMarket();
    emitGameUpdate(roomId, room.game);
  });

  socket.on('disconnect', () => {
    console.log('プレイヤーが切断しました。 ID:', socket.id);

    for (const [roomId, room] of rooms.entries()) {
      if (room.players.has(socket.id)) {
        room.players.delete(socket.id);
        console.log(`部屋 ${roomId} からプレイヤー ${socket.id} が退出しました。残りの人数: ${room.players.size}`);

        if (room.players.size === 0) {
          rooms.delete(roomId);
          console.log(`空になった部屋 ${roomId} を自動削除しました。`);
        } else {
          const game = room.game;
          if (game && game.players) {
            if (game.players.player1 && game.players.player1.id === socket.id) {
              game.players.player1.connected = false;
            }
            if (game.players.player2 && game.players.player2.id === socket.id) {
              game.players.player2.connected = false;
            }
            emitGameUpdate(roomId, game);
          }
        }
      }
    }
  });
});

if (require.main === module) {
  server.listen(getListenPort(), '0.0.0.0', () => {
    console.log(`ゲームサーバーがポート${getListenPort()}で起動しました！`);
  });
}

module.exports = {
  appendGameLogEntry,
  MAX_GAME_LOG_ENTRIES,
  getListenPort,
  createMarket,
  buildIdleDeck,
  getEffectiveCardCost,
  applyMarketCardEffect,
  addCardToDiscard,
  applyCardPlayEffect,
  clearTurnEffects,
  addCardToHand,
  setupPlayerDeck,
  drawInitialHandForTurn,
  calculateFinalScores,
  checkGameEnd,
  endGame,
  createPlayer,
  createInitialGameState,
  checkUnitCompletion
};
