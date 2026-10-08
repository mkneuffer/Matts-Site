// Hero scene: an energy lab with a holographic microgrid map floating over a planning table,
// shown three ways a headset can present it:
//   scan  - the room mesh a headset builds: edges and a point cloud
//   mr    - mixed reality: the real room as clay, with the virtual map anchored in it
//   vr    - virtual reality: the same lab fully rendered
// On load, a depth-scan wave spreads from the table, then the view settles into mixed reality.
// Point at a surface to place a reticle; click to scan from there.

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
    const target = new THREE.Vector3(-0.1, 1.0, -0.25);

    // The planning table. The scan starts from its top, and the hologram floats above it.
    const TABLE = new THREE.Vector3(0.3, 0.82, -0.05);
    const TABLE_R = 1.25;

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
        uRevealOrigin: { value: TABLE.clone() },
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
                float a = r * (0.03 * (1.0 - uVR) + uScan * 0.6) + scanGlow(vWorld) + hover * 0.85 * r;
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
        cabinet: '#e2e4e6', status: '#2fbf6a', tray: '#7c838b'
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

    // Round planning table on a pedestal
    cyl(TABLE_R, 0.06, [TABLE.x, TABLE.y - 0.03, TABLE.z], PAINT.steel, 48);
    cyl(0.3, TABLE.y - 0.06, [TABLE.x, (TABLE.y - 0.06) / 2, TABLE.z], PAINT.steel, 24);
    cyl(0.6, 0.04, [TABLE.x, 0.02, TABLE.z], PAINT.steel, 32);

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

    // Floor and wall guides: 0.5 m tiles, wall seams
    const guides = [];
    for (let x = -3; x <= 3.001; x += 0.5) guides.push(x, 0.002, -2.5, x, 0.002, 2.5);
    for (let z = -2.5; z <= 2.501; z += 0.5) guides.push(-3, 0.002, z, 3, 0.002, z);
    for (let x = -3; x <= 3.001; x += 1.5) guides.push(x, 0, -2.495, x, 3, -2.495);
    for (let z = -2.5; z <= 2.501; z += 1.25) guides.push(-2.995, 0, z, -2.995, 3, z);
    const guideGeo = new THREE.BufferGeometry();
    guideGeo.setAttribute('position', new THREE.Float32BufferAttribute(guides, 3));
    room.add(new THREE.LineSegments(guideGeo, guideMat));

    // Play-area boundary around the table
    const bx0 = -1.4, bx1 = 2.0, bz0 = -1.6, bz1 = 1.6, by = 0.006;
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
    shadow(3.0, 3.0, TABLE.x, TABLE.z);
    shadow(1.1, 3.3, -2.5, -0.85);

    // ───────── Holographic microgrid map over the table. Shown in mixed reality and VR.
    // A terrain disc with a grid, solar rows, a wind turbine, poles carrying a line to a battery,
    // and a few building blocks, all in unit-disc coordinates scaled to the table.
    const holoMats = [];
    const holo = (mat, base) => { mat.userData.base = base; Object.assign(mat, { transparent: true, depthWrite: false, opacity: 0 }); holoMats.push(mat); return mat; };
    const holoColor = new THREE.Color();
    const holoPale = new THREE.Color();

    const MAP_R = 1.08;
    const map = new THREE.Group();
    map.position.set(TABLE.x, TABLE.y + 0.12, TABLE.z);
    map.scale.setScalar(MAP_R);
    scene.add(map);
    const spin = new THREE.Group();
    map.add(spin);

    const terrainY = (x, z) => (1 - 0.35 * (x * x + z * z)) * (0.06 * Math.sin(2.1 * x) * Math.cos(1.7 * z) + 0.03 * Math.sin(4.3 * x + 3.1 * z) + 0.015 * Math.sin(7.7 * z + 5.3 * x));

    // Terrain grid cut to the disc, each line subdivided so it follows the surface, plus a rim
    const grid = [];
    const CELLS = 16, SUB = 3, N = CELLS * SUB;
    const inDisc = (x, z) => x * x + z * z <= 1.0001;
    const pushSeg = (ax, az, bx, bz) => grid.push(ax, terrainY(ax, az), az, bx, terrainY(bx, bz), bz);
    for (let i = 0; i <= CELLS; i++) {
        const c = -1 + (2 * i) / CELLS;
        for (let k = 0; k < N; k++) {
            const a = -1 + (2 * k) / N, b = a + 2 / N;
            if (inDisc(a, c) && inDisc(b, c)) pushSeg(a, c, b, c);
            if (inDisc(c, a) && inDisc(c, b)) pushSeg(c, a, c, b);
        }
    }
    for (let k = 0; k < 96; k++) {
        const a = (k / 96) * Math.PI * 2, b = ((k + 1) / 96) * Math.PI * 2;
        pushSeg(Math.cos(a), Math.sin(a), Math.cos(b), Math.sin(b));
    }
    const terrainMat = holo(new THREE.ShaderMaterial({
        uniforms: { uColor: { value: holoColor }, uOpacity: { value: 0 }, uTime: { value: 0 } },
        vertexShader: /* glsl */`
            varying float vR;
            void main() {
                vR = length(position.xz);
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }`,
        fragmentShader: /* glsl */`
            uniform vec3 uColor;
            uniform float uOpacity;
            uniform float uTime;
            varying float vR;
            void main() {
                float edge = 1.0 - smoothstep(0.6, 1.0, vR) * 0.6;
                float ripple = exp(-pow((vR - mod(uTime * 0.25, 1.2)) * 8.0, 2.0));
                gl_FragColor = vec4(uColor, uOpacity * (0.55 * edge + ripple * 0.6));
                #include <colorspace_fragment>
            }`
    }), 1);
    const terrainGeo = new THREE.BufferGeometry();
    terrainGeo.setAttribute('position', new THREE.Float32BufferAttribute(grid, 3));
    spin.add(new THREE.LineSegments(terrainGeo, terrainMat));

    const fill = (base) => holo(new THREE.MeshBasicMaterial({ color: holoColor, side: THREE.DoubleSide }), base);
    const ink = (base) => holo(new THREE.LineBasicMaterial({ color: holoColor }), base);
    const paleInk = (base) => holo(new THREE.LineBasicMaterial({ color: holoPale }), base);
    const onGround = (x, z, lift = 0) => new THREE.Vector3(x, terrainY(x, z) + lift, z);
    function outlined(geometry, at, fillBase, lineBase, quat) {
        const mesh = new THREE.Mesh(geometry, fill(fillBase));
        mesh.position.copy(at);
        if (quat) mesh.quaternion.copy(quat);
        mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry), ink(lineBase)));
        spin.add(mesh);
        return mesh;
    }

    // Solar rows, tilted toward the sun
    const panelTilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(-(Math.PI / 2 - 0.45), 0, 0));
    const panelGeo = new THREE.PlaneGeometry(0.15, 0.085);
    for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 5; c++) {
            const x = -0.78 + c * 0.17, z = 0.08 + r * 0.13;
            outlined(panelGeo, onGround(x, z, 0.05), 0.28, 0.85, panelTilt);
        }
    }

    // Wind turbine with a turning rotor
    const TURBINE = onGround(0.48, -0.22);
    outlined(new THREE.CylinderGeometry(0.014, 0.026, 0.78, 8, 1, true).translate(0, 0.39, 0), TURBINE, 0.3, 0.5);
    const hub = new THREE.Group();
    hub.position.copy(TURBINE).add(new THREE.Vector3(0, 0.78, 0));
    spin.add(hub);
    hub.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.055, 0.045, 0.12)), paleInk(0.9)));
    const rotor = new THREE.Group();
    rotor.position.z = 0.075;
    hub.add(rotor);
    const blades = [];
    for (let k = 0; k < 3; k++) {
        const a = (k * Math.PI * 2) / 3, ca = Math.cos(a), sa = Math.sin(a);
        const q = (x, y) => [x * ca - y * sa, x * sa + y * ca, 0];
        blades.push(...q(-0.022, 0.03), ...q(0.022, 0.03), ...q(0.006, 0.34), ...q(-0.022, 0.03), ...q(0.006, 0.34), ...q(-0.006, 0.34));
    }
    const bladeGeo = new THREE.BufferGeometry();
    bladeGeo.setAttribute('position', new THREE.Float32BufferAttribute(blades, 3));
    rotor.add(new THREE.Mesh(bladeGeo, fill(0.7)));

    // Two poles carry a sagging line to a battery
    const POLE_H = 0.3;
    const poleTops = [[0.2, -0.46], [-0.2, -0.5]].map(([x, z]) => {
        const base = onGround(x, z);
        outlined(new THREE.CylinderGeometry(0.008, 0.013, POLE_H, 6, 1, true).translate(0, POLE_H / 2, 0), base, 0.25, 0.6);
        const top = base.clone().add(new THREE.Vector3(0, POLE_H, 0));
        outlined(new THREE.BoxGeometry(0.12, 0.012, 0.012), top, 0.3, 0.7);
        return top;
    });
    const BATTERY = onGround(-0.62, -0.2);
    outlined(new THREE.BoxGeometry(0.22, 0.13, 0.15).translate(0, 0.065, 0), BATTERY, 0.22, 0.95);
    const linePts = [];
    const sag = (a, b) => { for (let k = 0; k <= 20; k++) { const u = k / 20; linePts.push(a.clone().lerp(b, u).add(new THREE.Vector3(0, -0.07 * 4 * u * (1 - u), 0))); } };
    sag(TURBINE.clone().add(new THREE.Vector3(0, 0.3, 0)), poleTops[0]);
    sag(poleTops[0], poleTops[1]);
    sag(poleTops[1], BATTERY.clone().add(new THREE.Vector3(0, 0.13, 0)));
    spin.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(linePts), ink(1)));

    // A few building blocks: the loads the microgrid serves
    [[0.32, 0.42, 0.16], [0.5, 0.28, 0.1], [0.18, 0.62, 0.12], [0.55, 0.52, 0.2]].forEach(([x, z, h]) => {
        outlined(new THREE.BoxGeometry(0.11, h, 0.11).translate(0, h / 2, 0), onGround(x, z), 0.12, 0.75);
    });

    // Standing parts: projector glow, volume, and rim ring
    const volumeMat = holo(new THREE.ShaderMaterial({
        uniforms: { uColor: { value: holoColor }, uOpacity: { value: 0 } },
        vertexShader: /* glsl */`
            varying float vY;
            void main() {
                vY = position.y;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }`,
        fragmentShader: /* glsl */`
            uniform vec3 uColor;
            uniform float uOpacity;
            varying float vY;
            void main() {
                gl_FragColor = vec4(uColor, uOpacity * pow(1.0 - clamp(vY / 1.1, 0.0, 1.0), 1.8) * 0.16);
                #include <colorspace_fragment>
            }`,
        side: THREE.DoubleSide
    }), 1);
    map.add(new THREE.Mesh(new THREE.CylinderGeometry(1.03, 1.03, 1.1, 64, 1, true).translate(0, 0.5, 0), volumeMat));
    const rim = new THREE.Mesh(new THREE.RingGeometry(1.06, 1.1, 128).rotateX(-Math.PI / 2), fill(0.55));
    rim.position.y = -0.08;
    map.add(rim);
    const rimTicks = [];
    for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        rimTicks.push(Math.cos(a) * 1.02, -0.08, Math.sin(a) * 1.02, Math.cos(a) * 1.02, 0.06, Math.sin(a) * 1.02);
    }
    const tickGeo = new THREE.BufferGeometry();
    tickGeo.setAttribute('position', new THREE.Float32BufferAttribute(rimTicks, 3));
    map.add(new THREE.LineSegments(tickGeo, ink(0.5)));
    map.traverse((o) => { o.renderOrder = 5; });

    function setHoloOpacity(t) {
        holoMats.forEach((m) => {
            const o = m.userData.base * t;
            if (m.isShaderMaterial) m.uniforms.uOpacity.value = o;
            else m.opacity = o;
        });
        map.visible = t > 0.003;
    }

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
        holoColor.set(v('--holo'));
        holoPale.set(v('--holo')).lerp(new THREE.Color(v('--bg')), 0.35);
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
        if (revealDone) startWave(TABLE);
        requestRender();
    }

    viewButtons.forEach((b) => b.addEventListener('click', () => setView(b.dataset.view, { chosen: true })));

    function applyState() {
        uniforms.uScan.value = state.scan;
        uniforms.uVR.value = state.vr;
        setHoloOpacity(state.virtual);
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
        orbit.radius = 12.2 * Math.max(1, 1.4 / camera.aspect);
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

    let lastFrame = null;

    function frame(now) {
        rafId = 0;
        let animating = false;
        const instant = reduceMotion.matches;
        // Time-based easing, so transitions take the same time at any frame rate
        const dt = lastFrame === null ? 16 : Math.min(1000, now - lastFrame);
        lastFrame = now;
        const ease = (tau) => (instant ? 1 : 1 - Math.exp(-dt / tau));

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
        const kv = ease(260);
        Object.keys(goal).forEach((key) => {
            state[key] += (goal[key] - state[key]) * kv;
            if (Math.abs(goal[key] - state[key]) > 0.002) animating = true;
            else state[key] = goal[key];
        });
        applyState();

        // The map turns slowly and the rotor spins whenever the hologram is showing
        if (map.visible && !instant) {
            spin.rotation.y += dt * 0.00012;
            rotor.rotation.z += dt * 0.0024;
            terrainMat.uniforms.uTime.value = now / 1000;
            animating = true;
        }

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
        const k = ease(200);
        look.az += (goalAz - look.az) * k;
        look.el += (goalEl - look.el) * k;
        if (Math.abs(goalAz - look.az) + Math.abs(goalEl - look.el) > 0.0005) animating = true;

        placeCamera();
        updateHit();
        renderer.render(scene, camera);

        if (animating && visible) requestRender();
        else lastFrame = null;
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
