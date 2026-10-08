// Hero scene: one electrical training lab shown three ways a headset can present it.
//   scan  - the room mesh a headset builds: edges and a point cloud
//   mr    - mixed reality: the real room as clay, with virtual training content anchored in it
//   vr    - virtual reality: the same lab fully rendered
// On load, a depth-scan wave spreads from the trainee's headset, then the view settles into
// mixed reality. Point at a surface to place a reticle; click to scan from there.
// Renders on demand, so it costs nothing while idle.

import * as THREE from 'three';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';

const figure = document.querySelector('.hero-figure');
const canvas = figure && figure.querySelector('canvas');

function webglAvailable() {
    try {
        const c = document.createElement('canvas');
        return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
    } catch (e) {
        return false;
    }
}

if (figure && canvas && webglAvailable()) {
    try {
        init();
    } catch (err) {
        console.error('[hero3d]', err);
        figure.classList.add('is-unavailable');
    }
} else if (figure) {
    figure.classList.add('is-unavailable');
}

function init() {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
    const target = new THREE.Vector3(-0.2, 1.1, -0.3);

    // Where the trainee stands, and where their headset is. The scan starts from the headset.
    const TRAINEE = new THREE.Vector3(0.3, 0, 0.5);
    const HEADSET = new THREE.Vector3(TRAINEE.x, 1.6, TRAINEE.z - 0.08);

    // ───────── Shared uniforms
    const uniforms = {
        uSurfaceA: { value: new THREE.Color() },
        uSurfaceB: { value: new THREE.Color() },
        uPlate: { value: new THREE.Color() },
        uInk: { value: new THREE.Color() },
        uAccent: { value: new THREE.Color() },
        uInkAlpha: { value: 0.5 },
        uScan: { value: 1 },
        uVR: { value: 0 },
        uRevealOrigin: { value: HEADSET.clone() },
        uRevealRadius: { value: 0 },
        uWaveOrigin: { value: new THREE.Vector3() },
        uWaveRadius: { value: -10 },
        uWaveStrength: { value: 0 },
        uHover: { value: new THREE.Vector3(0, -100, 0) },
        uPixelRatio: { value: renderer.getPixelRatio() }
    };

    const common = /* glsl */`
        uniform vec3 uRevealOrigin;
        uniform float uRevealRadius;
        uniform vec3 uWaveOrigin;
        uniform float uWaveRadius;
        uniform float uWaveStrength;
        uniform vec3 uHover;
        uniform float uScan;
        uniform float uVR;
        varying vec3 vWorld;
        float revealed(vec3 p) {
            return 1.0 - smoothstep(uRevealRadius - 0.35, uRevealRadius, distance(p, uRevealOrigin));
        }
        float band(vec3 p, vec3 o, float r, float w) {
            float d = distance(p, o) - r;
            return exp(-(d * d) / w);
        }
        float scanGlow(vec3 p) {
            float g = band(p, uRevealOrigin, uRevealRadius - 0.12, 0.03) * step(0.01, uRevealRadius) * (1.0 - smoothstep(6.0, 9.0, uRevealRadius));
            g = max(g, band(p, uWaveOrigin, uWaveRadius, 0.025) * uWaveStrength);
            return g;
        }
    `;

    const surfaceVertex = /* glsl */`
        varying vec3 vWorld;
        varying vec3 vNormal;
        void main() {
            vec4 w = modelMatrix * vec4(position, 1.0);
            vWorld = w.xyz;
            vNormal = normalize(mat3(modelMatrix) * normal);
            gl_Position = projectionMatrix * viewMatrix * w;
        }`;

    const surfaceFragment = /* glsl */`
        uniform vec3 uSurfaceA;
        uniform vec3 uSurfaceB;
        uniform vec3 uPlate;
        uniform vec3 uAccent;
        uniform vec3 uColor;
        uniform float uTone;
        varying vec3 vNormal;
        ${common}
        void main() {
            float r = revealed(vWorld);
            if (r < 0.02) discard;
            vec3 n = normalize(vNormal);
            float light = 0.5 + 0.5 * max(dot(n, normalize(vec3(0.5, 0.9, 0.7))), 0.0);
            // Darken toward the room's inside corners: the middle of the three plane distances
            vec3 c = vec3(vWorld.y, vWorld.x + 3.0, vWorld.z + 2.5);
            float mid = c.x + c.y + c.z - max(c.x, max(c.y, c.z)) - min(c.x, min(c.y, c.z));
            float ao = mix(0.74, 1.0, smoothstep(0.0, 1.2, mid));

            vec3 clay = mix(uSurfaceA, uSurfaceB, light * uTone) * ao;
            vec3 painted = uColor * (0.42 + 0.68 * light) * ao;
            vec3 col = mix(clay, painted, uVR);
            col = mix(col, uPlate, uScan * 0.88);
            col = mix(col, uAccent, scanGlow(vWorld) * 0.35);
            gl_FragColor = vec4(col, 1.0);
            #include <colorspace_fragment>
        }`;

    const lineVertex = /* glsl */`
        varying vec3 vWorld;
        void main() {
            vec4 w = modelMatrix * vec4(position, 1.0);
            vWorld = w.xyz;
            gl_Position = projectionMatrix * viewMatrix * w;
        }`;

    const lineFragment = (colorExpr, alphaExpr) => /* glsl */`
        uniform vec3 uInk;
        uniform vec3 uAccent;
        uniform float uInkAlpha;
        ${common}
        void main() {
            float r = revealed(vWorld);
            float g = scanGlow(vWorld);
            float a = ${alphaExpr};
            if (a < 0.01) discard;
            gl_FragColor = vec4(${colorExpr}, a);
            #include <colorspace_fragment>
        }`;

    const lineMat = (colorExpr, alphaExpr) => new THREE.ShaderMaterial({
        uniforms,
        vertexShader: lineVertex,
        fragmentShader: lineFragment(colorExpr, alphaExpr),
        transparent: true,
        depthWrite: false
    });

    // Edges strengthen in the scan view and recede once the lab is fully rendered
    const edgeMat = lineMat('mix(uInk, uAccent, max(g, uScan * 0.55))', 'r * uInkAlpha * (1.0 + uScan * 0.5) * (1.0 - uVR * 0.7) + g * 0.9');
    const guideMat = lineMat('mix(uInk, uAccent, g)', 'r * uInkAlpha * 0.35 * (1.0 - uVR * 0.5) + g * 0.6');
    const boundaryMat = lineMat('uAccent', 'r * 0.9 * (1.0 - uVR)');

    const pointMat = new THREE.ShaderMaterial({
        uniforms,
        vertexShader: /* glsl */`
            uniform float uPixelRatio;
            varying vec3 vWorld;
            void main() {
                vec4 w = modelMatrix * vec4(position, 1.0);
                vWorld = w.xyz;
                vec4 mv = viewMatrix * w;
                gl_PointSize = uPixelRatio * 22.0 / -mv.z;
                gl_Position = projectionMatrix * mv;
            }`,
        fragmentShader: /* glsl */`
            uniform vec3 uAccent;
            ${common}
            void main() {
                vec2 c = gl_PointCoord - 0.5;
                if (dot(c, c) > 0.25) discard;
                float r = revealed(vWorld);
                float hover = 1.0 - smoothstep(0.15, 0.6, distance(vWorld, uHover));
                float a = r * (0.03 + uScan * 0.6) + scanGlow(vWorld) + hover * 0.85 * r;
                if (a < 0.01) discard;
                gl_FragColor = vec4(uAccent, min(a, 1.0));
                #include <colorspace_fragment>
            }`,
        transparent: true,
        depthWrite: false
    });

    // ───────── Geometry (meters). Back wall at z = -2.5, left wall at x = -3.
    // Each solid carries a clay tone for the mixed reality view and a paint color for VR.
    const PAINT = {
        floor: '#59616b', wall: '#d6d8d2', steel: '#3b4048', top: '#b4875a', board: '#e7e4dc',
        breaker: '#2b2f35', panel: '#a7acb2', danger: '#c8412f', caution: '#d9a520', conduit: '#9aa0a6',
        cabinet: '#e2e4e6', status: '#2fbf6a', tray: '#7c838b', seat: '#2a2e33', skin: '#c9a184',
        shirt: '#4a6fa5', pants: '#30353d', headset: '#f2f2f0'
    };
    const surfaceMats = new Map();
    function surfaceMat(tone, paint) {
        const key = `${tone}|${paint}`;
        if (!surfaceMats.has(key)) {
            surfaceMats.set(key, new THREE.ShaderMaterial({
                uniforms: { ...uniforms, uTone: { value: tone }, uColor: { value: new THREE.Color(paint) } },
                vertexShader: surfaceVertex,
                fragmentShader: surfaceFragment,
                polygonOffset: true,
                polygonOffsetFactor: 1,
                polygonOffsetUnits: 1
            }));
        }
        return surfaceMats.get(key);
    }

    const solids = [];
    const room = new THREE.Group();
    scene.add(room);

    function solid(geometry, { at = [0, 0, 0], paint = PAINT.panel, tone = 1, parent = room, quat = null, scale = null } = {}) {
        const mesh = new THREE.Mesh(geometry, surfaceMat(tone, paint));
        mesh.position.set(...at);
        if (quat) mesh.quaternion.copy(quat);
        if (scale) mesh.scale.set(...scale);
        mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 25), edgeMat));
        parent.add(mesh);
        solids.push(mesh);
        return mesh;
    }

    const box = (w, h, d, at, paint, opts = {}) => solid(new THREE.BoxGeometry(w, h, d), { at, paint, ...opts });
    const cyl = (r, h, at, paint, seg = 20) => solid(new THREE.CylinderGeometry(r, r, h, seg), { at, paint });
    const UP = new THREE.Vector3(0, 1, 0);
    function rod(r, from, to, paint, opts = {}) {
        const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
        const quat = new THREE.Quaternion().setFromUnitVectors(UP, b.clone().sub(a).normalize());
        const mid = a.clone().add(b).multiplyScalar(0.5);
        return solid(new THREE.CylinderGeometry(r, r, a.distanceTo(b), 10), { at: mid.toArray(), paint, quat, ...opts });
    }

    // Shell: floor and two walls, thin so they read as a cutaway
    box(6, 0.08, 5, [0, -0.04, 0], PAINT.floor, { tone: 0.72 });
    box(6, 3, 0.08, [0, 1.5, -2.54], PAINT.wall, { tone: 0.86 });
    box(0.08, 3, 5, [-3.04, 1.5, 0], PAINT.wall, { tone: 0.86 });

    // Workbench with a trainer board
    box(2.2, 0.06, 0.9, [0.15, 0.9, -0.3], PAINT.top);
    [[-0.88, -0.68], [1.18, -0.68], [-0.88, 0.08], [1.18, 0.08]].forEach(([x, z]) => box(0.06, 0.87, 0.06, [x, 0.435, z], PAINT.steel));
    box(2.1, 0.04, 0.8, [0.15, 0.25, -0.3], PAINT.steel);
    box(1.1, 0.7, 0.05, [0.05, 1.28, -0.66], PAINT.board);
    [-0.32, -0.14, 0.04, 0.22].forEach((x) => box(0.12, 0.2, 0.08, [x, 1.36, -0.6], PAINT.breaker));
    box(0.42, 0.14, 0.08, [0.05, 1.08, -0.6], PAINT.breaker);
    box(0.3, 0.08, 0.22, [0.85, 0.97, -0.2], PAINT.caution);

    // Back wall: distribution panel, sub-panel, disconnect, junction box
    box(0.75, 1.05, 0.2, [-1.75, 1.45, -2.4], PAINT.panel);
    box(0.5, 0.72, 0.18, [-0.85, 1.6, -2.41], PAINT.panel);
    box(0.3, 0.45, 0.15, [0.05, 1.5, -2.43], PAINT.danger);
    box(0.14, 0.2, 0.08, [0.95, 1.3, -2.46], PAINT.panel);

    // Conduit runs
    rod(0.035, [-2.98, 2.62, -2.42], [1.4, 2.62, -2.42], PAINT.conduit);
    rod(0.03, [-1.75, 1.98, -2.42], [-1.75, 2.62, -2.42], PAINT.conduit);
    rod(0.03, [-0.85, 1.96, -2.42], [-0.85, 2.62, -2.42], PAINT.conduit);
    rod(0.025, [0.05, 1.73, -2.43], [0.05, 2.62, -2.43], PAINT.conduit);
    rod(0.025, [0.95, 1.4, -2.47], [0.95, 2.62, -2.47], PAINT.conduit);

    // Battery storage cabinets along the left wall
    [-1.65, -0.85, -0.05].forEach((z) => {
        box(0.7, 1.9, 0.72, [-2.63, 0.95, z], PAINT.cabinet);
        box(0.02, 0.06, 0.12, [-2.27, 1.55, z - 0.18], PAINT.status);
        box(0.02, 1.6, 0.01, [-2.27, 0.95, z + 0.05], PAINT.tray);
    });
    box(0.3, 0.08, 3.6, [-2.82, 2.45, -0.4], PAINT.tray);

    // Stool, pushed aside
    cyl(0.19, 0.05, [1.45, 0.66, 0.95], PAINT.seat);
    cyl(0.025, 0.6, [1.45, 0.33, 0.95], PAINT.conduit, 8);
    cyl(0.24, 0.03, [1.45, 0.015, 0.95], PAINT.seat);

    // Trainee: a simple scale figure wearing a headset, right hand reaching toward the board
    const trainee = new THREE.Group();
    trainee.position.copy(TRAINEE);
    room.add(trainee);
    const person = { parent: trainee };
    const limb = (r, from, dir, len, paint) => {
        const d = new THREE.Vector3(...dir).normalize();
        const a = new THREE.Vector3(...from);
        const mid = a.clone().addScaledVector(d, len / 2);
        solid(new THREE.CapsuleGeometry(r, len - 2 * r, 4, 16), {
            at: mid.toArray(), paint, quat: new THREE.Quaternion().setFromUnitVectors(UP, d), ...person
        });
        return a.clone().addScaledVector(d, len);
    };
    limb(0.065, [-0.09, 0.05, 0], [0, 1, 0], 0.82, PAINT.pants);
    limb(0.065, [0.09, 0.05, 0], [0, 1, 0], 0.82, PAINT.pants);
    solid(new THREE.CapsuleGeometry(0.15, 0.36, 4, 16), { at: [0, 1.13, 0], paint: PAINT.shirt, scale: [1, 1, 0.68], ...person });
    solid(new THREE.SphereGeometry(0.1, 20, 14), { at: [0, 1.57, 0.01], paint: PAINT.skin, ...person });
    solid(new THREE.BoxGeometry(0.21, 0.1, 0.11), { at: [0, 1.6, -0.08], paint: PAINT.headset, ...person });
    const leftHand = limb(0.045, [-0.21, 1.36, 0], [-0.08, -1, 0.02], 0.58, PAINT.shirt);
    const rightHand = limb(0.045, [0.21, 1.36, 0], [0.15, -0.35, -1], 0.6, PAINT.shirt);
    solid(new THREE.BoxGeometry(0.05, 0.05, 0.11), { at: leftHand.toArray(), paint: PAINT.breaker, ...person });
    solid(new THREE.BoxGeometry(0.05, 0.05, 0.11), { at: rightHand.toArray(), paint: PAINT.breaker, ...person });

    // Floor and wall guides: 0.5 m tiles, wall seams
    const guides = [];
    for (let x = -3; x <= 3.001; x += 0.5) guides.push(x, 0.002, -2.5, x, 0.002, 2.5);
    for (let z = -2.5; z <= 2.501; z += 0.5) guides.push(-3, 0.002, z, 3, 0.002, z);
    for (let x = -3; x <= 3.001; x += 1.5) guides.push(x, 0, -2.495, x, 3, -2.495);
    for (let z = -2.5; z <= 2.501; z += 1.25) guides.push(-2.995, 0, z, -2.995, 3, z);
    const guideGeo = new THREE.BufferGeometry();
    guideGeo.setAttribute('position', new THREE.Float32BufferAttribute(guides, 3));
    room.add(new THREE.LineSegments(guideGeo, guideMat));

    // Play-area boundary around the trainee
    const bx0 = -1.0, bx1 = 1.9, bz0 = -1.05, bz1 = 1.7, by = 0.006;
    const bGeo = new THREE.BufferGeometry();
    bGeo.setAttribute('position', new THREE.Float32BufferAttribute([
        bx0, by, bz0, bx1, by, bz0, bx1, by, bz0, bx1, by, bz1,
        bx1, by, bz1, bx0, by, bz1, bx0, by, bz1, bx0, by, bz0
    ], 3));
    room.add(new THREE.LineSegments(bGeo, boundaryMat));

    // Scan points sampled across every surface, nudged off the surface along its normal
    room.updateMatrixWorld(true);
    const pts = [];
    const p = new THREE.Vector3(), n = new THREE.Vector3();
    solids.forEach((mesh) => {
        const g = mesh.geometry;
        g.computeBoundingBox();
        const s = g.boundingBox.getSize(new THREE.Vector3()).multiply(mesh.scale);
        const area = 2 * (s.x * s.y + s.y * s.z + s.x * s.z);
        const count = Math.min(2600, Math.max(24, Math.round(area * 170)));
        const sampler = new MeshSurfaceSampler(mesh).build();
        const normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
        for (let i = 0; i < count; i++) {
            sampler.sample(p, n);
            p.applyMatrix4(mesh.matrixWorld);
            n.applyMatrix3(normalMatrix).normalize();
            p.addScaledVector(n, 0.012);
            pts.push(p.x, p.y, p.z);
        }
    });
    const pointGeo = new THREE.BufferGeometry();
    pointGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    scene.add(new THREE.Points(pointGeo, pointMat));

    // ───────── Contact shadows
    const shadowTex = (() => {
        const c = document.createElement('canvas');
        c.width = c.height = 128;
        const g = c.getContext('2d');
        const grad = g.createRadialGradient(64, 64, 8, 64, 64, 64);
        grad.addColorStop(0, 'rgba(0,0,0,1)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = grad;
        g.fillRect(0, 0, 128, 128);
        return new THREE.CanvasTexture(c);
    })();
    const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, color: 0x000000, transparent: true, depthWrite: false, opacity: 0 });
    function shadow(w, d, x, z) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), shadowMat);
        m.rotation.x = -Math.PI / 2;
        m.position.set(x, 0.004, z);
        scene.add(m);
    }
    shadow(2.9, 1.5, 0.15, -0.3);
    shadow(1.1, 3.3, -2.5, -0.85);
    shadow(0.6, 0.6, 1.45, 0.95);
    shadow(0.7, 0.55, TRAINEE.x, TRAINEE.z);

    // ───────── Virtual training layer, anchored in the room. Shown in mixed reality and VR.
    const virtual = new THREE.Group();
    scene.add(virtual);
    const virtualMats = [];
    const vMat = (mat, base = 1) => { mat.userData.base = base; mat.transparent = true; mat.opacity = 0; virtualMats.push(mat); return mat; };

    const BREAKER = new THREE.Vector3(-0.14, 1.36, -0.55);

    // Step card
    const cardCanvas = document.createElement('canvas');
    cardCanvas.width = 1024;
    cardCanvas.height = 600;
    const cardTex = new THREE.CanvasTexture(cardCanvas);
    cardTex.colorSpace = THREE.SRGBColorSpace;
    cardTex.anisotropy = 4;
    const card = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 1.55 * 600 / 1024), vMat(new THREE.MeshBasicMaterial({ map: cardTex, side: THREE.DoubleSide, depthWrite: false })));
    card.position.set(1.65, 2.05, -0.75);
    card.rotation.y = 0.62;
    card.renderOrder = 5;
    virtual.add(card);

    function roundRect(g, x, y, w, h, r) {
        g.beginPath();
        g.moveTo(x + r, y);
        g.arcTo(x + w, y, x + w, y + h, r);
        g.arcTo(x + w, y + h, x, y + h, r);
        g.arcTo(x, y + h, x, y, r);
        g.arcTo(x, y, x + w, y, r);
        g.closePath();
    }

    function drawCard(c) {
        const g = cardCanvas.getContext('2d');
        const W = cardCanvas.width, H = cardCanvas.height;
        const font = (size, weight) => `${weight} ${size}px 'Schibsted Grotesk', system-ui, sans-serif`;
        g.clearRect(0, 0, W, H);
        roundRect(g, 6, 6, W - 12, H - 12, 28);
        g.globalAlpha = 0.94;
        g.fillStyle = c.bg;
        g.fill();
        g.globalAlpha = 1;
        g.lineWidth = 5;
        g.strokeStyle = c.accent;
        g.stroke();

        g.fillStyle = c.muted;
        g.font = font(34, 500);
        g.fillText('Step 3 of 7', 56, 88);
        g.fillStyle = c.text;
        g.font = font(64, 600);
        g.fillText('Lockout/tagout', 56, 168);
        g.font = font(38, 400);
        g.fillStyle = c.muted;
        ['Switch off breaker 2, apply your lock,', 'then verify zero energy before', 'opening the panel.'].forEach((line, i) => g.fillText(line, 56, 248 + i * 52));

        const x0 = 56, y0 = 470, segW = (W - 112 - 6 * 12) / 7;
        for (let i = 0; i < 7; i++) {
            g.fillStyle = i < 3 ? c.accent : c.line;
            g.fillRect(x0 + i * (segW + 12), y0, segW, 10);
        }
        g.fillStyle = c.accent;
        g.font = font(34, 600);
        g.fillText('Hold trigger to confirm', 56, 548);
        cardTex.needsUpdate = true;
    }

    // Leader from the card to the breaker, a target frame, and the arc-flash boundary
    const accentVirtual = vMat(new THREE.LineBasicMaterial());
    const cardCorner = new THREE.Vector3(-0.775, -0.454, 0).applyEuler(card.rotation).add(card.position);
    virtual.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([cardCorner, BREAKER.clone().add(new THREE.Vector3(0.05, 0.1, 0.05))]), accentVirtual));

    const frameBox = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.2, 0.28, 0.14)), accentVirtual);
    frameBox.position.copy(BREAKER).add(new THREE.Vector3(0, 0, -0.04));
    virtual.add(frameBox);

    const dashed = vMat(new THREE.LineDashedMaterial({ dashSize: 0.09, gapSize: 0.06 }));
    const arcPts = [];
    for (let i = 0; i <= 48; i++) {
        const a = (i / 48) * Math.PI;
        arcPts.push(new THREE.Vector3(-1.75 + Math.cos(a) * 1.15, 0.012, -2.3 + Math.sin(a) * 1.15));
    }
    const arc = new THREE.Line(new THREE.BufferGeometry().setFromPoints(arcPts), dashed);
    arc.computeLineDistances();
    virtual.add(arc);

    const zoneMat = vMat(new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, depthWrite: false }), 0.1);
    const zone = new THREE.Mesh(new THREE.CircleGeometry(1.15, 48, 0, Math.PI), zoneMat);
    zone.rotation.x = Math.PI / 2;
    zone.position.set(-1.75, 0.008, -2.3);
    virtual.add(zone);

    // ───────── Surface reticle
    const reticle = new THREE.Group();
    const ringMat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, depthTest: false, transparent: true });
    reticle.add(new THREE.Mesh(new THREE.RingGeometry(0.075, 0.09, 40), ringMat));
    reticle.add(new THREE.Mesh(new THREE.CircleGeometry(0.018, 16), ringMat));
    reticle.children.forEach((m) => { m.renderOrder = 11; });
    reticle.visible = false;
    scene.add(reticle);

    // ───────── Theme colors come from CSS custom properties
    function readColors() {
        const cs = getComputedStyle(document.documentElement);
        const v = (name) => cs.getPropertyValue(name).trim();
        uniforms.uSurfaceA.value.set(v('--scene-shade'));
        uniforms.uSurfaceB.value.set(v('--scene-light'));
        uniforms.uPlate.value.set(v('--plate'));
        uniforms.uInk.value.set(v('--scene-ink'));
        uniforms.uAccent.value.set(v('--accent'));
        uniforms.uInkAlpha.value = parseFloat(v('--scene-ink-alpha')) || 0.5;
        ringMat.color.set(v('--accent'));
        accentVirtual.color.set(v('--accent'));
        dashed.color.set(v('--accent'));
        zoneMat.color.set(v('--accent'));
        drawCard({ bg: v('--bg'), text: v('--text'), muted: v('--muted'), line: v('--line'), accent: v('--accent') });
        requestRender();
    }

    // ───────── View modes
    const VIEWS = {
        scan: { scan: 1, vr: 0, virtual: 0, shadow: 0 },
        mr: { scan: 0, vr: 0, virtual: 1, shadow: 0.22 },
        vr: { scan: 0, vr: 1, virtual: 1, shadow: 0.34 }
    };
    const viewButtons = Array.from(figure.querySelectorAll('[data-view]'));
    const state = { ...VIEWS.scan };
    let view = 'scan';
    let viewChosen = false;

    function setView(name, { chosen = false } = {}) {
        if (!VIEWS[name]) return;
        view = name;
        if (chosen) viewChosen = true;
        viewButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === name)));
        if (revealDone) startWave(HEADSET);
        requestRender();
    }

    viewButtons.forEach((b) => b.addEventListener('click', () => setView(b.dataset.view, { chosen: true })));

    function applyState() {
        uniforms.uScan.value = state.scan;
        uniforms.uVR.value = state.vr;
        virtualMats.forEach((m) => { m.opacity = m.userData.base * state.virtual; });
        shadowMat.opacity = state.shadow * Math.min(1, uniforms.uRevealRadius.value / 6);
    }

    // ───────── Camera: orbit with gentle pointer parallax
    const orbit = { az: 0.72, el: 0.4, radius: 14 };
    const look = { az: orbit.az, el: orbit.el };
    let pointerN = null;

    function placeCamera() {
        const r = orbit.radius;
        camera.position.set(
            target.x + r * Math.cos(look.el) * Math.sin(look.az),
            target.y + r * Math.sin(look.el),
            target.z + r * Math.cos(look.el) * Math.cos(look.az)
        );
        camera.lookAt(target);
        camera.updateMatrixWorld();
    }

    function resize() {
        const rect = canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        renderer.setSize(rect.width, rect.height, false);
        camera.aspect = rect.width / rect.height;
        // Keep the whole room in frame on narrow figures
        orbit.radius = 12.4 * Math.max(1, 1.4 / camera.aspect);
        camera.updateProjectionMatrix();
        uniforms.uPixelRatio.value = renderer.getPixelRatio();
        requestRender();
    }

    // ───────── Interaction
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let hit = null;

    function revealedAt(point) {
        return point.distanceTo(uniforms.uRevealOrigin.value) < uniforms.uRevealRadius.value - 0.2;
    }

    function updateHit() {
        hit = null;
        if (pointerN) {
            ndc.set(pointerN.x * 2 - 1, -(pointerN.y * 2 - 1));
            raycaster.setFromCamera(ndc, camera);
            hit = raycaster.intersectObjects(solids, false).find((h) => revealedAt(h.point)) || null;
        }
        if (!hit) {
            uniforms.uHover.value.set(0, -100, 0);
            reticle.visible = false;
            return;
        }
        const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
        reticle.position.copy(hit.point).addScaledVector(normal, 0.01);
        reticle.lookAt(hit.point.clone().add(normal));
        reticle.visible = true;
        uniforms.uHover.value.copy(hit.point);
    }

    function setPointer(e) {
        const rect = canvas.getBoundingClientRect();
        pointerN = { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height };
    }

    canvas.addEventListener('pointermove', (e) => {
        if (e.pointerType === 'touch') return;
        setPointer(e);
        requestRender();
    });
    canvas.addEventListener('pointerleave', () => { pointerN = null; requestRender(); });
    canvas.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        setPointer(e);
        placeCamera();
        updateHit();
        if (hit) startWave(hit.point);
        if (e.pointerType === 'touch') setTimeout(() => { pointerN = null; requestRender(); }, 1400);
        requestRender();
    });

    // ───────── Animation
    let revealStart = null;
    let revealDone = false;
    let waveStart = null;
    const REVEAL_MS = 2600;
    const WAVE_MS = 1800;

    function startWave(point) {
        uniforms.uWaveOrigin.value.copy(point);
        if (reduceMotion.matches) return;
        waveStart = performance.now();
    }

    const easeOut = (t) => 1 - Math.pow(1 - t, 3);

    let rafId = 0;
    let visible = true;

    // Background tabs get no animation frames; a timer lets a started reveal still finish
    function requestRender() {
        if (rafId) return;
        rafId = document.hidden
            ? setTimeout(() => frame(performance.now()), 50)
            : requestAnimationFrame(frame);
    }

    function frame(now) {
        rafId = 0;
        let animating = false;
        const instant = reduceMotion.matches;

        // First reveal from the headset, then settle into mixed reality
        if (revealStart === null) revealStart = instant ? now - REVEAL_MS : now;
        const rt = Math.min(1, (now - revealStart) / REVEAL_MS);
        uniforms.uRevealRadius.value = easeOut(rt) * 9.5;
        if (rt < 1) animating = true;
        if (rt >= 1 && !revealDone) {
            revealDone = true;
            if (!viewChosen) setView('mr');
        }

        // Ease view parameters toward the chosen view
        const goal = VIEWS[view];
        const kv = instant ? 1 : 0.07;
        Object.keys(goal).forEach((key) => {
            state[key] += (goal[key] - state[key]) * kv;
            if (Math.abs(goal[key] - state[key]) > 0.002) animating = true;
            else state[key] = goal[key];
        });
        applyState();

        if (waveStart !== null) {
            const wt = (now - waveStart) / WAVE_MS;
            if (wt >= 1) {
                waveStart = null;
                uniforms.uWaveStrength.value = 0;
            } else {
                uniforms.uWaveRadius.value = easeOut(wt) * 6;
                uniforms.uWaveStrength.value = 1 - wt;
                animating = true;
            }
        }

        // Ease the orbit toward the pointer
        const goalAz = orbit.az + (pointerN ? (pointerN.x - 0.5) * 0.16 : 0);
        const goalEl = orbit.el + (pointerN ? (pointerN.y - 0.5) * 0.06 : 0);
        const k = instant ? 1 : 0.08;
        look.az += (goalAz - look.az) * k;
        look.el += (goalEl - look.el) * k;
        if (Math.abs(goalAz - look.az) + Math.abs(goalEl - look.el) > 0.0005) animating = true;

        placeCamera();
        updateHit();
        renderer.render(scene, camera);

        if (animating && visible) requestRender();
    }

    new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        if (visible) requestRender();
    }).observe(figure);

    new ResizeObserver(resize).observe(canvas);
    document.addEventListener('themechange', readColors);
    reduceMotion.addEventListener('change', requestRender);

    readColors();
    resize();
    if (document.fonts) document.fonts.ready.then(readColors);
    figure.classList.add('is-ready');
}
