import * as THREE from 'three';

// Low-pass exponential smoothing filter to eliminate web camera jitter
export class OneEuroFilter {
  constructor(minCutoff = 1.0, beta = 0.007, dcutoff = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dcutoff = dcutoff;
    this.xPrev = null;
    this.dxPrev = null;
    this.tPrev = null;
  }

  filter(val, timestamp) {
    if (this.xPrev === null) {
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
}

// Compute bone rotation quaternions from parent-child joint 3D vectors
export function computeBoneRotations(landmarks) {
  if (!landmarks || landmarks.length < 33) return [];

  const getVec = (idx) => new THREE.Vector3(landmarks[idx].x, landmarks[idx].y, landmarks[idx].z);

  const bones = [];

  // Definition of key humanoid bones mapped to Unity HumanBodyBones:
  // Hips/Spine: (Left Hip + Right Hip) / 2 to (Left Shoulder + Right Shoulder) / 2
  const leftHip = getVec(23);
  const rightHip = getVec(24);
  const leftShoulder = getVec(11);
  const rightShoulder = getVec(12);

  const hipsCenter = new THREE.Vector3().addVectors(leftHip, rightHip).multiplyScalar(0.5);
  const shoulderCenter = new THREE.Vector3().addVectors(leftShoulder, rightShoulder).multiplyScalar(0.5);
  const spineDir = new THREE.Vector3().subVectors(shoulderCenter, hipsCenter).normalize();
  const spineRot = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), spineDir);

  bones.push({
    bone: 'Spine',
    rot: { x: spineRot.x, y: spineRot.y, z: spineRot.z, w: spineRot.w }
  });

  // Left Upper Arm (Shoulder -> Elbow)
  const leftElbow = getVec(13);
  const leftUpperArmDir = new THREE.Vector3().subVectors(leftElbow, leftShoulder).normalize();
  const leftUpperArmRot = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(-1, 0, 0), leftUpperArmDir);
  bones.push({
    bone: 'LeftUpperArm',
    rot: { x: leftUpperArmRot.x, y: leftUpperArmRot.y, z: leftUpperArmRot.z, w: leftUpperArmRot.w }
  });

  // Left Lower Arm (Elbow -> Wrist)
  const leftWrist = getVec(15);
  const leftLowerArmDir = new THREE.Vector3().subVectors(leftWrist, leftElbow).normalize();
  const leftLowerArmRot = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(-1, 0, 0), leftLowerArmDir);
  bones.push({
    bone: 'LeftLowerArm',
    rot: { x: leftLowerArmRot.x, y: leftLowerArmRot.y, z: leftLowerArmRot.z, w: leftLowerArmRot.w }
  });

  // Right Upper Arm (Shoulder -> Elbow)
  const rightElbow = getVec(14);
  const rightUpperArmDir = new THREE.Vector3().subVectors(rightElbow, rightShoulder).normalize();
  const rightUpperArmRot = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), rightUpperArmDir);
  bones.push({
    bone: 'RightUpperArm',
    rot: { x: rightUpperArmRot.x, y: rightUpperArmRot.y, z: rightUpperArmRot.z, w: rightUpperArmRot.w }
  });

  // Right Lower Arm (Elbow -> Wrist)
  const rightWrist = getVec(16);
  const rightLowerArmDir = new THREE.Vector3().subVectors(rightWrist, rightElbow).normalize();
  const rightLowerArmRot = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), rightLowerArmDir);
  bones.push({
    bone: 'RightLowerArm',
    rot: { x: rightLowerArmRot.x, y: rightLowerArmRot.y, z: rightLowerArmRot.z, w: rightLowerArmRot.w }
  });

  // Left Upper Leg (Hip -> Knee)
  const leftKnee = getVec(25);
  const leftUpperLegDir = new THREE.Vector3().subVectors(leftKnee, leftHip).normalize();
  const leftUpperLegRot = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), leftUpperLegDir);
  bones.push({
    bone: 'LeftUpperLeg',
    rot: { x: leftUpperLegRot.x, y: leftUpperLegRot.y, z: leftUpperLegRot.z, w: leftUpperLegRot.w }
  });

  // Left Lower Leg (Knee -> Ankle)
  const leftAnkle = getVec(27);
  const leftLowerLegDir = new THREE.Vector3().subVectors(leftAnkle, leftKnee).normalize();
  const leftLowerLegRot = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), leftLowerLegDir);
  bones.push({
    bone: 'LeftLowerLeg',
    rot: { x: leftLowerLegRot.x, y: leftLowerLegRot.y, z: leftLowerLegRot.z, w: leftLowerLegRot.w }
  });

  // Right Upper Leg (Hip -> Knee)
  const rightKnee = getVec(26);
  const rightUpperLegDir = new THREE.Vector3().subVectors(rightKnee, rightHip).normalize();
  const rightUpperLegRot = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), rightUpperLegDir);
  bones.push({
    bone: 'RightUpperLeg',
    rot: { x: rightUpperLegRot.x, y: rightUpperLegRot.y, z: rightUpperLegRot.z, w: rightUpperLegRot.w }
  });

  // Right Lower Leg (Knee -> Ankle)
  const rightAnkle = getVec(28);
  const rightLowerLegDir = new THREE.Vector3().subVectors(rightAnkle, rightKnee).normalize();
  const rightLowerLegRot = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), rightLowerLegDir);
  bones.push({
    bone: 'RightLowerLeg',
    rot: { x: rightLowerLegRot.x, y: rightLowerLegRot.y, z: rightLowerLegRot.z, w: rightLowerLegRot.w }
  });

  return bones;
}

// BVH & JSON Animation Take Exporter
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
