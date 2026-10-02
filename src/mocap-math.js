import * as THREE from 'three';

// Low-pass exponential smoothing filter to eliminate web camera jitter
export class OneEuroFilter {
  constructor(minCutoff = 1.2, beta = 0.005, dcutoff = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dcutoff = dcutoff;
    this.xPrev = null;
    this.dxPrev = null;
    this.tPrev = null;
  }

  filter(val, timestamp) {
    if (this.xPrev === null || Number.isNaN(this.xPrev)) {
      this.xPrev = val;
      this.dxPrev = 0;
      this.tPrev = timestamp;
      return val;
    }

    const dt = Math.max((timestamp - this.tPrev) / 1000.0, 1e-4);
    this.tPrev = timestamp;

    const dx = (val - this.xPrev) / dt;
    const edx = this.alpha(dt, this.dcutoff);
    const dxHat = edx * dx + (1 - edx) * this.dxPrev;
    this.dxPrev = dxHat;

    const cutoff = this.minCutoff + this.beta * Math.abs(dxHat);
    const a = this.alpha(dt, cutoff);
    const xHat = a * val + (1 - a) * this.xPrev;
    this.xPrev = xHat;

    return xHat;
  }

  alpha(dt, cutoff) {
    const tau = 1.0 / (2 * Math.PI * cutoff);
    return 1.0 / (1.0 + tau / dt);
  }

  reset() {
    this.xPrev = null;
    this.dxPrev = null;
    this.tPrev = null;
  }
}

// Dynamic Landmark Filter Bank (supports 33 body + 468 face + 42 hands = 543+ joints)
export class LandmarkFilterBank {
  constructor(initialCount = 543) {
    this.filters = [];
    this.ensureSize(initialCount);
  }

  ensureSize(count) {
    while (this.filters.length < count) {
      this.filters.push({
        x: new OneEuroFilter(1.2, 0.006),
        y: new OneEuroFilter(1.2, 0.006),
        z: new OneEuroFilter(1.2, 0.006)
      });
    }
  }

  filterLandmarks(landmarks, timestamp) {
    if (!landmarks || landmarks.length === 0) return landmarks;
    this.ensureSize(landmarks.length);
    return landmarks.map((lm, idx) => {
      const f = this.filters[idx];
      return {
        x: f.x.filter(lm.x, timestamp),
        y: f.y.filter(lm.y, timestamp),
        z: f.z.filter(lm.z !== undefined ? lm.z : 0, timestamp),
        visibility: lm.visibility !== undefined ? lm.visibility : 1.0
      };
    });
  }

  reset() {
    this.filters.forEach(f => {
      f.x.reset();
      f.y.reset();
      f.z.reset();
    });
  }
}

// Robust Humanoid Bone Orientation Solver (Relative joint space)
export function computeBoneRotations(landmarks, isMirrored = false) {
  if (!landmarks || landmarks.length < 33) return [];

  // MediaPipe coordinates: X right, Y down, Z forward.
  // Standard 3D: X right, Y up, Z towards viewer.
  // If isMirrored is false (Natural Real-World Mode): Invert X so your Right Arm is Avatar's Right Arm.
  const getVec = (idx) => {
    const lm = landmarks[idx];
    const xVal = isMirrored ? lm.x : -lm.x;
    return new THREE.Vector3(xVal, -lm.y, -lm.z);
  };

  const bones = [];

  // Helper to compute rotation from standard rest vector to target direction
  const computeRot = (fromVec, targetVec) => {
    const fromNorm = fromVec.clone().normalize();
    const toNorm = targetVec.clone().normalize();
    if (fromNorm.lengthSq() === 0 || toNorm.lengthSq() === 0) {
      return new THREE.Quaternion();
    }
    return new THREE.Quaternion().setFromUnitVectors(fromNorm, toNorm);
  };

  // 1. Pelvis / Hips & Spine
  const leftHip = getVec(23);
  const rightHip = getVec(24);
  const leftShoulder = getVec(11);
  const rightShoulder = getVec(12);

  const hipsCenter = new THREE.Vector3().addVectors(leftHip, rightHip).multiplyScalar(0.5);
  const shoulderCenter = new THREE.Vector3().addVectors(leftShoulder, rightShoulder).multiplyScalar(0.5);
  const spineDir = new THREE.Vector3().subVectors(shoulderCenter, hipsCenter);

  // Rest pose for spine: along +Y axis
  const spineRot = computeRot(new THREE.Vector3(0, 1, 0), spineDir);
  bones.push({
    bone: 'Spine',
    rot: { x: spineRot.x, y: spineRot.y, z: spineRot.z, w: spineRot.w }
  });

  // 2. Chest / Neck
  const nose = getVec(0);
  const neckDir = new THREE.Vector3().subVectors(nose, shoulderCenter);
  const neckRot = computeRot(new THREE.Vector3(0, 1, 0), neckDir);
  bones.push({
    bone: 'Neck',
    rot: { x: neckRot.x, y: neckRot.y, z: neckRot.z, w: neckRot.w }
  });

  // 3. Left Arm (Unity T-pose: Left arm points along -X axis)
  const leftElbow = getVec(13);
  const leftWrist = getVec(15);
  const leftUpperArmDir = new THREE.Vector3().subVectors(leftElbow, leftShoulder);
  const leftUpperArmRot = computeRot(new THREE.Vector3(-1, 0, 0), leftUpperArmDir);
  bones.push({
    bone: 'LeftUpperArm',
    rot: { x: leftUpperArmRot.x, y: leftUpperArmRot.y, z: leftUpperArmRot.z, w: leftUpperArmRot.w }
  });

  const leftLowerArmDir = new THREE.Vector3().subVectors(leftWrist, leftElbow);
  const leftLowerArmRot = computeRot(new THREE.Vector3(-1, 0, 0), leftLowerArmDir);
  bones.push({
    bone: 'LeftLowerArm',
    rot: { x: leftLowerArmRot.x, y: leftLowerArmRot.y, z: leftLowerArmRot.z, w: leftLowerArmRot.w }
  });

  // 4. Right Arm (Unity T-pose: Right arm points along +X axis)
  const rightElbow = getVec(14);
  const rightWrist = getVec(16);
  const rightUpperArmDir = new THREE.Vector3().subVectors(rightElbow, rightShoulder);
  const rightUpperArmRot = computeRot(new THREE.Vector3(1, 0, 0), rightUpperArmDir);
  bones.push({
    bone: 'RightUpperArm',
    rot: { x: rightUpperArmRot.x, y: rightUpperArmRot.y, z: rightUpperArmRot.z, w: rightUpperArmRot.w }
  });

  const rightLowerArmDir = new THREE.Vector3().subVectors(rightWrist, rightElbow);
  const rightLowerArmRot = computeRot(new THREE.Vector3(1, 0, 0), rightLowerArmDir);
  bones.push({
    bone: 'RightLowerArm',
    rot: { x: rightLowerArmRot.x, y: rightLowerArmRot.y, z: rightLowerArmRot.z, w: rightLowerArmRot.w }
  });

  // 5. Left Leg (Unity T-pose: Legs point downwards along -Y axis)
  const leftKnee = getVec(25);
  const leftAnkle = getVec(27);
  const leftUpperLegDir = new THREE.Vector3().subVectors(leftKnee, leftHip);
  const leftUpperLegRot = computeRot(new THREE.Vector3(0, -1, 0), leftUpperLegDir);
  bones.push({
    bone: 'LeftUpperLeg',
    rot: { x: leftUpperLegRot.x, y: leftUpperLegRot.y, z: leftUpperLegRot.z, w: leftUpperLegRot.w }
  });

  const leftLowerLegDir = new THREE.Vector3().subVectors(leftAnkle, leftKnee);
  const leftLowerLegRot = computeRot(new THREE.Vector3(0, -1, 0), leftLowerLegDir);
  bones.push({
    bone: 'LeftLowerLeg',
    rot: { x: leftLowerLegRot.x, y: leftLowerLegRot.y, z: leftLowerLegRot.z, w: leftLowerLegRot.w }
  });

  // 6. Right Leg (Unity T-pose: along -Y axis)
  const rightKnee = getVec(26);
  const rightAnkle = getVec(28);
  const rightUpperLegDir = new THREE.Vector3().subVectors(rightKnee, rightHip);
  const rightUpperLegRot = computeRot(new THREE.Vector3(0, -1, 0), rightUpperLegDir);
  bones.push({
    bone: 'RightUpperLeg',
    rot: { x: rightUpperLegRot.x, y: rightUpperLegRot.y, z: rightUpperLegRot.z, w: rightUpperLegRot.w }
  });

  const rightLowerLegDir = new THREE.Vector3().subVectors(rightAnkle, rightKnee);
  const rightLowerLegRot = computeRot(new THREE.Vector3(0, -1, 0), rightLowerLegDir);
  bones.push({
    bone: 'RightLowerLeg',
    rot: { x: rightLowerLegRot.x, y: rightLowerLegRot.y, z: rightLowerLegRot.z, w: rightLowerLegRot.w }
  });

  return bones;
}

// Animation Take Exporter
export class MoCapRecorder {
  constructor() {
    this.isRecording = false;
    this.recordedFrames = [];
    this.startTime = 0;
  }

  start() {
    this.isRecording = true;
    this.recordedFrames = [];
    this.startTime = Date.now();
  }

  recordFrame(landmarks, bones) {
    if (!this.isRecording || !landmarks) return;
    this.recordedFrames.push({
      time: (Date.now() - this.startTime) / 1000,
      landmarks: landmarks.map(lm => ({ x: lm.x, y: lm.y, z: lm.z })),
      bones: bones
    });
  }

  stop() {
    this.isRecording = false;
    return this.recordedFrames;
  }

  exportJson(filename = 'take_animation.json') {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(this.recordedFrames, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', filename);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }
}
