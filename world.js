/**
 * world.js — 교실 환경 관리
 * 벽, 고정 장애물, 이동형 장애물, 충돌 감지
 */

const CELL_SIZE = 10; // px per grid cell
const WORLD_W   = 800;
const WORLD_H   = 600;
const WALL_T    = 16; // 벽 두께

// 장애물 타입 정의
const OBSTACLE_TYPES = {
  desk:  { label: '책상',  w: 52, h: 36, emoji: '🪑', color: '#8B6914', borderColor: '#5D4037' },
  chair: { label: '의자',  w: 28, h: 28, emoji: '🪑', color: '#5D4037', borderColor: '#3E2723' },
  box:   { label: '박스',  w: 36, h: 36, emoji: '📦', color: '#8D6E63', borderColor: '#6D4C41' },
  plant: { label: '화분',  w: 28, h: 28, emoji: '🪴', color: '#388E3C', borderColor: '#1B5E20' },
  // 고정 장애물
  teacher_desk: { label: '교사 책상', w: 80, h: 44, emoji: '🖥️',  color: '#5C4033', borderColor: '#3E2723' },
  board:        { label: '칠판',      w: 160, h: 20, emoji: '📋', color: '#1565C0', borderColor: '#0D47A1' },
  cabinet:      { label: '사물함',   w: 24, h: 60, emoji: '🗄️', color: '#546E7A', borderColor: '#37474F' },
  window:       { label: '창문',     w: 8,  h: 80, emoji: '🪟', color: '#90CAF9', borderColor: '#42A5F5' },
};

// 충돌 가능한 세계 경계
const BOUNDS = { left: WALL_T, top: WALL_T, right: WORLD_W - WALL_T, bottom: WORLD_H - WALL_T };

const ITEM_SPAWN_POINTS = [
  { x: 150, y: 80,  type: 'speed', emoji: '⚡', color: '#ffcc02' },
  { x: 450, y: 480, type: 'speed', emoji: '⚡', color: '#ffcc02' },
  { x: 720, y: 260, type: 'speed', emoji: '⚡', color: '#ffcc02' },
  { x: 150, y: 480, type: 'range', emoji: '🔍', color: '#00e5ff' },
  { x: 450, y: 80,  type: 'range', emoji: '🔍', color: '#00e5ff' },
  { x: 720, y: 480, type: 'range', emoji: '🔍', color: '#00e5ff' },
];

class World {
  constructor() {
    this.obstacles = [];   // { id, type, x, y, w, h, fixed }
    this.students  = [];   // 움직이는 학생 장애물
    this.items     = [];   // 획득 가능한 아이템 (배터리, 렌즈)
    this._idCounter = 0;
    this.reset();
  }

  /** 초기 교실 배치 */
  _initClassroom() {
    // 교사 책상 (상단 중앙)
    this._addFixed('teacher_desk', WORLD_W / 2 - 40, WALL_T + 10);
    // 칠판 (상단 벽에 붙어서)
    this._addFixed('board', WORLD_W / 2 - 80, WALL_T);
    // 사물함 (우측 벽)
    this._addFixed('cabinet', WORLD_W - WALL_T - 24, WALL_T + 20);
    this._addFixed('cabinet', WORLD_W - WALL_T - 24, WALL_T + 90);
    // 창문 (좌측 벽)
    this._addFixed('window', WALL_T, 80);
    this._addFixed('window', WALL_T, 180);
    this._addFixed('window', WALL_T, 280);

    // 학생 책상 배열 (4열 × 4행) - 넓어진 맵에 맞춤
    const deskW = OBSTACLE_TYPES.desk.w;
    const deskH = OBSTACLE_TYPES.desk.h;
    const startX = 130;
    const startY = 140;
    const colGap = 160;
    const rowGap = 100;
    for (let col = 0; col < 4; col++) {
      for (let row = 0; row < 4; row++) {
        const x = startX + col * colGap;
        const y = startY + row * rowGap;
        // 로봇 초기 위치(중앙 400, 300 근처) 피하기
        if (Math.abs(x - 400) < 70 && Math.abs(y - 300) < 70) continue;
        this._addFixed('desk', x, y);
      }
    }
  }

  _addFixed(type, x, y) {
    const def = OBSTACLE_TYPES[type];
    this.obstacles.push({
      id: this._idCounter++,
      type,
      x, y,
      w: def.w,
      h: def.h,
      fixed: true,
    });
  }

  /** 사용자가 장애물 추가 */
  addObstacle(type, x, y) {
    const def = OBSTACLE_TYPES[type];
    if (!def) return null;
    // 벽 안쪽 확인
    const cx = Math.max(BOUNDS.left, Math.min(BOUNDS.right  - def.w, x - def.w / 2));
    const cy = Math.max(BOUNDS.top,  Math.min(BOUNDS.bottom - def.h, y - def.h / 2));
    const obs = { id: this._idCounter++, type, x: cx, y: cy, w: def.w, h: def.h, fixed: false };
    this.obstacles.push(obs);
    return obs;
  }

  /** 장애물 제거 */
  removeObstacle(id) {
    const idx = this.obstacles.findIndex(o => o.id === id && !o.fixed);
    if (idx !== -1) { this.obstacles.splice(idx, 1); return true; }
    return false;
  }

  /** 장애물 이동 */
  moveObstacle(id, x, y) {
    const obs = this.obstacles.find(o => o.id === id && !o.fixed);
    if (!obs) return false;
    obs.x = Math.max(BOUNDS.left, Math.min(BOUNDS.right  - obs.w, x - obs.w / 2));
    obs.y = Math.max(BOUNDS.top,  Math.min(BOUNDS.bottom - obs.h, y - obs.h / 2));
    return true;
  }

  /** 좌표 (px) 에서 장애물 찾기 */
  getObstacleAt(x, y) {
    // 뒤에서부터 (최상위 렌더 우선)
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const o = this.obstacles[i];
      if (x >= o.x && x <= o.x + o.w && y >= o.y && y <= o.y + o.h) return o;
    }
    // 벽 체크 추가
    const walls = [
      { x: 0,              y: 0,              w: WALL_T,  h: WORLD_H },
      { x: WORLD_W - WALL_T, y: 0,            w: WALL_T,  h: WORLD_H },
      { x: 0,              y: 0,              w: WORLD_W, h: WALL_T  },
      { x: 0,              y: WORLD_H - WALL_T, w: WORLD_W, h: WALL_T },
    ];
    for (const w of walls) {
      if (x >= w.x && x <= w.x + w.w && y >= w.y && y <= w.y + w.h) return w;
    }
    return null;
  }

  /**
   * 선분 충돌 감지 (레이캐스팅용)
   * (x1,y1)→(x2,y2) 가 벽이나 장애물에 닿는 첫 번째 t (0~1) 반환
   * 닿지 않으면 1을 반환
   */
  raycast(x1, y1, x2, y2) {
    let minT = 1;

    // 장애물 AABB 충돌 (움직이는 학생도 스캔 대상에 추가)
    const allRects = [
      { x: 0,       y: 0,                w: WALL_T,   h: WORLD_H }, // L벽
      { x: WORLD_W - WALL_T, y: 0,       w: WALL_T,   h: WORLD_H }, // R벽
      { x: 0,       y: 0,                w: WORLD_W,  h: WALL_T   }, // T벽
      { x: 0,       y: WORLD_H - WALL_T, w: WORLD_W,  h: WALL_T   }, // B벽
      ...this.obstacles,
      ...this.students.map(s => ({ x: s.x - s.w/2, y: s.y - s.h/2, w: s.w, h: s.h })),
    ];

    const dx = x2 - x1, dy = y2 - y1;

    for (const rect of allRects) {
      const t = this._segmentAABB(x1, y1, dx, dy, rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
      if (t !== null && t < minT) minT = t;
    }

    return minT;
  }

  /**
   * 선분 vs AABB 충돌 t 계산 (슬랩 알고리즘)
   * 교차 t 가 [0,1] 범위면 반환, 아니면 null
   */
  _segmentAABB(ox, oy, dx, dy, x1, y1, x2, y2) {
    let tmin = 0, tmax = 1;
    if (Math.abs(dx) < 1e-9) {
      if (ox < x1 || ox > x2) return null;
    } else {
      let t1 = (x1 - ox) / dx, t2 = (x2 - ox) / dx;
      if (t1 > t2) { let tmp = t1; t1 = t2; t2 = tmp; }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }
    if (Math.abs(dy) < 1e-9) {
      if (oy < y1 || oy > y2) return null;
    } else {
      let t1 = (y1 - oy) / dy, t2 = (y2 - oy) / dy;
      if (t1 > t2) { let tmp = t1; t1 = t2; t2 = tmp; }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }
    return tmin >= 0 ? tmin : null;
  }

  /**
   * 원형 로봇이 특정 위치에서 충돌하는지 확인
   */
  circleCollides(cx, cy, radius) {
    // 벽 충돌
    if (cx - radius < BOUNDS.left || cx + radius > BOUNDS.right ||
        cy - radius < BOUNDS.top  || cy + radius > BOUNDS.bottom) return true;
    // 장애물 충돌 (원-AABB)
    for (const obs of this.obstacles) {
      const nearX = Math.max(obs.x, Math.min(obs.x + obs.w, cx));
      const nearY = Math.max(obs.y, Math.min(obs.y + obs.h, cy));
      const distSq = (cx - nearX) ** 2 + (cy - nearY) ** 2;
      if (distSq < radius * radius) return true;
    }
    // 움직이는 학생과 충돌 검사
    for (const s of this.students) {
      const distSq = (cx - s.x) ** 2 + (cy - s.y) ** 2;
      if (distSq < (radius + s.w/2) ** 2) return true;
    }
    return false;
  }

  /** 움직이는 학생 갱신 (매 프레임 호출) */
  update(dt) {
    for (const s of this.students) {
      let nx = s.x + s.vx * dt;
      let ny = s.y + s.vy * dt;

      // 외벽 충돌 시 튕김
      if (nx - s.w/2 < BOUNDS.left)  { s.vx = Math.abs(s.vx); nx = s.x + s.vx * dt; }
      if (nx + s.w/2 > BOUNDS.right) { s.vx = -Math.abs(s.vx); nx = s.x + s.vx * dt; }
      if (ny - s.h/2 < BOUNDS.top)   { s.vy = Math.abs(s.vy); ny = s.y + s.vy * dt; }
      if (ny + s.h/2 > BOUNDS.bottom){ s.vy = -Math.abs(s.vy); ny = s.y + s.vy * dt; }

      // 1.5%의 확률로 방향 임의 전환 (자연스러운 배회 유도)
      if (Math.random() < 0.015) {
        const angle = Math.random() * Math.PI * 2;
        const speed = (30 + Math.random() * 20) * 1.5;
        s.vx = Math.cos(angle) * speed;
        s.vy = Math.sin(angle) * speed;
      }

      s.x = nx;
      s.y = ny;
    }
  }

  /** 움직이는 학생 스폰 */
  _initStudents() {
    const emojis = ['🙋', '🙋‍♂️', '🏃', '🏃‍♀️', '🎒'];
    const studentCount = 4;
    // 책상 통로 주변 4개 구역
    const positions = [
      { x: 180, y: 100 },
      { x: 480, y: 250 },
      { x: 180, y: 480 },
      { x: 620, y: 480 }
    ];
    for (let i = 0; i < studentCount; i++) {
      const pos = positions[i % positions.length];
      const angle = Math.random() * Math.PI * 2;
      const speed = (30 + Math.random() * 20) * 1.5; // 1.5배 빨라진 45~75 px/s
      this.students.push({
        id: 'student-' + i,
        x: pos.x,
        y: pos.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        w: 26,
        h: 26,
        emoji: emojis[i % emojis.length]
      });
    }
  }



  /** 아이템 스폰 (처음 리셋 시) */
  _spawnInitialItems() {
    this.items = [];
    ITEM_SPAWN_POINTS.forEach((pt, i) => {
      this.items.push({
        id: 'item-init-' + i,
        type: pt.type,
        x: pt.x,
        y: pt.y,
        emoji: pt.emoji,
        color: pt.color
      });
    });
  }

  /** 고정된 Canvas 절대좌표 구역 중 비어있는 곳에 아이템 복구 */
  spawnRandomItem(forcedType = null) {
    const emptyPoints = ITEM_SPAWN_POINTS.filter(pt => {
      if (forcedType && pt.type !== forcedType) return false;
      return !this.items.some(item => Math.hypot(item.x - pt.x, item.y - pt.y) < 15);
    });

    if (emptyPoints.length > 0) {
      const pt = emptyPoints[Math.floor(Math.random() * emptyPoints.length)];
      this.items.push({
        id: 'item-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        type: pt.type,
        x: pt.x,
        y: pt.y,
        emoji: pt.emoji,
        color: pt.color
      });
    }
  }

  /** 초기화 */
  reset() {
    this.obstacles = [];
    this.students  = [];
    this.items     = [];
    this._idCounter = 0;
    this._initClassroom();
    this._initStudents();
    this._spawnInitialItems();
  }
}
