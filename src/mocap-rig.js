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

    // Joint Geometries
    const bodyJointGeo = new THREE.SphereGeometry(0.028, 16, 16);
    const handJointGeo = new THREE.SphereGeometry(0.012, 12, 12);
    const faceJointGeo = new THREE.SphereGeometry(0.007, 8, 8);

    // Color materials for distinct anatomy zones
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff, // Neon Cyan for Pose Body
      emissive: 0x005577,
      roughness: 0.2,
      metalness: 0.8
    });

    const leftHandMat = new THREE.MeshStandardMaterial({
      color: 0x00f59b, // Neon Emerald Green for Left Hand
      emissive: 0x005533,
      roughness: 0.2,
      metalness: 0.8
    });

    const rightHandMat = new THREE.MeshStandardMaterial({
      color: 0xffaa00, // Amber Gold for Right Hand
      emissive: 0x553300,
      roughness: 0.2,
      metalness: 0.8
    });

    const faceMat = new THREE.MeshStandardMaterial({
      color: 0x7928ca, // Holographic Purple for Face Mesh
      emissive: 0x331166,
      roughness: 0.3,
      metalness: 0.7
    });

    const boneMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x223344,
      roughness: 0.3,
      metalness: 0.7
    });

    // Create 543 joint nodes (33 body + 21 left hand + 21 right hand + 468 face mesh)
    for (let i = 0; i < 543; i++) {
      let mesh;
      if (i < 33) {
        mesh = new THREE.Mesh(bodyJointGeo, bodyMat.clone());
      } else if (i < 54) {
        mesh = new THREE.Mesh(handJointGeo, leftHandMat.clone());
      } else if (i < 75) {
        mesh = new THREE.Mesh(handJointGeo, rightHandMat.clone());
      } else {
        mesh = new THREE.Mesh(faceJointGeo, faceMat.clone());
      }
      mesh.visible = false;
      this.scene.add(mesh);
      this.joints.push(mesh);
    }

    // Predefined bone connections for Body, Left Hand, and Right Hand
    this.connections = [
      // Face / Head outline (Body landmarks)
      [0, 1], [1, 2], [2, 3], [3, 7],
      [0, 4], [4, 5], [5, 6], [6, 8],
      [9, 10],
      // Torso / Spine
      [11, 12], // Shoulders
      [11, 23], [12, 24], // Shoulders to hips
      [23, 24], // Hips base
      // Left Arm
      [11, 13], [13, 15],
      // Right Arm
      [12, 14], [14, 16],
      // Left Leg
      [23, 25], [25, 27], [27, 29], [27, 31],
      // Right Leg
      [24, 26], [26, 28], [28, 30], [28, 32]
    ];

    // Left Hand Bones (Indices 33 to 53 -> offsets 0..20)
    const lhBase = 33;
    // Wrist to arm connection
    this.connections.push([15, lhBase]); // Wrist to Hand base
    const handChains = [
      [0, 1], [1, 2], [2, 3], [3, 4],       // Thumb
      [0, 5], [5, 6], [6, 7], [7, 8],       // Index
      [0, 9], [9, 10], [10, 11], [11, 12],  // Middle
      [0, 13], [13, 14], [14, 15], [15, 16],// Ring
      [0, 17], [17, 18], [18, 19], [19, 20],// Pinky
      [5, 9], [9, 13], [13, 17]             // Palm base
    ];

    handChains.forEach(([s, e]) => {
      this.connections.push([lhBase + s, lhBase + e]);
    });

    // Right Hand Bones (Indices 54 to 74 -> offsets 0..20)
    const rhBase = 54;
    this.connections.push([16, rhBase]); // Right wrist to Right Hand base
    handChains.forEach(([s, e]) => {
      this.connections.push([rhBase + s, rhBase + e]);
    });

    const cylinderGeo = new THREE.CylinderGeometry(0.014, 0.014, 1, 8);
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

  updatePose(worldLandmarks, isMirrored = false) {
    if (!worldLandmarks || worldLandmarks.length === 0) {
      this.joints.forEach(j => j.visible = false);
      this.bones.forEach(b => b.visible = false);
      return;
    }

    // MediaPipe 3D coordinates: X right, Y down, Z forward
    // In Natural Real-World Mode (isMirrored = false): Invert X so raising your right hand raises avatar's right hand.
    const scale = 1.35;
    const yOffset = 0.2;

    const positions = worldLandmarks.map(lm => {
      const x = isMirrored ? -lm.x : lm.x;
      const z = lm.z !== undefined ? lm.z : 0;
      return new THREE.Vector3(x * scale, -lm.y * scale + yOffset, -z * scale);
    });

    // Update Joints
    positions.forEach((pos, idx) => {
      if (idx < this.joints.length) {
        this.joints[idx].position.copy(pos);
        this.joints[idx].visible = true;
      }
    });

    // Hide unpopulated joints
    for (let i = positions.length; i < this.joints.length; i++) {
      this.joints[i].visible = false;
    }

    // Update Bone Connections
    this.connections.forEach(([startIdx, endIdx], i) => {
      if (i >= this.bones.length) return;
      const p1 = positions[startIdx];
      const p2 = positions[endIdx];
      const boneMesh = this.bones[i];

      if (p1 && p2 && startIdx < positions.length && endIdx < positions.length) {
        const distance = p1.distanceTo(p2);
        // Avoid connecting distant fallback points
        if (distance > 0.005 && distance < 1.8) {
          boneMesh.position.copy(p1);
          boneMesh.lookAt(p2);
          boneMesh.scale.set(1, 1, distance);
          boneMesh.visible = true;
          return;
        }
      }
      boneMesh.visible = false;
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
