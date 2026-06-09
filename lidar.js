/**
 * lidar.js — LiDAR 레이캐스팅
 * 로봇 위치에서 방사형 레이저 발사 → 히트포인트 계산
 */

class Lidar {
  constructor(world) {
    this.world      = world;
    this.range      = 100;   // px (초기 범위 단축)
    this.angleSpan  = 270;   // 도
    this.rayCount   = 72;    // 광선 수
    this.lastScan   = [];    // 최근 스캔 결과
  }

  setRange(r)     { this.range = r; }
  setAngleSpan(a) { this.angleSpan = a; }

  /**
   * 스캔 실행
   * @param {number} rx - 로봇 x
   * @param {number} ry - 로봇 y
   * @param {number} rAngle - 로봇 방향 (라디안)
   * @returns {Array} 광선 배열 [{angle, relAngleDeg, hitX, hitY, dist, hit}]
   */
  scan(rx, ry, rAngle) {
    const rays = [];
    const spanRad = (this.angleSpan * Math.PI) / 180;
    const startAngle = rAngle - spanRad / 2;
    const step = spanRad / (this.rayCount - 1);

    for (let i = 0; i < this.rayCount; i++) {
      const angle = startAngle + i * step;
      const endX  = rx + Math.cos(angle) * this.range;
      const endY  = ry + Math.sin(angle) * this.range;

      const t = this.world.raycast(rx, ry, endX, endY);
      const dist   = t * this.range;
      const hitX   = rx + Math.cos(angle) * dist;
      const hitY   = ry + Math.sin(angle) * dist;
      const hit    = t < 0.999;

      // 상대 각도 (자율주행 섹터 계산용)
      let relAngle = angle - rAngle;
      let relDeg = (relAngle * 180 / Math.PI);

      rays.push({ angle, relAngleDeg: relDeg, hitX, hitY, dist, hit, t });
    }

    this.lastScan = rays;
    return rays;
  }

  /**
   * 스캔 결과에서 Bresenham 경로 셀 목록 추출
   * slam.js 에서 그리드 업데이트에 사용
   */
  getCellUpdates(rays, resolution) {
    const updates = [];
    for (const ray of rays) {
      // 광선 경로 상 빈 셀
      const freeCells = this._bresenham(
        ray.angle,
        Math.floor(ray.hitX === undefined ? 0 : /* 시작 */0),
        rays[0].hitX,  // dummy — 아래에서 직접 계산
        resolution,
        ray
      );
      updates.push({ ray, freeCells });
    }
    return updates;
  }

  /**
   * Bresenham 직선으로 (x0,y0)→(x1,y1) 경로 셀 반환
   * resolution: px per cell
   */
  static bresenhamCells(x0, y0, x1, y1, resolution) {
    const cells = [];
    let gx0 = Math.floor(x0 / resolution);
    let gy0 = Math.floor(y0 / resolution);
    const gx1 = Math.floor(x1 / resolution);
    const gy1 = Math.floor(y1 / resolution);

    const dx = Math.abs(gx1 - gx0), sx = gx0 < gx1 ? 1 : -1;
    const dy = Math.abs(gy1 - gy0), sy = gy0 < gy1 ? 1 : -1;
    let err = dx - dy;

    while (true) {
      cells.push({ gx: gx0, gy: gy0 });
      if (gx0 === gx1 && gy0 === gy1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; gx0 += sx; }
      if (e2 <  dx) { err += dx; gy0 += sy; }
    }
    return cells;
  }
}
