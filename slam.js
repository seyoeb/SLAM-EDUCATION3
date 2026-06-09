/**
 * slam.js — Occupancy Grid Map 관리
 * 셀 상태: 0=Unknown, 1=Free, 2=Occupied
 * v2: initWithObstacles() 추가 — 알려진 장애물 사전 등록으로 dead-zone 제거
 */

const GRID_CELL   = 10;       // px per cell
const GRID_W      = Math.floor(WORLD_W / GRID_CELL);  // 60
const GRID_H      = Math.floor(WORLD_H / GRID_CELL);  // 50
const CELL_UNKNOWN  = 0;
const CELL_FREE     = 1;
const CELL_OCCUPIED = 2;

// 색상 팔레트
const SLAM_COLORS = {
  [CELL_UNKNOWN]:  { r: 13,  g: 27,  b: 42  },  // 짙은 남색
  [CELL_FREE]:     { r: 27,  g: 67,  b: 50  },  // 다크 민트 그린
  [CELL_OCCUPIED]: { r: 127, g: 29,  b: 29  },  // 다크 레드
};

// 밝은 확정 색 (opacity 1)
const SLAM_COLORS_BRIGHT = {
  [CELL_FREE]:     { r: 105, g: 240, b: 174 }, // 민트
  [CELL_OCCUPIED]: { r: 239, g: 83,  b: 80  }, // 빨강
};

class SlamMap {
  constructor() {
    this.gridW   = GRID_W;
    this.gridH   = GRID_H;
    this.cells   = new Uint8Array(GRID_W * GRID_H);
    this.opacity = new Float32Array(GRID_W * GRID_H);
    this.hitCount= new Uint16Array(GRID_W * GRID_H);
    this.freeCnt = new Uint16Array(GRID_W * GRID_H);
    this._exploredCount = 0;
    this._occupiedSet   = new Set();
  }

  idx(gx, gy) { return gy * GRID_W + gx; }

  inBounds(gx, gy) { return gx >= 0 && gx < GRID_W && gy >= 0 && gy < GRID_H; }

  /**
   * 월드의 장애물을 SLAM 맵에 사전 등록 (dead-zone 제거)
   * 로봇이 직접 스캔하지 않아도 장애물 위치가 OCCUPIED로 채워짐
   */
  initWithObstacles(world) {
    for (const obs of world.obstacles) {
      const gx0 = Math.floor(obs.x / GRID_CELL);
      const gy0 = Math.floor(obs.y / GRID_CELL);
      const gx1 = Math.ceil((obs.x + obs.w) / GRID_CELL);
      const gy1 = Math.ceil((obs.y + obs.h) / GRID_CELL);
      for (let gy = gy0; gy <= gy1; gy++) {
        for (let gx = gx0; gx <= gx1; gx++) {
          if (!this.inBounds(gx, gy)) continue;
          const id = this.idx(gx, gy);
          if (this.cells[id] === CELL_UNKNOWN) {
            this._exploredCount++;
          }
          this.cells[id]    = CELL_OCCUPIED;
          this.hitCount[id] = 9999; // 절대 덮어쓸 수 없는 락 해시값
          this.opacity[id]  = 1.0;  // 처음부터 완전한 불투명 빨간색
          this._occupiedSet.add(id);
        }
      }
    }

    // 벽도 OCCUPIED 등록
    const wt = WALL_T;
    this._fillRect(0, 0, WORLD_W, wt);                  // 상단 벽
    this._fillRect(0, WORLD_H - wt, WORLD_W, wt);       // 하단 벽
    this._fillRect(0, 0, wt, WORLD_H);                  // 좌측 벽
    this._fillRect(WORLD_W - wt, 0, wt, WORLD_H);       // 우측 벽
  }

  /** 픽셀 사각형 영역을 OCCUPIED로 초기화 */
  _fillRect(px, py, pw, ph) {
    const gx0 = Math.max(0, Math.floor(px / GRID_CELL));
    const gy0 = Math.max(0, Math.floor(py / GRID_CELL));
    const gx1 = Math.min(GRID_W - 1, Math.ceil((px + pw) / GRID_CELL));
    const gy1 = Math.min(GRID_H - 1, Math.ceil((py + ph) / GRID_CELL));
    for (let gy = gy0; gy <= gy1; gy++) {
      for (let gx = gx0; gx <= gx1; gx++) {
        const id = this.idx(gx, gy);
        if (this.cells[id] === CELL_UNKNOWN) this._exploredCount++;
        this.cells[id]    = CELL_OCCUPIED;
        this.hitCount[id] = 9999;
        this.opacity[id]  = 1.0;
        this._occupiedSet.add(id);
      }
    }
  }

  /**
   * 라이다 스캔 결과로 그리드 업데이트
   */
  update(rays, robotX, robotY, world) {
    for (const ray of rays) {
      const freeCells = Lidar.bresenhamCells(robotX, robotY, ray.hitX, ray.hitY, GRID_CELL);

      for (let i = 0; i < freeCells.length; i++) {
        const { gx, gy } = freeCells[i];
        if (!this.inBounds(gx, gy)) continue;
        const id = this.idx(gx, gy);

        const isLast = (i === freeCells.length - 1);

        if (isLast && ray.hit) {
          this.hitCount[id]++;
          if (this.hitCount[id] >= 2) {
            this._setCell(id, gx, gy, CELL_OCCUPIED);

            // ✅ 히트한 셀이 속한 장애물의 내부 전체를 OCCUPIED로 채우기
            if (world) {
              const worldX = gx * GRID_CELL + GRID_CELL / 2;
              const worldY = gy * GRID_CELL + GRID_CELL / 2;
              const obs = world.getObstacleAt(worldX, worldY);
              if (obs) {
                const ogx0 = Math.floor(obs.x / GRID_CELL);
                const ogy0 = Math.floor(obs.y / GRID_CELL);
                const ogx1 = Math.ceil((obs.x + obs.w) / GRID_CELL);
                const ogy1 = Math.ceil((obs.y + obs.h) / GRID_CELL);
                for (let gy2 = ogy0; gy2 <= ogy1; gy2++) {
                  for (let gx2 = ogx0; gx2 <= ogx1; gx2++) {
                    if (!this.inBounds(gx2, gy2)) continue;
                    const id2 = this.idx(gx2, gy2);
                    this._setCell(id2, gx2, gy2, CELL_OCCUPIED);
                    this.hitCount[id2] = 9999; // 라이다가 절대 덮어쓸 수 없도록 락 설정
                    this.opacity[id2] = 1.0;
                  }
                }
              }
            }
          }
        } else {
          this.freeCnt[id]++;
          if (this.hitCount[id] < 9999) { // 사전등록 셀은 덮어쓰지 않음
            this._setCell(id, gx, gy, CELL_FREE);
          }
        }
        // 스캔된 셀은 opacity를 1로 빠르게 올림
        if (this.opacity[id] < 1) this.opacity[id] = Math.min(1, this.opacity[id] + 0.15);
      }
    }
  }

  _setCell(id, gx, gy, state) {
    const prev = this.cells[id];
    this.cells[id] = state;
    if (prev === CELL_UNKNOWN && state !== CELL_UNKNOWN) {
      this._exploredCount++;
    }
    if (state === CELL_OCCUPIED) this._occupiedSet.add(id);
    else                          this._occupiedSet.delete(id);
    if (this.opacity[id] < 0.1) this.opacity[id] = 0.05;
  }

  tickOpacity(dt) {
    const speed = 2.5;
    for (let i = 0; i < this.opacity.length; i++) {
      if (this.opacity[i] > 0 && this.opacity[i] < 1) {
        this.opacity[i] = Math.min(1, this.opacity[i] + speed * dt);
      }
    }
  }

  get exploreRate() {
    const total = GRID_W * GRID_H;
    return Math.round((this._exploredCount / total) * 100);
  }

  get occupiedCount() {
    return this._occupiedSet.size;
  }

  invalidateRegion(x, y, w, h) {
    const gx0 = Math.max(0, Math.floor(x / GRID_CELL));
    const gy0 = Math.max(0, Math.floor(y / GRID_CELL));
    const gx1 = Math.min(GRID_W - 1, Math.ceil((x + w) / GRID_CELL));
    const gy1 = Math.min(GRID_H - 1, Math.ceil((y + h) / GRID_CELL));

    for (let gy = gy0; gy <= gy1; gy++) {
      for (let gx = gx0; gx <= gx1; gx++) {
        const id = this.idx(gx, gy);
        if (this.cells[id] !== CELL_UNKNOWN) {
          this.cells[id]    = CELL_UNKNOWN;
          this.opacity[id]  = 0;
          this.hitCount[id] = 0;
          this.freeCnt[id]  = 0;
          this._exploredCount = Math.max(0, this._exploredCount - 1);
          this._occupiedSet.delete(id);
        }
      }
    }
  }

  /** 개별 장애물 추가/이동 시 SLAM 맵에 즉시 잠금 등록 */
  registerObstacle(obs) {
    const gx0 = Math.floor(obs.x / GRID_CELL);
    const gy0 = Math.floor(obs.y / GRID_CELL);
    const gx1 = Math.ceil((obs.x + obs.w) / GRID_CELL);
    const gy1 = Math.ceil((obs.y + obs.h) / GRID_CELL);
    for (let gy = gy0; gy <= gy1; gy++) {
      for (let gx = gx0; gx <= gx1; gx++) {
        if (!this.inBounds(gx, gy)) continue;
        const id = this.idx(gx, gy);
        if (this.cells[id] === CELL_UNKNOWN) {
          this._exploredCount++;
        }
        this.cells[id]    = CELL_OCCUPIED;
        this.hitCount[id] = 9999;
        this.opacity[id]  = 1.0;
        this._occupiedSet.add(id);
      }
    }
  }

  reset() {
    this.cells.fill(0);
    this.opacity.fill(0);
    this.hitCount.fill(0);
    this.freeCnt.fill(0);
    this._exploredCount = 0;
    this._occupiedSet.clear();
  }

  toImageData(ctx) {
    const imgData = ctx.createImageData(GRID_W, GRID_H);
    const data = imgData.data;

    for (let i = 0; i < this.cells.length; i++) {
      const state = this.cells[i];
      const op    = this.opacity[i];
      const base  = SLAM_COLORS[CELL_UNKNOWN];
      const bright = state === CELL_UNKNOWN ? null : SLAM_COLORS_BRIGHT[state];

      let r = base.r, g = base.g, b = base.b;
      if (bright && op > 0) {
        r = Math.round(base.r + (bright.r - base.r) * op);
        g = Math.round(base.g + (bright.g - base.g) * op);
        b = Math.round(base.b + (bright.b - base.b) * op);
      }

      const px = i * 4;
      data[px]     = r;
      data[px + 1] = g;
      data[px + 2] = b;
      data[px + 3] = 255;
    }
    return imgData;
  }
}
