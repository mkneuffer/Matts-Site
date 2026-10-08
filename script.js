// Update copyright year
document.addEventListener('DOMContentLoaded', function () {
    const currentYear = new Date().getFullYear();
    const copyrightElement = document.querySelector('footer p');
    copyrightElement.innerHTML = `&copy; ${currentYear} Matthew Neuffer. All rights reserved.`;
});

// Add smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        document.querySelector(this.getAttribute('href')).scrollIntoView({
            behavior: 'smooth'
        });
    });
});

// Add active class to nav links based on current page
document.addEventListener('DOMContentLoaded', function () {
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('.nav-links a');

    navLinks.forEach(link => {
        if (link.getAttribute('href') === currentPath ||
            (currentPath.endsWith('/') && link.getAttribute('href') === 'index.html')) {
            link.classList.add('active');
        }
    });
});

// Open Project Popup
function openProject(projectId) {
    const popup = document.getElementById('project-popup');
    const title = document.getElementById('popup-title');
    const description = document.getElementById('popup-description');
    const gallery = document.getElementById('popup-gallery');

    const projects = {
        spiGlass: {
            title: "SPI-Glass",
            description: "An AR game combining spatial computing and interactive storytelling using Unity Engine and Niantic Lightship.",
            videos: [
                "https://www.youtube.com/embed/92WVTq7zrRo",
                "https://www.youtube.com/embed/arjJOnzfRAQ",
                "https://www.youtube.com/embed/ozFHFssEuPA"
            ]
        },
        blairTour: {
            title: "Blair AR Tour",
            description: "3D augmented reality tour showcasing architectural features of Blair Academy's newest building.",
            videos: [
                "https://www.youtube.com/embed/90IBRlpX-ec"
            ]
        },
        hegeman: {
            title: "Hegeman & Co",
            description: "Custom jewelry website with interactive product configurator and visualization tools.",
            embed: "https://hegemanandco.com"
        },
        robertCorio: {
            title: "Robert Corio Designs",
            description: "E-commerce platform featuring WebGL-based ring visualization system.",
            embed: "https://robertcorio.com"
        },
        elizabethSass: {
            title: "Elizabeth Sass",
            description: "Portfolio website showcasing artistic works and collections.",
            embed: "https://elizabeth-sass.com"
        },
        njsow: {
            title: "NJ School of Woodwork",
            description: "Website for the New Jersey School of Woodwork with course management and registration system.",
            embed: "https://njsow.com"
        },
        videoGameDatabase: {
            title: "Video Game Database",
            description: "Interactive database with advanced search and filtering capabilities. Created using MERN stack development.",
            embed: "https://webware-videogamecatalog.glitch.me/"
        },
        oogway: {
            title: "Oogway 3D Model",
            description: "Character modeling and animation project.",
            images: ["images/oogway/IMG_5671.JPG", "images/oogway/IMG_5670.JPG", "images/oogway/IMG_5672.JPG", "images/oogway/IMG_5673.JPG", "images/oogway/IMG_5674.JPG"]
        },
        roomrender: {
            title: "3D Model and Renders of My Room",
            description: "Photorealistic 3D render of my room.",
            images: ["images/roomrenders/0001.PNG", "images/roomrenders/0002.PNG", "images/roomrenders/0003.PNG", "images/roomrenders/0004.PNG", "images/roomrenders/0007.PNG", "images/roomrenders/0008.PNG"]
        },
        basementrender: {
            title: "Basement 3D Model and Render",
            description: "Photorealistic 3D model of my basement.",
            images: ["images/basementrenders/0002 2.PNG", "images/basementrenders/0001 2.PNG", "images/basementrenders/0003 2.PNG"]
        },
        odeumrender: {
            title: "Oktoberfest in the WPI Odeum",
            description: "3D model and render of WPI's Odeum during Oktoberfest.",
            images: ["images/odeumrenders/0239.PNG", "images/odeumrenders/0240.PNG"]
        },
        arttour: {
            title: "ARt Tour",
            description: "3D augmented reality tour showcasing sculptures with an aim to enhance the museum experience",
            videos: ["https://www.youtube.com/embed/PE4BJ_MdSOM"]
        },
        arpool: {
            title: "AR Pool",
            description: "3D augmented reality pool, created to test and experiment Reality Composer as part of my TEI course.",
            videos: ["https://www.youtube.com/embed/oV3e9NF-3Wc"]
        },
        winterwonderland: {
            title: "Winter Wonderland 3D Render",
            description: "3D augmented reality tour showcasing sculptures with an aim to enhance the museum experience",
            videos: ["https://www.youtube.com/embed/PE4BJ_MdSOM"]
        },
        branding: {
            title: "Branding Project",
            description: "",
            images: ["images/graphicdesign/FinalRenderBrandingProject.jpg"]
        },
        book: {
            title: "Book Cover",
            description: "",
            images: ["images/graphicdesign/BookCoverFinal.jpg"]
        },
        njsowlogo: {
            title: "NJSOW Logo",
            description: "",
            images: ["images/graphicdesign/NJSOW LOGO BURN combo.jpg"]
        },
        africa: {
            title: "Conserve AfRica",
            description: "",
            embed: "https://conserveafrica.matthewneuffer.com/"
        },
        ringvis: {
            title: "Interactive 3D Ring Visualizer",
            description: "Created a website/platform for custom jewelry designs to be shared with clients. This led to higher customer satisfaction.",
            embed: "https://hegemanandco.glitch.me/ericpappas-twist.html"
        },
        projection: {
            title: "Projection Mapping with TouchDesigner",
            description: "Using TouchDesigner for visuals, I created an immersive projection mapping experience for live events, blending motion graphics with real-world architecture.",
            videos: ["https://www.youtube.com/embed/kuryAqfH-s0"]
        },
        quickdraw: {
            title: "Quick Draw Adafruit Game",
            description: "Developed a reaction-based game featuring timed challenges and dynamic feedback to enhance user engagement.",
            videos: ["https://www.youtube.com/embed/q3G6jeuXKp8"]
        },
        racing: {
            title: "Accelerometer Racing with Adafruit",
            description: "Designed a racing game controlled by accelerometer input, emphasizing physics-based gameplay and responsive controls.",
            videos: ["https://www.youtube.com/embed/S1Hzf92q88M"]
        },
        gyro: {
            title: "Phone Controlled Gyroscope Maze",
            description: "Using OSC, a smartphone, and Unity I created a maze where the player uses the phones gyroscope to navigate.",
            videos: ["https://www.youtube.com/embed/8XnhE59fsVk"]
        }
    };

    const project = projects[projectId];
    title.innerText = project.title;
    description.innerText = project.description;

    gallery.innerHTML = '';  // Clear previous gallery content

    if (project.embed) {
        // If the project has a website to embed
        const iframe = document.createElement('iframe');
        iframe.src = project.embed;
        iframe.width = "100%";
        iframe.height = "600"; // Adjust the height as needed
        iframe.frameBorder = "0";
        iframe.allowFullscreen = true;
        gallery.appendChild(iframe);

        // Add a button to open the site in a new tab
        const button = document.createElement('button');
        button.innerText = "Open Website in New Tab";
        button.onclick = function () {
            window.open(project.embed, "_blank");
        };
        gallery.appendChild(button);  // Add the button below the embed
    }

    // Handling videos
    if (project.videos) {
        project.videos.forEach(videoUrl => {
            const iframe = document.createElement('iframe');
            iframe.src = videoUrl;
            iframe.width = "100%";
            iframe.height = "315";
            iframe.frameBorder = "0";
            iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
            iframe.allowFullscreen = true;
            gallery.appendChild(iframe); // Add each video iframe to the gallery
        });
    }

    // Handling images (if needed)
    if (project.images) {
        project.images.forEach(image => {
            const img = document.createElement('img');
            img.src = image;
            img.alt = project.title;
            gallery.appendChild(img);
        });
    }

    popup.style.display = 'flex';
}

// Close Project Popup when clicking outside or on the X button
function closePopup(event) {
    const popup = document.getElementById('project-popup');
    if (event.target === popup || event.target.classList.contains('close-popup')) {
        popup.style.display = 'none';
    }
}

// Add event listener to close the popup when clicking outside or on the close button
const projectPopup = document.getElementById('project-popup');
if (projectPopup) {
    projectPopup.addEventListener('click', closePopup);
}

// Theme Toggle Logic
document.addEventListener('DOMContentLoaded', () => {
    const themeToggle = document.getElementById('theme-toggle');
    const icon = themeToggle.querySelector('i');
    const html = document.documentElement;

    // Check saved preference
    const savedTheme = localStorage.getItem('theme');

    // Default is now DARK. We only switch if savedTheme is 'light'.
    if (savedTheme === 'light') {
        html.setAttribute('data-theme', 'light');
        icon.classList.remove('fa-sun');
        icon.classList.add('fa-moon');
    } else {
        // Ensure data-theme is unset (default CSS is dark) or set to 'dark' explicit
        html.setAttribute('data-theme', 'dark');
        icon.classList.remove('fa-moon');
        icon.classList.add('fa-sun');
    }

    themeToggle.addEventListener('click', () => {
        const currentTheme = html.getAttribute('data-theme');
        // If current is dark (or null defaulting to dark), switch to light
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';

        html.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);

        // Toggle icon
        if (newTheme === 'light') {
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
        } else {
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
        }
    });
});

// Mobile Navigation Logic
document.addEventListener('DOMContentLoaded', () => {
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');
    const navLinksItems = document.querySelectorAll('.nav-links a');
    const icon = hamburger.querySelector('i');

    if (hamburger && navLinks) {
        hamburger.addEventListener('click', () => {
            // Toggle Nav
            navLinks.classList.toggle('nav-active');

            // Toggle Icon
            if (navLinks.classList.contains('nav-active')) {
                icon.classList.remove('fa-bars');
                icon.classList.add('fa-times');
            } else {
                icon.classList.remove('fa-times');
                icon.classList.add('fa-bars');
            }
        });

        // Close menu when link is clicked
        navLinksItems.forEach(link => {
            link.addEventListener('click', () => {
                if (navLinks.classList.contains('nav-active')) {
                    navLinks.classList.remove('nav-active');
                    icon.classList.remove('fa-times');
                    icon.classList.add('fa-bars');
                }
            });
        });
    }
});
