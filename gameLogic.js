const { IDOL_CARD_DEFS: DEFINITION_IDOL_CARDS = [], MARKET_CARD_DEFS: DEFINITION_MARKET_CARDS = [] } = require('./card_definitions');

const INITIAL_DECK = [
  ...Array(7).fill({ name: 'プロデュース', cost: 0, value: 1, type: 'produce', desc: 'PP0<br>AP+1' }),
  ...Array(3).fill({ name: 'アイドルのお仕事Lv.1', cost: 0, value: 1, type: 'idol-work', desc: '場のアイドルカード1枚につきM+1', ppCost: 0 })
];

const SPECIAL_CARDS = [
  { name: 'ドームライブ', cost: 30, value: 8, currency: 'm', type: 'special', desc: '得点15<br>このカードは使用不可', purchaseLimit: 3 },
  { name: 'アイドルのお仕事Lv.3', cost: 9, value: 3, currency: 'm', type: 'idol-work', desc: '場のアイドルカード1枚につきM+3', purchaseLimit: 10, ppCost: 0 },
  { name: 'アリーナツアー', cost: 15, value: 6, currency: 'm', type: 'special', desc: '得点10<br>このカードは使用不可', purchaseLimit: 5 },
  { name: 'アイドルのお仕事Lv.2', cost: 6, value: 2, currency: 'm', type: 'idol-work', desc: '場のアイドルカード1枚につきM+2', purchaseLimit: 10, ppCost: 0 },
  { name: 'ワンマンライブ', cost: 5, value: 3, currency: 'm', type: 'special', desc: '得点5<br>このカードは使用不可', purchaseLimit: 8 },
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

const MAX_GAME_LOG_ENTRIES = 50;

function appendGameLogEntry(game, message) {
  if (!game || typeof game !== 'object') return;
  if (typeof message !== 'string' || message.length === 0) return;

  if (!Array.isArray(game.log)) {
    game.log = [];
  }

  game.log.unshift(message);
  if (game.log.length > MAX_GAME_LOG_ENTRIES) {
    game.log.length = MAX_GAME_LOG_ENTRIES;
  }
}

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

function getIdleDeckUnitMembers(player, unitName) {
  if (!player || !unitName) return [];

  const cards = Array.isArray(player.idleDeck) ? player.idleDeck : [];
  return cards.filter((card) => card && card.kind === 'idol' && card.unit === unitName && card.name);
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
    const remainingIdleDeckMembers = getIdleDeckUnitMembers(player, unitName);
    if (unitMembers.length >= requiredCount && remainingIdleDeckMembers.length === 0) {
      if (!game._completedUnitsLog) game._completedUnitsLog = [];
      const completionKey = `${player.id}_${unitName}`;
      if (!game._completedUnitsLog.includes(completionKey)) {
        game._completedUnitsLog.push(completionKey);
        if (!game || !Array.isArray(game.log)) return;
        const completionMessage = `${player.name}が${unitName}を完成`;
        if (!game.log.includes(completionMessage)) {
          appendGameLogEntry(game, completionMessage);
        }
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
      appendGameLogEntry(game, `${player.name}が${card.name}をスカウト`);
    }
  }

  if (card?.kind === 'idol' && game) {
    checkUnitCompletion(player, game);
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
      appendGameLogEntry(game, `${player.name}が${card.name}をスカウト`);
    }
  }

  if (card?.kind === 'idol' && game) {
    checkUnitCompletion(player, game);
  }

  return player.hand;
}

function drawCards(player, count, { targetArea = 'hand' } = {}) {
  const target = targetArea === 'discard' ? 'discard' : 'hand';
  const cardsDrawn = [];

  for (let i = 0; i < count; i += 1) {
    if ((player.deck || []).length === 0) {
      if ((player.discard || []).length === 0) break;
      player.deck = shuffle(player.discard);
      player.discard = [];
    }

    const drawnCard = player.deck.pop();
    if (drawnCard) {
      cardsDrawn.push(drawnCard);
      if (target === 'hand') {
        player.hand.push(drawnCard);
      } else {
        player.discard.push(drawnCard);
      }
    }
  }

  return cardsDrawn;
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
      appendGameLogEntry(game, `${player.name}が${card.name}を使用してPPを回復`);
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
    drawCards(player, drawCount);
    player.energy = Math.min(3, (player.energy || 0) + 1);
    if (game) {
      appendGameLogEntry(game, `${player.name}が${card.name}を使用して手札を捨て札にし、${drawCount}枚引いてPPを1回復`);
    }
    return;
  }

  if (card.type === 'radio_recording') {
    const drawCount = card.effectValue || 2;
    drawCards(player, drawCount);
    if (game) {
      appendGameLogEntry(game, `${player.name}が${card.name}を使用して${drawCount}枚引きました`);
    }
    return;
  }

  if (card.type === 'talk_event') {
    const healAmount = card.effectValue || 2;
    player.energy = Math.min(3, (player.energy || 0) + healAmount);
    if (game) {
      appendGameLogEntry(game, `${player.name}が${card.name}を使用してPPを${healAmount}回復`);
    }
    return;
  }

  if (card.type === 'magazine_shoot') {
    const drawCount = card.effectValue || 1;
    drawCards(player, drawCount);
    player.energy = Math.min(3, (player.energy || 0) + 1);
    if (game) {
      appendGameLogEntry(game, `${player.name}が${card.name}を使用して${drawCount}枚引き、PPを1回復`);
    }
    return;
  }

  if (card.type === 'self_training') {
    const drawCount = card.effectValue || 2;
    drawCards(player, drawCount);
    if (game) {
      appendGameLogEntry(game, `${player.name}が${card.name}を使用して${drawCount}枚引きました`);
    }
    return;
  }

  if (card.type === 'campaign_girl') {
    player.resources.m = (player.resources.m || 0) + 2;
    player.totalEarnedM = (player.totalEarnedM || 0) + 2;
    player.energy = Math.min(3, (player.energy || 0) + 1);
    if (game) {
      appendGameLogEntry(game, `${player.name}が${card.name}を使用してM+2、PPを1回復`);
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
      appendGameLogEntry(game, `${player.name}が${card.name}を使用してアイドルデッキから1枚引きました`);
    }
    return;
  }

  if (card.type === 'special_training') {
    const drawCount = 3;
    drawCards(player, drawCount);
    player.energy = Math.min(3, (player.energy || 0) + 1);
    if (game) {
      appendGameLogEntry(game, `${player.name}が${card.name}を使用して3枚引き、PPを1回復`);
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
      appendGameLogEntry(game, `${player.name}が${card.name}を使用してPPを1回復`);
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
    drawCards(player, drawCount);
    if (game) {
      appendGameLogEntry(game, `${player.name}が${card.name}を使用し、手札を捨てて${drawCount}枚引いた`);
    }
    return;
  }

  if (card.type === 'produce') {
    player.resources.ap = (player.resources.ap || 0) + 1;
    player.totalEarnedAp = (player.totalEarnedAp || 0) + 1;
    if (game) {
      appendGameLogEntry(game, `${player.name}が${card.name}を使用`);
    }
  } else if (card.type === 'idol-work') {
    const idolCount = Array.isArray(player.playedThisTurn) ? player.playedThisTurn.filter((c) => c && c.kind === 'idol').length : 0;
    const gain = (card.value || 1) * idolCount;
    player.resources.m = (player.resources.m || 0) + gain;
    player.totalEarnedM = (player.totalEarnedM || 0) + gain;
    if (game) {
      appendGameLogEntry(game, `${player.name}が${card.name}を使用（場のアイドル ${idolCount} 枚で M+${gain}）`);
    }
  } else if (card.type === 'draw') {
    const count = card.value || 1;
    drawCards(player, count);
    if (game) {
      appendGameLogEntry(game, `${player.name}が${card.name}を使用して${count}枚引きました`);
    }
  }
}

function loadCardDefinitions() {
  const defs = require('./card_definitions');
  delete require.cache[require.resolve('./card_definitions')];
  return defs;
}

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
  fixedNames.forEach((name) => {
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

  const domePurchased = game.specialCardPurchases?.['ドームライブ'] || 0;
  if (domePurchased >= 3) return true;

  let soldOutCount = 0;
  if (Array.isArray(game.market)) {
    game.market.forEach((card) => {
      if (!card || card.soldOut) {
        soldOutCount += 1;
      }
    });
  }
  if (soldOutCount >= 5) return true;

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
  appendGameLogEntry(game, game.message);

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

function refreshRoomGameState(roomId, game) {
  if (!game || typeof game !== 'object') {
    return null;
  }

  game.roomId = roomId || game.roomId;
  game.status = game.status || 'waiting';
  game.currentTurn = game.currentTurn || 'player1';
  game.market = Array.isArray(game.market) ? game.market : createMarket();
  game.pendingMarketSelection = game.pendingMarketSelection || null;
  game.log = Array.isArray(game.log) ? game.log : [];
  game.specialCardPurchases = game.specialCardPurchases || {};

  if (!game.players || typeof game.players !== 'object') {
    game.players = {
      player1: createPlayer('P1', 'player1'),
      player2: createPlayer('P2', 'player2')
    };
  }

  ['player1', 'player2'].forEach((playerId) => {
    const player = game.players[playerId];
    if (!player || typeof player !== 'object') {
      game.players[playerId] = createPlayer(playerId === 'player1' ? 'P1' : 'P2', playerId);
      return;
    }
    player.hand = Array.isArray(player.hand) ? player.hand : [];
    player.deck = Array.isArray(player.deck) ? player.deck : [];
    player.discard = Array.isArray(player.discard) ? player.discard : [];
    player.playedThisTurn = Array.isArray(player.playedThisTurn) ? player.playedThisTurn : [];
    player.idleDeck = Array.isArray(player.idleDeck) ? player.idleDeck : [];
    player.resources = player.resources || { ap: 0, m: 0 };
    player.energy = Number.isFinite(player.energy) ? player.energy : 3;
    player.totalEarnedAp = Number.isFinite(player.totalEarnedAp) ? player.totalEarnedAp : 0;
    player.totalEarnedM = Number.isFinite(player.totalEarnedM) ? player.totalEarnedM : 0;
    player.effects = player.effects || {};
    player.connected = typeof player.connected === 'boolean' ? player.connected : false;
  });

  return game;
}

module.exports = {
  INITIAL_DECK,
  SPECIAL_CARDS,
  UNIT_MEMBER_COUNTS,
  MAX_GAME_LOG_ENTRIES,
  appendGameLogEntry,
  createPlayer,
  getOwnedUnitMembers,
  checkUnitCompletion,
  getEffectiveCardCost,
  applyMarketCardEffect,
  clearTurnEffects,
  shuffle,
  addCardToDiscard,
  addCardToHand,
  drawCards,
  applyCardPlayEffect,
  loadCardDefinitions,
  findCardTemplateByName,
  createMarket,
  buildDeck,
  buildIdleDeck,
  setupPlayerDeck,
  drawInitialHandForTurn,
  calculateFinalScores,
  checkGameEnd,
  endGame,
  createInitialGameState,
  refreshRoomGameState
};
