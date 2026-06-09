/**
 * main.js — 게임 루프 진입점
 * 모든 모듈을 초기화하고 requestAnimationFrame으로 루프 실행
 */

// 전역 시뮬레이션 속도
window.SIM_SPEED = 1;

// ──────────────────────────────
//  모듈 인스턴스 변수 선언 (전역)
// ──────────────────────────────
let world;
let robot;
let lidar;
let slam;
let renderer;
let ui;

// ──────────────────────────────
//  시뮬레이션 상태
// ──────────────────────────────
let running    = false;
let lastTime   = null;
let animId     = null;
let lidarRays  = [];

// ──────────────────────────────
//  DOMContentLoaded 이후 초기화 실행
// ──────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  world    = new World();
  robot    = new Robot(world);
  lidar    = new Lidar(world);
  slam     = new SlamMap();
  renderer = new Renderer(
    document.getElementById('canvas-real'),
    document.getElementById('canvas-slam')
  );
  ui = new UI(world, robot, lidar, slam, renderer);

  window._ui    = ui;    // 미션 시스템 참조용
  window._robot = robot; // 투어 모드 직접 제어용
  window._world = world; // 리셋 참조용
  window.lidar  = lidar; // 아이템 획득에 따른 감지 범위 동적 적용용

  // 미션 시스템 초기화
  if (window.MissionSystem) window.MissionSystem.init();

  // ──────────────────────────────
  //  버튼 이벤트
  // ──────────────────────────────
  document.getElementById('btn-start').addEventListener('click', () => {
    if (running) return;
    running  = true;
    lastTime = null;
    animId   = requestAnimationFrame(loop);

    document.getElementById('btn-start').disabled  = true;
    document.getElementById('btn-pause').disabled  = false;
    ui.log('▶ 시뮬레이션 시작!', 'success');
  });

  document.getElementById('btn-pause').addEventListener('click', () => {
    running = !running;
    const btn = document.getElementById('btn-pause');
    if (running) {
      btn.textContent = '⏸ 일시정지';
      lastTime = null;
      animId = requestAnimationFrame(loop);
      ui.log('▶ 재개', 'info');
    } else {
      btn.textContent = '▶ 재개';
      cancelAnimationFrame(animId);
      ui.log('⏸ 일시정지', 'info');
    }
  });

  document.getElementById('btn-reset').addEventListener('click', () => {
    cancelAnimationFrame(animId);
    running = false;
    lastTime = null;
    lidarRays = [];

    world.reset();
    robot.reset();
    slam.reset();
    // ※ 완전 검은색으로 시작 (initWithObstacles 미호출)

    // 초기 화면 한 번 렌더
    renderer.drawReal(world, robot, []);
    renderer.drawSlam(slam, robot);

    document.getElementById('btn-start').disabled  = false;
    document.getElementById('btn-pause').disabled  = true;
    document.getElementById('btn-pause').textContent = '⏸ 일시정지';
    document.getElementById('progress-explore').style.width = '0%';
    document.getElementById('val-explore').textContent = '0%';
    document.getElementById('val-obstacles').textContent = '0개';

    // 라이다 표시 복원 (미션 시나리오로 꺼진 경우 대비)
    const lidarToggle = document.getElementById('ctrl-show-lidar');
    if (lidarToggle && !lidarToggle.checked) {
      lidarToggle.checked = true;
      renderer.showLidar = true;
    }

    // 수동 모드로 복원
    document.getElementById('btn-mode-manual').classList.add('active');
    document.getElementById('btn-mode-auto').classList.remove('active');

    ui._conceptShown.clear();

    // 미션 시스템 리셋
    if (window.MissionSystem) window.MissionSystem.onSimReset();

    ui.log('↺ 초기화 완료', 'warning');
  });

  // 초기 프레임 (정지 상태 렌더)
  renderer.drawReal(world, robot, []);
  renderer.drawSlam(slam, robot);

  window.addEventListener('resize', resizeCanvases);
  resizeCanvases();
});

// ──────────────────────────────
//  메인 루프
// ──────────────────────────────
function loop(timestamp) {
  if (!running) return;

  const dt  = lastTime ? Math.min((timestamp - lastTime) / 1000, 0.05) : 0.016;
  lastTime  = timestamp;
  const ss  = window.SIM_SPEED;

  // 0. 월드 요소 (움직이는 학생 등) 업데이트
  world.update(dt * ss);

  // 1. 로봇 이동
  robot.update(dt, ss, lidarRays);

  // 1.5. 움직이는 학생과의 충돌 검사 (피격 처리)
  for (const student of world.students) {
    const dist = Math.hypot(robot.x - student.x, robot.y - student.y);
    if (dist < ROBOT_RADIUS + student.w / 2) {
      robot.takeDamage(1);
    }
  }

  // 2. LiDAR 스캔 (showLidar 상태와 무관하게 항상 스캔)
  lidarRays = lidar.scan(robot.x, robot.y, robot.angle);

  // 3. SLAM 맵 업데이트
  slam.update(lidarRays, robot.x, robot.y, world);
  slam.tickOpacity(dt * ss);

  // 4. 렌더링
  renderer.drawReal(world, robot, lidarRays);
  renderer.drawSlam(slam, robot);

  // 5. UI 상태 갱신
  ui.updateStats(slam, robot, lidarRays);

  // 6. 미션 2 진행 체크
  if (window.MissionSystem) {
    window.MissionSystem.checkMission2Progress(slam.exploreRate);
  }

  animId = requestAnimationFrame(loop);
}

// ──────────────────────────────
//  Canvas 크기 반응형 대응
// ──────────────────────────────
function resizeCanvases() {
  const realPanel = document.getElementById('real-canvas-wrapper');
  const slamPanel = document.querySelector('#panel-slam .canvas-wrapper');
  if (!realPanel || !slamPanel) return;

  // 비율 유지: 800:600 (4:3 비율)
  const maxW = Math.min(realPanel.clientWidth, realPanel.clientHeight * 1.333);
  const scale = maxW / 800;
  const dispW = Math.floor(800 * scale);
  const dispH = Math.floor(600 * scale);

  const rc = document.getElementById('canvas-real');
  const sc = document.getElementById('canvas-slam');
  rc.style.width  = sc.style.width  = dispW + 'px';
  rc.style.height = sc.style.height = dispH + 'px';
}

