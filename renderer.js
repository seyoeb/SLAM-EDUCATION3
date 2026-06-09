/**
 * renderer.js — Canvas 렌더링
 * 실제 뷰 (교실 탑다운) + SLAM 맵 뷰
 */

class Renderer {
  constructor(realCanvas, slamCanvas) {
    this.rc  = realCanvas;
    this.sc  = slamCanvas;
    this.rctx = realCanvas.getContext('2d');
    this.sctx = slamCanvas.getContext('2d');

    this.showLidar = true;
    this.xrayMode  = false;
    this._slamOffscreen = null;
    this._slamOCtx = null;
    this._initSlamOffscreen();
  }

  _initSlamOffscreen() {
    this._slamOffscreen = document.createElement('canvas');
    this._slamOffscreen.width  = GRID_W;
    this._slamOffscreen.height = GRID_H;
    this._slamOCtx = this._slamOffscreen.getContext('2d');
  }

  // ─────────────────────────────────────────
  //  실제 뷰 렌더링
  // ─────────────────────────────────────────
  drawReal(world, robot, lidarRays) {
    const ctx = this.rctx;
    const W = this.rc.width, H = this.rc.height;
    ctx.clearRect(0, 0, W, H);

    this._drawFloor(ctx, W, H);
    this._drawWalls(ctx, W, H);
    if (this.showLidar && lidarRays.length > 0) {
      this._drawLidarFan(ctx, robot, lidarRays);
    }
    this._drawTrail(ctx, robot);
    this._drawObstacles(ctx, world.obstacles);
    
    // 아이템과 움직이는 학생 드로잉
    this._drawItems(ctx, world.items);
    this._drawStudents(ctx, world.students);

    if (this.showLidar && lidarRays.length > 0) {
      this._drawLidarRays(ctx, robot, lidarRays);
    }
    this._drawRobot(ctx, robot);

    // X-Ray 모드: SLAM 맵을 반투명하게 오버레이
    if (this.xrayMode && this._slamOffscreen) {
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.drawImage(this._slamOffscreen, 0, 0, GRID_W * GRID_CELL, GRID_H * GRID_CELL);
      ctx.globalAlpha = 1;
      ctx.restore();
    }
  }

  _drawFloor(ctx, W, H) {
    // 배경
    ctx.fillStyle = '#0e1621';
    ctx.fillRect(0, 0, W, H);

    // 격자 무늬 바닥
    ctx.strokeStyle = 'rgba(255,255,255,0.035)';
    ctx.lineWidth = 0.5;
    for (let x = WALL_T; x < W - WALL_T; x += GRID_CELL * 2) {
      ctx.beginPath();
      ctx.moveTo(x, WALL_T);
      ctx.lineTo(x, H - WALL_T);
      ctx.stroke();
    }
    for (let y = WALL_T; y < H - WALL_T; y += GRID_CELL * 2) {
      ctx.beginPath();
      ctx.moveTo(WALL_T, y);
      ctx.lineTo(W - WALL_T, y);
      ctx.stroke();
    }
  }

  _drawWalls(ctx, W, H) {
    const T = WALL_T;
    // 그림자 효과
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur  = 10;

    const grad = ctx.createLinearGradient(0, 0, 0, T);
    grad.addColorStop(0, '#2d3a4a');
    grad.addColorStop(1, '#1a2633');

    // 4면 벽
    const walls = [
      [0, 0, W, T],
      [0, H - T, W, T],
      [0, 0, T, H],
      [W - T, 0, T, H],
    ];
    ctx.fillStyle = grad;
    for (const [x, y, w, h] of walls) ctx.fillRect(x, y, w, h);

    // 벽 내부 테두리
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#3a4a5a';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(T, T, W - 2 * T, H - 2 * T);
  }

  _drawLidarFan(ctx, robot, rays) {
    if (rays.length < 2) return;
    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = '#00e5ff';
    ctx.beginPath();
    ctx.moveTo(robot.x, robot.y);
    for (const ray of rays) {
      ctx.lineTo(ray.hitX, ray.hitY);
    }
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  _drawLidarRays(ctx, robot, rays) {
    ctx.lineWidth = 0.8;
    for (const ray of rays) {
      if (ray.hit) {
        // 히트 광선 (빨강)
        ctx.strokeStyle = 'rgba(255,100,80,0.55)';
        ctx.beginPath();
        ctx.moveTo(robot.x, robot.y);
        ctx.lineTo(ray.hitX, ray.hitY);
        ctx.stroke();

        // 히트포인트 강조
        ctx.fillStyle = '#ff6450';
        ctx.shadowColor = '#ff6450';
        ctx.shadowBlur  = 6;
        ctx.beginPath();
        ctx.arc(ray.hitX, ray.hitY, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      } else {
        // 미감지 광선 (사이언)
        ctx.strokeStyle = 'rgba(0,229,255,0.2)';
        ctx.beginPath();
        ctx.moveTo(robot.x, robot.y);
        ctx.lineTo(ray.hitX, ray.hitY);
        ctx.stroke();
      }
    }
  }

  _drawTrail(ctx, robot) {
    if (robot.trail.length < 2) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(66,165,245,0.4)';
    ctx.lineWidth = 2;
    ctx.lineCap   = 'round';
    ctx.lineJoin  = 'round';
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(robot.trail[0].x, robot.trail[0].y);
    for (let i = 1; i < robot.trail.length; i++) {
      ctx.lineTo(robot.trail[i].x, robot.trail[i].y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  _drawObstacles(ctx, obstacles) {
    for (const obs of obstacles) {
      const def = OBSTACLE_TYPES[obs.type];
      if (!def) continue;

      // 그림자
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur  = 8;
      ctx.shadowOffsetX = 3;
      ctx.shadowOffsetY = 3;

      // 몸체
      ctx.fillStyle = def.color;
      ctx.strokeStyle = def.borderColor;
      ctx.lineWidth = 2;

      const rx = 4;
      this._roundRect(ctx, obs.x, obs.y, obs.w, obs.h, rx);
      ctx.fill();
      ctx.stroke();

      ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;

      // 이모지 레이블
      ctx.font = `${Math.min(obs.w, obs.h) * 0.55}px serif`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(def.emoji, obs.x + obs.w / 2, obs.y + obs.h / 2);

      // 고정 장애물 표시
      if (obs.fixed) {
        ctx.font = '8px Noto Sans KR';
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fillText(def.label, obs.x + obs.w / 2, obs.y + obs.h + 7);
      }
    }
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  _drawRobot(ctx, robot) {
    const { x, y, angle } = robot;
    const R = ROBOT_RADIUS;

    const isHit = robot.damageTimer > 0;

    // 이동 시 혹은 피격 시 네온 글로우
    if (isHit) {
      // 깜빡거리는 빨간색 효과 (20Hz)
      const flash = Math.floor(robot.damageTimer * 20) % 2 === 0;
      ctx.shadowColor = flash ? '#ff1744' : 'transparent';
      ctx.shadowBlur  = flash ? 24 : 0;
    } else if (robot.moving) {
      ctx.shadowColor = '#00e5ff';
      ctx.shadowBlur  = 18;
    }

    // 로봇 몸체 (원형)
    const grad = ctx.createRadialGradient(x, y, 2, x, y, R);
    if (isHit) {
      grad.addColorStop(0, '#ff8a80');
      grad.addColorStop(1, '#c62828');
    } else {
      grad.addColorStop(0, '#4dd0e1');
      grad.addColorStop(1, '#006064');
    }
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, R, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = isHit ? '#ff1744' : '#00e5ff';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.shadowBlur = 0;

    // 방향 표시 (앞 화살표)
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = isHit ? '#ff1744' : '#00e5ff';
    ctx.beginPath();
    ctx.moveTo(R - 2, 0);
    ctx.lineTo(R - 9, -5);
    ctx.lineTo(R - 9,  5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 중앙 점
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // ─────────────────────────────────────────
  //  SLAM 맵 뷰 렌더링
  // ─────────────────────────────────────────
  drawSlam(slamMap, robot) {
    const ctx  = this.sctx;
    const octx = this._slamOCtx;
    const W    = this.sc.width, H = this.sc.height;
    const scale = W / GRID_W; // = GRID_CELL

    // 오프스크린: 그리드 셀 색상
    const imgData = slamMap.toImageData(octx);
    octx.putImageData(imgData, 0, 0);

    // 스케일 업 렌더
    ctx.clearRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this._slamOffscreen, 0, 0, W, H);

    // 그리드 라인 (희미하게)
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth   = 0.5;
    for (let gx = 0; gx <= GRID_W; gx++) {
      ctx.beginPath();
      ctx.moveTo(gx * scale, 0);
      ctx.lineTo(gx * scale, H);
      ctx.stroke();
    }
    for (let gy = 0; gy <= GRID_H; gy++) {
      ctx.beginPath();
      ctx.moveTo(0, gy * scale);
      ctx.lineTo(W, gy * scale);
      ctx.stroke();
    }

    // 로봇 경로 오버레이
    this._drawSlamTrail(ctx, robot, scale);

    // 로봇 위치
    this._drawSlamRobot(ctx, robot, scale);

    // 외벽 테두리
    ctx.strokeStyle = '#3a4a5a';
    ctx.lineWidth   = 3;
    ctx.strokeRect(0, 0, W, H);
  }

  _drawSlamTrail(ctx, robot, scale) {
    if (robot.trail.length < 2) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(66,165,245,0.5)';
    ctx.lineWidth   = 2;
    ctx.lineCap     = 'round';
    ctx.setLineDash([3, 5]);
    ctx.beginPath();
    const c = GRID_CELL;
    ctx.moveTo(robot.trail[0].x / c * scale, robot.trail[0].y / c * scale);
    for (let i = 1; i < robot.trail.length; i++) {
      ctx.lineTo(robot.trail[i].x / c * scale, robot.trail[i].y / c * scale);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  _drawSlamRobot(ctx, robot, scale) {
    const c  = GRID_CELL;
    const rx = (robot.x / c) * scale;
    const ry = (robot.y / c) * scale;
    const R  = (ROBOT_RADIUS / c) * scale;

    // 글로우
    ctx.shadowColor = '#ffeb3b';
    ctx.shadowBlur  = 14;

    ctx.fillStyle   = '#ffeb3b';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.arc(rx, ry, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 방향 표시
    ctx.save();
    ctx.translate(rx, ry);
    ctx.rotate(robot.angle);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(R,     0);
    ctx.lineTo(R - 4, -3);
    ctx.lineTo(R - 4,  3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.shadowBlur = 0;
  }

  _drawItems(ctx, items) {
    if (!items) return;
    for (const item of items) {
      // 글로우 효과
      ctx.shadowColor = item.color;
      ctx.shadowBlur  = 12;

      // 동그란 네온 배경
      ctx.fillStyle = item.type === 'speed' ? 'rgba(255,204,2,0.2)' : 'rgba(0,229,255,0.2)';
      ctx.beginPath();
      ctx.arc(item.x, item.y, 14, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = item.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(item.x, item.y, 14, 0, Math.PI * 2);
      ctx.stroke();

      ctx.shadowBlur = 0;

      // 아이템 이모지
      ctx.font = '16px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(item.emoji, item.x, item.y);
    }
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }

  _drawStudents(ctx, students) {
    if (!students) return;
    for (const s of students) {
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur  = 6;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;

      // 둥근 캡슐형 배경
      ctx.fillStyle = '#455a64';
      ctx.strokeStyle = '#90a4ae';
      ctx.lineWidth = 1.5;
      this._roundRect(ctx, s.x - s.w/2, s.y - s.h/2, s.w, s.h, 6);
      ctx.fill();
      ctx.stroke();

      ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;

      // 학생 이모지
      ctx.font = '15px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(s.emoji, s.x, s.y);
    }
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }

  /** 오프스크린 SLAM 캔버스 참조 반환 (X-Ray용) */
  getSlamOffscreen() { return this._slamOffscreen; }
}
