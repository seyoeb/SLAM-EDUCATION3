/**
 * ui.js — UI 이벤트 핸들러
 * 컨트롤 패널, 장애물 드래그 앤 드롭, 툴팁, 팝업, 로그
 */

class UI {
  constructor(world, robot, lidar, slam, renderer) {
    this.world    = world;
    this.robot    = robot;
    this.lidar    = lidar;
    this.slam     = slam;
    this.renderer = renderer;

    this.editMode      = false;
    this.dragging      = null;   // { obs, offsetX, offsetY }
    this.dragStart     = null;   // 드래그 시작 위치
    this.dragNewObs    = null;   // 새로 생성 중인 장애물 (드래그로 추가)

    this._logEntries   = [];
    this._logMax       = 30;
    this._startTime    = Date.now();

    this._conceptQueue = [];
    this._conceptShown = new Set();

    this._initControls();
    this._initCanvasEvents();
    this._initPopup();
    this._initTooltips();

    // 최초 팝업
    setTimeout(() => this.showConcept('intro'), 600);
  }

  // ─────────────────────────────────────────
  //  컨트롤 패널 초기화
  // ─────────────────────────────────────────
  _initControls() {
    // 속도 슬라이더
    const spdSlider = document.getElementById('ctrl-speed');
    spdSlider.addEventListener('input', () => {
      const v = parseFloat(spdSlider.value);
      this.robot.setSpeed(v);
      document.getElementById('disp-speed').textContent = v;
    });

    // LiDAR 범위
    const rangeSlider = document.getElementById('ctrl-lidar-range');
    rangeSlider.addEventListener('input', () => {
      const v = parseInt(rangeSlider.value);
      this.lidar.setRange(v);
      document.getElementById('disp-lidar-range').textContent = v + 'px';
    });

    // 스캔 각도
    const angleSlider = document.getElementById('ctrl-lidar-angle');
    angleSlider.addEventListener('input', () => {
      const v = parseInt(angleSlider.value);
      this.lidar.setAngleSpan(v);
      document.getElementById('disp-lidar-angle').textContent = v + '°';
    });

    // 시뮬레이션 속도
    const simSlider = document.getElementById('ctrl-sim-speed');
    simSlider.addEventListener('input', () => {
      const v = parseFloat(simSlider.value);
      window.SIM_SPEED = v;
      document.getElementById('disp-sim-speed').textContent = v + 'x';
    });

    // 라이다 표시 토글
    document.getElementById('ctrl-show-lidar').addEventListener('change', (e) => {
      this.renderer.showLidar = e.target.checked;
      this.log(e.target.checked ? '라이다 표시 켜짐 👁️' : '라이다 표시 꺼짐', 'info');
    });

    // X-Ray 모드
    document.getElementById('ctrl-xray').addEventListener('change', (e) => {
      this.renderer.xrayMode = e.target.checked;
      this.log(e.target.checked ? 'X-Ray 모드 활성화 🔀' : 'X-Ray 모드 해제', 'info');
      if (e.target.checked) this.showConcept('xray');
    });

    // 편집 토글
    document.getElementById('btn-edit-toggle').addEventListener('click', () => {
      this.editMode = !this.editMode;
      const btn = document.getElementById('btn-edit-toggle');
      btn.classList.toggle('active', this.editMode);
      const overlay = document.getElementById('edit-overlay');
      overlay.classList.toggle('hidden', !this.editMode);
      const canvas = document.getElementById('canvas-real');
      canvas.classList.toggle('edit-mode', this.editMode);
      this.log(this.editMode ? '✏️ 편집 모드 ON — 드래그로 장애물 추가' : '✏️ 편집 모드 OFF', 'info');
    });

    // 모드 버튼
    document.getElementById('btn-mode-manual').addEventListener('click', () => {
      this._setMode('manual');
    });
    document.getElementById('btn-mode-auto').addEventListener('click', () => {
      this._setMode('auto');
    });
  }

  _setMode(mode) {
    const isAuto = (mode === 'auto');
    this.robot.setAutoMode(isAuto);
    document.getElementById('btn-mode-manual').classList.toggle('active', !isAuto);
    document.getElementById('btn-mode-auto').classList.toggle('active',  isAuto);
    const guide = document.getElementById('key-guide');
    guide.style.display = isAuto ? 'none' : '';
    this.log(isAuto ? '🤖 자율주행 모드 활성화' : '🎮 수동 조작 모드 활성화', 'success');
    if (isAuto) this.showConcept('auto');
  }

  // ─────────────────────────────────────────
  //  캔버스 이벤트 (드래그 앤 드롭)
  // ─────────────────────────────────────────
  _initCanvasEvents() {
    const canvas = document.getElementById('canvas-real');

    canvas.addEventListener('mousedown', (e) => this._onMouseDown(e, canvas));
    canvas.addEventListener('mousemove', (e) => this._onMouseMove(e, canvas));
    canvas.addEventListener('mouseup',   (e) => this._onMouseUp(e));
    this._realCanvas = canvas;
    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (!this.editMode) return;
      const { x, y } = this._canvasPos(e, canvas);
      const obs = this.world.getObstacleAt(x, y);
      if (obs && !obs.fixed) {
        // 제거 전 SLAM 맵 무효화
        this.slam.invalidateRegion(obs.x, obs.y, obs.w, obs.h);
        this.world.removeObstacle(obs.id);
        this.log(`🗑️ 장애물 제거됨 (${OBSTACLE_TYPES[obs.type]?.label || obs.type})`, 'warning');
      }
    });

    // 터치 이벤트 (태블릿 대응)
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const me = { clientX: touch.clientX, clientY: touch.clientY, button: 0 };
      this._onMouseDown(me, canvas);
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const me = { clientX: touch.clientX, clientY: touch.clientY };
      this._onMouseMove(me, canvas);
    }, { passive: false });
    canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      this._onMouseUp({});
    }, { passive: false });
  }

  _canvasPos(e, canvas) {
    const rect  = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top)  * scaleY,
    };
  }

  _onMouseDown(e, canvas) {
    if (!this.editMode) return;
    const { x, y } = this._canvasPos(e, canvas);
    const obs = this.world.getObstacleAt(x, y);

    if (obs && !obs.fixed) {
      // 기존 장애물 드래그
      this.dragging = { obs, offsetX: x - obs.x - obs.w / 2, offsetY: y - obs.y - obs.h / 2 };
      // 이동 전 맵 무효화
      this.slam.invalidateRegion(obs.x, obs.y, obs.w, obs.h);
    } else if (!obs) {
      // 빈 공간 → 새 장애물 추가 시작 기록
      this.dragStart = { x, y };
    }
  }

  _onMouseMove(e, canvas) {
    if (!this.editMode) return;
    const { x, y } = this._canvasPos(e, canvas);
    if (this.dragging) {
      const { obs } = this.dragging;
      this.world.moveObstacle(obs.id, x - this.dragging.offsetX, y - this.dragging.offsetY);
    }
  }

  _onMouseUp(e) {
    if (!this.editMode) return;
    const canvas = this._realCanvas;

    if (this.dragging) {
      const { obs } = this.dragging;
      this.slam.invalidateRegion(obs.x, obs.y, obs.w, obs.h);
      this.slam.registerObstacle(obs);
      this.log(`📦 장애물 이동: ${OBSTACLE_TYPES[obs.type]?.label || obs.type}`, 'info');
      this.dragging = null;
    } else if (this.dragStart) {
      const type = document.getElementById('obstacle-type').value;
      const obs = this.world.addObstacle(type, this.dragStart.x, this.dragStart.y);
      if (obs) {
        this.slam.registerObstacle(obs);
        this.log(`➕ 장애물 추가: ${OBSTACLE_TYPES[type]?.label || type}`, 'success');
        if (!this._conceptShown.has('obstacle')) this.showConcept('obstacle');
      }
      this.dragStart = null;
    }
  }

  // ─────────────────────────────────────────
  //  개념 팝업
  // ─────────────────────────────────────────
  _initPopup() {
    document.getElementById('popup-close').addEventListener('click', () => this._closePopup());
    document.getElementById('popup-ok').addEventListener('click',    () => this._closePopup());
    document.getElementById('popup-backdrop').addEventListener('click', () => this._closePopup());
  }

  _closePopup() {
    document.getElementById('concept-popup').classList.add('hidden');
    document.getElementById('popup-backdrop').classList.add('hidden');
  }

  showConcept(key) {
    if (this._conceptShown.has(key)) return;
    this._conceptShown.add(key);

    const concepts = {
      intro: {
        icon: '🚗',
        title: 'LiDAR SLAM 시뮬레이터에 오신 걸 환영해요!',
        body: `이 시뮬레이터에서 자율주행 로봇이 레이저 센서(LiDAR)로 주변을 인식하고\n지도를 스스로 그려나가는 원리를 체험할 수 있어요.\n\n🎮 키보드 WASD 또는 방향키로 로봇을 직접 움직여 보세요!\n오른쪽의 SLAM 맵이 실시간으로 채워지는 걸 관찰하세요.`,
      },
      obstacle: {
        icon: '🧩',
        title: '새 장애물을 추가했어요!',
        body: `로봇이 라이다 센서로 새 장애물을 발견하면\nSLAM 맵의 해당 위치가 빨간색으로 표시돼요.\n\n장애물을 제거하면 로봇이 그 자리를 다시 탐색하면서\n맵이 스스로 업데이트되는 걸 볼 수 있어요!`,
      },
      auto: {
        icon: '🤖',
        title: '자율주행 모드 켜짐!',
        body: `로봇이 스스로 교실을 돌아다니며 탐색을 시작해요.\n\n📡 전방 라이다가 장애물을 감지하면 자동으로 방향을 바꿔요.\n🗺️ 미탐색(어두운) 영역을 향해 우선적으로 이동해요.\n\n이것이 SLAM(동시적 지도 작성 및 위치 추정)의 핵심 원리예요!`,
      },
      xray: {
        icon: '🔀',
        title: 'X-Ray 모드!',
        body: `실제 뷰에 SLAM 맵을 반투명하게 겹쳐서 볼 수 있어요.\n\n로봇이 '실제로 보는 세계'와\n'센서가 인식한 세계'를 비교해 보세요.\n어떤 차이가 있나요? 🤔`,
      },
      explore50: {
        icon: '🎉',
        title: '탐색률 50% 달성!',
        body: `교실 절반의 지도가 완성됐어요!\n\nSLAM(Simultaneous Localization and Mapping)이란\n로봇이 이동하면서 동시에 자신의 위치를 파악하고\n지도를 만드는 기술이에요. 자율주행차의 핵심 기술이죠!`,
      },
      explore100: {
        icon: '🏆',
        title: '교실 탐색 완료!',
        body: `완벽해요! 로봇이 교실 전체의 지도를 완성했어요.\n\n실제 자율주행차(테슬라, 웨이모 등)도\n이와 똑같은 원리로 주변 환경을 인식하고 이동해요.\n여러분이 방금 체험한 기술이 세상을 바꾸고 있답니다! 🚀`,
      },
    };

    const c = concepts[key];
    if (!c) return;

    document.getElementById('popup-icon').textContent  = c.icon;
    document.getElementById('popup-title').textContent = c.title;
    document.getElementById('popup-body').style.whiteSpace = 'pre-line';
    document.getElementById('popup-body').textContent  = c.body;
    document.getElementById('concept-popup').classList.remove('hidden');
    document.getElementById('popup-backdrop').classList.remove('hidden');
  }

  // ─────────────────────────────────────────
  //  툴팁
  // ─────────────────────────────────────────
  _initTooltips() {
    const tips = {
      'ctrl-speed':       '로봇의 최대 이동 속도를 조절해요',
      'ctrl-lidar-range': '라이다 레이저가 닿는 최대 거리예요',
      'ctrl-lidar-angle': '라이다가 스캔하는 좌우 각도 범위예요',
      'ctrl-sim-speed':   '시뮬레이션 전체 진행 속도를 조절해요',
      'ctrl-show-lidar':  '초록/빨간 레이저 빔의 표시를 껐다 켜요',
      'ctrl-xray':        '실제 뷰에 SLAM 맵을 겹쳐서 볼 수 있어요',
      'btn-edit-toggle':  '클릭 후 캔버스에 드래그하여 장애물을 추가하거나\n우클릭으로 제거하세요',
      'btn-mode-manual':  'WASD / 화살표 키로 로봇을 직접 조작해요',
      'btn-mode-auto':    '로봇이 스스로 교실을 탐색해요',
    };
    const tooltip = document.getElementById('tooltip');

    for (const [id, text] of Object.entries(tips)) {
      const el = document.getElementById(id);
      if (!el) continue;
      el.addEventListener('mouseenter', (e) => {
        tooltip.textContent = text;
        tooltip.style.whiteSpace = 'pre-line';
        tooltip.classList.remove('hidden');
        this._moveTooltip(e);
      });
      el.addEventListener('mousemove', (e) => this._moveTooltip(e));
      el.addEventListener('mouseleave', () => tooltip.classList.add('hidden'));
    }
  }

  _moveTooltip(e) {
    const t = document.getElementById('tooltip');
    t.style.left = (e.clientX + 14) + 'px';
    t.style.top  = (e.clientY - 6)  + 'px';
  }

  // ─────────────────────────────────────────
  //  이벤트 로그
  // ─────────────────────────────────────────
  log(msg, type = 'info') {
    const elapsed = ((Date.now() - this._startTime) / 1000).toFixed(1);
    const entry = { msg, type, time: elapsed };
    this._logEntries.unshift(entry);
    if (this._logEntries.length > this._logMax) this._logEntries.pop();
    this._renderLog();
  }

  _renderLog() {
    const container = document.getElementById('log-entries');
    if (!container) return;
    container.innerHTML = '';
    for (const e of this._logEntries) {
      const div = document.createElement('div');
      div.className = `log-entry ${e.type}`;
      div.innerHTML = `<span class="log-time">${e.time}s</span><span class="log-msg">${e.msg}</span>`;
      container.appendChild(div);
    }
  }

  // ─────────────────────────────────────────
  //  상태 패널 업데이트 (매 프레임 호출)
  // ─────────────────────────────────────────
  updateStats(slamMap, robot, rays) {
    const rate = slamMap.exploreRate;
    document.getElementById('progress-explore').style.width = rate + '%';
    document.getElementById('val-explore').textContent = rate + '%';
    document.getElementById('val-obstacles').textContent = slamMap.occupiedCount + '개';
    document.getElementById('val-speed').textContent = Math.abs(robot.speed).toFixed(1) + ' px/s';

    const hitRays = rays.filter(r => r.hit).length;
    document.getElementById('val-hits').textContent = `${hitRays} / ${rays.length}`;

    // 실시간 체력 표시 업데이트 (하트 렌더링)
    const hpVal = document.getElementById('val-hp');
    if (hpVal) {
      const activeHearts = Math.max(0, robot.hp);
      const brokenHearts = Math.max(0, robot.maxHp - activeHearts);
      hpVal.textContent = '❤️'.repeat(activeHearts) + '🖤'.repeat(brokenHearts);
    }

    // 교육 팝업 트리거
    if (rate >= 50  && !this._conceptShown.has('explore50'))  this.showConcept('explore50');
    if (rate >= 100 && !this._conceptShown.has('explore100')) this.showConcept('explore100');

    // 장애물 감지 이벤트 로그 (쓰로틀: 2초)
    if (!this._lastLogTime || Date.now() - this._lastLogTime > 2000) {
      if (hitRays > 0) {
        this._lastLogTime = Date.now();
        this.log(`📡 라이다 히트: ${hitRays}개 감지`, 'danger');
      }
    }
  }
}
