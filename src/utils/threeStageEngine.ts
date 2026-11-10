import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { StickmanScene } from '../types/stickman';
import {
  CinematicShotType,
  Stickman3DRigPose,
  WorldStageFrame3D,
  evaluateWorldStageFrame3D,
} from './cinematicShotDirector';

interface StickmanRig3DNodes {
  root: THREE.Group;
  pelvis: THREE.Group;
  torso: THREE.Group;
  headGroup: THREE.Group;
  jawMesh: THREE.Mesh;
  leftBrow: THREE.Mesh;
  rightBrow: THREE.Mesh;
  leftEye: THREE.Mesh;
  rightEye: THREE.Mesh;
  helmetGroup: THREE.Group;
  leftShoulder: THREE.Group;
  leftElbow: THREE.Group;
  rightShoulder: THREE.Group;
  rightElbow: THREE.Group;
  rifleGroup: THREE.Group;
  muzzleCone: THREE.Mesh;
  muzzleLight: THREE.PointLight;
  leftHip: THREE.Group;
  leftKnee: THREE.Group;
  leftAnkle: THREE.Group;
  rightHip: THREE.Group;
  rightKnee: THREE.Group;
  rightAnkle: THREE.Group;
  contactShadow: THREE.Mesh;
  bodyMat: THREE.MeshStandardMaterial;
}

interface Truck3DNodes {
  root: THREE.Group;
  chassis: THREE.Group;
  wheels: THREE.Group[];
  headlightGlowL: THREE.Mesh;
  headlightGlowR: THREE.Mesh;
}

interface Explosion3DNodes {
  root: THREE.Group;
  fireball: THREE.Mesh;
  shockwaveRing: THREE.Mesh;
  blastLight: THREE.PointLight;
  debrisMeshes: THREE.Mesh[];
  crateMeshes: THREE.Mesh[];
  smokePuffs: THREE.Mesh[];
}

class ThreeCinematicStageSingleton {
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  public isSoftwareGl = false;

  private heroNodes: StickmanRig3DNodes | null = null;
  private secondaryNodes: StickmanRig3DNodes | null = null;
  private truckNodes: Truck3DNodes | null = null;
  private explosionNodes: Explosion3DNodes | null = null;
  private sunLight: THREE.DirectionalLight | null = null;
  private hemiLight: THREE.HemisphereLight | null = null;

  // Pre-allocated math helpers (zero GC in render loop)
  private readonly _targetCamPos = new THREE.Vector3();
  private readonly _targetLookAt = new THREE.Vector3();
  private readonly _currentLookAt = new THREE.Vector3();
  private lastShotCutIndex = -1;
  private lastSceneId = '';

  private initIfNeeded(width: number, height: number) {
    if (typeof document === 'undefined') return;
    if (this.renderer && this.scene && this.camera) {
      if (
        this.renderer.domElement.width !== width ||
        this.renderer.domElement.height !== height
      ) {
        this.renderer.setSize(width, height, false);
        this.camera.aspect = width / Math.max(1, height);
        this.camera.updateProjectionMatrix();
      }
      return;
    }

    // Detect software WebGL from GPU renderer string
    this.isSoftwareGl = (() => {
      try {
        const probeCanvas = document.createElement('canvas');
        const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    const renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true, // Required for 2D canvas blit & MediaRecorder MP4 export
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.setPixelRatio(1);
    renderer.setSize(width, height, false);
    renderer.shadowMap.enabled = !this.isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x16202c);
    scene.fog = new THREE.FogExp2(0x1c2836, 0.016);

    // Studio PBR environment reflection
    try {
      const pmremGenerator = new THREE.PMREMGenerator(renderer);
      scene.environment = pmremGenerator.fromScene(
        new RoomEnvironment(),
        0.04
      ).texture;
      pmremGenerator.dispose();
    } catch {
      // Fallback if PMREM fails in restricted context
    }

    const camera = new THREE.PerspectiveCamera(45, width / Math.max(1, height), 0.1, 220);

    // Balanced 3-Point + Warm/Cool Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0x8ab4f8, 0x3b2d22, 0.85);
    hemiLight.position.set(0, 40, 0);
    scene.add(hemiLight);
    this.hemiLight = hemiLight;

    const sunLight = new THREE.DirectionalLight(0xffdfa8, 2.2);
    sunLight.position.set(18, 28, 16);
    if (!this.isSoftwareGl) {
      sunLight.castShadow = true;
      sunLight.shadow.mapSize.width = 1024;
      sunLight.shadow.mapSize.height = 1024;
      sunLight.shadow.camera.near = 1;
      sunLight.shadow.camera.far = 90;
      sunLight.shadow.camera.left = -22;
      sunLight.shadow.camera.right = 22;
      sunLight.shadow.camera.top = 22;
      sunLight.shadow.camera.bottom = -22;
      sunLight.shadow.bias = -0.0005;
      sunLight.shadow.normalBias = 0.02;
    }
    scene.add(sunLight);
    scene.add(sunLight.target);
    this.sunLight = sunLight;

    // Cool Rim Backlight to separate stickman silhouette from dark smoke/mountains
    const rimLight = new THREE.DirectionalLight(0x60a5fa, 1.15);
    rimLight.position.set(-12, 14, -18);
    scene.add(rimLight);

    // Build 3D World Environment (Zones 1, 2, 3)
    this.buildWorldEnvironment(scene, renderer);

    // Build 3D 6x6 Military Convoy Truck
    this.truckNodes = this.createMilitaryTruck3D();
    scene.add(this.truckNodes.root);

    // Build Primary & Secondary 3D Articulated Stickman Rigs
    this.heroNodes = this.createStickmanRig3D('#4d6b3c', true);
    scene.add(this.heroNodes.root);

    this.secondaryNodes = this.createStickmanRig3D('#3f5a36', true);
    this.secondaryNodes.root.visible = false;
    scene.add(this.secondaryNodes.root);

    // Build 3D Explosion, Shockwave & Rigid-Body Debris System
    this.explosionNodes = this.createExplosionSystem3D();
    scene.add(this.explosionNodes.root);

    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
  }

  private createMudRoadTexture(renderer: THREE.WebGLRenderer): THREE.CanvasTexture {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#2b241d';
    ctx.fillRect(0, 0, 256, 256);

    // Tire ruts & mud puddles
    ctx.fillStyle = '#1f1914';
    ctx.fillRect(0, 52, 256, 36);
    ctx.fillRect(0, 168, 256, 36);

    for (let i = 0; i < 180; i++) {
      const x = (Math.sin(i * 19.3) * 0.5 + 0.5) * 256;
      const y = (Math.cos(i * 37.1) * 0.5 + 0.5) * 256;
      ctx.fillStyle = i % 3 === 0 ? '#3b3228' : '#18130f';
      ctx.fillRect(x, y, 6 + (i % 8), 3 + (i % 4));
    }

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(36, 4);
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return tex;
  }

  private buildWorldEnvironment(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
    const envGroup = new THREE.Group();

    // 1. Ground Terrain Plane
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x2a3126,
      roughness: 0.92,
      metalness: 0.05,
    });
    const groundMesh = new THREE.Mesh(new THREE.PlaneGeometry(260, 140), groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.set(40, -0.02, -10);
    groundMesh.receiveShadow = !this.isSoftwareGl;
    envGroup.add(groundMesh);

    // 2. Muddy Convoy Road (offset by +0.02 on Y to prevent Z-fighting)
    const roadTex = this.createMudRoadTexture(renderer);
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: roadTex,
      roughness: 0.78,
      metalness: 0.08,
    });
    const roadMesh = new THREE.Mesh(new THREE.PlaneGeometry(240, 8.5), roadMat);
    roadMesh.rotation.x = -Math.PI / 2;
    roadMesh.position.set(40, 0.01, 0.2);
    roadMesh.receiveShadow = !this.isSoftwareGl;
    envGroup.add(roadMesh);

    // 3. Distant Apennine Mountain Peaks (Monte Castello backdrop)
    const mountainMat = new THREE.MeshStandardMaterial({
      color: 0x263242,
      roughness: 0.88,
      metalness: 0.1,
    });
    const snowCapMat = new THREE.MeshStandardMaterial({
      color: 0xdbeafe,
      roughness: 0.65,
      metalness: 0.05,
    });

    for (let m = 0; m < 10; m++) {
      const peakGroup = new THREE.Group();
      const radius = 14 + (m % 3) * 6;
      const height = 22 + (m % 4) * 8;
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(radius, height, 7),
        mountainMat
      );
      cone.position.y = height * 0.5;
      peakGroup.add(cone);

      const snow = new THREE.Mesh(
        new THREE.ConeGeometry(radius * 0.36, height * 0.36, 7),
        snowCapMat
      );
      snow.position.y = height * 0.83;
      peakGroup.add(snow);

      peakGroup.position.set(-20 + m * 16, -0.5, -36 - (m % 3) * 12);
      envGroup.add(peakGroup);
    }

    // 4. Zone 1 & 3 Pine Trees & Telegraph Poles along the road
    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x3e2c1e,
      roughness: 0.9,
    });
    const pineMat = new THREE.MeshStandardMaterial({
      color: 0x1e3522,
      roughness: 0.8,
    });
    const poleMat = new THREE.MeshStandardMaterial({
      color: 0x4a3b2c,
      roughness: 0.85,
    });

    for (let i = 0; i < 22; i++) {
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.26, 2.2, 7),
        trunkMat
      );
      trunk.position.y = 1.1;
      tree.add(trunk);

      for (let tier = 0; tier < 3; tier++) {
        const foliage = new THREE.Mesh(
          new THREE.ConeGeometry(1.45 - tier * 0.32, 2.1, 7),
          pineMat
        );
        foliage.position.y = 2.4 + tier * 1.15;
        tree.add(foliage);
      }

      const zSide = i % 4 === 0 ? 4.8 + (i % 3) * 1.2 : -5.2 - (i % 5) * 2.2;
      tree.position.set(-12 + i * 5.2, 0, zSide);
      const scale = 0.85 + (i % 4) * 0.14;
      tree.scale.setScalar(scale);
      envGroup.add(tree);
    }

    // Telegraph poles every 14m for fast foreground/midground motion reference
    for (let p = 0; p < 10; p++) {
      const poleGroup = new THREE.Group();
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.13, 5.4, 8),
        poleMat
      );
      post.position.y = 2.7;
      poleGroup.add(post);

      const crossbar = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.12, 1.5),
        poleMat
      );
      crossbar.position.y = 4.9;
      poleGroup.add(crossbar);

      poleGroup.position.set(-8 + p * 12, 0, -3.8);
      envGroup.add(poleGroup);
    }

    // 5. Zone 2: Bombarded Italian Stone Village Ruins & Sandbag Bunker (X = 18m .. 52m)
    const masonryMat = new THREE.MeshStandardMaterial({
      color: 0x6b635b,
      roughness: 0.88,
      metalness: 0.06,
    });
    const darkStoneMat = new THREE.MeshStandardMaterial({
      color: 0x47423d,
      roughness: 0.92,
      metalness: 0.05,
    });
    const roofTileMat = new THREE.MeshStandardMaterial({
      color: 0x7c3a2b,
      roughness: 0.75,
    });

    for (let b = 0; b < 6; b++) {
      const ruin = new THREE.Group();
      const bx = 14 + b * 11.5;
      const bz = -6.8 - (b % 2) * 2.4;

      // Left & right structural walls framing window/door openings
      const wallLeft = new THREE.Mesh(
        new THREE.BoxGeometry(2.2, 4.2, 0.55),
        masonryMat
      );
      wallLeft.position.set(-1.6, 2.1, 0);
      ruin.add(wallLeft);

      const wallRight = new THREE.Mesh(
        new THREE.BoxGeometry(2.2, 3.4, 0.55),
        masonryMat
      );
      wallRight.position.set(1.6, 1.7, 0);
      ruin.add(wallRight);

      const lintel = new THREE.Mesh(
        new THREE.BoxGeometry(5.4, 0.9, 0.6),
        darkStoneMat
      );
      lintel.position.set(0, 3.6, 0);
      ruin.add(lintel);

      const sideWall = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 3.8, 3.6),
        darkStoneMat
      );
      sideWall.position.set(-2.5, 1.9, -1.6);
      ruin.add(sideWall);

      const roofSlant = new THREE.Mesh(
        new THREE.BoxGeometry(3.2, 0.25, 2.6),
        roofTileMat
      );
      roofSlant.position.set(-1.1, 4.25, -1.1);
      roofSlant.rotation.z = 0.22;
      ruin.add(roofSlant);

      ruin.position.set(bx, 0, bz);
      envGroup.add(ruin);
    }

    // Foreground Tactical Stone Cover Wall & Sandbag Parapets along the road
    const sandbagMat = new THREE.MeshStandardMaterial({
      color: 0x786c54,
      roughness: 0.94,
    });

    for (let s = 0; s < 14; s++) {
      const parapet = new THREE.Group();
      const lowWall = new THREE.Mesh(
        new THREE.BoxGeometry(2.6, 0.85, 0.45),
        darkStoneMat
      );
      lowWall.position.y = 0.425;
      parapet.add(lowWall);

      for (let bag = 0; bag < 3; bag++) {
        const sb = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.18, 0.42, 4, 8),
          sandbagMat
        );
        sb.rotation.z = Math.PI / 2;
        sb.position.set(-0.7 + bag * 0.7, 0.96, 0);
        parapet.add(sb);
      }

      parapet.position.set(4 + s * 6.5, 0, s % 2 === 0 ? 2.45 : -2.95);
      envGroup.add(parapet);
    }

    scene.add(envGroup);
  }

  private createMilitaryTruck3D(): Truck3DNodes {
    const root = new THREE.Group();
    const chassis = new THREE.Group();
    root.add(chassis);

    const oliveMat = new THREE.MeshStandardMaterial({
      color: 0x3b4d32,
      roughness: 0.68,
      metalness: 0.22,
    });
    const canvasCanopyMat = new THREE.MeshStandardMaterial({
      color: 0x566343,
      roughness: 0.92,
      metalness: 0.04,
    });
    const darkSteelMat = new THREE.MeshStandardMaterial({
      color: 0x1e2420,
      roughness: 0.42,
      metalness: 0.75,
    });
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x93c5fd,
      roughness: 0.15,
      metalness: 0.1,
      transparent: true,
      opacity: 0.55,
    });

    // 1. Heavy Steel Frame Rails
    const frameRail = new THREE.Mesh(
      new THREE.BoxGeometry(6.2, 0.28, 1.85),
      darkSteelMat
    );
    frameRail.position.set(0, 0.68, 0);
    chassis.add(frameRail);

    // 2. Cargo Bed & Wooden Side Slats (Rear X = -2.85 to +0.55)
    const cargoBedFloor = new THREE.Mesh(
      new THREE.BoxGeometry(3.6, 0.18, 2.15),
      oliveMat
    );
    cargoBedFloor.position.set(-1.1, 0.92, 0);
    chassis.add(cargoBedFloor);

    const sideWallLeft = new THREE.Mesh(
      new THREE.BoxGeometry(3.55, 0.72, 0.12),
      oliveMat
    );
    sideWallLeft.position.set(-1.1, 1.32, 1.02);
    chassis.add(sideWallLeft);

    // Structural vertical steel ribs & wooden slats on the truck cargo bed side
    for (let r = 0; r < 6; r++) {
      const rib = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.78, 0.18),
        darkSteelMat
      );
      rib.position.set(-2.65 + r * 0.62, 1.33, 1.04);
      chassis.add(rib);
    }

    // FEB White Star insignia ring on cab door
    const emblemMat = new THREE.MeshBasicMaterial({ color: 0xe2e8f0 });
    const cabStar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 0.04, 5),
      emblemMat
    );
    cabStar.rotation.x = Math.PI / 2;
    cabStar.position.set(1.32, 1.35, 0.98);
    chassis.add(cabStar);

    const sideWallRight = new THREE.Mesh(
      new THREE.BoxGeometry(3.55, 0.72, 0.12),
      oliveMat
    );
    sideWallRight.position.set(-1.1, 1.32, -1.02);
    chassis.add(sideWallRight);

    // 3. Rear Steel Tailgate Bar (where the soldier grabs onto!)
    const tailgate = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.62, 2.08),
      darkSteelMat
    );
    tailgate.position.set(-2.85, 1.24, 0);
    chassis.add(tailgate);

    // 4. Canvas Troop Canopy Arch over Front Half of Cargo Bed
    const canopy = new THREE.Mesh(
      new THREE.BoxGeometry(2.3, 1.05, 2.12),
      canvasCanopyMat
    );
    canopy.position.set(-0.45, 2.12, 0);
    chassis.add(canopy);

    // 5. Armored Cab (X = +0.75 to +1.95)
    const cabBody = new THREE.Mesh(
      new THREE.BoxGeometry(1.25, 1.38, 1.95),
      oliveMat
    );
    cabBody.position.set(1.32, 1.52, 0);
    chassis.add(cabBody);

    const windshield = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.52, 1.68),
      glassMat
    );
    windshield.position.set(1.94, 1.82, 0);
    windshield.rotation.z = 0.15;
    chassis.add(windshield);

    // 6. Engine Hood & Radiator Grille (X = +1.95 to +3.05)
    const hood = new THREE.Mesh(
      new THREE.BoxGeometry(1.18, 0.86, 1.52),
      oliveMat
    );
    hood.position.set(2.48, 1.26, 0);
    chassis.add(hood);

    const grille = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.78, 1.38),
      darkSteelMat
    );
    grille.position.set(3.06, 1.25, 0);
    chassis.add(grille);

    const frontBumper = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.24, 2.16),
      darkSteelMat
    );
    frontBumper.position.set(3.16, 0.72, 0);
    chassis.add(frontBumper);

    // 7. Dual Glowing Headlights
    const headlightMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    const headlightGlowL = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.14, 0.1, 12),
      headlightMat
    );
    headlightGlowL.rotation.z = Math.PI / 2;
    headlightGlowL.position.set(3.1, 1.28, 0.62);
    chassis.add(headlightGlowL);

    const headlightGlowR = headlightGlowL.clone();
    headlightGlowR.position.set(3.1, 1.28, -0.62);
    chassis.add(headlightGlowR);

    // 8. Six Independent 3D Mud-Tread Wheels (3 Axles x Left/Right)
    const tireMat = new THREE.MeshStandardMaterial({
      color: 0x171717,
      roughness: 0.88,
      metalness: 0.12,
    });
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0x3b4d32,
      roughness: 0.5,
      metalness: 0.6,
    });

    const wheelXPositions = [-2.25, -1.05, 2.35];
    const wheels: THREE.Group[] = [];

    for (const wx of wheelXPositions) {
      for (const wz of [1.02, -1.02]) {
        const wheelGroup = new THREE.Group();
        wheelGroup.position.set(wx, 0.52, wz);

        const tire = new THREE.Mesh(
          new THREE.CylinderGeometry(0.52, 0.52, 0.34, 16),
          tireMat
        );
        tire.rotation.x = Math.PI / 2;
        wheelGroup.add(tire);

        const hub = new THREE.Mesh(
          new THREE.CylinderGeometry(0.26, 0.26, 0.38, 10),
          rimMat
        );
        hub.rotation.x = Math.PI / 2;
        wheelGroup.add(hub);

        // Cross lug bar so rotation is unmistakably visible at 60 FPS
        const lugBar = new THREE.Mesh(
          new THREE.BoxGeometry(0.78, 0.09, 0.4),
          darkSteelMat
        );
        wheelGroup.add(lugBar);

        root.add(wheelGroup);
        wheels.push(wheelGroup);
      }
    }

    // Contact shadow beneath truck
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
    });
    const shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(6.8, 2.6), shadowMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.set(0, 0.02, 0);
    root.add(shadowPlane);

    return {
      root,
      chassis,
      wheels,
      headlightGlowL,
      headlightGlowR,
    };
  }

  private createStickmanRig3D(
    colorHex: string,
    isSoldier: boolean
  ): StickmanRig3DNodes {
    const root = new THREE.Group();

    const bodyMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(colorHex),
      roughness: 0.52,
      metalness: 0.18,
    });
    const jointMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.38,
      metalness: 0.65,
    });
    const skinHeadMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.35,
      metalness: 0.1,
    });
    const webbingMat = new THREE.MeshStandardMaterial({
      color: 0x85754e,
      roughness: 0.85,
      metalness: 0.1,
    });
    const bootMat = new THREE.MeshStandardMaterial({
      color: 0x292018,
      roughness: 0.65,
      metalness: 0.25,
    });

    // Contact shadow disc on ground
    const contactShadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.55, 16),
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
      })
    );
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.y = 0.025;
    root.add(contactShadow);

    // Pelvis at hip height (Y = 0.96m)
    const pelvis = new THREE.Group();
    pelvis.position.set(0, 0.96, 0);
    root.add(pelvis);

    const pelvisMesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.14, 0.12, 6, 12),
      bodyMat
    );
    pelvisMesh.rotation.z = Math.PI / 2;
    pelvis.add(pelvisMesh);

    // Torso / Spine Group
    const torso = new THREE.Group();
    torso.position.set(0, 0.08, 0);
    pelvis.add(torso);

    const chestMesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.17, 0.42, 8, 14),
      bodyMat
    );
    chestMesh.position.y = 0.32;
    torso.add(chestMesh);

    // Tactical Webbing Belt & Field Pack for 3D Silhouette Depth
    if (isSoldier) {
      const belt = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.18, 0.09, 12),
        webbingMat
      );
      belt.position.y = 0.08;
      torso.add(belt);

      const fieldPack = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.38, 0.3),
        webbingMat
      );
      fieldPack.position.set(-0.2, 0.34, 0);
      torso.add(fieldPack);
    }

    // Head Group (mounted at top of torso Y = 0.66m)
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.68, 0);
    torso.add(headGroup);

    // Iconic Sculpted 3D Stickman Sphere Head
    const headSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 18, 18),
      skinHeadMat
    );
    headSphere.position.y = 0.22;
    headGroup.add(headSphere);

    // Expressive 3D Eyes & Articulated Eyebrows
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });
    const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 10), eyeMat);
    leftEye.position.set(0.215, 0.21, 0.088);
    headGroup.add(leftEye);

    const rightEye = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 10), eyeMat);
    rightEye.position.set(0.215, 0.21, -0.088);
    headGroup.add(rightEye);

    const browMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });
    const leftBrow = new THREE.Mesh(
      new THREE.BoxGeometry(0.032, 0.026, 0.095),
      browMat
    );
    leftBrow.position.set(0.225, 0.27, 0.088);
    headGroup.add(leftBrow);

    const rightBrow = new THREE.Mesh(
      new THREE.BoxGeometry(0.032, 0.026, 0.095),
      browMat
    );
    rightBrow.position.set(0.225, 0.27, -0.088);
    headGroup.add(rightBrow);

    // Prosodic 3D Jaw / Mouth Aperture
    const jawMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.045, 0.042, 0.12),
      eyeMat
    );
    jawMesh.position.set(0.22, 0.13, 0);
    headGroup.add(jawMesh);

    // 3D M1 Steel Helmet with Chinstrap & Rim (angled back slightly so eyes/brows show clearly)
    const helmetGroup = new THREE.Group();
    helmetGroup.position.y = 0.27;
    helmetGroup.rotation.z = 0.14;
    headGroup.add(helmetGroup);

    const helmetMat = new THREE.MeshStandardMaterial({
      color: 0x36482e,
      roughness: 0.48,
      metalness: 0.45,
    });
    const helmetDome = new THREE.Mesh(
      new THREE.SphereGeometry(0.265, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.56),
      helmetMat
    );
    helmetGroup.add(helmetDome);

    const helmetBrim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.285, 0.295, 0.035, 16),
      helmetMat
    );
    helmetBrim.position.y = 0.01;
    helmetGroup.add(helmetBrim);

    // Left & Right Arms (Shoulders -> Elbows -> Hands)
    const createArm = (zOffset: number) => {
      const shoulder = new THREE.Group();
      shoulder.position.set(0, 0.54, zOffset);
      torso.add(shoulder);

      const shoulderBall = new THREE.Mesh(
        new THREE.SphereGeometry(0.075, 10, 10),
        jointMat
      );
      shoulder.add(shoulderBall);

      const upperArm = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.058, 0.26, 6, 10),
        bodyMat
      );
      upperArm.position.y = -0.18;
      shoulder.add(upperArm);

      const elbow = new THREE.Group();
      elbow.position.set(0, -0.34, 0);
      shoulder.add(elbow);

      const elbowBall = new THREE.Mesh(
        new THREE.SphereGeometry(0.062, 8, 8),
        jointMat
      );
      elbow.add(elbowBall);

      const forearm = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.05, 0.24, 6, 10),
        bodyMat
      );
      forearm.position.y = -0.16;
      elbow.add(forearm);

      const hand = new THREE.Mesh(
        new THREE.SphereGeometry(0.065, 10, 10),
        skinHeadMat
      );
      hand.position.y = -0.31;
      elbow.add(hand);

      return { shoulder, elbow };
    };

    const leftArm = createArm(0.24);
    const rightArm = createArm(-0.24);

    // 3D M1 Garand Rifle attached to Right Forearm/Hand
    const rifleGroup = new THREE.Group();
    rifleGroup.position.set(0.08, -0.3, 0.06);
    rightArm.elbow.add(rifleGroup);

    const woodStockMat = new THREE.MeshStandardMaterial({
      color: 0x5c3a21,
      roughness: 0.72,
      metalness: 0.1,
    });
    const gunmetalMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.32,
      metalness: 0.85,
    });

    const rifleStock = new THREE.Mesh(
      new THREE.BoxGeometry(0.58, 0.08, 0.05),
      woodStockMat
    );
    rifleStock.position.set(0.12, 0, 0);
    rifleGroup.add(rifleStock);

    const rifleBarrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.022, 0.56, 8),
      gunmetalMat
    );
    rifleBarrel.rotation.z = Math.PI / 2;
    rifleBarrel.position.set(0.48, 0.025, 0);
    rifleGroup.add(rifleBarrel);

    const muzzleMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.9,
    });
    const muzzleCone = new THREE.Mesh(
      new THREE.ConeGeometry(0.12, 0.38, 8),
      muzzleMat
    );
    muzzleCone.rotation.z = -Math.PI / 2;
    muzzleCone.position.set(0.88, 0.025, 0);
    muzzleCone.visible = false;
    rifleGroup.add(muzzleCone);

    const muzzleLight = new THREE.PointLight(0xffb703, 0, 6, 2);
    muzzleLight.position.set(0.92, 0.05, 0);
    rifleGroup.add(muzzleLight);

    // Left & Right Legs (Hips -> Knees -> Ankles -> Heavy Boots)
    const createLeg = (zOffset: number) => {
      const hip = new THREE.Group();
      hip.position.set(0, -0.04, zOffset);
      pelvis.add(hip);

      const thigh = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.075, 0.34, 6, 10),
        bodyMat
      );
      thigh.position.y = -0.22;
      hip.add(thigh);

      const knee = new THREE.Group();
      knee.position.set(0, -0.44, 0);
      hip.add(knee);

      const kneeBall = new THREE.Mesh(
        new THREE.SphereGeometry(0.07, 8, 8),
        jointMat
      );
      knee.add(kneeBall);

      const shin = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.062, 0.34, 6, 10),
        bodyMat
      );
      shin.position.y = -0.22;
      knee.add(shin);

      const ankle = new THREE.Group();
      ankle.position.set(0, -0.44, 0);
      knee.add(ankle);

      const boot = new THREE.Mesh(
        new THREE.BoxGeometry(0.26, 0.11, 0.13),
        bootMat
      );
      boot.position.set(0.06, -0.04, 0);
      ankle.add(boot);

      return { hip, knee, ankle };
    };

    const leftLeg = createLeg(0.13);
    const rightLeg = createLeg(-0.13);

    return {
      root,
      pelvis,
      torso,
      headGroup,
      jawMesh,
      leftBrow,
      rightBrow,
      leftEye,
      rightEye,
      helmetGroup,
      leftShoulder: leftArm.shoulder,
      leftElbow: leftArm.elbow,
      rightShoulder: rightArm.shoulder,
      rightElbow: rightArm.elbow,
      rifleGroup,
      muzzleCone,
      muzzleLight,
      leftHip: leftLeg.hip,
      leftKnee: leftLeg.knee,
      leftAnkle: leftLeg.ankle,
      rightHip: rightLeg.hip,
      rightKnee: rightLeg.knee,
      rightAnkle: rightLeg.ankle,
      contactShadow,
      bodyMat,
    };
  }

  private createExplosionSystem3D(): Explosion3DNodes {
    const root = new THREE.Group();

    const fireballMat = new THREE.MeshBasicMaterial({
      color: 0xff6b00,
      transparent: true,
      opacity: 0.9,
    });
    const fireball = new THREE.Mesh(
      new THREE.SphereGeometry(1, 16, 16),
      fireballMat
    );
    fireball.visible = false;
    root.add(fireball);

    const shockwaveMat = new THREE.MeshBasicMaterial({
      color: 0xfde047,
      transparent: true,
      opacity: 0.75,
    });
    const shockwaveRing = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.08, 8, 32),
      shockwaveMat
    );
    shockwaveRing.rotation.x = Math.PI / 2;
    shockwaveRing.visible = false;
    root.add(shockwaveRing);

    const blastLight = new THREE.PointLight(0xff7b00, 0, 28, 1.8);
    blastLight.position.set(0, 2.2, 0);
    root.add(blastLight);

    // 24 Rigid-body debris fragments
    const plankMat = new THREE.MeshStandardMaterial({
      color: 0x7c4d25,
      roughness: 0.85,
    });
    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x57534e,
      roughness: 0.9,
    });
    const emberMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });

    const debrisMeshes: THREE.Mesh[] = [];
    for (let i = 0; i < 24; i++) {
      const mat =
        i % 4 === 0
          ? plankMat
          : i % 4 === 3
          ? emberMat
          : stoneMat;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat);
      mesh.visible = false;
      root.add(mesh);
      debrisMeshes.push(mesh);
    }

    // 6 Supply Crates that physically shatter/tumble
    const crateMat = new THREE.MeshStandardMaterial({
      color: 0x85582c,
      roughness: 0.82,
      metalness: 0.08,
    });
    const crateMeshes: THREE.Mesh[] = [];
    for (let c = 0; c < 6; c++) {
      const crate = new THREE.Mesh(
        new THREE.BoxGeometry(0.62, 0.56, 0.58),
        crateMat
      );
      root.add(crate);
      crateMeshes.push(crate);
    }

    // Rising volumetric dark smoke puffs
    const smokeMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 1,
      transparent: true,
      opacity: 0.65,
    });
    const smokePuffs: THREE.Mesh[] = [];
    for (let s = 0; s < 8; s++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.75, 10, 10), smokeMat);
      puff.visible = false;
      root.add(puff);
      smokePuffs.push(puff);
    }

    return {
      root,
      fireball,
      shockwaveRing,
      blastLight,
      debrisMeshes,
      crateMeshes,
      smokePuffs,
    };
  }

  private applyRigPoseTo3DNodes(
    nodes: StickmanRig3DNodes,
    pose: Stickman3DRigPose,
    colorHex: string,
    showMilitaryGear: boolean
  ) {
    nodes.bodyMat.color.set(colorHex || '#4d6b3c');
    nodes.helmetGroup.visible = showMilitaryGear;
    nodes.rifleGroup.visible = showMilitaryGear;

    nodes.root.position.set(pose.worldPos.x, pose.worldPos.y, pose.worldPos.z);
    nodes.root.rotation.y = pose.facingYawRad;

    nodes.pelvis.position.y = 0.96 + pose.pelvisOffsetY;
    nodes.torso.rotation.set(
      pose.torsoRollRad,
      pose.spineTwistYawRad,
      -pose.torsoPitchRad
    );

    nodes.headGroup.rotation.set(0, pose.headYawRad, -pose.headPitchRad);

    // Facial acting: jaw aperture, brow furrow, eye blink
    nodes.jawMesh.scale.y = 0.4 + pose.jawOpenAmount * 2.4;
    nodes.leftBrow.rotation.x = pose.browFurrow * 0.35;
    nodes.rightBrow.rotation.x = -pose.browFurrow * 0.35;
    const eyeScaleY = Math.max(0.12, 1 - pose.eyeBlink * 0.9);
    nodes.leftEye.scale.y = eyeScaleY;
    nodes.rightEye.scale.y = eyeScaleY;

    // Arms & Elbows (pitch around Z in local rig where +X is forward)
    nodes.leftShoulder.rotation.set(
      pose.leftShoulder.roll,
      pose.leftShoulder.yaw,
      pose.leftShoulder.pitch
    );
    nodes.leftElbow.rotation.set(0, 0, pose.leftElbowFlex);

    nodes.rightShoulder.rotation.set(
      pose.rightShoulder.roll,
      pose.rightShoulder.yaw,
      pose.rightShoulder.pitch
    );
    nodes.rightElbow.rotation.set(0, 0, pose.rightElbowFlex);

    // Rifle Muzzle Flash
    const firing = pose.muzzleFlashIntensity > 0.08 && showMilitaryGear;
    nodes.muzzleCone.visible = firing;
    if (firing) {
      nodes.muzzleCone.scale.setScalar(0.7 + pose.muzzleFlashIntensity * 0.6);
      nodes.muzzleLight.intensity = pose.muzzleFlashIntensity * 4.5;
    } else {
      nodes.muzzleLight.intensity = 0;
    }

    // Legs & Boots
    nodes.leftHip.rotation.set(pose.leftHip.roll, 0, pose.leftHip.pitch);
    nodes.leftKnee.rotation.set(0, 0, -pose.leftKneeFlex);
    nodes.leftAnkle.rotation.set(0, 0, pose.leftAnklePitch);

    nodes.rightHip.rotation.set(pose.rightHip.roll, 0, pose.rightHip.pitch);
    nodes.rightKnee.rotation.set(0, 0, -pose.rightKneeFlex);
    nodes.rightAnkle.rotation.set(0, 0, pose.rightAnklePitch);

    // Keep contact shadow anchored to ground y = 0.02
    nodes.contactShadow.position.y = Math.max(0.02 - pose.worldPos.y, -0.8);
  }

  public renderFrameTo2DCanvas(params: {
    ctx: CanvasRenderingContext2D;
    width: number;
    height: number;
    scene: StickmanScene;
    sceneProgress: number;
    sceneIndex: number;
    cameraOverride?: CinematicShotType | 'auto';
    showSubtitles?: boolean;
    wpm?: number;
  }): WorldStageFrame3D {
    const {
      ctx,
      width,
      height,
      scene,
      sceneProgress,
      sceneIndex,
      cameraOverride = 'auto',
      showSubtitles = true,
      wpm = 155,
    } = params;

    const frameState = evaluateWorldStageFrame3D(
      scene,
      sceneProgress,
      sceneIndex,
      cameraOverride,
      wpm
    );

    this.initIfNeeded(width, height);

    if (
      this.renderer &&
      this.scene &&
      this.camera &&
      this.heroNodes &&
      this.secondaryNodes &&
      this.truckNodes &&
      this.explosionNodes
    ) {
      const isWW2OrMilitary =
        scene.environment === 'ww2_battlefield' ||
        scene.environment === 'bunker_survival' ||
        scene.environment === 'zombie_apocalypse';

      // 1. Update Truck 3D Transform & Spinning Wheels
      this.truckNodes.root.position.set(
        frameState.truckWorldPos.x,
        frameState.truckWorldPos.y,
        frameState.truckWorldPos.z
      );
      this.truckNodes.chassis.rotation.set(
        frameState.truckRollRad,
        0,
        frameState.truckPitchRad
      );
      for (const wheel of this.truckNodes.wheels) {
        wheel.rotation.z = frameState.wheelSpinRad;
      }

      // 2. Update Hero & Secondary 3D Stickman Rigs
      this.applyRigPoseTo3DNodes(
        this.heroNodes,
        frameState.heroRig,
        scene.character1.color || '#4d6b3c',
        isWW2OrMilitary
      );

      if (frameState.secondaryRig && scene.character2) {
        this.secondaryNodes.root.visible = true;
        this.applyRigPoseTo3DNodes(
          this.secondaryNodes,
          frameState.secondaryRig,
          scene.character2.color || '#3f5a36',
          isWW2OrMilitary
        );
      } else {
        this.secondaryNodes.root.visible = false;
      }

      // 3. Update 3D Explosion, Shockwave, Crates & Rigid-Body Debris
      const exp = frameState.explosion;
      this.explosionNodes.fireball.visible = exp.isDetonating && exp.fireballScale > 0.05;
      if (this.explosionNodes.fireball.visible) {
        this.explosionNodes.fireball.position.set(
          exp.epicenter.x,
          exp.epicenter.y + exp.fireballScale * 0.45,
          exp.epicenter.z
        );
        this.explosionNodes.fireball.scale.setScalar(exp.fireballScale);
      }

      this.explosionNodes.shockwaveRing.visible =
        exp.isDetonating && exp.shockwaveRadius > 0.1;
      if (this.explosionNodes.shockwaveRing.visible) {
        this.explosionNodes.shockwaveRing.position.set(
          exp.epicenter.x,
          0.12,
          exp.epicenter.z
        );
        this.explosionNodes.shockwaveRing.scale.setScalar(exp.shockwaveRadius);
        const ringMat = this.explosionNodes.shockwaveRing
          .material as THREE.MeshBasicMaterial;
        ringMat.opacity = Math.max(0, 0.85 * (1 - exp.blastWaveProgress));
      }

      this.explosionNodes.blastLight.position.set(
        exp.epicenter.x,
        exp.epicenter.y + 2.2,
        exp.epicenter.z
      );
      this.explosionNodes.blastLight.intensity = exp.flashIntensity;

      for (let i = 0; i < this.explosionNodes.debrisMeshes.length; i++) {
        const mesh = this.explosionNodes.debrisMeshes[i];
        const frag = exp.debris[i];
        if (frag && frag.active) {
          mesh.visible = true;
          mesh.position.set(frag.pos.x, frag.pos.y, frag.pos.z);
          mesh.rotation.set(frag.rot.x, frag.rot.y, frag.rot.z);
          mesh.scale.set(frag.scale.x, frag.scale.y, frag.scale.z);
        } else {
          mesh.visible = false;
        }
      }

      for (let c = 0; c < this.explosionNodes.crateMeshes.length; c++) {
        const crateMesh = this.explosionNodes.crateMeshes[c];
        const crateState = exp.crates[c];
        if (crateState) {
          crateMesh.position.set(
            crateState.pos.x,
            crateState.pos.y,
            crateState.pos.z
          );
          crateMesh.rotation.set(
            crateState.rot.x,
            crateState.rot.y,
            crateState.rot.z
          );
        }
      }

      for (let s = 0; s < this.explosionNodes.smokePuffs.length; s++) {
        const puff = this.explosionNodes.smokePuffs[s];
        if (exp.isDetonating) {
          puff.visible = true;
          const angle = (s / 8) * Math.PI * 2;
          const rad = 0.8 + exp.blastWaveProgress * (2.2 + (s % 3));
          puff.position.set(
            exp.epicenter.x + Math.cos(angle) * rad,
            0.6 + exp.blastWaveProgress * (3.5 + s * 0.45),
            exp.epicenter.z + Math.sin(angle) * rad
          );
          puff.scale.setScalar(0.8 + exp.blastWaveProgress * 1.9);
        } else {
          puff.visible = false;
        }
      }

      // Move sunLight shadow frustum along with the convoy
      if (this.sunLight) {
        this.sunLight.position.set(
          frameState.truckWorldPos.x + 14,
          26,
          16
        );
        this.sunLight.target.position.set(
          frameState.truckWorldPos.x,
          0,
          0
        );
      }

      // 4. Apply Multi-Camera Shot Directive (snap cleanly on hard cut, damp smoothly within shot)
      const shot = frameState.shot;
      this._targetCamPos.set(shot.cameraPos.x, shot.cameraPos.y, shot.cameraPos.z);
      this._targetLookAt.set(
        shot.lookAtTarget.x,
        shot.lookAtTarget.y,
        shot.lookAtTarget.z
      );

      if (
        this.lastShotCutIndex !== shot.cutIndex ||
        this.lastSceneId !== scene.id
      ) {
        this.lastShotCutIndex = shot.cutIndex;
        this.lastSceneId = scene.id;
        this.camera.position.copy(this._targetCamPos);
        this._currentLookAt.copy(this._targetLookAt);
      } else {
        this.camera.position.lerp(this._targetCamPos, 0.28);
        this._currentLookAt.lerp(this._targetLookAt, 0.32);
      }

      this.camera.fov = shot.fov;
      this.camera.updateProjectionMatrix();
      this.camera.lookAt(this._currentLookAt);
      this.camera.rotation.z += shot.dutchRollRad;

      // 5. Render Three.js WebGL Scene & Blit onto 2D Canvas
      this.renderer.render(this.scene, this.camera);
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(this.renderer.domElement, 0, 0, width, height);
    }

    // 6. Cinematic Anamorphic Letterbox Bars & Shot Telemetry Overlay
    const barH = Math.round(height * 0.065);
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, width, barH);
    ctx.fillRect(0, height - barH, width, barH);

    // Top-Left 3D Camera & Zone Telemetry Strip (kept on left half so it never collides with top-right scene badge)
    ctx.save();
    ctx.font = 'bold 12px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(
      `🎥 3D STAGE • ${frameState.shot.shotLabel} (${frameState.shot.lensMm}mm)  |  ${frameState.zoneName}`,
      20,
      Math.round(barH * 0.64)
    );
    ctx.restore();

    // Optional Compact Subtitle in Bottom Letterbox Bar (never covering the 3D action!)
    if (showSubtitles && scene.narration) {
      ctx.save();
      ctx.font = '600 15px Inter, system-ui, sans-serif';
      ctx.fillStyle = '#f8fafc';
      ctx.textAlign = 'center';
      const cleanText =
        scene.narration.length > 105
          ? scene.narration.slice(0, 102) + '...'
          : scene.narration;
      ctx.fillText(cleanText, width / 2, height - Math.round(barH * 0.36));
      ctx.restore();
    }

    return frameState;
  }
}

export const threeStageEngine = new ThreeCinematicStageSingleton();
