const http = require('http');
const fs = require('fs');
const path = require('path');
const { Server } = require('socket.io');

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

let INITIAL_DECK = [
  ...Array(7).fill({ name: 'プロデュース', cost: 0, value: 1, type: 'produce', desc: 'PP0<br>AP+1' }),
  ...Array(3).fill({ name: 'アイドルのお仕事Lv.1', cost: 0, value: 1, type: 'idol-work', desc: '場のアイドルカード1枚につきM+1', ppCost: 0 })
];
let ORIGINAL_INITIAL_DECK = null;

const SPECIAL_CARDS = [
  { name: 'ドームライブ', cost: 30, value: 8, currency: 'm', type: 'special', desc: '効果なし', purchaseLimit: 3 },
  { name: 'アイドルのお仕事Lv.3', cost: 9, value: 3, currency: 'm', type: 'idol-work', desc: '場のアイドルカード1枚につきM+3', purchaseLimit: 10, ppCost: 0 },
  { name: 'アリーナツアー', cost: 15, value: 6, currency: 'm', type: 'special', desc: '効果なし', purchaseLimit: 5 },
  { name: 'アイドルのお仕事Lv.2', cost: 6, value: 2, currency: 'm', type: 'idol-work', desc: '場のアイドルカード1枚につきM+2', purchaseLimit: 10, ppCost: 0 },
  { name: 'ワンマンライブ', cost: 5, value: 3, currency: 'm', type: 'special', desc: '効果なし', purchaseLimit: 8 },
  { name: 'アイドルのお仕事Lv.1', cost: 3, value: 1, currency: 'm', type: 'idol-work', desc: '場のアイドルカード1枚につきM+1', purchaseLimit: 10, ppCost: 0 }
];

const UNIT_MEMBER_COUNTS = {
  'イルミネーションスターズ': 3,
  'アンティーカ': 5,
  '放課後クライマックスガールズ': 5,
  'アルストロメリア': 3,
  'ストレイライト': 3,
  'ノクチル': 4,
  'シーズ': 2,
  'コメティック': 3
};

function createPlayer(name, id) {
  return {
    id,
    name,
    score: 0,
    hand: [],
    deck: [],
    discard: [],
    idleDeck: [],
    playedThisTurn: [],
    energy: 3,
    resources: { ap: 0, m: 0 },
    totalEarnedAp: 0,
    totalEarnedM: 0,
    connected: true,
    effects: {}
  };
}

function getOwnedUnitMembers(player, unitName) {
  if (!player || !unitName) return [];

  const ownedNames = new Set();
  const areas = ['deck', 'hand', 'discard', 'playedThisTurn'];

  areas.forEach((area) => {
    const cards = Array.isArray(player[area]) ? player[area] : [];
    cards.forEach((card) => {
      if (card && card.kind === 'idol' && card.unit === unitName && card.name) {
        ownedNames.add(card.name);
      }
    });
  });

  return Array.from(ownedNames);
}

function checkUnitCompletion(player, game) {
  if (!player || !game) return;

  const units = new Set();
  const areas = ['deck', 'hand', 'discard', 'playedThisTurn'];

  areas.forEach((area) => {
    const cards = Array.isArray(player[area]) ? player[area] : [];
    cards.forEach((card) => {
      if (card && card.kind === 'idol' && card.unit) {
        units.add(card.unit);
      }
    });
  });

  units.forEach((unitName) => {
    const requiredCount = UNIT_MEMBER_COUNTS[unitName] || 0;
    if (requiredCount === 0) return;

    const unitMembers = getOwnedUnitMembers(player, unitName);
    if (unitMembers.length === requiredCount) {
      if (!game._completedUnitsLog) game._completedUnitsLog = [];
      const completionKey = `${player.id}_${unitName}`;
      if (!game._completedUnitsLog.includes(completionKey)) {
        game._completedUnitsLog.push(completionKey);
        setTimeout(() => {
          if (!game || !Array.isArray(game.log)) return;
          const completionMessage = `${player.name}が${unitName}を完成`;
          if (!game.log.includes(completionMessage)) {
            game.log.unshift(completionMessage);
          }
        }, 0);
      }
    }
  });
}

function getEffectiveCardCost(player, card) {
  if (!player || !card) return 0;
  const baseCost = Number.isFinite(card.ppCost) ? card.ppCost : (card.cost || 0);
  if (card.kind === 'idol' && player.effects?.nextIdolCostZero) {
    player.effects.nextIdolCostZero = false;
    return 0;
  }

  if (card.kind === 'idol' && player.effects?.idolPPCostZero) {
    return 0;
  }

  if (card.type === 'radio_recording' || card.type === 'talk_event' || card.type === 'magazine_shoot') {
    const idolFieldCount = Array.isArray(player.playedThisTurn)
      ? player.playedThisTurn.filter((entry) => entry && entry.kind === 'idol').length
      : 0;
    return Math.max(0, baseCost - idolFieldCount);
  }

  if (card.kind !== 'idol') return baseCost;

  const reduction = Number(player.effects?.idolCostReduction || 0);
  return Math.max(0, baseCost - reduction);
}

function applyMarketCardEffect(player, card, game) {
  if (!player || !card) return;
}

function clearTurnEffects(player) {
  if (!player || !player.effects) return;
  delete player.effects.idolPPCostZero;
  delete player.effects.nextIdolCostZero;
}

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function addCardToDiscard(player, card, game) {
  if (!player || !card) return;

  if (Array.isArray(player.discard)) {
    player.discard.push(card);
  } else {
    player.discard = [card];
  }

  if (card?.drawnFromIdleDeck) {
    if (game?.log) {
      game.log.unshift(`${player.name}が${card.name}をスカウト`);
    }
  }

  return player.discard;
}

function addCardToHand(player, card, game) {
  if (!player || !card) return;

  if (Array.isArray(player.hand)) {
    player.hand.push(card);
  } else {
    player.hand = [card];
  }

  if (card?.drawnFromIdleDeck) {
    if (game?.log) {
      game.log.unshift(`${player.name}が${card.name}をスカウト`);
    }
  }

  return player.hand;
}

function applyCardPlayEffect(player, card, game) {
  if (!player || !card) return;

  player.resources = player.resources || { ap: 0, m: 0 };

  if (card.kind === 'idol') {
    player.resources.ap = (player.resources.ap || 0) + 1;
    player.totalEarnedAp = (player.totalEarnedAp || 0) + 1;
  }

  if (card.type === 'recover_pp') {
    player.energy = Math.min(3, (player.energy || 0) + 2);
    if (game) {
      game.log.unshift(`${player.name}が${card.name}を使用してPPを回復`);
    }
    return;
  }

  if (card.type === 'discard_hand_draw') {
    const handCards = Array.isArray(player.hand) ? player.hand : [];
    if (handCards.length) {
      player.discard = Array.isArray(player.discard) ? [...player.discard, ...handCards] : [...handCards];
      player.hand = [];
    }
    const drawCount = (handCards.length || 0) + 1;
    for (let i = 0; i < drawCount; i += 1) {
      if (player.deck.length === 0) {
        if (player.discard.length === 0) break;
        player.deck = shuffle(player.discard);
        player.discard = [];
      }
      const drawnCard = player.deck.pop();
      if (drawnCard) player.hand.push(drawnCard);
    }
    player.energy = Math.min(3, (player.energy || 0) + 1);
    if (game) {
      game.log.unshift(`${player.name}が${card.name}を使用して手札を捨て札にし、${drawCount}枚引いてPPを1回復`);
    }
    return;
  }

  if (card.type === 'radio_recording') {
    const drawCount = card.effectValue || 2;
    for (let i = 0; i < drawCount; i += 1) {
      if (player.deck.length === 0) {
        if (player.discard.length === 0) break;
        player.deck = shuffle(player.discard);
        player.discard = [];
      }
      const drawnCard = player.deck.pop();
      if (drawnCard) player.hand.push(drawnCard);
    }
    if (game) {
      game.log.unshift(`${player.name}が${card.name}を使用して${drawCount}枚引きました`);
    }
    return;
  }

  if (card.type === 'talk_event') {
    const healAmount = card.effectValue || 2;
    player.energy = Math.min(3, (player.energy || 0) + healAmount);
    if (game) {
      game.log.unshift(`${player.name}が${card.name}を使用してPPを${healAmount}回復`);
    }
    return;
  }

  if (card.type === 'magazine_shoot') {
    const drawCount = card.effectValue || 1;
    const healAmount = 1;
    for (let i = 0; i < drawCount; i += 1) {
      if (player.deck.length === 0) {
        if (player.discard.length === 0) break;
        player.deck = shuffle(player.discard);
        player.discard = [];
      }
      const drawnCard = player.deck.pop();
      if (drawnCard) player.hand.push(drawnCard);
    }
    player.energy = Math.min(3, (player.energy || 0) + healAmount);
    if (game) {
      game.log.unshift(`${player.name}が${card.name}を使用して${drawCount}枚引き、PPを${healAmount}回復`);
    }
    return;
  }

  if (card.type === 'self_training') {
    const drawCount = card.effectValue || 2;
    for (let i = 0; i < drawCount; i += 1) {
      if (player.deck.length === 0) {
        if (player.discard.length === 0) break;
        player.deck = shuffle(player.discard);
        player.discard = [];
      }
      const drawnCard = player.deck.pop();
      if (drawnCard) player.hand.push(drawnCard);
    }
    if (game) {
      game.log.unshift(`${player.name}が${card.name}を使用して${drawCount}枚引きました`);
    }
    return;
  }

  if (card.type === 'campaign_girl') {
    player.resources.m = (player.resources.m || 0) + 2;
    player.totalEarnedM = (player.totalEarnedM || 0) + 2;
    player.energy = Math.min(3, (player.energy || 0) + 1);
    if (game) {
      game.log.unshift(`${player.name}が${card.name}を使用してM+2、PPを1回復`);
    }
    return;
  }

  if (card.type === 'gacha_ticket') {
    const drawCount = 1;
    for (let i = 0; i < drawCount; i += 1) {
      if (player.idleDeck?.length === 0) break;
      const drawnCard = player.idleDeck.pop();
      if (drawnCard) {
        drawnCard.drawnFromIdleDeck = true;
        addCardToHand(player, drawnCard, game);
      }
    }
    player.energy = Math.min(3, (player.energy || 0) + 1);
    if (game) {
      game.log.unshift(`${player.name}が${card.name}を使用してアイドルデッキから1枚引きました`);
    }
    return;
  }

  if (card.type === 'special_training') {
    const drawCount = 3;
    for (let i = 0; i < drawCount; i += 1) {
      if (player.deck.length === 0) {
        if (player.discard.length === 0) break;
        player.deck = shuffle(player.discard);
        player.discard = [];
      }
      const drawnCard = player.deck.pop();
      if (drawnCard) player.hand.push(drawnCard);
    }
    player.energy = Math.min(3, (player.energy || 0) + 1);
    if (game) {
      game.log.unshift(`${player.name}が${card.name}を使用して3枚引き、PPを1回復`);
    }
    return;
  }

  if (card.type === 'disable_idol_pp') {
    player.effects = player.effects || {};
    player.effects.idolPPCostZero = true;
  }

  if (card.type === 'next_idol_cost_zero') {
    player.effects = player.effects || {};
    player.effects.nextIdolCostZero = true;
    player.energy = Math.min(3, (player.energy || 0) + 1);
    if (game) {
      game.log.unshift(`${player.name}が${card.name}を使用してPPを1回復`);
    }
  }

  if (card.type === 'reset_hand_to_deck') {
    if (Array.isArray(player.hand) && player.hand.length) {
      player.deck = [...player.deck, ...player.hand];
      player.hand = [];
    }
  }

  if (card.type === 'discard_hand_draw') {
    const discardedCount = Array.isArray(player.hand) ? player.hand.length : 0;
    if (discardedCount > 0) {
      player.discard = [...(player.discard || []), ...player.hand];
      player.hand = [];
    }
    const drawCount = discardedCount + 1;
    for (let i = 0; i < drawCount; i += 1) {
      if (player.deck.length === 0) {
        if (player.discard.length === 0) break;
        player.deck = shuffle(player.discard);
        player.discard = [];
      }
      const drawnCard = player.deck.pop();
      if (drawnCard) player.hand.push(drawnCard);
    }
    if (game) {
      game.log.unshift(`${player.name}が${card.name}を使用し、手札を捨てて${drawCount}枚引いた`);
    }
    return;
  }

  if (card.type === 'produce') {
    player.resources.ap = (player.resources.ap || 0) + 1;
    player.totalEarnedAp = (player.totalEarnedAp || 0) + 1;
    if (game) {
      game.log.unshift(`${player.name}が${card.name}を使用`);
    }
  } else if (card.type === 'idol-work') {
    const idolCount = Array.isArray(player.playedThisTurn) ? player.playedThisTurn.filter((c) => c && c.kind === 'idol').length : 0;
    const gain = (card.value || 1) * idolCount;
    player.resources.m = (player.resources.m || 0) + gain;
    player.totalEarnedM = (player.totalEarnedM || 0) + gain;
    if (game) {
      game.log.unshift(`${player.name}が${card.name}を使用（場のアイドル ${idolCount} 枚で M+${gain}）`);
    }
  } else if (card.type === 'draw') {
    const count = card.value || 1;
    for (let i = 0; i < count; i += 1) {
      if (player.deck.length === 0) {
        if (player.discard.length === 0) break;
        player.deck = shuffle(player.discard);
        player.discard = [];
      }
      const drawn = player.deck.pop();
      if (drawn) player.hand.push(drawn);
    }
    if (game) {
      game.log.unshift(`${player.name}が${card.name}を使用して${count}枚引きました`);
    }
  }
}

function loadCardDefinitions() {
  delete require.cache[require.resolve('./card_definitions')];
  return require('./card_definitions');
}

// debug turn-bonus storage removed; immediate add is used instead

function findCardTemplateByName(name) {
  if (!name) return null;
  const defs = loadCardDefinitions();
  const { MARKET_CARD_DEFS = [], IDOL_CARD_DEFS = [] } = defs;
  let found = MARKET_CARD_DEFS.find((c) => c && c.name === name);
  if (found) return { ...found };
  found = IDOL_CARD_DEFS.find((c) => c && c.name === name);
  if (found) return { ...found };
  return null;
}

function createMarket() {
  const { MARKET_CARD_DEFS = [] } = loadCardDefinitions();

  const fixedNames = ['街中スカウト', '書類選考', '事務所オーディション'];
  const fixedCards = MARKET_CARD_DEFS.filter((card) => fixedNames.includes(card.name));
  const poolCards = MARKET_CARD_DEFS.filter((card) => !fixedNames.includes(card.name));

  const aCards = poolCards.filter((card) => typeof card?.internalId === 'string' && /^A\d+$/i.test(card.internalId));
  const mCards = poolCards.filter((card) => typeof card?.internalId === 'string' && /^M\d+$/i.test(card.internalId));

  const getCardIdNumber = (card) => {
    const match = (card?.internalId || '').match(/^([AM])(\d+)$/i);
    return match ? Number(match[2]) : Number.MAX_SAFE_INTEGER;
  };

  const selectedACards = shuffle(aCards).slice(0, 4)
    .sort((a, b) => getCardIdNumber(a) - getCardIdNumber(b));
  let selectedMCards = shuffle(mCards).slice(0, 3)
    .sort((a, b) => getCardIdNumber(a) - getCardIdNumber(b));

  if (selectedMCards.length < 3) {
    const fallbackCard = selectedMCards[0] || mCards[0];
    while (selectedMCards.length < 3 && fallbackCard) {
      selectedMCards.push({ ...fallbackCard });
    }
  }

  const orderedSelectedCards = [];
  const fixedCardNames = ['街中スカウト', '書類選考', '事務所オーディション'];
  fixedCardNames.forEach((name) => {
    const fixedCard = fixedCards.find((card) => card.name === name);
    if (fixedCard) {
      orderedSelectedCards.push(fixedCard);
    }
  });

  selectedACards.forEach((card) => {
    orderedSelectedCards.push(card);
  });

  selectedMCards.forEach((card) => {
    orderedSelectedCards.push(card);
  });

  const marketCards = orderedSelectedCards.slice(0, 10);

  console.log('createMarket selected cards:', marketCards.map((c) => c && c.name));

  return Array.from({ length: marketCards.length }, (_, index) => {
    const card = marketCards[index];
    if (!card) {
      return null;
    }

    return { ...card, purchaseCount: 0, purchaseLimit: 10, soldOut: false };
  });
}

function buildDeck() {
  return shuffle(INITIAL_DECK.map((card) => ({ ...card })));
}

function buildIdleDeck() {
  const { IDOL_CARD_DEFS = [] } = loadCardDefinitions();
  return shuffle(IDOL_CARD_DEFS.map((card) => ({ ...card })));
}

function setupPlayerDeck(player) {
  player.deck = buildDeck();
  player.idleDeck = buildIdleDeck();
  player.hand = [];
  player.discard = [];
  player.playedThisTurn = [];
  player.energy = 3;
  player.resources = { ap: 0, m: 0 };
  player.totalEarnedAp = player.totalEarnedAp ?? 0;
  player.totalEarnedM = player.totalEarnedM ?? 0;

  return player;
}

function drawInitialHandForTurn(player) {
  if (!player) return;

  player.hand = [];
  player.playedThisTurn = [];
  player.energy = 3;
  player.resources = { ap: 0, m: 0 };

  for (let i = 0; i < 5; i += 1) {
    if (player.deck.length === 0) {
      if (player.discard.length === 0) break;
      player.deck = shuffle(player.discard);
      player.discard = [];
    }
    const card = player.deck.pop();
    if (card) player.hand.push(card);
  }
}

function refreshRoomGameState(roomId, game) {
  if (!game) return;

  game.market = createMarket();
  game.pendingMarketSelection = null;
  if (game.players?.player1) {
    game.players.player1.idleDeck = buildIdleDeck();
  }
  if (game.players?.player2) {
    game.players.player2.idleDeck = buildIdleDeck();
  }

  return game;
}

function calculateFinalScores(game) {
  const results = {};

  const UNIT_SCORE_MAP = { 2: 4, 3: 6, 4: 8, 5: 10 };

  Object.keys(game.players || {}).forEach((pId) => {
    const player = game.players[pId];
    if (!player) return;

    const allCards = [
      ...(player.hand || []),
      ...(player.deck || []),
      ...(player.discard || []),
      ...(player.playedThisTurn || [])
    ];

    let scoreIdolCards = 0;
    let scoreDeckSize = 0;
    let scoreEarnedAp = 0;
    let scoreEarnedM = 0;
    let scoreSpecialCards = 0;

    const unitMembersMap = {};
    const specialCardCounts = {
      ドームライブ: 0,
      アリーナツアー: 0,
      ワンマンライブ: 0
    };

    allCards.forEach((card) => {
      if (!card) return;

      if (card.kind === 'idol') {
        scoreIdolCards += 1;
        if (card.unit) {
          if (!unitMembersMap[card.unit]) {
            unitMembersMap[card.unit] = new Set();
          }
          unitMembersMap[card.unit].add(card.name);
        }
      }

      if (card.name === 'ドームライブ') {
        specialCardCounts.ドームライブ += 1;
        scoreSpecialCards += 15;
      }
      if (card.name === 'アリーナツアー') {
        specialCardCounts.アリーナツアー += 1;
        scoreSpecialCards += 10;
      }
      if (card.name === 'ワンマンライブ') {
        specialCardCounts.ワンマンライブ += 1;
        scoreSpecialCards += 5;
      }
    });

    const completedUnits = [];
    let scoreUnitCompletion = 0;
    Object.keys(unitMembersMap).forEach((unitName) => {
      const ownedCount = unitMembersMap[unitName].size;
      const requiredCount = UNIT_MEMBER_COUNTS[unitName] || 0;

      if (requiredCount > 0 && ownedCount === requiredCount) {
        scoreUnitCompletion += (UNIT_SCORE_MAP[requiredCount] || 0);
        completedUnits.push(unitName);
      }
    });

    scoreDeckSize = Math.min(20, Math.floor(allCards.length / 3));
    const totalEarnedAp = player.totalEarnedAp || 0;
    const totalEarnedM = player.totalEarnedM || 0;
    scoreEarnedAp = Math.min(20, Math.floor(totalEarnedAp / 5));
    scoreEarnedM = Math.min(20, Math.floor(totalEarnedM / 10));

    const totalScore = scoreIdolCards + scoreUnitCompletion + scoreDeckSize + scoreEarnedAp + scoreEarnedM + scoreSpecialCards;

    results[pId] = {
      total: totalScore,
      breakdown: {
        idolCards: scoreIdolCards,
        completedUnits,
        unitCompletion: scoreUnitCompletion,
        deckCardCount: allCards.length,
        deckSize: scoreDeckSize,
        earnedAp: scoreEarnedAp,
        earnedApTotal: totalEarnedAp,
        earnedM: scoreEarnedM,
        earnedMTotal: totalEarnedM,
        specialCards: scoreSpecialCards,
        specialCardCounts
      }
    };
    player.score = totalScore;
  });

  return results;
}

function checkGameEnd(game, currentPlayerId) {
  if (!game) return false;

  // 条件①：ドームライブがサプライから無い（購入制限 3回 に達している）
  const domePurchased = game.specialCardPurchases?.['ドームライブ'] || 0;
  if (domePurchased >= 3) return true;

  // 条件②：マーケットからカードが5種類無くなった
  let soldOutCount = 0;
  if (Array.isArray(game.market)) {
    game.market.forEach((card) => {
      if (!card || card.soldOut) {
        soldOutCount += 1;
      }
    });
  }
  if (soldOutCount >= 5) return true;

  // 条件③：ターンプレイヤーのMが50以上ある状態
  const player = game.players?.[currentPlayerId];
  const currentM = player?.resources?.m || 0;
  if (currentM >= 50) return true;

  return false;
}

function endGame(roomId, game) {
  if (!game) return { winners: [], scores: {} };

  const scores = calculateFinalScores(game);
  const entries = Object.entries(scores).map(([playerId, scoreObject]) => ({ playerId, score: scoreObject.total }));
  const maxScore = entries.reduce((highest, entry) => Math.max(highest, entry.score), 0);
  const winners = entries.filter((entry) => entry.score === maxScore).map((entry) => entry.playerId);

  game.status = 'finished';
  game.finalScores = scores;
  game.winners = winners;
  game.message = winners.length > 1 ? '引き分けです。' : `${game.players[winners[0]]?.name || winners[0]}の勝ちです。`;
  game.log = Array.isArray(game.log) ? game.log : [];
  game.log.unshift(game.message);

  return { winners, scores };
}

function createInitialGameState(roomId) {
  const game = {
    roomId,
    status: 'waiting',
    currentTurn: 'player1',
    message: '部屋が作成されました。相手が参加するのを待っています。',
    market: createMarket(),
    pendingMarketSelection: null,
    log: [],
    players: {
      player1: createPlayer('P1', 'player1'),
      player2: createPlayer('P2', 'player2')
    }
  };

  game.players.player1.connected = true;
  game.players.player2.connected = false;
  return game;
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
    game.log.unshift('P1のターン');
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
    game.log.unshift(`${nextPlayer.name}のターン`);
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
      game.log.unshift(`${currentPlayer.name}が終了条件を満たしました。`);
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
      if (game) game.log.unshift(`${player.name}にデバッグで AP+${apAdd} M+${mAdd} を付与`);
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
      if (game) game.log.unshift(`${player.name}にデバッグで ${addedCount} 枚のカードを手札に追加しました`);
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
          checkUnitCompletion(player, game);
          game.log.unshift(`${player.name}が${selected.name}をスカウト`);
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
      game.log.unshift(`${player.name}が${card.name}を購入`);
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
      checkUnitCompletion(player, game);
      game.log.unshift(`${player.name}が${chosen.name}をスカウト`);
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
      game.log.unshift(`${player.name}が${card.name}を購入`);
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
  getListenPort,
  createMarket,
  buildIdleDeck,
  getEffectiveCardCost,
  applyMarketCardEffect,
  addCardToDiscard,
  applyCardPlayEffect,
  clearTurnEffects,
  setupPlayerDeck,
  drawInitialHandForTurn,
  calculateFinalScores,
  checkGameEnd,
  endGame
};
