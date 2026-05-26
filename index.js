const VIEW = { WIDTH: 384, HEIGHT: 224, SCALE: 2 };
const GROUND_Y = 180;
const GRAVITY = 0.55;
const FRICTION = 0.82;

const PRESIDENTS = [
  {
    id: 'washington',
    name: 'WASHINGTON',
    fullName: 'George Washington',
    color: '#1e3a5f',
    accent: '#c9a227',
    hair: '#e8dcc8',
    stats: { speed: 2.2, power: 1.0, jump: -9.5 },
    special: 'Cherry Chop',
  },
  {
    id: 'lincoln',
    name: 'LINCOLN',
    fullName: 'Abraham Lincoln',
    color: '#1a1a1a',
    accent: '#8b0000',
    hair: '#1a1a1a',
    stats: { speed: 2.0, power: 1.3, jump: -8.5 },
    special: 'Emancipation Slam',
  },
  {
    id: 'roosevelt',
    name: 'ROOSEVELT',
    fullName: 'Theodore Roosevelt',
    color: '#2d5016',
    accent: '#d4a574',
    hair: '#4a3728',
    stats: { speed: 2.5, power: 1.1, jump: -10 },
    special: 'Big Stick',
  },
  {
    id: 'jefferson',
    name: 'JEFFERSON',
    fullName: 'Thomas Jefferson',
    color: '#4a1942',
    accent: '#e8dcc8',
    hair: '#8b7355',
    stats: { speed: 2.3, power: 0.95, jump: -9 },
    special: 'Declaration Drop',
  },
];

const STATES = {
  IDLE: 'idle',
  WALK: 'walk',
  JUMP: 'jump',
  FALL: 'fall',
  PUNCH: 'punch',
  KICK: 'kick',
  BLOCK: 'block',
  HIT: 'hit',
  KO: 'ko',
  WIN: 'win',
};

const SCREENS = {
  TITLE: 'title',
  SELECT: 'select',
  FIGHT: 'fight',
  RESULT: 'result',
};

const keys = {};
let screen = SCREENS.TITLE;
let frame = 0;
let round = 1;
let p1Wins = 0;
let p2Wins = 0;
let timer = 99;
let timerTick = 0;
let shakeFrames = 0;
let particles = [];
let selectIndex = { p1: 0, p2: 1 };
let selectCursor = 0;
let fighters = [];
let roundOver = false;
let roundMessage = '';
let messageTimer = 0;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// Music tracks (place files in ./Audio/)
const musicTracks = {
  title: new Audio('./Audio/title.mp3'),
  select: new Audio('./Audio/select.mp3'),
  fight: new Audio('./Audio/fight.mp3'),
  result: new Audio('./Audio/result.mp3'),
};

Object.values(musicTracks).forEach((a) => {
  a.preload = 'auto';
  a.loop = true;
  a.volume = 0.7;
});

// Playback state
let currentMusic = null;
let userGesture = false;

function setMusicTrack(name) {
  if (!userGesture) return; // wait for user interaction
  const track = musicTracks[name] || null;
  if (currentMusic === track) return;
  if (currentMusic) {
    try {
      currentMusic.pause();
      currentMusic.currentTime = 0;
    } catch (e) {}
  }
  currentMusic = track;
  if (currentMusic) {
    currentMusic.loop = true;
    currentMusic.volume = 0.7;
    currentMusic.play().catch(() => {
      // play might fail due to autoplay rules; will try again on next user gesture
    });
  }
}

// --- SFX: punch / block / hit ---
const sfx = {
  punch: new Audio('./Audio/punch.wav'),
  hit: new Audio('./Audio/hit.wav'),
  block: new Audio('./Audio/block.wav'),
};

Object.values(sfx).forEach((a) => {
  a.preload = 'auto';
  a.volume = 0.9;
});

// playSFX supports overlapping sounds by creating a short-lived clone
function playSFX(name) {
  if (!userGesture) return; // only after user interaction
  const base = sfx[name];
  if (!base) return;
  try {
    // clone to allow overlapping playback
    const inst = base.cloneNode(true);
    inst.play().catch(() => {});
  } catch (e) {
    // fallback: try playing the base (may cut previous)
    try { base.currentTime = 0; base.play().catch(()=>{}); } catch(_) {}
  }
}

function updateMusicForScreen() {
  switch (screen) {
    case SCREENS.TITLE:
      setMusicTrack('title');
      break;
    case SCREENS.SELECT:
      setMusicTrack('select');
      break;
    case SCREENS.FIGHT:
      setMusicTrack('fight');
      break;
    case SCREENS.RESULT:
      setMusicTrack('result');
      break;
    default:
      // stop music if unknown
      setMusicTrack(null);
  }
}

const backgroundFrames = [
  './Background/Background1.png',
  './Background/Background2.png',
  './Background/Background3.png',
  './Background/Background4.png',
].map((src) => {
  const image = new Image();
  image.src = src;
  return image;
});

const backgroundFallback = new Image();
backgroundFallback.src = './Background/Background.png';

const BACKGROUND_ANIMATION = {
  frameHold: 48,
  fadeFrames: 8,
};

const titleBgImage = new Image();
titleBgImage.src = './TitleBackground.png';
let titleBgImageReady = false;
titleBgImage.onload = () => {
  titleBgImageReady = true;
};

const washingtonIdleSheet = new Image();
washingtonIdleSheet.src = './GWSprites/Idle.png';
let washingtonIdleReady = false;
washingtonIdleSheet.onload = () => {
  washingtonIdleReady = true;
};

const washingtonPunchSheet = new Image();
let washingtonPunchSource = washingtonPunchSheet;
let washingtonPunchReady = false;
washingtonPunchSheet.onload = () => {
  washingtonPunchSource = buildTransparentSpriteSheet(washingtonPunchSheet);
  washingtonPunchReady = true;
};
washingtonPunchSheet.src = './GWSprites/Punch.png';

const washingtonWalkSheet = new Image();
let washingtonWalkSource = washingtonWalkSheet;
let washingtonWalkReady = false;
washingtonWalkSheet.onload = () => {
  washingtonWalkSource = buildTransparentSpriteSheet(washingtonWalkSheet);
  washingtonWalkReady = true;
};
washingtonWalkSheet.src = './GWSprites/Walk.png';

const washingtonKickSheet = new Image();
let washingtonKickSource = washingtonKickSheet;
let washingtonKickReady = false;
washingtonKickSheet.onload = () => {
  washingtonKickSource = buildTransparentSpriteSheet(washingtonKickSheet);
  washingtonKickReady = true;
};
washingtonKickSheet.src = './GWSprites/Kick.png';

const washingtonJumpSheet = new Image();
let washingtonJumpSource = washingtonJumpSheet;
let washingtonJumpReady = false;
washingtonJumpSheet.onload = () => {
  washingtonJumpSource = buildTransparentSpriteSheet(washingtonJumpSheet);
  washingtonJumpReady = true;
};
washingtonJumpSheet.src = './GWSprites/Jump.png';

const washingtonBlockSheet = new Image();
let washingtonBlockSource = washingtonBlockSheet;
let washingtonBlockReady = false;
washingtonBlockSheet.onload = () => {
  washingtonBlockSource = buildTransparentSpriteSheet(washingtonBlockSheet);
  washingtonBlockReady = true;
};
washingtonBlockSheet.src = './GWSprites/Block.png';

const washingtonKnockbackSheet = new Image();
let washingtonKnockbackSource = washingtonKnockbackSheet;
let washingtonKnockbackReady = false;
washingtonKnockbackSheet.onload = () => {
  washingtonKnockbackSource = buildTransparentSpriteSheet(washingtonKnockbackSheet);
  washingtonKnockbackReady = true;
};
washingtonKnockbackSheet.src = './GWSprites/Knockback.png';

// LINCOLN SPRITE SHEET - Single combined sheet
const lincolnSpriteSheet = new Image();
let lincolnSpriteSource = lincolnSpriteSheet;
let lincolnSpriteReady = false;
lincolnSpriteSheet.onload = () => {
  lincolnSpriteSource = buildTransparentSpriteSheet(lincolnSpriteSheet);
  lincolnSpriteReady = true;
};
lincolnSpriteSheet.src = './ALSprites/SpriteSheet.png';

const rooseveltSpriteSheet = new Image();
let rooseveltSpriteSource = rooseveltSpriteSheet;
let rooseveltSpriteReady = false;
rooseveltSpriteSheet.onload = () => {
  rooseveltSpriteSource = buildTransparentSpriteSheet(rooseveltSpriteSheet);
  rooseveltSpriteReady = true;
};
rooseveltSpriteSheet.src = './TRSprites/SpriteSheet.png';

const jeffersonSpriteSheet = new Image();
let jeffersonSpriteSource = jeffersonSpriteSheet;
let jeffersonSpriteReady = false;
jeffersonSpriteSheet.onload = () => {
  jeffersonSpriteSource = buildTransparentSpriteSheet(jeffersonSpriteSheet);
  jeffersonSpriteReady = true;
};
jeffersonSpriteSheet.src = './TJSprites/SpriteSheet.png';

const fontSheet = new Image();
let fontSheetReady = false;

const FONT_GRID = {
  // TextFonts.png individual glyph rows use 12px horizontal pitch
  // and 12px vertical pitch.
  startX: 16,
  startY: 89,
  cellW: 12,
  cellH: 12,
  spaceW: 7,
  rows: [
    '!"#$%&\'()*+,-./',
    '0123456789:;<=>?',
    '@ABCDEFGHIJKLMNO',
    'PQRSTUVWXYZ[\\]^_',
    '`abcdefghijklmno',
    'pqrstuvwxyz{|}~',
  ],
};

const fontGlyphs = {};

function buildFontGlyphs() {
  const atlas = document.createElement('canvas');
  atlas.width = fontSheet.width;
  atlas.height = fontSheet.height;
  const atlasCtx = atlas.getContext('2d');
  atlasCtx.imageSmoothingEnabled = false;
  atlasCtx.drawImage(fontSheet, 0, 0);

  FONT_GRID.rows.forEach((row, ri) => {
    for (let ci = 0; ci < row.length; ci++) {
      const cellX = FONT_GRID.startX + ci * FONT_GRID.cellW;
      const cellY = FONT_GRID.startY + ri * FONT_GRID.cellH;
      const pixels = atlasCtx.getImageData(cellX, cellY, FONT_GRID.cellW, FONT_GRID.cellH).data;
      let minX = FONT_GRID.cellW;
      let minY = FONT_GRID.cellH;
      let maxX = -1;
      let maxY = -1;

      for (let py = 0; py < FONT_GRID.cellH; py++) {
        for (let px = 0; px < FONT_GRID.cellW; px++) {
          const alpha = pixels[(py * FONT_GRID.cellW + px) * 4 + 3];
          if (alpha === 0) continue;
          minX = Math.min(minX, px);
          minY = Math.min(minY, py);
          maxX = Math.max(maxX, px);
          maxY = Math.max(maxY, py);
        }
      }

      if (maxX < 0) {
        fontGlyphs[row[ci]] = {
          sx: cellX,
          sy: cellY,
          sw: FONT_GRID.cellW,
          sh: FONT_GRID.cellH,
          yOffset: 0,
          advance: FONT_GRID.cellW,
        };
        continue;
      }

      const sw = maxX - minX + 1;
      const sh = maxY - minY + 1;
      fontGlyphs[row[ci]] = {
        sx: cellX + minX,
        sy: cellY + minY,
        sw,
        sh,
        yOffset: minY,
        advance: Math.max(4, sw + 1),
      };
    }
  });
}

function getBitmapGlyph(ch) {
  return fontGlyphs[ch] || fontGlyphs[ch.toUpperCase()] || fontGlyphs['?'];
}

fontSheet.onload = () => {
  buildFontGlyphs();
  fontSheetReady = true;
};

fontSheet.onerror = () => {
  fontSheetReady = false;
};

fontSheet.src = './TextFonts.png';

const FONT_PHRASES = {
  PUSH_START: { sx: 369, sy: 8, sw: 110, sh: 14 },
  INSERT_COIN: { sx: 369, sy: 25, sw: 110, sh: 14 },
  CONTINUE: { sx: 386, sy: 41, sw: 93, sh: 14 },
  FREE_PLAY: { sx: 369, sy: 57, sw: 110, sh: 14 },
  GAME_OVER: { sx: 369, sy: 73, sw: 110, sh: 14 },
  PLAYER_SELECT: { sx: 353, sy: 88, sw: 126, sh: 14 },
  TIME_DRAW: { sx: 353, sy: 112, sw: 133, sh: 15 },
  OVER_GAME: { sx: 352, sy: 128, sw: 134, sh: 14 },
  FIGHT: { sx: 16, sy: 168, sw: 63, sh: 18 },
  BIG_NUMBERS: { sx: 88, sy: 168, sw: 157, sh: 19 },
  ROUND: { sx: 256, sy: 168, sw: 77, sh: 21 },
  WHITE_NUMBERS: { sx: 16, sy: 192, sw: 156, sh: 14 },
  KO_RED: { sx: 163, sy: 2, sw: 28, sh: 12 },
  KO_BLUE: { sx: 163, sy: 16, sw: 28, sh: 14 },
  BIG_ALPHANUM: { sx: 16, sy: 32, sw: 254, sh: 14 },
};

function bitmapAdvance(glyph, scale, spacing) {
  return Math.max(1, Math.round(glyph.advance * scale)) + spacing;
}

function measureCollectedGlyphs(chars, scale, spacing) {
  return Math.max(0, chars.reduce((sum, glyph) => sum + bitmapAdvance(glyph, scale, spacing), 0) - spacing);
}

function collectBitmapGlyphs(text) {
  const chars = [];
  for (const ch of String(text)) {
    if (ch === ' ') {
      chars.push({ space: true, advance: FONT_GRID.spaceW });
      continue;
    }

    const glyph = getBitmapGlyph(ch);
    if (glyph) chars.push(glyph);
  }
  return chars;
}

function measureBitmapText(text, scale = 1, spacing = 1) {
  return measureCollectedGlyphs(collectBitmapGlyphs(text), scale, spacing);
}

function drawBitmapText(text, x, y, options = {}) {
  const { scale = 1, align = 'left', spacing = 1, baseline = 'top' } = options;
  if (!fontSheetReady) return;

  const chars = collectBitmapGlyphs(text);
  const totalW = measureCollectedGlyphs(chars, scale, spacing);
  let cursorX = x;
  if (align === 'center') cursorX = x - totalW / 2;
  if (align === 'right') cursorX = x - totalW;

  ctx.imageSmoothingEnabled = false;
  for (const g of chars) {
    if (g.space) {
      cursorX += bitmapAdvance(g, scale, spacing);
      continue;
    }

    const dw = Math.max(1, Math.round(g.sw * scale));
    const dh = Math.max(1, Math.round(g.sh * scale));
    const dy = baseline === 'top' ? y + Math.round((g.yOffset || 0) * scale) : y - dh;
    ctx.drawImage(fontSheet, g.sx, g.sy, g.sw, g.sh, Math.round(cursorX), Math.round(dy), dw, dh);
    cursorX += bitmapAdvance(g, scale, spacing);
  }
}

function drawBitmapTextFit(text, x, y, maxWidth, options = {}) {
  const { scale = 1, minScale = 0.55, spacing = 1, ...drawOptions } = options;
  const width = measureBitmapText(text, scale, spacing);
  const fittedScale = width > maxWidth ? Math.max(minScale, scale * (maxWidth / width)) : scale;
  drawBitmapText(text, x, y, { ...drawOptions, scale: fittedScale, spacing });
}

function drawBitmapTextWrapped(text, x, y, maxWidth, options = {}) {
  const { scale = 1, lineGap = 2, spacing = 1, ...drawOptions } = options;
  if (measureBitmapText(text, scale, spacing) <= maxWidth) {
    drawBitmapText(text, x, y, { ...drawOptions, scale, spacing });
    return;
  }

  const words = String(text).split(' ');
  if (words.length < 2) {
    drawBitmapTextFit(text, x, y, maxWidth, { ...drawOptions, scale, spacing });
    return;
  }

  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && measureBitmapText(next, scale, spacing) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);

  const lineHeight = Math.ceil(FONT_GRID.cellH * scale) + lineGap;
  lines.forEach((wrappedLine, i) => {
    drawBitmapTextFit(wrappedLine, x, y + i * lineHeight, maxWidth, {
      ...drawOptions,
      scale,
      spacing,
    });
  });
}

function drawPhrase(key, x, y, options = {}) {
  const { scale = 1, align = 'center', baseline = 'top' } = options;
  const phrase = FONT_PHRASES[key];
  if (!fontSheetReady || !phrase) return;

  const dw = phrase.sw * scale;
  const dh = phrase.sh * scale;
  let dx = x;
  if (align === 'center') dx = x - dw / 2;
  if (align === 'right') dx = x - dw;
  const dy = baseline === 'top' ? y : y - dh;

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    fontSheet,
    phrase.sx,
    phrase.sy,
    phrase.sw,
    phrase.sh,
    Math.round(dx),
    Math.round(dy),
    Math.round(dw),
    Math.round(dh)
  );
}

function isTransparentKeyPixel(data, offset) {
  const r = data[offset];
  const g = data[offset + 1];
  const b = data[offset + 2];
  return r > 215 && g > 215 && b > 215 && Math.max(r, g, b) - Math.min(r, g, b) < 18;
}

function buildTransparentSpriteSheet(image) {
  const spriteCanvas = document.createElement('canvas');
  spriteCanvas.width = image.naturalWidth;
  spriteCanvas.height = image.naturalHeight;

  const spriteCtx = spriteCanvas.getContext('2d');
  spriteCtx.imageSmoothingEnabled = false;
  spriteCtx.drawImage(image, 0, 0);

  const pixels = spriteCtx.getImageData(0, 0, spriteCanvas.width, spriteCanvas.height);
  const { data, width, height } = pixels;
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;

  function enqueue(index) {
    if (visited[index]) return;
    const offset = index * 4;
    if (!isTransparentKeyPixel(data, offset)) return;
    visited[index] = 1;
    data[offset + 3] = 0;
    queue[tail++] = index;
  }

  for (let x = 0; x < width; x++) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    enqueue(y * width);
    enqueue(y * width + width - 1);
  }

  while (head < tail) {
    const index = queue[head++];
    const x = index % width;
    const y = Math.floor(index / width);
    if (x > 0) enqueue(index - 1);
    if (x < width - 1) enqueue(index + 1);
    if (y > 0) enqueue(index - width);
    if (y < height - 1) enqueue(index + width);
  }

  spriteCtx.putImageData(pixels, 0, 0);
  return spriteCanvas;
}

const WASHINGTON_IDLE = {
  animSpeed: 6,
  displayHeight: 76,
  frames: [
    { sx: 36, sy: 138, sw: 214, sh: 396, footX: 106.5 },
    { sx: 281, sy: 140, sw: 203, sh: 393, footX: 101.0 },
    { sx: 512, sy: 138, sw: 204, sh: 396, footX: 101.5 },
    { sx: 743, sy: 140, sw: 204, sh: 394, footX: 101.5 },
    { sx: 965, sy: 140, sw: 203, sh: 393, footX: 101.0 },
    { sx: 1189, sy: 140, sw: 201, sh: 393, footX: 100.0 },
    { sx: 34, sy: 578, sw: 216, sh: 396, footX: 107.5 },
    { sx: 279, sy: 579, sw: 205, sh: 394, footX: 102.0 },
    { sx: 509, sy: 577, sw: 216, sh: 395, footX: 107.5 },
    { sx: 744, sy: 577, sw: 208, sh: 395, footX: 103.5 },
    { sx: 966, sy: 577, sw: 205, sh: 395, footX: 102.0 },
    { sx: 1189, sy: 577, sw: 207, sh: 395, footX: 103.0 },
  ],
};

const WASHINGTON_PUNCH = {
  displayHeight: 76,
  frames: [
    { sx: 137, sy: 60, sw: 372, sh: 486, footX: 177.5 },
    { sx: 672, sy: 61, sw: 518, sh: 485, footX: 174.5 },
    { sx: 1309, sy: 61, sw: 550, sh: 485, footX: 159.0 },
    { sx: 1859, sy: 57, sw: 636, sh: 489, footX: 181.0 },
  ],
};

const WASHINGTON_WALK = {
  animSpeed: 9,
  displayHeight: 84,
  footYOffset: 7,
  frames: [
    { sx: 217, sy: 35, sw: 344, sh: 585, footX: 166.0 },
    { sx: 777, sy: 40, sw: 364, sh: 580, footX: 176.5 },
    { sx: 1354, sy: 39, sw: 352, sh: 581, footX: 174.5 },
    { sx: 1922, sy: 36, sw: 350, sh: 584, footX: 169.0 },
  ],
};

const WASHINGTON_KICK = {
  displayHeight: 86,
  footYOffset: 7,
  frames: [
    { sx: 167, sy: 50, sw: 628, sh: 611, footX: 83.0 },
    { sx: 910, sy: 56, sw: 545, sh: 605, footX: 115.5 },
    { sx: 1603, sy: 75, sw: 467, sh: 587, footX: 191.0 },
  ],
};

const WASHINGTON_JUMP = {
  displayHeight: 84,
  footYOffset: 0,
  frames: [
    { sx: 368, sy: 22, sw: 354, sh: 634, footX: 176.5 },
    { sx: 922, sy: 75, sw: 312, sh: 581, footX: 155.5 },
    { sx: 1464, sy: 173, sw: 301, sh: 483, footX: 150.0 },
  ],
};

const WASHINGTON_BLOCK = {
  displayHeight: 84,
  footYOffset: 7,
  frames: [
    { sx: 256, sy: 103, sw: 384, sh: 675, footX: 191.5 },
    { sx: 984, sy: 103, sw: 492, sh: 675, footX: 191.5 },
  ],
};

const WASHINGTON_KNOCKBACK = {
  displayHeight: 84,
  footYOffset: 7,
  frame: { sx: 327, sy: 135, sw: 668, sh: 794, footX: 333.5 },
};

const MAPPED_SPRITE_SOURCE_HEIGHT = 209;
const MAPPED_SPRITE_DISPLAY_HEIGHT = 92;
const MAPPED_SPRITE_FOOT_Y_OFFSET = 8;

function mappedSpriteFrame(sx, sy, sw, sh, footX, footY = sh) {
  return { sx, sy, sw, sh, footX, footY };
}

const LINCOLN_ANIMATIONS = {
  idle: {
    frames: [
      mappedSpriteFrame(213, 27, 119, 194, 56),
    ],
    animSpeed: 12,
  },

  walk: {
    frames: [
      mappedSpriteFrame(388, 15, 102, 207, 56),
      mappedSpriteFrame(536, 14, 110, 208, 56),
      mappedSpriteFrame(687, 15, 117, 207, 56),
      mappedSpriteFrame(853, 18, 108, 204, 56),
      mappedSpriteFrame(1001, 20, 107, 202, 56),
    ],
    animSpeed: 7,
  },

  punch: {
    frames: [
      mappedSpriteFrame(382, 241, 155, 124, 56),
      mappedSpriteFrame(565, 245, 180, 135, 56),
      mappedSpriteFrame(753, 236, 173, 147, 56),
      mappedSpriteFrame(951, 241, 264, 139, 56),
    ],
    animSpeed: 3,
  },

  kick: {
    frames: [
      mappedSpriteFrame(48, 392, 211, 184, 46),
      mappedSpriteFrame(288, 394, 167, 181, 34),
      mappedSpriteFrame(488, 404, 161, 172, 54),
    ],
    animSpeed: 4,
  },

  jump: {
    frames: [
      mappedSpriteFrame(701, 391, 126, 177, 62),
      mappedSpriteFrame(881, 402, 109, 134, 58),
      mappedSpriteFrame(1056, 402, 116, 165, 62),
    ],
    animSpeed: 5,
  },

  block: {
    frames: [
      mappedSpriteFrame(46, 597, 108, 174, 56),
      mappedSpriteFrame(206, 599, 130, 172, 56),
    ],
    animSpeed: 10,
  },

  knockback: {
    frames: [
      mappedSpriteFrame(367, 811, 148, 156, 74),
      mappedSpriteFrame(550, 810, 136, 142, 68),
    ],
    animSpeed: 8,
  },

  ko: {
    frames: [
      mappedSpriteFrame(730, 899, 274, 50, 137),
      mappedSpriteFrame(774, 749, 214, 40, 107),
    ],
    animSpeed: 20,
  },

  special: {
    frames: [
      mappedSpriteFrame(41, 1023, 118, 188, 56),
      mappedSpriteFrame(206, 1019, 169, 192, 56),
      mappedSpriteFrame(380, 1025, 322, 186, 56),
    ],
    animSpeed: 5,
  },

  win: {
    frames: [
      mappedSpriteFrame(898, 973, 321, 251, 100),
    ],
    animSpeed: 30,
  },
};

const ROOSEVELT_ANIMATIONS = {
  idle: {
    frames: [
      mappedSpriteFrame(208, 26, 101, 174, 52),
    ],
    animSpeed: 12,
  },

  walk: {
    frames: [
      mappedSpriteFrame(433, 37, 108, 163, 54),
      mappedSpriteFrame(587, 38, 112, 162, 56),
      mappedSpriteFrame(741, 37, 105, 163, 54),
      mappedSpriteFrame(890, 39, 102, 162, 52),
      mappedSpriteFrame(1043, 42, 107, 160, 54),
    ],
    animSpeed: 7,
  },

  punch: {
    frames: [
      mappedSpriteFrame(375, 261, 154, 109, 56),
      mappedSpriteFrame(565, 232, 185, 143, 56),
      mappedSpriteFrame(762, 232, 176, 143, 56),
      mappedSpriteFrame(975, 235, 234, 140, 56),
    ],
    animSpeed: 3,
  },

  kick: {
    frames: [
      mappedSpriteFrame(39, 399, 201, 183, 46),
      mappedSpriteFrame(276, 408, 200, 175, 34),
      mappedSpriteFrame(481, 413, 166, 170, 54),
    ],
    animSpeed: 4,
  },

  jump: {
    frames: [
      mappedSpriteFrame(694, 384, 118, 178, 60),
      mappedSpriteFrame(880, 413, 113, 128, 58),
      mappedSpriteFrame(1062, 418, 165, 154, 62),
    ],
    animSpeed: 5,
  },

  block: {
    frames: [
      mappedSpriteFrame(39, 613, 104, 164, 56),
      mappedSpriteFrame(197, 615, 128, 162, 56),
    ],
    animSpeed: 10,
  },

  knockback: {
    frames: [
      mappedSpriteFrame(372, 822, 138, 145, 69),
      mappedSpriteFrame(553, 817, 141, 138, 70),
    ],
    animSpeed: 8,
  },

  ko: {
    frames: [
      mappedSpriteFrame(736, 901, 249, 48, 125),
      mappedSpriteFrame(758, 747, 206, 41, 103),
    ],
    animSpeed: 20,
  },

  special: {
    frames: [
      mappedSpriteFrame(29, 1027, 117, 177, 56),
      mappedSpriteFrame(172, 1033, 202, 170, 56),
      mappedSpriteFrame(352, 1033, 410, 170, 56),
    ],
    animSpeed: 5,
  },

  win: {
    frames: [
      mappedSpriteFrame(904, 960, 331, 245, 100),
    ],
    animSpeed: 30,
  },
};

const JEFFERSON_ANIMATIONS = {
  idle: {
    frames: [
      mappedSpriteFrame(224, 24, 107, 206, 54),
    ],
    animSpeed: 12,
  },

  walk: {
    frames: [
      mappedSpriteFrame(439, 28, 123, 202, 62),
      mappedSpriteFrame(603, 32, 121, 198, 60),
      mappedSpriteFrame(765, 32, 115, 198, 58),
      mappedSpriteFrame(923, 32, 115, 198, 58),
    ],
    animSpeed: 7,
  },

  punch: {
    frames: [
      mappedSpriteFrame(383, 286, 153, 135, 56),
      mappedSpriteFrame(602, 273, 175, 171, 56),
      mappedSpriteFrame(790, 272, 177, 172, 69),
      mappedSpriteFrame(999, 275, 207, 169, 74),
    ],
    animSpeed: 3,
  },

  kick: {
    frames: [
      mappedSpriteFrame(46, 492, 209, 193, 46),
      mappedSpriteFrame(291, 497, 167, 185, 34),
      mappedSpriteFrame(477, 508, 141, 177, 54),
    ],
    animSpeed: 4,
  },

  jump: {
    frames: [
      mappedSpriteFrame(651, 468, 125, 197, 62),
      mappedSpriteFrame(829, 477, 117, 153, 58),
      mappedSpriteFrame(998, 501, 112, 187, 62),
    ],
    animSpeed: 5,
  },

  block: {
    frames: [
      mappedSpriteFrame(43, 714, 102, 181, 56),
      mappedSpriteFrame(185, 716, 137, 179, 56),
    ],
    animSpeed: 10,
  },

  knockback: {
    frames: [
      mappedSpriteFrame(373, 713, 132, 183, 66),
      mappedSpriteFrame(540, 733, 147, 161, 74),
    ],
    animSpeed: 8,
  },

  ko: {
    frames: [
      mappedSpriteFrame(708, 820, 225, 55, 113),
    ],
    animSpeed: 20,
  },

  special: {
    frames: [
      mappedSpriteFrame(32, 976, 127, 197, 56),
      mappedSpriteFrame(197, 981, 172, 192, 56),
      mappedSpriteFrame(376, 982, 367, 191, 56),
    ],
    animSpeed: 5,
  },

  win: {
    frames: [
      mappedSpriteFrame(831, 902, 364, 284, 110),
    ],
    animSpeed: 30,
  },
};

const MAPPED_CHARACTER_SPRITES = {
  lincoln: {
    get ready() {
      return lincolnSpriteReady;
    },
    get source() {
      return lincolnSpriteSource;
    },
    animations: LINCOLN_ANIMATIONS,
  },
  roosevelt: {
    get ready() {
      return rooseveltSpriteReady;
    },
    get source() {
      return rooseveltSpriteSource;
    },
    animations: ROOSEVELT_ANIMATIONS,
  },
  jefferson: {
    get ready() {
      return jeffersonSpriteReady;
    },
    get source() {
      return jeffersonSpriteSource;
    },
    animations: JEFFERSON_ANIMATIONS,
  },
};

function getMappedCharacterSprite(presidentId) {
  return MAPPED_CHARACTER_SPRITES[presidentId] || null;
}

function initCanvas() {
  canvas.width = VIEW.WIDTH;
  canvas.height = VIEW.HEIGHT;
  canvas.style.width = `${VIEW.WIDTH * VIEW.SCALE}px`;
  canvas.style.height = `${VIEW.HEIGHT * VIEW.SCALE}px`;
  canvas.style.imageRendering = 'pixelated';
  ctx.imageSmoothingEnabled = false;
}

class Fighter {
  constructor(president, x, facing, playerNum) {
    this.president = president;
    this.x = x;
    this.y = GROUND_Y;
    this.vx = 0;
    this.vy = 0;
    this.facing = facing;
    this.playerNum = playerNum;
    this.width = 28;
    this.height = 52;
    this.health = 100;
    this.maxHealth = 100;
    this.state = STATES.IDLE;
    this.stateTimer = 0;
    this.stateDuration = 0;
    this.animFrame = 0;
    this.washingtonKickVariant = 0;
    this.nextWashingtonKickVariant = 0;
    this.washingtonJumpVariant = 0;
    this.nextWashingtonJumpVariant = 0;
    this.washingtonBlockVariant = 0;
    this.nextWashingtonBlockVariant = 0;
    this.lincolnKickVariant = 0;
    this.nextLincolnKickVariant = 0;
    this.lincolnJumpVariant = 0;
    this.nextLincolnJumpVariant = 0;
    this.lincolnBlockVariant = 0;
    this.nextLincolnBlockVariant = 0;
    this.mappedBlockVariant = 0;
    this.nextMappedBlockVariant = 0;
    this.hitbox = null;
    this.invincible = 0;
    this.combo = 0;
    this.onGround = true;
  }

  reset(x, facing) {
    this.x = x;
    this.y = GROUND_Y;
    this.vx = 0;
    this.vy = 0;
    this.facing = facing;
    this.health = 100;
    this.state = STATES.IDLE;
    this.stateTimer = 0;
    this.stateDuration = 0;
    this.hitbox = null;
    this.invincible = 60;
    this.onGround = true;
    this.animFrame = 0;
    this.mappedBlockVariant = 0;
    this.nextMappedBlockVariant = 0;
  }

  get hurtbox() {
    return {
      x: this.x - this.width / 2,
      y: this.y - this.height,
      w: this.width,
      h: this.height,
    };
  }

  attackBox(type) {
    const reach = type === 'kick' ? 38 : 28;
    const h = type === 'kick' ? 18 : 14;
    const yOff = type === 'kick' ? 28 : 38;
    const left = this.facing === 1 ? this.x + this.width / 2 + 4 : this.x - this.width / 2 - 4 - reach;
    return {
      x: left,
      y: this.y - yOff,
      w: reach,
      h,
      damage: type === 'kick' ? 12 * this.president.stats.power : 8 * this.president.stats.power,
      knockback: type === 'kick' ? 5 : 3,
      type,
    };
  }

  update(input, opponent) {
    if (this.state === STATES.KO || this.state === STATES.WIN) return;

    this.animFrame++;
    if (this.invincible > 0) this.invincible--;
    if (this.stateTimer > 0) this.stateTimer--;

    if (this.state === STATES.HIT) {
      this.vx *= FRICTION;
      this.vy += GRAVITY;
      this.x += this.vx;
      this.y += this.vy;
      if (this.y >= GROUND_Y) {
        this.y = GROUND_Y;
        this.vy = 0;
        this.onGround = true;
        if (this.stateTimer <= 0) {
          this.state = STATES.IDLE;
          this.stateDuration = 0;
        }
      } else {
        this.onGround = false;
      }
      this.clampPosition();
      return;
    }

    if ([STATES.PUNCH, STATES.KICK].includes(this.state)) {
      if (this.stateTimer <= 0) {
        this.state = STATES.IDLE;
        this.stateDuration = 0;
        this.hitbox = null;
      } else if (this.stateTimer > 8 && !this.hitbox) {
        this.hitbox = this.attackBox(this.state);
      }
      if (this.hitbox) this.checkHit(opponent);
      return;
    }

    const speed = this.president.stats.speed;
    const blocking = input.block && this.onGround;

    if (blocking) {
      if (this.state !== STATES.BLOCK) {
        const mappedSprite = getMappedCharacterSprite(this.president.id);
        if (this.president.id === 'washington') {
          this.washingtonBlockVariant = this.nextWashingtonBlockVariant;
          this.nextWashingtonBlockVariant = (this.nextWashingtonBlockVariant + 1) % WASHINGTON_BLOCK.frames.length;
        } else if (mappedSprite) {
          this.mappedBlockVariant = this.nextMappedBlockVariant;
          this.nextMappedBlockVariant = (this.nextMappedBlockVariant + 1) % mappedSprite.animations.block.frames.length;
        }
      }
      this.state = STATES.BLOCK;
      this.vx *= 0.5;
    } else if (input.punch && this.canAttack()) {
      this.startAttack(STATES.PUNCH, 14);
    } else if (input.kick && this.canAttack()) {
      this.startAttack(STATES.KICK, 20);
    } else if (input.jump && this.onGround) {
      if (this.president.id === 'washington') {
        this.washingtonJumpVariant = this.nextWashingtonJumpVariant;
        this.nextWashingtonJumpVariant = (this.nextWashingtonJumpVariant + 1) % WASHINGTON_JUMP.frames.length;
      } else if (this.president.id === 'lincoln') {
        this.lincolnJumpVariant = this.nextLincolnJumpVariant;
        this.nextLincolnJumpVariant = (this.nextLincolnJumpVariant + 1) % LINCOLN_ANIMATIONS.jump.frames.length;
      }
      this.vy = this.president.stats.jump;
      this.state = STATES.JUMP;
      this.onGround = false;
    } else if (input.left) {
      this.vx = -speed;
      this.facing = -1;
      this.state = STATES.WALK;
    } else if (input.right) {
      this.vx = speed;
      this.facing = 1;
      this.state = STATES.WALK;
    } else {
      this.vx *= FRICTION;
      if (Math.abs(this.vx) < 0.1) this.vx = 0;
      if (this.onGround) this.state = STATES.IDLE;
    }

    if (!this.onGround) {
      this.state = this.vy < 0 ? STATES.JUMP : STATES.FALL;
    }

    this.vy += GRAVITY;
    this.x += this.vx;
    this.y += this.vy;

    if (this.y >= GROUND_Y) {
      this.y = GROUND_Y;
      this.vy = 0;
      this.onGround = true;
    }

    this.clampPosition();
    this.faceOpponent(opponent);

    if (this.hitbox) this.checkHit(opponent);
  }

  canAttack() {
    return this.onGround && [STATES.IDLE, STATES.WALK, STATES.BLOCK].includes(this.state);
  }

  startAttack(type, duration) {
    this.state = type;
    this.stateTimer = duration;
    this.stateDuration = duration;
    this.hitbox = null;
    this.vx = 0;

    if (type === STATES.KICK) {
      if (this.president.id === 'washington') {
        this.washingtonKickVariant = this.nextWashingtonKickVariant;
        this.nextWashingtonKickVariant = (this.nextWashingtonKickVariant + 1) % WASHINGTON_KICK.frames.length;
      } else if (this.president.id === 'lincoln') {
        this.lincolnKickVariant = this.nextLincolnKickVariant;
        this.nextLincolnKickVariant = (this.nextLincolnKickVariant + 1) % LINCOLN_ANIMATIONS.kick.frames.length;
      }
    }
  }

  faceOpponent(opponent) {
    if ([STATES.PUNCH, STATES.KICK, STATES.HIT].includes(this.state)) return;
    if (opponent.x > this.x) this.facing = 1;
    else if (opponent.x < this.x) this.facing = -1;
  }

  clampPosition() {
    const margin = 20;
    this.x = Math.max(margin, Math.min(VIEW.WIDTH - margin, this.x));
  }

  checkHit(opponent) {
    if (!this.hitbox || opponent.invincible > 0) return;
    const hb = this.hitbox;
    const ob = opponent.hurtbox;

    if (rectsOverlap(hb, ob)) {
      const blocked = opponent.state === STATES.BLOCK;
      const damage = blocked ? hb.damage * 0.15 : hb.damage;
      opponent.takeHit(damage, this.facing * hb.knockback, blocked);
      this.hitbox = null;
      if (!blocked) {
        spawnHitParticles(opponent.x, opponent.y - opponent.height / 2);
        shakeFrames = 4;
      }
    }
  }

  takeHit(damage, knockback, blocked) {
    if (this.invincible > 0) return;
    this.health = Math.max(0, this.health - damage);
    if (this.health <= 0) {
      this.state = STATES.KO;
      this.stateDuration = 0;
      return;
    }
    this.state = STATES.HIT;
    this.stateTimer = blocked ? 8 : 16;
    this.stateDuration = this.stateTimer;
    this.vx = knockback;
    this.vy = blocked ? -2 : -4;
    this.onGround = false;
    this.invincible = 20;
    this.hitbox = null;
  }

  drawWashingtonIdle(ctx) {
    const { frames, animSpeed, displayHeight } = WASHINGTON_IDLE;
    const f = frames[Math.floor(this.animFrame / animSpeed) % frames.length];
    const scale = displayHeight / f.sh;
    const dw = f.sw * scale;
    const dh = displayHeight;
    const dx = -f.footX * scale;

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(washingtonIdleSheet, f.sx, f.sy, f.sw, f.sh, Math.round(dx), Math.round(-dh), Math.round(dw), Math.round(dh));
  }

  drawWashingtonPunch(ctx) {
    const { frames, displayHeight } = WASHINGTON_PUNCH;
    const duration = Math.max(1, this.stateDuration || 14);
    const elapsed = Math.max(0, duration - this.stateTimer);
    const frameIndex = Math.min(frames.length - 1, Math.floor((elapsed / duration) * frames.length));
    const f = frames[frameIndex];
    const scale = displayHeight / f.sh;
    const dw = f.sw * scale;
    const dh = displayHeight;
    const dx = -f.footX * scale;

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(washingtonPunchSource, f.sx, f.sy, f.sw, f.sh, Math.round(dx), Math.round(-dh), Math.round(dw), Math.round(dh));
  }

  drawWashingtonWalk(ctx) {
    const { frames, animSpeed, displayHeight, footYOffset } = WASHINGTON_WALK;
    const f = frames[Math.floor(this.animFrame / animSpeed) % frames.length];
    const scale = displayHeight / f.sh;
    const dw = f.sw * scale;
    const dh = displayHeight;
    const dx = -f.footX * scale;
    const dy = -dh + footYOffset;

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(washingtonWalkSource, f.sx, f.sy, f.sw, f.sh, Math.round(dx), Math.round(dy), Math.round(dw), Math.round(dh));
  }

  drawWashingtonKick(ctx) {
    const { frames, displayHeight, footYOffset } = WASHINGTON_KICK;
    const f = frames[this.washingtonKickVariant % frames.length];
    const scale = displayHeight / f.sh;
    const dw = f.sw * scale;
    const dh = displayHeight;
    const dx = -f.footX * scale;
    const dy = -dh + footYOffset;

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(washingtonKickSource, f.sx, f.sy, f.sw, f.sh, Math.round(dx), Math.round(dy), Math.round(dw), Math.round(dh));
  }

  drawWashingtonJump(ctx) {
    const { frames, displayHeight, footYOffset } = WASHINGTON_JUMP;
    const f = frames[this.washingtonJumpVariant % frames.length];
    const scale = displayHeight / f.sh;
    const dw = f.sw * scale;
    const dh = displayHeight;
    const dx = -f.footX * scale;
    const dy = -dh + footYOffset;

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(washingtonJumpSource, f.sx, f.sy, f.sw, f.sh, Math.round(dx), Math.round(dy), Math.round(dw), Math.round(dh));
  }

  drawWashingtonBlock(ctx) {
    const { frames, displayHeight, footYOffset } = WASHINGTON_BLOCK;
    const f = frames[this.washingtonBlockVariant % frames.length];
    const scale = displayHeight / f.sh;
    const dw = f.sw * scale;
    const dh = displayHeight;
    const dx = -f.footX * scale;
    const dy = -dh + footYOffset;

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(washingtonBlockSource, f.sx, f.sy, f.sw, f.sh, Math.round(dx), Math.round(dy), Math.round(dw), Math.round(dh));
  }

  drawWashingtonKnockback(ctx) {
    const { frame: f, displayHeight, footYOffset } = WASHINGTON_KNOCKBACK;
    const scale = displayHeight / f.sh;
    const dw = f.sw * scale;
    const dh = displayHeight;
    const dx = -f.footX * scale;
    const dy = -dh + footYOffset;

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(washingtonKnockbackSource, f.sx, f.sy, f.sw, f.sh, Math.round(dx), Math.round(dy), Math.round(dw), Math.round(dh));
  }

  drawMappedSprite(ctx, animType) {
    const spriteConfig = getMappedCharacterSprite(this.president.id);
    if (!spriteConfig || !spriteConfig.ready) return false;

    const anim = spriteConfig.animations[animType];
    if (!anim) return false;

    let frameIndex = 0;
    if (animType === 'idle' || animType === 'walk') {
      frameIndex = Math.floor(this.animFrame / anim.animSpeed) % anim.frames.length;
    } else if ([STATES.PUNCH, STATES.KICK].includes(this.state)) {
      const duration = Math.max(1, this.stateDuration || 14);
      const elapsed = Math.max(0, duration - this.stateTimer);
      frameIndex = Math.min(anim.frames.length - 1, Math.floor((elapsed / duration) * anim.frames.length));
    } else if (animType === 'jump') {
      if (this.vy < -3) frameIndex = 0;
      else if (this.vy < 2) frameIndex = 1;
      else frameIndex = anim.frames.length - 1;
      frameIndex = Math.min(frameIndex, anim.frames.length - 1);
    } else if (animType === 'block') {
      frameIndex = this.mappedBlockVariant % anim.frames.length;
    } else if (animType === 'knockback') {
      const duration = Math.max(1, this.stateDuration || 16);
      const elapsed = Math.max(0, duration - this.stateTimer);
      frameIndex = Math.min(anim.frames.length - 1, Math.floor((elapsed / duration) * anim.frames.length));
    }

    const frameData = anim.frames[frameIndex];
    const { sx, sy, sw, sh, footX, footY } = frameData;
    const scale = MAPPED_SPRITE_DISPLAY_HEIGHT / MAPPED_SPRITE_SOURCE_HEIGHT;
    const dw = sw * scale;
    const dh = sh * scale;
    const dx = -footX * scale;
    const dy = -footY * scale + MAPPED_SPRITE_FOOT_Y_OFFSET;

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(spriteConfig.source, sx, sy, sw, sh, Math.round(dx), Math.round(dy), Math.round(dw), Math.round(dh));
    return true;
  }

  usesMappedSprite() {
    const spriteConfig = getMappedCharacterSprite(this.president.id);
    return Boolean(spriteConfig && spriteConfig.ready);
  }

  usesWashingtonIdleSprite() {
    return (
      this.president.id === 'washington' &&
      washingtonIdleReady &&
      this.onGround &&
      this.state === STATES.IDLE &&
      Math.abs(this.vx) < 0.5
    );
  }

  usesWashingtonPunchSprite() {
    return this.president.id === 'washington' && washingtonPunchReady && this.state === STATES.PUNCH;
  }

  usesWashingtonWalkSprite() {
    return this.president.id === 'washington' && washingtonWalkReady && this.onGround && this.state === STATES.WALK;
  }

  usesWashingtonKickSprite() {
    return this.president.id === 'washington' && washingtonKickReady && this.state === STATES.KICK;
  }

  usesWashingtonJumpSprite() {
    return (
      this.president.id === 'washington' &&
      washingtonJumpReady &&
      (this.state === STATES.JUMP || this.state === STATES.FALL)
    );
  }

  usesWashingtonBlockSprite() {
    return this.president.id === 'washington' && washingtonBlockReady && this.state === STATES.BLOCK;
  }

  usesWashingtonKnockbackSprite() {
    return this.president.id === 'washington' && washingtonKnockbackReady && this.state === STATES.HIT;
  }

  draw(ctx, showNameTag = true) {
    const p = this.president;
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    const f = this.facing;
    const flash = this.invincible > 0 && Math.floor(this.invincible / 3) % 2;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(f, 1);

    if (flash) ctx.globalAlpha = 0.5;

    const bob = this.state === STATES.WALK ? Math.sin(this.animFrame * 0.4) * 2 : 0;
    const crouch = this.state === STATES.BLOCK ? 8 : 0;

    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 2, 14, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    if (this.usesMappedSprite()) {
      if (this.state === STATES.KO && this.drawMappedSprite(ctx, 'ko')) {
        ctx.restore();
        if (showNameTag) {
          drawBitmapTextFit(p.name, x, y - this.height - 16, 88, { scale: 0.85, align: 'center' });
        }
        return;
      }
      if (this.state === STATES.WIN && this.drawMappedSprite(ctx, 'win')) {
        ctx.restore();
        if (showNameTag) {
          drawBitmapTextFit(p.name, x, y - this.height - 16, 88, { scale: 0.85, align: 'center' });
        }
        return;
      }
      if (this.state === STATES.HIT && this.drawMappedSprite(ctx, 'knockback')) {
        ctx.restore();
        if (showNameTag) {
          drawBitmapTextFit(p.name, x, y - this.height - 16, 88, { scale: 0.85, align: 'center' });
        }
        return;
      }
      if (this.state === STATES.PUNCH && this.drawMappedSprite(ctx, 'punch')) {
        ctx.restore();
        if (showNameTag) {
          drawBitmapTextFit(p.name, x, y - this.height - 16, 88, { scale: 0.85, align: 'center' });
        }
        return;
      }
      if (this.state === STATES.KICK && this.drawMappedSprite(ctx, 'kick')) {
        ctx.restore();
        if (showNameTag) {
          drawBitmapTextFit(p.name, x, y - this.height - 16, 88, { scale: 0.85, align: 'center' });
        }
        return;
      }
      if (this.state === STATES.BLOCK && this.drawMappedSprite(ctx, 'block')) {
        ctx.restore();
        if (showNameTag) {
          drawBitmapTextFit(p.name, x, y - this.height - 16, 88, { scale: 0.85, align: 'center' });
        }
        return;
      }
      if ((this.state === STATES.JUMP || this.state === STATES.FALL) && this.drawMappedSprite(ctx, 'jump')) {
        ctx.restore();
        if (showNameTag) {
          drawBitmapTextFit(p.name, x, y - this.height - 16, 88, { scale: 0.85, align: 'center' });
        }
        return;
      }
      if (this.onGround && this.state === STATES.WALK && this.drawMappedSprite(ctx, 'walk')) {
        ctx.restore();
        if (showNameTag) {
          drawBitmapTextFit(p.name, x, y - this.height - 16, 88, { scale: 0.85, align: 'center' });
        }
        return;
      }
      if (this.onGround && this.state === STATES.IDLE && Math.abs(this.vx) < 0.5 && this.drawMappedSprite(ctx, 'idle')) {
        ctx.restore();
        if (showNameTag) {
          drawBitmapTextFit(p.name, x, y - this.height - 16, 88, { scale: 0.85, align: 'center' });
        }
        return;
      }
    }

    // WASHINGTON SPRITE CHECKS
    if (this.usesWashingtonKnockbackSprite()) {
      this.drawWashingtonKnockback(ctx);
      ctx.restore();
      if (showNameTag) {
        drawBitmapTextFit(p.name, x, y - this.height - 16, 88, { scale: 0.85, align: 'center' });
      }
      return;
    }

    if (this.usesWashingtonPunchSprite()) {
      this.drawWashingtonPunch(ctx);
      ctx.restore();
      if (showNameTag) {
        drawBitmapTextFit(p.name, x, y - this.height - 16, 88, { scale: 0.85, align: 'center' });
      }
      return;
    }

    if (this.usesWashingtonKickSprite()) {
      this.drawWashingtonKick(ctx);
      ctx.restore();
      if (showNameTag) {
        drawBitmapTextFit(p.name, x, y - this.height - 16, 88, { scale: 0.85, align: 'center' });
      }
      return;
    }

    if (this.usesWashingtonBlockSprite()) {
      this.drawWashingtonBlock(ctx);
      ctx.restore();
      if (showNameTag) {
        drawBitmapTextFit(p.name, x, y - this.height - 16, 88, { scale: 0.85, align: 'center' });
      }
      return;
    }

    if (this.usesWashingtonJumpSprite()) {
      this.drawWashingtonJump(ctx);
      ctx.restore();
      if (showNameTag) {
        drawBitmapTextFit(p.name, x, y - this.height - 16, 88, { scale: 0.85, align: 'center' });
      }
      return;
    }

    if (this.usesWashingtonWalkSprite()) {
      this.drawWashingtonWalk(ctx);
      ctx.restore();
      if (showNameTag) {
        drawBitmapTextFit(p.name, x, y - this.height - 16, 88, { scale: 0.85, align: 'center' });
      }
      return;
    }

    if (this.usesWashingtonIdleSprite()) {
      this.drawWashingtonIdle(ctx);
      ctx.restore();
      if (showNameTag) {
        drawBitmapTextFit(p.name, x, y - this.height - 16, 88, { scale: 0.85, align: 'center' });
      }
      return;
    }

    // FALLBACK COLORED SPRITE DRAWING
    ctx.fillStyle = '#222';
    const legAnim = this.state === STATES.WALK ? Math.sin(this.animFrame * 0.5) * 4 : 0;
    ctx.fillRect(-8, -18 - crouch + bob, 6, 18 + legAnim);
    ctx.fillRect(2, -18 - crouch + bob, 6, 18 - legAnim);

    ctx.fillStyle = p.color;
    ctx.fillRect(-12, -42 - crouch + bob, 24, 26);

    ctx.fillStyle = p.accent;
    ctx.fillRect(-3, -38 - crouch + bob, 6, 14);

    ctx.fillStyle = '#deb887';
    ctx.fillRect(-10, -56 - crouch + bob, 20, 16);

    ctx.fillStyle = p.hair;
    if (p.id === 'washington') {
      ctx.fillStyle = '#e8dcc8';
      ctx.fillRect(-12, -60 - crouch + bob, 24, 8);
      ctx.fillStyle = p.accent;
      ctx.fillRect(-11, -48 - crouch + bob, 22, 3);
    } else if (p.id === 'lincoln') {
      ctx.fillRect(-11, -60 - crouch + bob, 22, 10);
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(-12, -52 - crouch + bob, 24, 4);
    } else if (p.id === 'roosevelt') {
      ctx.fillRect(-12, -58 - crouch + bob, 24, 6);
      ctx.fillStyle = '#4a3728';
      ctx.fillRect(-14, -54 - crouch + bob, 4, 8);
      ctx.fillRect(10, -54 - crouch + bob, 4, 8);
    } else if (p.id === 'jefferson') {
      ctx.fillRect(-12, -60 - crouch + bob, 24, 10);
      ctx.fillStyle = p.color;
      ctx.fillRect(-13, -50 - crouch + bob, 26, 6);
    }

    ctx.fillStyle = p.color;
    if (this.state === STATES.PUNCH) {
      const ext = 14 + (14 - this.stateTimer);
      ctx.fillRect(8, -38 - crouch + bob, ext, 8);
      ctx.fillStyle = '#deb887';
      ctx.fillRect(8 + ext - 4, -40 - crouch + bob, 8, 8);
    } else if (this.state === STATES.KICK) {
      ctx.fillRect(-8, -20 - crouch + bob, 8, 8);
      const ext = 10 + (20 - this.stateTimer);
      ctx.fillStyle = '#222';
      ctx.fillRect(4, -22 - crouch + bob, ext + 10, 8);
    } else {
      ctx.fillRect(-14, -38 - crouch + bob, 8, 16);
      ctx.fillRect(6, -38 - crouch + bob, 8, 16);
    }

    if (this.state === STATES.BLOCK) {
      ctx.strokeStyle = 'rgba(100,180,255,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(14, -30 - crouch + bob, 16, -0.5, 0.5);
      ctx.stroke();
    }

    ctx.restore();

    if (showNameTag) {
      drawBitmapTextFit(p.name, x, y - this.height - 16, 88, { scale: 0.85, align: 'center' });
    }
  }
}

function spawnHitParticles(x, y) {
  for (let i = 0; i < 8; i++) {
    particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 6,
      vy: (Math.random() - 0.5) * 6,
      life: 20,
      color: ['#ff4444', '#ffaa00', '#ffffff'][Math.floor(Math.random() * 3)],
    });
  }
}

function getInput(playerNum) {
  if (playerNum === 1) {
    return {
      left: keys['KeyA'],
      right: keys['KeyD'],
      jump: keys['KeyW'],
      punch: keys['KeyF'],
      kick: keys['KeyG'],
      block: keys['KeyS'],
    };
  }
  return {
    left: keys['ArrowLeft'],
    right: keys['ArrowRight'],
    jump: keys['ArrowUp'],
    punch: keys['KeyK'],
    kick: keys['KeyL'],
    block: keys['ArrowDown'],
  };
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function startFight() {
  const p1 = PRESIDENTS[selectIndex.p1];
  const p2 = PRESIDENTS[selectIndex.p2];
  fighters = [new Fighter(p1, 80, 1, 1), new Fighter(p2, VIEW.WIDTH - 80, -1, 2)];
  timer = 99;
  roundOver = false;
  roundMessage = `ROUND ${round}`;
  messageTimer = 90;
  screen = SCREENS.FIGHT;
}

function resetRound() {
  fighters[0].reset(80, 1);
  fighters[1].reset(VIEW.WIDTH - 80, -1);
  timer = 99;
  roundOver = false;
  roundMessage = `ROUND ${round}`;
  messageTimer = 90;
}

function drawBackground() {
  const grad = ctx.createLinearGradient(0, 0, 0, VIEW.HEIGHT);
  grad.addColorStop(0, '#1a1035');
  grad.addColorStop(0.5, '#2d1f4e');
  grad.addColorStop(1, '#0f3460');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW.WIDTH, VIEW.HEIGHT);

  ctx.fillStyle = '#0d2137';
  ctx.beginPath();
  ctx.ellipse(VIEW.WIDTH / 2, GROUND_Y - 30, 90, 50, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(VIEW.WIDTH / 2 - 70, GROUND_Y - 30, 140, 35);

  for (let i = 0; i < 7; i++) {
    const cx = VIEW.WIDTH / 2 - 54 + i * 18;
    ctx.fillStyle = '#162a44';
    ctx.fillRect(cx, GROUND_Y - 70, 10, 45);
  }

  ctx.fillStyle = '#1a2744';
  ctx.fillRect(0, GROUND_Y, VIEW.WIDTH, VIEW.HEIGHT - GROUND_Y);
  ctx.fillStyle = '#c9a227';
  ctx.fillRect(0, GROUND_Y, VIEW.WIDTH, 3);

  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  for (let i = 0; i < 20; i++) {
    const sx = (i * 47 + frame * 0.2) % VIEW.WIDTH;
    const sy = 20 + (i * 13) % 60;
    ctx.fillRect(sx, sy, 2, 2);
  }
}

function imageReady(image) {
  return image.complete && image.naturalWidth > 0;
}

function drawCoverImage(image, x = 0, y = 0, w = VIEW.WIDTH, h = VIEW.HEIGHT) {
  const scale = Math.max(w / image.naturalWidth, h / image.naturalHeight);
  const sw = w / scale;
  const sh = h / scale;
  const sx = (image.naturalWidth - sw) / 2;
  const sy = (image.naturalHeight - sh) / 2;

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, sx, sy, sw, sh, x, y, w, h);
}

function drawAnimatedBackground() {
  const readyFrames = backgroundFrames.filter(imageReady);
  const framesToDraw = readyFrames.length ? readyFrames : imageReady(backgroundFallback) ? [backgroundFallback] : [];

  if (!framesToDraw.length) {
    drawBackground();
    return;
  }

  const { frameHold, fadeFrames } = BACKGROUND_ANIMATION;
  const cycle = Math.floor(frame / frameHold);
  const current = framesToDraw[cycle % framesToDraw.length];
  const next = framesToDraw[(cycle + 1) % framesToDraw.length];
  const frameProgress = frame % frameHold;
  const fadeStart = frameHold - fadeFrames;
  const fade = frameProgress >= fadeStart ? (frameProgress - fadeStart) / fadeFrames : 0;

  drawCoverImage(current);

  if (framesToDraw.length > 1 && fade > 0) {
    ctx.save();
    ctx.globalAlpha = fade;
    drawCoverImage(next);
    ctx.restore();
  }

  const shimmer = Math.sin(frame * 0.08) * 0.06 + 0.08;
  ctx.fillStyle = `rgba(255, 214, 120, ${shimmer})`;
  ctx.fillRect(0, 0, VIEW.WIDTH, VIEW.HEIGHT);
}

function drawFightBackground() {
  drawAnimatedBackground();
}

function drawTitleBackground() {
  if (titleBgImageReady) {
    ctx.drawImage(titleBgImage, 0, 0, VIEW.WIDTH, VIEW.HEIGHT);
    return;
  }
  drawBackground();
}

function drawHUD() {
  const [p1, p2] = fighters;
  const barW = 140;
  const pad = 12;

  ctx.fillStyle = '#333';
  ctx.fillRect(pad, 10, barW, 12);
  const hp1 = (p1.health / p1.maxHealth) * barW;
  ctx.fillStyle = hp1 > 30 ? '#22cc44' : '#cc2222';
  ctx.fillRect(pad, 10, hp1, 12);
  ctx.strokeStyle = '#c9a227';
  ctx.lineWidth = 2;
  ctx.strokeRect(pad, 10, barW, 12);
  drawBitmapTextFit(p1.president.name, pad, 4, barW - 20, { scale: 0.85, align: 'left' });

  const x2 = VIEW.WIDTH - pad - barW;
  ctx.fillStyle = '#333';
  ctx.fillRect(x2, 10, barW, 12);
  const hp2 = (p2.health / p2.maxHealth) * barW;
  ctx.fillStyle = hp2 > 30 ? '#22cc44' : '#cc2222';
  ctx.fillRect(x2 + barW - hp2, 10, hp2, 12);
  ctx.strokeStyle = '#c9a227';
  ctx.strokeRect(x2, 10, barW, 12);
  drawBitmapTextFit(p2.president.name, VIEW.WIDTH - pad, 4, barW - 20, { scale: 0.85, align: 'right' });

  drawPhrase('KO_RED', VIEW.WIDTH / 2, 2, { scale: 0.85, align: 'center' });
  drawBitmapText(String(Math.ceil(timer)).padStart(2, '0'), VIEW.WIDTH / 2, 15, {
    scale: 1.25,
    align: 'center',
  });

  drawBitmapText('*'.repeat(p1Wins) || '-', pad, 28, { scale: 0.9, align: 'left' });
  drawBitmapText('*'.repeat(p2Wins) || '-', VIEW.WIDTH - pad, 28, { scale: 0.9, align: 'right' });
}

function drawParticles() {
  particles = particles.filter((p) => {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.2; // Slight gravity on particles
    p.life--;
    ctx.fillStyle = p.color;
    ctx.globalAlpha = p.life / 20;
    ctx.fillRect(p.x, p.y, 3, 3);
    ctx.globalAlpha = 1;
    return p.life > 0;
  });
}

function drawTitle() {
  drawTitleBackground();

  if (Math.floor(frame / 30) % 2) {
    drawPhrase('PUSH_START', VIEW.WIDTH / 2, 196, { scale: 1, align: 'center' });
  }
}

function drawPresidentPreview(p, x, y, facing) {
  const temp = new Fighter(p, x, facing, 0);
  temp.animFrame = frame;
  temp.draw(ctx, false);
}

function drawSelect() {
  drawFightBackground();

  drawPhrase('PLAYER_SELECT', VIEW.WIDTH / 2, 12, { scale: 0.95, align: 'center' });

  const cardW = 72;
  const startX = (VIEW.WIDTH - PRESIDENTS.length * cardW) / 2 + cardW / 2;

  PRESIDENTS.forEach((p, i) => {
    const cx = startX + i * cardW;
    const isP1 = selectCursor === 0 && selectIndex.p1 === i;
    const isP2 = selectCursor === 1 && selectIndex.p2 === i;

    if (isP1 || isP2) {
      ctx.strokeStyle = isP1 ? '#4488ff' : '#ff4444';
      ctx.lineWidth = 3;
      ctx.strokeRect(cx - 30, 40, 60, 100);
    }

    drawPresidentPreview(p, cx, GROUND_Y - 10, 1);

    drawBitmapTextFit(p.name, cx, GROUND_Y + 14, cardW - 8, {
      scale: 0.75,
      minScale: 0.62,
      align: 'center',
    });
    drawBitmapTextWrapped(p.special, cx, GROUND_Y + 25, cardW - 8, {
      scale: 0.62,
      minScale: 0.48,
      align: 'center',
      lineGap: 1,
    });
  });
 
  drawBitmapTextFit(selectCursor === 0 ? 'P1 CHOOSE' : 'P2 CHOOSE', VIEW.WIDTH / 2, 150, 130, {
    scale: 0.9,
    align: 'center',
  });

  if (Math.floor(frame / 25) % 2) {
    drawBitmapTextFit('ENTER TO FIGHT', VIEW.WIDTH / 2, 168, 170, { scale: 0.85, align: 'center' });
  }

  drawBitmapTextFit('< > PICK  ^ v SWITCH  TAB SWAP', VIEW.WIDTH / 2, 184, VIEW.WIDTH - 24, {
    scale: 0.6,
    align: 'center',
  });
}

function drawFight() {
  let ox = 0;
  let oy = 0;
  if (shakeFrames > 0) {
    ox = (Math.random() - 0.5) * 6;
    oy = (Math.random() - 0.5) * 6;
    shakeFrames--;
  }

  ctx.save();
  ctx.translate(ox, oy);
  drawFightBackground();

  const [p1, p2] = fighters;
  const order = p1.y <= p2.y ? [p1, p2] : [p2, p1];
  order.forEach((f) => f.draw(ctx, false));

  drawParticles();
  drawHUD();

  if (roundMessage && messageTimer > 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, VIEW.WIDTH, VIEW.HEIGHT);
    drawFightMessage(roundMessage);
    messageTimer--;
  }

  ctx.restore();
}

function drawResult(winner) {
  drawFightBackground();
  fighters.forEach((f) => {
    f.state = f === winner ? STATES.WIN : STATES.KO;
    f.draw(ctx, false);
  });

  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 60, VIEW.WIDTH, 80);

  if (winner) {
    drawBitmapTextFit(winner.president.name, VIEW.WIDTH / 2, 78, VIEW.WIDTH - 80, {
      scale: 1.1,
      align: 'center',
    });
    drawBitmapText('WINS!', VIEW.WIDTH / 2, 98, { scale: 0.95, align: 'center' });
  } else {
    drawPhrase('TIME_DRAW', VIEW.WIDTH / 2, 78, { scale: 0.75, align: 'center' });
  }

  if (Math.floor(frame / 30) % 2) {
    drawBitmapTextFit('ENTER TO REMATCH', VIEW.WIDTH / 2, 140, 190, {
      scale: 0.75,
      align: 'center',
    });
  }
}

function drawFightMessage(message) {
  const cy = VIEW.HEIGHT / 2;

  if (message === 'DRAW') {
    drawPhrase('TIME_DRAW', VIEW.WIDTH / 2, cy - 24, { scale: 0.75, align: 'center' });
    drawPhrase('OVER_GAME', VIEW.WIDTH / 2, cy - 4, { scale: 0.75, align: 'center' });
    return;
  }

  if (message.startsWith('ROUND')) {
    drawPhrase('FIGHT', VIEW.WIDTH / 2 - 44, cy - 16, { scale: 1, align: 'center' });
    drawBitmapTextFit(message, VIEW.WIDTH / 2 + 44, cy - 9, 130, { scale: 0.9, align: 'center' });
    return;
  }

  drawBitmapTextFit(message, VIEW.WIDTH / 2, cy - 6, VIEW.WIDTH - 80, {
    scale: 0.95,
    align: 'center',
  });
}

function updateFight() {
  if (messageTimer > 0) return;

  const [p1, p2] = fighters;

  if (!roundOver) {
    p1.update(getInput(1), p2);
    p2.update(getInput(2), p1);

    timerTick++;
    if (timerTick >= 60) {
      timerTick = 0;
      if (timer > 0) timer--;
    }

    if (p1.health <= 0 || p2.health <= 0 || timer <= 0) {
      roundOver = true;
      let winner;
      if (p1.health <= 0 && p2.health <= 0) winner = null;
      else if (p1.health <= 0) winner = p2;
      else if (p2.health <= 0) winner = p1;
      else winner = p1.health > p2.health ? p1 : p2.health > p1.health ? p2 : null;

      if (winner === p1) {
        p1Wins++;
        roundMessage = 'P1 WINS ROUND';
      } else if (winner === p2) {
        p2Wins++;
        roundMessage = 'P2 WINS ROUND';
      } else {
        roundMessage = 'DRAW';
      }
      messageTimer = 120;

      if (p1Wins >= 2 || p2Wins >= 2) {
        setTimeout(() => {
          screen = SCREENS.RESULT;
          fighters.winner = p1Wins >= 2 ? p1 : p2;
        }, 2000);
      } else {
        setTimeout(() => {
          round++;
          resetRound();
        }, 2000);
      }
    }
  }
}

function gameLoop() {
  frame++;
  ctx.imageSmoothingEnabled = false;

  // ensure music follows screen (no-op most frames)
  updateMusicForScreen();

  switch (screen) {
    case SCREENS.TITLE:
      drawTitle();
      break;
    case SCREENS.SELECT:
      drawSelect();
      break;
    case SCREENS.FIGHT:
      updateFight();
      drawFight();
      break;
    case SCREENS.RESULT:
      drawResult(fighters.winner);
      break;
  }

  requestAnimationFrame(gameLoop);
}

window.addEventListener('keydown', (e) => {
  // mark that user interacted (required for audio playback)
  if (!userGesture) {
    userGesture = true;
    updateMusicForScreen();
  }

  keys[e.code] = true;

  if (e.code === 'Enter') {
    if (screen === SCREENS.TITLE) {
      screen = SCREENS.SELECT;
      selectCursor = 0;
      updateMusicForScreen();
    } else if (screen === SCREENS.SELECT) {
      startFight();
      round = 1;
      p1Wins = 0;
      p2Wins = 0;
      updateMusicForScreen();
    } else if (screen === SCREENS.RESULT) {
      screen = SCREENS.SELECT;
      round = 1;
      p1Wins = 0;
      p2Wins = 0;
      updateMusicForScreen();
    }
  }

  if (screen === SCREENS.SELECT) {
    const activePlayer = selectCursor === 0 ? 'p1' : 'p2';

    if (e.code === 'ArrowLeft') {
      selectIndex[activePlayer] = (selectIndex[activePlayer] - 1 + PRESIDENTS.length) % PRESIDENTS.length;
    }
    if (e.code === 'ArrowRight') {
      selectIndex[activePlayer] = (selectIndex[activePlayer] + 1) % PRESIDENTS.length;
    }
    if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
      selectCursor = selectCursor === 0 ? 1 : 0;
    }
    if (e.code === 'Tab') {
      e.preventDefault();
      selectCursor = selectCursor === 0 ? 1 : 0;
    }
    if (selectIndex.p1 === selectIndex.p2) {
      selectIndex.p2 = (selectIndex.p2 + 1) % PRESIDENTS.length;
    }
  }

  if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
});

window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
});

initCanvas();
gameLoop();
