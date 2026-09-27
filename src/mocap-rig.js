import * as THREE from 'three';

export class MoCapRigVisualizer {
  constructor(container) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0c10);
    this.scene.fog = new THREE.FogExp2(0x0a0c10, 0.08);

    this.camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    this.camera.position.set(0, 1.2, 3.2);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(this.renderer.domElement);

    this.setupLighting();
    this.setupEnvironment();
    this.setupSkeletonRig();
    this.setupControls();

    window.addEventListener('resize', this.onResize.bind(this));
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  setupLighting() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x00f0ff, 1.8);
    dirLight.position.set(3, 5, 4);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    this.scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0x7928ca, 1.2);
    fillLight.position.set(-3, 2, -2);
    this.scene.add(fillLight);
  }

  setupEnvironment() {
    // High-tech holographic grid
    const gridHelper = new THREE.GridHelper(10, 20, 0x00f0ff, 0x1f293d);
    gridHelper.position.y = -1.0;
    this.scene.add(gridHelper);

    // Floor reflective circular ring
    const ringGeo = new THREE.RingGeometry(0.8, 1.0, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, side: THREE.DoubleSide, transparent: true, opacity: 0.3 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.99;
    this.scene.add(ring);
  }

  setupSkeletonRig() {
    this.joints = [];
    this.bones = [];

    // Sphere geometry for joints
    const jointGeo = new THREE.SphereGeometry(0.035, 16, 16);
    const jointMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x005577,
      roughness: 0.2,
      metalness: 0.8
    });

    const boneMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x223344,
      roughness: 0.3,
      metalness: 0.7
    });

    // 33 MediaPipe landmark nodes
    for (let i = 0; i < 33; i++) {
      const mesh = new THREE.Mesh(jointGeo, jointMat.clone());
      mesh.visible = false;
      this.scene.add(mesh);
      this.joints.push(mesh);
    }

    // Predefined humanoid bone connections (pairs of indices)
    this.connections = [
      // Face / Head
      [0, 1], [1, 2], [2, 3], [3, 7],
      [0, 4], [4, 5], [5, 6], [6, 8],
      [9, 10],
      // Torso / Spine
      [11, 12], // Shoulders
      [11, 23], [12, 24], // Shoulders to hips
      [23, 24], // Hips base
      // Left Arm
      [11, 13], [13, 15], [15, 17], [15, 19], [15, 21],
      // Right Arm
      [12, 14], [14, 16], [16, 18], [16, 20], [16, 22],
      // Left Leg
      [23, 25], [25, 27], [27, 29], [27, 31],
      // Right Leg
      [24, 26], [26, 28], [28, 30], [28, 32]
    ];

    const cylinderGeo = new THREE.CylinderGeometry(0.018, 0.018, 1, 8);
    cylinderGeo.translate(0, 0.5, 0);
    cylinderGeo.rotateX(Math.PI / 2);

    this.connections.forEach(() => {
      const boneMesh = new THREE.Mesh(cylinderGeo, boneMat.clone());
      boneMesh.visible = false;
      this.scene.add(boneMesh);
      this.bones.push(boneMesh);
    });
  }

  setupControls() {
    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;
    let currentOrbitAngle = 0;
    let currentHeight = 1.2;
    let cameraDistance = 3.2;

    const dom = this.renderer.domElement;

    const onPointerDown = (e) => {
      isDragging = true;
      prevMouseX = e.clientX || (e.touches && e.touches[0].clientX);
      prevMouseY = e.clientY || (e.touches && e.touches[0].clientY);
    };

    const onPointerMove = (e) => {
      if (!isDragging) return;
      const x = e.clientX || (e.touches && e.touches[0].clientX);
      const y = e.clientY || (e.touches && e.touches[0].clientY);
      const deltaX = x - prevMouseX;
      const deltaY = y - prevMouseY;
      prevMouseX = x;
      prevMouseY = y;

      currentOrbitAngle += deltaX * 0.01;
      currentHeight = Math.max(-0.5, Math.min(3.0, currentHeight - deltaY * 0.008));

      this.camera.position.x = Math.sin(currentOrbitAngle) * cameraDistance;
      this.camera.position.z = Math.cos(currentOrbitAngle) * cameraDistance;
      this.camera.position.y = currentHeight;
      this.camera.lookAt(0, 0.3, 0);
    };

    const onPointerUp = () => { isDragging = false; };

    dom.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);

    dom.addEventListener('touchstart', onPointerDown, { passive: true });
    window.addEventListener('touchmove', onPointerMove, { passive: true });
    window.addEventListener('touchend', onPointerUp);

    dom.addEventListener('wheel', (e) => {
      cameraDistance = Math.max(1.2, Math.min(8.0, cameraDistance + e.deltaY * 0.002));
      this.camera.position.x = Math.sin(currentOrbitAngle) * cameraDistance;
      this.camera.position.z = Math.cos(currentOrbitAngle) * cameraDistance;
      this.camera.lookAt(0, 0.3, 0);
    });
  }

  updatePose(worldLandmarks) {
    if (!worldLandmarks || worldLandmarks.length === 0) {
      this.joints.forEach(j => j.visible = false);
      this.bones.forEach(b => b.visible = false);
      return;
    }

    // MediaPipe 3D coordinates: X right, Y down, Z forward
    // Invert Y and adjust scaling for high-precision real-world game rig alignment
    const scale = 1.35;
    const yOffset = 0.2;

    const positions = worldLandmarks.map(lm => {
      return new THREE.Vector3(-lm.x * scale, -lm.y * scale + yOffset, -lm.z * scale);
    });

    // Update Joints
    positions.forEach((pos, idx) => {
      if (idx < this.joints.length) {
        this.joints[idx].position.copy(pos);
        this.joints[idx].visible = true;
      }
    });

    // Update Bone Connections
    this.connections.forEach(([startIdx, endIdx], i) => {
      const p1 = positions[startIdx];
      const p2 = positions[endIdx];
      const boneMesh = this.bones[i];

      if (p1 && p2) {
        const distance = p1.distanceTo(p2);
        boneMesh.position.copy(p1);
        boneMesh.lookAt(p2);
        boneMesh.scale.set(1, 1, distance);
        boneMesh.visible = true;
      }
    });
  }

  onResize() {
    if (!this.container) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  animate() {
    requestAnimationFrame(this.animate);
    this.renderer.render(this.scene, this.camera);
  }
}
