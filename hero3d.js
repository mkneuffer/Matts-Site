// Hero scene: an energy lab in mixed reality. The real room is drawn as clay; a planning table at
// its center projects a hologram that cycles through scenes from the kinds of work I build:
// a microgrid map, a campus AR tour, a data visualization, and a ring configurator.
// On load, a depth-scan wave spreads from the table and the hologram rises once the room is mapped.
// Point at a surface to place a reticle; click to scan from there.

import * as THREE from 'three';

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

    // ───────── Shared uniforms for the room
    const uniforms = {
        uSurfaceA: { value: new THREE.Color() },
        uSurfaceB: { value: new THREE.Color() },
        uInk: { value: new THREE.Color() },
        uAccent: { value: new THREE.Color() },
        uInkAlpha: { value: 0.5 },
        uRevealOrigin: { value: TABLE.clone() },
        uRevealRadius: { value: 0 },
        uWaveOrigin: { value: new THREE.Vector3() },
        uWaveRadius: { value: -10 },
        uWaveStrength: { value: 0 }
    };

    const common = /* glsl */`
        uniform vec3 uRevealOrigin;
        uniform float uRevealRadius;
        uniform vec3 uWaveOrigin;
        uniform float uWaveRadius;
        uniform float uWaveStrength;
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
            return max(g, band(p, uWaveOrigin, uWaveRadius, 0.025) * uWaveStrength);
        }
    `;

    const makeSurface = (tone) => new THREE.ShaderMaterial({
        uniforms: { ...uniforms, uTone: { value: tone } },
        vertexShader: /* glsl */`
            varying vec3 vWorld;
            varying vec3 vNormal;
            void main() {
                vec4 w = modelMatrix * vec4(position, 1.0);
                vWorld = w.xyz;
                vNormal = normalize(mat3(modelMatrix) * normal);
                gl_Position = projectionMatrix * viewMatrix * w;
            }`,
        fragmentShader: /* glsl */`
            uniform vec3 uSurfaceA;
            uniform vec3 uSurfaceB;
            uniform vec3 uAccent;
            uniform float uTone;
            varying vec3 vNormal;
            ${common}
            void main() {
                if (revealed(vWorld) < 0.02) discard;
                vec3 n = normalize(vNormal);
                float light = 0.5 + 0.5 * max(dot(n, normalize(vec3(0.5, 0.9, 0.7))), 0.0);
                // Darken toward the room's inside corners: the middle of the three plane distances
                vec3 c = vec3(vWorld.y, vWorld.x + 3.0, vWorld.z + 2.5);
                float mid = c.x + c.y + c.z - max(c.x, max(c.y, c.z)) - min(c.x, min(c.y, c.z));
                float ao = mix(0.74, 1.0, smoothstep(0.0, 1.2, mid));
                vec3 col = mix(uSurfaceA, uSurfaceB, light * uTone) * ao;
                col = mix(col, uAccent, scanGlow(vWorld) * 0.35);
                gl_FragColor = vec4(col, 1.0);
                #include <colorspace_fragment>
            }`,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1
    });
    const TONES = { floor: makeSurface(0.72), shell: makeSurface(0.86), object: makeSurface(1.0) };

    const lineMat = (colorExpr, alphaExpr) => new THREE.ShaderMaterial({
        uniforms,
        vertexShader: /* glsl */`
            varying vec3 vWorld;
            void main() {
                vec4 w = modelMatrix * vec4(position, 1.0);
                vWorld = w.xyz;
                gl_Position = projectionMatrix * viewMatrix * w;
            }`,
        fragmentShader: /* glsl */`
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
            }`,
        transparent: true,
        depthWrite: false
    });
    const edgeMat = lineMat('mix(uInk, uAccent, g)', 'r * uInkAlpha + g * 0.9');
    const guideMat = lineMat('mix(uInk, uAccent, g)', 'r * uInkAlpha * 0.35 + g * 0.6');
    const boundaryMat = lineMat('uAccent', 'r * 0.9');

    // ───────── Room geometry (meters). Back wall at z = -2.5, left wall at x = -3.
    const solids = [];
    const room = new THREE.Group();
    scene.add(room);

    function solid(geometry, at, { tone = 'object', quat = null } = {}) {
        const mesh = new THREE.Mesh(geometry, TONES[tone]);
        mesh.position.set(...at);
        if (quat) mesh.quaternion.copy(quat);
        mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 25), edgeMat));
        room.add(mesh);
        solids.push(mesh);
        return mesh;
    }
    const box = (w, h, d, at, opts) => solid(new THREE.BoxGeometry(w, h, d), at, opts);
    const cyl = (r, h, at, seg = 20) => solid(new THREE.CylinderGeometry(r, r, h, seg), at);
    const UP = new THREE.Vector3(0, 1, 0);
    function rod(r, from, to) {
        const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
        const quat = new THREE.Quaternion().setFromUnitVectors(UP, b.clone().sub(a).normalize());
        solid(new THREE.CylinderGeometry(r, r, a.distanceTo(b), 10), a.clone().add(b).multiplyScalar(0.5).toArray(), { quat });
    }

    // Shell: floor and two walls, thin so they read as a cutaway
    box(6, 0.08, 5, [0, -0.04, 0], { tone: 'floor' });
    box(6, 3, 0.08, [0, 1.5, -2.54], { tone: 'shell' });
    box(0.08, 3, 5, [-3.04, 1.5, 0], { tone: 'shell' });

    // Round planning table on a pedestal
    cyl(TABLE_R, 0.06, [TABLE.x, TABLE.y - 0.03, TABLE.z], 48);
    cyl(0.3, TABLE.y - 0.06, [TABLE.x, (TABLE.y - 0.06) / 2, TABLE.z], 24);
    cyl(0.6, 0.04, [TABLE.x, 0.02, TABLE.z], 32);

    // Back wall: distribution panel, sub-panel, disconnect, junction box
    box(0.75, 1.05, 0.2, [-1.75, 1.45, -2.4]);
    box(0.5, 0.72, 0.18, [-0.85, 1.6, -2.41]);
    box(0.3, 0.45, 0.15, [0.05, 1.5, -2.43]);
    box(0.14, 0.2, 0.08, [0.95, 1.3, -2.46]);

    // Conduit runs
    rod(0.035, [-2.98, 2.62, -2.42], [1.4, 2.62, -2.42]);
    rod(0.03, [-1.75, 1.98, -2.42], [-1.75, 2.62, -2.42]);
    rod(0.03, [-0.85, 1.96, -2.42], [-0.85, 2.62, -2.42]);
    rod(0.025, [0.05, 1.73, -2.43], [0.05, 2.62, -2.43]);
    rod(0.025, [0.95, 1.4, -2.47], [0.95, 2.62, -2.47]);

    // Battery storage cabinets along the left wall
    [-1.65, -0.85, -0.05].forEach((z) => {
        box(0.7, 1.9, 0.72, [-2.63, 0.95, z]);
        box(0.02, 0.06, 0.12, [-2.27, 1.55, z - 0.18]);
        box(0.02, 1.6, 0.01, [-2.27, 0.95, z + 0.05]);
    });
    box(0.3, 0.08, 3.6, [-2.82, 2.45, -0.4]);

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

    // ───────── Hologram over the table
    // Everything is in unit-disc coordinates (x, z in -1..1, y up), scaled to the table.
    const holoColor = new THREE.Color();
    const holoDeep = new THREE.Color();
    const MAP_R = 1.08;
    const map = new THREE.Group();
    map.position.set(TABLE.x, TABLE.y + 0.12, TABLE.z);
    map.scale.setScalar(MAP_R);
    map.visible = false;
    scene.add(map);

    // Each material belongs to one layer (the base, or one scene) and has its own base opacity
    let layerMats = null;
    function holo(mat, base, deep = false) {
        mat.userData.base = base;
        mat.userData.deep = deep;
        Object.assign(mat, { transparent: true, depthWrite: false });
        layerMats.push(mat);
        return mat;
    }
    const fill = (base) => holo(new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), base);
    const ink = (base, deep = false) => holo(new THREE.LineBasicMaterial(), base, deep);

    function outlined(parent, geometry, at, fillBase, lineBase, quat) {
        const mesh = new THREE.Mesh(geometry, fill(fillBase));
        mesh.position.copy(at);
        if (quat) mesh.quaternion.copy(quat);
        if (lineBase > 0) mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 20), ink(lineBase)));
        parent.add(mesh);
        return mesh;
    }

    // A grid cut to the disc, each line subdivided so it can follow a height function, plus a rim.
    // A ring of light ripples outward across it.
    const timeUniforms = [];
    function discGrid(parent, heightAt, cells = 16) {
        const pts = [];
        const sub = 3, n = cells * sub;
        const inside = (x, z) => x * x + z * z <= 1.0001;
        const seg = (ax, az, bx, bz) => pts.push(ax, heightAt(ax, az), az, bx, heightAt(bx, bz), bz);
        for (let i = 0; i <= cells; i++) {
            const c = -1 + (2 * i) / cells;
            for (let k = 0; k < n; k++) {
                const a = -1 + (2 * k) / n, b = a + 2 / n;
                if (inside(a, c) && inside(b, c)) seg(a, c, b, c);
                if (inside(c, a) && inside(c, b)) seg(c, a, c, b);
            }
        }
        for (let k = 0; k < 96; k++) {
            const a = (k / 96) * Math.PI * 2, b = ((k + 1) / 96) * Math.PI * 2;
            seg(Math.cos(a), Math.sin(a), Math.cos(b), Math.sin(b));
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
        const mat = holo(new THREE.ShaderMaterial({
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
                    gl_FragColor = vec4(uColor, uOpacity * (0.5 * edge + ripple * 0.55));
                    #include <colorspace_fragment>
                }`
        }), 1);
        parent.add(new THREE.LineSegments(geo, mat));
        timeUniforms.push(mat);
    }
    const flat = () => 0;

    // Base: projector volume, rim ring, ticks. Present whenever the hologram shows.
    const base = { mats: [] };
    layerMats = base.mats;
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
    const ticks = [];
    for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        ticks.push(Math.cos(a) * 1.02, -0.08, Math.sin(a) * 1.02, Math.cos(a) * 1.02, 0.06, Math.sin(a) * 1.02);
    }
    const tickGeo = new THREE.BufferGeometry();
    tickGeo.setAttribute('position', new THREE.Float32BufferAttribute(ticks, 3));
    map.add(new THREE.LineSegments(tickGeo, ink(0.5)));

    const spin = new THREE.Group();
    map.add(spin);

    // ───────── Hologram scenes. Each builder returns an optional per-frame update(dt).
    const SCENES = [];
    function defineScene(id, build) {
        const group = new THREE.Group();
        group.visible = false;
        spin.add(group);
        const s = { id, group, mats: [], fade: 0, update: null };
        layerMats = s.mats;
        s.update = build(group) || null;
        SCENES.push(s);
    }

    // Microgrid planner: terrain, solar rows, wind turbine, poles and a line to a battery, loads
    defineScene('microgrid', (g) => {
        const terrainY = (x, z) => (1 - 0.35 * (x * x + z * z)) * (0.06 * Math.sin(2.1 * x) * Math.cos(1.7 * z) + 0.03 * Math.sin(4.3 * x + 3.1 * z) + 0.015 * Math.sin(7.7 * z + 5.3 * x));
        discGrid(g, terrainY);
        const onGround = (x, z, lift = 0) => new THREE.Vector3(x, terrainY(x, z) + lift, z);

        const tilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(-(Math.PI / 2 - 0.45), 0, 0));
        const panel = new THREE.PlaneGeometry(0.15, 0.085);
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 5; c++) outlined(g, panel, onGround(-0.78 + c * 0.17, 0.08 + r * 0.13, 0.05), 0.28, 0.85, tilt);
        }

        const turbine = onGround(0.48, -0.22);
        outlined(g, new THREE.CylinderGeometry(0.014, 0.026, 0.78, 8, 1, true).translate(0, 0.39, 0), turbine, 0.3, 0.5);
        const hub = new THREE.Group();
        hub.position.copy(turbine).add(new THREE.Vector3(0, 0.78, 0));
        g.add(hub);
        hub.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.055, 0.045, 0.12)), ink(0.9, true)));
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

        const POLE_H = 0.3;
        const tops = [[0.2, -0.46], [-0.2, -0.5]].map(([x, z]) => {
            const foot = onGround(x, z);
            outlined(g, new THREE.CylinderGeometry(0.008, 0.013, POLE_H, 6, 1, true).translate(0, POLE_H / 2, 0), foot, 0.25, 0.6);
            const top = foot.clone().add(new THREE.Vector3(0, POLE_H, 0));
            outlined(g, new THREE.BoxGeometry(0.12, 0.012, 0.012), top, 0.3, 0.7);
            return top;
        });
        const battery = onGround(-0.62, -0.2);
        outlined(g, new THREE.BoxGeometry(0.22, 0.13, 0.15).translate(0, 0.065, 0), battery, 0.22, 0.95);
        const line = [];
        const sag = (a, b) => { for (let k = 0; k <= 20; k++) { const u = k / 20; line.push(a.clone().lerp(b, u).add(new THREE.Vector3(0, -0.28 * u * (1 - u), 0))); } };
        sag(turbine.clone().add(new THREE.Vector3(0, 0.3, 0)), tops[0]);
        sag(tops[0], tops[1]);
        sag(tops[1], battery.clone().add(new THREE.Vector3(0, 0.13, 0)));
        g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(line), ink(1)));

        [[0.32, 0.42, 0.16], [0.5, 0.28, 0.1], [0.18, 0.62, 0.12], [0.55, 0.52, 0.2]].forEach(([x, z, h]) => {
            outlined(g, new THREE.BoxGeometry(0.11, h, 0.11).translate(0, h / 2, 0), onGround(x, z), 0.12, 0.75);
        });

        return (dt) => { rotor.rotation.z += dt * 0.0024; };
    });

    // Campus AR tour: one building opened up floor by floor, its neighbors, and a pin on a route
    defineScene('campus', (g) => {
        discGrid(g, flat, 14);
        const floorGeo = new THREE.BoxGeometry(0.62, 0.035, 0.4);
        const partitions = [[-0.31, 0, 0.31, 0], [0, -0.2, 0, 0.2], [-0.1, 0, -0.1, -0.2], [0.15, 0, 0.15, 0.2]];
        for (let f = 0; f < 4; f++) {
            const current = f === 2;
            const plate = outlined(g, floorGeo, new THREE.Vector3(-0.2, 0.06 + f * 0.17, -0.1), current ? 0.4 : 0.14, current ? 1 : 0.7);
            const walls = [];
            partitions.forEach(([ax, az, bx, bz]) => walls.push(ax, 0.02, az, bx, 0.02, bz, ax, 0.075, az, bx, 0.075, bz));
            const wg = new THREE.BufferGeometry();
            wg.setAttribute('position', new THREE.Float32BufferAttribute(walls, 3));
            plate.add(new THREE.LineSegments(wg, ink(0.45)));
        }
        const columns = [];
        [[-0.5, -0.29], [0.1, -0.29], [-0.5, 0.09], [0.1, 0.09]].forEach(([x, z]) => columns.push(x, 0, z, x, 0.6, z));
        const colGeo = new THREE.BufferGeometry();
        colGeo.setAttribute('position', new THREE.Float32BufferAttribute(columns, 3));
        g.add(new THREE.LineSegments(colGeo, ink(0.35)));

        [[0.45, -0.45, 0.24, 0.18, 0.2], [0.58, 0.12, 0.2, 0.3, 0.32], [-0.55, 0.55, 0.26, 0.2, 0.14], [0.12, 0.62, 0.22, 0.16, 0.22]].forEach(([x, z, w, d, h]) => {
            outlined(g, new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0), new THREE.Vector3(x, 0, z), 0.1, 0.65);
        });

        const route = new THREE.CatmullRomCurve3([
            new THREE.Vector3(-0.85, 0.01, 0.3), new THREE.Vector3(-0.3, 0.01, 0.32), new THREE.Vector3(0.0, 0.01, 0.36),
            new THREE.Vector3(0.32, 0.01, 0.3), new THREE.Vector3(0.36, 0.01, -0.1), new THREE.Vector3(0.28, 0.01, -0.72)
        ]);
        g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(route.getPoints(80)), ink(0.9, true)));
        const pin = new THREE.Group();
        g.add(pin);
        outlined(pin, new THREE.ConeGeometry(0.035, 0.1, 12).rotateX(Math.PI).translate(0, 0.1, 0), new THREE.Vector3(), 0.6, 0.9);
        outlined(pin, new THREE.SphereGeometry(0.035, 12, 8).translate(0, 0.17, 0), new THREE.Vector3(), 0.6, 0);
        pin.add(new THREE.Mesh(new THREE.RingGeometry(0.05, 0.065, 32).rotateX(-Math.PI / 2), fill(0.7)));
        let u = 0;
        return (dt) => {
            u = (u + dt * 0.00009) % 1;
            pin.position.copy(route.getPointAt(u));
        };
    });

    // Data visualization: a 3D bar chart on a grid, with one series traced across the top
    defineScene('data', (g) => {
        discGrid(g, flat, 14);
        const value = (i, j) => 0.12 + 0.55 * (0.5 + 0.5 * Math.sin(i * 0.9 + 0.6) * Math.cos(j * 0.7 - 0.3)) * (0.6 + 0.08 * i);
        const bars = [];
        const step = 0.2;
        for (let i = 0; i < 6; i++) {
            for (let j = 0; j < 4; j++) {
                const h = value(i, j);
                const series = j === 1;
                const bar = outlined(g, new THREE.BoxGeometry(0.11, 1, 0.11).translate(0, 0.5, 0),
                    new THREE.Vector3(-0.5 + i * step, 0, -0.3 + j * step), series ? 0.38 : 0.16, series ? 1 : 0.7);
                bar.scale.y = h;
                bars.push({ bar, h, i, j });
            }
        }
        const axes = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(-0.62, 0, 0.42), new THREE.Vector3(0.62, 0, 0.42),
            new THREE.Vector3(-0.62, 0, 0.42), new THREE.Vector3(-0.62, 0, -0.42),
            new THREE.Vector3(-0.62, 0, -0.42), new THREE.Vector3(-0.62, 0.8, -0.42)
        ]);
        g.add(new THREE.LineSegments(axes, ink(0.8, true)));
        const gridlines = [];
        for (let k = 1; k <= 3; k++) gridlines.push(-0.62, k * 0.2, -0.42, 0.62, k * 0.2, -0.42);
        const glGeo = new THREE.BufferGeometry();
        glGeo.setAttribute('position', new THREE.Float32BufferAttribute(gridlines, 3));
        g.add(new THREE.LineSegments(glGeo, ink(0.25)));

        const series = bars.filter((b) => b.j === 1);
        const traceGeo = new THREE.BufferGeometry().setFromPoints(series.map((b) => new THREE.Vector3(-0.5 + b.i * step, b.h + 0.04, -0.3 + step)));
        g.add(new THREE.Line(traceGeo, ink(1, true)));
        let t = 0;
        return (dt) => {
            t += dt * 0.001;
            const pos = traceGeo.attributes.position;
            bars.forEach((b) => {
                b.bar.scale.y = b.h * (0.92 + 0.08 * Math.sin(t * 1.4 + b.i * 0.8 + b.j));
                if (b.j === 1) pos.setY(b.i, b.bar.scale.y + 0.04);
            });
            pos.needsUpdate = true;
        };
    });

    // Ring configurator: a ring on a display plinth, turning, with a set stone
    defineScene('ring', (g) => {
        discGrid(g, flat, 12);
        outlined(g, new THREE.CylinderGeometry(0.34, 0.38, 0.08, 48).translate(0, 0.04, 0), new THREE.Vector3(), 0.12, 0.6);
        const ring = new THREE.Group();
        ring.position.y = 0.5;
        g.add(ring);
        const band = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.045, 14, 64), fill(0.22));
        band.add(new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.TorusGeometry(0.3, 0.045, 6, 48)), ink(0.3)));
        ring.add(band);
        const setting = new THREE.Group();
        setting.position.y = 0.33;
        ring.add(setting);
        const prongs = [];
        for (let k = 0; k < 4; k++) {
            const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
            prongs.push(Math.cos(a) * 0.04, 0, Math.sin(a) * 0.04, Math.cos(a) * 0.1, 0.1, Math.sin(a) * 0.1);
        }
        const prongGeo = new THREE.BufferGeometry();
        prongGeo.setAttribute('position', new THREE.Float32BufferAttribute(prongs, 3));
        setting.add(new THREE.LineSegments(prongGeo, ink(0.9, true)));
        const stone = new THREE.Group();
        stone.position.y = 0.1;
        setting.add(stone);
        const crown = new THREE.CylinderGeometry(0.07, 0.11, 0.05, 8).translate(0, 0.025, 0);
        const pavilion = new THREE.ConeGeometry(0.11, 0.11, 8).rotateX(Math.PI).translate(0, -0.055, 0);
        [crown, pavilion].forEach((geo) => {
            const m = new THREE.Mesh(geo, fill(0.35));
            m.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 1), ink(1, true)));
            stone.add(m);
        });
        return (dt) => { ring.rotation.y += dt * 0.0006; };
    });

    layerMats = null;

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
        uniforms.uInk.value.set(v('--scene-ink'));
        uniforms.uAccent.value.set(v('--accent'));
        uniforms.uInkAlpha.value = parseFloat(v('--scene-ink-alpha')) || 0.5;
        ringMat.color.set(v('--accent'));
        // Uniforms hold references, but material colors are copies, so set those directly
        holoColor.set(v('--holo'));
        holoDeep.set(v('--holo-2'));
        [base, ...SCENES].forEach((layer) => layer.mats.forEach((m) => {
            if (m.color) m.color.copy(m.userData.deep ? holoDeep : holoColor);
        }));
        requestRender();
    }

    // ───────── Scene cycling. Buttons under the figure track the cycle; choosing one stops it.
    const sceneButtons = Array.from(figure.querySelectorAll('[data-scene]'));
    const HOLD_MS = 7000;
    let active = 0;
    let autoCycle = true;
    let heldFor = 0;
    let holoIn = 0;

    function showScene(index, { chosen = false } = {}) {
        active = (index + SCENES.length) % SCENES.length;
        heldFor = 0;
        if (chosen) autoCycle = false;
        sceneButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.scene === SCENES[active].id)));
        requestRender();
    }

    sceneButtons.forEach((b) => b.addEventListener('click', () => {
        showScene(SCENES.findIndex((s) => s.id === b.dataset.scene), { chosen: true });
    }));

    function setOpacity(m, o) {
        const v = m.userData.base * o;
        if (m.isShaderMaterial) m.uniforms.uOpacity.value = v;
        else m.opacity = v;
    }

    function applyHologram() {
        shadowMat.opacity = 0.22 * Math.min(1, uniforms.uRevealRadius.value / 6);
        map.visible = holoIn > 0.003;
        base.mats.forEach((m) => setOpacity(m, holoIn));
        SCENES.forEach((s) => {
            const o = holoIn * s.fade;
            s.group.visible = o > 0.003;
            // Scenes rise out of the disc as they arrive and sink as they leave
            s.group.scale.y = 0.05 + 0.95 * s.fade;
            s.mats.forEach((m) => setOpacity(m, o));
        });
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
            reticle.visible = false;
            return;
        }
        const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
        reticle.position.copy(hit.point).addScaledVector(normal, 0.01);
        reticle.lookAt(hit.point.clone().add(normal));
        reticle.visible = true;
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
    let lastFrame = null;

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
        // Time-based easing, so transitions take the same time at any frame rate
        const dt = lastFrame === null ? 16 : Math.min(1000, now - lastFrame);
        lastFrame = now;
        const approach = (from, to, tau) => {
            const next = instant ? to : from + (to - from) * (1 - Math.exp(-dt / tau));
            if (Math.abs(to - next) <= 0.002) return to;
            animating = true;
            return next;
        };

        // Map the room outward from the table, then raise the hologram
        if (revealStart === null) revealStart = instant ? now - REVEAL_MS : now;
        const rt = Math.min(1, (now - revealStart) / REVEAL_MS);
        uniforms.uRevealRadius.value = easeOut(rt) * 9.5;
        if (rt < 1) animating = true;
        holoIn = approach(holoIn, rt >= 0.6 ? 1 : 0, 320);

        // Cycle scenes while the hologram is up
        if (holoIn > 0.5 && autoCycle && !instant) {
            heldFor += dt;
            if (heldFor > HOLD_MS) showScene(active + 1);
            animating = true;
        }
        SCENES.forEach((s, i) => { s.fade = approach(s.fade, i === active ? 1 : 0, 220); });
        applyHologram();

        // Live motion in the visible scenes, and a slow turn of the whole map
        if (map.visible && !instant) {
            spin.rotation.y += dt * 0.00008;
            timeUniforms.forEach((m) => { m.uniforms.uTime.value = now / 1000; });
            SCENES.forEach((s) => { if (s.group.visible && s.update) s.update(dt); });
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
        look.az = approach(look.az, orbit.az + (pointerN ? (pointerN.x - 0.5) * 0.16 : 0), 200);
        look.el = approach(look.el, orbit.el + (pointerN ? (pointerN.y - 0.5) * 0.06 : 0), 200);

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

    showScene(0);
    readColors();
    resize();
    figure.classList.add('is-ready');
}
