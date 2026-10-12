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
 *   featured  true to show it in the "Selected work" grid; four fit best (optional)
 *   cover     { src, fit: 'cover' | 'contain', alt, caption } — omit for a text-only card
 *   coverText ['Unity', 'OpenXR', ...]  — lines set as a typographic cover when there is no image
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
    xr: { label: 'VR & mixed reality' },
    ar: { label: 'Augmented reality' },
    web: { label: 'Web & real-time 3D' },
    play: { label: 'Games & interaction' },
    design: { label: '3D renders & design' }
};

const PROJECTS = [
    // ───────────────────────────── VR & MR
    {
        id: 'mattseye',
        title: 'MattsEye',
        category: 'xr',
        featured: true,
        cover: { src: 'images/web/mattseye.png', alt: 'MattsEye title card with compass markings and a circular shared-space dial' },
        summary: 'A recreation of Anduril’s EagleEye demo that connects iPhones and headsets in one shared spatial environment. Aligned point clouds, people and object detection, and a tabletop map bring multiple devices’ views together.',
        tools: ['Unity', 'Web server', 'iPhone', 'Meta Quest 3', 'LiDAR / depth sensing', 'Monocular cameras', 'GPS / compass'],
        specs: [
            ['Devices', 'Multiple iPhones and Meta Quest 3 headsets'],
            ['Architecture', 'Cloud web server, iPhone app, Unity app on Quest 3'],
            ['Spatial capture', 'Depth sensors and LiDAR, with support for monocular cameras'],
            ['Coordination', 'Central server, point-cloud alignment, device localization'],
            ['Map anchoring', 'GPS and compass data from phone scans'],
            ['Reference', 'Anduril’s EagleEye demonstration']
        ],
        links: [
            { label: 'Watch the demo', href: 'https://youtu.be/hP5raTcAusw' },
            { label: 'Inspiration: Anduril’s EagleEye', href: 'https://www.youtube.com/watch?v=x9B02pFKpJo' }
        ],
        body: [
            { type: 'heading', text: 'Credit and inspiration' },
            { type: 'text', text: 'I recreated the features shown in Anduril Industries’ “EagleEye: Superpowers For Superheroes” demonstration as a system that connects multiple phones and headsets to the same environment. The original video is linked above as the reference and inspiration for MattsEye. Each device contributes a point cloud, giving the central environment a spatial view assembled from multiple perspectives.' },
            { type: 'heading', text: 'Device apps and cloud coordination' },
            { type: 'text', text: 'The cloud side runs on a web server. An iPhone app handles the phone side, while a Unity app runs on Meta Quest 3. Both connect to the central environment so phone and headset scans contribute to the same spatial view.' },
            { type: 'heading', text: 'From device scans to a shared environment' },
            { type: 'text', text: 'Devices capture point clouds using depth sensors and LiDAR; the system also supports monocular cameras. Those scans are sent to a central server, aligned with one another, and used to localize each device within the shared environment.' },
            { type: 'heading', text: 'Shared awareness and map views' },
            {
                type: 'list', items: [
                    'People and object detection add context to the environment. People seen by one connected device appear on the others, including through-wall overlays when another device has line of sight.',
                    'A central overview shows the environment from above, with tracked devices and detections placed on a map.',
                    'A tabletop tactical map supports planning and inspection of the scanned environment.',
                    'Phone GPS and compass data anchor scans to their geographic location and orientation, so the same scans appear in place on the tabletop map.'
                ]
            },
            { type: 'heading', text: 'Shared tools and saved sites' },
            { type: 'text', text: 'A live web dashboard brings together the scanned environment, device positions, movement trails, and people tracks. Shared markers and measurements let users annotate the same space from the phone, headset, or browser. Maps can be saved as sites and revisited, with new scans extending the existing environment.' },
            { type: 'video', youtube: 'hP5raTcAusw', title: 'MattsEye multi-device spatial mapping and tabletop demo' }
        ]
    },
    {
        id: 'electrician-training-lab',
        title: 'ESAMTAC: Electrician Virtual Training Lab',
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
        id: 'tabletop-solar-labs',
        title: 'Tabletop Solar Labs',
        category: 'xr',
        cover: { src: 'images/web/tabletop-solar-labs.jpg', alt: 'Tabletop Solar Labs as shown in the Vision Pro demo' },
        summary: 'A cross-platform WebXR learning experiment that puts a solar lab on the tabletop. Place rooftop panels and move the sun to explore how sun path, time of day, and shadows affect solar energy.',
        tools: ['WebXR', 'Real-time lighting'],
        specs: [
            ['Platform', 'WebXR, with desktop support'],
            ['Devices', 'Meta Quest, Apple Vision Pro, Android XR, desktop'],
            ['Learning focus', 'Solar fundamentals, sun path, time of day, shadows'],
            ['Headset modes', 'Passthrough on Quest 3; full VR in the Vision Pro demo']
        ],
        links: [{ label: 'Watch the Vision Pro demo', href: 'https://youtu.be/oUKLLPOXRm4' }],
        body: [
            { type: 'text', text: 'This experiment explores how tabletop learning can make labs and experiments easier to access. A small rooftop model gives users a hands-on way to explore the fundamentals of solar energy in a browser-based experience.' },
            { type: 'heading', text: 'Learn by changing the scene' },
            {
                type: 'list', items: [
                    'Place solar panels on a rooftop model and inspect the layout from different perspectives.',
                    'Move the sun to explore its path and how its position changes over the day.',
                    'Use real-time lighting and shadows to see how the sun and surrounding geometry affect the panels.'
                ]
            },
            { type: 'heading', text: 'One lab across devices' },
            { type: 'text', text: 'The project is built with WebXR and supports Meta Quest, Apple Vision Pro, Android XR, and desktop. On Quest 3, passthrough places the lab in the user’s surroundings. The linked recording shows the Vision Pro version running in full VR.' },
            { type: 'video', youtube: 'oUKLLPOXRm4', title: 'Tabletop Solar Labs rooftop solar experiment on Apple Vision Pro' }
        ]
    },
    {
        id: 'custom-sharp-ui',
        title: 'Custom Sharp UI',
        category: 'xr',
        cover: { src: 'images/web/custom-sharp-ui.jpg', alt: 'Custom Sharp UI comparison from the WebXR demo on Quest 3' },
        summary: 'A custom WebXR rendering approach that puts UI on a separate layer for crisp text, charts, and controls. It brings ideas used in Unity and Unreal to browser-based XR, demonstrated on Meta Quest 3. The video doesn’t do the improvement justice; the difference in clarity is much more noticeable in the headset.',
        tools: ['WebXR', 'Separate-layer UI rendering'],
        specs: [
            ['Platform', 'WebXR'],
            ['Approach', 'UI rendered on a separate layer'],
            ['Demo hardware', 'Meta Quest 3'],
            ['Focus', 'Interface sharpness and readability across viewing distances']
        ],
        links: [{ label: 'Watch the UI comparison', href: 'https://youtu.be/-yOJiWCGVF4' }],
        body: [
            { type: 'text', text: 'I adapted the separate-layer UI rendering approach used in Unity and Unreal for WebXR. Rendering the interface on its own layer makes text, charts, and controls much clearer in the headset.' },
            { type: 'heading', text: 'Readable interfaces in the headset' },
            { type: 'text', text: 'The goal was to make detailed interfaces comfortable to read as users change their viewing distance. The Quest 3 demo compares the base UI with the custom rendering approach using the same energy dashboard, including small labels, charts, and controls.' },
            { type: 'video', youtube: '-yOJiWCGVF4', title: 'Base UI versus Custom Sharp UI in WebXR on Meta Quest 3' }
        ]
    },
    {
        id: 'microgrid-planner',
        title: 'Microgrid Planner',
        category: 'xr',
        featured: true,
        cover: { src: 'images/web/microgrid-planner.jpg', alt: 'Microgrid Planner tabletop map and energy simulation from the demo' },
        summary: 'A tabletop WebXR planner for building and simulating microgrids on real maps with buildings, terrain, and elevation. Combine solar, wind, batteries, and generators, then explore generation and demand across time and weather conditions.',
        tools: ['WebXR', '3D maps', 'Terrain / elevation', 'Energy simulation'],
        specs: [
            ['Platform', 'WebXR'],
            ['Map', 'Real locations, buildings, terrain, and elevation'],
            ['Energy assets', 'Solar, wind, batteries, generators'],
            ['Connections', 'Automatic wiring and power lines'],
            ['Simulation', 'Power generation, power draw, time of day, time of year, weather']
        ],
        links: [{ label: 'Watch the planner demo', href: 'https://youtu.be/c0HH90NfCmI' }],
        body: [
            { type: 'text', text: 'Microgrid Planner brings site planning and energy simulation into one 3D tabletop experience. Users can search for a real location, inspect its buildings and terrain, and build a potential microgrid directly on the map.' },
            { type: 'heading', text: 'Build around a real site' },
            {
                type: 'list', items: [
                    'Search locations and explore real maps with buildings, elevation, and terrain.',
                    'Combine wind, solar, batteries, and generators into a system suited to the site.',
                    'Integrate the microgrid with real-world buildings on the map.',
                    'Use automatic connections to create the wiring and power lines between components.'
                ]
            },
            { type: 'heading', text: 'Explore how the system behaves' },
            { type: 'text', text: 'The planner simulates power generation and power draw and presents the resulting energy statistics. Users can change the time of day, time of year, and weather to explore how the same design performs under different conditions. The demo also shows energy charts and outage testing alongside the map.' },
            { type: 'video', youtube: 'c0HH90NfCmI', title: 'Microgrid Planner tabletop WebXR design and energy simulation demo' }
        ]
    },
    {
        id: 'unity-vision-pro-pipeline',
        title: 'Unity Vision Pro Pipeline',
        category: 'xr',
        cover: { src: 'images/web/unity-vision-pro-pipeline.jpg', alt: 'White blueprint concept sketch of a spatial scene connected to a headset', caption: 'Concept illustration' },
        summary: 'A custom bridge that brings existing Unity projects, including Quest apps, to Apple Vision Pro as native visionOS apps. It connects Unity projects to a visionOS and Xcode build workflow without relying on PolySpatial.',
        tools: ['Unity', 'visionOS', 'Xcode', 'Custom bridge'],
        specs: [
            ['Source', 'Existing Unity projects, including projects built for Quest'],
            ['Output', 'Native visionOS app for Apple Vision Pro'],
            ['Build workflow', 'Custom Unity bridge, visionOS, Xcode'],
            ['Purpose', 'An alternative to the PolySpatial workflow'],
            ['Validation', 'Existing Unity XR scenes in the visionOS simulator'],
            ['Demo', 'Coming soon']
        ],
        body: [
            { type: 'text', text: 'I built a custom bridge and pipeline to bring existing Unity projects to Vision Pro as native visionOS apps. The workflow is designed to take projects originally built for another platform, such as Quest, and make them work with visionOS and Xcode.' },
            { type: 'heading', text: 'Why I built it' },
            { type: 'text', text: 'The motivation was to make Unity development for Vision Pro more accessible by providing an alternative to the PolySpatial workflow and its Unity Pro license requirement. Reusing an existing Unity project gives developers a starting point for bringing their work to another headset.' },
            { type: 'heading', text: 'From Unity to a native app' },
            { type: 'text', text: 'The custom bridge connects the Unity project to a visionOS build workflow in Xcode. The result is a native app for Apple Vision Pro.' },
            { type: 'heading', text: 'Keep the existing XR experience' },
            { type: 'text', text: 'The work covers common Unity scene content, including materials, animated objects, particles, text, and interactive panels. It also adapts headset input for hands, gaze and pinch, and supported controllers, with the aim of reusing the project’s existing interactions.' },
            { type: 'text', text: 'The pipeline is being validated with the Unity VR template and MattsEye tabletop scenes in the visionOS simulator. That work checks how an existing experience carries across, including its interface and interactions.' },
            { type: 'text', text: 'Demo video coming soon.' }
        ]
    },
    {
        id: 'warehouse-h',
        title: 'Buffalo Trace / Warehouse H',
        category: 'xr',
        org: 'Independent concept prototype',
        cover: { src: 'images/web/warehouse-h.jpg', alt: 'White blueprint concept sketch of a barrel warehouse and an unlabeled whiskey bottle', caption: 'Concept illustration' },
        summary: 'An independent Vision Pro tour concept that combines an interactive 3D bottle collection with a guided journey through whiskey production and warehouse aging. Tabletop and room-scale views turn the collection and process into a spatial experience.',
        tools: ['Swift', 'SwiftUI', 'RealityKit', 'visionOS'],
        specs: [
            ['Platform', 'Native visionOS app for Apple Vision Pro'],
            ['Experience', '3D collection, guided production tour, warehouse exploration'],
            ['Presentation', 'Tabletop and room-scale spatial views'],
            ['Status', 'Independent concept prototype']
        ],
        body: [
            { type: 'text', text: 'Warehouse H is an independent spatial tour concept built around Buffalo Trace’s collection and production story. It explores how a headset can make a brand experience more tangible through objects users can inspect and spaces they can move through.' },
            { type: 'heading', text: 'Explore the collection and the process' },
            {
                type: 'list', items: [
                    'Browse a 3D bottle collection and inspect the shape and presentation of individual expressions.',
                    'Follow a guided journey through production and warehouse aging.',
                    'Explore a room-scale warehouse setting alongside tabletop views of the collection and process.',
                    'Use spatial views to illustrate warehouse structure and how a barrel’s position relates to its aging environment.'
                ]
            },
            { type: 'text', text: 'The project is a native visionOS prototype using SwiftUI and RealityKit, with a focus on spatial storytelling and object-based exploration.' }
        ]
    },
    {
        id: 'palm-planner',
        title: 'Palm Planner',
        category: 'xr',
        cover: { src: 'images/web/palm-planner.jpg', alt: 'White blueprint concept sketch of task cards floating over an open palm', caption: 'Concept illustration' },
        summary: 'A WebXR productivity experiment that puts today’s tasks on your palm. Capture notes, flick tasks away to finish them, and move cards to another day with a gesture, with headset and desktop interaction modes.',
        tools: ['WebXR', 'three.js', 'Web Speech API'],
        specs: [
            ['Platform', 'WebXR with a desktop browser experience'],
            ['Interface', 'Palm-anchored tasks, day strip, spatial detail panels'],
            ['Input', 'Hands, controllers, mouse, and voice where supported'],
            ['Daily workflow', 'Task capture, completion, rescheduling, morning brief, evening close-out']
        ],
        body: [
            { type: 'text', text: 'Palm Planner explores a to-do list that is available with a small gesture instead of a full screen. On supported hand-tracking headsets, turning the palm up brings today’s tasks into view; longer details open in a separate spatial panel.' },
            { type: 'heading', text: 'Plan with gestures' },
            {
                type: 'list', items: [
                    'Capture spoken or typed notes and review the tasks before saving them.',
                    'Flick a task away to complete it, or use its completion control.',
                    'Drag a task to the day strip to reschedule it, with a wrist-based layout in hand-tracking mode.',
                    'Start the day with a brief and finish with an evening close-out.',
                    'Review task details and undo recent changes.'
                ]
            },
            { type: 'heading', text: 'Adapt to the available input' },
            { type: 'text', text: 'The WebXR prototype includes hand, controller, and desktop controls, with a pinned spatial list for runtimes that use gaze and pinch. Voice capture and spoken output depend on browser support; typed input and captions provide alternatives. Tasks are saved locally in the browser.' }
        ]
    },
    {
        id: 'spatial-kanban',
        title: 'Spatial Kanban',
        category: 'xr',
        cover: { src: 'images/web/spatial-kanban.jpg', alt: 'White blueprint concept sketch of a floating task board above a desk', caption: 'Concept illustration' },
        summary: 'A spatial kanban board for walls, desks, or open space, with cards you can pick up and move between columns. A project-board view and a sticky-note whiteboard share the same tasks, with desktop 3D and accessible 2D modes.',
        tools: ['WebXR', 'React', 'three.js', 'TypeScript'],
        specs: [
            ['Experiences', 'WebXR, desktop 3D, accessible 2D board'],
            ['Placement', 'Wall, desk, or floating board'],
            ['Views', 'Project board and sticky-note whiteboard'],
            ['Data', 'Local browser saving, undo/redo, import/export'],
            ['Validation', 'Desktop browsers and XR emulation']
        ],
        body: [
            { type: 'text', text: 'Spatial Kanban turns a task board into an object in the room. Users can place it on a wall, angle it over a desk, or leave it floating, then move cards with hands, controllers, or a mouse.' },
            { type: 'heading', text: 'Make task management tactile' },
            {
                type: 'list', items: [
                    'Pick up cards and move them between columns, or pull a blank card from the pad to create a task.',
                    'Pull cards off the board, park them nearby, and return them to a column.',
                    'Archive a card by dropping it in the bin or throwing it downward.',
                    'Switch between a clean project-board layout and a whiteboard with paper-like sticky notes.',
                    'Move and resize the board, with remembered placement on compatible XR runtimes.'
                ]
            },
            { type: 'heading', text: 'Keep the board usable across devices' },
            { type: 'text', text: 'The same tasks are available in a desktop 3D view and a 2D board with keyboard and screen-reader support. Board data is saved locally, with undo/redo and import/export. The current build has been checked in desktop browsers and XR emulation; physical-headset validation is still in progress.' }
        ]
    },
    {
        id: 'page-studio-xr',
        title: 'Page Studio XR',
        category: 'xr',
        featured: true,
        cover: { src: 'images/web/page-studio-xr.jpg', alt: 'White blueprint concept sketch of a spatial page canvas and device previews', caption: 'Concept illustration' },
        summary: 'A spatial website builder where pages, components, and device previews become objects in the room. Assemble a site with gestures and voice, check phone and desktop layouts, and export HTML and CSS.',
        tools: ['WebXR', 'three.js', 'Unity', 'HTML / CSS'],
        specs: [
            ['Experiences', 'WebXR studio, desktop editor, companion Unity build for Quest'],
            ['Workflow', 'Build, edit, review, preview, export'],
            ['Previews', 'Phone, tablet, and desktop layouts at real size'],
            ['Output', 'HTML/CSS export, link and QR previews']
        ],
        body: [
            { type: 'text', text: 'Page Studio XR explores web design as a spatial workspace. The page sits ahead of the user, the site map organizes navigation to one side, and a device wall shows how the same site looks at phone, tablet, and desktop sizes.' },
            { type: 'heading', text: 'Build and edit in the room' },
            {
                type: 'list', items: [
                    'Start with a brief or a template, then grab components and place them into the page.',
                    'Select and rearrange blocks, edit content and styling, and connect pages through the spatial site map.',
                    'Bring the brand palette to the hand to apply colors and typography.',
                    'Import photos and videos into a media wall, then drag them into the page.',
                    'Compare layout variants and inspect the page as separated depth layers.'
                ]
            },
            { type: 'heading', text: 'Check the result before sharing' },
            { type: 'text', text: 'Real-size device previews let users check the site at different screen sizes. A reviewer flags issues such as contrast, missing image descriptions, heading order, and phone overflow. The studio supports version comparison and restore, HTML/CSS export, and link or QR previews when connected to its companion server.' },
            { type: 'text', text: 'The WebXR and Unity builds share saved project files. A desktop editor supports detailed text and property edits alongside the headset experience.' }
        ]
    },
    {
        id: 'impact-of-ai',
        title: 'Impact of AI in VR',
        category: 'xr',
        org: 'The Global Lab at WPI',
        year: '2024–25',
        coverText: ['Unity', 'OpenXR', 'Meta Quest 3'],
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
        year: '2025–26',
        coverText: ['WebXR', 'Meta Quest 3', 'Max refresh rate'],
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
    'MR golf simulator'
];
