/* ================================================================
   dashboard.js  —  대시보드 애니메이션 엔진
   SLAM 지도, TF 트리, 텔레메트리 실시간 시각화
   ================================================================ */

'use strict';

const DashboardEngine = (() => {
  let slamAnimId   = null;
  let telemTimers  = [];
  let slamCtx      = null;
  let tfCtx        = null;

  /* ── Polyfill: CanvasRenderingContext2D.roundRect ── */
  if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
      r = Math.min(r, w / 2, h / 2);
      this.beginPath();
      this.moveTo(x + r, y);
      this.lineTo(x + w - r, y);
      this.quadraticCurveTo(x + w, y, x + w, y + r);
      this.lineTo(x + w, y + h - r);
      this.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      this.lineTo(x + r, y + h);
      this.quadraticCurveTo(x, y + h, x, y + h - r);
      this.lineTo(x, y + r);
      this.quadraticCurveTo(x, y, x + r, y);
      this.closePath();
    };
  }

  /* ── Public: init ── */
  function init(config) {
    stop(); // clear previous

    const slamCanvas = document.getElementById('canvas-slam-dash');
    const tfCanvas   = document.getElementById('canvas-tf');

    if (slamCanvas) {
      slamCanvas.width  = slamCanvas.offsetWidth  || 600;
      slamCanvas.height = slamCanvas.offsetHeight || 400;
      slamCtx = slamCanvas.getContext('2d');
    }
    if (tfCanvas) {
      tfCanvas.width  = tfCanvas.offsetWidth  || 340;
      tfCanvas.height = tfCanvas.offsetHeight || 175;
      tfCtx = tfCanvas.getContext('2d');
    }

    updateSensorStatus(config.sensors || {});
    startTelemetry(config.sensors || {});

    if (config.slamActive) {
      startSLAM(!!config.unstableSlam);
    } else {
      drawSLAMIdle();
    }

    if (tfCtx) {
      drawTFTree(config.tfActive || false, config.sensors || {});
    }
  }

  /* ── Public: stop ── */
  function stop() {
    if (slamAnimId) { cancelAnimationFrame(slamAnimId); slamAnimId = null; }
    telemTimers.forEach(clearInterval);
    telemTimers = [];
  }

  /* ── Sensor Status ── */
  function updateSensorStatus(sensors) {
    const MAP = [
      { key: 'cpu',     id: 'sensor-cpu'     },
      { key: 'mcu',     id: 'sensor-mcu'     },
      { key: 'power',   id: 'sensor-power'   },
      { key: 'encoder', id: 'sensor-encoder' },
      { key: 'lidar',   id: 'sensor-lidar'   },
      { key: 'imu',     id: 'sensor-imu'     },
      { key: 'camera',  id: 'sensor-camera'  },
    ];
    MAP.forEach(({ key, id }) => {
      const el = document.getElementById(id);
      if (!el) return;
      const on  = !!sensors[key];
      const led = el.querySelector('.sensor-led');
      const txt = el.querySelector('.sensor-status-text');
      if (led) led.className = 'sensor-led' + (on ? ' on' : '');
      if (txt) { txt.textContent = on ? 'ON' : 'OFF'; txt.style.color = on ? '#00ff88' : '#444'; }
      el.className = 'sensor-item ' + (on ? 'active' : 'inactive');
    });
  }

  /* ── Telemetry counters ── */
  function startTelemetry(sensors) {
    const motorOn   = sensors.encoder;
    const systemOn  = sensors.cpu;

    // Speed
    const speedEl = document.getElementById('telem-speed');
    if (speedEl && motorOn) {
      let t = 0;
      telemTimers.push(setInterval(() => {
        t += .06;
        const v = (1.1 + Math.sin(t * .65) * .85 + Math.sin(t * 1.4) * .25).toFixed(2);
        speedEl.textContent = v + ' m/s';
      }, 90));
    } else if (speedEl) {
      speedEl.textContent = '0.00 m/s';
    }

    // Battery
    const battEl = document.getElementById('telem-battery');
    if (battEl && systemOn) {
      let voltage = 12.4;
      telemTimers.push(setInterval(() => {
        voltage = Math.max(11.1, voltage - .0007 + (Math.random() - .5) * .001);
        battEl.textContent  = voltage.toFixed(1) + ' V';
        battEl.className    = 'telem-value ' + (voltage > 12.0 ? 'good' : voltage > 11.5 ? '' : 'warn');
      }, 600));
    }

    // Encoder count
    const encEl = document.getElementById('telem-encoder');
    if (encEl) {
      let count = Math.floor(Math.random() * 5000);
      telemTimers.push(setInterval(() => {
        if (motorOn) count += Math.floor(Math.random() * 55 + 20);
        encEl.textContent = count.toLocaleString('ko-KR');
      }, 80));
    }
  }

  /* ══════════════════════════════════════════════
     SLAM MAP ANIMATION
     unstable=true → 불안정 모드 (Step 3 전용)
     ══════════════════════════════════════════════ */
  function startSLAM(unstable) {
    if (!slamCtx) return;
    const W = slamCtx.canvas.width;
    const H = slamCtx.canvas.height;
    const CELL   = 6;
    const COLS   = Math.floor(W / CELL);
    const ROWS   = Math.floor(H / CELL);
    const R_BOT  = 11;           // 로봇 충돌 반경 (px)
    const SPEED  = unstable ? 1.4 : 1.8;
    const AVOID_R = 46;          // 벽 회피 감지 반경

    // 0=unknown, 1=free, 2=occupied
    const grid = new Uint8Array(COLS * ROWS);

    const walls     = buildWalls(W, H);
    const waypoints = buildWaypoints(W, H);
    let wpIdx  = 0;

    // 로봇 초기 위치: 왼쪽 위 구역 (벽과 충분히 떨어진 곳)
    let rx = W * .14, ry = H * .18;
    let rAngle = 0;
    let frame  = 0;

    // 불안정 모드 상태
    let stopTimer    = 0;     // 멈춤 남은 프레임
    let erraticTimer = 0;     // 불규칙 회전 남은 프레임
    let erraticSign  = 1;
    let statusText   = '';
    let statusAlpha  = 0;

    // 스턱 감지 및 탈출 변수
    let stuckCount   = 0;
    let lastRx       = rx;
    let lastRy       = ry;
    let backupTimer  = 0;

    /* ── 헬퍼: 점 → 선분 최근접 점 ── */
    function closestPtOnSeg(px, py, ax, ay, bx, by) {
      const dx = bx-ax, dy = by-ay;
      const len2 = dx*dx + dy*dy;
      if (len2 < 1e-9) return { x: ax, y: ay };
      let t = ((px-ax)*dx + (py-ay)*dy) / len2;
      t = Math.max(0, Math.min(1, t));
      return { x: ax+t*dx, y: ay+t*dy };
    }

    /* ── 헬퍼: 로봇 원과 벽 충돌 여부 ── */
    function collidesWall(cx, cy, radius) {
      for (const w of walls) {
        const p = closestPtOnSeg(cx, cy, w.x1, w.y1, w.x2, w.y2);
        const dx = cx - p.x, dy = cy - p.y;
        if (dx*dx + dy*dy < radius*radius) return true;
      }
      return false;
    }

    /* ── 헬퍼: 포텐셜 필드 스티어링 ── */
    function computeSteering() {
      // 1) 웨이포인트 인력
      const wp = waypoints[wpIdx];
      const tdx = wp.x - rx, tdy = wp.y - ry;
      const tdist = Math.sqrt(tdx*tdx + tdy*tdy);
      let fx = tdx / (tdist + .01) * 2.0;
      let fy = tdy / (tdist + .01) * 2.0;

      // 2) 벽 척력 (Potential Field)
      for (const w of walls) {
        const p = closestPtOnSeg(rx, ry, w.x1, w.y1, w.x2, w.y2);
        const ex = rx - p.x, ey = ry - p.y;
        const d  = Math.sqrt(ex*ex + ey*ey);
        if (d < AVOID_R && d > 0.1) {
          const strength = Math.pow((AVOID_R - d) / AVOID_R, 2) * 8.5;
          fx += (ex / d) * strength;
          fy += (ey / d) * strength;
        }
      }
      return { fx, fy, dist: tdist };
    }

    function loop() {
      frame++;

      const isMovingNow = unstable ? (stopTimer === 0) : true;

      // ── 스턱 시 후진 동작 ──
      if (backupTimer > 0) {
        backupTimer--;
        rx -= Math.cos(rAngle) * SPEED * 0.75;
        ry -= Math.sin(rAngle) * SPEED * 0.75;
        rAngle += 0.09; // 회전하며 탈출 유도
        castAndMark();
        draw(grid, COLS, ROWS, CELL, rx, ry, rAngle, lastHits, frame, isMovingNow, statusText, statusAlpha);
        slamAnimId = requestAnimationFrame(loop);
        return;
      }

      /* ── 불안정 모드: 랜덤 정지 & 이상 행동 ── */
      if (unstable) {
        // 정지 카운트다운
        if (stopTimer > 0) {
          stopTimer--;
          // 멈춘 동안은 약간 진동만
          rx += (Math.random() - .5) * .18;
          ry += (Math.random() - .5) * .18;
          castAndMark();
          draw(grid, COLS, ROWS, CELL, rx, ry, rAngle, lastHits, frame, false, statusText, statusAlpha);
          slamAnimId = requestAnimationFrame(loop);
          return;
        }
        // 새 정지 이벤트 (약 3~8초마다)
        if (Math.random() < 0.004) {
          stopTimer = 55 + Math.floor(Math.random() * 85);
          statusText  = ['⚠ 센서 오류 감지...', '📡 신호 재동기화 중...', '🔄 재시작 중...'][Math.floor(Math.random()*3)];
          statusAlpha = 1.0;
        }
        // 불규칙 회전
        if (erraticTimer > 0) {
          erraticTimer--;
          rAngle += erraticSign * 0.055;
        } else if (Math.random() < 0.006) {
          erraticTimer = 18 + Math.floor(Math.random() * 28);
          erraticSign  = Math.random() < .5 ? 1 : -1;
          statusText  = '⚠ 경로 이탈!';
          statusAlpha = 1.0;
        }
        // 센서 노이즈 (미세 지터)
        rx += (Math.random() - .5) * .35;
        ry += (Math.random() - .5) * .35;
        // 상태 메시지 페이드
        if (statusAlpha > 0) statusAlpha = Math.max(0, statusAlpha - .008);
      }

      /* ── 웨이포인트 도달 체크 ── */
      const { fx, fy, dist } = computeSteering();
      if (dist < 20) {
        wpIdx = (wpIdx + 1) % waypoints.length;
      }

      // ── 스턱 감지 (매 25프레임마다) ──
      if (frame % 25 === 0) {
        const moved = Math.hypot(rx - lastRx, ry - lastRy);
        if (moved < 3.2 && !unstable && backupTimer <= 0) {
          stuckCount++;
          if (stuckCount >= 2) { // 50프레임(약 0.8초) 정차 시 탈출
            backupTimer = 30; // 30프레임 후진
            stuckCount = 0;
            wpIdx = (wpIdx + 1) % waypoints.length; // 다음 포인트 스킵
          }
        } else {
          stuckCount = 0;
        }
        lastRx = rx;
        lastRy = ry;
      }

      /* ── 목표 방향으로 회전 ── */
      const targetAngle = Math.atan2(fy, fx);
      let diff = targetAngle - rAngle;
      // [-PI, PI] 정규화
      while (diff >  Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      // 불안정 모드는 회전이 더 느리고 과도 반응
      const turnRate = unstable ? 0.045 : 0.07;
      rAngle += diff * turnRate;

      /* ── 이동: 충돌 없으면 전진, 있으면 슬라이드 시도 ── */
      const nx = rx + Math.cos(rAngle) * SPEED;
      const ny = ry + Math.sin(rAngle) * SPEED;

      if (!collidesWall(nx, ny, R_BOT)) {
        rx = nx; ry = ny;
      } else {
        // 수평/수직 슬라이드 시도
        const nx2 = rx + Math.cos(rAngle) * SPEED;
        const ny2 = ry;
        if (!collidesWall(nx2, ny2, R_BOT)) { rx = nx2; }
        else {
          const nx3 = rx;
          const ny3 = ry + Math.sin(rAngle) * SPEED;
          if (!collidesWall(nx3, ny3, R_BOT)) { ry = ny3; }
          else {
            // 막힌 경우: 뒤로 살짝 + 회전
            rAngle += (unstable ? .18 : .12);
          }
        }
      }

      /* ── LiDAR 레이캐스팅 ── */
      castAndMark();
      draw(grid, COLS, ROWS, CELL, rx, ry, rAngle, lastHits, frame, isMovingNow, statusText, statusAlpha);
      slamAnimId = requestAnimationFrame(loop);
    }

    let lastHits = [];
    function castAndMark() {
      const RAYS = 72; // 레이 수 증가 (지도 밀도 향상)
      lastHits = [];
      for (let i = 0; i < RAYS; i++) {
        const a = rAngle + (i / RAYS) * Math.PI * 2;
        const h = castRay(rx, ry, a, 260, walls); // 스캔 범위 200 -> 260으로 확장
        if (h) {
          lastHits.push(h);
          markGrid(grid, COLS, ROWS, CELL, rx, ry, h.x, h.y);
        }
      }
    }

    loop();
  }

  /* ── 방 레이아웃: ㄱ자 내벽 2개 (명확한 복도) ── */
  function buildWalls(W, H) {
    const m = 24;
    return [
      // 외벽
      { x1: m,   y1: m,   x2: W-m,  y2: m   },
      { x1: W-m, y1: m,   x2: W-m,  y2: H-m },
      { x1: W-m, y1: H-m, x2: m,    y2: H-m },
      { x1: m,   y1: H-m, x2: m,    y2: m   },
      // 내벽 1: 위쪽 구분벽 (왼쪽 위 방 / 오른쪽 위 방 분리)
      { x1: W*.42, y1: m,      x2: W*.42, y2: H*.48 },
      // 내벽 2: 오른쪽 구분벽 하단 연결
      { x1: W*.42, y1: H*.48,  x2: W*.72, y2: H*.48 },
      // 내벽 3: 아래쪽 수직벽 (오른쪽 아래 방 / 왼쪽 통로 분리)
      { x1: W*.25, y1: H*.62,  x2: W*.25, y2: H-m   },
    ];
  }

  /* ── 웨이포인트: 내벽 충돌을 피해 안전하게 교실을 순환하는 경로 ── */
  function buildWaypoints(W, H) {
    return [
      { x: W*.14, y: H*.18 },   // 1. 왼쪽 위 방
      { x: W*.14, y: H*.55 },   // 2. 왼쪽 중간 통로
      { x: W*.14, y: H*.82 },   // 3. 왼쪽 아래 방
      { x: W*.14, y: H*.52 },   // [우회] 4. 내벽 3 우회 좌측 위
      { x: W*.35, y: H*.52 },   // [우회] 5. 내벽 3 우회 우측 위
      { x: W*.48, y: H*.82 },   // 6. 아래 중앙
      { x: W*.82, y: H*.82 },   // 7. 오른쪽 아래 방
      { x: W*.82, y: H*.55 },   // 8. 오른쪽 중간 통로
      { x: W*.82, y: H*.18 },   // 9. 오른쪽 위 방
      { x: W*.78, y: H*.55 },   // [우회] 10. 내벽 2 우측 하단 통과
      { x: W*.42, y: H*.55 },   // [우회] 11. 내벽 2/1 꼭짓점 하단 통과
      { x: W*.28, y: H*.55 },   // [우회] 12. 내벽 1 좌측 하단 통과
      { x: W*.28, y: H*.30 },   // 13. 왼쪽 위 방 복귀 전 통로
    ];
  }

  function castRay(ox, oy, angle, maxD, walls) {
    const dx = Math.cos(angle), dy = Math.sin(angle);
    let minT = maxD, hx = null, hy = null;
    for (const w of walls) {
      const t = segIntersect(ox, oy, dx, dy, w.x1, w.y1, w.x2, w.y2);
      if (t !== null && t > 0 && t < minT) { minT = t; hx = ox + dx * t; hy = oy + dy * t; }
    }
    return hx !== null ? { x: hx, y: hy, d: minT } : null;
  }

  function segIntersect(ox, oy, dx, dy, x1, y1, x2, y2) {
    const wx = x2-x1, wy = y2-y1;
    const den = dx*wy - dy*wx;
    if (Math.abs(den) < 1e-9) return null;
    const t = ((x1-ox)*wy - (y1-oy)*wx) / den;
    const u = ((x1-ox)*dy - (y1-oy)*dx) / den;
    return (t >= 0 && u >= 0 && u <= 1) ? t : null;
  }

  function markGrid(grid, cols, rows, cell, ox, oy, hx, hy) {
    const dx = hx-ox, dy = hy-oy;
    const len   = Math.sqrt(dx*dx + dy*dy);
    const steps = Math.ceil(len / (cell * .6));
    for (let i = 0; i <= steps; i++) {
      const t  = i / steps;
      const cx = Math.floor((ox + dx*t) / cell);
      const cy = Math.floor((oy + dy*t) / cell);
      if (cx < 0 || cx >= cols || cy < 0 || cy >= rows) continue;
      const idx = cy * cols + cx;
      grid[idx] = (i === steps) ? 2 : (grid[idx] !== 2 ? 1 : 2);
    }
  }

  function draw(grid, cols, rows, cell, rx, ry, rAngle, hits, frame, isMoving, statusText, statusAlpha) {
    const ctx = slamCtx;
    const W = ctx.canvas.width, H = ctx.canvas.height;

    // BG
    ctx.fillStyle = '#010810';
    ctx.fillRect(0, 0, W, H);

    // Grid cells
    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        const v = grid[cy * cols + cx];
        if (!v) continue;
        ctx.fillStyle = v === 1 ? 'rgba(0,212,255,.09)' : 'rgba(0,212,255,.72)';
        ctx.fillRect(cx * cell, cy * cell, cell - 1, cell - 1);
      }
    }

    // LiDAR rays + hit points
    ctx.strokeStyle = 'rgba(0,212,255,.22)';
    ctx.lineWidth = .6;
    for (const h of hits) {
      ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(h.x, h.y); ctx.stroke();
      ctx.fillStyle = 'rgba(0,255,136,.85)';
      ctx.beginPath(); ctx.arc(h.x, h.y, 1.4, 0, Math.PI*2); ctx.fill();
    }

    // 정지 중 경고 원 (불안정 모드)
    if (isMoving === false) {
      const pulse = .35 + Math.sin(frame * .15) * .2;
      ctx.strokeStyle = `rgba(255,170,0,${pulse})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.arc(rx, ry, 18, 0, Math.PI*2); ctx.stroke();
      ctx.setLineDash([]);
    }

    // Robot
    ctx.save();
    ctx.translate(rx, ry); ctx.rotate(rAngle);
    // 정지 상태면 주황색, 이동 중이면 cyan
    const robotCol = (isMoving === false) ? '#ffaa00' : '#00d4ff';
    ctx.shadowBlur = 18; ctx.shadowColor = robotCol;
    ctx.fillStyle = robotCol;
    ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(11, 0); ctx.stroke();
    ctx.restore();

    // Scan ring
    const rr = 14 + (frame % 28) * 4;
    const ra = 1 - (frame % 28) / 28;
    ctx.strokeStyle = `rgba(0,212,255,${ra * .35})`;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(rx, ry, rr, 0, Math.PI*2); ctx.stroke();

    // 불안정 상태 메시지 (페이드 아웃)
    if (statusText && statusAlpha > 0) {
      ctx.fillStyle = `rgba(255,170,0,${statusAlpha})`;
      ctx.font = 'bold 11px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(statusText, W / 2, H / 2 - 24);
      ctx.textAlign = 'left';
    }

    // HUD text
    ctx.fillStyle = 'rgba(0,212,255,.55)';
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.fillText(
      `pos: (${(rx/100).toFixed(2)}, ${(ry/100).toFixed(2)}) m  θ: ${(rAngle*180/Math.PI).toFixed(0)}°`,
      8, H - 7
    );
  }

  function drawSLAMIdle() {
    if (!slamCtx) return;
    const ctx = slamCtx;
    const W = ctx.canvas.width, H = ctx.canvas.height;
    ctx.fillStyle = '#010810'; ctx.fillRect(0, 0, W, H);

    // Subtle grid
    ctx.strokeStyle = 'rgba(0,212,255,.05)'; ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 22) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
    for (let y = 0; y < H; y += 22) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

    ctx.fillStyle = 'rgba(0,212,255,.35)'; ctx.shadowBlur = 12; ctx.shadowColor = '#00d4ff';
    ctx.beginPath(); ctx.arc(W/2, H/2, 10, 0, Math.PI*2); ctx.fill(); ctx.shadowBlur = 0;

    ctx.fillStyle = 'rgba(0,212,255,.28)';
    ctx.font = '11px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('SLAM 대기 중 — 센서 추가 장착 후 활성화됩니다', W/2, H - 14);
    ctx.textAlign = 'left';
  }

  /* ══════════════════════════════════════════════
     TF TREE VISUALIZATION
     ══════════════════════════════════════════════ */
  function drawTFTree(active, sensors) {
    if (!tfCtx) return;
    const ctx = tfCtx;
    const W = ctx.canvas.width, H = ctx.canvas.height;
    ctx.fillStyle = '#010810'; ctx.fillRect(0, 0, W, H);

    const COL = (c) => active ? c : '#333';
    const SEN = (k, c) => (sensors[k] && active) ? c : '#333';

    const nodes = [
      { x: W/2,    y: 18,      label: 'world',        color: COL('#00ff88') },
      { x: W/2,    y: 52,      label: 'odom',         color: COL('#00d4ff') },
      { x: W/2,    y: 88,      label: 'base_link',    color: COL('#00d4ff') },
      { x: W*.18,  y: 138,     label: 'lidar_link',   color: SEN('lidar','#00ff88') },
      { x: W/2,    y: 138,     label: 'camera_link',  color: SEN('camera','#ff4466') },
      { x: W*.82,  y: 138,     label: 'imu_link',     color: SEN('imu','#7b2fff')  },
    ];
    const edges = [[0,1],[1,2],[2,3],[2,4],[2,5]];
    const nMap = {};
    nodes.forEach(n => nMap[n.label] = n);

    // Edges
    edges.forEach(([fi, ti]) => {
      const a = nodes[fi], b = nodes[ti];
      const on = (a.color !== '#333') && (b.color !== '#333');
      ctx.strokeStyle = on ? 'rgba(0,212,255,.4)' : 'rgba(80,80,90,.35)';
      ctx.lineWidth = on ? 1.5 : .8;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y + 9); ctx.lineTo(b.x, b.y - 9);
      ctx.stroke(); ctx.setLineDash([]);
      if (on) arrow(ctx, a.x, a.y+9, b.x, b.y-9, 'rgba(0,212,255,.6)');
    });

    // Nodes
    nodes.forEach(n => {
      const active2 = n.color !== '#333';
      ctx.fillStyle   = active2 ? 'rgba(0,15,35,.95)' : 'rgba(25,25,32,.9)';
      ctx.strokeStyle = n.color;
      ctx.lineWidth   = active2 ? 1.5 : .8;
      ctx.shadowBlur  = active2 ? 8 : 0;
      ctx.shadowColor = n.color;
      ctx.beginPath();
      ctx.roundRect(n.x - 42, n.y - 9, 84, 18, 4);
      ctx.fill(); ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.fillStyle = n.color;
      ctx.font = '9px JetBrains Mono, monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(n.label, n.x, n.y);
    });
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';

    // Footer status
    ctx.fillStyle = active ? 'rgba(0,255,136,.55)' : 'rgba(80,80,100,.55)';
    ctx.font = '8.5px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(active ? 'TF TREE: ALIGNED ✓' : 'TF TREE: OFFLINE', W/2, H - 4);
    ctx.textAlign = 'left';
  }

  function arrow(ctx, x1, y1, x2, y2, color) {
    const a = Math.atan2(y2-y1, x2-x1);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - 6*Math.cos(a-.4), y2 - 6*Math.sin(a-.4));
    ctx.lineTo(x2 - 6*Math.cos(a+.4), y2 - 6*Math.sin(a+.4));
    ctx.closePath(); ctx.fill();
  }

  return { init, stop };
})();
