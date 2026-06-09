/**
 * mission.js — 교육용 미션 시스템 v2
 *
 * 미션 1: 라이다 부품 조립 퀴즈 (드래그 앤 드롭, 힌트 없음)
 * 미션 2: 교실 탐색률 60% 달성
 * 미션 2 클리어 후: "센서 오류 시나리오" 팝업 체험
 *
 * 수정:
 * - 오류 시나리오 팝업이 자율주행/라이다에 간섭하지 않음
 * - "센서 끄기" 데모는 5초 후 자동 복원
 * - onSimReset() 으로 미션 상태 정리
 */

const MISSIONS = [
  { id: 1, title: '미션 1 — 라이다 로봇 조립하기', type: 'assembly' },
  { id: 2, title: '미션 2 — 교실의 60%를 탐색하라!', type: 'explore', goal: 60 },
];

const PARTS = [
  { id: 'part-body',   label: '로봇 몸통 (섀시)', emoji: '🚗', correctSlot: 'slot-body'   },
  { id: 'part-motor',  label: '바퀴 모터 ×4',     emoji: '⚙️', correctSlot: 'slot-motor'  },
  { id: 'part-sensor', label: '라이다 센서',       emoji: '📡', correctSlot: 'slot-sensor' },
  { id: 'part-cpu',    label: '제어 컴퓨터',       emoji: '💻', correctSlot: 'slot-cpu'    },
];

const SLOTS = [
  { id: 'slot-body',   label: '?', top: '10%', left: '40%' },
  { id: 'slot-motor',  label: '?', top: '55%', left: '15%' },
  { id: 'slot-sensor', label: '?', top: '55%', left: '65%' },
  { id: 'slot-cpu',    label: '?', top: '32%', left: '40%' },
];

class MissionSystem {
  constructor() {
    this.currentMission = 0;
    this.completed      = [];
    this.overlay        = null;
    this._slotFilled    = {};
    this._dragPart      = null;
    this._errorShown    = false;
  }

  init() {
    this._buildOverlayDOM();
    this._attachOpenButton();
  }

  onSimReset() {
    // 시뮬레이션 리셋 시 미션2 진행 상태만 초기화 (완료 기록은 유지)
    if (this.currentMission === 2) {
      this.currentMission = 0;
    }
    this._errorShown = false;
    // 미션2 배지 제거
    const badge = document.getElementById('mission2-badge');
    if (badge) badge.remove();
  }

  startMission1() {
    this.currentMission = 1;
    this._showMission1UI();
  }

  startMission2() {
    this.currentMission = 2;
    this._errorShown = false;
    this._showMission2UI();
  }

  checkMission2Progress(exploreRate) {
    if (this.currentMission !== 2) return;
    if (this.completed.includes(2)) return;
    if (exploreRate >= 60) {
      this._completeMission2();
    }
  }

  // ─────────────────────────────────────────
  //  DOM 구성
  // ─────────────────────────────────────────
  _buildOverlayDOM() {
    if (document.getElementById('mission-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'mission-overlay';
    overlay.className = 'mission-overlay hidden';
    overlay.innerHTML = `
      <div class="mission-modal" id="mission-modal">
        <button class="mission-close" id="mission-close">✕</button>
        <div id="mission-content"></div>
      </div>
    `;
    document.body.appendChild(overlay);
    this.overlay = overlay;

    document.getElementById('mission-close').addEventListener('click', () => this._hideOverlay());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) this._hideOverlay(); });

    this._injectStyles();
  }

  _attachOpenButton() {
    const headerControls = document.querySelector('.header-controls');
    if (!headerControls) return;

    const btn = document.createElement('button');
    btn.id = 'btn-mission';
    btn.className = 'btn btn-mission-open';
    btn.innerHTML = '🎯 미션';
    btn.title = '학습 미션 열기';
    btn.addEventListener('click', () => this._showMissionSelect());
    headerControls.insertBefore(btn, headerControls.firstChild);
  }

  _showOverlay(html) {
    document.getElementById('mission-content').innerHTML = html;
    this.overlay.classList.remove('hidden');
  }

  _hideOverlay() {
    this.overlay.classList.add('hidden');
  }

  // ─────────────────────────────────────────
  //  미션 선택 화면
  // ─────────────────────────────────────────
  _showMissionSelect() {
    const m1done = this.completed.includes(1);
    const m2done = this.completed.includes(2);

    this._showOverlay(`
      <div class="ms-header">
        <div class="ms-icon">🎯</div>
        <h2>학습 미션</h2>
        <p>미션을 완료하며 라이다 SLAM의 원리를 익혀봐요!</p>
      </div>
      <div class="ms-list">
        <div class="ms-card ${m1done ? 'done' : ''}" id="ms-card-1">
          <div class="ms-num">1</div>
          <div class="ms-info">
            <div class="ms-title">라이다 로봇 조립하기</div>
            <div class="ms-sub">부품을 올바른 자리에 맞춰 로봇을 완성하세요</div>
          </div>
          <div class="ms-status">${m1done ? '✅ 완료' : '▶ 시작'}</div>
        </div>
        <div class="ms-card ${m2done ? 'done' : (!m1done ? 'locked' : '')}" id="ms-card-2">
          <div class="ms-num">2</div>
          <div class="ms-info">
            <div class="ms-title">교실 탐색 60% 달성</div>
            <div class="ms-sub">자율주행으로 교실 지도를 완성하세요</div>
          </div>
          <div class="ms-status">${m2done ? '✅ 완료' : (!m1done ? '🔒' : '▶ 시작')}</div>
        </div>
      </div>
    `);

    document.getElementById('ms-card-1').addEventListener('click', () => this.startMission1());
    const card2 = document.getElementById('ms-card-2');
    if (!card2.classList.contains('locked')) {
      card2.addEventListener('click', () => {
        this._hideOverlay();
        this.startMission2();
      });
    }
  }

  // ─────────────────────────────────────────
  //  미션 1: 조립 퀴즈 (힌트 없음)
  // ─────────────────────────────────────────
  _showMission1UI() {
    this._slotFilled = {};

    const slotsHtml = SLOTS.map(s => `
      <div class="asm-slot" id="${s.id}" data-slot="${s.id}"
           style="top:${s.top};left:${s.left}">
        <div class="slot-label">${s.label}</div>
      </div>
    `).join('');

    const shuffled = [...PARTS].sort(() => Math.random() - 0.5);
    const partsHtml = shuffled.map(p => `
      <div class="asm-part" id="${p.id}" draggable="true" data-part="${p.id}">
        <div class="part-emoji">${p.emoji}</div>
        <div class="part-label">${p.label}</div>
      </div>
    `).join('');

    this._showOverlay(`
      <div class="ms-header">
        <div class="ms-icon">🔧</div>
        <h2>미션 1 — 라이다 로봇 조립하기</h2>
        <p>부품을 로봇 다이어그램의 <strong>빈 칸(?)에 드래그</strong>해서 올바른 위치에 맞추세요!</p>
      </div>
      <div class="asm-arena">
        <div class="asm-robot-diagram" id="asm-diagram">
          <div class="robot-silhouette">🤖</div>
          ${slotsHtml}
        </div>
      </div>
      <div class="asm-parts-tray" id="asm-tray">
        <div class="tray-label">📦 부품 보관함 — 드래그하세요!</div>
        <div class="tray-items" id="tray-items">${partsHtml}</div>
      </div>
      <div class="asm-result hidden" id="asm-result"></div>
      <button class="btn btn-primary ms-check-btn hidden" id="asm-check-btn">✅ 조립 확인하기</button>
    `);

    this._initAssemblyDragDrop();
  }

  _initAssemblyDragDrop() {
    const parts = document.querySelectorAll('.asm-part');
    const slots = document.querySelectorAll('.asm-slot');

    parts.forEach(part => {
      part.addEventListener('dragstart', (e) => {
        this._dragPart = part.getAttribute('data-part');
        part.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      part.addEventListener('dragend', () => {
        part.classList.remove('dragging');
        this._dragPart = null;
      });
    });

    slots.forEach(slot => {
      slot.addEventListener('dragover', (e) => { e.preventDefault(); slot.classList.add('drag-over'); });
      slot.addEventListener('dragleave', () => slot.classList.remove('drag-over'));
      slot.addEventListener('drop', (e) => {
        e.preventDefault();
        slot.classList.remove('drag-over');
        if (!this._dragPart) return;
        this._dropPartOnSlot(this._dragPart, slot.getAttribute('data-slot'));
      });
    });
  }

  _dropPartOnSlot(partId, slotId) {
    const existing = Object.keys(this._slotFilled).find(k => this._slotFilled[k] === partId);
    if (existing) {
      delete this._slotFilled[existing];
      const oldSlotEl = document.getElementById(existing);
      if (oldSlotEl) { oldSlotEl.innerHTML = `<div class="slot-label">?</div>`; oldSlotEl.classList.remove('filled'); }
    }

    if (this._slotFilled[slotId]) {
      const prevPartId = this._slotFilled[slotId];
      const prevPart = PARTS.find(p => p.id === prevPartId);
      if (prevPart) {
        const trayItems = document.getElementById('tray-items');
        const el = document.createElement('div');
        el.className = 'asm-part'; el.id = prevPartId; el.draggable = true;
        el.setAttribute('data-part', prevPartId);
        el.innerHTML = `<div class="part-emoji">${prevPart.emoji}</div><div class="part-label">${prevPart.label}</div>`;
        trayItems.appendChild(el);
        this._reBindPart(el);
      }
    }

    this._slotFilled[slotId] = partId;
    const partDef = PARTS.find(p => p.id === partId);
    const slotEl  = document.getElementById(slotId);
    if (slotEl && partDef) {
      slotEl.innerHTML = `<div class="slot-part-placed"><div class="part-emoji">${partDef.emoji}</div><div class="part-label-sm">${partDef.label}</div></div>`;
      slotEl.classList.add('filled');
    }

    const partEl = document.getElementById(partId);
    if (partEl) partEl.remove();

    if (Object.keys(this._slotFilled).length === SLOTS.length) {
      document.getElementById('asm-check-btn').classList.remove('hidden');
      document.getElementById('asm-check-btn').onclick = () => this._checkAssembly();
    }
  }

  _reBindPart(el) {
    el.addEventListener('dragstart', (e) => {
      this._dragPart = el.getAttribute('data-part');
      el.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    el.addEventListener('dragend', () => { el.classList.remove('dragging'); this._dragPart = null; });
  }

  _checkAssembly() {
    let correct = 0;
    const feedback = [];
    PARTS.forEach(p => {
      const assignedSlot = Object.keys(this._slotFilled).find(k => this._slotFilled[k] === p.id);
      if (assignedSlot === p.correctSlot) {
        correct++;
        document.getElementById(assignedSlot)?.classList.add('correct');
        feedback.push(`✅ ${p.label} — 정답!`);
      } else {
        document.getElementById(assignedSlot)?.classList.add('wrong');
        feedback.push(`❌ ${p.label} — 다시 생각해봐요`);
      }
    });

    const resultEl = document.getElementById('asm-result');
    resultEl.classList.remove('hidden');

    if (correct === PARTS.length) {
      this.completed.push(1);
      resultEl.innerHTML = `
        <div class="result-success">
          <div style="font-size:3rem">🎉</div>
          <h3>완벽한 조립!</h3>
          <p>모든 부품을 올바른 위치에 맞췄어요!<br>이제 미션 2에 도전해 보세요!</p>
          <button class="btn btn-primary" id="asm-next-btn">미션 2 도전하기 →</button>
        </div>
      `;
      document.getElementById('asm-next-btn').onclick = () => {
        this._hideOverlay();
        this.startMission2();
      };
    } else {
      resultEl.innerHTML = `
        <div class="result-partial">
          <p>${correct}/${PARTS.length}개 맞췄어요! 틀린 부품을 다시 배치해 보세요.</p>
          <div class="feedback-list">${feedback.map(f => `<div>${f}</div>`).join('')}</div>
          <button class="btn btn-secondary" id="asm-retry-btn">다시 시도</button>
        </div>
      `;
      document.getElementById('asm-retry-btn').onclick = () => this._showMission1UI();
    }
  }

  // ─────────────────────────────────────────
  //  미션 2: 탐색률 목표
  // ─────────────────────────────────────────
  _showMission2UI() {
    const statusBar = document.querySelector('.status-bar');
    if (statusBar && !document.getElementById('mission2-badge')) {
      const badge = document.createElement('div');
      badge.id = 'mission2-badge';
      badge.className = 'mission2-badge';
      badge.innerHTML = '🎯 <strong>미션 2:</strong> 탐색률 60% 달성!';
      statusBar.prepend(badge);
    }
    if (window._ui) window._ui.log('🎯 미션 2 시작! 탐색률 60%를 달성하세요', 'success');
  }

  _completeMission2() {
    if (this.completed.includes(2)) return;
    this.completed.push(2);
    this.currentMission = 0;

    const badge = document.getElementById('mission2-badge');
    if (badge) badge.remove();

    if (window._ui) window._ui.log('🏆 클래스 완료! 탐색률 60% 달성!', 'success');

    if (!this._errorShown) {
      this._errorShown = true;
      setTimeout(() => this.startVictoryTour(), 800);
    }
  }

  // ──────────────────────────────────────────
  //  Victory Tour — 전 맵 활보 연출
  // ──────────────────────────────────────────
  startVictoryTour() {
    // 1. 시뮬레이션 시작 (멈춰있으면)
    const startBtn = document.getElementById('btn-start');
    if (startBtn && !startBtn.disabled) startBtn.click();

    // 2. 로봇을 교실 중앙으로 순간 이동 + 속도 리셋
    const robot = window._robot;
    if (robot) {
      robot.x     = 300;
      robot.y     = 250;
      robot.angle = -Math.PI / 2; // 위쪽 방향
      robot.speed = 0;
      robot.trail = []; // 궤적 초기화 (새 tour 경로로 그리기)
    }

    // 3. 속도 부스트
    const speedSlider = document.getElementById('ctrl-speed');
    this._prevSpeed = speedSlider ? speedSlider.value : '2';
    if (speedSlider) { speedSlider.value = '6'; speedSlider.dispatchEvent(new Event('input')); }

    const simSlider = document.getElementById('ctrl-sim-speed');
    this._prevSim = simSlider ? simSlider.value : '1';
    if (simSlider) { simSlider.value = '2'; simSlider.dispatchEvent(new Event('input')); }

    // 4. 웨이포인트 투어 모드 시작 (setAutoMode 대신)
    if (robot) robot.startTourMode(null); // null = TOUR_WAYPOINTS 기본 경로 사용

    // UI 버튼 상태 동기화 (자율주행 버튼 active 표시)
    document.getElementById('btn-mode-manual')?.classList.remove('active');
    document.getElementById('btn-mode-auto')?.classList.add('active');

    // 5. Victory UI
    this._showVictoryBanner();
    this._launchConfetti();

    if (window._ui) window._ui.log('🏆 Victory Tour! 로봇이 전 교실을 활보합니다!', 'success');

    // 6. 40초 후 정상화
    this._victoryTourTimeout = setTimeout(() => {
      if (robot) robot.stopTourMode();
      const ss = document.getElementById('ctrl-speed');
      const si = document.getElementById('ctrl-sim-speed');
      if (ss) { ss.value = this._prevSpeed; ss.dispatchEvent(new Event('input')); }
      if (si) { si.value = this._prevSim;   si.dispatchEvent(new Event('input')); }
      this._hideVictoryBanner();
      document.getElementById('btn-mode-manual')?.classList.add('active');
      document.getElementById('btn-mode-auto')?.classList.remove('active');
      if (window._ui) window._ui.log('✅ Tour 완료! 수동 모드로 전환됩니다.', 'info');
    }, 40000);
  }

  _showVictoryBanner() {
    if (document.getElementById('victory-banner')) return;
    const banner = document.createElement('div');
    banner.id = 'victory-banner';
    banner.innerHTML = `
      <div class="vb-content">
        <div class="vb-trophy">🏆</div>
        <div class="vb-text">
          <div class="vb-title">전체 마스터클래스 완료! 자율주행 마스터!</div>
          <div class="vb-sub">로봇이 학습한 지도로 전 교실을 활보중 🚗💨</div>
        </div>
        <div class="vb-timer" id="vb-timer">⏱40s</div>
      </div>
    `;
    document.body.appendChild(banner);

    let t = 40;
    this._victoryTimerInterval = setInterval(() => {
      t--;
      const el = document.getElementById('vb-timer');
      if (el) el.textContent = `⏱${t}s`;
      if (t <= 0) clearInterval(this._victoryTimerInterval);
    }, 1000);
  }

  _hideVictoryBanner() {
    const banner = document.getElementById('victory-banner');
    if (banner) {
      banner.style.animation = 'vbOut 0.5s ease forwards';
      setTimeout(() => banner.remove(), 500);
    }
    if (this._victoryTimerInterval) clearInterval(this._victoryTimerInterval);
    const cc = document.getElementById('confetti-container');
    if (cc) cc.remove();
  }

  _launchConfetti() {
    if (document.getElementById('confetti-container')) return;
    const container = document.createElement('div');
    container.id = 'confetti-container';
    container.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:500;overflow:hidden;';
    document.body.appendChild(container);

    const colors = ['#00e5ff','#69f0ae','#ffeb3b','#ff7b00','#e040fb','#ef5350','#ffffff'];
    const shapes = ['■','▲','●','★','◆'];

    for (let i = 0; i < 120; i++) {
      const el = document.createElement('div');
      const color = colors[Math.floor(Math.random() * colors.length)];
      const shape = shapes[Math.floor(Math.random() * shapes.length)];
      el.style.cssText = `
        position:absolute; top:-30px;
        left:${Math.random() * 100}%;
        font-size:${8 + Math.random() * 14}px;
        color:${color};
        animation: confettiFall ${2.5 + Math.random() * 3}s ${Math.random() * 3}s ease-in forwards;
        transform: rotate(${Math.random() * 360}deg);
      `;
      el.textContent = shape;
      container.appendChild(el);
    }
    setTimeout(() => { if (container.parentNode) container.remove(); }, 20000);
  }

  // ──────────────────────────────────────────
  //  미션 2 클리어 후: 센서 오류 시나리오 (선택적)
  //  ※ 자율주행·라이다 상태에 간섭 없음
  // ──────────────────────────────────────────

  _showErrorScenario() {
    this._showOverlay(`
      <div class="ms-header error-header">
        <div class="ms-icon">⚠️</div>
        <h2>미션 2 클리어!</h2>
        <p style="color:#69f0ae">탐색률 60% 달성 — 축하해요!</p>
      </div>

      <div class="scenario-box">
        <h3>🔴 잠깐, 이런 일이 생기면 어떨까요?</h3>
        <div class="scenario-screens">
          <div class="sc-card">
            <div class="sc-label">정상 상황</div>
            <div class="sc-visual normal-vis">
              <div class="sc-robot">🚗</div>
              <div class="sc-rays">
                <div class="sc-ray" style="transform:rotate(-60deg)"></div>
                <div class="sc-ray" style="transform:rotate(-30deg)"></div>
                <div class="sc-ray" style="transform:rotate(0deg)"></div>
                <div class="sc-ray" style="transform:rotate(30deg)"></div>
                <div class="sc-ray" style="transform:rotate(60deg)"></div>
              </div>
              <div class="sc-wall wall-top"></div>
              <div class="sc-desc">라이다가 정상 작동 →<br>벽을 감지하고 회피</div>
            </div>
          </div>
          <div class="sc-card sc-card-error">
            <div class="sc-label error-label">⚠️ 센서 오류!</div>
            <div class="sc-visual error-vis">
              <div class="sc-robot wobble">🚗</div>
              <div class="sc-rays dim-rays">
                <div class="sc-ray broken" style="transform:rotate(-60deg)"></div>
                <div class="sc-ray broken" style="transform:rotate(0deg)"></div>
              </div>
              <div class="sc-wall wall-top"></div>
              <div class="sc-desc error-desc">라이다 일부 고장 →<br>벽 인식 실패 → 충돌!</div>
            </div>
          </div>
        </div>

        <div class="scenario-explain">
          <h4>🤔 왜 이런 일이 일어날까요?</h4>
          <ul>
            <li>라이다 센서에 먼지/물기가 끼면 레이저가 제대로 반사되지 않아요</li>
            <li>센서 데이터가 일부 빠지면 로봇은 그 방향에 <strong>아무것도 없다</strong>고 잘못 판단해요</li>
            <li>결과적으로 SLAM 맵에 <span style="color:#ef5350">장애물이 표시되지 않아</span> 충돌이 발생해요</li>
          </ul>
          <div class="scenario-key">
            💡 실제 자율주행차는 이런 오류를 막기 위해
            <strong>카메라·레이더·라이다</strong>를 동시에 사용해요!
          </div>
        </div>
      </div>

      <div style="text-align:center;margin-top:16px;display:flex;gap:8px;justify-content:center">
        <button class="btn btn-primary" id="scenario-demo-btn">🔌 5초 라이다 꺼보기 체험</button>
        <button class="btn btn-secondary" id="scenario-close-btn">탐색 계속하기</button>
      </div>
    `);

    document.getElementById('scenario-close-btn').onclick = () => {
      this._hideOverlay();
      // ※ 자율주행 상태 유지 — 간섭 없음
    };

    document.getElementById('scenario-demo-btn').onclick = () => {
      this._hideOverlay();
      this._runLidarErrorDemo();
    };
  }

  /**
   * 라이다를 5초간 꺼서 오류 체험 후 자동 복원
   * 자율주행 상태는 건드리지 않음
   */
  _runLidarErrorDemo() {
    const lidarToggle = document.getElementById('ctrl-show-lidar');
    if (!lidarToggle) return;

    // 꺼기
    lidarToggle.checked = false;
    lidarToggle.dispatchEvent(new Event('change'));
    if (window._ui) window._ui.log('🔌 [데모] 라이다 꺼짐! 5초 후 자동 복원...', 'danger');

    // 화면에 카운트다운 표시
    let count = 5;
    const countEl = document.createElement('div');
    countEl.id = 'lidar-demo-countdown';
    countEl.style.cssText = `
      position:fixed; top:60px; left:50%; transform:translateX(-50%);
      background:rgba(239,83,80,0.9); color:white; padding:8px 20px;
      border-radius:20px; font-size:13px; font-weight:700; z-index:400;
      font-family:'Noto Sans KR',sans-serif;
    `;
    countEl.textContent = `⚠️ 라이다 오류 시뮬레이션 중... ${count}초 후 복원`;
    document.body.appendChild(countEl);

    const timer = setInterval(() => {
      count--;
      if (count > 0) {
        countEl.textContent = `⚠️ 라이다 오류 시뮬레이션 중... ${count}초 후 복원`;
      } else {
        clearInterval(timer);
        // 복원
        lidarToggle.checked = true;
        lidarToggle.dispatchEvent(new Event('change'));
        countEl.style.background = 'rgba(105,240,174,0.9)';
        countEl.style.color = '#0d2618';
        countEl.textContent = '✅ 라이다 복원 완료!';
        if (window._ui) window._ui.log('✅ [데모] 라이다 복원! 자율주행을 계속합니다.', 'success');
        setTimeout(() => countEl.remove(), 2000);
      }
    }, 1000);
  }

  // ─────────────────────────────────────────
  //  스타일 주입
  // ─────────────────────────────────────────
  _injectStyles() {
    if (document.getElementById('mission-styles')) return;
    const style = document.createElement('style');
    style.id = 'mission-styles';
    style.textContent = `
      .mission-overlay {
        position: fixed; inset: 0;
        background: rgba(0,0,0,0.75);
        backdrop-filter: blur(6px);
        z-index: 300;
        display: flex; align-items: center; justify-content: center;
      }
      .mission-overlay.hidden { display: none !important; }

      .mission-modal {
        background: #161b22; border: 1px solid #30363d; border-radius: 16px;
        padding: 28px 32px; max-width: 680px; width: 95%;
        max-height: 90vh; overflow-y: auto; position: relative;
        box-shadow: 0 20px 60px rgba(0,0,0,0.6);
        animation: missionPop 0.3s cubic-bezier(0.34,1.56,0.64,1);
      }
      @keyframes missionPop {
        from { opacity:0; transform:scale(0.85); }
        to   { opacity:1; transform:scale(1); }
      }
      .mission-close {
        position:absolute; top:12px; right:14px;
        background:none; border:none; color:#8b949e; cursor:pointer; font-size:18px;
      }

      .ms-header { text-align:center; margin-bottom:20px; }
      .ms-icon { font-size:3rem; margin-bottom:8px; }
      .ms-header h2 { font-size:22px; font-weight:700; color:#00e5ff; margin-bottom:6px; }
      .ms-header p  { color:#8b949e; font-size:13px; line-height:1.6; }
      .error-header h2 { color:#ffeb3b; }

      .ms-list { display:flex; flex-direction:column; gap:10px; }
      .ms-card {
        display:flex; align-items:center; gap:14px;
        background:#1c2128; border:1px solid #30363d; border-radius:10px;
        padding:14px 16px; cursor:pointer; transition:all 0.2s;
      }
      .ms-card:hover:not(.locked)  { border-color:#00e5ff; background:#0d1b2a; }
      .ms-card.done  { border-color:#69f0ae; opacity:0.8; }
      .ms-card.locked { opacity:0.4; cursor:not-allowed; }
      .ms-num { font-size:22px; font-weight:700; color:#00e5ff; min-width:28px; }
      .ms-title { font-size:14px; font-weight:600; color:#e8eaf6; }
      .ms-sub   { font-size:11px; color:#8b949e; margin-top:2px; }
      .ms-status { margin-left:auto; font-size:12px; color:#69f0ae; }

      .btn-mission-open {
        background:rgba(255,235,59,0.15); border:1px solid #ffeb3b;
        color:#ffeb3b; padding:6px 14px; border-radius:6px;
        cursor:pointer; font-size:12px; font-weight:600;
        font-family:'Noto Sans KR',sans-serif; transition:all 0.18s;
      }
      .btn-mission-open:hover { background:rgba(255,235,59,0.3); }

      .asm-arena { display:flex; justify-content:center; margin:10px 0; }
      .asm-robot-diagram {
        position:relative; width:320px; height:220px;
        background:linear-gradient(135deg,#0d1b2a,#1a2633);
        border:2px dashed #30363d; border-radius:12px;
        display:flex; align-items:center; justify-content:center;
      }
      .robot-silhouette { font-size:80px; opacity:0.12; user-select:none; }
      .asm-slot {
        position:absolute; width:72px; height:64px;
        background:#1c2128; border:2px dashed #42a5f5; border-radius:8px;
        display:flex; align-items:center; justify-content:center; flex-direction:column;
        cursor:default; transition:all 0.18s; transform:translate(-50%,-50%);
      }
      .asm-slot.drag-over { border-color:#00e5ff; background:#0d1b2a; box-shadow:0 0 12px rgba(0,229,255,0.4); }
      .asm-slot.filled    { border-style:solid; border-color:#69f0ae; }
      .asm-slot.correct   { border-color:#69f0ae; background:rgba(105,240,174,0.1); }
      .asm-slot.wrong     { border-color:#ef5350; background:rgba(239,83,80,0.1); animation:shake 0.4s; }
      @keyframes shake { 0%,100%{transform:translate(-50%,-50%)} 20%,60%{transform:translate(calc(-50% - 4px),-50%)} 40%,80%{transform:translate(calc(-50% + 4px),-50%)} }
      .slot-label { font-size:20px; color:#42a5f5; font-weight:700; }
      .slot-part-placed { text-align:center; }
      .slot-part-placed .part-emoji { font-size:22px; }
      .slot-part-placed .part-label-sm { font-size:9px; color:#e8eaf6; line-height:1.2; }

      .asm-parts-tray { background:#1c2128; border:1px solid #30363d; border-radius:10px; padding:12px 14px; margin-top:8px; }
      .tray-label { font-size:11px; color:#8b949e; margin-bottom:8px; }
      .tray-items { display:flex; flex-wrap:wrap; gap:8px; }

      .asm-part {
        background:#0d1b2a; border:1px solid #42a5f5; border-radius:8px;
        padding:8px 12px; cursor:grab; display:flex; flex-direction:column;
        align-items:center; gap:4px; min-width:80px; transition:all 0.18s; user-select:none;
      }
      .asm-part:hover  { border-color:#00e5ff; box-shadow:0 0 8px rgba(0,229,255,0.3); }
      .asm-part.dragging { opacity:0.4; }
      .part-emoji { font-size:22px; }
      .part-label { font-size:10px; color:#e8eaf6; text-align:center; line-height:1.3; }

      .ms-check-btn { width:100%; margin-top:12px; padding:10px; }
      .asm-result { margin-top:12px; padding:14px; border-radius:8px; }
      .result-success { text-align:center; }
      .result-success h3 { font-size:18px; color:#69f0ae; margin:8px 0; }
      .result-success p  { color:#8b949e; margin-bottom:12px; }
      .result-partial p { color:#ffeb3b; margin-bottom:8px; }
      .feedback-list { font-size:12px; line-height:2; color:#8b949e; margin-bottom:10px; }

      .mission2-badge {
        background:rgba(255,235,59,0.15); border:1px solid #ffeb3b;
        color:#ffeb3b; padding:4px 12px; border-radius:20px;
        font-size:11px; animation:pulse-badge 1.5s infinite;
      }
      @keyframes pulse-badge { 0%,100%{box-shadow:0 0 4px rgba(255,235,59,0.2)} 50%{box-shadow:0 0 12px rgba(255,235,59,0.5)} }

      .scenario-box { background:#1c2128; border:1px solid #30363d; border-radius:10px; padding:16px; margin-top:8px; }
      .scenario-box h3 { font-size:14px; color:#ef5350; margin-bottom:12px; }
      .scenario-screens { display:flex; gap:12px; margin-bottom:14px; }
      .sc-card { flex:1; background:#0d1b2a; border:1px solid #30363d; border-radius:8px; padding:10px; text-align:center; }
      .sc-card-error { border-color:#ef5350; }
      .sc-label { font-size:11px; color:#8b949e; margin-bottom:8px; font-weight:600; }
      .error-label { color:#ef5350; }
      .sc-visual { position:relative; height:100px; background:#060d14; border-radius:6px; display:flex; align-items:center; justify-content:center; overflow:hidden; }
      .sc-robot { font-size:24px; z-index:2; }
      .sc-wall { position:absolute; background:#3a4a5a; }
      .wall-top { top:0; left:0; right:0; height:8px; }
      .sc-rays { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); }
      .sc-ray { position:absolute; width:2px; height:40px; bottom:0; left:50%; background:linear-gradient(to top,rgba(0,229,255,0),#00e5ff); transform-origin:bottom center; opacity:0.7; }
      .dim-rays .sc-ray { opacity:0.1; }
      .broken { background:linear-gradient(to top,rgba(239,83,80,0),#ef5350) !important; opacity:0.5 !important; }
      .error-vis { animation:errorFlicker 1.5s infinite; }
      @keyframes errorFlicker { 0%,100%{opacity:1} 50%{opacity:0.7} }
      .wobble { animation:wobble 0.6s infinite; }
      @keyframes wobble { 0%,100%{transform:rotate(-5deg)} 50%{transform:rotate(5deg)} }
      .sc-desc { font-size:10px; color:#8b949e; margin-top:6px; line-height:1.4; }
      .error-desc { color:#ef5350 !important; }

      .scenario-explain h4 { font-size:13px; color:#ffeb3b; margin-bottom:8px; }
      .scenario-explain ul { padding-left:16px; font-size:12px; color:#8b949e; line-height:2; }
      .scenario-explain li strong { color:#e8eaf6; }
      .scenario-key { margin-top:10px; padding:10px 14px; background:rgba(0,229,255,0.08); border-left:3px solid #00e5ff; border-radius:4px; font-size:12px; color:#b0bec5; line-height:1.6; }
      .scenario-key strong { color:#00e5ff; }

      /* ── Victory Banner ── */
      #victory-banner {
        position: fixed; top: 0; left: 0; right: 0;
        background: linear-gradient(135deg, #0d1b2a 0%, #162032 50%, #0d1b2a 100%);
        border-bottom: 2px solid #ffeb3b;
        padding: 10px 24px;
        z-index: 600;
        animation: vbIn 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards;
        box-shadow: 0 4px 30px rgba(255,235,59,0.3);
      }
      @keyframes vbIn  { from{transform:translateY(-100%);opacity:0} to{transform:translateY(0);opacity:1} }
      @keyframes vbOut { from{transform:translateY(0);opacity:1} to{transform:translateY(-100%);opacity:0} }
      .vb-content {
        display: flex; align-items: center; gap: 14px;
        max-width: 900px; margin: 0 auto;
      }
      .vb-trophy { font-size: 2rem; animation: trophySpin 1.5s infinite; }
      @keyframes trophySpin { 0%,100%{transform:rotate(-10deg) scale(1)} 50%{transform:rotate(10deg) scale(1.15)} }
      .vb-title {
        font-size: 15px; font-weight: 700; color: #ffeb3b;
        text-shadow: 0 0 12px rgba(255,235,59,0.6);
      }
      .vb-sub { font-size: 11px; color: #69f0ae; margin-top: 2px; }
      .vb-timer {
        margin-left: auto; font-size: 14px; font-weight: 700;
        color: #00e5ff; background: rgba(0,229,255,0.1);
        border: 1px solid #00e5ff; border-radius: 20px; padding: 4px 12px;
        min-width: 56px; text-align: center;
      }

      /* ── Confetti ── */
      @keyframes confettiFall {
        0%   { transform: translateY(0)   rotate(0deg)   scale(1);   opacity: 1; }
        80%  { opacity: 0.8; }
        100% { transform: translateY(110vh) rotate(720deg) scale(0.5); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }
}

window.MissionSystem = new MissionSystem();
