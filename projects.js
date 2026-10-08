/*
 * Project data. The work grid, filters, and project pages are all built from this list.
 *
 * To add a project, copy an entry and edit it. Only `id`, `title`, `category`, and
 * `summary` are required. The page lives at  matthewneuffer.com/#project/<id>.
 *
 *   id        url-safe slug, unique
 *   title     project name
 *   category  'xr' | 'ar' | 'web' | 'play' | 'design'  (see CATEGORIES below)
 *   summary   one or two sentences, shown on the card and at the top of the page
 *   org       who it was for or where it was built (optional)
 *   year      e.g. '2025' or '2024–25' (optional)
 *   featured  true to show it in the large "Selected work" rows (optional)
 *   cover     { src, fit: 'cover' | 'contain', alt } — omit for a text-only card
 *   tools     ['Unity', 'OpenXR', ...]
 *   specs     [['Engine', 'Unreal Engine 5'], ...]  — key/value table on the page
 *   links     [{ label: 'Open the live site', href: 'https://...' }]
 *   body      content blocks, rendered in order:
 *               { type: 'text',    text: '...' }               (a paragraph; use \n\n for more)
 *               { type: 'heading', text: '...' }
 *               { type: 'list',    items: ['...', '...'] }
 *               { type: 'image',   src: '...', alt: '...', caption: '...' }
 *               { type: 'gallery', images: ['a.jpg', { src: 'b.jpg', alt: '...' }] }
 *               { type: 'video',   youtube: 'VIDEO_ID', title: '...' }
 *               { type: 'video',   src: 'videos/clip.mp4', poster: '...' }   (self-hosted)
 *               { type: 'embed',   url: 'https://...', height: 640, title: '...' }
 */

const CATEGORIES = {
    xr: { label: 'VR & mixed reality', axis: 'z' },
    ar: { label: 'Augmented reality', axis: 'y' },
    web: { label: 'Web & real-time 3D', axis: 'x' },
    play: { label: 'Games & interaction', axis: null },
    design: { label: '3D renders & graphic design', axis: null }
};

const PROJECTS = [
    // ───────────────────────────── VR & MR
    {
        id: 'electrician-training-lab',
        title: 'Electrician Virtual Training Lab',
        category: 'xr',
        featured: true,
        org: 'ProtoGen',
        year: '2025–present',
        summary: 'High-fidelity VR simulations of hazard mitigation and electrical safety procedures, running standalone on Meta Quest 3 and extended to desktop and mixed reality from one codebase.',
        cover: { src: 'images/web/esamtac.jpg', alt: 'Energy storage and microgrid training lab, the setting for the VR training simulations' },
        tools: ['Unreal Engine 5', 'OpenXR', 'Meta Quest 3', 'LMS / LRS'],
        specs: [
            ['Engine', 'Unreal Engine 5'],
            ['Runtime', 'OpenXR'],
            ['Targets', 'Meta Quest 3 (standalone), desktop, mixed reality'],
            ['Integrations', 'Custom learning management system, LRS, custom APIs']
        ],
        links: [
            { label: 'Read the launch announcement', href: 'https://www.linkedin.com/posts/protogen-energy_skillsgap-energyworkforce-mixedreality-activity-7368742068308828160-nCLV' }
        ],
        body: [
            { type: 'text', text: 'Trainees practice hazard mitigation and safety procedures in a virtual electrical lab.' },
            { type: 'heading', text: 'What I work on' },
            {
                type: 'list', items: [
                    'Simulation development in Unreal Engine 5 with OpenXR, targeting Meta Quest 3.',
                    'CPU and GPU optimization across desktop and Quest 3 mobile hardware, and extending the shared codebase to support VR and mixed reality.',
                    'An end-to-end learning management system that delivers content and captures trainee performance for instructor review, connected to the VR application through custom APIs and LMS/LRS integration.'
                ]
            }
        ]
    },
    {
        id: 'impact-of-ai',
        title: 'Impact of AI in VR',
        category: 'xr',
        featured: true,
        org: 'The Global Lab at WPI',
        year: '2024–25',
        summary: 'An interactive VR data visualization that turns research on the environmental cost of AI (water, electricity, emissions) into a 3D experience for non-technical audiences.',
        tools: ['Unity', 'OpenXR', 'Meta Quest 3', 'Blender', 'ZBrush'],
        specs: [
            ['Engine', 'Unity'],
            ['Runtime', 'OpenXR'],
            ['Hardware', 'Meta Quest 3, standalone'],
            ['Data', 'Sourced from research papers and reports with lab partners']
        ],
        links: [
            { label: 'Read the process write-up', href: 'workprocess.html' }
        ],
        body: [
            { type: 'text', text: 'The goal was to help people understand how AI systems work and what they consume.' },
            { type: 'heading', text: 'Approach' },
            {
                type: 'list', items: [
                    'Scoped the experience with WPI stakeholders around three themes: environmental visualization, how AI works, and user engagement.',
                    'Chose Meta Quest 3 for standalone deployment and Unity with OpenXR for fast iteration and cross-platform support.',
                    'Built with prefabs and reusable scripts so new data scenes could be added without new systems, and profiled to keep frame times stable on the headset.',
                    'Ran iterative playtests with internal and external users and demoed regularly to supervisors.'
                ]
            },
            { type: 'text', text: 'Alongside the project I researched current VR and MR hardware and SDKs to guide the lab’s development decisions, and curated XR resources for students and faculty.' }
        ]
    },
    {
        id: 'vr-framework-webxr-pipeline',
        title: 'VR framework and WebXR packaging pipeline',
        category: 'xr',
        featured: true,
        year: '2025–26',
        summary: 'Development pipelines and framework extensions for VR and learning content, including a WebXR packaging step that runs at the highest refresh rate Meta Quest 3 supports.',
        tools: ['WebXR', 'Claude Code', 'Codex', 'Meta Quest 3'],
        specs: [
            ['Platform', 'WebXR in the Meta Quest browser'],
            ['Focus', 'CPU/GPU performance, refresh rate, repeatable builds'],
            ['Tooling', 'Claude Code, Codex, custom framework extensions']
        ],
        body: [
            {
                type: 'list', items: [
                    'Built VR and learning-content development pipelines with Claude Code and Codex, plus custom extensions to the framework underneath them.',
                    'Built a WebXR packaging pipeline that improves CPU and GPU performance and enables the maximum supported refresh rate on Meta Quest 3.'
                ]
            }
        ]
    },

    // ───────────────────────────── AR
    {
        id: 'spi-glass',
        title: 'SPI-Glass',
        category: 'ar',
        summary: 'A multiplayer AR game that combines spatial computing with interactive storytelling.',
        cover: { src: 'images/web/spiglass.jpg', fit: 'contain', alt: 'SPI-Glass logo: a magnifying glass over a ghost and compass' },
        tools: ['Unity', 'Niantic Lightship ARDK'],
        specs: [
            ['Engine', 'Unity'],
            ['AR platform', 'Niantic Lightship ARDK'],
            ['Networking', 'Real-time multiplayer']
        ],
        body: [
            { type: 'text', text: 'I engineered the multiplayer AR storytelling and gameplay systems, the UI, and the real-time networked interactions between players.' },
            { type: 'video', youtube: '92WVTq7zrRo', title: 'SPI-Glass gameplay' },
            { type: 'video', youtube: 'arjJOnzfRAQ', title: 'SPI-Glass gameplay, part 2' },
            { type: 'video', youtube: 'ozFHFssEuPA', title: 'SPI-Glass gameplay, part 3' }
        ]
    },
    {
        id: 'blair-ar-tour',
        title: 'Blair AR Tour',
        category: 'ar',
        org: 'Blair Academy',
        summary: 'A mobile AR campus tour that places 3D, floor-by-floor models of Blair Academy’s newest building on any table.',
        cover: { src: 'images/web/blair.jpg', fit: 'contain', alt: 'AR model of a building floor plan on a wooden table, with floor selection buttons' },
        tools: ['Unity', 'Vuforia SDK', 'Android', 'iOS'],
        specs: [
            ['Engine', 'Unity'],
            ['Tracking', 'Vuforia image and marker tracking'],
            ['Platforms', 'Android, iOS']
        ],
        body: [
            { type: 'video', youtube: '90IBRlpX-ec', title: 'Blair AR Tour walkthrough' }
        ]
    },
    {
        id: 'conserve-africa',
        title: 'Conserve AfRica',
        category: 'ar',
        summary: 'A mobile AR scavenger hunt that promotes conservation awareness through interactive 3D content.',
        cover: { src: 'images/web/conserve-africa.jpg', fit: 'contain', alt: 'Conserve AfRica AR scavenger hunt on a phone' },
        tools: ['Unity', 'Vuforia SDK', 'Android', 'iOS'],
        links: [{ label: 'Open the project site', href: 'https://conserveafrica.matthewneuffer.com/' }],
        body: [
            { type: 'embed', url: 'https://conserveafrica.matthewneuffer.com/', height: 640, title: 'Conserve AfRica project site' }
        ]
    },
    {
        id: 'okta-mailer',
        title: 'Okta mailer AR demo',
        category: 'ar',
        summary: 'A proof-of-concept AR experience that brings printed mailers for C-suite clients to life on a phone.',
        cover: { src: 'images/web/okta.jpg', fit: 'contain', alt: 'AR content appearing over a printed mailer' },
        tools: ['AR', 'Mobile'],
        body: [
            { type: 'image', src: 'images/web/okta.jpg', alt: 'AR content appearing over a printed mailer' }
        ]
    },
    {
        id: 'art-tours',
        title: 'ARt Tours',
        category: 'ar',
        org: 'Human-computer interaction course, WPI',
        summary: 'An AR museum tour that adds context around sculptures to enhance the visit.',
        cover: { src: 'images/web/arttour.jpg', fit: 'contain', alt: 'AR overlay beside a sculpture' },
        tools: ['AR', 'HCI'],
        body: [
            { type: 'video', youtube: 'PE4BJ_MdSOM', title: 'ARt Tours demo' }
        ]
    },
    {
        id: 'ar-pool',
        title: 'AR Pool',
        category: 'ar',
        org: 'Tangible and embodied interaction course, WPI',
        summary: 'A tabletop AR pool game built to test the limits of Reality Composer.',
        cover: { src: 'images/web/arpool.jpg', fit: 'contain', alt: 'Virtual pool table placed on a real surface' },
        tools: ['Reality Composer', 'ARKit', 'iOS'],
        body: [
            { type: 'video', youtube: 'oV3e9NF-3Wc', title: 'AR Pool demo' }
        ]
    },

    // ───────────────────────────── Web & real-time 3D
    {
        id: 'ring-visualizer',
        title: '3D ring visualizer',
        category: 'web',
        org: 'Robert Corio Designs',
        year: '2023–24',
        summary: 'Real-time, in-browser 3D previews of custom rings with accurate metals and gemstones, plus a holographic display prototype.',
        cover: { src: 'images/web/ringvis.jpg', fit: 'contain', alt: 'Gold ring with a round diamond rendered in real time' },
        tools: ['WebGI', 'three.js', 'Looking Glass'],
        body: [
            { type: 'text', text: 'Clients could review their custom designs in real-time 3D before production, which increased engagement and sales. I also researched and prototyped a hardware-software integration to show the same 3D jewelry assets on Looking Glass holographic displays in store.' },
            { type: 'image', src: 'images/web/ringvis.jpg', alt: 'Gold ring with a round diamond rendered in real time' }
        ]
    },
    {
        id: 'robert-corio',
        title: 'Robert Corio Designs',
        category: 'web',
        org: 'Robert Corio Designs',
        year: '2023–24',
        summary: 'Brand website, online jewelry configurator, and a searchable render database that cut render turnaround time by 75%.',
        cover: { src: 'images/web/robertcorio.jpg', alt: 'Robert Corio Designs website' },
        tools: ['WebGI', 'Web development', 'UI/UX'],
        links: [{ label: 'Open robertcorio.com', href: 'https://robertcorio.com' }],
        body: [
            {
                type: 'list', items: [
                    'Designed and built an online jewelry configurator and three custom brand websites.',
                    'Built an interactive render database with user-facing search so clients find their renders with a private code, reducing render turnaround time by 75%.'
                ]
            },
            { type: 'embed', url: 'https://robertcorio.com', height: 640, title: 'robertcorio.com' }
        ]
    },
    {
        id: 'hegeman',
        title: 'Hegeman & Co',
        category: 'web',
        org: 'Robert Corio Designs',
        summary: 'Custom jewelry website with an interactive product configurator and visualization tools.',
        cover: { src: 'images/web/hegeman.jpg', alt: 'Hegeman & Co website' },
        tools: ['Web development', 'Configurator'],
        links: [{ label: 'Open hegemanandco.com', href: 'https://hegemanandco.com' }],
        body: [
            { type: 'embed', url: 'https://hegemanandco.com', height: 640, title: 'hegemanandco.com' }
        ]
    },
    {
        id: 'elizabeth-sass',
        title: 'Elizabeth Sass',
        category: 'web',
        summary: 'Portfolio website for an artist’s works and collections.',
        cover: { src: 'images/web/elizabeth-sass.jpg', alt: 'Elizabeth Sass website' },
        tools: ['Web development'],
        links: [{ label: 'Open elizabeth-sass.com', href: 'https://elizabeth-sass.com' }],
        body: [
            { type: 'embed', url: 'https://elizabeth-sass.com', height: 640, title: 'elizabeth-sass.com' }
        ]
    },
    {
        id: 'njsow',
        title: 'New Jersey School of Woodwork',
        category: 'web',
        summary: 'Website with course listings and registration for a woodworking school. I also designed its logo.',
        cover: { src: 'images/web/njsow.jpg', alt: 'New Jersey School of Woodwork website' },
        tools: ['Web development', 'Branding'],
        links: [{ label: 'Open njsow.com', href: 'https://njsow.com' }],
        body: [
            { type: 'embed', url: 'https://njsow.com', height: 640, title: 'njsow.com' }
        ]
    },
    {
        id: 'video-game-database',
        title: 'Video game database',
        category: 'web',
        summary: 'A full-stack catalog with search and filtering, built on the MERN stack.',
        cover: { src: 'images/web/videogame.jpg', alt: 'Video game database interface' },
        tools: ['MongoDB', 'Express', 'React', 'Node.js'],
        body: [
            { type: 'image', src: 'images/web/videogame.jpg', alt: 'Video game database interface' }
        ]
    },

    // ───────────────────────────── Games & interaction
    {
        id: 'project-windward',
        title: 'Project Windward',
        category: 'play',
        org: 'IMGD 4000, WPI',
        summary: 'A team-built puzzle game in Unreal Engine 5 with a dynamic ocean and sailing physics.',
        tools: ['Unreal Engine 5'],
        body: [
            { type: 'text', text: 'Group project for WPI’s IMGD 4000 course, where I deepened my Unreal Engine experience on ocean simulation, sailing physics, and puzzle design.' }
        ]
    },
    {
        id: 'dragonfly',
        title: 'Dragonfly game engine',
        category: 'play',
        org: 'IMGD 3000, WPI',
        summary: 'An ASCII-based game engine, rebuilt as part of WPI\u2019s IMGD 3000 course.',
        tools: ['Engine architecture']
    },
    {
        id: 'projection-mapping',
        title: 'Projection mapping',
        category: 'play',
        summary: 'Music-reactive visuals projection-mapped onto a miniature festival stage.',
        cover: { src: 'images/web/projection.jpg', alt: 'Projection-mapped visuals on a stage model' },
        tools: ['TouchDesigner'],
        body: [
            { type: 'text', text: 'Built in TouchDesigner, the visuals respond to the music and are mapped onto the stage’s architecture for live events.' },
            { type: 'video', youtube: 'kuryAqfH-s0', title: 'Projection mapping demo' }
        ]
    },
    {
        id: 'gyro-maze',
        title: 'Phone-controlled gyroscope maze',
        category: 'play',
        summary: 'Tilt a smartphone to roll a ball through a maze in Unity, with the phone’s gyroscope streamed over OSC.',
        cover: { src: 'images/web/gyromaze.jpg', alt: 'Maze game controlled by a phone' },
        tools: ['Unity', 'OSC'],
        body: [
            { type: 'video', youtube: '8XnhE59fsVk', title: 'Gyroscope maze demo' }
        ]
    },
    {
        id: 'quick-draw',
        title: 'Quick Draw',
        category: 'play',
        summary: 'A reaction-time game on Adafruit hardware with timed challenges and immediate feedback.',
        cover: { src: 'images/web/quickdraw.jpg', alt: 'Quick Draw game on Adafruit hardware' },
        tools: ['Adafruit', 'Physical computing'],
        body: [
            { type: 'video', youtube: 'q3G6jeuXKp8', title: 'Quick Draw demo' }
        ]
    },
    {
        id: 'accelerometer-racing',
        title: 'Accelerometer racing',
        category: 'play',
        summary: 'A racing game steered by tilting an accelerometer, tuned for responsive, physics-based control.',
        cover: { src: 'images/web/racing.jpg', alt: 'Racing game controlled by an accelerometer' },
        tools: ['Adafruit', 'Physical computing'],
        body: [
            { type: 'video', youtube: 'S1Hzf92q88M', title: 'Accelerometer racing demo' }
        ]
    },
    {
        id: 'alternate-reality-game',
        title: 'Alternate reality game',
        category: 'play',
        org: 'IMGD 2000, WPI',
        summary: 'Helped create and run an ARG, serving as lead community manager.',
        tools: ['Narrative design', 'Community']
    },

    // ───────────────────────────── 3D renders & graphic design
    {
        id: 'winter-wonderland',
        title: 'Winter Wonderland',
        category: 'design',
        org: 'WPI',
        year: '2024',
        summary: 'A motion-tracked 3D render of a proposed campus event on the WPI Quad, then planning and delivery of the real event on a $30,000 budget.',
        cover: { src: 'images/web/thumb-winter-6.jpg', alt: '3D render of winter event structures on a campus quad' },
        tools: ['3D modeling', 'Motion tracking', 'Event planning'],
        body: [
            { type: 'text', text: 'I composited a 3D version of the proposed event into motion-tracked footage of the Quad, then planned and organized the real event and coordinated its external vendors.' },
            { type: 'gallery', images: ['images/web/winter-6.jpg', 'images/web/winter-1.jpg', 'images/web/winter-2.jpg', 'images/web/winter-3.jpg', 'images/web/winter-4.jpg', 'images/web/winter-5.jpg'] }
        ]
    },
    {
        id: 'room-renders',
        title: 'Bedroom model and renders',
        category: 'design',
        summary: 'A photorealistic 3D model of my room.',
        cover: { src: 'images/web/thumb-room-1.jpg', alt: 'Photorealistic render of a bedroom' },
        tools: ['3D modeling', 'Rendering'],
        body: [
            { type: 'gallery', images: ['images/web/room-1.jpg', 'images/web/room-2.jpg', 'images/web/room-3.jpg', 'images/web/room-4.jpg', 'images/web/room-5.jpg', 'images/web/room-6.jpg'] }
        ]
    },
    {
        id: 'basement-renders',
        title: 'Basement model and renders',
        category: 'design',
        summary: 'Photorealistic architectural visualization of a basement.',
        cover: { src: 'images/web/thumb-basement-2.jpg', alt: 'Photorealistic render of a basement' },
        tools: ['3D modeling', 'Rendering'],
        body: [
            { type: 'gallery', images: ['images/web/basement-2.jpg', 'images/web/basement-1.jpg', 'images/web/basement-3.jpg'] }
        ]
    },
    {
        id: 'odeum-oktoberfest',
        title: 'Oktoberfest in the WPI Odeum',
        category: 'design',
        org: 'WPI',
        summary: 'A 3D model and render of WPI’s Odeum set up for Oktoberfest.',
        cover: { src: 'images/web/thumb-odeum-1.jpg', alt: 'Render of the WPI Odeum decorated for Oktoberfest' },
        tools: ['3D modeling', 'Rendering'],
        body: [
            { type: 'gallery', images: ['images/web/odeum-1.jpg', 'images/web/odeum-2.jpg'] }
        ]
    },
    {
        id: 'oogway',
        title: 'Master Oogway character model',
        category: 'design',
        summary: 'A character modeling study.',
        cover: { src: 'images/web/thumb-oogway-5.jpg', alt: 'Sculpted 3D model of Master Oogway' },
        tools: ['3D modeling'],
        body: [
            { type: 'gallery', images: ['images/web/oogway-2.jpg', 'images/web/oogway-1.jpg', 'images/web/oogway-3.jpg', 'images/web/oogway-4.jpg', 'images/web/oogway-5.jpg'] }
        ]
    },
    {
        id: 'brand-design',
        title: 'Brand design',
        category: 'design',
        summary: 'A corporate identity and branding project.',
        cover: { src: 'images/web/thumb-branding.jpg', alt: 'Brand identity presentation' },
        tools: ['Adobe Creative Suite'],
        body: [{ type: 'image', src: 'images/web/branding.jpg', alt: 'Brand identity presentation' }]
    },
    {
        id: 'book-cover',
        title: 'Book cover',
        category: 'design',
        summary: 'Editorial design and typography for a book jacket.',
        cover: { src: 'images/web/thumb-bookcover.jpg', alt: 'Book cover design' },
        tools: ['Adobe Creative Suite'],
        body: [{ type: 'image', src: 'images/web/bookcover.jpg', alt: 'Book cover design' }]
    },
    {
        id: 'njsow-logo',
        title: 'NJSOW logo',
        category: 'design',
        summary: 'Logo for the New Jersey School of Woodwork, shown burned into wood.',
        cover: { src: 'images/web/thumb-njsow-logo.jpg', alt: 'New Jersey School of Woodwork logo burned into wood' },
        tools: ['Adobe Creative Suite'],
        body: [{ type: 'image', src: 'images/web/njsow-logo.jpg', alt: 'New Jersey School of Woodwork logo burned into wood' }]
    }
];

// Recent work without a page yet. Shown as a short list under the project index.
const ASK_ABOUT = [
    'MR golf simulator',
    'Anduril EagleEye clone',
    'MR microgrid planner',
    'Buffalo Trace / Warehouse H tour demo'
];
