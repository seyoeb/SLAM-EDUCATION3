/* ================================================================
   masterclass.js — 자율주행 마스터클래스 메인 로직
   드래그 & 드롭 조립 + 중학생용 쉬운 설명
   ================================================================ */

'use strict';

/* ── roundRect polyfill ── */
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x,y,w,h,r){
    r=Math.min(r||0,w/2,h/2);
    this.beginPath();
    this.moveTo(x+r,y); this.lineTo(x+w-r,y);
    this.quadraticCurveTo(x+w,y,x+w,y+r);
    this.lineTo(x+w,y+h-r);
    this.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    this.lineTo(x+r,y+h);
    this.quadraticCurveTo(x,y+h,x,y+h-r);
    this.lineTo(x,y+r);
    this.quadraticCurveTo(x,y,x+r,y);
    this.closePath();
  };
}

/* ══════════════════════════════════════════════════════════════
   🎒 드래그&드롭 조립 데이터 (Part 1 전용)
   ══════════════════════════════════════════════════════════════ */
const ASSEMBLY_CONFIGS = {
  'step-1': {
    title: '로봇에 뇌와 심장을 달아줘요!',
    subtitle: '⬇️ 아래 부품을 드래그해서 맞는 자리에 올려놓으세요',
    slots: [
      { id:'cpu',   pos:'top',   icon:'🧠', label:'두뇌 슬롯',  color:'#4fc3f7',
        hint:'메인 컴퓨터\n여기에!' },
      { id:'mcu',   pos:'left',  icon:'⚡', label:'신경 슬롯',  color:'#ce93d8',
        hint:'제어 보드\n여기에!' },
      { id:'power', pos:'right', icon:'❤️', label:'심장 슬롯',  color:'#ff8a80',
        hint:'배터리\n여기에!' },
    ],
    parts: [
      { id:'cpu',   emoji:'🖥️', name:'메인 컴퓨터',    color:'#4fc3f7' },
      { id:'mcu',   emoji:'📟', name:'제어 보드 (MCU)', color:'#ce93d8' },
      { id:'power', emoji:'🔋', name:'배터리 & 전원',   color:'#ff8a80' },
    ],
  },
  'step-2': {
    title: '로봇에 뼈대와 근육을 달아줘요!',
    subtitle: '⬇️ 아래 부품을 드래그해서 맞는 자리에 올려놓으세요',
    slots: [
      { id:'chassis', pos:'top',  icon:'🦴', label:'뼈대 슬롯',  color:'#90a4ae',
        hint:'로봇 몸통\n여기에!' },
      { id:'motor',   pos:'left', icon:'⚙️', label:'근육 슬롯',  color:'#ffcc02',
        hint:'바퀴 모터\n여기에!' },
      { id:'encoder', pos:'right',icon:'🎯', label:'감각 슬롯',  color:'#69f0ae',
        hint:'회전 측정기\n여기에!' },
    ],
    parts: [
      { id:'chassis', emoji:'🚗', name:'로봇 몸통 (섀시)', color:'#90a4ae' },
      { id:'motor',   emoji:'⚙️', name:'바퀴 모터 ×4',    color:'#ffcc02' },
      { id:'encoder', emoji:'🎯', name:'바퀴 회전 측정기', color:'#69f0ae' },
    ],
  },
  'step-3': {
    title: '로봇에 눈과 귀를 달아줘요!',
    subtitle: '⬇️ 아래 부품을 드래그해서 맞는 자리에 올려놓으세요',
    slots: [
      { id:'lidar',  pos:'top',  icon:'👁️', label:'레이저 눈 슬롯', color:'#4fc3f7',
        hint:'라이다 센서\n여기에!' },
      { id:'camera', pos:'left', icon:'📷', label:'카메라 슬롯',    color:'#ff8a80',
        hint:'카메라\n여기에!' },
      { id:'imu',    pos:'right',icon:'🌀', label:'균형 슬롯',      color:'#ce93d8',
        hint:'기울기 센서\n여기에!' },
    ],
    parts: [
      { id:'lidar',  emoji:'📡', name:'라이다 센서',       color:'#4fc3f7' },
      { id:'camera', emoji:'📷', name:'카메라',             color:'#ff8a80' },
      { id:'imu',    emoji:'🌀', name:'기울기 센서 (IMU)', color:'#ce93d8' },
    ],
  },
};

/* ══════════════════════════════════════════════════════════════
   📚 스테이지 데이터 (중학생 수준 설명)
   ══════════════════════════════════════════════════════════════ */
const STAGES = [

  /* ─────────────────── STEP 1 ─────────────────── */
  {
    type:'step', partNum:1, partTitle:'하드웨어 설계 및 제작',
    stepNum:1, id:'step-1', icon:'🧠',
    title:'Step 1. 뇌와 심장 연결하기',
    subtitle:'생각하고, 에너지를 공급하는 부품들',
    narrative:`🚀 자율주행 마스터클래스에 오신 것을 환영해요!

로봇을 만들 때 가장 먼저 필요한 건 "생각하는 두뇌"와 "에너지를 주는 심장"이에요.

아래 3가지 부품이 어떤 역할인지 읽어보고, 오른쪽 조립판에 직접 드래그해서 붙여보세요! 👉`,
    components:[
      { name:'메인 컴퓨터', organ:'🧠 뇌',
        example:'예) NVIDIA Jetson, 라즈베리 파이',
        color:'#4fc3f7',
        desc:'로봇이 "어디로 갈까?" 생각하는 곳이에요. 카메라와 센서에서 오는 정보를 분석해서 결정을 내려요. 우리가 스마트폰으로 게임할 때 CPU가 열심히 계산하는 것처럼요!',
        detail:'📱 스마트폰 CPU의 10~100배 빠른 속도로 계산해요' },
      { name:'제어 보드 (MCU)', organ:'⚡ 신경계',
        example:'예) Arduino, STM32',
        color:'#ce93d8',
        desc:'메인 컴퓨터(뇌)의 명령을 받아서 바퀴와 모터에 직접 전달해요. 뇌에서 "손을 움직여!"라고 하면 척수를 통해 신호가 전달되는 것과 똑같아요!',
        detail:'⚡ 1초에 1000번씩 바퀴 속도를 체크하고 조정해요' },
      { name:'배터리 & 전원 장치', organ:'❤️ 심장',
        example:'예) 리튬 배터리 + 전원 분배기',
        color:'#ff8a80',
        desc:'모든 부품에 전기를 공급하는 로봇의 심장이에요. 배터리에서 나오는 전기를 각 부품에 맞는 크기로 조절해서 나눠줘요. 전기 없이는 아무것도 작동 안 해요!',
        detail:'🔋 부품마다 필요한 전압이 달라서 전원 장치가 조절해줘요' },
    ],
    okayText:'✅ 조립 완료! 다음 단계로!',
    dashboard:{
      title:'🧠 Step 1 완료 — 뇌와 심장 연결 성공!',
      subtitle:'메인 컴퓨터 · 제어 보드 · 배터리 연결 완료',
      sensors:{cpu:true,mcu:true,power:true,lidar:false,imu:false,camera:false,encoder:false},
      slamActive:false, tfActive:false,
      statusMessage:'시스템 전원 ON · 메인 컴퓨터 부팅 완료 · 제어 보드 초기화 완료',
      badgeIcon:'🧠', badgeText:'뇌와 심장',
      nextText:'다음 단계 — Step 2. 뼈대와 근육 조립 →',
    },
  },

  /* ─────────────────── STEP 2 ─────────────────── */
  {
    type:'step', partNum:1, partTitle:'하드웨어 설계 및 제작',
    stepNum:2, id:'step-2', icon:'⚙️',
    title:'Step 2. 뼈대와 근육 붙이기',
    subtitle:'로봇이 실제로 움직이는 부품들',
    narrative:`💪 뇌와 심장이 켜졌어요! 이제 로봇에게 몸을 만들어 줄게요.

섀시(뼈대)를 먼저 조립하고, 바퀴를 돌릴 모터(근육)와 이동거리를 측정하는 엔코더(거리 감각)를 붙여요.

엔코더가 없으면 로봇은 "내가 얼마나 갔지?" 를 전혀 몰라요! 눈 감고 걷는 것과 같아요. 👉`,
    components:[
      { name:'로봇 몸통 (섀시)', organ:'🦴 뼈대',
        example:'예) 알루미늄 4WD 프레임',
        color:'#90a4ae',
        desc:'모든 부품을 올려놓는 로봇의 뼈대예요. 레고 베이스판처럼 여기에 다른 부품들을 고정시켜요. 튼튼할수록 센서 위치가 정확하게 유지돼요!',
        detail:'🔩 센서가 흔들리면 지도가 왜곡되니까 단단히 고정해야 해요' },
      { name:'바퀴 모터 ×4', organ:'💪 근육',
        example:'예) BLDC 허브 모터',
        color:'#ffcc02',
        desc:'전기 신호를 받아서 바퀴를 돌리는 로봇의 근육이에요. 빠른 신호 = 빠른 바퀴, 느린 신호 = 느린 바퀴! 바퀴 4개가 각각 다른 속도로 돌면 회전도 가능해요.',
        detail:'🚗 왼쪽 바퀴가 더 빠르면 오른쪽으로 돌아요 (차와 똑같아요!)' },
      { name:'바퀴 회전 측정기 (엔코더)', organ:'🎯 거리 감각',
        example:'예) 광학 엔코더 1024 PPR',
        color:'#69f0ae',
        desc:'바퀴가 몇 바퀴 돌았는지 정밀하게 세는 장치예요. "바퀴를 5.3바퀴 돌렸으니 약 2.7m 이동!" 이런 식으로 계산해요. 이 데이터 없이는 자율주행이 불가능해요!',
        detail:'📏 바퀴 1바퀴 = 1024번 카운트! 아주 정밀하게 측정해요' },
    ],
    okayText:'✅ 조립 완료! 다음 단계로!',
    dashboard:{
      title:'⚙️ Step 2 완료 — 구동 시스템 연결 성공!',
      subtitle:'로봇 몸통 · 바퀴 모터 ×4 · 회전 측정기 연결 완료',
      sensors:{cpu:true,mcu:true,power:true,lidar:false,imu:false,camera:false,encoder:true},
      slamActive:false, tfActive:false,
      statusMessage:'엔코더 작동 시작 · 이동 거리 계산 중 · 모터 드라이버 연결 완료',
      badgeIcon:'⚙️', badgeText:'뼈대와 근육',
      nextText:'다음 단계 — Step 3. 눈과 귀 장착 →',
    },
  },

  /* ─────────────────── STEP 3 ─────────────────── */
  {
    type:'step', partNum:1, partTitle:'하드웨어 설계 및 제작',
    stepNum:3, id:'step-3', icon:'👁️',
    title:'Step 3. 눈과 귀 장착하기',
    subtitle:'로봇이 세상을 감지하는 센서들',
    narrative:`🎉 뼈대와 근육까지 완성! 이제 가장 신기한 단계예요!

이 3가지 센서가 모두 붙으면 드디어 로봇이 "세상을 볼 수" 있어요.
센서가 있어야 SLAM(지도 만들기)이 시작돼요!

직접 붙여볼까요? 👉`,
    components:[
      { name:'라이다 센서', organ:'👁️ 레이저 눈',
        example:'예) RPLidar S3, Velodyne VLP-16',
        color:'#4fc3f7',
        desc:'레이저 빛을 360도로 쏴서 주변 물체까지의 거리를 재요. 박쥐가 소리로 벽을 찾는 것처럼, 라이다는 빛으로 주변을 스캔해요. 이 정보로 지도를 그려요!',
        detail:'🔦 1초에 수만 번 레이저를 쏴서 주변 지도를 만들어요' },
      { name:'카메라', organ:'📷 색깔 눈',
        example:'예) Intel RealSense D435i',
        color:'#ff8a80',
        desc:'우리 눈처럼 색깔과 모양을 봐요. 신호등이 빨간지 초록인지, 사람이 있는지, 차선은 어디인지 알 수 있어요. 라이다가 보지 못하는 것들을 카메라가 봐요!',
        detail:'🎨 라이다는 거리만, 카메라는 색깔과 모양을 봐요 — 서로 보완!'},
      { name:'기울기 센서 (IMU)', organ:'🌀 귀 속 균형감',
        example:'예) Bosch BMI088',
        color:'#ce93d8',
        desc:'로봇이 기울어졌는지, 얼마나 빨리 회전하는지 느끼는 센서예요. 우리가 눈을 감아도 자신이 기울어졌는지 아는 것처럼, 귀 속 달팽이관과 똑같은 원리예요!',
        detail:'⚡ 1초에 1000번 기울기를 측정해서 자세를 유지해요' },
    ],
    okayText:'✅ 전체 센서 장착! 1부 완료! 🎉',
    dashboard:{
      title:'👁️ Step 3 완료 — 모든 센서 장착! SLAM 시작!',
      subtitle:'1부 하드웨어 설계 완료! 자율주행 시스템 풀가동!',
      sensors:{cpu:true,mcu:true,power:true,lidar:true,imu:true,camera:true,encoder:true},
      slamActive:true, tfActive:true,
      unstableSlam:true,   // ← 디버깅 미션 전: 불안정 모드 ON
      statusMessage:'라이다 · 카메라 · IMU · 엔코더 전체 ON · SLAM 지도 생성 시작!',
      badgeIcon:'🏅', badgeText:'1부 완료!',
      nextText:'2부 시작 — 오류 해결 디버깅 미션! →',
      isMilestone:true,
    },
  },

  /* ─────────────────── MISSION 1 ─────────────────── */
  {
    type:'mission', partNum:2, partTitle:'치명적 오류 해결 — 디버깅 미션',
    missionNum:1, id:'mission-1', icon:'⚡',
    title:'Mission 1',
    subtitle:'로봇이 켜지자마자 꺼졌어요!',
    difficulty:'★★☆☆',
    narrative:`🚨 사건 발생! 출발 버튼을 눌렀더니 로봇 컴퓨터가 갑자기 꺼졌어요!

💡 왜 꺼졌을까요?
바퀴 모터 4개가 동시에 켜지면 순간적으로 전기를 엄청 많이 먹어요.
이때 배터리 전압이 갑자기 "뚝!" 떨어지면서 컴퓨터가 "전기 부족!" 상태가 되어 꺼지는 거예요.

마치 집에서 에어컨, 전자레인지, 헤어드라이어를 한꺼번에 켜면 두꺼비집이 내려가는 것과 같아요!`,
    quiz:{
      question:'이 문제를 근본적으로 해결하는 방법은 무엇일까요?',
      options:[
        { text:'더 큰 용량의 배터리로 바꾼다',
          correct:false,
          feedback:'큰 배터리도 모터가 갑자기 켜질 때는 전압이 뚝 떨어지는 문제가 그대로 발생해요. 임시방편이에요!' },
        { text:'모터 전기선과 컴퓨터 전기선을 따로 분리하고, 전압 안정 부품(콘덴서)을 추가한다',
          correct:true,
          feedback:'🎯 정답! 전기선을 분리하면 모터가 많은 전기를 쓸 때 컴퓨터 쪽 전기에 영향을 주지 않아요. 콘덴서는 전압이 흔들릴 때 순간적으로 에너지를 보충해줘요!' },
        { text:'모터를 하나씩 순서대로 천천히 켠다',
          correct:false,
          feedback:'이렇게 하면 자율주행 중에 빠른 반응이 필요할 때 쓸 수가 없어요. 근본 해결책이 아니에요!' },
      ],
    },
    canvasType:'mission1',
    clearText:'⚡ 전기 회로 분리 완료 — 미션 클리어!',
    dashboard:{
      title:'⚡ Mission 1 클리어 — 전원 안정화 성공!',
      subtitle:'모터/컴퓨터 전기선 분리 · 콘덴서 추가 완료',
      sensors:{cpu:true,mcu:true,power:true,lidar:true,imu:true,camera:true,encoder:true},
      slamActive:true, tfActive:false,
      statusMessage:'전압 안정화: 12.4V 유지 · 전원 충격 흡수 완료',
      badgeIcon:'⚡', badgeText:'전원 안정화',
      nextText:'다음 미션 — Mission 2. 지도가 기울어졌어요! →',
    },
  },

  /* ─────────────────── MISSION 2 ─────────────────── */
  {
    type:'mission', partNum:2, partTitle:'치명적 오류 해결 — 디버깅 미션',
    missionNum:2, id:'mission-2', icon:'📐',
    title:'Mission 2',
    subtitle:'지도가 기울어지고 미끄러져요!',
    difficulty:'★★★☆',
    narrative:`🚨 SLAM 지도가 점점 기울어지면서 로봇이 길을 잃고 있어요!

문제 1: 라이다가 로봇 위에 약간 기울어진 상태로 붙어있어요.
→ 레이저가 비스듬히 나가서 지도 전체가 삐뚤어져요.

문제 2: 미끄러운 바닥에서 바퀴가 헛돌아요 (슬립).
→ 엔코더는 "1m 이동!"이라고 하는데 실제로는 0.7m밖에 못 갔어요.

두 문제를 동시에 해결하는 방법을 찾아보세요!`,
    quiz:{
      question:'라이다 기울기 + 바퀴 미끄러짐, 두 가지를 동시에 해결하는 방법은?',
      options:[
        { text:'라이다만 다시 수평으로 붙인다',
          correct:false,
          feedback:'라이다 수평 재장착으로 지도 왜곡은 해결되지만, 바퀴 미끄러짐 문제는 여전히 남아요. 두 문제를 각각 해결해야 해요!' },
        { text:'라이다를 수평으로 정밀하게 붙이고, IMU 센서 데이터로 바퀴 미끄러짐을 보정한다',
          correct:true,
          feedback:'🎯 완벽해요! 라이다를 수평으로 붙여서 지도 왜곡을 없애고, IMU(기울기 센서)로 실제 이동량을 계산해서 바퀴 미끄러짐을 보정해요. 두 가지 모두 해결!' },
        { text:'바퀴에 마찰력 강한 타이어를 달아서 미끄러짐을 없앤다',
          correct:false,
          feedback:'마찰력이 높아도 완전히 미끄러짐을 없앨 수는 없어요. 그리고 라이다 기울기 문제는 여전히 남아요!' },
      ],
    },
    canvasType:'mission2',
    clearText:'📐 수평 장착 & IMU 보정 완료 — 미션 클리어!',
    dashboard:{
      title:'📐 Mission 2 클리어 — 지도 정확도 복원!',
      subtitle:'라이다 수평 캘리브레이션 · IMU 슬립 보정 활성화',
      sensors:{cpu:true,mcu:true,power:true,lidar:true,imu:true,camera:true,encoder:true},
      slamActive:true, tfActive:false,
      statusMessage:'지도 기울기 0° 교정 · 슬립 보정 활성화 · 위치 오차 최소화',
      badgeIcon:'📐', badgeText:'지도 교정',
      nextText:'다음 미션 — Mission 3. 없는 장애물이 보여요! →',
    },
  },

  /* ─────────────────── MISSION 3 ─────────────────── */
  {
    type:'mission', partNum:2, partTitle:'치명적 오류 해결 — 디버깅 미션',
    missionNum:3, id:'mission-3', icon:'🗺️',
    title:'Mission 3',
    subtitle:'없는 곳에 장애물이 있다고 멈춰요!',
    difficulty:'★★★★',
    narrative:`🚨 분명히 빈 복도인데 로봇이 "장애물 있음!"을 외치며 멈춰요!

소프트웨어는 라이다가 로봇 정중앙에 있다고 알고 있어요.
그런데 실제 라이다는 로봇 앞쪽 15cm에 붙어있어요.

→ 라이다가 "앞에 벽이 있어!"라고 해도, 소프트웨어는 그 벽이 어디 있는지 엉뚱하게 계산해요.
→ 결국 빈 공간도 장애물로 잘못 그려지는 거예요!

소프트웨어에게 "라이다 위치"를 정확히 알려주면 해결할 수 있어요.`,
    quiz:{
      question:'소프트웨어가 라이다 위치를 잘못 알고 있는 문제. 해결 방법은?',
      options:[
        { text:'장애물 감지 민감도를 낮춰서 덜 민감하게 만든다',
          correct:false,
          feedback:'민감도를 낮추면 진짜 장애물도 감지 못해요! 더 위험해지는 거예요. 원인을 해결해야 해요.' },
        { text:'라이다를 로봇 정중앙으로 물리적으로 이동한다',
          correct:false,
          feedback:'항상 중앙 배치가 가능한 게 아니에요. 위치가 달라도 소프트웨어에서 올바르게 설정하면 돼요!' },
        { text:'소프트웨어에서 "라이다는 로봇 앞 15cm, 위 12cm에 있어"라고 정확히 알려준다',
          correct:true,
          feedback:'🎯 바로 이거예요! ROS에서 URDF 파일로 각 부품의 위치를 정확히 적어주면, 로봇이 모든 거리를 올바르게 계산해요. 소프트웨어 설정이 핵심이에요!' },
      ],
    },
    canvasType:'mission3',
    clearText:'🗺️ 소프트웨어 위치 설정 완료 — 미션 클리어!',
    dashboard:{
      title:'🗺️ Mission 3 클리어 — 좌표 설정 완벽!',
      subtitle:'URDF 라이다 위치 설정 수정 · 장애물 오탐지 제거',
      sensors:{cpu:true,mcu:true,power:true,lidar:true,imu:true,camera:true,encoder:true},
      slamActive:true, tfActive:true,
      statusMessage:'라이다 위치 설정 완료 · 장애물 오탐지 0건 · 지도 정확도 향상',
      badgeIcon:'🗺️', badgeText:'좌표 정렬',
      nextText:'마지막 미션 — Mission 4. 유리를 못 봐요! →',
    },
  },

  /* ─────────────────── MISSION 4 ─────────────────── */
  {
    type:'mission', partNum:2, partTitle:'치명적 오류 해결 — 디버깅 미션',
    missionNum:4, id:'mission-4', icon:'🔮',
    title:'Mission 4',
    subtitle:'로봇이 유리문을 못 봐요!',
    difficulty:'★★★★',
    narrative:`🚨 투명한 유리문을 향해 전속력으로 돌진하거나, 거울 앞에서 무한 회전해요!

💡 왜 그럴까요?
라이다의 레이저는 투명한 유리를 통과해 버려요. 거울에서는 엉뚱한 방향으로 튕겨나가요.
이건 라이다의 물리적 한계라서, 아무리 비싼 라이다를 사도 해결이 안 돼요!

그런데 유리는 카메라로 볼 수 있고, 초음파 센서로 가까이 있는 물체를 감지할 수 있어요.
서로 다른 센서가 서로의 약점을 보완하는 거예요!`,
    quiz:{
      question:'라이다가 유리와 거울을 감지 못하는 문제. 해결 방법은?',
      options:[
        { text:'더 강한 레이저를 가진 고성능 라이다로 교체한다',
          correct:false,
          feedback:'아무리 강한 레이저도 유리는 통과해요! 이건 물리 법칙이라서 센서 업그레이드로 해결이 안 돼요.' },
        { text:'카메라로 유리를 시각적으로 감지하고, 초음파 센서로 가까운 물체를 탐지해서 같이 사용한다',
          correct:true,
          feedback:'🎯 바로 이거예요! 카메라는 유리문을 볼 수 있고, 초음파는 가까운 물체를 감지해요. 여러 센서를 함께 써서 서로의 약점을 보완하는 게 자율주행의 핵심이에요!' },
        { text:'유리문과 거울의 위치를 미리 지도에 직접 표시해 놓는다',
          correct:false,
          feedback:'처음 가는 곳에서는 어디에 유리가 있는지 미리 알 수가 없어요! 그래서 실시간으로 감지할 수 있어야 해요.' },
      ],
    },
    canvasType:'mission4',
    clearText:'🔮 센서 융합 적용 — 최종 미션 클리어! 🏆',
    dashboard:{
      title:'🏆 전체 마스터클래스 완료! 자율주행 마스터!',
      subtitle:'1부 하드웨어 설계 + 2부 디버깅 미션 전체 클리어!',
      sensors:{cpu:true,mcu:true,power:true,lidar:true,imu:true,camera:true,encoder:true},
      slamActive:true, tfActive:true,
      statusMessage:'모든 센서 융합 활성화 · 전체 시스템 100% 정상 · 자율주행 준비 완료!',
      badgeIcon:'🏆', badgeText:'마스터!',
      nextText:'LiDAR SLAM 시뮬레이터로 이동 →',
      isFinal:true,
    },
  },
];

/* ══════════════════════════════════════════════════════════════
   상태 변수
   ══════════════════════════════════════════════════════════════ */
let currentIdx    = -1;
let completedIdxs = [];
let quizDone      = false;
let stageAnimId   = null;
let assembledParts = {};    // { slotId: partId } — 드래그앤드롭 상태
let draggingPartId = null;  // 현재 드래그 중인 partId
let touchGhost     = null;  // 터치 드래그용 고스트 엘리먼트
const screens = {};
const $ = id => document.getElementById(id);

/* ══════════════════════════════════════════════════════════════
   화면 전환
   ══════════════════════════════════════════════════════════════ */
function showScreen(id) {
  Object.values(screens).forEach(s => s.classList.remove('active','fade-out'));
  if (screens[id]) screens[id].classList.add('active');
}

function transitionTo(id) {
  return new Promise(res => {
    const cur = Object.values(screens).find(s => s.classList.contains('active'));
    if (cur) {
      cur.classList.add('fade-out');
      setTimeout(() => { showScreen(id); res(); }, 380);
    } else { showScreen(id); res(); }
  });
}

/* ══════════════════════════════════════════════════════════════
   브레드크럼 업데이트
   ══════════════════════════════════════════════════════════════ */
function updateBreadcrumb() {
  const el = $('mc-breadcrumb');
  if (!el) return;
  const labels = ['Step 1','Step 2','Step 3','M-1','M-2','M-3','M-4'];
  el.innerHTML = labels.map((lbl,i) => {
    const done   = completedIdxs.includes(i);
    const active = i === currentIdx;
    const cls = 'mc-crumb' + (done ? ' done' : active ? ' active' : '');
    return `<span class="${cls}">${lbl}</span>` +
      (i < labels.length-1 ? '<span class="mc-crumb-sep">›</span>' : '');
  }).join('');
}

/* ══════════════════════════════════════════════════════════════
   스테이지 렌더링 (좌측 패널)
   ══════════════════════════════════════════════════════════════ */
function renderStage(stage) {
  stopStageAnim();
  quizDone = false;
  assembledParts = {};

  const lbl = $('mc-stage-label');
  if (lbl) lbl.textContent = stage.type === 'step'
    ? `Step ${stage.stepNum} / 3`
    : `Mission ${stage.missionNum} / 4`;

  /* ── 왼쪽 패널 HTML 빌드 ── */
  let html = `
    <span class="stage-part-badge">
      ${stage.partNum===1 ? '📦 1부: 하드웨어 설계' : '🔧 2부: 디버깅 미션'}
    </span>
    <div class="stage-icon">${stage.icon}</div>
    <div>
      <div class="stage-title mc-glitch">${stage.title}</div>
      <div class="stage-subtitle">${stage.subtitle}</div>
      ${stage.difficulty
        ? `<div class="mission-difficulty">
             <span class="label">난이도</span>
             <span class="stars">${stage.difficulty}</span>
           </div>`
        : ''}
    </div>
    <div class="stage-narrative">${stage.narrative}</div>
  `;

  if (stage.type === 'step') {
    html += `<div class="components-grid">`;
    stage.components.forEach(c => {
      html += `
        <div class="component-card" style="--card-color:${c.color}">
          <div class="card-header-row">
            <span class="card-organ">${c.organ}</span>
            <span class="card-name">${c.name}</span>
          </div>
          <div class="card-example">${c.example}</div>
          <div class="card-desc">${c.desc}</div>
          <div class="card-detail">${c.detail}</div>
        </div>`;
    });
    html += `</div>`;
  } else {
    html += `
      <div class="quiz-panel">
        <div class="quiz-question">🔍 ${stage.quiz.question}</div>
        <div class="quiz-options" id="quiz-options">
    `;
    stage.quiz.options.forEach((opt,i) => {
      html += `
        <div class="quiz-option" data-idx="${i}" data-correct="${opt.correct}"
             onclick="handleQuiz(this,${i})">
          <span class="quiz-option-num">${String.fromCharCode(65+i)}</span>
          <span>${opt.text}</span>
        </div>`;
    });
    html += `</div><div class="quiz-feedback" id="quiz-feedback"></div></div>`;
  }

  $('stage-left').innerHTML = html;

  /* ── 오른쪽 패널 ── */
  const stageRight = $('stage-right');
  if (stage.type === 'step') {
    stageRight.innerHTML = buildAssemblyHTML(stage);
    setupDragDrop(stage);
  } else {
    stageRight.innerHTML = '<canvas id="canvas-stage" class="stage-canvas"></canvas>';
    const canvas = $('canvas-stage');
    if (canvas) {
      canvas.width  = canvas.offsetWidth  || 640;
      canvas.height = canvas.offsetHeight || 520;
      initMissionCanvas(canvas.getContext('2d'), canvas, stage);
    }
  }

  /* ── 버튼 세팅 ── */
  const btnOkay  = $('btn-okay');
  const btnClear = $('btn-mission-clear');
  const hint     = $('stage-action-hint');

  if (stage.type === 'step') {
    btnOkay.style.display  = 'block';
    btnClear.style.display = 'none';
    btnOkay.textContent = stage.okayText;
    btnOkay.disabled    = true;   // 조립 완료 전까지 비활성
    btnOkay.onclick = () => completeStage(stage);
    if (hint) hint.textContent = '오른쪽 조립판에 부품을 모두 드래그하면 버튼이 활성화돼요 →';
  } else {
    btnOkay.style.display  = 'none';
    btnClear.style.display = 'none';
    btnClear.textContent = stage.clearText;
    btnClear.onclick = () => completeStage(stage);
    if (hint) hint.textContent = '정답을 선택하면 미션 클리어 버튼이 나타나요!';
  }

  updateBreadcrumb();
}

/* ══════════════════════════════════════════════════════════════
   ★ 드래그&드롭 조립 HTML 빌드
   ══════════════════════════════════════════════════════════════ */
function buildAssemblyHTML(stage) {
  const cfg = ASSEMBLY_CONFIGS[stage.id];
  if (!cfg) return '';

  const slotByPos = {};
  cfg.slots.forEach(s => slotByPos[s.pos] = s);

  function slotHTML(s) {
    if (!s) return '<div style="width:100px;height:90px;"></div>';
    return `
      <div class="drop-zone" id="slot-${s.id}"
           data-accepts="${s.id}" style="--slot-color:${s.color}">
        <div class="dz-icon">${s.icon}</div>
        <div class="dz-label">${s.label}</div>
        <div class="dz-hint">${s.hint}</div>
      </div>`;
  }

  const partsHTML = cfg.parts.map(p => `
    <div class="draggable-part" id="part-${p.id}"
         draggable="true" data-part-id="${p.id}"
         style="--part-color:${p.color}">
      <div class="part-emoji">${p.emoji}</div>
      <div class="part-name">${p.name}</div>
    </div>`).join('');

  return `
    <div class="assembly-wrapper">
      <div class="assembly-header">
        <div class="assembly-title">🤖 ${cfg.title}</div>
        <div class="assembly-subtitle">${cfg.subtitle}</div>
      </div>

      <div class="robot-figure">
        <!-- 위쪽 슬롯 -->
        <div class="robot-row">
          ${slotHTML(slotByPos['top'])}
        </div>

        <!-- 가운데: 왼쪽 슬롯 + 로봇 몸통 + 오른쪽 슬롯 -->
        <div class="robot-row">
          ${slotHTML(slotByPos['left'])}
          <div class="robot-torso-area">
            <div class="robot-body-emoji">🤖</div>
            <div class="robot-wheels">⚫⚫</div>
          </div>
          ${slotHTML(slotByPos['right'])}
        </div>
      </div>

      <!-- 조립 완료 배너 -->
      <div class="assembly-complete-banner" id="assembly-complete-banner">
        🎉 조립 완료! 아래 버튼을 눌러 결과를 확인하세요!
      </div>

      <!-- 부품 트레이 -->
      <div class="parts-divider">
        <div class="parts-divider-label">⬇️ 부품 보관함 — 드래그하세요!</div>
      </div>
      <div class="parts-tray" id="parts-tray">
        ${partsHTML}
      </div>
    </div>`;
}

/* ══════════════════════════════════════════════════════════════
   ★ 드래그&드롭 이벤트 세팅
   ══════════════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════════════
   ★ 드래그&드롭 이벤트 세팅 (마우스 + 패드 터치 완벽 지원)
   ══════════════════════════════════════════════════════════════ */
function setupDragDrop(stage) {
  const cfg = ASSEMBLY_CONFIGS[stage.id];
  if (!cfg) return;

  let activePart = null;      // 현재 드래그 중인 부품 DOM 요소
  let ghost = null;           // 마우스를 따라다니는 복사본
  let offsetX = 0, offsetY = 0;

  // ── 고스트 생성 ──
  function createGhost(el, x, y) {
    if (ghost) ghost.remove();
    ghost = el.cloneNode(true);
    const rect = el.getBoundingClientRect();
    offsetX = x - rect.left;
    offsetY = y - rect.top;
    Object.assign(ghost.style, {
      position:      'fixed',
      left:          (x - offsetX) + 'px',
      top:           (y - offsetY) + 'px',
      width:         rect.width + 'px',
      height:        rect.height + 'px',
      opacity:       '0.75',
      pointerEvents: 'none',
      zIndex:        '99999',
      transform:     'scale(1.05)',
      transition:    'none',
    });
    document.body.appendChild(ghost);
  }

  // ── 고스트 이동 ──
  function moveGhost(x, y) {
    if (!ghost) return;
    ghost.style.left = (x - offsetX) + 'px';
    ghost.style.top  = (y - offsetY) + 'px';
  }

  // ── 고스트 제거 ──
  function removeGhost() {
    if (ghost) { ghost.remove(); ghost = null; }
  }

  // ── 현재 좌표 아래 drop-zone 탐색 ──
  function getZoneAt(x, y) {
    if (ghost) ghost.style.display = 'none';
    const el = document.elementFromPoint(x, y);
    if (ghost) ghost.style.display = '';
    return el ? el.closest('.drop-zone') : null;
  }

  // ── 모든 drag-over 스타일 제거 ──
  function clearDragOver() {
    document.querySelectorAll('.drop-zone.drag-over')
      .forEach(z => z.classList.remove('drag-over'));
  }

  // ── 부품별 mousedown 등록 ──
  document.querySelectorAll('.draggable-part').forEach(el => {

    el.addEventListener('mousedown', e => {
      if (el.classList.contains('placed')) return;
      e.preventDefault();

      activePart = el;
      draggingPartId = el.dataset.partId;
      el.classList.add('dragging');
      createGhost(el, e.clientX, e.clientY);
    });
  });

  // ── document 레벨에서 mousemove / mouseup 처리 ──
  document.addEventListener('mousemove', e => {
    if (!activePart) return;
    moveGhost(e.clientX, e.clientY);

    clearDragOver();
    const zone = getZoneAt(e.clientX, e.clientY);
    if (zone && !zone.classList.contains('filled')) {
      zone.classList.add('drag-over');
    }
  });

  document.addEventListener('mouseup', e => {
    if (!activePart) return;

    clearDragOver();
    const zone = getZoneAt(e.clientX, e.clientY);

    if (zone && !zone.classList.contains('filled') && draggingPartId) {
      handleDrop(draggingPartId, zone, cfg, stage.id);
    }

    activePart.classList.remove('dragging');
    activePart   = null;
    draggingPartId = null;
    removeGhost();
  });

  // ── 터치 이벤트 (모바일/태블릿) ──
  document.querySelectorAll('.draggable-part').forEach(el => {

    el.addEventListener('touchstart', e => {
      if (el.classList.contains('placed')) return;
      activePart     = el;
      draggingPartId = el.dataset.partId;
      el.classList.add('dragging');
      const t = e.touches[0];
      createGhost(el, t.clientX, t.clientY);
    }, { passive: true });

    el.addEventListener('touchmove', e => {
      if (!activePart) return;
      if (e.cancelable) e.preventDefault();
      const t = e.touches[0];
      moveGhost(t.clientX, t.clientY);
      clearDragOver();
      const zone = getZoneAt(t.clientX, t.clientY);
      if (zone && !zone.classList.contains('filled')) {
        zone.classList.add('drag-over');
      }
    }, { passive: false });

    el.addEventListener('touchend', e => {
      if (!activePart) return;
      const t = e.changedTouches[0];
      clearDragOver();
      const zone = getZoneAt(t.clientX, t.clientY);
      if (zone && !zone.classList.contains('filled') && draggingPartId) {
        handleDrop(draggingPartId, zone, cfg, stage.id);
      }
      activePart.classList.remove('dragging');
      activePart     = null;
      draggingPartId = null;
      removeGhost();
    });
  });
}

  // ── [2] 드롭 존 ──
  document.querySelectorAll('.drop-zone').forEach(zone => {
    zone.addEventListener('dragenter', e => {
      e.preventDefault();
      if (!zone.classList.contains('filled')) zone.classList.add('drag-over');
    });

    zone.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (!zone.classList.contains('filled')) zone.classList.add('drag-over');
    });

    // ★ 핵심 수정: 자식 요소로 이동 시 flicker 방지
    zone.addEventListener('dragleave', e => {
      if (zone.contains(e.relatedTarget)) return;
      zone.classList.remove('drag-over');
    });

    zone.addEventListener('drop', e => {
      e.preventDefault();
      e.stopPropagation();
      zone.classList.remove('drag-over');

      // ★ 핵심 수정: draggingPartId 우선, 없으면 dataTransfer에서 읽기
      const partId = draggingPartId
        || e.dataTransfer.getData('text/plain')
        || e.dataTransfer.getData('text');

      if (!partId || zone.classList.contains('filled')) return;

      draggingPartId = null; // drop 성공 시 즉시 초기화
      handleDrop(partId, zone, cfg, stage.id);
    });
  });
/* ── 드롭 처리 ── */
function handleDrop(partId, zone, cfg, stageId) {
  const accepts = zone.dataset.accepts;
  const part    = cfg.parts.find(p => p.id === partId);
  if (!part) return;

  if (accepts === partId) {
    // ✅ 올바른 슬롯
    zone.classList.add('filled', 'just-filled');
    zone.style.setProperty('--slot-color', part.color);
    zone.innerHTML = `
      <div class="dz-icon" style="font-size:2.2rem;">${part.emoji}</div>
      <div class="dz-label" style="color:${part.color};font-weight:700;font-size:.78rem;">${part.name}</div>
      <div style="font-size:.65rem;color:rgba(255,255,255,.65)">✅ 연결!</div>`;
    setTimeout(() => zone.classList.remove('just-filled'), 700);

    // 부품 카드 비활성화
    const partEl = document.getElementById('part-' + partId);
    if (partEl) { partEl.classList.add('placed'); partEl.style.opacity = ''; }

    assembledParts[accepts] = partId;
    checkAssemblyComplete(stageId, cfg);
  } else {
    // ❌ 잘못된 슬롯
    zone.classList.add('wrong-drop');
    setTimeout(() => zone.classList.remove('wrong-drop'), 500);
    const partEl = document.getElementById('part-' + partId);
    if (partEl) partEl.style.opacity = '';
  }
}

/* ── 조립 완료 체크 ── */
function checkAssemblyComplete(stageId, cfg) {
  const allFilled = cfg.slots.every(s => assembledParts[s.id]);
  if (allFilled) {
    const btnOkay = $('btn-okay');
    if (btnOkay) {
      btnOkay.disabled = false;
      btnOkay.style.animation = 'pulse-border 1.5s ease-in-out infinite';
    }
    const banner = $('assembly-complete-banner');
    if (banner) banner.classList.add('visible');
  }
}

/* ══════════════════════════════════════════════════════════════
   퀴즈 핸들러
   ══════════════════════════════════════════════════════════════ */
function handleQuiz(el, idx) {
  if (quizDone) return;
  const stage    = STAGES[currentIdx];
  const opt      = stage.quiz.options[idx];
  const feedback = $('quiz-feedback');
  const allOpts  = document.querySelectorAll('.quiz-option');

  if (opt.correct) {
    quizDone = true;
    allOpts.forEach(o => o.classList.add('answered'));
    el.classList.add('correct');
    feedback.className   = 'quiz-feedback correct';
    feedback.textContent = '✅ ' + opt.feedback;
    const btnClear = $('btn-mission-clear');
    if (btnClear) btnClear.style.display = 'block';
  } else {
    el.classList.add('wrong');
    feedback.className   = 'quiz-feedback wrong';
    feedback.textContent = '❌ ' + opt.feedback;
    setTimeout(() => {
      el.classList.remove('wrong');
      feedback.className = 'quiz-feedback';
    }, 2500);
  }
}
window.handleQuiz = handleQuiz;

/* ══════════════════════════════════════════════════════════════
   스테이지 완료 → 대시보드
   ══════════════════════════════════════════════════════════════ */
function completeStage(stage) {
  if (!completedIdxs.includes(currentIdx)) completedIdxs.push(currentIdx);
  DashboardEngine.stop(); stopStageAnim();
  transitionTo('screen-dashboard').then(() => {
    setTimeout(() => { resizeDbCanvases(); renderDashboard(stage.dashboard); }, 60);
  });
}

/* ══════════════════════════════════════════════════════════════
   대시보드 렌더링
   ══════════════════════════════════════════════════════════════ */
function renderDashboard(cfg) {
  const t = $('dash-title');   if (t) t.textContent = cfg.title;
  const s = $('dash-subtitle'); if (s) s.textContent = cfg.subtitle;
  const b = $('dash-badge-icon'); if (b) b.textContent = cfg.badgeIcon || '✅';
  const m = $('dash-status-msg'); if (m) m.textContent = cfg.statusMessage || '';
  renderBadges();

  const btnNext   = $('btn-next-stage');
  const btnFinish = $('btn-finish');

  if (cfg.isFinal) {
    if (btnNext)   btnNext.style.display   = 'none';
    if (btnFinish) { btnFinish.style.display = 'block'; btnFinish.onclick = () => location.href='index.html'; }
    launchConfetti();
  } else {
    if (btnNext)   { btnNext.style.display = 'block'; btnNext.textContent = cfg.nextText || '다음 단계 →'; btnNext.onclick = goNext; }
    if (btnFinish) btnFinish.style.display = 'none';
  }

  DashboardEngine.init(cfg);
}

function resizeDbCanvases() {
  ['canvas-slam-dash','canvas-tf'].forEach(id => {
    const c = $(id);
    if (c) { c.width = c.offsetWidth || 600; c.height = c.offsetHeight || 400; }
  });
}

function renderBadges() {
  const el = $('achievement-badges'); if (!el) return;
  el.innerHTML = STAGES.map((st,i) => {
    const earned = completedIdxs.includes(i);
    const icon   = st.dashboard ? st.dashboard.badgeIcon : '○';
    const text   = st.dashboard ? st.dashboard.badgeText : '';
    return `<div class="ach-badge${earned?' earned':''}">${icon} ${text}</div>`;
  }).join('');
}

/* ══════════════════════════════════════════════════════════════
   다음 스테이지로 이동
   ══════════════════════════════════════════════════════════════ */
function goNext() {
  DashboardEngine.stop();
  currentIdx++;
  if (currentIdx >= STAGES.length) { transitionTo('screen-intro'); return; }
  transitionTo('screen-stage').then(() => renderStage(STAGES[currentIdx]));
}

/* ══════════════════════════════════════════════════════════════
   스테이지 애니메이션 정지
   ══════════════════════════════════════════════════════════════ */
function stopStageAnim() {
  if (stageAnimId) { cancelAnimationFrame(stageAnimId); stageAnimId = null; }
}

/* ══════════════════════════════════════════════════════════════
   미션 캔버스 디스패처
   ══════════════════════════════════════════════════════════════ */
function initMissionCanvas(ctx, canvas, stage) {
  const fn = {
    mission1: drawMission1,
    mission2: drawMission2,
    mission3: drawMission3,
    mission4: drawMission4,
  }[stage.canvasType];
  if (fn) fn(ctx, canvas);
}

/* ══════════════════════════════════════════════════════════════
   MISSION 1 — 전압 강하 그래프
   ══════════════════════════════════════════════════════════════ */
function drawMission1(ctx, canvas) {
  const W=canvas.width, H=canvas.height;
  let t=0;
  const GX=65,GY=55,GW=W-85,GH=H-150;

  function voltAt(p){
    if(p<.28)return 12.4;
    if(p<.42){const d=(p-.28)/.14;return 12.4-d*3.8+Math.sin(d*22)*.4;}
    if(p<.50)return 8.7+Math.sin(p*100)*.22;
    if(p<.55)return 8.7+(p-.50)/.05*(12.1-8.7);
    return 12.1+Math.sin(p*38+t*.07)*.06;
  }

  function loop(){
    t++;
    ctx.fillStyle='#0d1628'; ctx.fillRect(0,0,W,H);

    ctx.fillStyle='rgba(255,138,128,.85)'; ctx.font='bold 14px Noto Sans KR,sans-serif';
    ctx.textAlign='center'; ctx.fillText('⚡ 배터리 전압 변화 그래프',W/2,28);
    ctx.fillStyle='rgba(255,255,255,.5)'; ctx.font='12px Noto Sans KR,sans-serif';
    ctx.fillText('모터가 켜지면 전압이 갑자기 떨어져요!',W/2,46);

    ctx.fillStyle='rgba(13,20,45,.9)'; ctx.fillRect(GX,GY,GW,GH);

    // Y 축 눈금
    for(let i=0;i<=4;i++){
      const y=GY+(i/4)*GH;
      ctx.strokeStyle='rgba(79,195,247,.1)'; ctx.lineWidth=.8;
      ctx.beginPath(); ctx.moveTo(GX,y); ctx.lineTo(GX+GW,y); ctx.stroke();
      ctx.fillStyle='rgba(79,195,247,.55)'; ctx.font='11px JetBrains Mono,monospace'; ctx.textAlign='right';
      ctx.fillText((12.5-i*.5).toFixed(1)+'V',GX-7,y+4);
    }

    // 위험 구간
    const d1=GX+GW*.35, d2=GX+GW*.55;
    ctx.fillStyle='rgba(255,138,128,.08)'; ctx.fillRect(d1,GY,d2-d1,GH);
    ctx.fillStyle='rgba(255,138,128,.7)'; ctx.font='12px Noto Sans KR,sans-serif'; ctx.textAlign='center';
    ctx.fillText('💀 컴퓨터 꺼짐!',(d1+d2)/2,GY+22);
    ctx.fillStyle='rgba(255,138,128,.5)'; ctx.font='11px Noto Sans KR,sans-serif';
    ctx.fillText('(전압 부족)',(d1+d2)/2,GY+38);

    // 모터 켜짐 표시
    const mx=GX+GW*.28;
    ctx.strokeStyle='rgba(255,204,2,.6)'; ctx.lineWidth=1.5; ctx.setLineDash([5,4]);
    ctx.beginPath(); ctx.moveTo(mx,GY); ctx.lineTo(mx,GY+GH); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle='rgba(255,204,2,.9)'; ctx.font='12px Noto Sans KR,sans-serif'; ctx.textAlign='center';
    ctx.fillText('⚡ 모터 켜짐!',mx,GY+16);

    // 해결 표시
    const fx=GX+GW*.56;
    ctx.strokeStyle='rgba(105,240,174,.5)'; ctx.lineWidth=1.5; ctx.setLineDash([5,4]);
    ctx.beginPath(); ctx.moveTo(fx,GY); ctx.lineTo(fx,GY+GH); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle='rgba(105,240,174,.9)'; ctx.textAlign='center';
    ctx.fillText('✓ 회로 분리 후',GX+GW*.76,GY+16);

    // 안전 전압 선
    const safeY=GY+GH*(1-(12.0-8.7)/4.3);
    ctx.strokeStyle='rgba(105,240,174,.3)'; ctx.lineWidth=1; ctx.setLineDash([4,4]);
    ctx.beginPath(); ctx.moveTo(GX,safeY); ctx.lineTo(GX+GW,safeY); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle='rgba(105,240,174,.6)'; ctx.textAlign='left'; ctx.font='11px JetBrains Mono,monospace';
    ctx.fillText('안전 전압 12.0V',GX+5,safeY-5);

    // 전압 곡선 (애니메이션)
    const drawTo=Math.min(GW,Math.floor(GW*Math.min(1,t/200)));
    ctx.strokeStyle='#ff8a80'; ctx.lineWidth=2.5; ctx.shadowBlur=8; ctx.shadowColor='#ff8a80';
    ctx.beginPath();
    for(let x=0;x<=drawTo;x++){
      const v=voltAt(x/GW), y=GY+GH*(1-(v-8.7)/4.3);
      x===0?ctx.moveTo(GX+x,y):ctx.lineTo(GX+x,y);
    }
    ctx.stroke(); ctx.shadowBlur=0;

    // 축
    ctx.strokeStyle='rgba(79,195,247,.3)'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(GX,GY); ctx.lineTo(GX,GY+GH); ctx.lineTo(GX+GW,GY+GH); ctx.stroke();
    ctx.fillStyle='rgba(79,195,247,.5)'; ctx.font='11px Noto Sans KR,sans-serif'; ctx.textAlign='center';
    ctx.fillText('시간 →',GX+GW/2,GY+GH+18);
    ctx.save(); ctx.translate(GX-40,GY+GH/2); ctx.rotate(-Math.PI/2);
    ctx.fillText('전압(V)',0,0); ctx.restore();

    // 하단 설명
    ctx.fillStyle='rgba(255,204,2,.7)'; ctx.font='12px Noto Sans KR,sans-serif'; ctx.textAlign='center';
    ctx.fillText('📚 마치 여러 가전제품을 동시에 켜면 두꺼비집이 내려가는 것과 같아요!',W/2,H-18);

    ctx.textAlign='left';
    stageAnimId=requestAnimationFrame(loop);
  }
  loop();
}

/* ══════════════════════════════════════════════════════════════
   MISSION 2 — 기울어진 라이다 vs 수평 비교
   ══════════════════════════════════════════════════════════════ */
function drawMission2(ctx, canvas) {
  const W=canvas.width, H=canvas.height;
  let t=0;

  function drawSide(cx, cy, tilt, ok){
    const col = ok ? '#4fc3f7' : '#ff8a80';

    ctx.save(); ctx.translate(cx,cy); if(tilt) ctx.rotate(.2);

    // 로봇 몸통
    ctx.fillStyle='rgba(20,35,75,.9)'; ctx.strokeStyle=col; ctx.lineWidth=2; ctx.shadowBlur=8; ctx.shadowColor=col;
    ctx.beginPath(); ctx.roundRect(-22,-14,44,28,6); ctx.fill(); ctx.stroke(); ctx.shadowBlur=0;
    ctx.fillStyle=col; ctx.font='bold 10px JetBrains Mono,monospace'; ctx.textAlign='center';
    ctx.fillText('ROBOT',0,-1); ctx.fillText('BASE',0,11);

    // 라이다
    ctx.fillStyle=col; ctx.shadowBlur=10; ctx.shadowColor=col;
    ctx.beginPath(); ctx.arc(0,-20,7,0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0;

    // 스캔 레이
    const sa=t*.04;
    for(let i=0;i<36;i++){
      const a=sa+(i/36)*Math.PI*2;
      ctx.strokeStyle=col.replace(')',',0.18)').replace('rgb','rgba'); ctx.lineWidth=.6;
      ctx.beginPath(); ctx.moveTo(0,-20); ctx.lineTo(Math.cos(a)*80,-20+Math.sin(a)*80); ctx.stroke();
    }
    ctx.restore();
  }

  function drawMapBox(x,y,w,h,tilt){
    ctx.save(); ctx.translate(x+w/2,y+h/2);
    if(tilt) ctx.rotate(.16);
    const col=tilt?'rgba(255,138,128,.5)':'rgba(79,195,247,.5)';
    ctx.strokeStyle=col; ctx.lineWidth=1.5;
    ctx.strokeRect(-w/2,-h/2,w*.9,h*.85);
    ctx.fillStyle=tilt?'rgba(255,138,128,.35)':'rgba(79,195,247,.35)';
    if(tilt){
      for(let i=0;i<4;i++) ctx.fillRect(-w/2+i*22+4,-h/2+6+i*10,8,8);
    } else {
      ctx.fillRect(-w/2+4,-h/2+4,8,h*.72);
      ctx.fillRect(w/2-20,-h/2+4,8,h*.6);
    }
    ctx.restore();
  }

  function loop(){
    t++;
    ctx.fillStyle='#0d1628'; ctx.fillRect(0,0,W,H);

    ctx.fillStyle='rgba(255,204,2,.8)'; ctx.font='bold 14px Noto Sans KR,sans-serif';
    ctx.textAlign='center'; ctx.fillText('📐 라이다 장착 방법 비교',W/2,22);

    ctx.strokeStyle='rgba(255,255,255,.08)'; ctx.lineWidth=1; ctx.setLineDash([5,5]);
    ctx.beginPath(); ctx.moveTo(W/2,30); ctx.lineTo(W/2,H); ctx.stroke(); ctx.setLineDash([]);

    // 왼쪽 (오류)
    ctx.fillStyle='rgba(255,138,128,.06)'; ctx.fillRect(0,28,W/2,H-28);
    ctx.fillStyle='rgba(255,138,128,.85)'; ctx.font='bold 13px Noto Sans KR,sans-serif'; ctx.textAlign='center';
    ctx.fillText('❌ 기울어진 라이다',W*.25,48);
    ctx.fillStyle='rgba(255,138,128,.55)'; ctx.font='11px Noto Sans KR,sans-serif';
    ctx.fillText('→ 지도 전체가 뒤틀려요!',W*.25,64);
    drawSide(W*.25,H*.42,true,false);
    drawMapBox(W*.04,H*.63,W*.44,H*.26,true);
    ctx.fillStyle='rgba(255,138,128,.65)'; ctx.font='11px Noto Sans KR,sans-serif'; ctx.textAlign='center';
    ctx.fillText('⚠️ 왜곡된 지도',W*.25,H*.63+H*.26+16);

    // 오른쪽 (정상)
    ctx.fillStyle='rgba(105,240,174,.04)'; ctx.fillRect(W/2,28,W/2,H-28);
    ctx.fillStyle='rgba(105,240,174,.85)'; ctx.font='bold 13px Noto Sans KR,sans-serif';
    ctx.fillText('✅ 수평으로 장착한 라이다',W*.75,48);
    ctx.fillStyle='rgba(105,240,174,.55)'; ctx.font='11px Noto Sans KR,sans-serif';
    ctx.fillText('→ 지도가 정확해요!',W*.75,64);
    drawSide(W*.75,H*.42,false,true);
    drawMapBox(W*.52,H*.63,W*.46,H*.26,false);
    ctx.fillStyle='rgba(105,240,174,.65)'; ctx.font='11px Noto Sans KR,sans-serif'; ctx.textAlign='center';
    ctx.fillText('✓ 정확한 지도',W*.75,H*.63+H*.26+16);

    ctx.textAlign='left';
    stageAnimId=requestAnimationFrame(loop);
  }
  loop();
}

/* ══════════════════════════════════════════════════════════════
   MISSION 3 — TF 위치 오프셋 오류
   ══════════════════════════════════════════════════════════════ */
function drawMission3(ctx, canvas) {
  const W=canvas.width, H=canvas.height;
  let t=0;

  function drawScene(cx,cy,buggy){
    const rc=buggy?'#ff8a80':'#4fc3f7';

    // 로봇
    ctx.fillStyle='rgba(5,15,40,.95)'; ctx.strokeStyle=rc; ctx.lineWidth=2.5; ctx.shadowBlur=10; ctx.shadowColor=rc;
    ctx.beginPath(); ctx.arc(cx,cy,26,0,Math.PI*2); ctx.fill(); ctx.stroke(); ctx.shadowBlur=0;
    ctx.fillStyle=rc; ctx.font='bold 9.5px JetBrains Mono,monospace'; ctx.textAlign='center';
    ctx.fillText('ROBOT',cx,cy+4);

    // 실제 라이다 위치 (+40px 앞)
    const lax=cx+42,lay=cy-16;
    ctx.fillStyle='rgba(79,195,247,.12)'; ctx.strokeStyle='#4fc3f7'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.arc(lax,lay,12,0,Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.fillStyle='rgba(79,195,247,.9)'; ctx.font='8.5px JetBrains Mono,monospace'; ctx.textAlign='center';
    ctx.fillText('실제',lax,lay-1); ctx.fillText('위치',lax,lay+9);

    // 소프트웨어 인식 위치
    const sbx=buggy?cx:lax, sby=buggy?cy:lay;
    ctx.fillStyle=buggy?'rgba(255,138,128,.18)':'rgba(105,240,174,.14)';
    ctx.strokeStyle=buggy?'#ff8a80':'#69f0ae'; ctx.lineWidth=1.2; ctx.setLineDash([3,3]);
    ctx.beginPath(); ctx.arc(sbx,sby,12,0,Math.PI*2); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle=buggy?'#ff8a80':'#69f0ae'; ctx.font='8px Noto Sans KR,sans-serif';

    if(buggy){
      ctx.textAlign='center'; ctx.fillText('소프트웨어',sbx-30,sby+28);
      ctx.fillText('인식 위치',sbx-30,sby+39);
      // 오류 화살표
      ctx.strokeStyle='rgba(255,138,128,.7)'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(cx+10,cy-5); ctx.lineTo(lax-10,lay); ctx.stroke();
      ctx.fillStyle='rgba(255,138,128,.9)'; ctx.font='bold 10px Noto Sans KR,sans-serif'; ctx.textAlign='center';
      ctx.fillText('⚠️ 15cm 오차!',(cx+lax)/2,cy+14);
    } else {
      ctx.fillText('✓ 일치!',sbx,sby+26);
    }

    // 스캔 레이
    const sa=t*.04;
    for(let i=0;i<14;i++){
      const a=sa+(i/14)*Math.PI*2;
      ctx.strokeStyle='rgba(79,195,247,.2)'; ctx.lineWidth=.7;
      ctx.beginPath(); ctx.moveTo(lax,lay); ctx.lineTo(lax+Math.cos(a)*65,lay+Math.sin(a)*65); ctx.stroke();
    }
  }

  function loop(){
    t++;
    ctx.fillStyle='#0d1628'; ctx.fillRect(0,0,W,H);

    ctx.fillStyle='rgba(79,195,247,.8)'; ctx.font='bold 14px Noto Sans KR,sans-serif';
    ctx.textAlign='center'; ctx.fillText('🗺️ 라이다 위치 설정 — 오류 vs 정상',W/2,22);

    ctx.strokeStyle='rgba(255,255,255,.08)'; ctx.lineWidth=1; ctx.setLineDash([5,5]);
    ctx.beginPath(); ctx.moveTo(W/2,30); ctx.lineTo(W/2,H); ctx.stroke(); ctx.setLineDash([]);

    ctx.fillStyle='rgba(255,138,128,.05)'; ctx.fillRect(0,28,W/2,H-28);
    ctx.fillStyle='rgba(255,138,128,.85)'; ctx.font='bold 13px Noto Sans KR,sans-serif'; ctx.textAlign='center';
    ctx.fillText('❌ 위치 설정 안 됨',W*.25,48);
    ctx.fillStyle='rgba(255,138,128,.55)'; ctx.font='11px Noto Sans KR,sans-serif';
    ctx.fillText('→ 없는 장애물이 보여요!',W*.25,64);
    drawScene(W*.25,H*.5,true);

    ctx.fillStyle='rgba(105,240,174,.04)'; ctx.fillRect(W/2,28,W/2,H-28);
    ctx.fillStyle='rgba(105,240,174,.85)'; ctx.font='bold 13px Noto Sans KR,sans-serif'; ctx.textAlign='center';
    ctx.fillText('✅ 위치 정확히 설정',W*.75,48);
    ctx.fillStyle='rgba(105,240,174,.55)'; ctx.font='11px Noto Sans KR,sans-serif';
    ctx.fillText('→ 지도가 정확해요!',W*.75,64);
    drawScene(W*.75,H*.5,false);

    // 코드 예시
    ctx.fillStyle='rgba(79,195,247,.4)'; ctx.font='10.5px JetBrains Mono,monospace'; ctx.textAlign='left';
    ctx.fillText('// 소프트웨어에서 이렇게 설정해요:',W/2+10,H-52);
    ctx.fillStyle='rgba(105,240,174,.55)';
    ctx.fillText('x = 0.15m  (앞으로 15cm)',W/2+10,H-37);
    ctx.fillText('z = 0.12m  (위로 12cm)',W/2+10,H-21);

    ctx.textAlign='left';
    stageAnimId=requestAnimationFrame(loop);
  }
  loop();
}

/* ══════════════════════════════════════════════════════════════
   MISSION 4 — 유리 감지 센서 퓨전
   ══════════════════════════════════════════════════════════════ */
function drawMission4(ctx, canvas) {
  const W=canvas.width, H=canvas.height;
  let t=0;
  const cx=W/2, cy=H/2-10;

  function wallDist(ox,oy,angle,max,gx,gy1,gy2){
    const dx=Math.cos(angle),dy=Math.sin(angle);
    const walls=[
      [28,38,W-28,38],[W-28,38,W-28,H-65],[W-28,H-65,28,H-65],[28,H-65,28,38],
    ];
    let md=max;
    walls.forEach(([x1,y1,x2,y2])=>{
      const wx=x2-x1,wy=y2-y1,den=dx*wy-dy*wx;
      if(Math.abs(den)<1e-9)return;
      const tt=((x1-ox)*wy-(y1-oy)*wx)/den;
      const u=((x1-ox)*dy-(y1-oy)*dx)/den;
      if(tt>0&&tt<md&&u>=0&&u<=1)md=tt;
    });
    // 유리벽: 감지 못함 (라이다 통과)
    return md;
  }

  function loop(){
    t++;
    ctx.fillStyle='#0d1628'; ctx.fillRect(0,0,W,H);

    ctx.fillStyle='rgba(206,147,216,.8)'; ctx.font='bold 14px Noto Sans KR,sans-serif';
    ctx.textAlign='center'; ctx.fillText('🔮 라이다 사각지대 — 센서 융합으로 해결!',W/2,22);

    // 방 테두리
    ctx.strokeStyle='rgba(80,110,160,.4)'; ctx.lineWidth=2.5; ctx.strokeRect(28,38,W-56,H-103);

    // 유리문 (오른쪽)
    const gx=W-52, gy1=38+(H-141)*.2, gy2=38+(H-141)*.72;
    ctx.strokeStyle='rgba(100,200,255,.55)'; ctx.lineWidth=3; ctx.setLineDash([4,4]);
    ctx.beginPath(); ctx.moveTo(gx,gy1); ctx.lineTo(gx,gy2); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle='rgba(100,200,255,.7)'; ctx.font='bold 12px Noto Sans KR,sans-serif'; ctx.textAlign='center';
    ctx.fillText('유리문',gx,gy2+16);
    ctx.fillStyle='rgba(100,200,255,.4)'; ctx.font='10px Noto Sans KR,sans-serif';
    ctx.fillText('(투명, 라이다 통과 X)',gx,gy2+30);

    // 로봇
    ctx.fillStyle='rgba(4,12,38,.95)'; ctx.strokeStyle='#ce93d8';
    ctx.lineWidth=2.5; ctx.shadowBlur=16; ctx.shadowColor='#ce93d8';
    ctx.beginPath(); ctx.arc(cx,cy,22,0,Math.PI*2); ctx.fill(); ctx.stroke(); ctx.shadowBlur=0;
    ctx.fillStyle='#ce93d8'; ctx.font='18px sans-serif'; ctx.textAlign='center';
    ctx.fillText('🤖',cx,cy+6);

    // 라이다 레이 (유리 통과)
    const la=t*.02;
    for(let i=0;i<52;i++){
      const a=la+(i/52)*Math.PI*2;
      const dx2=Math.cos(a),dy2=Math.sin(a);
      const ep=cx+dx2*150, ey=cy+dy2*150;
      const thruGlass=(ep>gx-6)&&(ep<W-28)&&(ey>gy1)&&(ey<gy2);
      ctx.strokeStyle=thruGlass?'rgba(79,195,247,.08)':'rgba(79,195,247,.22)';
      ctx.lineWidth=.7;
      if(thruGlass)ctx.setLineDash([4,4]);
      ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(ep,ey); ctx.stroke();
      if(thruGlass)ctx.setLineDash([]);
    }

    // 카메라 FOV
    const cf=.55;
    ctx.fillStyle='rgba(255,138,128,.07)'; ctx.strokeStyle='rgba(255,138,128,.5)'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(cx,cy);
    ctx.lineTo(cx+Math.cos(-cf)*160,cy+Math.sin(-cf)*160);
    ctx.arc(cx,cy,160,-cf,cf); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle='rgba(255,138,128,.9)'; ctx.font='bold 12px Noto Sans KR,sans-serif'; ctx.textAlign='left';
    ctx.fillText('📷 카메라',cx+125,cy-40);
    ctx.fillStyle='rgba(255,138,128,.6)'; ctx.font='10px Noto Sans KR,sans-serif';
    ctx.fillText('유리 색깔 감지 ✓',cx+125,cy-26);

    // 초음파 (깜빡)
    if(Math.floor(t/16)%2===0){
      const ur=80;
      ctx.fillStyle='rgba(255,204,2,.09)'; ctx.strokeStyle='rgba(255,204,2,.55)'; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.moveTo(cx+18,cy);
      ctx.lineTo(cx+ur,cy-28); ctx.arc(cx+18,cy,ur,-Math.PI/6,Math.PI/6); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.fillStyle='rgba(255,204,2,.9)'; ctx.font='bold 12px Noto Sans KR,sans-serif';
      ctx.fillText('🔊 초음파',cx+ur-10,cy-32);
      ctx.fillStyle='rgba(255,204,2,.6)'; ctx.font='10px Noto Sans KR,sans-serif';
      ctx.fillText('가까운 물체 감지 ✓',cx+ur-10,cy-18);
    }

    // 라이다 사각지대 표시
    ctx.fillStyle='rgba(255,138,128,.45)'; ctx.font='10px Noto Sans KR,sans-serif'; ctx.textAlign='center';
    ctx.fillText('라이다 사각지대!',gx+12,cy);

    // 하단 설명
    if(t>40){
      const al=.3+Math.sin(t*.06)*.18;
      ctx.fillStyle=`rgba(105,240,174,${al})`; ctx.font='bold 13px Noto Sans KR,sans-serif'; ctx.textAlign='center';
      ctx.fillText('⚡ 센서 융합: 라이다 + 카메라 + 초음파',cx,H-40);
      ctx.fillStyle=`rgba(79,195,247,${al*.75})`; ctx.font='11px Noto Sans KR,sans-serif';
      ctx.fillText('서로의 약점을 보완해서 완벽한 감지!',cx,H-24);
    }

    ctx.textAlign='left';
    stageAnimId=requestAnimationFrame(loop);
  }
  loop();
}

/* ══════════════════════════════════════════════════════════════
   컨페티 (최종 완주)
   ══════════════════════════════════════════════════════════════ */
function launchConfetti() {
  const overlay = $('celebration-overlay'); if (!overlay) return;
  const colors = ['#4fc3f7','#ce93d8','#69f0ae','#ffcc02','#ff8a80','#ffffff'];
  for (let i = 0; i < 100; i++) {
    const el = document.createElement('div');
    el.className = 'confetti-particle';
    el.style.cssText =
      `left:${Math.random()*100}%;` +
      `background:${colors[Math.floor(Math.random()*colors.length)]};` +
      `animation-duration:${2.5+Math.random()*3}s;` +
      `animation-delay:${Math.random()*2}s;` +
      `width:${7+Math.random()*7}px;height:${7+Math.random()*7}px;`;
    overlay.appendChild(el);
    setTimeout(() => el.remove(), 6000);
  }
}

/* ══════════════════════════════════════════════════════════════
   초기화
   ══════════════════════════════════════════════════════════════ */
function init() {
  screens['screen-intro']     = $('screen-intro');
  screens['screen-stage']     = $('screen-stage');
  screens['screen-dashboard'] = $('screen-dashboard');

  const btnStart = $('btn-mc-start');
  if (btnStart) {
    btnStart.addEventListener('click', () => {
      currentIdx = 0;
      transitionTo('screen-stage').then(() => renderStage(STAGES[0]));
    });
  }

  showScreen('screen-intro');
}

document.addEventListener('DOMContentLoaded', init);
