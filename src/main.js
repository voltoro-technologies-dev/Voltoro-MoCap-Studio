import './style.css';
import { MoCapRigVisualizer } from './mocap-rig.js';
import { computeBoneRotations, MoCapRecorder, LandmarkFilterBank } from './mocap-math.js';
import { OpenRouterMoCapAI } from './ai-director.js';

// OpenRouter configuration
const OPENROUTER_KEY = import.meta.env.VITE_OPENROUTER_KEY || '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';
const AI_MODEL = import.meta.env.VITE_AI_MODEL || 'qwen/qwen-2.5-72b-instruct';

const app = document.querySelector('#app');

app.innerHTML = `
  <div style="display:flex; flex-direction:column; height:100vh; height:100dvh; width:100vw; background:#0a0c10; color:#f0f4fc; overflow:hidden;">
    
    <!-- Top Header Bar -->
    <header class="glass-panel" style="margin: 6px 8px; padding: 6px 12px; display:flex; justify-content:space-between; align-items:center; z-index:20; flex-shrink:0;">
      <div style="display:flex; align-items:center; gap:8px;">
        <div style="background: linear-gradient(135deg, #00f0ff, #7928ca); width: 28px; height: 28px; border-radius: 6px; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:0.95rem; color:#000;">
          V
        </div>
        <div>
          <div style="font-weight: 700; font-size: 0.95rem; letter-spacing: -0.02em; display:flex; align-items:center; gap:6px;">
            VOLTORO MoCap
            <span style="font-size:0.6rem; background:rgba(0, 240, 255, 0.15); color:#00f0ff; border:1px solid rgba(0,240,255,0.4); padding:1px 4px; border-radius:4px; font-family:var(--font-mono);">PRO</span>
          </div>
        </div>
      </div>

      <!-- Live Stream Status Indicators -->
      <div style="display:flex; align-items:center; gap:6px;">
        <div class="status-badge" id="camera-status">
          <span class="dot-indicator dot-yellow" id="cam-dot"></span>
          <span id="cam-status-text">OFF</span>
        </div>
        <div class="status-badge" id="stream-status">
          <span class="dot-indicator dot-red" id="stream-dot"></span>
          <span id="stream-status-text">DISCONNECTED</span>
        </div>
        <div class="status-badge" style="color:var(--accent-cyan);">
          FPS: <span id="fps-counter" style="margin-left:3px;">0</span>
        </div>
      </div>
    </header>

    <!-- Mobile Tab Switcher (Visible on phone screens) -->
    <nav class="mobile-only glass-panel" style="margin: 0 8px 6px 8px; padding: 4px; display:flex; gap:4px; flex-shrink:0;">
      <button id="tab-btn-viewport" class="nav-tab-btn active">
        3D View & Camera
      </button>
      <button id="tab-btn-controls" class="nav-tab-btn">
        Controls & Stream
      </button>
      <button id="tab-btn-ai" class="nav-tab-btn">
        AI Director
      </button>
    </nav>

    <!-- Main Workspace -->
    <main class="main-layout" style="flex:1; display:flex; position:relative; overflow:hidden; margin:0 8px 8px 8px; min-height:0;">
      
      <!-- 3D Rig Viewport -->
      <div id="viewport-pane" class="glass-panel" style="flex:1; position:relative; overflow:hidden; border-radius:12px; min-height:220px; display:flex;">
        <div id="rig-canvas-container" style="width:100%; height:100%; position:absolute; inset:0;"></div>

        <!-- Viewport Overlay HUD -->
        <div style="position:absolute; top:8px; left:8px; pointer-events:none; display:flex; flex-direction:column; gap:4px; z-index:5;">
          <div style="font-family:var(--font-mono); font-size:0.7rem; color:var(--accent-cyan); background:rgba(0,0,0,0.65); padding:3px 6px; border-radius:4px; backdrop-filter:blur(4px);">
            JOINTS: <span id="bone-count">0</span> / 33
          </div>
          <div style="font-family:var(--font-mono); font-size:0.65rem; color:var(--text-muted); background:rgba(0,0,0,0.65); padding:3px 6px; border-radius:4px; backdrop-filter:blur(4px);">
            Touch/Drag to Orbit
          </div>
        </div>

        <!-- Quick Floating Mobile Camera Controls (bottom overlay) -->
        <div style="position:absolute; bottom:10px; left:10px; display:flex; gap:6px; z-index:10;">
          <button id="btn-quick-cam" class="btn-mocap" style="background:var(--accent-cyan); color:#000; padding:6px 10px; font-size:0.75rem;">
            Start Cam
          </button>
          <button id="btn-quick-flip" class="btn-mocap" style="padding:6px 10px; font-size:0.75rem;">
            Flip
          </button>
        </div>

        <!-- Phone Camera Pip Preview -->
        <div id="pip-container" class="glass-panel" style="position:absolute; bottom:10px; right:10px; width:150px; height:110px; overflow:hidden; border-radius:8px; border:1px solid rgba(0,240,255,0.4); z-index:10; background:#000;">
          <video id="webcam" playsinline muted autoplay style="width:100%; height:100%; object-fit:cover; transform:scaleX(-1);"></video>
          <div style="position:absolute; top:3px; left:4px; font-size:0.6rem; font-weight:700; color:#fff; background:rgba(0,0,0,0.6); padding:1px 4px; border-radius:3px;">
            CAM FEED
          </div>
        </div>
      </div>

      <!-- Controls & Settings Pane -->
      <aside id="controls-pane" class="glass-panel" style="width:340px; display:flex; flex-direction:column; padding:12px; gap:12px; overflow-y:auto; flex-shrink:0;">
        
        <!-- Camera & Sensor Trigger -->
        <div>
          <label style="font-size:0.72rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.05em; display:block; margin-bottom:5px;">
            1. Tracking Sensor
          </label>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
            <button id="btn-toggle-cam" class="btn-mocap" style="background:var(--accent-cyan); color:#000;">
              Start Camera
            </button>
            <button id="btn-switch-cam" class="btn-mocap">
              Flip Camera
            </button>
          </div>
        </div>

        <!-- Unity & Unreal Stream Bridge -->
        <div>
          <label style="font-size:0.72rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.05em; display:block; margin-bottom:5px;">
            2. Game Engine Streaming (Unity / Unreal)
          </label>
          <div style="display:flex; flex-direction:column; gap:6px;">
            <input id="relay-url" type="text" value="ws://localhost:8080" placeholder="ws://[YOUR_PC_IP]:8080"
                   style="width:100%; background:rgba(0,0,0,0.5); border:1px solid var(--border-subtle); color:#fff; padding:6px 8px; border-radius:6px; font-family:var(--font-mono); font-size:0.75rem;"/>
            <button id="btn-toggle-stream" class="btn-mocap">
              Connect to Unity/Unreal
            </button>
          </div>
        </div>

        <!-- Take Recording & BVH / JSON Export -->
        <div>
          <label style="font-size:0.72rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.05em; display:block; margin-bottom:5px;">
            3. Animation Takes
          </label>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
            <button id="btn-record" class="btn-mocap btn-record">
              🔴 Record Take
            </button>
            <button id="btn-export" class="btn-mocap" disabled>
              Export JSON
            </button>
          </div>
          <div id="record-timer" style="font-family:var(--font-mono); font-size:0.72rem; color:var(--accent-rose); text-align:center; margin-top:3px; display:none;">
            RECORDING: 00:00:00
          </div>
        </div>

        <!-- AI MoCap Director (OpenRouter) -->
        <div id="ai-section" style="flex:1; display:flex; flex-direction:column; border-top:1px solid var(--border-subtle); padding-top:10px; min-height:160px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <label style="font-size:0.72rem; font-weight:700; color:var(--accent-cyan); text-transform:uppercase; letter-spacing:0.05em;">
              AI Animation Director
            </label>
            <span style="font-size:0.6rem; color:var(--text-muted); font-family:var(--font-mono);">Qwen 2.5 72B</span>
          </div>
          
          <div id="ai-chat-history" style="flex:1; min-height:90px; max-height:180px; background:rgba(0,0,0,0.35); border-radius:6px; padding:6px; overflow-y:auto; font-size:0.72rem; line-height:1.35; display:flex; flex-direction:column; gap:5px;">
            <div style="color:var(--text-muted);">
              <strong>Director AI:</strong> Ready. I can analyze posture, check T-pose calibration, recommend smoothing parameters, and guide Unity C# bone setup.
            </div>
          </div>

          <div style="display:flex; gap:5px; margin-top:6px;">
            <input id="ai-input" type="text" placeholder="Ask AI Director..." 
                   style="flex:1; background:rgba(0,0,0,0.5); border:1px solid var(--border-subtle); color:#fff; padding:5px 8px; border-radius:6px; font-size:0.72rem;"/>
            <button id="btn-ask-ai" class="btn-mocap" style="padding:5px 10px; font-size:0.72rem;">
              Send
            </button>
          </div>
        </div>

      </aside>
    </main>
  </div>
`;

// Initialize Subsystems
const rigContainer = document.getElementById('rig-canvas-container');
const visualizer = new MoCapRigVisualizer(rigContainer);
const recorder = new MoCapRecorder();
const filterBank = new LandmarkFilterBank();
const aiDirector = new OpenRouterMoCapAI(OPENROUTER_KEY, AI_MODEL);

// Elements
const videoElement = document.getElementById('webcam');
const btnToggleCam = document.getElementById('btn-toggle-cam');
const btnSwitchCam = document.getElementById('btn-switch-cam');
const btnQuickCam = document.getElementById('btn-quick-cam');
const btnQuickFlip = document.getElementById('btn-quick-flip');
const btnToggleStream = document.getElementById('btn-toggle-stream');
const btnRecord = document.getElementById('btn-record');
const btnExport = document.getElementById('btn-export');
const recordTimer = document.getElementById('record-timer');
const relayUrlInput = document.getElementById('relay-url');
const camDot = document.getElementById('cam-dot');
const camStatusText = document.getElementById('cam-status-text');
const streamDot = document.getElementById('stream-dot');
const streamStatusText = document.getElementById('stream-status-text');
const fpsCounter = document.getElementById('fps-counter');
const boneCount = document.getElementById('bone-count');
const aiChatHistory = document.getElementById('ai-chat-history');
const aiInput = document.getElementById('ai-input');
const btnAskAi = document.getElementById('btn-ask-ai');

// Pane and Tab elements for Mobile
const viewportPane = document.getElementById('viewport-pane');
const controlsPane = document.getElementById('controls-pane');
const tabBtnViewport = document.getElementById('tab-btn-viewport');
const tabBtnControls = document.getElementById('tab-btn-controls');
const tabBtnAi = document.getElementById('tab-btn-ai');
const aiSection = document.getElementById('ai-section');

// Mobile Tab Controller
function isMobileView() {
  return window.innerWidth <= 768;
}

function updateMobileTabs(activeTab) {
  if (!isMobileView()) {
    viewportPane.style.display = 'flex';
    controlsPane.style.display = 'flex';
    controlsPane.style.width = '340px';
    aiSection.style.display = 'flex';
    return;
  }

  [tabBtnViewport, tabBtnControls, tabBtnAi].forEach(btn => btn.classList.remove('active'));

  if (activeTab === 'viewport') {
    tabBtnViewport.classList.add('active');
    viewportPane.style.display = 'flex';
    controlsPane.style.display = 'none';
    visualizer.onResize();
  } else if (activeTab === 'controls') {
    tabBtnControls.classList.add('active');
    viewportPane.style.display = 'none';
    controlsPane.style.display = 'flex';
    controlsPane.style.width = '100%';
    aiSection.style.display = 'none';
  } else if (activeTab === 'ai') {
    tabBtnAi.classList.add('active');
    viewportPane.style.display = 'none';
    controlsPane.style.display = 'flex';
    controlsPane.style.width = '100%';
    aiSection.style.display = 'flex';
  }
}

tabBtnViewport.addEventListener('click', () => updateMobileTabs('viewport'));
tabBtnControls.addEventListener('click', () => updateMobileTabs('controls'));
tabBtnAi.addEventListener('click', () => updateMobileTabs('ai'));
window.addEventListener('resize', () => {
  if (!isMobileView()) {
    viewportPane.style.display = 'flex';
    controlsPane.style.display = 'flex';
    controlsPane.style.width = '340px';
    aiSection.style.display = 'flex';
  } else {
    updateMobileTabs('viewport');
  }
  visualizer.onResize();
});

let isCameraRunning = false;
let currentFacingMode = 'user';
let poseDetector = null;
let wsClient = null;
let frameCount = 0;
let lastFpsTime = performance.now();
let framesInSec = 0;
let recordInterval = null;

// Initialize MediaPipe Pose Tracker
function initPoseDetector() {
  if (!window.Pose) {
    console.error('MediaPipe Pose script not loaded yet.');
    return;
  }

  poseDetector = new window.Pose({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
  });

  poseDetector.setOptions({
    modelComplexity: 1, // 1 is optimal for mobile/browser real-time 60fps
    smoothLandmarks: true,
    enableSegmentation: false,
    smoothSegmentation: false,
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.6
  });

  poseDetector.onResults(onPoseResults);
}

// Landmark Processing & Bone Calculation Loop
function onPoseResults(results) {
  framesInSec++;
  const now = performance.now();
  if (now - lastFpsTime >= 1000) {
    fpsCounter.innerText = framesInSec;
    framesInSec = 0;
    lastFpsTime = now;
  }

  const rawLandmarks = results.worldLandmarks || results.poseLandmarks;

  if (rawLandmarks && rawLandmarks.length >= 33) {
    const worldLandmarks = filterBank.filterLandmarks(rawLandmarks, now);
    boneCount.innerText = worldLandmarks.length;
    visualizer.updatePose(worldLandmarks);

    // Compute Bone Orientation Quaternions for Unity HumanBodyBones
    const boneRotations = computeBoneRotations(worldLandmarks);

    // If recording take
    if (recorder.isRecording) {
      recorder.recordFrame(worldLandmarks, boneRotations);
    }

    // Broadcast packet via WebSocket to Unity & Unreal Engine
    if (wsClient && wsClient.readyState === WebSocket.OPEN) {
      const packet = {
        type: 'mocap_frame',
        timestamp: Date.now(),
        frame: frameCount++,
        rootPos: {
          x: (worldLandmarks[23].x + worldLandmarks[24].x) * 0.5,
          y: -(worldLandmarks[23].y + worldLandmarks[24].y) * 0.5,
          z: -(worldLandmarks[23].z + worldLandmarks[24].z) * 0.5,
        },
        landmarks: worldLandmarks.map((lm, idx) => ({
          name: `lm_${idx}`,
          pos: { x: lm.x, y: -lm.y, z: -lm.z },
          visibility: lm.visibility || 1.0
        })),
        bones: boneRotations
      };

      wsClient.send(JSON.stringify(packet));
    }
  } else {
    boneCount.innerText = '0';
    visualizer.updatePose(null);
  }
}

// Camera Control
async function startCamera() {
  if (!poseDetector) initPoseDetector();

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: currentFacingMode,
        width: { ideal: 640 },
        height: { ideal: 480 }
      },
      audio: false
    });

    videoElement.srcObject = stream;
    await videoElement.play();

    isCameraRunning = true;
    camDot.className = 'dot-indicator dot-green';
    camStatusText.innerText = 'LIVE';
    
    btnToggleCam.innerText = 'Stop Camera';
    btnToggleCam.style.background = 'var(--accent-rose)';
    btnQuickCam.innerText = 'Stop Cam';
    btnQuickCam.style.background = 'var(--accent-rose)';

    // Frame processing tick
    async function processFrame() {
      if (!isCameraRunning) return;
      if (videoElement.readyState >= 2) {
        await poseDetector.send({ image: videoElement });
      }
      requestAnimationFrame(processFrame);
    }
    requestAnimationFrame(processFrame);
  } catch (err) {
    alert('Camera access denied or failed: ' + err.message);
    console.error(err);
  }
}

function stopCamera() {
  isCameraRunning = false;
  if (videoElement.srcObject) {
    videoElement.srcObject.getTracks().forEach(track => track.stop());
    videoElement.srcObject = null;
  }
  camDot.className = 'dot-indicator dot-yellow';
  camStatusText.innerText = 'OFF';
  
  btnToggleCam.innerText = 'Start Camera';
  btnToggleCam.style.background = 'var(--accent-cyan)';
  btnQuickCam.innerText = 'Start Cam';
  btnQuickCam.style.background = 'var(--accent-cyan)';
}

function toggleCam() {
  if (isCameraRunning) stopCamera();
  else startCamera();
}

btnToggleCam.addEventListener('click', toggleCam);
btnQuickCam.addEventListener('click', toggleCam);

async function flipCam() {
  currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
  if (isCameraRunning) {
    stopCamera();
    await startCamera();
  }
}

btnSwitchCam.addEventListener('click', flipCam);
btnQuickFlip.addEventListener('click', flipCam);

// WebSocket Stream connection to Unity / Unreal relay server
function connectStream() {
  const url = relayUrlInput.value.trim();
  if (!url) return;

  streamStatusText.innerText = 'CONNECTING...';
  streamDot.className = 'dot-indicator dot-yellow';

  try {
    wsClient = new WebSocket(url);

    wsClient.onopen = () => {
      streamDot.className = 'dot-indicator dot-green';
      streamStatusText.innerText = 'LIVE';
      btnToggleStream.innerText = 'Disconnect Stream';
      btnToggleStream.style.borderColor = 'var(--accent-emerald)';
    };

    wsClient.onclose = () => {
      streamDot.className = 'dot-indicator dot-red';
      streamStatusText.innerText = 'DISCONNECTED';
      btnToggleStream.innerText = 'Connect to Unity/Unreal';
      btnToggleStream.style.borderColor = 'var(--border-subtle)';
      wsClient = null;
    };

    wsClient.onerror = () => {
      streamDot.className = 'dot-indicator dot-red';
      streamStatusText.innerText = 'ERR';
    };
  } catch (err) {
    alert('Invalid WebSocket URL: ' + err.message);
  }
}

function disconnectStream() {
  if (wsClient) {
    wsClient.close();
    wsClient = null;
  }
}

btnToggleStream.addEventListener('click', () => {
  if (wsClient && wsClient.readyState === WebSocket.OPEN) {
    disconnectStream();
  } else {
    connectStream();
  }
});

// Recording Take Control
btnRecord.addEventListener('click', () => {
  if (!recorder.isRecording) {
    recorder.start();
    btnRecord.classList.add('recording');
    btnRecord.innerText = '⏹ Stop Take';
    btnExport.disabled = true;
    recordTimer.style.display = 'block';

    const start = Date.now();
    recordInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - start) / 1000);
      const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
      const s = String(elapsed % 60).padStart(2, '0');
      recordTimer.innerText = `RECORDING: 00:${m}:${s}`;
    }, 500);
  } else {
    const frames = recorder.stop();
    btnRecord.classList.remove('recording');
    btnRecord.innerText = '🔴 Record Take';
    btnExport.disabled = frames.length === 0;
    clearInterval(recordInterval);
    recordTimer.style.display = 'none';
    alert(`Take recorded! Total frames: ${frames.length}. Click 'Export JSON' to save.`);
  }
});

btnExport.addEventListener('click', () => {
  recorder.exportJson(`mocap_take_${Date.now()}.json`);
});

// AI Director Chat
async function sendToAiDirector() {
  const query = aiInput.value.trim();
  if (!query) return;

  const userMsg = document.createElement('div');
  userMsg.innerHTML = `<strong>You:</strong> ${query}`;
  userMsg.style.color = '#fff';
  aiChatHistory.appendChild(userMsg);
  aiInput.value = '';

  const aiMsg = document.createElement('div');
  aiMsg.innerHTML = `<em>Director is analyzing...</em>`;
  aiMsg.style.color = 'var(--accent-cyan)';
  aiChatHistory.appendChild(aiMsg);
  aiChatHistory.scrollTop = aiChatHistory.scrollHeight;

  const response = await aiDirector.askDirector(query, {
    frames: frameCount,
    fps: framesInSec,
    boneCount: boneCount.innerText
  });

  aiMsg.innerHTML = `<strong>Director:</strong> ${response}`;
  aiMsg.style.color = 'var(--text-main)';
  aiChatHistory.scrollTop = aiChatHistory.scrollHeight;
}

btnAskAi.addEventListener('click', sendToAiDirector);
aiInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendToAiDirector();
});

// Auto-initialize pose detector when page is ready
window.addEventListener('load', () => {
  initPoseDetector();
  if (isMobileView()) {
    updateMobileTabs('viewport');
  }
});
