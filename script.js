// ───────────────────────────── Shared: theme, nav, footer year

(function () {
    const root = document.documentElement;
    const themeButton = document.querySelector('.theme-toggle');

    function syncThemeButton() {
        if (!themeButton) return;
        const next = root.dataset.theme === 'light' ? 'dark' : 'light';
        themeButton.setAttribute('aria-label', `Switch to ${next} theme`);
    }

    if (themeButton) {
        syncThemeButton();
        themeButton.addEventListener('click', () => {
            root.dataset.theme = root.dataset.theme === 'light' ? 'dark' : 'light';
            try { localStorage.setItem('theme', root.dataset.theme); } catch (e) { }
            syncThemeButton();
            document.dispatchEvent(new CustomEvent('themechange'));
        });
    }

    const navToggle = document.querySelector('.nav-toggle');
    const navLinks = document.getElementById('nav-links');
    if (navToggle && navLinks) {
        const setOpen = (open) => {
            navLinks.classList.toggle('is-open', open);
            navToggle.setAttribute('aria-expanded', String(open));
            navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
        };
        navToggle.addEventListener('click', () => setOpen(!navLinks.classList.contains('is-open')));
        navLinks.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
    }

    const nav = document.querySelector('.site-nav');
    if (nav) {
        const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 8);
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
    }

    document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
})();

// ───────────────────────────── Projects: featured rows, index, filters, detail sheet

(function () {
    if (typeof PROJECTS === 'undefined') return;

    const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const byId = Object.fromEntries(PROJECTS.map((p) => [p.id, p]));

    function catTag(p) {
        const c = CATEGORIES[p.category] || { label: p.category };
        return `<span class="cat"${c.axis ? ` data-axis="${c.axis}"` : ''}>${esc(c.label)}</span>`;
    }

    const orgLine = (p) => [p.org, p.year].filter(Boolean).join(', ');

    function specsList(specs) {
        if (!specs || !specs.length) return '';
        return `<dl class="specs">${specs.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`;
    }

    // Featured
    const featuredEl = document.getElementById('featured');
    if (featuredEl) {
        const featured = PROJECTS.filter((p) => p.featured);
        const body = (p) => `
            ${catTag(p)}
            <h3>${esc(p.title)}</h3>
            ${orgLine(p) ? `<p class="feature-org">${esc(orgLine(p))}</p>` : ''}
            <p>${esc(p.summary)}</p>
            ${specsList(p.specs)}
            <button class="button" type="button" data-open="${esc(p.id)}">View project</button>`;

        const withMedia = featured.filter((p) => p.cover);
        const textOnly = featured.filter((p) => !p.cover);
        let html = withMedia.map((p) => `
            <article class="feature">
                <button class="feature-media" type="button" data-open="${esc(p.id)}" aria-label="Open ${esc(p.title)}">
                    <img src="${esc(p.cover.src)}" alt="${esc(p.cover.alt || '')}" loading="lazy">
                </button>
                <div class="feature-body">${body(p)}</div>
            </article>`).join('');
        for (let i = 0; i < textOnly.length; i += 2) {
            html += `<div class="feature-pair">${textOnly.slice(i, i + 2)
                .map((p) => `<article class="feature-body feature-text">${body(p)}</article>`).join('')}</div>`;
        }
        featuredEl.innerHTML = html;
    }

    // Index + filters
    const grid = document.getElementById('project-grid');
    const filters = document.getElementById('filters');
    if (grid) {
        grid.innerHTML = PROJECTS.map((p) => {
            const media = p.cover
                ? `<span class="card-media"><img src="${esc(p.cover.src)}" alt="" loading="lazy"${p.cover.fit === 'contain' ? ' data-fit="contain"' : ''}></span>`
                : `<span class="card-media is-blank"><span>${esc((p.tools || [])[0] || '')}</span></span>`;
            return `<li data-category="${esc(p.category)}">
                <button class="project-card" type="button" data-open="${esc(p.id)}">
                    ${media}
                    <span class="card-body">${catTag(p)}<h3>${esc(p.title)}</h3><p>${esc(p.summary)}</p></span>
                </button>
            </li>`;
        }).join('');
    }

    if (filters && grid) {
        const counts = {};
        PROJECTS.forEach((p) => { counts[p.category] = (counts[p.category] || 0) + 1; });
        const keys = Object.keys(CATEGORIES).filter((k) => counts[k]);
        filters.innerHTML =
            `<button class="filter" type="button" data-filter="all" aria-pressed="true">All <span class="count">${PROJECTS.length}</span></button>` +
            keys.map((k) => {
                const c = CATEGORIES[k];
                return `<button class="filter cat" type="button" data-filter="${k}" aria-pressed="false"${c.axis ? ` data-axis="${c.axis}"` : ''}>${esc(c.label)} <span class="count">${counts[k]}</span></button>`;
            }).join('');

        filters.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-filter]');
            if (!btn) return;
            const f = btn.dataset.filter;
            filters.querySelectorAll('[data-filter]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
            grid.querySelectorAll('li').forEach((li) => { li.hidden = f !== 'all' && li.dataset.category !== f; });
        });
    }

    const askEl = document.getElementById('ask-about');
    if (askEl && typeof ASK_ABOUT !== 'undefined') {
        askEl.innerHTML = ASK_ABOUT.map((t) => `<li>${esc(t)}</li>`).join('');
    }

    // Detail sheet, addressable at #project/<id>
    const sheet = document.getElementById('project-sheet');
    const inner = document.getElementById('sheet-inner');
    if (!sheet || !inner) return;

    let opener = null;

    function renderBlock(b) {
        switch (b.type) {
            case 'text':
                return String(b.text).split(/\n\n+/).map((t) => `<p>${esc(t)}</p>`).join('');
            case 'heading':
                return `<h3>${esc(b.text)}</h3>`;
            case 'list':
                return `<ul>${b.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`;
            case 'image':
                return `<figure><img src="${esc(b.src)}" alt="${esc(b.alt || '')}" loading="lazy">${b.caption ? `<figcaption>${esc(b.caption)}</figcaption>` : ''}</figure>`;
            case 'gallery':
                return `<div class="gallery">${b.images.map((img) => {
                    const src = typeof img === 'string' ? img : img.src;
                    const alt = typeof img === 'string' ? '' : img.alt || '';
                    return `<a href="${esc(src)}" target="_blank" rel="noopener"><img src="${esc(src)}" alt="${esc(alt)}" loading="lazy"></a>`;
                }).join('')}</div>`;
            case 'video':
                if (b.youtube) {
                    return `<div class="frame is-video"><iframe src="https://www.youtube-nocookie.com/embed/${esc(b.youtube)}" title="${esc(b.title || 'Video')}" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen></iframe></div>`;
                }
                return `<div class="frame"><video src="${esc(b.src)}"${b.poster ? ` poster="${esc(b.poster)}"` : ''} controls playsinline preload="metadata"></video></div>`;
            case 'embed':
                return `<div class="frame"><iframe src="${esc(b.url)}" title="${esc(b.title || 'Embedded site')}" height="${Number(b.height) || 600}" loading="lazy"></iframe></div>`;
            default:
                return '';
        }
    }

    function render(p) {
        const i = PROJECTS.indexOf(p);
        const prev = PROJECTS[(i - 1 + PROJECTS.length) % PROJECTS.length];
        const next = PROJECTS[(i + 1) % PROJECTS.length];
        const hasImageBlock = (p.body || []).some((b) => b.type === 'image' && p.cover && b.src === p.cover.src);
        const showCover = p.cover && p.cover.fit !== 'contain' && !hasImageBlock && !(p.body || []).some((b) => b.type === 'gallery');

        inner.innerHTML = `
            <div class="sheet-bar">
                ${catTag(p)}
                <button class="button sheet-close" type="button" data-close>Close</button>
            </div>
            <article class="sheet-content">
                <h2 id="sheet-title">${esc(p.title)}</h2>
                ${orgLine(p) ? `<p class="sheet-org">${esc(orgLine(p))}</p>` : ''}
                <p class="sheet-summary">${esc(p.summary)}</p>
                ${p.tools && p.tools.length ? `<ul class="tools" aria-label="Tools">${p.tools.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
                ${p.links && p.links.length ? `<div class="sheet-links">${p.links.map((l, n) => `<a class="button${n === 0 ? ' button-primary' : ''}" href="${esc(l.href)}"${/^https?:/.test(l.href) ? ' target="_blank" rel="noopener"' : ''}>${esc(l.label)}</a>`).join('')}</div>` : ''}
                ${showCover ? `<div class="sheet-cover"><img src="${esc(p.cover.src)}" alt="${esc(p.cover.alt || '')}"></div>` : ''}
                ${p.specs ? specsList(p.specs) : ''}
                ${p.body && p.body.length ? `<div class="blocks">${p.body.map(renderBlock).join('')}</div>` : ''}
                <nav class="sheet-nav" aria-label="More projects">
                    <button type="button" data-open="${esc(prev.id)}"><small>Previous</small>${esc(prev.title)}</button>
                    <button type="button" data-open="${esc(next.id)}"><small>Next</small>${esc(next.title)}</button>
                </nav>
            </article>`;
        sheet.scrollTop = 0;
        document.title = `${p.title}, Matthew Neuffer`;
    }

    const baseTitle = document.title;

    function openFromHash() {
        const m = location.hash.match(/^#project\/([\w-]+)$/);
        const p = m && byId[m[1]];
        if (p) {
            render(p);
            if (!sheet.open) {
                sheet.showModal();
                document.body.classList.add('has-sheet');
            }
            sheet.querySelector('[data-close]').focus({ preventScroll: true });
        } else if (sheet.open) {
            sheet.close();
        }
    }

    sheet.addEventListener('close', () => {
        document.body.classList.remove('has-sheet');
        document.title = baseTitle;
        inner.innerHTML = '';
        if (location.hash.startsWith('#project/')) {
            history.replaceState(null, '', location.pathname + location.search);
        }
        if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
    });

    sheet.addEventListener('click', (e) => {
        if (e.target === sheet || e.target.closest('[data-close]')) sheet.close();
    });

    document.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-open]');
        if (!btn) return;
        if (!sheet.open) opener = btn;
        location.hash = `project/${btn.dataset.open}`;
    });

    window.addEventListener('hashchange', openFromHash);
    openFromHash();
})();

// ───────────────────────────── Hero viewport
// A small software renderer: perspective camera at standing eye height, a room-scale
// floor grid, a play-area boundary that brightens near the ray, world axes, and a
// controller ray that hits the floor where you point. Click to drop spatial anchors.

(function () {
    const hero = document.querySelector('.hero');
    const canvas = hero && hero.querySelector('.hero-scene');
    if (!canvas || !canvas.getContext) return;
    const ctx = canvas.getContext('2d');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const hud = {};
    hero.querySelectorAll('[data-hud]').forEach((el) => { hud[el.dataset.hud] = el; });

    // Vector helpers
    const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
    const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
    const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const norm = (a) => mul(a, 1 / Math.hypot(a[0], a[1], a[2]));
    const lerp = (a, b, t) => a + (b - a) * t;

    const EYE = [0, 1.6, 4.6];
    const GRID_EXTENT = 8;
    const GRID_STEP = 0.5;
    const PLAY = { w: 3.0, d: 2.4, h: 2.0 };
    const MAX_ANCHORS = 6;

    let W = 0, H = 0, dpr = 1, focal = 1, cx = 0, cy = 0;
    let colors = {};
    let cam = { eye: EYE.slice(), f: [0, 0, -1], r: [1, 0, 0], u: [0, 1, 0] };
    let head = [0, 0];
    let pointer = null;
    let hit = null;
    const anchors = [];
    let anchorCount = 0;
    let visible = true;
    let rafId = 0;
    let frames = 0, fpsStamp = performance.now();

    function readColors() {
        const cs = getComputedStyle(document.documentElement);
        const v = (n) => cs.getPropertyValue(n).trim();
        colors = { grid: v('--grid'), line: v('--line-strong'), text: v('--text'), muted: v('--muted'), x: v('--x'), y: v('--y'), z: v('--z') };
    }

    function resize() {
        const rect = canvas.getBoundingClientRect();
        W = rect.width; H = rect.height;
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
        focal = (H / 2) / Math.tan((50 * Math.PI / 180) / 2);
        cx = W / 2; cy = H / 2;
        requestFrame();
    }

    function updateCamera() {
        const wide = W > 860;
        const eye = [EYE[0] + head[0], EYE[1] + head[1], EYE[2]];
        const target = wide ? [-1.9 + head[0] * 0.5, 0.55, 0] : [0, -0.9, 0];
        const f = norm(sub(target, eye));
        const r = norm(cross(f, [0, 1, 0]));
        const u = cross(r, f);
        cam = { eye, f, r, u };
    }

    function toCam(p) {
        const d = sub(p, cam.eye);
        return [dot(d, cam.r), dot(d, cam.u), dot(d, cam.f)];
    }

    const project = (c) => [cx + (c[0] / c[2]) * focal, cy - (c[1] / c[2]) * focal];

    // Adds a clipped segment to the current path
    function seg(a, b) {
        let ca = toCam(a), cb = toCam(b);
        const near = 0.05;
        if (ca[2] < near && cb[2] < near) return;
        if (ca[2] < near) { const t = (near - ca[2]) / (cb[2] - ca[2]); ca = ca.map((v, i) => lerp(v, cb[i], t)); }
        if (cb[2] < near) { const t = (near - cb[2]) / (ca[2] - cb[2]); cb = cb.map((v, i) => lerp(v, ca[i], t)); }
        const pa = project(ca), pb = project(cb);
        ctx.moveTo(pa[0], pa[1]);
        ctx.lineTo(pb[0], pb[1]);
    }

    function stroke(color, width, alpha, build) {
        ctx.beginPath();
        build();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.stroke();
        ctx.globalAlpha = 1;
    }

    function rayFromScreen(px, py) {
        return norm(add(cam.f, add(mul(cam.r, (px - cx) / focal), mul(cam.u, (cy - py) / focal))));
    }

    function floorHit(dir) {
        if (dir[1] > -0.002) return null;
        const t = -cam.eye[1] / dir[1];
        const p = add(cam.eye, mul(dir, t));
        return Math.abs(p[0]) > GRID_EXTENT || Math.abs(p[2]) > GRID_EXTENT ? null : p;
    }

    function drawGrid() {
        // Bucket 1 m segments by distance so the floor fades out without per-line gradients
        const buckets = 6;
        const paths = Array.from({ length: buckets }, () => []);
        for (let k = -GRID_EXTENT; k <= GRID_EXTENT; k += GRID_STEP) {
            for (let s = -GRID_EXTENT; s < GRID_EXTENT; s += 1) {
                const m = s + 0.5;
                const d1 = Math.hypot(k, m) / GRID_EXTENT;
                if (d1 < 1) paths[Math.min(buckets - 1, Math.floor(d1 * buckets))].push([[s, 0, k], [s + 1, 0, k]], [[k, 0, s], [k, 0, s + 1]]);
            }
        }
        paths.forEach((segs, i) => {
            stroke(colors.grid, 1, 1 - i / buckets, () => segs.forEach(([a, b]) => seg(a, b)));
        });
    }

    function boundaryPoints(step) {
        const { w, d } = PLAY;
        const corners = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]];
        const pts = [];
        corners.forEach((c, i) => {
            const n = corners[(i + 1) % 4];
            const len = Math.hypot(n[0] - c[0], n[1] - c[1]);
            const count = Math.round(len / step);
            for (let j = 0; j < count; j++) pts.push([lerp(c[0], n[0], j / count), lerp(c[1], n[1], j / count)]);
        });
        return pts;
    }
    const BOUNDARY = boundaryPoints(0.3);

    function drawBoundary() {
        const near = (x, z) => {
            if (!hit) return 0;
            return Math.max(0, 1 - Math.hypot(x - hit[0], z - hit[2]) / 1.4);
        };
        // Floor outline
        stroke(colors.z, 1.5, 0.75, () => {
            for (let i = 0; i < BOUNDARY.length; i++) {
                const a = BOUNDARY[i], b = BOUNDARY[(i + 1) % BOUNDARY.length];
                seg([a[0], 0, a[1]], [b[0], 0, b[1]]);
            }
        });
        // Walls: faint everywhere, brighter where the ray is close, like a headset boundary
        const levels = [0.5, 1.0, 1.5, PLAY.h];
        for (let i = 0; i < BOUNDARY.length; i++) {
            const a = BOUNDARY[i], b = BOUNDARY[(i + 1) % BOUNDARY.length];
            const glow = near((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
            const alpha = 0.1 + glow * 0.7;
            stroke(colors.z, 1, alpha, () => {
                seg([a[0], 0, a[1]], [a[0], PLAY.h, a[1]]);
                levels.forEach((y) => seg([a[0], y, a[1]], [b[0], y, b[1]]));
            });
        }
    }

    function label(text, p, dx, dy, color) {
        const c = toCam(p);
        if (c[2] < 0.1) return;
        const s = project(c);
        ctx.fillStyle = color;
        ctx.fillText(text, s[0] + dx, s[1] + dy);
    }

    function drawAxes() {
        const L = 0.6;
        [[colors.x, [L, 0, 0], 'x'], [colors.y, [0, L, 0], 'y'], [colors.z, [0, 0, L], 'z']].forEach(([col, end, name]) => {
            stroke(col, 2, 1, () => seg([0, 0, 0], end));
            label(name, end, 4, -4, col);
        });
    }

    function ring(center, radius, color, width, alpha) {
        stroke(color, width, alpha, () => {
            const n = 28;
            for (let i = 0; i < n; i++) {
                const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
                seg([center[0] + Math.cos(a0) * radius, 0, center[2] + Math.sin(a0) * radius],
                    [center[0] + Math.cos(a1) * radius, 0, center[2] + Math.sin(a1) * radius]);
            }
        });
    }

    function drawAnchors() {
        anchors.forEach((a) => {
            const base = [a.x, 0, a.z], top = [a.x, 0.4, a.z];
            ring(base, 0.08, colors.y, 1.25, 0.9);
            stroke(colors.y, 1.5, 1, () => {
                seg(base, top);
                const s = 0.05;
                seg([a.x - s, 0.4, a.z], [a.x, 0.4 + s, a.z]);
                seg([a.x, 0.4 + s, a.z], [a.x + s, 0.4, a.z]);
                seg([a.x + s, 0.4, a.z], [a.x, 0.4 - s, a.z]);
                seg([a.x, 0.4 - s, a.z], [a.x - s, 0.4, a.z]);
            });
            label(`a${a.n}  ${a.x.toFixed(2)}, ${a.z.toFixed(2)}`, top, 8, -6, colors.muted);
        });
    }

    function drawRay(dir) {
        const ctrl = add(cam.eye, add(mul(cam.r, 0.3), add(mul(cam.u, -0.36), mul(cam.f, 0.55))));
        const end = hit || add(cam.eye, mul(dir, 30));
        stroke(colors.text, 1.25, 0.85, () => seg(ctrl, end));
        if (hit) {
            ring(hit, 0.14, colors.text, 1.5, 0.95);
            ring(hit, 0.03, colors.text, 2, 0.95);
        }
    }

    function idlePoint(t) {
        // Before anyone points, sweep the ray in a slow figure-eight inside the play area
        const x = Math.sin(t * 0.00035) * 1.25;
        const z = Math.sin(t * 0.0007) * 0.9;
        const c = toCam([x, 0, z]);
        return project(c);
    }

    function draw(t) {
        updateCamera();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, H);
        ctx.font = '11px "JetBrains Mono", ui-monospace, monospace';
        ctx.lineCap = 'round';

        const pt = pointer || (reduceMotion.matches ? project(toCam([0.8, 0, 0.5])) : idlePoint(t));
        const dir = rayFromScreen(pt[0], pt[1]);
        hit = floorHit(dir);

        drawGrid();
        drawBoundary();
        drawAxes();
        drawAnchors();
        drawRay(dir);

        if (hud.head) hud.head.textContent = cam.eye.map((v) => v.toFixed(2)).join(' ');
        if (hud.hit) hud.hit.textContent = hit ? `x ${hit[0].toFixed(2).padStart(5)}  z ${hit[2].toFixed(2).padStart(5)}` : 'none';
        if (hud.anchors) hud.anchors.textContent = `${anchors.length} / ${MAX_ANCHORS}`;
    }

    function tick(t) {
        rafId = 0;
        // Ease head position toward the pointer for a little parallax
        const target = pointer && W > 860 ? [((pointer[0] / W) - 0.5) * 0.7, -((pointer[1] / H) - 0.5) * 0.3] : [0, 0];
        head = [lerp(head[0], target[0], 0.08), lerp(head[1], target[1], 0.08)];
        draw(t);

        frames++;
        if (t - fpsStamp > 500) {
            const fps = (frames * 1000) / (t - fpsStamp);
            if (hud.fps) hud.fps.textContent = reduceMotion.matches ? 'on demand' : `${fps.toFixed(0).padStart(3)} fps  ${(1000 / fps).toFixed(1)} ms`;
            frames = 0; fpsStamp = t;
        }

        const settling = Math.abs(head[0] - target[0]) + Math.abs(head[1] - target[1]) > 0.001;
        if (visible && (!reduceMotion.matches || settling)) requestFrame();
    }

    function requestFrame() {
        if (!rafId && W) rafId = requestAnimationFrame(tick);
    }

    function localPoint(e) {
        const rect = canvas.getBoundingClientRect();
        return [e.clientX - rect.left, e.clientY - rect.top];
    }

    hero.addEventListener('pointermove', (e) => {
        if (e.pointerType === 'touch') return;
        pointer = localPoint(e);
        requestFrame();
    });
    hero.addEventListener('pointerleave', () => { pointer = null; requestFrame(); });
    hero.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || e.target.closest('a, button')) return;
        pointer = localPoint(e);
        updateCamera();
        const p = floorHit(rayFromScreen(pointer[0], pointer[1]));
        if (p) {
            anchors.push({ x: p[0], z: p[2], n: ++anchorCount });
            if (anchors.length > MAX_ANCHORS) anchors.shift();
        }
        if (e.pointerType === 'touch') setTimeout(() => { pointer = null; requestFrame(); }, 1200);
        requestFrame();
    });

    new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        if (visible) requestFrame();
    }).observe(hero);

    document.addEventListener('themechange', () => { readColors(); requestFrame(); });
    reduceMotion.addEventListener('change', requestFrame);
    window.addEventListener('resize', resize);
    if (document.fonts) document.fonts.ready.then(requestFrame);

    readColors();
    resize();
})();
