// Hero scene: an energy lab in mixed reality. The real room is drawn as clay; a planning table at
// its center projects a hologram that cycles through scenes from the kinds of work I build:
// a microgrid planner, a VR training lab, a campus AR tour, a data globe, a ring configurator,
// and a projection-mapped stage.
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
    const rippleMats = [];
    let rippleStart = 0;
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
        rippleMats.push(mat);
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

    // Scenes are composed facing +z; turn them to face the camera's resting direction
    const spin = new THREE.Group();
    spin.rotation.y = 0.72;
    map.add(spin);

    // ───────── Hologram scenes. Each builder returns an optional per-frame update(dt).
    const SCENES = [];
    function defineScene(id, title, build) {
        const group = new THREE.Group();
        group.visible = false;
        spin.add(group);
        const s = { id, title, group, mats: [], fade: 0, update: null };
        layerMats = s.mats;
        s.update = build(group) || null;
        SCENES.push(s);
    }

    // Microgrid planner: terrain, solar rows, wind turbine, poles and a line to a battery, loads
    defineScene('microgrid', 'Microgrid planner', (g) => {
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

    // Shared builders for the scenes below
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    function segs(parent, flatPts, base, deep = false) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(flatPts, 3));
        const ls = new THREE.LineSegments(geo, ink(base, deep));
        parent.add(ls);
        return ls;
    }
    function poly(parent, points, base, deep = false) {
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), ink(base, deep));
        parent.add(line);
        return line;
    }
    // A projected-light material: stripes and a sweep that move across the surface
    function patternMat(base) {
        const mat = holo(new THREE.ShaderMaterial({
            uniforms: { uColor: { value: holoColor }, uOpacity: { value: 0 }, uTime: { value: 0 } },
            vertexShader: /* glsl */`
                varying vec3 vP;
                void main() {
                    vP = position;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }`,
            fragmentShader: /* glsl */`
                uniform vec3 uColor;
                uniform float uOpacity;
                uniform float uTime;
                varying vec3 vP;
                void main() {
                    float stripes = step(0.55, fract(vP.x * 9.0 - uTime * 0.6 + sin(vP.y * 7.0 + uTime) * 0.4));
                    float sweep = exp(-pow((vP.y - fract(uTime * 0.35) * 0.8) * 9.0, 2.0));
                    gl_FragColor = vec4(uColor, uOpacity * (0.12 + 0.5 * stripes + 0.6 * sweep));
                    #include <colorspace_fragment>
                }`,
            side: THREE.DoubleSide
        }), base);
        timeUniforms.push(mat);
        return mat;
    }
    const sinPulse = (t, speed = 0.004) => 0.5 + 0.5 * Math.sin(t * speed);
    // Points an object's +z at a point in its parent's space (lookAt works in world space)
    const aimM = new THREE.Matrix4();
    const aim = (obj, x, y, z) => obj.quaternion.setFromRotationMatrix(aimM.lookAt(V(x, y, z), obj.position, UP));

    // VR training lab: a trainer wall with a breaker panel, conduit and outlets, a workbench, and a
    // headset whose gaze ray finds the breaker the trainee has to operate
    defineScene('training', 'VR training lab', (g) => {
        discGrid(g, flat, 14);
        outlined(g, new THREE.BoxGeometry(1.1, 0.66, 0.04), V(0, 0.36, -0.42), 0.08, 0.6);
        outlined(g, new THREE.BoxGeometry(0.38, 0.48, 0.06), V(-0.22, 0.38, -0.37), 0.14, 0.9);
        segs(g, [-0.41, 0.6, -0.335, -0.03, 0.6, -0.335, -0.22, 0.6, -0.335, -0.22, 0.16, -0.335], 0.3);
        let target = null;
        for (let row = 0; row < 5; row++) {
            for (let col = 0; col < 2; col++) {
                const at = V(-0.3 + col * 0.16, 0.24 + row * 0.08, -0.33);
                const isTarget = row === 3 && col === 1;
                const b = outlined(g, new THREE.BoxGeometry(0.11, 0.05, 0.03), at, isTarget ? 0.55 : 0.18, isTarget ? 1 : 0.6);
                if (isTarget) target = b;
            }
        }
        // Conduit from the panel up and across the wall, down to two outlets
        poly(g, [V(-0.22, 0.62, -0.38), V(-0.22, 0.66, -0.38), V(0.3, 0.66, -0.38), V(0.3, 0.52, -0.38)], 0.7, true);
        outlined(g, new THREE.BoxGeometry(0.08, 0.11, 0.035), V(0.3, 0.46, -0.38), 0.18, 0.8);
        outlined(g, new THREE.BoxGeometry(0.08, 0.11, 0.035), V(0.3, 0.3, -0.38), 0.18, 0.8);
        poly(g, [V(0.3, 0.405, -0.38), V(0.3, 0.355, -0.38)], 0.7, true);
        // Workbench with a meter on it
        outlined(g, new THREE.BoxGeometry(0.86, 0.03, 0.26), V(0, 0.27, -0.05), 0.16, 0.85);
        segs(g, [-0.4, 0, -0.15, -0.4, 0.255, -0.15, 0.4, 0, -0.15, 0.4, 0.255, -0.15, -0.4, 0, 0.05, -0.4, 0.255, 0.05, 0.4, 0, 0.05, 0.4, 0.255, 0.05], 0.55);
        outlined(g, new THREE.BoxGeometry(0.09, 0.03, 0.13), V(0.22, 0.3, -0.05), 0.3, 0.9);
        // Headset: visor, front cameras, strap, floating at standing eye height
        const headset = new THREE.Group();
        headset.position.set(0.42, 0.62, 0.42);
        aim(headset, target.position.x, target.position.y, target.position.z);
        g.add(headset);
        const visor = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.09), fill(0.3));
        visor.add(new THREE.LineSegments(new THREE.EdgesGeometry(visor.geometry), ink(1, true)));
        headset.add(visor);
        [-0.05, 0, 0.05].forEach((x) => {
            const c = new THREE.Mesh(new THREE.CircleGeometry(0.012, 12), fill(0.8));
            c.position.set(x, 0, 0.046);
            headset.add(c);
        });
        const strap = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.008, 6, 32, Math.PI), fill(0.4));
        strap.rotation.set(Math.PI / 2, 0, 0);
        strap.position.z = -0.04;
        headset.add(strap);
        const gaze = poly(g, [headset.position.clone(), target.position.clone().add(V(0, 0, 0.02))], 0.8, true);
        const targetMat = target.material;
        let t = 0;
        return (dt) => {
            t += dt;
            targetMat.userData.base = 0.25 + 0.45 * sinPulse(t);
            headset.position.y = 0.62 + 0.015 * Math.sin(t * 0.002);
            gaze.geometry.attributes.position.setY(0, headset.position.y);
            gaze.geometry.attributes.position.needsUpdate = true;
        };
    });

    // Campus AR tour: an architectural model on an image target, viewed through a phone
    defineScene('campus', 'Campus AR tour', (g) => {
        discGrid(g, flat, 14);
        // Image target with corner brackets
        const T = 0.62, k = 0.1, y = 0.004;
        const corners = [];
        [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sz]) => {
            const cx = sx * T, cz = sz * T;
            corners.push(cx, y, cz, cx - sx * k, y, cz, cx, y, cz, cx, y, cz - sz * k);
        });
        segs(g, corners, 1, true);
        // Hall with a pitched roof, windows, and a clock tower
        const hall = new THREE.Group();
        hall.position.set(-0.12, 0, -0.08);
        g.add(hall);
        outlined(hall, new THREE.BoxGeometry(0.56, 0.2, 0.3).translate(0, 0.1, 0), V(0, 0, 0), 0.16, 0.9);
        const roofShape = new THREE.Shape();
        roofShape.moveTo(-0.3, 0);
        roofShape.lineTo(0.3, 0);
        roofShape.lineTo(0, 0.12);
        roofShape.closePath();
        const roof = new THREE.ExtrudeGeometry(roofShape, { depth: 0.32, bevelEnabled: false }).translate(0, 0, -0.16);
        outlined(hall, roof, V(0, 0.2, 0), 0.22, 0.9);
        const windows = [];
        for (let i = 0; i < 6; i++) {
            const x = -0.23 + i * 0.092;
            [0.05, 0.12].forEach((wy) => windows.push(x - 0.022, wy, 0.151, x + 0.022, wy, 0.151, x - 0.022, wy + 0.045, 0.151, x + 0.022, wy + 0.045, 0.151, x - 0.022, wy, 0.151, x - 0.022, wy + 0.045, 0.151, x + 0.022, wy, 0.151, x + 0.022, wy + 0.045, 0.151));
        }
        segs(hall, windows, 0.45);
        outlined(hall, new THREE.BoxGeometry(0.1, 0.42, 0.1).translate(0, 0.21, 0), V(0, 0, 0.2), 0.2, 0.9);
        outlined(hall, new THREE.ConeGeometry(0.085, 0.12, 4).rotateY(Math.PI / 4).translate(0, 0.48, 0), V(0, 0, 0.2), 0.3, 0.9);
        const clock = new THREE.Mesh(new THREE.RingGeometry(0.02, 0.028, 20), fill(0.8));
        clock.position.set(0, 0.34, 0.251);
        hall.add(clock);
        // Modern block with floor lines
        const block = outlined(g, new THREE.BoxGeometry(0.22, 0.34, 0.2).translate(0, 0.17, 0), V(0.38, 0, -0.3), 0.12, 0.85);
        const floors = [];
        for (let f = 1; f < 5; f++) {
            const fy = f * 0.068;
            floors.push(-0.11, fy, 0.101, 0.11, fy, 0.101, 0.111, fy, -0.1, 0.111, fy, 0.1);
        }
        segs(block, floors, 0.45);
        // Trees and a curved walk
        [[-0.5, 0.35], [-0.32, 0.45], [0.05, 0.48], [0.45, 0.2], [0.52, 0.42], [-0.55, -0.4]].forEach(([x, z]) => {
            segs(g, [x, 0, z, x, 0.07, z], 0.6);
            outlined(g, new THREE.IcosahedronGeometry(0.055, 0), V(x, 0.11, z), 0.16, 0.7);
        });
        poly(g, new THREE.CatmullRomCurve3([V(-0.62, 0.006, 0.22), V(-0.2, 0.006, 0.28), V(0.15, 0.006, 0.3), V(0.3, 0.006, 0.05), V(0.38, 0.006, -0.12)]).getPoints(48), 0.9, true);
        // Phone looking down at the model, with its camera frustum
        const phone = new THREE.Group();
        phone.position.set(0.42, 0.72, 0.48);
        aim(phone, -0.1, 0.1, -0.1);
        g.add(phone);
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.3, 0.012), fill(0.12));
        body.add(new THREE.LineSegments(new THREE.EdgesGeometry(body.geometry), ink(1, true)));
        phone.add(body);
        segs(phone, [-0.07, 0.13, -0.007, 0.07, 0.13, -0.007, 0.07, 0.13, -0.007, 0.07, -0.13, -0.007, 0.07, -0.13, -0.007, -0.07, -0.13, -0.007, -0.07, -0.13, -0.007, -0.07, 0.13, -0.007], 0.5);
        phone.updateMatrix();
        const lens = new THREE.Vector3(0, 0.1, 0.01).applyMatrix4(phone.matrix);
        const frustum = [];
        [[-T, -T], [T, -T], [T, T], [-T, T]].forEach(([x, z]) => frustum.push(lens.x, lens.y, lens.z, x * 0.75, 0.004, z * 0.75));
        segs(g, frustum, 0.25);
        let t = 0;
        return (dt) => {
            t += dt;
            phone.position.y = 0.72 + 0.012 * Math.sin(t * 0.0018);
        };
    });

    // Data globe: spikes rising from locations, and arcs with packets traveling between them
    defineScene('data', 'Data visualization', (g) => {
        const R = 0.38, C = V(0, 0.5, 0);
        // Stand and orbit ring
        outlined(g, new THREE.CylinderGeometry(0.16, 0.22, 0.05, 32).translate(0, 0.025, 0), V(0, 0, 0), 0.16, 0.7);
        segs(g, [0, 0.05, 0, 0, 0.12, 0], 0.7);
        const orbit = new THREE.Mesh(new THREE.TorusGeometry(R + 0.09, 0.004, 4, 96), fill(0.6));
        orbit.position.copy(C);
        orbit.rotation.set(Math.PI / 2 - 0.22, 0, 0.18);
        g.add(orbit);
        const globe = new THREE.Group();
        globe.position.copy(C);
        g.add(globe);
        globe.add(new THREE.Mesh(new THREE.SphereGeometry(R, 32, 16), fill(0.05)));
        // Latitude and longitude lines
        const grat = [];
        for (let lat = -60; lat <= 60; lat += 30) {
            const phi = (lat * Math.PI) / 180, r = R * Math.cos(phi), yy = R * Math.sin(phi);
            for (let k = 0; k < 64; k++) {
                const a = (k / 64) * Math.PI * 2, b = ((k + 1) / 64) * Math.PI * 2;
                grat.push(Math.cos(a) * r, yy, Math.sin(a) * r, Math.cos(b) * r, yy, Math.sin(b) * r);
            }
        }
        for (let lon = 0; lon < 180; lon += 30) {
            const th = (lon * Math.PI) / 180;
            for (let k = 0; k < 64; k++) {
                const a = (k / 64) * Math.PI * 2, b = ((k + 1) / 64) * Math.PI * 2;
                grat.push(Math.cos(a) * R * Math.cos(th), Math.sin(a) * R, Math.cos(a) * R * Math.sin(th), Math.cos(b) * R * Math.cos(th), Math.sin(b) * R, Math.cos(b) * R * Math.sin(th));
            }
        }
        segs(globe, grat, 0.35);
        const onSphere = (lat, lon, r = R) => {
            const p = (lat * Math.PI) / 180, l = (lon * Math.PI) / 180;
            return V(r * Math.cos(p) * Math.cos(l), r * Math.sin(p), r * Math.cos(p) * Math.sin(l));
        };
        const sites = [[42, -71, 0.2], [51, 0, 0.14], [37, -122, 0.17], [35, 139, 0.12], [-33, 151, 0.08], [1, 103, 0.1], [19, 72, 0.13], [-23, -46, 0.09], [52, 13, 0.11], [25, 55, 0.07]];
        sites.forEach(([lat, lon, h]) => {
            const base = onSphere(lat, lon);
            const tip = onSphere(lat, lon, R + h);
            segs(globe, [base.x, base.y, base.z, tip.x, tip.y, tip.z], 1, true);
            const cap = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), fill(0.9));
            cap.position.copy(tip);
            globe.add(cap);
        });
        // Arcs lifted off the surface, each with a packet moving along it
        const arcs = [[0, 1], [0, 2], [1, 8], [3, 5], [6, 9], [0, 7], [4, 3]].map(([a, b]) => {
            const pa = onSphere(sites[a][0], sites[a][1]).normalize(), pb = onSphere(sites[b][0], sites[b][1]).normalize();
            const pts = [];
            for (let k = 0; k <= 40; k++) {
                const u = k / 40;
                const dir = pa.clone().lerp(pb, u).normalize();
                pts.push(dir.multiplyScalar(R + 0.18 * Math.sin(Math.PI * u) * pa.distanceTo(pb) * 0.7));
            }
            poly(globe, pts, 0.7);
            const packet = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), fill(1));
            globe.add(packet);
            return { pts, packet, u: Math.random() };
        });
        return (dt) => {
            globe.rotation.y += dt * 0.0002;
            arcs.forEach((a) => {
                a.u = (a.u + dt * 0.00035) % 1;
                const f = a.u * (a.pts.length - 1), i = Math.floor(f);
                a.packet.position.copy(a.pts[i]).lerp(a.pts[Math.min(i + 1, a.pts.length - 1)], f - i);
            });
        };
    });

    // Ring configurator: a solitaire with cathedral shoulders, six prongs and a faceted round
    // brilliant, with metal swatches orbiting it
    defineScene('ring', 'Ring configurator', (g) => {
        discGrid(g, flat, 12);
        outlined(g, new THREE.CylinderGeometry(0.26, 0.3, 0.06, 48).translate(0, 0.03, 0), V(0, 0, 0), 0.14, 0.7);
        outlined(g, new THREE.CylinderGeometry(0.2, 0.26, 0.03, 48).translate(0, 0.075, 0), V(0, 0, 0), 0.1, 0.5);
        const ring = new THREE.Group();
        ring.position.y = 0.42;
        g.add(ring);
        // Shank: a slightly flattened torus
        const shank = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.03, 12, 96), fill(0.25));
        shank.scale.z = 1.5;
        shank.add(new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.TorusGeometry(0.24, 0.03, 4, 48)), ink(0.25)));
        ring.add(shank);
        // Cathedral shoulders rising into the basket
        const topY = 0.27;
        [-1, 1].forEach((s) => {
            poly(ring, new THREE.QuadraticBezierCurve3(V(s * 0.16, 0.18, 0), V(s * 0.1, 0.27, 0), V(s * 0.05, 0.31, 0)).getPoints(16), 0.9, true);
            poly(ring, new THREE.QuadraticBezierCurve3(V(s * 0.18, 0.15, 0.03), V(s * 0.1, 0.25, 0.04), V(s * 0.05, 0.3, 0.03)).getPoints(16), 0.5);
        });
        // Round brilliant: table, crown, girdle, pavilion, culet, as a lathe
        const gr = 0.085;
        const profile = [V(0, -0.085, 0), V(gr, 0, 0), V(gr, 0.008, 0), V(gr * 0.56, 0.042, 0), V(0, 0.042, 0)].map((p) => new THREE.Vector2(p.x, p.y));
        const stoneGeo = new THREE.LatheGeometry(profile, 16);
        const stone = new THREE.Mesh(stoneGeo, fill(0.32));
        stone.add(new THREE.LineSegments(new THREE.EdgesGeometry(stoneGeo, 1), ink(1, true)));
        stone.position.y = topY + 0.1;
        ring.add(stone);
        // Basket and six prongs curving over the girdle
        const basket = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.006, 4, 24), fill(0.6));
        basket.rotation.x = Math.PI / 2;
        basket.position.y = topY + 0.04;
        ring.add(basket);
        for (let k = 0; k < 6; k++) {
            const a = (k / 6) * Math.PI * 2;
            const c = Math.cos(a), s = Math.sin(a);
            poly(ring, new THREE.QuadraticBezierCurve3(V(c * 0.05, topY + 0.04, s * 0.05), V(c * 0.1, topY + 0.08, s * 0.1), V(c * 0.075, topY + 0.125, s * 0.075)).getPoints(10), 1, true);
        }
        // Metal swatches orbiting: the configurator's choices
        const swatches = new THREE.Group();
        swatches.position.y = 0.3;
        g.add(swatches);
        [0, 1, 2].forEach((i) => {
            const a = (i / 3) * Math.PI * 2;
            const sw = outlined(swatches, new THREE.SphereGeometry(0.045, 16, 10), V(Math.cos(a) * 0.62, 0, Math.sin(a) * 0.62), i === 0 ? 0.55 : 0.18, i === 0 ? 1 : 0.5);
            if (i === 0) {
                const sel = new THREE.Mesh(new THREE.RingGeometry(0.065, 0.072, 32), fill(0.9));
                sel.rotation.x = -Math.PI / 2;
                sel.position.y = -0.05;
                sw.add(sel);
            }
        });
        return (dt) => {
            ring.rotation.y += dt * 0.0005;
            swatches.rotation.y -= dt * 0.00018;
        };
    });

    // Projection mapping: a faceted stage set lit by a projector, with a moving projected pattern
    defineScene('projection', 'Projection mapping', (g) => {
        discGrid(g, flat, 14);
        outlined(g, new THREE.BoxGeometry(1.0, 0.05, 0.5).translate(0, 0.025, 0), V(0, 0, -0.15), 0.14, 0.85);
        // Faceted backdrop: angled panels share one projected pattern
        const pattern = patternMat(0.9);
        const facets = [
            { w: 0.26, h: 0.5, x: -0.36, z: -0.3, ry: 0.45, rx: 0 },
            { w: 0.26, h: 0.62, x: -0.12, z: -0.36, ry: 0.12, rx: -0.08 },
            { w: 0.26, h: 0.62, x: 0.14, z: -0.36, ry: -0.12, rx: -0.08 },
            { w: 0.26, h: 0.5, x: 0.38, z: -0.3, ry: -0.45, rx: 0 },
            { w: 0.22, h: 0.22, x: 0.0, z: -0.12, ry: 0, rx: -0.6 }
        ];
        const backdrop = [];
        facets.forEach((f) => {
            const geo = new THREE.PlaneGeometry(f.w, f.h).translate(0, f.h / 2, 0);
            const m = new THREE.Mesh(geo, pattern);
            m.position.set(f.x, 0.05, f.z);
            m.rotation.set(f.rx, f.ry, 0);
            m.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), ink(0.9)));
            g.add(m);
            backdrop.push(m);
        });
        // Speakers either side
        [-0.58, 0.58].forEach((x) => outlined(g, new THREE.BoxGeometry(0.1, 0.2, 0.09).translate(0, 0.1, 0), V(x, 0, -0.12), 0.18, 0.8));
        // Overhead truss
        const truss = [];
        [-0.52, 0.52].forEach((x) => truss.push(x, 0.05, 0.08, x, 0.82, 0.08));
        truss.push(-0.52, 0.82, 0.08, 0.52, 0.82, 0.08, -0.52, 0.78, 0.08, 0.52, 0.78, 0.08);
        for (let k = 0; k < 10; k++) {
            const x0 = -0.52 + (k * 1.04) / 10, x1 = x0 + 1.04 / 10;
            truss.push(x0, 0.78, 0.08, x1, 0.82, 0.08);
        }
        segs(g, truss, 0.55);
        // Projector and its frustum onto the backdrop
        const projector = outlined(g, new THREE.BoxGeometry(0.14, 0.07, 0.12), V(0, 0.5, 0.62), 0.25, 1);
        aim(projector, 0, 0.3, -0.3);
        const lens = V(0, 0.5, 0.56);
        const frustum = [];
        [V(-0.48, 0.05, -0.24), V(0.48, 0.05, -0.24), V(-0.24, 0.72, -0.38), V(0.24, 0.72, -0.38)].forEach((p) => frustum.push(lens.x, lens.y, lens.z, p.x, p.y, p.z));
        segs(g, frustum, 0.3, true);
        return null;
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

    // ───────── Scene cycling: a new scene every few seconds, named in a label under the figure
    const sceneLabel = figure.querySelector('[data-scene-label]');
    const HOLD_MS = 7000;
    let active = 0;
    let heldFor = 0;
    let holoIn = 0;

    function showScene(index) {
        active = (index + SCENES.length) % SCENES.length;
        heldFor = 0;
        if (sceneLabel) sceneLabel.textContent = SCENES[active].title;
        requestRender();
    }

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
        // Every click sends a fresh pulse: a scan wave from the surface hit (or the table) and a
        // new ripple across the hologram grid
        startWave(hit ? hit.point : TABLE);
        rippleStart = performance.now();
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
        if (holoIn > 0.5 && !instant) {
            heldFor += dt;
            if (heldFor > HOLD_MS) showScene(active + 1);
            animating = true;
        }
        SCENES.forEach((s, i) => { s.fade = approach(s.fade, i === active ? 1 : 0, 220); });
        applyHologram();

        // Live motion in the visible scenes
        if (map.visible && !instant) {
            timeUniforms.forEach((m) => { m.uniforms.uTime.value = now / 1000; });
            rippleMats.forEach((m) => { m.uniforms.uTime.value = (now - rippleStart) / 1000; });
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
