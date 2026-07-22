(async function () {
  console.log('domishiny.js initialized');
  let socket = null;

  const elements = {
    message: document.getElementById('message'),
    sidebarStatus: document.getElementById('sidebar-status'),
    sidebarHistory: document.getElementById('sidebar-history'),
    sidebarHistoryFilter: document.getElementById('sidebar-history-filter'),
    turnIndicator: document.getElementById('turn-indicator'),
    hand: document.getElementById('hand'),
    log: document.getElementById('log'),
    playedArea: document.getElementById('played-area'),
    titleScreen: document.getElementById('title-screen'),
    gameScreen: document.getElementById('game-screen'),
    titleCreateRoomButton: document.getElementById('title-create-room-btn'),
    titleJoinRoomButton: document.getElementById('title-join-room-btn'),
    titleCpuButton: document.getElementById('title-cpu-btn'),
    titleRulesButton: document.getElementById('title-rules-btn'),
    debugToggleButton: document.getElementById('debug-toggle-btn'),
    debugPanel: document.getElementById('debug-panel'),
    debugToggleButtonGame: document.getElementById('debug-toggle-btn-game'),
    debugCloseButton: document.getElementById('debug-close-btn'),
    debugOutput: document.getElementById('debug-output'),
    debugTurnApInput: document.getElementById('debug-turn-ap'),
    debugTurnMInput: document.getElementById('debug-turn-m'),
    debugAddResources: document.getElementById('debug-add-resources'),
    debugRoomEnabledCheckbox: document.getElementById('debug-room-enabled'),
    debugApplyRoomMode: document.getElementById('debug-apply-room-mode'),
    debugCardList: document.getElementById('debug-card-list'),
    debugDeckPreview: document.getElementById('debug-deck-preview'),
    debugApplyDeck: document.getElementById('debug-apply-deck'),
    debugClearSelection: document.getElementById('debug-clear-selection'),
    endTurnButton: document.getElementById('end-turn-btn'),
    forceEndConditionButton: document.getElementById('force-end-condition-btn'),
    gameShell: document.querySelector('.game-shell'),
    viewport: document.querySelector('.viewport'),
    market: document.getElementById('market'),
    specialCards: document.getElementById('special-cards'),
    resourceApCount: document.getElementById('resource-ap-count'),
    resourceMCount: document.getElementById('resource-m-count'),
    resourceEnergyCount: document.getElementById('resource-energy-count'),
    resourceEnergyMax: document.getElementById('resource-energy-max'),
    resourceDeckCount: document.getElementById('resource-deck-count'),
    resourceDeckTotalCount: document.getElementById('resource-deck-total-count'),
    resourceDiscardCount: document.getElementById('resource-discard-count'),
    resourceIdleDeckCount: document.getElementById('resource-idle-deck-count'),
    idleDeckPanel: document.querySelector('.resource-panel-idle-deck'),
    cardTooltip: document.getElementById('card-tooltip')
  };

  try {
    if (!window.io) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.socket.io/4.7.5/socket.io.min.js';
        script.onload = resolve;
        script.onerror = () => reject(new Error('Socket.io CDN のロードに失敗しました。'));
        document.head.appendChild(script);
      });
    }

    if (!window.io) {
      throw new Error('Socket.IO のクライアントを読み込めませんでした。');
    }

    const protocol = window.location.protocol === 'https:' ? 'https' : 'http';
    const serverUrl = `${protocol}://${window.location.hostname}${window.location.port ? `:${window.location.port}` : ''}`;
    socket = window.io(serverUrl, {
      transports: ['websocket', 'polling'],
      path: '/socket.io'
    });

    socket.on('connect', () => {
      console.log('サーバーに接続成功！ Socket ID:', socket.id);
    });

    socket.on('connect_error', (err) => {
      console.error('接続エラー詳細:', err);
      setStatus(`接続エラー: ${err.message || '不明'}`);
    });

    socket.on('disconnect', (reason) => {
      console.warn('socket disconnected', reason);
      setStatus(`切断されました: ${reason}`);
    });
  } catch (error) {
    console.error('Socket 初期化に失敗しました', error);
    setStatus(error.message || 'Socket.io の初期化に失敗しました。');
  }

  const DEFAULT_ROOM_ID = 'demo-room';

const CARD_DEFS = {
  produce: { name: 'プロデュース', cost: 0, value: 1, type: 'produce', desc: 'AP+1' },
  idolWork: { name: 'アイドルのお仕事Lv.1', cost: 0, value: 1, type: 'idol-work', desc: '場のアイドルカード1枚につきM+1' }
};

const { IDOL_CARD_DEFS, MARKET_CARD_DEFS, normalizeCardDescriptionForDisplay } = (() => {
  try {
    return window.cardDefinitions || {};
  } catch (error) {
    return {};
  }
})();

const SPECIAL_CARDS = [
  { name: 'ドームライブ', cost: 30, value: 8, currency: 'm', type: 'special', desc: '効果なし', purchaseLimit: 3 },
  { name: 'アイドルのお仕事Lv.3', cost: 9, value: 3, currency: 'm', type: 'idol-work', desc: '場のアイドルカード1枚につきM+3', purchaseLimit: 10, ppCost: 0 },
  { name: 'アリーナツアー', cost: 15, value: 6, currency: 'm', type: 'special', desc: '効果なし', purchaseLimit: 5 },
  { name: 'アイドルのお仕事Lv.2', cost: 6, value: 2, currency: 'm', type: 'idol-work', desc: '場のアイドルカード1枚につきM+2', purchaseLimit: 10, ppCost: 0 },
  { name: 'ワンマンライブ', cost: 5, value: 3, currency: 'm', type: 'special', desc: '効果なし', purchaseLimit: 8 },
  { name: 'アイドルのお仕事Lv.1', cost: 3, value: 1, currency: 'm', type: 'idol-work', desc: '場のアイドルカード1枚につきM+1', purchaseLimit: 10, ppCost: 0 }
];

const IDOL_CARDS = Array.isArray(IDOL_CARD_DEFS) && IDOL_CARD_DEFS.length
  ? IDOL_CARD_DEFS
  : [
      { name: '櫻木真乃', unit: 'イルミネーションスターズ', cost: 1, value: 1, type: 'draw', desc: 'PP1<br>AP+1<br>ドロー+1', kind: 'idol' },
      { name: '風野灯織', unit: 'イルミネーションスターズ', cost: 1, value: 1, type: 'draw', desc: 'PP1<br>AP+1<br>ドロー+1', kind: 'idol' },
      { name: '八宮めぐる', unit: 'イルミネーションスターズ', cost: 1, value: 1, type: 'draw', desc: 'PP1<br>AP+1<br>ドロー+1', kind: 'idol' },
      { name: '月岡恋鐘', unit: 'アンティーカ', cost: 1, value: 1, type: 'draw', desc: 'PP1<br>AP+1<br>ドロー+1', kind: 'idol' },
      { name: '田中摩美々', unit: 'アンティーカ', cost: 1, value: 1, type: 'draw', desc: 'PP1<br>AP+1<br>ドロー+1', kind: 'idol' },
      { name: '白瀬咲耶', unit: 'アンティーカ', cost: 1, value: 1, type: 'draw', desc: 'PP1<br>AP+1<br>ドロー+1', kind: 'idol' },
      { name: '三峰結華', unit: 'アンティーカ', cost: 1, value: 1, type: 'draw', desc: 'PP1<br>AP+1<br>ドロー+1', kind: 'idol' },
      { name: '幽谷霧子', unit: 'アンティーカ', cost: 1, value: 1, type: 'draw', desc: 'PP1<br>AP+1<br>ドロー+1', kind: 'idol' },
      { name: '小宮果穂', unit: '放課後クライマックスガールズ', cost: 1, value: 1, type: 'draw', desc: 'PP1<br>AP+1<br>ドロー+1', kind: 'idol' },
      { name: '園田智代子', unit: '放課後クライマックスガールズ', cost: 1, value: 1, type: 'draw', desc: 'PP1<br>AP+1<br>ドロー+1', kind: 'idol' },
      { name: '西城樹里', unit: '放課後クライマックスガールズ', cost: 1, value: 1, type: 'draw', desc: 'PP1<br>AP+1<br>ドロー+1', kind: 'idol' },
      { name: '杜野凛世', unit: '放課後クライマックスガールズ', cost: 1, value: 1, type: 'draw', desc: 'PP1<br>AP+1<br>ドロー+1', kind: 'idol' },
      { name: '有栖川夏葉', unit: '放課後クライマックスガールズ', cost: 1, value: 1, type: 'draw', desc: 'PP1<br>AP+1<br>ドロー+1', kind: 'idol' },
      { name: '大崎甘奈', unit: 'アルストロメリア', cost: 1, value: 1, type: 'draw', desc: 'PP1<br>AP+1<br>ドロー+1', kind: 'idol' },
      { name: '大崎甜花', unit: 'アルストロメリア', cost: 1, value: 1, type: 'draw', desc: 'PP1<br>AP+1<br>ドロー+1', kind: 'idol' },
      { name: '桑山千雪', unit: 'アルストロメリア', cost: 1, value: 1, type: 'draw', desc: 'PP1<br>AP+1<br>ドロー+1', kind: 'idol' },
      { name: '芹沢あさひ', unit: 'ストレイライト', cost: 1, value: 1, type: 'draw', desc: 'PP1<br>AP+1<br>ドロー+1', kind: 'idol' },
      { name: '黛冬優子', unit: 'ストレイライト', cost: 1, value: 1, type: 'draw', desc: 'PP1<br>AP+1<br>ドロー+1', kind: 'idol' },
      { name: '和泉愛依', unit: 'ストレイライト', cost: 1, value: 1, type: 'draw', desc: 'PP1<br>AP+1<br>ドロー+1', kind: 'idol' },
      { name: '浅倉透', unit: 'ノクチル', cost: 1, value: 1, type: 'draw', desc: 'PP1<br>AP+1<br>ドロー+1', kind: 'idol' },
      { name: '樋口円香', unit: 'ノクチル', cost: 1, value: 1, type: 'draw', desc: 'PP1<br>AP+1<br>ドロー+1', kind: 'idol' },
      { name: '福丸小糸', unit: 'ノクチル', cost: 1, value: 1, type: 'draw', desc: 'PP1<br>AP+1<br>ドロー+1', kind: 'idol' },
      { name: '市川雛菜', unit: 'ノクチル', cost: 1, value: 1, type: 'draw', desc: 'PP1<br>AP+1<br>ドロー+1', kind: 'idol' },
      { name: '七草にちか', unit: 'シーズ', cost: 1, value: 1, type: 'draw', desc: 'PP1<br>AP+1<br>ドロー+1', kind: 'idol' },
      { name: '緋田美琴', unit: 'シーズ', cost: 1, value: 1, type: 'draw', desc: 'PP1<br>AP+1<br>ドロー+1', kind: 'idol' },
      { name: '斑鳩ルカ', unit: 'コメティック', cost: 1, value: 1, type: 'draw', desc: 'PP1<br>AP+1<br>ドロー+1', kind: 'idol' },
      { name: '鈴木羽那', unit: 'コメティック', cost: 1, value: 1, type: 'draw', desc: 'PP1<br>AP+1<br>ドロー+1', kind: 'idol' },
      { name: '郁田はるき', unit: 'コメティック', cost: 1, value: 1, type: 'draw', desc: 'PP1<br>AP+1<br>ドロー+1', kind: 'idol' }
    ];

const state = {
  roomId: null,
  myPlayerId: null,
  game: null,
  isBusy: false,
  selectedCardIndex: null,
  historyFilter: 'all',
  finishedReportStep: 0,
  finishedReportShown: false
};

let unsubscribeFromRoom = null;

async function ensureAuthenticated() {
  return true;
}


function getResourceAmountForCard(player, card) {
  if (!card || !player) return 0;
  if (!card.currency) return player.energy || 0;
  if (isFreeCard(card)) return Number.MAX_SAFE_INTEGER;
  if (card.currency === 'ap') return player.resources?.ap || 0;
  if (card.currency === 'm') return player.resources?.m || 0;
  return player.energy || 0;
}

function getDiscardCount(player) {
  if (!player) return 0;
  return player.discard?.length || 0;
}

function getMyPlayer() {
  if (!state.game || !state.myPlayerId) return null;
  return state.game.players?.[state.myPlayerId] || null;
}

function getOpponentPlayer() {
  if (!state.game || !state.myPlayerId) return null;
  const opponentId = state.myPlayerId === 'player1' ? 'player2' : 'player1';
  return state.game.players?.[opponentId] || null;
}

// --- Debug deck editor state & helpers ---
const debugSelection = {
  // name -> count
  map: {}
};

function addCardToSelection(name, delta = 1) {
  if (!name) return;
  const cur = debugSelection.map[name] || 0;
  const next = Math.max(0, cur + delta);
  if (next === 0) delete debugSelection.map[name];
  else debugSelection.map[name] = next;
  updateDebugDeckPreview();
}

function clearDebugSelection() {
  debugSelection.map = {};
  updateDebugDeckPreview();
}

function updateDebugDeckPreview() {
  const container = elements.debugDeckPreview;
  if (!container) return;
  container.innerHTML = '';
  const names = Object.keys(debugSelection.map);
  if (!names.length) {
    const el = document.createElement('div');
    el.style.color = 'var(--muted)';
    el.textContent = '選択カードなし';
    container.appendChild(el);
    return;
  }
  names.forEach((name) => {
    const count = debugSelection.map[name] || 0;
    const chip = document.createElement('div');
    chip.className = 'debug-card-chip';
    chip.style.padding = '6px 8px';
    chip.style.border = '1px solid rgba(148,163,184,0.15)';
    chip.style.borderRadius = '6px';
    chip.style.display = 'inline-flex';
    chip.style.alignItems = 'center';
    chip.style.gap = '8px';
    const label = document.createElement('span');
    label.textContent = `${name} x${count}`;
    const minus = document.createElement('button');
    minus.textContent = '-';
    minus.style.minWidth = '28px';
    minus.addEventListener('click', () => addCardToSelection(name, -1));
    const plus = document.createElement('button');
    plus.textContent = '+';
    plus.style.minWidth = '28px';
    plus.addEventListener('click', () => addCardToSelection(name, 1));
    chip.appendChild(minus);
    chip.appendChild(label);
    chip.appendChild(plus);
    container.appendChild(chip);
  });
}

function createDebugCardList() {
  const list = elements.debugCardList;
  if (!list) return;
  list.innerHTML = '';
  const combined = [];
  if (Array.isArray(IDOL_CARD_DEFS)) combined.push(...IDOL_CARD_DEFS.map((c) => ({ ...c, _src: 'idol' })));
  if (Array.isArray(MARKET_CARD_DEFS)) combined.push(...MARKET_CARD_DEFS.map((c) => ({ ...c, _src: 'market' })));
  const excludedDebugCards = ['街中スカウト', '書類選考', '事務所オーディション'];
  combined.forEach((card) => {
    if (excludedDebugCards.includes(card.name)) return;
    const btn = document.createElement('button');
    btn.className = 'debug-card-item';
    btn.style.padding = '6px 8px';
    btn.style.borderRadius = '6px';
    btn.style.border = '1px solid rgba(148,163,184,0.12)';
    btn.style.background = 'white';
    btn.style.cursor = 'pointer';
    btn.title = card.desc || '';
    btn.textContent = card.name;
    btn.addEventListener('click', () => {
      addCardToSelection(card.name, 1);
    });
    list.appendChild(btn);
  });
}

function applyDebugSelectionToServer() {
  if (!socket) return;
  const namesExpanded = [];
  Object.entries(debugSelection.map).forEach(([name, count]) => {
    for (let i = 0; i < count; i += 1) namesExpanded.push(name);
  });
  if (!namesExpanded.length) {
    if (elements.debugOutput) elements.debugOutput.textContent = '手札に追加するカードを1つ以上選択してください。';
    return;
  }
  if (!state.roomId) {
    if (elements.debugOutput) elements.debugOutput.textContent = '先に部屋を作成または参加してから操作してください。';
    return;
  }
  socket.emit('debug_add_cards_to_hand', { roomId: state.roomId, cardNames: namesExpanded });
  socket.once('debug_ack', (msg) => {
    if (elements.debugOutput) elements.debugOutput.textContent = msg?.message || JSON.stringify(msg);
  });
}


function isSidebarHistoryEntry(text) {
  if (typeof text !== 'string') return false;
  if (/スカウト/.test(text)) return true;
  if (/完成$/.test(text)) return true;
  if (/街中スカウト|書類選考|事務所オーディション/.test(text)) return false;
  return /を購入/.test(text);
}

function shouldRecordPurchaseHistory(card) {
  if (!card) return false;
  return !/街中スカウト|書類選考|事務所オーディション/.test(card.name || '');
}

function setStatus(text) {
  if (elements.message) {
    elements.message.textContent = '';
  }
  if (elements.sidebarStatus) {
    elements.sidebarStatus.textContent = text;
  }
  if (!elements.turnIndicator) {
    return;
  }
  if (!state.game) {
    elements.turnIndicator.textContent = '待機中';
    return;
  }
  const isMyTurn = state.myPlayerId && state.game.currentTurn === state.myPlayerId && state.game.status === 'playing';
  elements.turnIndicator.textContent = isMyTurn ? 'あなたのターン' : '相手のターン';
}

function updateTurnHighlight() {
  const game = state.game;
  const isMyTurn = !!state.myPlayerId && !!game && game.currentTurn === state.myPlayerId && game.status === 'playing';

  if (elements.endTurnButton) {
    elements.endTurnButton.classList.remove('is-active-p1', 'is-active-p2', 'is-idle');
    if (isMyTurn) {
      if (state.myPlayerId === 'player1') {
        elements.endTurnButton.classList.add('is-active-p1');
      } else {
        elements.endTurnButton.classList.add('is-active-p2');
      }
    } else {
      elements.endTurnButton.classList.add('is-idle');
    }
  }

  if (elements.gameShell) {
    elements.gameShell.classList.remove('is-active', 'is-active-p1', 'is-active-p2', 'is-idle');
    if (isMyTurn) {
      if (state.myPlayerId === 'player1') {
        elements.gameShell.classList.add('is-active-p1');
      } else {
        elements.gameShell.classList.add('is-active-p2');
      }
    } else {
      elements.gameShell.classList.add('is-idle');
    }
  }

  if (elements.viewport) {
    elements.viewport.classList.remove('is-active', 'is-active-p1', 'is-active-p2', 'is-idle');
    if (isMyTurn) {
      if (state.myPlayerId === 'player1') {
        elements.viewport.classList.add('is-active-p1');
      } else {
        elements.viewport.classList.add('is-active-p2');
      }
    } else {
      elements.viewport.classList.add('is-idle');
    }
  }
}

function isFreeCard(card) {
  if (!card) return false;
  return Number.isFinite(card.cost) && card.cost === 0;
}

function shouldUseIdolColor(card) {
  if (!card) return false;
  return card.kind === 'idol' || ['ドームライブ', 'アリーナツアー', 'ワンマンライブ'].includes(card.name);
}

function shouldUseSelectionCardDesc(card) {
  return ['書類選考', '事務所オーディション'].includes(card?.name);
}

function isIdolWorkCard(card) {
  return !!(card && card.type === 'idol-work' && /アイドルのお仕事/.test(card.name || ''));
}

function formatCardDescription(desc, card, player = getMyPlayer(), options = {}) {
  if (typeof desc !== 'string') return '';

  const { preserveDynamicPP = false, preserveBasePP = false, stripCostPrefix = false, stripLeadingPPCost = false, formatPPZeroWithSpace = false } = options;
  let normalized = desc.trim();

  if (formatPPZeroWithSpace) {
    normalized = normalized.replace(/\bPP0\b/g, 'PP 0');
  }

  const shouldStripCostPrefix = stripCostPrefix
    ? (card && card.type !== 'produce' && card.type !== 'idol-work' && (Number.isFinite(card.ppCost) || Number.isFinite(card.cost) || card.currency === 'ap' || card.currency === 'm'))
    : (
      card &&
      card.kind !== 'idol' &&
      !(card.type === 'draw' && card.kind === 'idol') &&
      card.type !== 'produce' &&
      card.type !== 'idol-work' &&
      (Number.isFinite(card.ppCost) || Number.isFinite(card.cost) || card.currency === 'ap' || card.currency === 'm') &&
      !preserveBasePP
    );

  if (shouldStripCostPrefix) {
    normalized = normalized.replace(/^\s*(?:PP回復|PP|AP|M)[^<\r\n]*(?:<br\s*\/?>|\r?\n)?/i, '');
  }
  
  const basePPCost = Number.isFinite(card?.ppCost) ? card.ppCost : Number.isFinite(card?.cost) ? card.cost : null;
  const effectivePPCost = card?.kind === 'idol' && player ? getEffectivePPCost(card, player, { consumeNextIdolCostZero: false }) : null;
  const shouldRenderDynamicIdolPP = preserveDynamicPP && card?.kind === 'idol' && basePPCost !== null && effectivePPCost !== null;

  const escaped = normalized
    .replace(/PP回復\+?\d*/g, (match) => `<strong>${match}</strong>`)
    .replace(/PP\s*\+?\d*/g, (match) => {
      if (shouldRenderDynamicIdolPP) {
        const displayText = `PP ${effectivePPCost}`;
        return effectivePPCost !== basePPCost ? `<span class="cost-reduced">${displayText}</span>` : `<strong>${displayText}</strong>`;
      }
      return `<strong>${match}</strong>`;
    })
    .replace(/AP\+?\d*/g, (match) => `<strong>${match}</strong>`)
    .replace(/M\+?\d*/g, (match) => `<strong>${match}</strong>`)
    .replace(/ドロー\+?\d*/g, (match) => `<strong>${match}</strong>`);

  return escaped;
}

function getEffectivePPCost(card, player, options = {}) {
  if (!card || !player) return Number.isFinite(card?.ppCost) ? card.ppCost : card?.cost || 0;

  const baseCost = Number.isFinite(card.ppCost) ? card.ppCost : (card.cost || 0);
  const idolFieldCount = Array.isArray(player.playedThisTurn)
    ? player.playedThisTurn.filter((entry) => entry && entry.kind === 'idol').length
    : 0;

  if (card.kind === 'idol' && player.effects?.nextIdolCostZero) {
    if (options.consumeNextIdolCostZero !== false) {
      player.effects.nextIdolCostZero = false;
    }
    return 0;
  }

  if (card.kind === 'idol' && player.effects?.idolPPCostZero) {
    return 0;
  }

  if (card.type === 'radio_recording' || card.type === 'talk_event' || card.type === 'magazine_shoot' || card.type === 'idol-work') {
    return Math.max(0, baseCost - idolFieldCount);
  }

  return baseCost;
}

function getCardCostDisplayMarkup(card, player) {
  if (!card) return '';

  const basePPCost = Number.isFinite(card.ppCost)
    ? card.ppCost
    : (card.type === 'produce' || card.type === 'idol-work' || card.kind === 'idol')
      ? card.cost
      : null;
  if (basePPCost === null) return '';

  const effectivePPCost = getEffectivePPCost(card, player, { consumeNextIdolCostZero: false });
  const isReduced = effectivePPCost !== basePPCost;
  return `<div class="card-meta card-pp-value${isReduced ? ' cost-reduced' : ''}">PP ${effectivePPCost}</div>`;
}

// --- Local helper utilities for CPU/local play ---
function shuffle(array) {
  const a = Array.isArray(array) ? array.slice() : [];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }
  return a;
}

function localCreatePlayer(displayName, id) {
  return {
    id,
    // Use P1/P2 internally for logs, while preserving a user-facing display name for CPU/local mode.
    name: id === 'player1' ? 'P1' : 'P2',
    displayName,
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

function localBuildDeck() {
  const base = [
    ...Array(7).fill({ name: 'プロデュース', cost: 0, value: 1, type: 'produce', desc: 'PP0<br>AP+1' }),
    ...Array(3).fill({ name: 'アイドルのお仕事Lv.1', cost: 0, value: 1, type: 'idol-work', desc: '場のアイドルカード1枚につきM+1', ppCost: 0 })
  ];
  return shuffle(base.map((c) => ({ ...c })));
}

function localBuildIdleDeck() {
  const defs = Array.isArray(IDOL_CARD_DEFS) && IDOL_CARD_DEFS.length ? IDOL_CARD_DEFS : IDOL_CARDS;
  return shuffle(defs.map((c) => ({ ...c })));
}

function localCreateMarket() {
  const defs = Array.isArray(MARKET_CARD_DEFS) ? MARKET_CARD_DEFS.slice() : [];

  const fixedNames = ['街中スカウト', '書類選考', '事務所オーディション'];
  const fixedCards = defs.filter((card) => fixedNames.includes(card?.name));
  const poolCards = defs.filter((card) => !fixedNames.includes(card?.name));

  const aCards = poolCards.filter((card) => typeof card?.internalId === 'string' && /^A\d+$/i.test(card.internalId));
  const mCards = poolCards.filter((card) => typeof card?.internalId === 'string' && /^M\d+$/i.test(card.internalId));

  const getCardIdNumber = (card) => {
    const match = (card?.internalId || '').match(/^([AM])(\d+)$/i);
    return match ? Number(match[2]) : Number.MAX_SAFE_INTEGER;
  };

  const selectedACards = shuffle(aCards).slice(0, 4).sort((a, b) => getCardIdNumber(a) - getCardIdNumber(b));
  let selectedMCards = shuffle(mCards).slice(0, 3).sort((a, b) => getCardIdNumber(a) - getCardIdNumber(b));

  if (selectedMCards.length < 3) {
    const fallbackCard = selectedMCards[0] || mCards[0];
    while (selectedMCards.length < 3 && fallbackCard) {
      selectedMCards.push({ ...fallbackCard });
    }
  }

  const orderedSelectedCards = [];
  const fixedCardNames = ['街中スカウト', '書類選考', '事務所オーディション'];
  fixedCardNames.forEach((name) => {
    const fixedCard = fixedCards.find((card) => card?.name === name);
    if (fixedCard) orderedSelectedCards.push(fixedCard);
  });

  selectedACards.forEach((card) => orderedSelectedCards.push(card));
  selectedMCards.forEach((card) => orderedSelectedCards.push(card));

  const marketCards = orderedSelectedCards.slice(0, 10);
  return marketCards.map((c) => ({ ...c, purchaseCount: 0, purchaseLimit: 10, soldOut: false }));
}

function localSetupPlayerDeck(player) {
  player.deck = localBuildDeck();
  player.idleDeck = localBuildIdleDeck();
  player.hand = [];
  player.discard = [];
  player.playedThisTurn = [];
  player.energy = 3;
  player.resources = { ap: 0, m: 0 };
}

function localDrawInitialHandForTurn(player) {
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
  localCheckUnitCompletion(player, state.game);
}

function localCheckUnitCompletion(player, game) {
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

    const unitMembers = [];
    areas.forEach((area) => {
      const cards = Array.isArray(player[area]) ? player[area] : [];
      cards.forEach((card) => {
        if (card && card.kind === 'idol' && card.unit === unitName) {
          unitMembers.push(card);
        }
      });
    });

    if (unitMembers.length >= requiredCount) {
      if (!game._completedUnitsLog) game._completedUnitsLog = [];
      const completionKey = `${player.id}_${unitName}`;
      if (!game._completedUnitsLog.includes(completionKey)) {
        game._completedUnitsLog.push(completionKey);
        setTimeout(() => {
          if (!game || !Array.isArray(game.log)) return;
          const completionMessage = `${player.name}が${unitName}を完成`;
          if (!game.log.includes(completionMessage)) {
            game.log.unshift(completionMessage);
            localEmitGameUpdate();
          }
        }, 0);
      }
    }
  });
}

// --- Local game actions (mirror server behavior minimally) ---
function startLocalGameVsCPU() {
  state.roomId = 'local';
  state.myPlayerId = 'player1';
  const game = {
    roomId: 'local',
    status: 'playing',
    currentTurn: 'player1',
    message: 'CPU戦を開始しました。',
    market: localCreateMarket(),
    pendingMarketSelection: null,
    log: [],
    specialCardPurchases: {},
    players: {
      player1: localCreatePlayer('あなた', 'player1'),
      player2: localCreatePlayer('CPU', 'player2')
    }
  };

  localSetupPlayerDeck(game.players.player1);
  localSetupPlayerDeck(game.players.player2);
  localDrawInitialHandForTurn(game.players.player1);
  state.game = game;
  state.isBusy = false;
  elements.titleScreen.classList.add('hidden');
  elements.gameScreen.classList.remove('hidden');
  render();
  // if CPU starts, schedule its turn
  if (game.currentTurn === 'player2') setTimeout(cpuTakeTurn, 800);
}

function localEmitGameUpdate() {
  render();
}

function localBuyMarketCard(playerId, cardIndex) {
  const game = state.game;
  if (!game) return;
  const player = game.players[playerId];
  const card = game.market?.[cardIndex];
  if (!card || card.soldOut) return false;
  let available = player.resources?.ap || 0;
  if (card.currency === 'm') available = player.resources?.m || 0;
  const effectiveCost = ['ドームライブ', 'アリーナツアー', 'ワンマンライブ'].includes(card.name) ? 0 : card.cost;
  if (effectiveCost > available) return false;
  if (card.currency === 'ap') player.resources.ap -= effectiveCost;
  else if (card.currency === 'm') player.resources.m -= card.cost;

  if (card.type === 'next_idol_cost_zero') {
    player.effects = player.effects || {};
    player.effects.nextIdolCostZero = true;
    player.energy = Math.min(3, (player.energy || 0) + 1);
    game.log.unshift(`${player.name}が${card.name}を使用してPPを1回復`);
  }
  if (card.type === 'disable_idol_pp') {
    player.effects = player.effects || {};
    player.effects.idolPPCostZero = true;
  }

  if (card.type === 'screening' || card.type === 'audition') {
    if ((player.idleDeck?.length || 0) === 0) return false;
    const drawCount = card.type === 'screening' ? 5 : 10;
    const drawn = [];
    for (let i = 0; i < drawCount; i += 1) {
      if ((player.idleDeck?.length || 0) === 0) break;
      drawn.push(player.idleDeck.shift());
    }

    card.purchaseCount = (card.purchaseCount || 0) + 1;
    if (typeof card.purchaseLimit === 'number' && card.purchaseCount >= card.purchaseLimit) card.soldOut = true;

    game.pendingMarketSelection = { playerId, cardIndex, cardName: card.name, drawn };
    game.message = `${player.displayName || player.name}が${card.name}を購入。選択してください。`;
    localEmitGameUpdate();
    return true;
  }

  if (card.type === 'scout') {
    const selected = player.idleDeck?.pop();
    if (selected) {
      player.discard.push(selected);
      localCheckUnitCompletion(player, game);
      game.log.unshift(`${player.name}が${selected.name}をスカウト`);
    }
  } else {
    player.discard.push(card);
    localCheckUnitCompletion(player, game);
  }

  if (card.currency === 'ap' && typeof card.value === 'number') player.totalEarnedAp += card.value;
  if (card.currency === 'm' && typeof card.value === 'number') player.totalEarnedM += card.value;

  card.purchaseCount = (card.purchaseCount || 0) + 1;
  if (typeof card.purchaseLimit === 'number' && card.purchaseCount >= card.purchaseLimit) card.soldOut = true;

  const skipPurchaseLogCards = ['街中スカウト', '書類選考', '事務所オーディション'];
  if (!skipPurchaseLogCards.includes(card.name)) {
    game.log.unshift(`${player.name}が${card.name}を購入`);
  }

  localEmitGameUpdate();
  return true;
}

function localBuySpecialCard(playerId, cardName) {
  const game = state.game;
  if (!game || game.currentTurn !== playerId || game.status !== 'playing') return false;
  const player = game.players[playerId];
  if (!player) return false;

  const card = SPECIAL_CARDS.find((c) => c.name === cardName);
  if (!card) return false;

  const available = getResourceAmountForCard(player, card);
  const effectiveCost = isFreeCard(card) ? 0 : card.cost;
  if (effectiveCost > available) return false;

  if (card.currency === 'ap') {
    player.resources.ap -= effectiveCost;
  } else if (card.currency === 'm') {
    player.resources.m -= effectiveCost;
  }

  if (!game.specialCardPurchases) game.specialCardPurchases = {};
  const purchasedCount = game.specialCardPurchases[cardName] || 0;
  if (typeof card.purchaseLimit === 'number' && purchasedCount >= card.purchaseLimit) return false;
  game.specialCardPurchases[cardName] = purchasedCount + 1;

  player.discard.push({ ...card });
  localCheckUnitCompletion(player, game);
  if (card.currency === 'ap' && typeof card.value === 'number') {
    player.totalEarnedAp = (player.totalEarnedAp || 0) + card.value;
  }
  if (card.currency === 'm' && typeof card.value === 'number') {
    player.totalEarnedM = (player.totalEarnedM || 0) + card.value;
  }

  const skipLogCards = ['街中スカウト', '書類選考', '事務所オーディション'];
  if (!skipLogCards.includes(card.name)) {
    game.log.unshift(`${player.name}が${card.name}を購入`);
  }
  game.message = `${player.displayName || player.name}が${card.name}を購入。`;
  localEmitGameUpdate();
  return true;
}

function localCheckGameEnd(game, currentPlayerId) {
  if (!game || !currentPlayerId) return false;

  const domePurchased = game.specialCardPurchases?.['ドームライブ'] || 0;
  if (domePurchased >= 3) return true;

  let soldOutCount = 0;
  if (Array.isArray(game.market)) {
    game.market.forEach((card) => {
      if (!card || card.soldOut) soldOutCount += 1;
    });
  }
  if (soldOutCount >= 5) return true;

  const player = game.players?.[currentPlayerId];
  const currentM = player?.resources?.m || 0;
  if (currentM >= 50) return true;

  return false;
}

function localCalculateFinalScores(game) {
  if (!game) return {};

  const UNIT_SCORE_MAP = { 2: 4, 3: 6, 4: 8, 5: 10 };
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

  const results = {};
  Object.keys(game.players || {}).forEach((playerId) => {
    const player = game.players[playerId];
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

    allCards.forEach((card) => {
      if (!card) return;
      if (card.kind === 'idol') {
        scoreIdolCards += 1;
        if (card.unit) {
          if (!unitMembersMap[card.unit]) unitMembersMap[card.unit] = new Set();
          unitMembersMap[card.unit].add(card.name);
        }
      }
      if (card.name === 'ドームライブ') {
        scoreSpecialCards += 15;
      }
      if (card.name === 'アリーナツアー') {
        scoreSpecialCards += 10;
      }
      if (card.name === 'ワンマンライブ') {
        scoreSpecialCards += 5;
      }
    });

    let scoreUnitCompletion = 0;
    const completedUnits = [];
    Object.keys(unitMembersMap).forEach((unitName) => {
      const ownedCount = unitMembersMap[unitName].size;
      const requiredCount = UNIT_MEMBER_COUNTS[unitName] || 0;
      if (requiredCount > 0 && ownedCount === requiredCount) {
        scoreUnitCompletion += UNIT_SCORE_MAP[requiredCount] || 0;
        completedUnits.push(unitName);
      }
    });

    scoreDeckSize = Math.min(20, Math.floor(allCards.length / 3));
    scoreEarnedAp = Math.min(20, Math.floor((player.totalEarnedAp || 0) / 5));
    scoreEarnedM = Math.min(20, Math.floor((player.totalEarnedM || 0) / 10));

    results[playerId] = {
      total: scoreIdolCards + scoreUnitCompletion + scoreDeckSize + scoreEarnedAp + scoreEarnedM + scoreSpecialCards,
      breakdown: {
        idolCards: scoreIdolCards,
        completedUnits,
        unitCompletion: scoreUnitCompletion,
        deckCardCount: allCards.length,
        deckSize: scoreDeckSize,
        earnedAp: scoreEarnedAp,
        earnedM: scoreEarnedM,
        specialCards: scoreSpecialCards
      }
    };
  });

  return results;
}

function localEndGame(game) {
  if (!game) return;
  const scores = localCalculateFinalScores(game);
  const entries = Object.entries(scores).map(([playerId, scoreObject]) => ({ playerId, score: scoreObject.total }));
  const maxScore = entries.reduce((highest, entry) => Math.max(highest, entry.score), 0);
  const winners = entries.filter((entry) => entry.score === maxScore).map((entry) => entry.playerId);

  game.status = 'finished';
  game.finalScores = scores;
  game.winners = winners;
  game.message = winners.length > 1 ? '引き分けです。' : `${game.players[winners[0]]?.name || winners[0]}の勝ちです。`;
  game.log = Array.isArray(game.log) ? game.log : [];
  game.log.unshift(game.message);
}

function localConfirmMarketSelection(playerId, choiceIndex) {
  const game = state.game;
  if (!game || !game.pendingMarketSelection) return;
  const pending = game.pendingMarketSelection;
  if (pending.playerId !== playerId) return;
  const drawn = Array.isArray(pending.drawn) ? pending.drawn : [];
  if (choiceIndex < 0 || choiceIndex >= drawn.length) return;
  const player = game.players[playerId];
  const chosen = drawn[choiceIndex];
  if (chosen) {
    player.discard.push(chosen);
    localCheckUnitCompletion(player, game);
    game.log.unshift(`${player.name}が${chosen.name}をスカウト`);
  }
  player.idleDeck = shuffle([...(player.idleDeck || []), ...drawn.filter((_, i) => i !== choiceIndex)]);
  game.pendingMarketSelection = null;
  game.message = `${player.displayName || player.name}がカードを選択しました。`;
  localEmitGameUpdate();
}

function localEndTurn(playerId) {
  const game = state.game;
  if (!game || game.currentTurn !== playerId) return;
  const currentPlayer = game.players[playerId];
  if (currentPlayer) {
    currentPlayer.discard = [...(currentPlayer.discard || []), ...(currentPlayer.hand || []), ...(currentPlayer.playedThisTurn || [])];
    currentPlayer.hand = [];
    currentPlayer.playedThisTurn = [];
    currentPlayer.resources = { ap: 0, m: 0 };
    currentPlayer.energy = 0;
    localClearTurnEffects(currentPlayer);
    localCheckUnitCompletion(currentPlayer, game);
  }

  if (localCheckGameEnd(game, playerId)) {
    localEndGame(game);
    localEmitGameUpdate();
    return;
  }

  const nextTurn = playerId === 'player1' ? 'player2' : 'player1';
  game.currentTurn = nextTurn;
  const nextPlayer = game.players[nextTurn];
  nextPlayer.playedThisTurn = [];
  nextPlayer.energy = 3;
  nextPlayer.resources = { ap: 0, m: 0 };
  localDrawInitialHandForTurn(nextPlayer);
  game.message = `${nextPlayer.displayName || nextPlayer.name}のターンです。`;
  game.log.unshift(`${nextPlayer.name}のターン`);
  localEmitGameUpdate();
  if (nextTurn === 'player2') setTimeout(cpuTakeTurn, 600);
}

function cpuTakeTurn() {
  const game = state.game;
  if (!game || game.currentTurn !== 'player2') return;
  const cpu = game.players.player2;

  // If pending selection for CPU, choose random and continue playing after selection.
  if (game.pendingMarketSelection && game.pendingMarketSelection.playerId === 'player2') {
    const choices = game.pendingMarketSelection.drawn || [];
    const pick = Math.max(0, Math.floor(Math.random() * choices.length));
    localConfirmMarketSelection('player2', pick);
    setTimeout(() => cpuTakeTurn(), 300);
    return;
  }

  const getPlayableHandCards = () => {
    const playable = [];
    for (let i = 0; i < cpu.hand.length; i += 1) {
      const card = cpu.hand[i];
      const cost = getEffectivePPCost(card, cpu, { consumeNextIdolCostZero: false });
      if (cost <= cpu.energy) playable.push({ card, index: i, cost });
    }
    return playable;
  };

  const getAffordableMarketCards = () => {
    const cards = [];
    game.market.forEach((card, idx) => {
      if (!card || card.soldOut) return;
      const available = card.currency === 'm' ? (cpu.resources?.m || 0) : (cpu.resources?.ap || 0);
      const effectiveCost = ['ドームライブ', 'アリーナツアー', 'ワンマンライブ'].includes(card.name) ? 0 : card.cost;
      if (effectiveCost <= available) cards.push({ card, index: idx, cost: effectiveCost });
    });
    return cards;
  };

  const chooseBestHandCard = (cards) => {
    if (!cards.length) return null;
    const priority = (card) => {
      if (card.type === 'produce') return 6;
      if (card.type === 'campaign_girl') return 5;
      if (card.type === 'talk_event' || card.type === 'magazine_shoot' || card.type === 'recover_pp') return 4;
      if (card.type === 'self_training' || card.type === 'special_training') return 3;
      if (card.type === 'draw') return card.kind === 'idol' ? 2 : 1;
      return 0;
    };
    return cards.reduce((best, candidate) => {
      const score = priority(candidate.card);
      if (!best || score > best.score || (score === best.score && candidate.cost < best.cost)) {
        return { index: candidate.index, score, cost: candidate.cost };
      }
      return best;
    }, null)?.index;
  };

  const chooseBestMarketCard = (cards) => {
    if (!cards.length) return null;
    // Prefer affordable resource cards and cheap cards first.
    return cards.reduce((best, candidate) => {
      const value = ['ドームライブ', 'アリーナツアー', 'ワンマンライブ'].includes(candidate.card.name) ? 1 : (candidate.card.currency === 'ap' ? 3 : 2);
      if (!best || value > best.value || (value === best.value && candidate.cost < best.cost)) {
        return { index: candidate.index, value, cost: candidate.cost };
      }
      return best;
    }, null)?.index;
  };

  let actionTaken = false;
  while (true) {
    if (game.pendingMarketSelection && game.pendingMarketSelection.playerId === 'player2') {
      const choices = game.pendingMarketSelection.drawn || [];
      const pick = Math.max(0, Math.floor(Math.random() * choices.length));
      localConfirmMarketSelection('player2', pick);
      actionTaken = true;
      continue;
    }

    const playable = getPlayableHandCards();
    if (playable.length) {
      const bestHandIndex = chooseBestHandCard(playable);
      if (bestHandIndex !== null) {
        localPlayCard('player2', bestHandIndex);
        actionTaken = true;
        continue;
      }
    }

    const affordableMarket = getAffordableMarketCards();
    if (affordableMarket.length) {
      const bestMarketIndex = chooseBestMarketCard(affordableMarket);
      if (bestMarketIndex !== null) {
        localBuyMarketCard('player2', bestMarketIndex);
        actionTaken = true;
        if (state.game.pendingMarketSelection) {
          setTimeout(() => cpuTakeTurn(), 600);
          return;
        }
        continue;
      }
    }

    break;
  }

  setTimeout(() => localEndTurn('player2'), 300);
}

function localApplyCardPlayEffect(player, card, game) {
  if (!player || !card) return;
  player.resources = player.resources || { ap: 0, m: 0 };

  if (card.type === 'next_idol_cost_zero') {
    player.effects = player.effects || {};
    player.effects.nextIdolCostZero = true;
    player.energy = Math.min(3, (player.energy || 0) + 1);
    if (game) game.log.unshift(`${player.name}が${card.name}を使用してPPを1回復`);
    return;
  }

  if (card.type === 'disable_idol_pp') {
    player.effects = player.effects || {};
    player.effects.idolPPCostZero = true;
    return;
  }

  if (card.kind === 'idol') {
    player.resources.ap = (player.resources.ap || 0) + 1;
    player.totalEarnedAp = (player.totalEarnedAp || 0) + 1;
    localCheckUnitCompletion(player, game);
  }

  if (card.type === 'recover_pp') {
    player.energy = Math.min(3, (player.energy || 0) + 2);
    if (game) game.log.unshift(`${player.name}が${card.name}を使用してPPを回復`);
    return;
  }

  if (card.type === 'discard_hand_draw') {
    const handCards = Array.isArray(player.hand) ? player.hand : [];
    if (handCards.length) {
      player.discard = Array.isArray(player.discard) ? [...player.discard, ...handCards] : [...handCards];
      player.hand = [];
    }
    localCheckUnitCompletion(player, game);
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
    if (game) game.log.unshift(`${player.name}が${card.name}を使用して手札を捨て、${drawCount}枚引いてPPを1回復`);
    return;
  }

  if (card.type === 'radio_recording' || card.type === 'draw') {
    const drawCount = card.effectValue || card.value || 1;
    for (let i = 0; i < drawCount; i += 1) {
      if (player.deck.length === 0) {
        if (player.discard.length === 0) break;
        player.deck = shuffle(player.discard);
        player.discard = [];
      }
      const drawnCard = player.deck.pop();
      if (drawnCard) player.hand.push(drawnCard);
    }
    if (game) game.log.unshift(`${player.name}が${card.name}を使用して${drawCount}枚引きました`);
    return;
  }

  if (card.type === 'talk_event' || card.type === 'magazine_shoot') {
    const drawCount = card.type === 'magazine_shoot' ? (card.effectValue || 1) : 0;
    for (let i = 0; i < drawCount; i += 1) {
      if (player.deck.length === 0) {
        if (player.discard.length === 0) break;
        player.deck = shuffle(player.discard);
        player.discard = [];
      }
      const drawnCard = player.deck.pop();
      if (drawnCard) player.hand.push(drawnCard);
    }
    const healAmount = card.type === 'talk_event' ? (card.effectValue || 2) : 1;
    player.energy = Math.min(3, (player.energy || 0) + healAmount);
    if (game) {
      if (card.type === 'magazine_shoot') {
        game.log.unshift(`${player.name}が${card.name}を使用して${drawCount}枚引き、PPを${healAmount}回復`);
      } else {
        game.log.unshift(`${player.name}が${card.name}を使用してPPを${healAmount}回復`);
      }
    }
    return;
  }

  if (card.type === 'self_training' || card.type === 'special_training') {
    const drawCount = card.effectValue || (card.type === 'special_training' ? 3 : 2);
    for (let i = 0; i < drawCount; i += 1) {
      if (player.deck.length === 0) {
        if (player.discard.length === 0) break;
        player.deck = shuffle(player.discard);
        player.discard = [];
      }
      const drawnCard = player.deck.pop();
      if (drawnCard) player.hand.push(drawnCard);
    }
    const healAmount = card.type === 'special_training' ? 1 : 0;
    player.energy = Math.min(3, (player.energy || 0) + healAmount);
    if (game) {
      const healText = healAmount > 0 ? `、PPを${healAmount}回復` : '';
      game.log.unshift(`${player.name}が${card.name}を使用して${drawCount}枚引きました${healText}`);
    }
    return;
  }

  if (card.type === 'campaign_girl') {
    player.resources.m = (player.resources.m || 0) + 2;
    player.totalEarnedM = (player.totalEarnedM || 0) + 2;
    player.energy = Math.min(3, (player.energy || 0) + 1);
    if (game) game.log.unshift(`${player.name}が${card.name}を使用してM+2、PPを1回復`);
    return;
  }

  if (card.type === 'gacha_ticket') {
    const drawCount = 1;
    for (let i = 0; i < drawCount; i += 1) {
      if (player.idleDeck?.length === 0) break;
      const drawnCard = player.idleDeck.pop();
      if (drawnCard) {
        drawnCard.drawnFromIdleDeck = true;
        if (Array.isArray(player.hand)) player.hand.push(drawnCard);
        else player.hand = [drawnCard];
        if (drawnCard.kind === 'idol') {
          localCheckUnitCompletion(player, game);
        }
        if (game) game.log.unshift(`${player.name}が${drawnCard.name}をスカウト`);
      }
    }
    player.energy = Math.min(3, (player.energy || 0) + 1);
    if (game) game.log.unshift(`${player.name}が${card.name}を使用してアイドルデッキから1枚引きました`);
    return;
  }

  if (card.type === 'reset_hand_to_deck') {
    if (Array.isArray(player.hand) && player.hand.length) {
      player.deck = [...player.deck, ...player.hand];
      player.hand = [];
    }
    return;
  }

  if (card.type === 'reset_hand_to_deck') {
    if (Array.isArray(player.hand) && player.hand.length) {
      player.deck = [...player.deck, ...player.hand];
      player.hand = [];
    }
    return;
  }

  if (card.type === 'produce') {
    player.resources.ap = (player.resources.ap || 0) + 1;
    player.totalEarnedAp = (player.totalEarnedAp || 0) + 1;
    if (game) game.log.unshift(`${player.name}が${card.name}を使用`);
  } else if (card.type === 'idol-work') {
    const idolCount = Array.isArray(player.playedThisTurn) ? player.playedThisTurn.filter((c) => c && c.kind === 'idol').length : 0;
    const gain = (card.value || 1) * idolCount;
    player.resources.m = (player.resources.m || 0) + gain;
    player.totalEarnedM = (player.totalEarnedM || 0) + gain;
    if (game) game.log.unshift(`${player.name}が${card.name}を使用（場のアイドル ${idolCount} 枚で M+${gain}）`);
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
    if (game) game.log.unshift(`${player.name}が${card.name}を使用して${count}枚引きました`);
  }
}

function localPlayCard(playerId, cardIndex) {
  const game = state.game;
  if (!game) return false;
  const player = game.players && game.players[playerId];
  if (!player) return false;
  if (game.currentTurn !== playerId || game.status !== 'playing') return false;
  const card = player.hand && player.hand[cardIndex];
  if (!card) return false;
  const cost = getEffectivePPCost(card, player, { consumeNextIdolCostZero: false });
  if (cost > player.energy) return false;
  // remove from hand and add to playedThisTurn
  player.hand.splice(cardIndex, 1);
  player.playedThisTurn = Array.isArray(player.playedThisTurn) ? player.playedThisTurn : [];
  player.playedThisTurn.push(card);
  player.energy = Math.max(0, (player.energy || 0) - cost);

  localApplyCardPlayEffect(player, card, game);
  localCheckUnitCompletion(player, game);
  game.message = `${player.displayName || player.name}が${card.name}を使用しました。`;
  game.log.unshift(`${player.name}が${card.name}を使用しました。`);
  localEmitGameUpdate();
  return true;
}

function localClearTurnEffects(player) {
  if (!player || !player.effects) return;
  delete player.effects.idolPPCostZero;
  delete player.effects.nextIdolCostZero;
}

function getCardCostLabel(card, player) {
  if (!card) return '';
  const basePPCost = Number.isFinite(card.ppCost)
    ? card.ppCost
    : Number.isFinite(card.cost)
      ? card.cost
      : null;

  if (isFreeCard(card)) return '';
  if (card.currency === 'ap') return `AP ${card.cost}`;
  if (card.currency === 'm') {
    if (basePPCost !== null) {
      const effectiveCost = getEffectivePPCost(card, player, { consumeNextIdolCostZero: false });
      return effectiveCost !== basePPCost ? `<span class="cost-reduced">PP ${effectiveCost}</span>` : `PP ${basePPCost}`;
    }
    return `M ${card.cost}`;
  }
  if (isIdolWorkCard(card)) return 'PP 0';
  if (card.kind === 'idol' && basePPCost !== null) {
    const effectiveCost = getEffectivePPCost(card, player, { consumeNextIdolCostZero: false });
    return effectiveCost !== basePPCost ? `<span class="cost-reduced">PP ${effectiveCost}</span>` : `PP ${basePPCost}`;
  }
  return basePPCost !== null ? `PP ${basePPCost}` : '';
}

function showCardTooltip(event, card) {
  if (!elements.cardTooltip || !card) return;

  const unitLabel = card.unit ? `ユニット: ${card.unit}` : '';
  const costLabel = getCardCostLabel(card, getMyPlayer());
  const effect = formatCardDescription(card.desc || '', card, getMyPlayer(), { stripCostPrefix: true, preserveDynamicPP: card.kind === 'idol' });
  
  elements.cardTooltip.innerHTML = `
    <div class="card-tooltip-title">${card.name}</div>
    ${unitLabel ? `<div class="card-tooltip-meta">${unitLabel}</div>` : ''}
    ${costLabel ? `<div class="card-tooltip-meta">${costLabel}</div>` : ''}
    ${effect ? `<div class="card-tooltip-desc">${effect}</div>` : ''}
  `;
  elements.cardTooltip.classList.remove('hidden');

  const x = Math.min(window.innerWidth - 220, event.clientX + 16);
  const y = Math.min(window.innerHeight - 120, event.clientY + 16);
  elements.cardTooltip.style.left = `${x}px`;
  elements.cardTooltip.style.top = `${y}px`;
}

function hideCardTooltip() {
  if (elements.cardTooltip) {
    elements.cardTooltip.classList.add('hidden');
  }
}

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

function getUnitRemainingLabel(player, card) {
  if (!player || !card || card.kind !== 'idol' || !card.unit) return '';

  const unitSize = UNIT_MEMBER_COUNTS[card.unit] ?? 0;
  if (unitSize === 0) return '';

  const ownedNames = new Set();
  const areas = ['hand', 'deck', 'discard', 'playedThisTurn'];

  areas.forEach((area) => {
    const cards = Array.isArray(player[area]) ? player[area] : [];
    cards.forEach((item) => {
      if (item && item.kind === 'idol' && item.name && item.unit === card.unit) {
        ownedNames.add(item.name);
      }
    });
  });

  ownedNames.add(card.name);
  const ownedCount = ownedNames.size;

  const remaining = Math.max(0, unitSize - ownedCount);
  return `あと${remaining}人`;
}

function getOwnedUnitCount(player, unitName) {
  if (!player || !unitName) return 0;
  const ownedNames = new Set();
  const areas = ['hand', 'deck', 'discard', 'playedThisTurn'];

  areas.forEach((area) => {
    const cards = Array.isArray(player[area]) ? player[area] : [];
    cards.forEach((item) => {
      if (item && item.kind === 'idol' && item.name && item.unit === unitName) {
        ownedNames.add(item.name);
      }
    });
  });

  return ownedNames.size;
}

const IDOL_CARD_ORDER = IDOL_CARDS.reduce((map, card, index) => {
  map[card.name] = index;
  return map;
}, {});

function showIdleDeckList() {
  const player = getMyPlayer();
  if (!player) return;
  const remainingNames = new Set(Array.isArray(player.idleDeck) ? player.idleDeck.map((card) => card.name) : []);
  const modalId = 'idle-deck-list-modal';
  let existing = document.getElementById(modalId);
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = modalId;
  overlay.className = 'modal-overlay';
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) {
      overlay.remove();
    }
  });
  const container = document.createElement('div');
  container.className = 'modal-container';
  container.style.setProperty('width', '1120px', 'important');
  container.style.setProperty('maxWidth', '95vw', 'important');
  container.style.setProperty('height', '630px', 'important');
  container.style.setProperty('maxHeight', '90vh', 'important');
  container.style.setProperty('aspect-ratio', '16 / 9', 'important');

  const list = document.createElement('div');
  list.className = 'modal-list';
  
  // タイトルをリストの最初の子要素に追加
  const listTitle = document.createElement('div');
  listTitle.className = 'modal-list-title';
  listTitle.textContent = 'アイドル山札のリスト';
  list.appendChild(listTitle);

  if (remainingNames.size === 0) {
    const empty = document.createElement('div');
    empty.className = 'modal-empty';
    empty.textContent = '山札にアイドルがいません。';
    list.appendChild(empty);
  } else {
    const groups = IDOL_CARDS.reduce((acc, card) => {
      const unit = card.unit || 'その他';
      if (!acc[unit]) acc[unit] = [];
      acc[unit].push({
        name: card.name,
        present: remainingNames.has(card.name)
      });
      return acc;
    }, {});

    Object.entries(groups).forEach(([unit, idols]) => {
      const group = document.createElement('div');
      group.className = 'modal-list-group';

      const title = document.createElement('div');
      title.className = 'modal-list-group-title';
      title.textContent = unit;
      group.appendChild(title);

      const namesLine = document.createElement('div');
      namesLine.className = 'modal-list-group-items';
      idols.forEach((idol, idx) => {
        const nameSpan = document.createElement('span');
        nameSpan.className = `idol-name${idol.present ? '' : ' missing'}`;
        nameSpan.textContent = idol.name;
        namesLine.appendChild(nameSpan);
        if (idx < idols.length - 1) {
          const separator = document.createElement('span');
          separator.className = 'idol-name-sep';
          separator.textContent = '　';
          namesLine.appendChild(separator);
        }
      });
      group.appendChild(namesLine);

      list.appendChild(group);
    });
  }
  container.appendChild(list);

  overlay.appendChild(container);
  document.body.appendChild(overlay);
}

function attachCardHover(cardElement, card) {
  if (!cardElement || !card) return;
  cardElement.addEventListener('mouseenter', (event) => showCardTooltip(event, card));
  cardElement.addEventListener('mousemove', (event) => showCardTooltip(event, card));
  cardElement.addEventListener('mouseleave', hideCardTooltip);
}

async function buyMarketCard(cardIndex) {
  if (!state.game || !state.myPlayerId || state.isBusy) return;
  if (state.game.currentTurn !== state.myPlayerId || state.game.status !== 'playing') return;

  const myPlayer = getMyPlayer();
  const card = state.game.market?.[cardIndex];
  if (!card) return;
  if (card.soldOut || (typeof card.purchaseLimit === 'number' && (card.purchaseCount || 0) >= card.purchaseLimit)) {
    setStatus('このカードは売り切れです。');
    return;
  }
  const available = getResourceAmountForCard(myPlayer, card);
  const effectiveCost = isFreeCard(card) ? 0 : card.cost;
  const isIdleDeckEmptySelectionCard = ['書類選考', '事務所オーディション'].includes(card.name) && (myPlayer?.idleDeck?.length || 0) === 0;
  if (isIdleDeckEmptySelectionCard) {
    setStatus('アイドル山札が0枚のため選択できません。');
    return;
  }
  if (effectiveCost > available) {
    const label = card.currency === 'ap' ? 'AP' : card.currency === 'm' ? 'M' : 'PP';
    setStatus(`${label}が足りません。`);
    return;
  }

  state.isBusy = true;
  render();

  try {
    if (state.roomId === 'local') {
      const ok = localBuyMarketCard(state.myPlayerId, cardIndex);
      state.isBusy = false;
      render();
      if (!ok) setStatus('購入に失敗しました。');
      return;
    }
    socket.emit('buy_market_card', {
      roomId: state.roomId,
      playerId: state.myPlayerId,
      cardIndex
    });
  } catch (error) {
    console.error(error);
    setStatus('マーケットの購入に失敗しました。');
    state.isBusy = false;
    render();
  }
}

async function buySpecialCard(cardName) {
  if (!state.game || !state.myPlayerId || state.isBusy) return;
  if (state.game.currentTurn !== state.myPlayerId || state.game.status !== 'playing') return;

  const myPlayer = getMyPlayer();
  const card = SPECIAL_CARDS.find((c) => c.name === cardName);
  if (!card) return;

  const purchasedCount = state.game?.specialCardPurchases?.[card.name] || 0;
  const isSoldOut = typeof card.purchaseLimit === 'number' && purchasedCount >= card.purchaseLimit;
  if (isSoldOut) {
    setStatus('このカードは売り切れです。');
    return;
  }
  
  const available = getResourceAmountForCard(myPlayer, card);
  const effectiveCost = isFreeCard(card) ? 0 : card.cost;
  if (effectiveCost > available) {
    const label = card.currency === 'ap' ? 'AP' : card.currency === 'm' ? 'M' : 'PP';
    setStatus(`${label}が足りません。`);
    return;
  }

  state.isBusy = true;
  render();

  try {
    if (state.roomId === 'local') {
      const ok = localBuySpecialCard(state.myPlayerId, cardName);
      state.isBusy = false;
      render();
      if (!ok) setStatus('特殊カードの購入に失敗しました。');
      return;
    }

    socket.emit('buy_special_card', {
      roomId: state.roomId,
      playerId: state.myPlayerId,
      cardName
    });
  } catch (error) {
    console.error(error);
    setStatus('特殊カードの購入に失敗しました。');
    state.isBusy = false;
    render();
  }
}

function render() {
  const game = state.game;
  const myPlayer = getMyPlayer();
  const opponent = getOpponentPlayer();

  // render market (10 cards, 2 columns x 5 rows)
  if (elements.market) {
    elements.market.innerHTML = '';
    if (game && Array.isArray(game.market) && game.market.length) {
      game.market.forEach((card, index) => {
        const el = document.createElement('div');
        el.className = 'market-card';

        if (!card) {
          el.classList.add('market-empty');
          el.innerHTML = '';
          elements.market.appendChild(el);
          return;
        }

        if (card.kind === 'idol') el.classList.add('idol-card');
        if (card.type === 'idol-work') el.classList.add('idol-work-card');
        if (card.type === 'produce') el.classList.add('produce-card');
        if (shouldUseSelectionCardDesc(card)) {
          el.classList.add('card-selection-desc');
        }
        if (['街中スカウト', '書類選考', '事務所オーディション'].includes(card.name)) {
          el.classList.add('market-card-green');
        }
        if (isFreeCard(card)) {
          el.classList.add('free-card');
        }
        const currencyLabel = card.currency === 'ap' ? 'AP' : card.currency === 'm' ? 'M' : 'PP';
        const remaining = typeof card.purchaseLimit === 'number' ? `${card.purchaseCount || 0}/${card.purchaseLimit}` : '';
        const isSoldOut = card.soldOut || (typeof card.purchaseLimit === 'number' && (card.purchaseCount || 0) >= card.purchaseLimit);

        if (isSoldOut) {
          // show an empty slot for sold-out cards and empty placeholders
          el.classList.add('market-empty');
          el.innerHTML = '';
        } else {
          // position is handled by CSS
          const remainingNumber = typeof card.purchaseLimit === 'number' ? Math.max(0, (card.purchaseLimit || 0) - (card.purchaseCount || 0)) : null;
          const costMarkup = getCardCostDisplayMarkup(card, null);
          el.innerHTML = `
              <div class="card-title">${card.name}</div>
              ${costMarkup}
              <div class="card-meta">${formatCardDescription(card.desc, card, null, { preserveDynamicPP: false, stripCostPrefix: true })}</div>
            `;
          const badgeCurrency = card.currency === 'ap' ? 'ap' : card.currency === 'm' ? 'm' : 'pp';
          const costBadge = document.createElement('div');
          costBadge.className = `market-cost-badge market-cost-badge-${badgeCurrency}`;
          costBadge.textContent = String(card.cost);
          el.appendChild(costBadge);
          // add a small badge showing remaining count if applicable
          if (remainingNumber !== null) {
            const badge = document.createElement('div');
            badge.className = 'market-stock-badge';
            badge.textContent = String(remainingNumber);
            el.appendChild(badge);
          }
          const available = getResourceAmountForCard(myPlayer, card);
          const effectiveCost = isFreeCard(card) ? 0 : card.cost;
          const isIdleDeckEmptySelectionCard = ['書類選考', '事務所オーディション'].includes(card.name) && (myPlayer?.idleDeck?.length || 0) === 0;
          const canAfford = myPlayer && game.currentTurn === myPlayer.id && game.status === 'playing' && !state.isBusy && !isIdleDeckEmptySelectionCard && effectiveCost <= available;
          if (canAfford) {
            el.classList.add('can-buy');
          }
          el.addEventListener('click', () => {
            if (!state.myPlayerId || game.currentTurn !== state.myPlayerId || game.status !== 'playing' || state.isBusy) return;
            const availableForClick = getResourceAmountForCard(myPlayer, card);
            const effectiveCost = isFreeCard(card) ? 0 : card.cost;
            const isIdleDeckEmptySelectionCard = ['書類選考', '事務所オーディション'].includes(card.name) && (myPlayer?.idleDeck?.length || 0) === 0;
            if (isIdleDeckEmptySelectionCard) {
              setStatus('アイドル山札が0枚のため選択できません。');
              return;
            }
            if (effectiveCost > availableForClick) {
              setStatus(`${currencyLabel}が足りません。`);
              return;
            }
            buyMarketCard(index).catch((error) => console.error(error));
          });
        }
        elements.market.appendChild(el);
      });
    } else {
      elements.market.innerHTML = '<p style="color:var(--muted);">マーケットがありません。</p>';
    }
  }

  // render special cards (6 cards, 2x3 grid)
  if (elements.specialCards) {
    elements.specialCards.innerHTML = '';
    SPECIAL_CARDS.forEach((card) => {
      const el = document.createElement('div');
      el.className = 'special-card';
      if (card.type === 'idol-work') {
        el.classList.add('idol-work-card');
      }
      if (isFreeCard(card)) {
        el.classList.add('free-card');
      }
      if (['ドームライブ', 'アリーナツアー', 'ワンマンライブ'].includes(card.name)) {
        el.classList.add('special-card-green');
      }
      const costMarkup = getCardCostDisplayMarkup(card, myPlayer);
      el.innerHTML = `
        <div class="card-title">${card.name}</div>
        ${costMarkup}
        <div class="card-meta">${formatCardDescription(card.desc, card, myPlayer, { preserveDynamicPP: false, stripCostPrefix: true })}</div>
      `;
      // cost badge for special cards
      const badgeCurrency = card.currency === 'ap' ? 'ap' : card.currency === 'm' ? 'm' : 'pp';
      const costBadge = document.createElement('div');
      costBadge.className = `market-cost-badge market-cost-badge-${badgeCurrency}`;
      costBadge.textContent = String(card.cost);
      el.appendChild(costBadge);
      if (typeof card.purchaseLimit === 'number') {
        const purchasedCount = state.game?.specialCardPurchases?.[card.name] || 0;
        const remaining = Math.max(0, card.purchaseLimit - purchasedCount);
        const badge = document.createElement('div');
        badge.className = 'market-stock-badge';
        badge.textContent = String(remaining);
        el.appendChild(badge);
        if (remaining <= 0) {
          el.classList.add('market-empty');
          el.innerHTML = '';
          elements.specialCards.appendChild(el);
          return;
        }
      }
      
      // Add click event for special card purchase
      const specialPlayer = getMyPlayer();
      const available = getResourceAmountForCard(specialPlayer, card);
      const effectiveCost = isFreeCard(card) ? 0 : card.cost;
      const canAfford = specialPlayer && game && game.currentTurn === specialPlayer.id && game.status === 'playing' && !state.isBusy && effectiveCost <= available;
      if (canAfford) {
        el.classList.add('can-buy');
      }
      el.addEventListener('click', () => {
        if (!state.myPlayerId || !game || game.currentTurn !== state.myPlayerId || game.status !== 'playing' || state.isBusy) return;
        const purchasedCount = state.game?.specialCardPurchases?.[card.name] || 0;
        const remaining = card.purchaseLimit ? Math.max(0, card.purchaseLimit - purchasedCount) : Infinity;
        if (remaining <= 0) return;
        const availableForClick = getResourceAmountForCard(specialPlayer, card);
        const effectiveCost = isFreeCard(card) ? 0 : card.cost;
        if (effectiveCost > availableForClick) {
          const label = card.currency === 'ap' ? 'AP' : card.currency === 'm' ? 'M' : 'PP';
          setStatus(`${label}が足りません。`);
          return;
        }
        buySpecialCard(card.name).catch((error) => console.error(error));
      });
      
      elements.specialCards.appendChild(el);
    });
  }

  if (!game) {
    if (elements.hand) elements.hand.innerHTML = '<p style="color:#94a3b8;">部屋に参加してください。</p>';
    if (elements.log) elements.log.innerHTML = '';
    setStatus('部屋を作成または参加してください。');
    return;
  }

  if (elements.endTurnButton) {
    elements.endTurnButton.disabled = !state.myPlayerId || game.currentTurn !== state.myPlayerId || game.status !== 'playing' || state.isBusy;
  }
  if (elements.forceEndConditionButton) {
    elements.forceEndConditionButton.disabled = !state.myPlayerId || game.currentTurn !== state.myPlayerId || game.status !== 'playing' || state.isBusy;
  }

  if (!myPlayer) {
    if (elements.hand) elements.hand.innerHTML = '<p style="color:#94a3b8;">参加していません。</p>';
    setStatus('部屋に参加してください。');
    return;
  }

  const isMyTurn = !!state.myPlayerId && game.currentTurn === state.myPlayerId && game.status === 'playing';
  if (!isMyTurn || !myPlayer || game.status !== 'playing') {
    state.selectedCardIndex = null;
  }

  if (elements.hand) {
    elements.hand.innerHTML = '';
    if (!myPlayer.hand.length) {
      elements.hand.innerHTML = '<p style="color:#94a3b8;">手札がありません。</p>';
    } else {
      myPlayer.hand.forEach((card, index) => {
        const basePPCost = Number.isFinite(card.ppCost) ? card.ppCost : card.cost;
        const effectivePPCost = getEffectivePPCost(card, myPlayer, { consumeNextIdolCostZero: false });
        const canPlay = isMyTurn && effectivePPCost <= myPlayer.energy;
        const cardElement = document.createElement('div');
        cardElement.className = 'card';
        if (shouldUseIdolColor(card)) cardElement.classList.add('idol-card');
        if (card.type === 'idol-work') cardElement.classList.add('idol-work-card');
        if (card.type === 'produce') cardElement.classList.add('produce-card');
        if (shouldUseSelectionCardDesc(card)) cardElement.classList.add('card-selection-desc');
        cardElement.dataset.index = index;
        const ppDisplay = getCardCostDisplayMarkup(card, myPlayer);
        const isLocalCpu = state.roomId === 'local';
        const showPPCostInHand = card.kind !== 'idol' && (!isFreeCard(card) || card.type === 'idol-work' || (card.type === 'produce' && !isLocalCpu));
        cardElement.innerHTML = `
          <div class="card-title">${card.name}</div>
          ${showPPCostInHand ? ppDisplay : ''}
          <div class="card-meta">${formatCardDescription(card.desc, card, myPlayer, { preserveDynamicPP: card.kind === 'idol', stripLeadingPPCost: card.kind !== 'idol' && !(card.type === 'produce' && isLocalCpu), formatPPZeroWithSpace: card.type === 'produce' && isLocalCpu })}</div>
        `;
        if (!canPlay) {
          cardElement.classList.add('is-disabled');
        }
        if (state.selectedCardIndex === index) {
          cardElement.classList.add('is-selected');
        }
        cardElement.addEventListener('click', () => {
          if (!canPlay || state.isBusy) return;
          if (state.selectedCardIndex === index) {
            state.selectedCardIndex = null;
            playCard(index).catch((error) => console.error(error));
          } else {
            state.selectedCardIndex = index;
            render();
          }
        });
        attachCardHover(cardElement, card);
        elements.hand.appendChild(cardElement);
      });
    }
  }

  if (elements.resourceApCount || elements.resourceMCount) {
    if (elements.resourceApCount) {
      elements.resourceApCount.textContent = myPlayer.resources?.ap || 0;
    }
    if (elements.resourceMCount) {
      elements.resourceMCount.textContent = myPlayer.resources?.m || 0;
    }
    if (elements.resourceEnergyCount) {
        elements.resourceEnergyCount.textContent = myPlayer.energy;
      }
      if (elements.resourceEnergyMax) {
        elements.resourceEnergyMax.textContent = 3;
    }
    elements.resourceDeckCount.textContent = myPlayer.deck.length;
    if (elements.resourceDeckTotalCount) {
      elements.resourceDeckTotalCount.textContent = myPlayer.deck.length + myPlayer.hand.length + getDiscardCount(myPlayer);
    }
    elements.resourceDiscardCount.textContent = getDiscardCount(myPlayer);
    if (elements.resourceIdleDeckCount) {
      elements.resourceIdleDeckCount.textContent = myPlayer.idleDeck?.length || 0;
    }
  }

  const deckPanel = document.querySelector('.resource-panel-right');
  const discardPanel = document.querySelector('.resource-panel-discard');
  const idleDeckPanel = document.querySelector('.resource-panel-idle-deck');

  if (deckPanel) {
    deckPanel.classList.toggle('has-cards', (myPlayer.deck?.length || 0) > 0);
  }
  if (discardPanel) {
    discardPanel.classList.remove('has-cards');
    discardPanel.onclick = () => {
      const modalId = 'discard-list-modal';
      let existing = document.getElementById(modalId);
      if (existing) existing.remove();

      const overlay = document.createElement('div');
      overlay.id = modalId;
      overlay.className = 'modal-overlay';
      overlay.addEventListener('click', (event) => {
        if (event.target === overlay) {
          overlay.remove();
        }
      });

      const container = document.createElement('div');
      container.className = 'modal-container';
      container.style.setProperty('width', '1120px', 'important');
      container.style.setProperty('maxWidth', '95vw', 'important');
      container.style.setProperty('height', '630px', 'important');
      container.style.setProperty('maxHeight', '90vh', 'important');
      container.style.setProperty('aspect-ratio', '16 / 9', 'important');
      const title = document.createElement('div');
      title.className = 'modal-title';
      title.textContent = '捨て札の一覧';
      container.appendChild(title);

      const list = document.createElement('div');
      list.className = 'modal-card-list';
      const discardCards = Array.isArray(myPlayer.discard) ? myPlayer.discard : [];
      if (discardCards.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'modal-empty';
        empty.textContent = '捨て札はありません。';
        list.appendChild(empty);
      } else {
        // Get hand card dimensions first
        const handCard = document.querySelector('.hand .card');
        let cardWidth = '90px';
        let cardHeight = '130px';
        if (handCard) {
          const rect = handCard.getBoundingClientRect();
          cardWidth = Math.round(rect.width) + 'px';
          cardHeight = Math.round(rect.height) + 'px';
        }
        
        discardCards.forEach((card) => {
          const item = document.createElement('div');
          item.className = 'modal-list-item';
          if (shouldUseIdolColor(card)) item.classList.add('idol-card');
          if (card.type === 'idol-work') item.classList.add('idol-work-card');
          if (card.type === 'produce') item.classList.add('produce-card');
          if (shouldUseSelectionCardDesc(card)) item.classList.add('card-selection-desc');
          const isLocalCpu = state.roomId === 'local';
          const costMarkup = typeof getCardCostDisplayMarkup === 'function' && !(isLocalCpu && card.type === 'produce')
            ? getCardCostDisplayMarkup(card, myPlayer)
            : '';
          item.innerHTML = `
            <div class="card-title">${card?.name || '不明'}</div>
            ${costMarkup}
            <div class="card-meta">${formatCardDescription(card?.desc || '', card, myPlayer, { preserveDynamicPP: false, stripCostPrefix: true, formatPPZeroWithSpace: card.type === 'produce' && isLocalCpu })}</div>
          `;
          // Apply hand card size to modal card with !important
          item.style.setProperty('width', cardWidth, 'important');
          item.style.setProperty('min-width', cardWidth, 'important');
          item.style.setProperty('max-width', cardWidth, 'important');
          item.style.setProperty('height', cardHeight, 'important');
          item.style.setProperty('min-height', cardHeight, 'important');
          item.style.setProperty('max-height', cardHeight, 'important');
          list.appendChild(item);
        });
      }

      container.appendChild(list);
      overlay.appendChild(container);
      document.body.appendChild(overlay);
    };
  }
  if (idleDeckPanel) {
    idleDeckPanel.classList.toggle('has-cards', (myPlayer.idleDeck?.length || 0) > 0);
  }

  if (elements.playedArea) {
    elements.playedArea.innerHTML = '';
    if (myPlayer.playedThisTurn && myPlayer.playedThisTurn.length > 0) {
      myPlayer.playedThisTurn.forEach((card) => {
        const el = document.createElement('div');
        el.className = 'played-card';
        if (shouldUseIdolColor(card)) el.classList.add('idol-card');
        if (card.type === 'idol-work') el.classList.add('idol-work-card');
        if (card.type === 'produce') el.classList.add('produce-card');
        if (shouldUseSelectionCardDesc(card)) el.classList.add('card-selection-desc');
        const isLocalCpu = state.roomId === 'local';
        const costMarkup = !(isLocalCpu && card.type === 'produce')
          ? getCardCostDisplayMarkup(card, myPlayer)
          : '';
        el.innerHTML = `
          <div class="card-title">${card.name}</div>
          ${costMarkup}
          <div class="card-meta">${formatCardDescription(card.desc, card, myPlayer, { preserveDynamicPP: false, stripCostPrefix: true, formatPPZeroWithSpace: card.type === 'produce' && isLocalCpu })}</div>
        `;
        elements.playedArea.appendChild(el);
      });
    }
  }

  updateTurnHighlight();

  if (elements.log) {
    elements.log.innerHTML = '';
    const logItems = game.log.length ? game.log : ['カードを使って戦いましょう。'];
    logItems.forEach((item) => {
      const li = document.createElement('li');
      li.textContent = item;
      elements.log.appendChild(li);
    });
  }

  if (elements.sidebarHistoryFilter) {
    elements.sidebarHistoryFilter.innerHTML = '';
    const p2Label = state.roomId === 'local' ? 'CPU' : 'P2';
    const filters = [
      { key: 'all', label: '全体' },
      { key: 'player1', label: 'P1' },
      { key: 'player2', label: p2Label }
    ];

    filters.forEach(({ key, label }) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'history-filter-btn';
      if (state.historyFilter === key) {
        button.classList.add('is-active');
      }
      button.textContent = label;
      button.addEventListener('click', () => {
        state.historyFilter = key;
        render();
      });
      elements.sidebarHistoryFilter.appendChild(button);
    });
  }

  // render sidebar history (only keep idol addition and card acquisition events)
  if (elements.sidebarHistory) {
    elements.sidebarHistory.innerHTML = '';
    const historyItems = Array.isArray(game.log)
      ? game.log.filter((item) => isSidebarHistoryEntry(item)).filter((item) => {
          if (state.historyFilter === 'player1') return item.startsWith('P1');
          if (state.historyFilter === 'player2') return item.startsWith('P2');
          return true;
        })
      : [];

    historyItems.forEach((item) => {
      const li = document.createElement('li');
      li.classList.add('history-action');
      if (item.startsWith('P1')) {
        li.classList.add('history-header-p1');
      } else if (item.startsWith('P2')) {
        li.classList.add('history-header-p2');
      }

      // Display: if in local mode, replace visible 'P2' prefix with 'CPU' while keeping underlying log data intact
      const displayItem = state.roomId === 'local' ? item.replace(/^P2(?=が|\s|$)/, 'CPU') : item;
      const completionMatch = displayItem.match(/^(.*?が)(.+)を完成$/);
      if (completionMatch) {
        const [, prefix, unitName] = completionMatch;
        const prefixSpan = document.createElement('span');
        prefixSpan.textContent = prefix;
        const unitSpan = document.createElement('span');
        unitSpan.className = 'history-unit-name';
        unitSpan.textContent = unitName;
        const suffixSpan = document.createElement('span');
        suffixSpan.textContent = 'を完成';
        li.appendChild(prefixSpan);
        li.appendChild(unitSpan);
        li.appendChild(suffixSpan);
      } else {
        li.textContent = displayItem;
      }

      elements.sidebarHistory.appendChild(li);
    });
  }

  setStatus(game.message || 'ゲーム中です。');

  if (game.status === 'finished') {
    if (!state.finishedReportShown && !document.getElementById('finished-report-prompt-overlay')) {
      renderFinishedReportPrompt(game);
    }
  }

  // render pending market selection modal if present and owned by me
  if (game.pendingMarketSelection && game.pendingMarketSelection.playerId === state.myPlayerId) {
    const modalId = 'market-selection-modal';
    // remove existing
    let existing = document.getElementById(modalId);
    if (existing) existing.remove();
    const modal = document.createElement('div');
    modal.id = modalId;
    modal.className = 'modal-overlay';
    const container = document.createElement('div');
    container.className = 'modal-container';
    container.style.setProperty('width', '900px', 'important');
    container.style.setProperty('maxWidth', '92vw', 'important');
    container.style.setProperty('height', '500px', 'important');
    container.style.setProperty('maxHeight', '86vh', 'important');
    container.style.setProperty('aspect-ratio', '16 / 9', 'important');
    container.style.setProperty('padding', '12px 16px', 'important');
    container.style.setProperty('box-sizing', 'border-box', 'important');
    container.style.setProperty('display', 'flex', 'important');
    container.style.setProperty('flex-direction', 'column', 'important');
    container.style.setProperty('justify-content', 'center', 'important');
    container.style.setProperty('align-items', 'center', 'important');
    container.style.setProperty('gap', '8px', 'important');
    container.style.setProperty('position', 'relative', 'important');
    const title = document.createElement('div');
    title.className = 'modal-title';
    title.textContent = 'カードを1枚選択してください';
    container.appendChild(title);
    const prompt = document.createElement('div');
    prompt.className = 'modal-selection-prompt';
    prompt.textContent = '1枚アイドルを選択してください';
    prompt.style.setProperty('width', '100%', 'important');
    prompt.style.setProperty('text-align', 'center', 'important');
    container.appendChild(prompt);
    const choices = document.createElement('div');
    const drawnCards = Array.isArray(game.pendingMarketSelection?.drawn) ? game.pendingMarketSelection.drawn : [];
    const shouldUseTwoRowLayout = drawnCards.length > 5;
    choices.className = shouldUseTwoRowLayout ? 'modal-choices modal-choices-audition' : 'modal-choices';
    if (shouldUseTwoRowLayout) {
      choices.style.display = 'grid';
      choices.style.gridTemplateColumns = 'repeat(5, 126px)';
      choices.style.gridTemplateRows = 'repeat(2, 168px)';
      choices.style.justifyContent = 'center';
      choices.style.alignContent = 'center';
      choices.style.justifyItems = 'center';
      choices.style.alignItems = 'start';
      choices.style.gap = '4px';
      choices.style.columnGap = '4px';
      choices.style.rowGap = '4px';
      choices.style.overflowX = 'hidden';
      choices.style.overflowY = 'hidden';
      choices.style.margin = '0 auto';
      choices.style.width = 'fit-content';
      choices.style.maxWidth = '100%';
    } else {
      choices.style.display = 'flex';
      choices.style.flexDirection = 'row';
      choices.style.flexWrap = 'nowrap';
      choices.style.justifyContent = 'center';
      choices.style.alignItems = 'flex-start';
      choices.style.gap = '6px';
      choices.style.padding = '4px 2px 6px';
      choices.style.margin = '0 auto';
      choices.style.width = 'fit-content';
      choices.style.maxWidth = '100%';
    }
    drawnCards.forEach((card, idx) => {
      const c = document.createElement('div');
      c.className = 'choice-card';
      if (card.kind === 'idol') c.classList.add('idol-card');
      if (card.type === 'idol-work') c.classList.add('idol-work-card');
      if (card.type === 'produce') c.classList.add('produce-card');
      const progress = getUnitRemainingLabel(getMyPlayer(), card);
      c.innerHTML = `
        <div class="card-title">${card.name}</div>
        <div class="card-meta">${progress}</div>
      `;
      c.addEventListener('click', () => {
        console.log('modal choice clicked', idx, card);
        confirmMarketSelection(idx).catch((e) => console.error(e));
      });
      choices.appendChild(c);
    });
    container.appendChild(choices);
    modal.appendChild(container);
    document.body.appendChild(modal);
  } else {
    const existing = document.getElementById('market-selection-modal');
    if (existing) existing.remove();
  }
}

function renderFinishedReportPrompt(game) {
  const overlay = document.createElement('div');
  overlay.id = 'finished-report-prompt-overlay';
  overlay.className = 'finished-prompt-overlay';

  const card = document.createElement('div');
  card.className = 'prompt-card';

  const message = document.createElement('p');
  let reasonText = 'M50以上の獲得に成功しました。決算画面へ移ります。';
  try {
    const domePurchased = game.specialCardPurchases?.['ドームライブ'] || 0;
    if (domePurchased >= 3) {
      reasonText = 'ドームライブが売切れました。決算画面へ移ります。';
    } else {
      let soldOutCount = 0;
      if (Array.isArray(game.market)) {
        game.market.forEach((card) => {
          if (!card || card.soldOut) soldOutCount += 1;
        });
      }
      if (soldOutCount >= 5) {
        reasonText = 'マーケットが5種類売切れました。決算画面へ移ります。';
      } else {
        const player1M = Number(game.players?.player1?.resources?.m || 0);
        const player2M = Number(game.players?.player2?.resources?.m || 0);

        if (player1M >= 50 || player2M >= 50) {
          reasonText = 'M50以上の獲得に成功しました。決算画面へ移ります。';
        }
      }
    }
  } catch (e) {
    reasonText = 'M50以上の獲得に成功しました。決算画面へ移ります。';
  }
  message.innerHTML = String(reasonText).replace(/\n/g, '<br>');
  card.appendChild(message);

  const nextButton = document.createElement('button');
  nextButton.type = 'button';
  nextButton.textContent = '次へ';
  nextButton.addEventListener('click', () => {
    const prompt = document.getElementById('finished-report-prompt-overlay');
    if (prompt) prompt.remove();
    state.finishedReportStep = 0;
    state.finishedReportShown = true;
    renderFinishedReportOverlay(game);
  });
  card.appendChild(nextButton);

  overlay.appendChild(card);
  document.body.appendChild(overlay);
}

function showRulesModal() {
  const existing = document.getElementById('rules-modal-overlay');
  if (existing) {
    existing.remove();
  }

  const overlay = document.createElement('div');
  overlay.id = 'rules-modal-overlay';
  overlay.className = 'rules-modal-overlay';
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) {
      overlay.remove();
    }
  });

  const card = document.createElement('div');
  card.className = 'rules-modal-card';

  const title = document.createElement('h2');
  title.className = 'rules-modal-title';
  title.textContent = 'ゲームルール';
  card.appendChild(title);

  const content = document.createElement('div');
  content.className = 'rules-modal-content';

  const pages = [
    {
      title: '',
      lines: [
        'カードを使用し得たリソースからカードを購入しデッキを大きくしましょう。',
        'ゲームの終了条件を満たした際にポイントが高い方がゲームの勝者となります。'
      ]
    },
    {
      title: '',
      lines: [
        '<span class="rules-modal-badge rules-modal-badge--pp">PP</span> カードを使用する際に使うコスト（毎ターン3まで回復）',
        '<span class="rules-modal-badge rules-modal-badge--ap">AP</span> カードを獲得する際に使うコスト',
        '<span class="rules-modal-badge rules-modal-badge--m">M</span> カードを獲得する際に使うコスト'
      ]
    },
    {
      title: '',
      lines: [
        '<div class="rules-modal-heading-center"><strong>ゲームの終了条件</strong></div>',
        'いずれかの条件を満たした状態で<strong>ターン終了ボタンを押す</strong>',
        '<ol class="rules-modal-end-list"><li>ドームライブがマーケットから売切れになる</li><li>マーケットエリアから5枚以上カードが売切れになる</li><li>Mが50を超えた状態になる</li></ol>'
      ]
    },
    {
      title: '',
      lines: [
        '<div class="rules-modal-heading-center"><strong>決算報告書(得点計算)</strong></div>',
        '<ul class="rules-modal-score-list"><li>アイドルカード1枚につき1点</li><li>完成ユニットに応じた追加得点：シーズ4点／3人ユニット6点／ノクチル8点／5人ユニット10点</li><li>デッキ枚数3枚ごとに1点（上限20点）</li><li>累計獲得AP5ごとに1点（上限20点）</li><li>累計獲得M10ごとに1点（上限20点）</li><li>ライブカードに応じた追加得点：ドームライブ15点／アリーナツアー10点／ワンマンライブ5点</li></ul>'
      ]
    },
    {
      title: '',
      lines: [
        '<div class="rules-modal-heading-center"><strong>ゲーム攻略のコツ</strong></div>',
        '<ul class="rules-modal-score-list"><li>Mを大量に獲得するためにはアイドルカードを獲得しましょう</li><li>カード購入に回数制限ありません。どのカードを何枚買うか考えましょう</li><li>アイドル山札をタップすると現在獲得したアイドルを確認できます。ユニットが揃うようにアイドルを獲得しましょう</li></ul>'
      ]
    }
  ];

  let currentPage = 0;

  function renderPage() {
    content.innerHTML = '';
    const page = pages[currentPage];
    if (page.title) {
      const pageHeading = document.createElement('h3');
      pageHeading.className = 'rules-modal-page-title';
      pageHeading.textContent = page.title;
      content.appendChild(pageHeading);
    }

    page.lines.forEach((ruleText) => {
      const paragraph = document.createElement('p');
      paragraph.innerHTML = ruleText;
      content.appendChild(paragraph);
    });

    backButton.textContent = '戻る';
    nextButton.textContent = currentPage === pages.length - 1 ? '次へ' : '次へ';
    backButton.disabled = false;
  }

  const footer = document.createElement('div');
  footer.className = 'rules-modal-footer';

  const backButton = document.createElement('button');
  backButton.type = 'button';
  backButton.className = 'rules-modal-button rules-modal-button--secondary';
  backButton.textContent = '戻る';
  backButton.addEventListener('click', () => {
    if (currentPage === 0) {
      overlay.remove();
      return;
    }
    currentPage -= 1;
    renderPage();
  });

  const nextButton = document.createElement('button');
  nextButton.type = 'button';
  nextButton.className = 'rules-modal-button rules-modal-button--primary';
  nextButton.textContent = '次へ';
  nextButton.addEventListener('click', () => {
    if (currentPage === pages.length - 1) {
      overlay.remove();
      return;
    }
    currentPage += 1;
    renderPage();
  });

  footer.appendChild(backButton);
  footer.appendChild(nextButton);

  renderPage();
  card.appendChild(content);
  card.appendChild(footer);
  overlay.appendChild(card);
  document.body.appendChild(overlay);
}

function renderFinishedReportOverlay(game) {
  const existing = document.getElementById('finished-report-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'finished-report-overlay';
  overlay.className = 'finished-overlay';
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.right = '0';
  overlay.style.bottom = '0';
  overlay.style.zIndex = '1100';
  overlay.style.display = 'grid';
  overlay.style.placeItems = 'center';
  overlay.style.background = 'rgba(15, 23, 42, 0.82)';
  overlay.style.padding = 'max(12px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left))';
  overlay.style.overflowY = 'auto';

  const container = document.createElement('div');
  container.id = 'finished-report-container';
  container.className = 'finished-report-body';
  container.style.margin = 'auto';
  container.style.textAlign = 'center';
  container.style.width = '100%';
  container.style.maxWidth = '900px';
  container.style.boxSizing = 'border-box';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.alignItems = 'center';
  container.style.justifyContent = 'flex-start';
  container.style.gap = '12px';

  const title = document.createElement('div');
  title.className = 'report-title';
  title.textContent = '決算報告書';
  container.appendChild(title);

  const subtitle = document.createElement('div');
  subtitle.className = 'report-subtitle';
  const stepDescriptions = [
    'プロデュースお疲れさまでした。お互いの点数を確認いたしましょう',
    'アイドルカード1枚につき1点',
    'シーズ4点／3人ユニット6点／ノクチル8点／5人ユニット10点',
    'デッキ総枚数を参照して得点(3枚ごとに1点、上限20点)',
    '累計獲得APを参照して得点(5APごとに1点、上限20点)',
    '累計獲得Mを参照して得点(10Mごとに1点、上限20点)',
    'ドームライブ15点／アリーナツアー10点／ワンマンライブ5点',
    (gameContext) => {
      const playerIds = ['player1', 'player2'];
      const players = playerIds.map((id) => ({
        id,
        name: gameContext.players?.[id]?.name || id,
        score: gameContext.finalScores?.[id]?.total ?? 0
      }));
      const maxScore = Math.max(players[0].score, players[1].score);
      const winners = players.filter((player) => player.score === maxScore);
      if (winners.length === 2) {
        return '引き分けです。お二人ともお疲れさまでした。次のプロデュースもよろしくお願いします';
      }
      return `${winners[0].name}の勝利です。お二人ともお疲れさまでした。次のプロデュースもよろしくお願いします`;
    }
  ];
  const stepIndex = Math.min(state.finishedReportStep, stepDescriptions.length - 1);
  const stepText = stepDescriptions[stepIndex];
  subtitle.textContent = typeof stepText === 'function' ? stepText(game) : stepText;
  container.appendChild(subtitle);

  const rows = [
    { key: 'idolCards', label: (data, revealed) => revealed ? `アイドルカード ${data.idolCards}枚` : 'アイドルカード', scoreKey: 'idolCards' },
    { key: 'completedUnits', label: (data, revealed) => {
        if (!revealed) return 'ユニット';
        const names = Array.isArray(data.completedUnits) && data.completedUnits.length
          ? data.completedUnits.join(' ')
          : '未完成';
        return `ユニット ${names}`;
      }, scoreKey: 'unitCompletion' },
    { key: 'deckCardCount', label: (data, revealed) => revealed ? `デッキ総数 ${data.deckCardCount}枚` : 'デッキ総数', scoreKey: 'deckSize' },
    { key: 'earnedAp', label: (data, revealed) => revealed ? `累計AP (${data.earnedApTotal ?? '?'}AP)` : '累計AP', scoreKey: 'earnedAp' },
    { key: 'earnedM', label: (data, revealed) => revealed ? `累計M (${data.earnedMTotal ?? '?'}M)` : '累計M', scoreKey: 'earnedM' },
    { key: 'specialCards', label: (data, revealed) => {
        if (!revealed) return 'ライブカード';
        const counts = ['ドームライブ', 'アリーナツアー', 'ワンマンライブ']
          .filter((cardName) => (data.specialCardCounts?.[cardName] || 0) > 0)
          .map((cardName) => `${cardName}${data.specialCardCounts[cardName]}枚`);
        return counts.length ? `ライブカード ${counts.join(' ')}` : 'ライブカード';
      }, scoreKey: 'specialCards' }
  ];

  const columns = document.createElement('div');
  columns.className = 'report-columns';

  ['player1', 'player2'].forEach((playerId) => {
    const player = game.players?.[playerId];
    const scoreData = game.finalScores?.[playerId];
    const playerName = player?.name || playerId;

    const column = document.createElement('div');
    column.className = 'report-column';

    const header = document.createElement('h3');
    header.textContent = `${playerName} (${playerId})`;
    column.appendChild(header);

    let revealedTotal = 0;
    rows.forEach((row, index) => {
      const isRevealed = state.finishedReportStep > index;
      const label = typeof row.label === 'function'
        ? row.label(scoreData?.breakdown || {}, isRevealed)
        : row.label;
      const actualValue = scoreData?.breakdown?.[row.scoreKey] ?? 0;
      const value = isRevealed ? actualValue : '?';
      if (isRevealed) revealedTotal += actualValue;

      const rowEl = document.createElement('div');
      rowEl.className = 'report-item';
      const labelEl = document.createElement('div');
      labelEl.className = 'report-item-label';
      labelEl.textContent = label;
      const valueEl = document.createElement('div');
      valueEl.className = 'report-item-value';
      valueEl.textContent = value;
      rowEl.appendChild(labelEl);
      rowEl.appendChild(valueEl);
      column.appendChild(rowEl);
    });

    const totalRow = document.createElement('div');
    totalRow.className = 'report-total';
    const totalLabel = document.createElement('div');
    totalLabel.textContent = '合計';
    const totalValue = document.createElement('div');
    totalValue.textContent = state.finishedReportStep === 0 ? '?' : revealedTotal;
    totalRow.appendChild(totalLabel);
    totalRow.appendChild(totalValue);
    column.appendChild(totalRow);

    columns.appendChild(column);
  });

  container.appendChild(columns);

  const maxStep = rows.length + 1;
  const showClose = state.finishedReportStep >= maxStep;

  const prevButton = document.createElement('button');
  prevButton.type = 'button';
  prevButton.textContent = '前へ';
  prevButton.disabled = state.finishedReportStep <= 0;
  prevButton.addEventListener('click', () => {
    if (state.finishedReportStep > 0) {
      state.finishedReportStep -= 1;
      renderFinishedReportOverlay(game);
    }
  });

  const nextButton = document.createElement('button');
  nextButton.type = 'button';
  nextButton.textContent = '次へ';
  nextButton.addEventListener('click', () => {
    if (state.finishedReportStep < maxStep) {
      state.finishedReportStep += 1;
      renderFinishedReportOverlay(game);
    }
  });

  if (showClose) {
    const menuButton = document.createElement('button');
    menuButton.type = 'button';
    menuButton.className = 'report-menu-button';
    menuButton.textContent = 'メニューへ戻る';
    menuButton.addEventListener('click', () => {
      window.location.reload();
    });
    container.appendChild(menuButton);
  }

  const footer = document.createElement('div');
  footer.className = 'report-footer';
  footer.appendChild(prevButton);
  if (!showClose) footer.appendChild(nextButton);
  container.appendChild(footer);

  overlay.appendChild(container);
  document.body.appendChild(overlay);
}

async function createRoom() {
  console.log('createRoom called');
  if (!socket) {
    console.error('socket not ready');
    setStatus('Socket.io に接続できていません。');
    return;
  }

  const roomId = DEFAULT_ROOM_ID;
  await ensureAuthenticated();
  state.roomId = roomId;
  state.myPlayerId = null;
  state.game = null;
  state.isBusy = true;
  state.finishedReportStep = 0;
  state.finishedReportShown = false;
  render();
  subscribeToRoom();
  console.log('create_room を送信します', { roomId, playerId: 'player1' });
  socket.emit('create_room', { roomId, playerId: 'player1' });
  setStatus('部屋の作成を待機しています...');
}

async function joinRoom() {
  console.log('joinRoom called');
  if (!socket) {
    console.error('socket not ready for join');
    setStatus('Socket.io に接続できていません。');
    return;
  }

  const roomId = DEFAULT_ROOM_ID;
  await ensureAuthenticated();
  state.roomId = roomId;
  state.myPlayerId = null;
  state.game = null;
  state.isBusy = true;
  state.finishedReportStep = 0;
  state.finishedReportShown = false;
  subscribeToRoom();
  render();

  try {
    console.log('join_room を送信します', { roomId, playerId: 'player2' });
    socket.emit('join_room', { roomId, playerId: 'player2' });
    console.log('join_room emitted');
    setStatus('参加要求を送信しました。');
  } catch (error) {
    console.error(error);
    setStatus(error.message || '参加に失敗しました。');
  }
}

async function playCard(cardIndex) {
  if (!state.game || !state.myPlayerId || state.isBusy) return;
  if (state.game.currentTurn !== state.myPlayerId || state.game.status !== 'playing') return;

  const myPlayer = getMyPlayer();
  const card = myPlayer?.hand?.[cardIndex];
  if (!card) return;
  const effectiveCost = getEffectivePPCost(card, myPlayer);
  if (effectiveCost > myPlayer.energy) {
    setStatus('PPが足りません。');
    return;
  }

  state.isBusy = true;
  render();

  try {
    if (state.roomId === 'local') {
      // perform local play
      const ok = localPlayCard(state.myPlayerId, cardIndex);
      state.isBusy = false;
      render();
      if (!ok) setStatus('カードの使用に失敗しました。');
      return;
    }
    socket.emit('play_card', {
      roomId: state.roomId,
      playerId: state.myPlayerId,
      cardIndex
    });
  } catch (error) {
    console.error(error);
    setStatus('カードの使用に失敗しました。');
    state.isBusy = false;
    render();
  }
}

async function endTurn() {
  if (!state.game || !state.myPlayerId || state.isBusy) return;
  if (state.game.currentTurn !== state.myPlayerId || state.game.status !== 'playing') return;

  state.isBusy = true;
  render();

  try {
    if (state.roomId === 'local') {
      localEndTurn(state.myPlayerId);
      state.isBusy = false;
      render();
      return;
    }
    socket.emit('end_turn', {
      roomId: state.roomId,
      playerId: state.myPlayerId
    });
  } catch (error) {
    console.error(error);
    setStatus('ターン終了に失敗しました。');
    state.isBusy = false;
    render();
  }
}

async function forceEndCondition() {
  if (!state.game || !state.myPlayerId || state.isBusy) return;
  if (state.game.currentTurn !== state.myPlayerId || state.game.status !== 'playing') return;

  try {
    socket.emit('force_end_condition', {
      roomId: state.roomId,
      playerId: state.myPlayerId
    });
  } catch (error) {
    console.error(error);
    setStatus('デバッグ終了判定の送信に失敗しました。');
  }
}

function showGameScreen() {
  elements.titleScreen.classList.add('hidden');
  elements.gameScreen.classList.remove('hidden');
  render();
}

function toggleDebugPanel(forceOpen = null) {
  if (!elements.debugPanel) return;
  const shouldOpen = forceOpen === null ? elements.debugPanel.classList.contains('hidden') : forceOpen;
  elements.debugPanel.classList.toggle('hidden', !shouldOpen);
  if (shouldOpen) {
    createDebugCardList();
    updateDebugDeckPreview();
  }
}

function triggerDebugEndCondition() {
  if (!elements.forceEndConditionButton || !elements.forceEndConditionButton.classList.contains('debug-action-btn-hidden')) {
    forceEndCondition().catch((error) => console.error(error));
    return;
  }
  if (!state.game || !state.myPlayerId || state.isBusy) return;
}

function updateGameScale() {
  const gameShell = document.querySelector('.game-shell');
  if (!gameShell) return;

  // ゲームの基準となる解像度（16:9）を設定
  // CSS と合わせて 16:9 の基準を 1280x720 に変更
  const baseWidth = 1280;
  const baseHeight = 720;

  // ブラウザの表示領域のサイズを取得
  // できる限り .viewport の内寸を基準にする（外枠に合わせて拡大/縮小するため）
  const viewportEl = document.querySelector('.viewport') || document.documentElement;
  // クライアント幅/高さからパディングを差し引いて、実際に使える内寸を算出する
  const vpStyle = window.getComputedStyle(viewportEl);
  const padLeft = parseFloat(vpStyle.paddingLeft) || 0;
  const padRight = parseFloat(vpStyle.paddingRight) || 0;
  const padTop = parseFloat(vpStyle.paddingTop) || 0;
  const padBottom = parseFloat(vpStyle.paddingBottom) || 0;
  const windowWidth = Math.max(1, (viewportEl.clientWidth || window.innerWidth) - (padLeft + padRight));
  const windowHeight = Math.max(1, (viewportEl.clientHeight || window.innerHeight) - (padTop + padBottom));

  // 画面内に収めるための縮小率を計算（縦横のうち、よりきつい方に合わせる）
  const scaleX = windowWidth / baseWidth;
  const scaleY = windowHeight / baseHeight;
  // 縦方向をより埋めるため、拡大は許可するが上限を設ける
  const MAX_SCALE = 1.15; // 大きめの縦長画面で余白を減らすための上限
  const scale = Math.min(scaleX, scaleY, MAX_SCALE);

  // デバッグ: 計算したスケールを出力
  console.log('updateGameScale', { baseWidth, baseHeight, viewportWidth: windowWidth, viewportHeight: windowHeight, scale });

  // 極端に小さくならないよう最小スケールを設定（視認性確保）
  const MIN_SCALE = 0.45;
  const appliedScale = Math.max(scale, MIN_SCALE);

  // CSS変数にスケール値をセット
  // はみ出す場合は必ず表示領域にフィットするように調整
  const fitsWidth = baseWidth * appliedScale <= windowWidth;
  const fitsHeight = baseHeight * appliedScale <= windowHeight;
  let finalScale = appliedScale;
  if (!fitsWidth || !fitsHeight) {
    // 最小スケールでもはみ出す場合は、強制的にウィンドウに合わせる
    finalScale = Math.min(windowWidth / baseWidth, windowHeight / baseHeight);
  }

  document.documentElement.style.setProperty('--game-scale', finalScale.toString());
  // CSS 側で受け取るため、JSでは CSS変数のみを更新します。
  // 幅/高さは既に CSS で 1280x720 に固定しているため、ここで直接変更しません。
}

function bindEvents() {
  console.log('bindEvents called', { titleCreateRoomButton: !!elements.titleCreateRoomButton, titleJoinRoomButton: !!elements.titleJoinRoomButton });
  
  // ゲーム画面表示の安定化のため、スケーリング処理は初期化時に一度だけ実行する
  updateGameScale();
  window.addEventListener('resize', updateGameScale);
  
  if (!elements.titleCreateRoomButton || !elements.titleJoinRoomButton) {
    console.error('必要なボタン要素が見つかりません', elements);
    return;
  }

  elements.titleCreateRoomButton.addEventListener('click', () => {
    console.log('create button clicked');
    createRoom().catch((error) => console.error(error));
  });
  elements.titleJoinRoomButton.addEventListener('click', () => {
    console.log('join button clicked');
    joinRoom().catch((error) => console.error(error));
  });
  if (elements.titleCpuButton) {
    elements.titleCpuButton.addEventListener('click', () => {
      console.log('cpu button clicked');
      startLocalGameVsCPU();
    });
  }
  if (elements.titleRulesButton) {
    elements.titleRulesButton.addEventListener('click', () => {
      console.log('rules button clicked');
      showRulesModal();
    });
  }
  if (elements.endTurnButton) {
    elements.endTurnButton.addEventListener('click', () => {
      endTurn().catch((error) => console.error(error));
    });
  }
  if (elements.forceEndConditionButton) {
    elements.forceEndConditionButton.addEventListener('click', () => {
      forceEndCondition().catch((error) => console.error(error));
    });
  }
  if (elements.idleDeckPanel) {
    elements.idleDeckPanel.style.cursor = 'pointer';
    elements.idleDeckPanel.addEventListener('click', () => {
      if (state.isBusy || !state.game || !state.myPlayerId) return;
      showIdleDeckList();
    });
  }
  document.addEventListener('keydown', (event) => {
    const modifierPressed = event.ctrlKey || event.metaKey;
    if (modifierPressed && event.shiftKey && (event.key === 'D' || event.key === 'd')) {
      event.preventDefault();
      toggleDebugPanel();
      return;
    }
    if (modifierPressed && event.shiftKey && (event.key === 'E' || event.key === 'e')) {
      event.preventDefault();
      triggerDebugEndCondition();
    }
  });

  // Debug menu bindings (only if elements exist)
  if (elements.debugToggleButton && elements.debugPanel) {
    elements.debugToggleButton.addEventListener('click', () => {
      toggleDebugPanel();
    });
  }
  if (elements.debugToggleButtonGame && elements.debugPanel) {
    elements.debugToggleButtonGame.addEventListener('click', () => {
      toggleDebugPanel();
    });
  }
  if (elements.debugCloseButton && elements.debugPanel) {
    elements.debugCloseButton.addEventListener('click', () => {
      toggleDebugPanel(false);
    });
  }
  
  if (elements.debugApplyDeck) {
    elements.debugApplyDeck.addEventListener('click', () => {
      applyDebugSelectionToServer();
    });
  }
  if (elements.debugClearSelection) {
    elements.debugClearSelection.addEventListener('click', () => {
      clearDebugSelection();
      if (elements.debugOutput) elements.debugOutput.textContent = '選択をクリアしました。';
    });
  }
  if (elements.debugAddResources) {
    elements.debugAddResources.addEventListener('click', () => {
      if (!socket) return;
      const ap = parseInt((elements.debugTurnApInput && elements.debugTurnApInput.value) || '0', 10) || 0;
      const m = parseInt((elements.debugTurnMInput && elements.debugTurnMInput.value) || '0', 10) || 0;
      if (!state.roomId) {
        if (elements.debugOutput) elements.debugOutput.textContent = '先に部屋を作成または参加してから操作してください。';
        return;
      }
      socket.emit('debug_add_resources', { roomId: state.roomId, ap, m });
      socket.once('debug_ack', (msg) => {
        if (elements.debugOutput) elements.debugOutput.textContent = msg?.message || JSON.stringify(msg);
      });
    });
  }
  // room debug toggle removed — operations apply immediately
}

function subscribeToRoom() {
  if (!state.roomId) return;

  socket.off('game_update');
  socket.off('room_ready');
  socket.off('room_error');
  socket.off('connect');
  socket.off('disconnect');

  socket.on('game_update', (updatedGame) => {
    state.isBusy = false;
    state.game = updatedGame;
    render();
  });

  socket.on('room_ready', (payload) => {
    console.log('room_ready received', payload);
    state.isBusy = false;
    if (payload?.game) {
      state.game = payload.game;
    }
    if (payload?.roomId) {
      state.roomId = payload.roomId;
    }
    if (payload?.playerId) {
      state.myPlayerId = payload.playerId;
    }
    if (state.roomId && socket) {
      socket.emit('refresh_room_state', { roomId: state.roomId });
      socket.emit('reload_market_cards', { roomId: state.roomId });
    }
    render();
    showGameScreen();
  });

  socket.on('room_error', (payload) => {
    console.error('room_error received', payload);
    state.isBusy = false;
    console.error('Socket room error', payload);
    setStatus(payload?.message || 'サーバーからの応答に失敗しました。');
    render();
  });

  socket.on('connect', () => {
    setStatus('サーバーに接続しました。');
  });

  socket.on('disconnect', () => {
    setStatus('サーバーとの接続が切れました。');
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    bindEvents();
    render();
  });
} else {
  bindEvents();
  render();
}

async function confirmMarketSelection(choiceIndex) {
  if (!state.roomId || !state.myPlayerId) return;
  state.isBusy = true;
  render();
  try {
    if (state.roomId === 'local') {
      localConfirmMarketSelection(state.myPlayerId, choiceIndex);
      state.isBusy = false;
      render();
      return;
    }
    socket.emit('confirm_market_selection', {
      roomId: state.roomId,
      playerId: state.myPlayerId,
      choiceIndex
    });
  } catch (error) {
    console.error('選択の確定に失敗しました', error);
    setStatus('選択の確定に失敗しました。');
    state.isBusy = false;
    render();
  }
}

})().catch((e) => {
  // top-level catch for the async IIFE so CodePen shows useful errors
  // but doesn't crash silently.
  // eslint-disable-next-line no-console
  console.error('初期化に失敗しました', e);
});
