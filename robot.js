/**
 * robot.js — 로봇(자동차) 상태 및 이동 제어
 * v3: 웨이포인트 투어 모드 추가 (Victory Tour용)
 *     수동 / 자율주행(Wall-Following+스턱탈출) / 투어 세 가지 모드
 */

const ROBOT_RADIUS   = 14;
const ROBOT_SPEED    = 1.3;
const ROBOT_TURN     = 0.04;
const TRAIL_MAX_LEN  = 2000;

// Victory Tour용 웨이포인트 — 교실 전체를 커버하는 경로 (800x600 맵 대응)
const TOUR_WAYPOINTS = [
  { x: 400, y: 300 }, // 중앙 시작
  { x: 620, y: 300 }, // 우측 통로
  { x: 620, y: 120 }, // 우측 통로 상단
  { x: 400, y: 120 }, // 상단 중앙 (교사 책상 아래)
  { x: 400, y: 220 }, // 중간 통로
  { x: 250, y: 220 },
  { x: 250, y: 120 },
  { x: 90,  y: 120 }, // 좌측 통로 상단
  { x: 90,  y: 340 }, // 좌측 통로 중앙
  { x: 250, y: 340 },
  { x: 250, y: 490 }, // 좌측 통로 하단
  { x: 90,  y: 490 },
  { x: 400, y: 490 }, // 하단 중앙
  { x: 400, y: 390 },
  { x: 620, y: 390 },
  { x: 620, y: 490 }, // 우측 하단
  { x: 400, y: 300 }, // 중앙 복귀
];


class Robot {
  constructor(world) {
    this.world = world;
    this.reset();
    this._setupKeys();
  }

  reset() {
    this.x      = WORLD_W / 2;
    this.y      = WORLD_H / 2;
    this.angle  = -Math.PI / 2;
    this.speed  = 0;
    this.trail  = [];
    this.moving = false;

    this.maxSpeed = ROBOT_SPEED;
    this.turnRate = ROBOT_TURN;

    this.keys = { up: false, down: false, left: false, right: false, brake: false };

    // 체력 및 피격 상태 추가
    this.maxHp = 3;
    this.hp = 3;
    this.damageTimer = 0;
    this.invulnerableTimer = 0;

    // 자율주행 상태
    this.autoMode        = false;
    this.autoState       = 'explore';
    this.autoTimer       = 0;
    this.autoTargetAngle = 1;
    this._lastTurnDir    = 1;
    this._stuckTimer     = 0;
    this._stuckX         = WORLD_W / 2;
    this._stuckY         = WORLD_H / 2;

    // 투어 모드 상태
    this.tourMode        = false;
    this._tourWpIndex    = 0;
    this._tourStuckTimer = 0;
    this._tourLastX      = WORLD_W / 2;
    this._tourLastY      = WORLD_H / 2;
    this._tourWaypoints  = TOUR_WAYPOINTS;
  }

  _setupKeys() {
    this._keydownHandler = (e) => {
      if (this.autoMode || this.tourMode) return;
      switch (e.code) {
        case 'KeyW': case 'ArrowUp':    this.keys.up    = true; e.preventDefault(); break;
        case 'KeyS': case 'ArrowDown':  this.keys.down  = true; e.preventDefault(); break;
        case 'KeyA': case 'ArrowLeft':  this.keys.left  = true; e.preventDefault(); break;
        case 'KeyD': case 'ArrowRight': this.keys.right = true; e.preventDefault(); break;
        case 'Space': this.keys.brake = true; e.preventDefault(); break;
      }
    };
    this._keyupHandler = (e) => {
      switch (e.code) {
        case 'KeyW': case 'ArrowUp':    this.keys.up    = false; break;
        case 'KeyS': case 'ArrowDown':  this.keys.down  = false; break;
        case 'KeyA': case 'ArrowLeft':  this.keys.left  = false; break;
        case 'KeyD': case 'ArrowRight': this.keys.right = false; break;
        case 'Space': this.keys.brake = false; break;
      }
    };
    document.addEventListener('keydown', this._keydownHandler);
    document.addEventListener('keyup',   this._keyupHandler);
  }

  destroy() {
    document.removeEventListener('keydown', this._keydownHandler);
    document.removeEventListener('keyup',   this._keyupHandler);
  }

  update(dt, simSpeed, lidarData) {
    // 피격 및 무적 타이머 업데이트
    if (this.damageTimer > 0) {
      this.damageTimer = Math.max(0, this.damageTimer - dt * simSpeed);
    }
    if (this.invulnerableTimer > 0) {
      this.invulnerableTimer = Math.max(0, this.invulnerableTimer - dt * simSpeed);
    }

    if (this.tourMode) {
      this._updateTour(dt, simSpeed, lidarData);
    } else if (this.autoMode) {
      this._updateAuto(dt, simSpeed, lidarData);
    } else {
      this._updateManual(dt, simSpeed);
    }
  }

  // ──────────────────────────────────────────
  //  투어 모드 (Victory Tour 전용 웨이포인트 추종)
  // ──────────────────────────────────────────
  startTourMode(waypoints) {
    this.tourMode = true;
    this.autoMode = false;
    if (waypoints) this._tourWaypoints = waypoints;
    this._tourWpIndex    = 0;
    this._tourStuckTimer = 0;
    this._tourLastX      = this.x;
    this._tourLastY      = this.y;
    this.speed = this.maxSpeed;
  }

  stopTourMode() {
    this.tourMode = false;
    this.speed = 0;
  }

  /** 웨이포인트 추종 + 라이다 긴급 회피 */
  _updateTour(dt, simSpeed, lidarData) {
    const spd = this.maxSpeed * simSpeed;
    const trn = this.turnRate * simSpeed * 2.5;
    const wps = this._tourWaypoints;
    if (!wps || wps.length === 0) return;

    const wp = wps[this._tourWpIndex % wps.length];
    const dx = wp.x - this.x;
    const dy = wp.y - this.y;
    const dist = Math.hypot(dx, dy);

    // ── 웨이포인트 도달 ──
    if (dist < 22) {
      this._tourWpIndex = (this._tourWpIndex + 1) % wps.length;
      return;
    }

    // ── 라이다 긴급 회피 (앞이 막히면 벽 따라 돌기) ──
    let fwd = 9999;
    if (lidarData && lidarData.length > 0) {
      fwd = this._sectorDist(lidarData, -25, 25);
    }

    if (fwd < 50) {
      // 전방 충돌 임박 (마진 50px로 넉넉하게 감지) → 잠깐 회전하면서 회피
      const left  = lidarData ? this._sectorDist(lidarData, -90, -30) : 9999;
      const right = lidarData ? this._sectorDist(lidarData,  30,  90) : 9999;
      this.angle += (right > left ? -trn : trn);
      this.speed = spd * 0.3;
      this._move();
      return;
    }

    // ── 목표 방향으로 회전 ──
    const targetAngle = Math.atan2(dy, dx);
    let diff = targetAngle - this.angle;
    // [-PI, PI] 정규화
    while (diff >  Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;

    if (Math.abs(diff) > 0.12) {
      // 회전 속도 비례 적용
      const step = Math.sign(diff) * Math.min(trn, Math.abs(diff) * 1.5);
      this.angle += step;
      this.speed = Math.abs(diff) > 0.8 ? spd * 0.25 : spd * 0.6; // 크게 꺾을 때 감속
    } else {
      this.speed = spd; // 정렬됐으면 전속력
    }

    this._move();

    // ── 스턱 감지: 30틱 동안 6px 미만 이동 시 다음 웨이포인트로 스킵 ──
    this._tourStuckTimer += simSpeed;
    if (this._tourStuckTimer > 30) {
      this._tourStuckTimer = 0;
      const moved = Math.hypot(this.x - this._tourLastX, this.y - this._tourLastY);
      if (moved < 6) {
        this._tourWpIndex = (this._tourWpIndex + 1) % wps.length;
      }
      this._tourLastX = this.x;
      this._tourLastY = this.y;
    }
  }

  // ──────────────────────────────────────────
  //  자율주행 (Wall-Following + 스턱 탈출)
  // ──────────────────────────────────────────
  _updateAuto(dt, simSpeed, lidarData) {
    const spd = this.maxSpeed * simSpeed;
    const trn = this.turnRate * simSpeed * 1.5;

    // 스턱 감지
    this._stuckTimer += simSpeed;
    if (this._stuckTimer > 70) {
      this._stuckTimer = 0;
      const moved = Math.hypot(this.x - this._stuckX, this.y - this._stuckY);
      if (moved < 10 && this.autoState === 'explore') {
        this.autoState = 'backup';
        this.autoTimer = 30 + Math.random() * 20;
        this._lastTurnDir *= -1;
      }
      this._stuckX = this.x;
      this._stuckY = this.y;
    }

    // 후진 탈출 모드
    if (this.autoState === 'backup') {
      this.autoTimer -= simSpeed;
      this.angle += trn * this._lastTurnDir * 0.7;
      this.speed = -spd * 0.55;
      this._move();
      if (this.autoTimer <= 0) {
        this.autoState = 'turn';
        this.autoTimer = 35 + Math.random() * 20;
        this.autoTargetAngle = this._lastTurnDir;
      }
      return;
    }

    // 회전 모드
    if (this.autoState === 'turn' && this.autoTimer > 0) {
      this.autoTimer -= simSpeed;
      this.angle += (this.autoTargetAngle > 0 ? trn : -trn);
      this.speed = spd * 0.2;
      this._move();
      if (this.autoTimer <= 0) this.autoState = 'explore';
      return;
    }

    if (!lidarData || lidarData.length === 0) {
      this.speed = spd * 0.5;
      this._move();
      return;
    }

    const fwd  = this._sectorDist(lidarData, -20, 20);
    const fwdL = this._sectorDist(lidarData, -50, -15);
    const fwdR = this._sectorDist(lidarData,  15,  50);
    const left = this._sectorDist(lidarData, -90, -50);
    const right= this._sectorDist(lidarData,  50,  90);

    const SAFE    = 50;
    const CAUTION = 85;

    if (fwd < SAFE) {
      this.autoState = 'turn';
      const wider = (right > left) ? 1 : -1;
      this.autoTargetAngle = (Math.max(left, right) < SAFE)
        ? (this._lastTurnDir * -1) : wider;
      this._lastTurnDir = this.autoTargetAngle;
      this.autoTimer = 22 + Math.random() * 28;
      this.speed = 0;
    } else if (fwd < CAUTION) {
      if (fwdL < fwdR) this.angle += trn * 0.75;
      else             this.angle -= trn * 0.75;
      this.speed = spd * 0.4;
    } else {
      this.speed = spd;
      if (fwdL < fwdR - 20) this.angle += trn * 0.12;
      if (fwdR < fwdL - 20) this.angle -= trn * 0.12;
      if (Math.random() < 0.005) {
        this._lastTurnDir *= -1;
        this.autoState = 'turn';
        this.autoTimer = 8 + Math.random() * 12;
        this.autoTargetAngle = this._lastTurnDir;
      }
    }

    this._move();
  }

  /** 수동 제어 */
  _updateManual(dt, simSpeed) {
    const spd = this.maxSpeed * simSpeed;
    const trn = this.turnRate * simSpeed;

    if (this.keys.brake) {
      this.speed *= 0.85;
    } else {
      if (this.keys.up)   this.speed = Math.min(this.speed + 0.3, spd);
      if (this.keys.down) this.speed = Math.max(this.speed - 0.3, -spd * 0.5);
      if (!this.keys.up && !this.keys.down) this.speed *= 0.9;
    }
    if (this.keys.left)  this.angle -= trn;
    if (this.keys.right) this.angle += trn;
    this._move();
  }

  /** 섹터 평균 거리 */
  _sectorDist(lidarData, minDeg, maxDeg) {
    const rays = lidarData.filter(r => {
      let relDeg = (r.relAngleDeg % 360 + 360) % 360;
      if (relDeg > 180) relDeg -= 360;
      return relDeg >= minDeg && relDeg <= maxDeg;
    });
    if (rays.length === 0) return 9999;
    return rays.reduce((s, r) => s + r.dist, 0) / rays.length;
  }

  /** 이동 + 분리축 충돌 처리 */
  _move() {
    if (Math.abs(this.speed) < 0.01) { this.speed = 0; this.moving = false; return; }
    this.moving = true;

    const nx = this.x + Math.cos(this.angle) * this.speed;
    const ny = this.y + Math.sin(this.angle) * this.speed;

    if (!this.world.circleCollides(nx, this.y, ROBOT_RADIUS)) {
      this.x = nx;
    } else {
      this.speed = 0;
      if (this.autoMode && this.autoState === 'explore') {
        this.autoState = 'backup';
        this.autoTimer = 20 + Math.random() * 15;
        this._lastTurnDir *= -1;
      }
    }
    if (!this.world.circleCollides(this.x, ny, ROBOT_RADIUS)) {
      this.y = ny;
    } else {
      this.speed = 0;
      if (this.autoMode && this.autoState === 'explore') {
        this.autoState = 'backup';
        this.autoTimer = 20 + Math.random() * 15;
        this._lastTurnDir *= -1;
      }
    }

    const last = this.trail[this.trail.length - 1];
    if (!last || Math.hypot(this.x - last.x, this.y - last.y) > 5) {
      this.trail.push({ x: this.x, y: this.y });
      if (this.trail.length > TRAIL_MAX_LEN) this.trail.shift();
    }

    // 아이템 획득 검사
    this.checkItemPickups(this.world);
  }

  /** 아이템 획득 및 로봇 성능 향상 */
  checkItemPickups(world) {
    if (!world.items || world.items.length === 0) return;
    for (let i = world.items.length - 1; i >= 0; i--) {
      const item = world.items[i];
      const dist = Math.hypot(this.x - item.x, this.y - item.y);
      if (dist < ROBOT_RADIUS + 12) { // 12는 아이템 렌더링용 반경
        if (item.type === 'speed') {
          // ⚡ 배터리: 속도 증가
          this.maxSpeed = Math.min(this.maxSpeed + 0.45, 4.0);
          if (window._ui) {
            window._ui.log('⚡ [아이템 획득] 배터리 충전! 최대 속도가 증가했습니다! (현재 속도: ' + this.maxSpeed.toFixed(1) + ')', 'success');
            // UI 슬라이더 동기화
            const sld = document.getElementById('ctrl-speed');
            const dsp = document.getElementById('disp-speed');
            if (sld) sld.value = this.maxSpeed;
            if (dsp) dsp.textContent = this.maxSpeed.toFixed(1);
          }
        } else if (item.type === 'range') {
          // 🔍 렌즈: 라이다 센서 범위 증가
          if (window.lidar) {
            window.lidar.range = Math.min(window.lidar.range + 30, 240);
            if (window._ui) {
              window._ui.log('🔍 [아이템 획득] 볼록 렌즈 장착! 라이다 범위가 증가했습니다! (현재 범위: ' + window.lidar.range + 'px)', 'success');
              // UI 슬라이더 동기화
              const sld = document.getElementById('ctrl-lidar-range');
              const dsp = document.getElementById('disp-lidar-range');
              if (sld) sld.value = window.lidar.range;
              if (dsp) dsp.textContent = window.lidar.range + 'px';
            }
          }
        }
        world.items.splice(i, 1);
      }
    }

    // 아이템이 3개 미만이면 일정 확률로 랜덤 리젠
    if (world.items.length < 3 && Math.random() < 0.003) {
      world.spawnRandomItem();
    }
  }

  setAutoMode(on) {
    this.autoMode    = on;
    this.tourMode    = false;
    this.autoState   = 'explore';
    this.autoTimer   = 0;
    this._stuckTimer = 0;
    this._stuckX     = this.x;
    this._stuckY     = this.y;
    this._lastTurnDir = 1;
    if (on) this.speed = this.maxSpeed;
    else    this.speed = 0;
  }

  setSpeed(v)    { this.maxSpeed = v; }
  setTurnRate(v) { this.turnRate = v; }

  takeDamage(amount) {
    if (this.invulnerableTimer > 0) return;
    this.hp = Math.max(0, this.hp - amount);
    this.damageTimer = 0.5;       // 0.5초 동안 피격 빨간색 시각 효과
    this.invulnerableTimer = 1.2; // 1.2초 동안 피격 후 무적 시간 적용
    
    if (window._ui) {
      window._ui.log(`💥 학생과 충돌! 체력 -${amount} (남은 체력: ${this.hp}/${this.maxHp})`, 'danger');
    }
    
    if (this.hp <= 0) {
      if (window._ui) {
        window._ui.log(`💀 체력이 모두 소진되어 시뮬레이션이 처음부터 초기화됩니다!`, 'danger');
      }
      setTimeout(() => {
        const resetBtn = document.getElementById('btn-reset');
        if (resetBtn) resetBtn.click();
      }, 1000);
    }
  }
}
