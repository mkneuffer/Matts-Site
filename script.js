// ───────────────────────────── Shared: theme, nav, footer year

(function () {
    const root = document.documentElement;
    const themeButton = document.querySelector('.theme-toggle');

    function applyTheme(theme) {
        if (theme === 'dark') root.dataset.theme = 'dark';
        else delete root.dataset.theme;
        if (themeButton) themeButton.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
        document.dispatchEvent(new CustomEvent('themechange'));
    }

    applyTheme(root.dataset.theme === 'dark' ? 'dark' : 'light');

    if (themeButton) {
        themeButton.addEventListener('click', () => {
            const theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
            try { localStorage.setItem('theme', theme); } catch (e) { }
            applyTheme(theme);
        });
    }

    const navToggle = document.querySelector('.nav-toggle');
    const navLinks = document.getElementById('nav-links');
    if (navToggle && navLinks) {
        const setOpen = (open) => {
            navLinks.classList.toggle('is-open', open);
            navToggle.setAttribute('aria-expanded', String(open));
            navToggle.textContent = open ? 'Close' : 'Menu';
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

    const typeLabel = (p) => (CATEGORIES[p.category] || { label: p.category }).label;

    const orgLine = (p) => [p.org, p.year].filter(Boolean).join(', ');

    function specsList(specs) {
        if (!specs || !specs.length) return '';
        return `<dl class="specs">${specs.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`;
    }

    // Featured: a 2 x 2 grid
    const featuredEl = document.getElementById('featured');
    if (featuredEl) {
        featuredEl.innerHTML = PROJECTS.filter((p) => p.featured).map((p) => {
            const lines = p.coverText || (p.tools || []).slice(0, 3);
            const media = p.cover
                ? `<img src="${esc(p.cover.src)}" alt="${esc(p.cover.alt || '')}" loading="lazy"${p.cover.fit === 'contain' ? ' data-fit="contain"' : ''}>`
                : `<span class="case-type" aria-hidden="true">${lines.map((l) => `<span>${esc(l)}</span>`).join('')}</span>`;
            return `
            <article class="case">
                <button class="case-media${p.cover ? '' : ' is-type'}" type="button" data-open="${esc(p.id)}" aria-label="Open ${esc(p.title)}">${media}</button>
                <h3><button class="case-link" type="button" data-open="${esc(p.id)}">${esc(p.title)}</button></h3>
                <p class="case-meta">${esc([p.org, p.year].filter(Boolean).join(', ') || typeLabel(p))}</p>
                <p class="case-summary">${esc(p.summary)}</p>
            </article>`;
        }).join('');
    }

    // Index
    const grid = document.getElementById('project-grid');
    const filters = document.getElementById('filters');
    if (grid) {
        grid.innerHTML = PROJECTS.map((p) => {
            const thumb = p.cover
                ? `<img src="${esc(p.cover.src)}" alt="" loading="lazy"${p.cover.fit === 'contain' ? ' data-fit="contain"' : ''}>`
                : '';
            return `<li data-category="${esc(p.category)}">
                <button class="index-row" type="button" data-open="${esc(p.id)}">
                    <span class="index-thumb">${thumb}</span>
                    <span>
                        <span class="index-title">${esc(p.title)}</span>
                        <span class="index-summary">${esc(p.summary)}</span>
                    </span>
                    <span class="index-type">${esc(typeLabel(p))}</span>
                    <span class="index-when">${esc([p.org, p.year].filter(Boolean).join(', '))}</span>
                </button>
            </li>`;
        }).join('');
    }

    if (filters && grid) {
        const counts = {};
        PROJECTS.forEach((p) => { counts[p.category] = (counts[p.category] || 0) + 1; });
        const keys = Object.keys(CATEGORIES).filter((k) => counts[k]);
        filters.innerHTML =
            `<button class="filter" type="button" data-filter="all" aria-pressed="true">All<span class="count">${PROJECTS.length}</span></button>` +
            keys.map((k) => `<button class="filter" type="button" data-filter="${k}" aria-pressed="false">${esc(CATEGORIES[k].label)}<span class="count">${counts[k]}</span></button>`).join('');

        filters.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-filter]');
            if (!btn) return;
            const f = btn.dataset.filter;
            filters.querySelectorAll('[data-filter]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
            grid.querySelectorAll('li').forEach((li) => { li.hidden = f !== 'all' && li.dataset.category !== f; });
        });
    }

    const askEl = document.getElementById('ask-about');
    if (askEl && typeof ASK_ABOUT !== 'undefined' && ASK_ABOUT.length) {
        const list = ASK_ABOUT.length > 1
            ? `${ASK_ABOUT.slice(0, -1).join(', ')}, and ${ASK_ABOUT[ASK_ABOUT.length - 1]}`
            : ASK_ABOUT[0];
        askEl.textContent = `Not written up yet, but happy to walk you through: ${list}.`;
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
                <span>${esc(typeLabel(p))}</span>
                <button class="sheet-close" type="button" data-close>Close</button>
            </div>
            <article class="sheet-content">
                <h2 id="sheet-title">${esc(p.title)}</h2>
                ${orgLine(p) ? `<p class="sheet-org">${esc(orgLine(p))}</p>` : ''}
                <p class="sheet-summary">${esc(p.summary)}</p>
                ${p.links && p.links.length ? `<div class="sheet-links">${p.links.map((l, n) => `<a class="button" href="${esc(l.href)}"${/^https?:/.test(l.href) ? ' target="_blank" rel="noopener"' : ''}>${esc(l.label)}</a>`).join('')}</div>` : ''}
                ${showCover ? `<div class="sheet-cover"><img src="${esc(p.cover.src)}" alt="${esc(p.cover.alt || '')}"></div>` : ''}
                ${specsList([...(p.specs || []), ...(p.tools && p.tools.length ? [['Tools', p.tools.join(', ')]] : [])])}
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
