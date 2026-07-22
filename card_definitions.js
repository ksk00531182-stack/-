function normalizeCardDescription(desc) {
  if (typeof desc !== 'string') return '';
  return desc.trim();
}

function shouldStripLeadingCostPrefix(card, preserveBasePP = false) {
  if (preserveBasePP || !card) return false;
  if (card.kind === 'idol' || (card.type === 'draw' && card.kind === 'idol')) return false;
  if (card.type === 'produce') return false;
  return Number.isFinite(card.ppCost) || Number.isFinite(card.cost) || card.currency === 'ap' || card.currency === 'm';
}

function normalizeCardDescriptionForDisplay(desc, card, options = {}) {
  if (typeof desc !== 'string') return '';

  const { preserveBasePP = false } = options;
  let normalized = desc.trim();

  if (shouldStripLeadingCostPrefix(card, preserveBasePP)) {
    normalized = normalized.replace(/^\s*(?:PP回復|PP|AP|M)[^<\r\n]*(?:<br\s*\/?>|\r?\n)?/i, '');
  }

  return normalized;
}

const IDOL_CARD_DEFS = [
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

const MARKET_CARD_DEFS = [
  { internalId: 'A1', name: '街中スカウト', cost: 2, currency: 'ap', type: 'scout', desc: '即時発動(獲得不可)\nアイドルデッキから1枚を自分の捨て札に加える' },
  { internalId: 'A2', name: '書類選考', cost: 3, currency: 'ap', type: 'screening', desc: '即時発動(獲得不可)\nアイドルデッキから5枚引き1枚を選択し捨て札に加える。残りはアイドルデッキに戻しシャッフルする' },
  { internalId: 'A3', name: '事務所オーディション', cost: 5, currency: 'ap', type: 'audition', desc: '即時発動(獲得不可)\nアイドルデッキから10枚引き1枚を選択し捨て札に加える。残りはアイドルデッキに戻しシャッフルする' },
  { internalId: 'A4', name: 'ラジオ収録', cost: 6, currency: 'ap', type: 'radio_recording', desc: 'PP3\nドロー+2\n場のアイドル1枚につき消費PP -1', effectValue: 2, ppCost: 3 },
  { internalId: 'A5', name: 'トークイベント', cost: 6, currency: 'ap', type: 'talk_event', desc: 'PP3\nPP回復+2\n場のアイドル1枚につき消費PP -1', effectValue: 2, ppCost: 3 },
  { internalId: 'A6', name: '雑誌撮影', cost: 6, currency: 'ap', type: 'magazine_shoot', desc: 'PP3\nドロー+1\nPP回復+1\n場のアイドル1枚につき消費PP -1', effectValue: 1, ppCost: 3 },
  { internalId: 'A7', name: '自主レッスン', cost: 3, currency: 'ap', type: 'self_training', desc: 'PP1\nドロー+2', effectValue: 2, ppCost: 1 },
  { internalId: 'A9', name: 'キャンペーンガール', cost: 2, currency: 'ap', type: 'campaign_girl', desc: 'PP1\nM+2\nPP回復+1', effectValue: 2, ppCost: 1 },
  { internalId: 'M5', name: 'ガシャチケット', cost: 5, currency: 'm', type: 'gacha_ticket', desc: 'PP1\nアイドルデッキから1枚手札に加える\nPP回復+1', effectValue: 1, ppCost: 1 },
  { internalId: 'A8', name: '特別レッスン', cost: 5, currency: 'ap', type: 'special_training', desc: 'PP2<br>ドロー+3<br>PP回復+1', effectValue: 3, ppCost: 2 },
  { internalId: 'M1', name: 'リカバリーソーダ', cost: 6, currency: 'm', type: 'recover_pp', desc: 'PP1\nPP回復+2', effectValue: 2, ppCost: 1 },
  { internalId: 'M2', name: '予定変更付箋', cost: 4, currency: 'm', type: 'discard_hand_draw', desc: 'PP1\n手札を全て捨て札にし、その数＋1枚ドローする\nPP回復+1', effectValue: 1, ppCost: 1 },
  { internalId: 'M3', name: '283プロのTシャツ', cost: 4, currency: 'm', type: 'next_idol_cost_zero', desc: 'PP1\n次に使うアイドルのPPを0にする\nPP回復+1', effectValue: 0, ppCost: 1 },
  { internalId: 'M4', name: '親愛のお守り', cost: 12, currency: 'm', type: 'disable_idol_pp', desc: 'PP2\nこのターンの間、アイドルの消費PPをすべて0にする', effectValue: 0, ppCost: 2 }
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    IDOL_CARD_DEFS,
    MARKET_CARD_DEFS,
    normalizeCardDescription,
    shouldStripLeadingCostPrefix,
    normalizeCardDescriptionForDisplay
  };
}

if (typeof window !== 'undefined') {
  window.cardDefinitions = {
    IDOL_CARD_DEFS,
    MARKET_CARD_DEFS,
    normalizeCardDescription,
    shouldStripLeadingCostPrefix,
    normalizeCardDescriptionForDisplay
  };
}
