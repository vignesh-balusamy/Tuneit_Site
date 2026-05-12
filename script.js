// --- Service Worker Registration ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
        .then(reg => console.log('ServiceWorker registered'))
        .catch(err => console.log('ServiceWorker error: ', err));
    });
}

// DOM Elements
const audio = document.getElementById('audio-player');
const bottomPlayBtn = document.getElementById('bottom-play-btn');
const progressBarBg = document.getElementById('progress-bar-bg');
const progressBarFill = document.getElementById('progress-bar-fill');
const currentTimeEl = document.querySelector('.current-time');
const totalTimeEl = document.querySelector('.total-time');
const volumeBarBg = document.getElementById('volume-bar-bg');
const volumeBarFill = document.getElementById('volume-bar-fill');

const bottomTitle = document.getElementById('bottom-title');
const bottomArtist = document.getElementById('bottom-artist');
const bottomAlbumArt = document.getElementById('bottom-album-art');

const dynamicContent = document.getElementById('dynamic-content');
const loadingIndicator = document.getElementById('loading-indicator');
const searchContainer = document.getElementById('search-container');
const searchInput = document.getElementById('search-input');
const searchContainerMobile = document.getElementById('search-container-mobile');
const searchInputMobile = document.getElementById('search-input-mobile');

// Queue Elements
const queuePanel = document.getElementById('queue-panel');
const queueList = document.getElementById('queue-list');
const btnQueueToggle = document.getElementById('btn-queue');
const btnCloseQueue = document.getElementById('close-queue-btn');

// Nav Items
const navHome = document.getElementById('nav-home');
const navSearch = document.getElementById('nav-search');
const navLibrary = document.getElementById('nav-library');
const navFavorites = document.getElementById('nav-favorites');
const navChill = document.getElementById('nav-chill');
const navWorkout = document.getElementById('nav-workout');
const navFocus = document.getElementById('nav-focus');
const navDriving = document.getElementById('nav-driving');
const btnLogout = document.getElementById('btn-logout');

// Mobile Nav DOM
const mNavHome = document.getElementById('m-nav-home');
const mNavSearch = document.getElementById('m-nav-search');
const mNavLibrary = document.getElementById('m-nav-library');
const mNavPlaylists = document.getElementById('m-nav-playlists');
const mBtnLogout = document.getElementById('m-btn-logout');

// Mobile Drawer DOM
const mobileDrawerOverlay = document.getElementById('mobile-drawer-overlay');
const mobilePlaylistsDrawer = document.getElementById('mobile-playlists-drawer');
const mobileDrawerClose = document.getElementById('mobile-drawer-close');
const mobileMenuBtn = document.getElementById('mobile-menu-btn');

// Mobile Inline Search
const mobileSearchInline = document.getElementById('mobile-search-inline');
const searchInputInline = document.getElementById('search-input-inline');


// Controls
const btnShuffle = document.getElementById('btn-shuffle');
const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');
const btnRepeat = document.getElementById('btn-repeat');
const btnLike = document.getElementById('btn-like');
const btnMute = document.getElementById('btn-mute');

// Full Player Mobile DOM
const fullPlayerOverlay = document.getElementById('full-player');
const fpCloseBtn = document.getElementById('fp-close');
const fpArt = document.getElementById('fp-art');
const fpTitle = document.getElementById('fp-title');
const fpArtist = document.getElementById('fp-artist');
const fpPlayPauseBtn = document.getElementById('fp-play-pause');
const fpPrevBtn = document.getElementById('fp-prev');
const fpNextBtn = document.getElementById('fp-next');
const fpShuffleBtn = document.getElementById('fp-shuffle');
const fpRepeatBtn = document.getElementById('fp-repeat');
const fpProgressFill = document.getElementById('fp-progress-fill');
const fpCurrentTimeEl = document.getElementById('fp-current-time');
const fpTotalTimeEl = document.getElementById('fp-total-time');
const fpCarModeBtn = document.getElementById('fp-car-mode-btn');

// Car Mode DOM
const carModeOverlay = document.getElementById('car-mode-overlay');
const carModeExitBtn = document.getElementById('car-mode-exit');
const carArt = document.getElementById('car-art');
const carTitle = document.getElementById('car-title');
const carArtist = document.getElementById('car-artist');
const carPlayBtn = document.getElementById('car-play');
const carPrevBtn = document.getElementById('car-prev');
const carNextBtn = document.getElementById('car-next');
const carShuffleBtn = document.getElementById('car-shuffle');
const carRepeatBtn = document.getElementById('car-repeat');
const carProgressFill = document.getElementById('car-progress-fill');
const carProgressBg = document.getElementById('car-progress-bg');
const carCurrentEl = document.getElementById('car-current');
const carTotalEl = document.getElementById('car-total');

const nowPlayingContainer = document.querySelector('.now-playing');

// State Variables
let isPlaying = false;
let allSongs = [];
let currentPlaylist = [];
let currentIndex = -1;
let currentSongId = null;

let isShuffle = false;
let repeatMode = 0; 
let isMuted = false;
let previousVolume = 1.0;
let isQueueOpen = false;

// Auth Variables
let currentUser = null; 

const STORAGE_STATE = 'tuneit_playback_state';
const STORAGE_USER = 'tuneit_user';

// Auth DOM
const authModal = document.getElementById('auth-modal');
const authForm = document.getElementById('auth-form');
const appContainer = document.querySelector('.app-container');
const authTitle = document.getElementById('auth-title');
const authError = document.getElementById('auth-error');
const userProfileBtn = document.getElementById('user-profile-btn');

let downloadedSongIds = [];

// --- Avatar Update ---
function updateAvatar() {
    if(currentUser) {
        userProfileBtn.innerHTML = `<span style="font-weight:700; font-size:16px; color:white;">${currentUser.username.charAt(0).toUpperCase()}</span>`;
        userProfileBtn.classList.add('logged-in');
    } else {
        userProfileBtn.innerHTML = `<i data-lucide="user"></i>`;
        userProfileBtn.classList.remove('logged-in');
        lucide.createIcons();
    }
}

// --- Initialization ---
async function init() {
    lucide.createIcons();
    
    // Check Auto Sign-in
    const savedUser = localStorage.getItem(STORAGE_USER);
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        updateAvatar(); // Fix: Call updateAvatar to show initials
        appContainer.style.display = 'flex'; 
        authModal.style.display = 'none';
        loadAppData();
    } else {
        appContainer.style.display = 'none';
        authModal.style.display = 'flex';
    }
}

async function loadAppData() {
    await fetchSongs();
    await initDownloads();
    restorePlaybackState();
    updateControlStyles();

    if (!document.querySelector('.nav-item.active, .nav-item-sub.active')) {
        navHome.click();
    } else {
        reRenderCurrentView();
    }
}

async function initDownloads() {
    if(!('caches' in window)) return;
    const cache = await caches.open('tuneit-offline-songs');
    const keys = await cache.keys();
    const urls = keys.map(req => req.url);
    downloadedSongIds = allSongs.filter(s => urls.includes(s.url)).map(s => s.id);
}

async function fetchSongs() {
    const user = currentUser || JSON.parse(localStorage.getItem(STORAGE_USER));
    if (!user) {
        console.error("No user found for fetchSongs");
        return;
    }

    try {
        const response = await fetch('/api/songs', {
            headers: {
                'x-auth-user': user.username
            }
        });
        const data = await response.json();
        
        if(data.success) {
            allSongs = data.songs;
            loadingIndicator.style.display = 'none';
        } else {
            loadingIndicator.innerHTML = `<p style="color: #ef4444;">Error loading songs: ${data.error || 'Server error'}</p>`;
        }
    } catch (error) {
        console.error("Error fetching songs:", error);
        loadingIndicator.innerHTML = `<p style="color: #ef4444;">Network error while loading songs.</p>`;
    }
}

// --- Auth System ---
authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('auth-username').value;
    const password = document.getElementById('auth-password').value;
    
    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({username, password})
        });
        const data = await res.json();
        if(data.success) {
            currentUser = data.user;
            localStorage.setItem(STORAGE_USER, JSON.stringify(currentUser));
            updateAvatar();
            appContainer.style.display = 'flex';
            authModal.style.display = 'none';
            
            // Now load the app data
            loadingIndicator.style.display = 'block';
            await loadAppData();
        } else {
            authError.textContent = data.error;
            authError.style.display = 'block';
        }
    } catch (err) {
        authError.textContent = "Server error";
        authError.style.display = 'block';
    }
});

// Explicit Logout Action
function performLogout() {
    if(confirm("Are you sure you want to log out?")) {
        // Clear User State
        currentUser = null;
        localStorage.removeItem(STORAGE_USER);
        updateAvatar();
        
        // Stop Audio
        audio.pause();
        isPlaying = false;
        updatePlayIcons('play');
        
        // Clear UI and show login wall
        dynamicContent.innerHTML = '';
        allSongs = [];
        currentPlaylist = [];
        appContainer.style.display = 'none';
        authModal.style.display = 'flex';
        
        // Reset form
        document.getElementById('auth-username').value = '';
        document.getElementById('auth-password').value = '';
    }
}

btnLogout.addEventListener('click', (e) => {
    e.preventDefault();
    performLogout();
});

userProfileBtn.addEventListener('click', () => {
    if(currentUser) {
        performLogout();
    }
});

async function syncLikes() {
    if(!currentUser) return;
    try {
        await fetch('/api/sync-likes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({username: currentUser.username, likedSongs: currentUser.likedSongs})
        });
    } catch (e) {}
}

function getLikedSongs() {
    return currentUser ? currentUser.likedSongs : [];
}

// --- Persistence ---
function savePlaybackState() {
    if(!currentSongId) return;
    const state = {
        songId: currentSongId,
        playlistIds: currentPlaylist.map(s => s.id),
        currentTime: audio.currentTime,
        isShuffle: isShuffle,
        repeatMode: repeatMode
    };
    localStorage.setItem(STORAGE_STATE, JSON.stringify(state));
}

function restorePlaybackState() {
    const saved = localStorage.getItem(STORAGE_STATE);
    if (!saved) return;
    try {
        const state = JSON.parse(saved);
        isShuffle = state.isShuffle || false;
        repeatMode = state.repeatMode || 0;
        
        if (state.playlistIds && state.playlistIds.length > 0) {
            currentPlaylist = state.playlistIds.map(id => allSongs.find(s => s.id === id)).filter(Boolean);
        }

        if (state.songId && currentPlaylist.length > 0) {
            const song = allSongs.find(s => s.id === state.songId);
            if (song) {
                currentIndex = currentPlaylist.findIndex(s => s.id === song.id);
                currentSongId = song.id;
                
                audio.src = song.url;
                audio.currentTime = state.currentTime || 0;
                
                bottomTitle.textContent = song.title;
                bottomArtist.textContent = song.artist;
                bottomAlbumArt.src = song.thumbnail;
                
                updateLikeIcon();
                setupMediaSession(song);
            }
        }
    } catch (e) {}
}

// --- Audio Visualizer & Battery Saver ---
const canvas = document.getElementById('visualizer');
const ctx = canvas.getContext('2d');
const btnVisualizerToggle = document.getElementById('btn-visualizer-toggle');

let audioCtx, analyser, source;
let isVisualizerEnabled = true;
let animationId;

function initVisualizer() {
    if (audioCtx) return; 
    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        source = audioCtx.createMediaElementSource(audio);
        source.connect(analyser);
        analyser.connect(audioCtx.destination);
        analyser.fftSize = 256;
        
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        drawVisualizer();
    } catch (e) {
        console.error("AudioContext blocked or failed", e);
    }
}

function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
}

function drawVisualizer() {
    if (!isVisualizerEnabled || document.hidden) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        animationId = requestAnimationFrame(drawVisualizer);
        return;
    }

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const barWidth = (canvas.width / bufferLength) * 2.5;
    let barHeight;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
        barHeight = dataArray[i] / 4; 
        
        ctx.beginPath();
        // Use standard rounded caps for a premium pill look
        ctx.roundRect(x, canvas.height - barHeight - 5, barWidth - 2, barHeight + 5, 5);
        
        const gradient = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - barHeight);
        gradient.addColorStop(0, 'rgba(59, 130, 246, 0.4)');
        gradient.addColorStop(1, 'rgba(139, 92, 246, 1)');
        
        ctx.fillStyle = gradient;
        ctx.shadowBlur = 12;
        ctx.shadowColor = 'rgba(139, 92, 246, 0.6)';
        ctx.fill();
        
        x += barWidth;
    }
    
    animationId = requestAnimationFrame(drawVisualizer);
}

btnVisualizerToggle.addEventListener('click', () => {
    isVisualizerEnabled = !isVisualizerEnabled;
    if (isVisualizerEnabled) {
        btnVisualizerToggle.innerHTML = '<i data-lucide="activity" style="color: var(--accent);"></i>';
        if(!audioCtx && isPlaying) initVisualizer();
    } else {
        btnVisualizerToggle.innerHTML = '<i data-lucide="activity" style="color: var(--text-muted);"></i>';
    }
    lucide.createIcons();
});

document.addEventListener('visibilitychange', () => {
    const shapes = document.querySelectorAll('.bg-shape');
    if (document.hidden) {
        shapes.forEach(s => s.classList.add('paused'));
    } else {
        shapes.forEach(s => s.classList.remove('paused'));
    }
});


// --- Navigation Handlers ---
function updateNavUI(activeId) {
    document.querySelectorAll('.nav-item, .nav-item-sub, .mobile-nav-item').forEach(el => el.classList.remove('active'));
    const activeEl = document.getElementById(activeId);
    if(activeEl) activeEl.classList.add('active');
    
    // Also update mobile nav sync
    if(activeId === 'nav-library') mNavLibrary.classList.add('active');

    // Handle Mobile Search Visibility
    if (activeId === 'nav-search' && window.innerWidth <= 768) {
        searchContainerMobile.style.display = 'flex';
    } else {
        searchContainerMobile.style.display = 'none';
    }
}

function clearActiveNav() {
    document.querySelectorAll('.nav-item, .nav-item-sub').forEach(el => el.classList.remove('active'));
    searchContainer.style.display = 'none';
}

navHome.addEventListener('click', (e) => { e.preventDefault(); clearActiveNav(); navHome.classList.add('active'); updateNavUI('nav-home'); renderHomeView(); });
navSearch.addEventListener('click', (e) => { e.preventDefault(); clearActiveNav(); navSearch.classList.add('active'); updateNavUI('nav-search'); searchContainer.style.display = 'flex'; searchInput.value = ''; searchInput.focus(); renderSearchView(''); });
navLibrary.addEventListener('click', (e) => { e.preventDefault(); clearActiveNav(); navLibrary.classList.add('active'); updateNavUI('nav-library'); renderLibraryView(); });
navFavorites.addEventListener('click', (e) => { e.preventDefault(); clearActiveNav(); navFavorites.classList.add('active'); renderFavoritesView(); });
navChill.addEventListener('click', (e) => { e.preventDefault(); clearActiveNav(); navChill.classList.add('active'); renderSmartMoodView('Chill'); });
navWorkout.addEventListener('click', (e) => { e.preventDefault(); clearActiveNav(); navWorkout.classList.add('active'); renderSmartMoodView('Workout'); });
navFocus.addEventListener('click', (e) => { e.preventDefault(); clearActiveNav(); navFocus.classList.add('active'); renderSmartMoodView('Focus'); });
navDriving.addEventListener('click', (e) => { e.preventDefault(); clearActiveNav(); navDriving.classList.add('active'); renderSmartMoodView('Driving'); });

searchInput.addEventListener('input', (e) => { 
    updateClearButtonVisibility(e.target.value);
    renderSearchView(e.target.value); 
});
searchInputMobile.addEventListener('input', (e) => { 
    renderSearchView(e.target.value); 
});

function updateClearButtonVisibility(query) {
    let clearBtn = document.getElementById('search-clear-btn');
    if (!clearBtn) {
        clearBtn = document.createElement('button');
        clearBtn.id = 'search-clear-btn';
        clearBtn.innerHTML = '<i data-lucide="x"></i>';
        clearBtn.className = 'search-clear-btn';
        searchInput.parentElement.appendChild(clearBtn);
        lucide.createIcons({root: searchInput.parentElement});
        
        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            updateClearButtonVisibility('');
            renderSearchView('');
            searchInput.focus();
        });
    }
    clearBtn.style.display = query.length > 0 ? 'flex' : 'none';
}

// --- Render Functions ---
function renderHomeView() {
    dynamicContent.innerHTML = '';
    if(allSongs.length === 0) return;

    const mainHeader = document.createElement('div');
    mainHeader.className = 'view-header';
    mainHeader.innerHTML = `
        <h1>Home</h1>
        <button class="play-all-btn primary" id="global-play-home">
            <i data-lucide="play-circle"></i> Play All
        </button>
    `;
    dynamicContent.appendChild(mainHeader);
    
    document.getElementById('global-play-home').addEventListener('click', () => {
        currentPlaylist = allSongs;
        playSong(allSongs[0].id);
    });

    const recentlyAdded = [...allSongs].reverse().slice(0, 6);
    // Passing false to createSection to hide section-level play all
    dynamicContent.appendChild(createSection('Recently Added', recentlyAdded, allSongs, false)); 
    dynamicContent.appendChild(createSection('All Tracks', allSongs, allSongs, false));
    lucide.createIcons({root: mainHeader});
}

function renderLibraryView() {
    dynamicContent.innerHTML = '';
    if(allSongs.length === 0) return;

    // On mobile/tablet, show Favorites and Mood Mixes at the top of Library
    if (window.innerWidth <= 1280) {
        const likes = getLikedSongs();
        const favSongs = allSongs.filter(s => likes.includes(s.id));
        if(favSongs.length > 0) {
            dynamicContent.appendChild(createSection('Your Favorites', favSongs, favSongs));
        }

        const moods = ['Driving', 'Workout', 'Chill', 'Focus'];
        moods.forEach(mood => {
            const moodSongs = allSongs.filter(s => s.mood === mood);
            if(moodSongs.length > 0) {
                dynamicContent.appendChild(createSection(`${mood} Mix`, moodSongs, moodSongs));
            }
        });
    }

    const byArtist = {};
    allSongs.forEach(song => {
        if(!byArtist[song.artist]) byArtist[song.artist] = [];
        byArtist[song.artist].push(song);
    });

    Object.keys(byArtist).sort().forEach(artist => {
        dynamicContent.appendChild(createSection(artist, byArtist[artist], byArtist[artist]));
    });
}

function renderFavoritesView() {
    dynamicContent.innerHTML = '';
    const likes = getLikedSongs();
    const favSongs = allSongs.filter(s => likes.includes(s.id));
    if(favSongs.length === 0) {
        dynamicContent.innerHTML = '<div class="no-results">No favorites yet. Log in and click the heart icon on any song!</div>';
        return;
    }
    dynamicContent.appendChild(createSection('Liked Songs', favSongs, favSongs));
}

function renderSmartMoodView(mood) {
    dynamicContent.innerHTML = '';
    const filtered = allSongs.filter(s => s.mood === mood);
    if(filtered.length === 0) {
        const randomSongs = [...allSongs].sort(() => 0.5 - Math.random()).slice(0, 6);
        dynamicContent.appendChild(createSection(`${mood} Mix`, randomSongs, randomSongs));
    } else {
        dynamicContent.appendChild(createSection(`${mood} Mix`, filtered, filtered));
    }
}

function renderSearchView(query) {
    dynamicContent.innerHTML = '';
    const qLower = query.toLowerCase().trim();
    
    if (qLower === '') {
        dynamicContent.innerHTML = '<div class="no-results">Type something to search for songs, artists, or movies.</div>';
        return;
    }

    const isMovieSearch = qLower.includes('movie') || qLower.includes('film');
    const isSongSearch = qLower.includes('song');
    const isArtistSearch = qLower.includes('artist') || qLower.includes('by ') || qLower.includes('singer');
    
    const tokens = qLower.split(/\s+/)
                         .filter(t => t.length > 0 && !['songs', 'song', 'movie', 'film', 'by', 'the', 'of'].includes(t));
    
    if (tokens.length === 0) {
        tokens.push(qLower);
    }

    const filteredSongs = allSongs.filter(song => {
        const searchText = `${song.title} ${song.artist} ${song.movie || ''} ${song.actors || ''} ${song.musicDirector || ''} ${song.genre}`.toLowerCase();
        
        // If searching for "movie", prioritize movie/actor matches
        if (isMovieSearch) {
            return tokens.some(t => (song.movie && song.movie.toLowerCase().includes(t)) || (song.actors && song.actors.toLowerCase().includes(t)));
        }
        
        // Default: require all tokens to be present somewhere
        return tokens.every(token => searchText.includes(token));
    });

    if(filteredSongs.length === 0) {
        dynamicContent.innerHTML = `<div class="no-results">No results found for "${query}"</div>`;
        return;
    }

    const viewHeader = document.createElement('div');
    viewHeader.className = 'view-header';
    viewHeader.innerHTML = `
        <h1>Results for "${query}"</h1>
        <button class="play-all-btn primary" id="global-play-search">
            <i data-lucide="play-circle"></i> Play All
        </button>
    `;
    dynamicContent.appendChild(viewHeader);

    document.getElementById('global-play-search').addEventListener('click', () => {
        currentPlaylist = filteredSongs;
        playSong(filteredSongs[0].id);
    });

    dynamicContent.appendChild(createSection('', filteredSongs, filteredSongs));
    lucide.createIcons({root: viewHeader});
}

function createSection(title, songsToRender, contextPlaylist, showPlayAll = true) {
    const section = document.createElement('section');
    section.className = 'section';
    
    const sectionHeader = document.createElement('div');
    sectionHeader.className = 'section-header';
    sectionHeader.style.display = 'flex';
    sectionHeader.style.justifyContent = 'space-between';
    sectionHeader.style.alignItems = 'center';
    sectionHeader.style.marginBottom = '20px';

    const h2 = document.createElement('h2');
    h2.className = 'section-title';
    h2.style.marginBottom = '0';
    h2.textContent = title;
    
    if (title && title.trim() !== '') {
        if (showPlayAll) {
            const playAllBtn = document.createElement('button');
            playAllBtn.className = 'play-all-btn';
            playAllBtn.innerHTML = '<i data-lucide="play-circle"></i> Play All';

            playAllBtn.addEventListener('click', () => {
                if(songsToRender.length > 0) {
                    currentPlaylist = contextPlaylist;
                    playSong(songsToRender[0].id);
                }
            });
            sectionHeader.appendChild(h2);
            sectionHeader.appendChild(playAllBtn);
        } else {
            sectionHeader.appendChild(h2);
        }
    } else {
        sectionHeader.style.display = 'none'; 
    }

    section.appendChild(sectionHeader);

    const grid = document.createElement('div');
    grid.className = 'grid-container';

    const likes = getLikedSongs();

    songsToRender.forEach(song => {
        const card = document.createElement('div');
        card.className = 'music-card';
        if(currentSongId === song.id) card.classList.add('active-card');
        
        const isLiked = likes.includes(song.id);
        const heartClass = isLiked ? 'liked' : '';
        const heartFill = isLiked ? 'var(--accent)' : 'none';
        
        const isDownloaded = downloadedSongIds.includes(song.id);
        const dlClass = isDownloaded ? 'downloaded' : '';
        const dlIcon = isDownloaded ? 'check-circle' : 'download';
        
        const durationFormatted = song.duration ? formatTime(song.duration) : '';

        card.innerHTML = `
            <div class="card-img-wrapper">
                <img src="${song.thumbnail}" alt="Album Art" onerror="this.onerror=null; this.src='https://cdn-icons-png.flaticon.com/512/26/26437.png'; this.nextElementSibling.style.display='flex';">
                <div class="card-artist-overlay" style="display:none;">${song.artist}</div>
                <div class="card-duration-tag">${durationFormatted}</div>
                <button class="card-download-btn ${dlClass}" data-id="${song.id}">
                    <i data-lucide="${dlIcon}" style="width: 16px; height: 16px;"></i>
                </button>
                <button class="card-like-btn ${heartClass}" data-id="${song.id}">
                    <i data-lucide="heart" style="fill: ${heartFill}; width: 16px; height: 16px;"></i>
                </button>
                <button class="card-play-btn" data-id="${song.id}">
                    <i data-lucide="${currentSongId === song.id && isPlaying ? 'pause' : 'play'}" style="margin-left: ${currentSongId === song.id && isPlaying ? '0' : '2px'}"></i>
                </button>
            </div>
            <h3 class="card-title">${song.title}</h3>
            <p class="card-subtitle">${song.artist}</p>
        `;

        const cardLikeBtn = card.querySelector('.card-like-btn');
        cardLikeBtn.addEventListener('click', (e) => {
            e.stopPropagation(); 
            toggleLike(song.id);
        });

        const cardDownloadBtn = card.querySelector('.card-download-btn');
        cardDownloadBtn.addEventListener('click', (e) => {
            e.stopPropagation(); 
            toggleDownload(song);
        });

        card.addEventListener('click', () => {
            currentPlaylist = contextPlaylist; 
            playSong(song.id);
        });
        
        grid.appendChild(card);
    });

    section.appendChild(grid);
    lucide.createIcons({root: section});
    return section;
}

function reRenderCurrentView() {
    if(navHome.classList.contains('active')) renderHomeView();
    else if(navSearch.classList.contains('active')) renderSearchView(searchInput.value);
    else if(navLibrary.classList.contains('active')) renderLibraryView();
    else if(navFavorites.classList.contains('active')) renderFavoritesView();
    else if(navChill.classList.contains('active')) renderSmartMoodView('Chill');
    else if(navWorkout.classList.contains('active')) renderSmartMoodView('Workout');
    else if(navFocus.classList.contains('active')) renderSmartMoodView('Focus');
    else if(navDriving.classList.contains('active')) renderSmartMoodView('Driving');
    
    if(isQueueOpen) renderQueueView();
}

function toggleLike(songId) {
    if(!currentUser) {
        alert("Please login to like songs!");
        authModal.style.display = 'flex';
        return;
    }
    
    if(currentUser.likedSongs.includes(songId)) {
        currentUser.likedSongs = currentUser.likedSongs.filter(id => id !== songId);
    } else {
        currentUser.likedSongs.push(songId);
    }
    localStorage.setItem(STORAGE_USER, JSON.stringify(currentUser));
    syncLikes();
    updateLikeIcon();
    reRenderCurrentView();
}

// --- Offline Download Logic ---
async function toggleDownload(song) {
    if(!('caches' in window)) {
        alert("Offline mode not supported by this browser.");
        return;
    }
    const cache = await caches.open('tuneit-offline-songs');
    const isDownloaded = downloadedSongIds.includes(song.id);

    if(isDownloaded) {
        if(confirm(`Remove "${song.title}" from offline downloads?`)) {
            await cache.delete(song.url);
            downloadedSongIds = downloadedSongIds.filter(id => id !== song.id);
            reRenderCurrentView();
        }
    } else {
        alert(`Downloading "${song.title}" for offline playback...`);
        try {
            // Fetch directly (using crossorigin if needed)
            const res = await fetch(song.url, { mode: 'cors' });
            if(!res.ok) throw new Error("Network response was not ok");
            await cache.put(song.url, res.clone());
            downloadedSongIds.push(song.id);
            reRenderCurrentView();
        } catch(e) {
            console.error(e);
            alert("Failed to download. Ensure CORS allows caching.");
        }
    }
}

// --- Queue Logic ---
function toggleQueue() {
    isQueueOpen = !isQueueOpen;
    if(isQueueOpen) {
        queuePanel.classList.add('open');
        btnQueueToggle.classList.add('active');
        renderQueueView();
    } else {
        queuePanel.classList.remove('open');
        btnQueueToggle.classList.remove('active');
    }
}

btnQueueToggle.addEventListener('click', toggleQueue);
btnCloseQueue.addEventListener('click', toggleQueue);

function openFullPlayer() {
    if (window.innerWidth > 1024) return;
    fullPlayerOverlay.style.display = 'flex';
    setTimeout(() => fullPlayerOverlay.classList.add('open'), 10);
}

function closeFullPlayer() {
    fullPlayerOverlay.classList.remove('open');
    setTimeout(() => fullPlayerOverlay.style.display = 'none', 400);
}

nowPlayingContainer.addEventListener('click', () => {
    if (window.innerWidth <= 1024) openFullPlayer();
});
fpCloseBtn.addEventListener('click', closeFullPlayer);
fpPlayPauseBtn.addEventListener('click', togglePlayPause);
fpPrevBtn.addEventListener('click', playPrev);
fpNextBtn.addEventListener('click', playNext);
fpShuffleBtn.addEventListener('click', () => { isShuffle = !isShuffle; updateControlStyles(); savePlaybackState(); });
fpRepeatBtn.addEventListener('click', () => { repeatMode = (repeatMode + 1) % 3; updateControlStyles(); savePlaybackState(); });

function renderQueueView() {
    queueList.innerHTML = '';
    if(currentPlaylist.length === 0 || currentIndex === -1) {
        queueList.innerHTML = '<p class="no-results" style="font-size:12px;">Queue is empty.</p>';
        return;
    }
    
    for(let i = currentIndex; i < currentPlaylist.length; i++) {
        const song = currentPlaylist[i];
        const item = document.createElement('div');
        item.className = `queue-item ${i === currentIndex ? 'active' : ''}`;
        item.innerHTML = `
            <img src="${song.thumbnail}" class="queue-img" alt="">
            <div class="queue-info">
                <div class="queue-title">${song.title}</div>
                <div class="queue-artist">${song.artist}</div>
            </div>
            ${i === currentIndex && isPlaying ? '<i data-lucide="bar-chart-2" style="color:var(--accent); width:16px;"></i>' : ''}
        `;
        
        item.addEventListener('click', () => playSong(song.id));
        queueList.appendChild(item);
    }
    lucide.createIcons({root: queueList});
}

// --- Playback Logic ---

function playSong(songId) {
    const songIndex = currentPlaylist.findIndex(s => s.id === songId);
    if(songIndex === -1) return;
    
    const song = currentPlaylist[songIndex];

    if(currentSongId === songId) {
        togglePlayPause();
        return;
    }

    currentIndex = songIndex;
    currentSongId = songId;
    audio.src = song.url;
    
    if(audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    audio.play().then(() => {
        if(isVisualizerEnabled && !audioCtx) initVisualizer();
    }).catch(e => console.error("Playback failed:", e));
    
    bottomTitle.textContent = song.title;
    bottomArtist.textContent = song.artist;
    bottomAlbumArt.src = song.thumbnail;
    
    // Sync Full Player
    fpTitle.textContent = song.title;
    fpArtist.textContent = song.artist;
    fpArt.src = song.thumbnail;
    
    updateLikeIcon();
    updateCarModeUI();
    reRenderCurrentView();
    setupMediaSession(song);
    savePlaybackState();
}

function togglePlayPause() {
    if(!currentSongId && currentPlaylist.length > 0) {
        playSong(currentPlaylist[0].id);
        return;
    } else if(!currentSongId && allSongs.length > 0) {
        currentPlaylist = allSongs;
        playSong(currentPlaylist[0].id);
        return;
    }
    if(!currentSongId) return;

    if (audio.paused) {
        if(audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
        audio.play().then(() => {
             if(isVisualizerEnabled && !audioCtx) initVisualizer();
        }).catch(e => console.error("Playback failed:", e));
    } else {
        audio.pause();
    }
}

function playNext() {
    if(currentPlaylist.length === 0) return;
    if(isShuffle) {
        let nextIdx = Math.floor(Math.random() * currentPlaylist.length);
        playSong(currentPlaylist[nextIdx].id);
    } else {
        let nextIdx = currentIndex + 1;
        if(nextIdx >= currentPlaylist.length) {
            if(repeatMode === 1) nextIdx = 0; 
            else return; 
        }
        playSong(currentPlaylist[nextIdx].id);
    }
}

function playPrev() {
    if(currentPlaylist.length === 0) return;
    if(audio.currentTime > 3) {
        audio.currentTime = 0;
    } else {
        let prevIdx = currentIndex - 1;
        if(prevIdx < 0) {
            if(repeatMode === 1) prevIdx = currentPlaylist.length - 1;
            else prevIdx = 0;
        }
        playSong(currentPlaylist[prevIdx].id);
    }
}

function setupMediaSession(song) {
    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: song.title,
            artist: song.artist,
            album: song.movie || 'Tuneit Music',
            artwork: [ { src: song.thumbnail, sizes: '512x512', type: 'image/png' } ]
        });

        navigator.mediaSession.setActionHandler('play', () => audio.play());
        navigator.mediaSession.setActionHandler('pause', () => audio.pause());
        navigator.mediaSession.setActionHandler('previoustrack', playPrev);
        navigator.mediaSession.setActionHandler('nexttrack', playNext);
    }
}

// Controls Listeners
bottomPlayBtn.addEventListener('click', togglePlayPause);
btnNext.addEventListener('click', playNext);
btnPrev.addEventListener('click', playPrev);

btnShuffle.addEventListener('click', () => {
    isShuffle = !isShuffle;
    updateControlStyles();
    savePlaybackState();
});

btnRepeat.addEventListener('click', () => {
    repeatMode = (repeatMode + 1) % 3;
    updateControlStyles();
    savePlaybackState();
});

btnLike.addEventListener('click', () => {
    if(currentSongId) toggleLike(currentSongId);
});

btnMute.addEventListener('click', () => {
    if(isMuted) {
        audio.volume = previousVolume;
        isMuted = false;
    } else {
        previousVolume = audio.volume;
        audio.volume = 0;
        isMuted = true;
    }
    updateVolumeUI();
});

function updateLikeIcon() {
    const likes = getLikedSongs();
    if(likes.includes(currentSongId)) {
        btnLike.classList.add('liked');
        btnLike.innerHTML = '<i data-lucide="heart" style="fill: var(--accent); color: var(--accent);"></i>';
    } else {
        btnLike.classList.remove('liked');
        btnLike.innerHTML = '<i data-lucide="heart" style="color: var(--text-muted);"></i>';
    }
    lucide.createIcons();
}

function updateControlStyles() {
    btnShuffle.style.color = isShuffle ? 'var(--accent)' : 'var(--text-muted)';
    
    if(repeatMode === 0) {
        btnRepeat.style.color = 'var(--text-muted)';
        btnRepeat.innerHTML = '<i data-lucide="repeat"></i>';
    } else if(repeatMode === 1) {
        btnRepeat.style.color = 'var(--accent)';
        btnRepeat.innerHTML = '<i data-lucide="repeat"></i>';
    } else {
        btnRepeat.style.color = 'var(--accent)';
        btnRepeat.innerHTML = '<i data-lucide="repeat-1"></i>';
    }
    lucide.createIcons();
}

function updatePlayIcons(state) {
    const isPlay = state === 'play';

    // Mini player (bottom bar)
    bottomPlayBtn.innerHTML = isPlay
        ? '<i data-lucide="play" id="play-icon-bottom" style="margin-left: 2px;"></i>'
        : '<i data-lucide="pause" id="play-icon-bottom"></i>';

    // Full-screen player overlay (mobile)
    if (fpPlayPauseBtn) {
        fpPlayPauseBtn.innerHTML = isPlay
            ? '<i data-lucide="play" style="margin-left:2px;"></i>'
            : '<i data-lucide="pause"></i>';
    }

    // Car Mode player
    if (carPlayBtn) {
        carPlayBtn.innerHTML = isPlay
            ? '<i data-lucide="play" style="margin-left:4px;"></i>'
            : '<i data-lucide="pause"></i>';
    }

    if ('mediaSession' in navigator)
        navigator.mediaSession.playbackState = isPlay ? 'paused' : 'playing';

    lucide.createIcons();
    reRenderCurrentView();
}

// --- Audio Events ---
audio.addEventListener('play', () => {
    isPlaying = true;
    updatePlayIcons('pause');
});

audio.addEventListener('pause', () => {
    isPlaying = false;
    updatePlayIcons('play');
});

audio.addEventListener('loadedmetadata', () => {
    const dur = formatTime(audio.duration);
    totalTimeEl.textContent = dur;
    // Sync full-screen player total time
    if (fpTotalTimeEl) fpTotalTimeEl.textContent = dur;
    // Sync Car Mode total time
    if (carTotalEl) carTotalEl.textContent = dur;
});

audio.addEventListener('timeupdate', () => {
    if(audio.duration) {
        const progressPercent = (audio.currentTime / audio.duration) * 100;
        const currentFormatted = formatTime(audio.currentTime);

        // Mini player progress
        progressBarFill.style.width = `${progressPercent}%`;
        currentTimeEl.textContent = currentFormatted;

        // Full-screen player progress
        if (fpProgressFill) fpProgressFill.style.width = `${progressPercent}%`;
        if (fpCurrentTimeEl) fpCurrentTimeEl.textContent = currentFormatted;
        if (fpTotalTimeEl)   fpTotalTimeEl.textContent = formatTime(audio.duration);

        // Car Mode progress
        if (carProgressFill) carProgressFill.style.width = `${progressPercent}%`;
        if (carCurrentEl)    carCurrentEl.textContent = currentFormatted;
        if (carTotalEl)      carTotalEl.textContent = formatTime(audio.duration);

        if(Math.floor(audio.currentTime) % 3 === 0) {
            savePlaybackState();
        }
    }
});

audio.addEventListener('ended', () => {
    if(repeatMode === 2) {
        audio.currentTime = 0;
        audio.play();
    } else {
        playNext();
    }
});

function formatTime(seconds) {
    if (isNaN(seconds)) return "0:00";
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
}

progressBarBg.addEventListener('click', (e) => {
    if(!currentSongId) return;
    const width = progressBarBg.clientWidth;
    const clickX = e.offsetX;
    if(audio.duration) {
        audio.currentTime = (clickX / width) * audio.duration;
        savePlaybackState();
    }
});

// Full-screen player progress bar — tap to seek
const fpProgressContainer = document.querySelector('.fp-progress-container');
if (fpProgressContainer) {
    fpProgressContainer.addEventListener('click', (e) => {
        if(!currentSongId || !audio.duration) return;
        const rect = fpProgressContainer.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        audio.currentTime = (clickX / rect.width) * audio.duration;
        savePlaybackState();
    });
}

volumeBarBg.addEventListener('click', (e) => {
    const width = volumeBarBg.clientWidth;
    const clickX = e.offsetX;
    let volumeLevel = clickX / width;
    if(volumeLevel < 0.05) volumeLevel = 0;
    if(volumeLevel > 0.95) volumeLevel = 1;
    
    audio.volume = volumeLevel;
    isMuted = volumeLevel === 0;
    updateVolumeUI();
});

function updateVolumeUI() {
    volumeBarFill.style.width = `${audio.volume * 100}%`;
    if(audio.volume === 0 || isMuted) {
        btnMute.innerHTML = '<i data-lucide="volume-x"></i>';
    } else if(audio.volume < 0.5) {
        btnMute.innerHTML = '<i data-lucide="volume-1"></i>';
    } else {
        btnMute.innerHTML = '<i data-lucide="volume-2"></i>';
    }
    lucide.createIcons();
}

// ============================================
// MOBILE NAV & DRAWER HANDLERS
// ============================================

function openMobileDrawer() {
    mobileDrawerOverlay.style.display = 'block';
    mobilePlaylistsDrawer.style.display = 'block';
    requestAnimationFrame(() => {
        mobileDrawerOverlay.classList.add('open');
        mobilePlaylistsDrawer.classList.add('open');
    });
    lucide.createIcons({ root: mobilePlaylistsDrawer });
}

function closeMobileDrawer() {
    mobileDrawerOverlay.classList.remove('open');
    mobilePlaylistsDrawer.classList.remove('open');
    setTimeout(() => {
        mobileDrawerOverlay.style.display = 'none';
        mobilePlaylistsDrawer.style.display = 'none';
    }, 400);
}

function setMobileNavActive(el) {
    document.querySelectorAll('.mobile-nav-item').forEach(i => i.classList.remove('active'));
    if (el) el.classList.add('active');
}

// Mobile Bottom Nav
if (mNavHome) mNavHome.addEventListener('click', (e) => {
    e.preventDefault();
    setMobileNavActive(mNavHome);
    updateNavUI('nav-home');
    renderHomeView();
    // Hide inline search
    if (mobileSearchInline) mobileSearchInline.style.display = 'none';
});

if (mNavSearch) mNavSearch.addEventListener('click', (e) => {
    e.preventDefault();
    setMobileNavActive(mNavSearch);
    updateNavUI('nav-search');
    renderSearchView('');
    // Show inline search and focus
    if (mobileSearchInline) {
        mobileSearchInline.style.display = 'flex';
        setTimeout(() => searchInputInline && searchInputInline.focus(), 100);
    }
});

if (mNavLibrary) mNavLibrary.addEventListener('click', (e) => {
    e.preventDefault();
    setMobileNavActive(mNavLibrary);
    updateNavUI('nav-library');
    renderLibraryView();
    if (mobileSearchInline) mobileSearchInline.style.display = 'none';
});

if (mNavPlaylists) mNavPlaylists.addEventListener('click', (e) => {
    e.preventDefault();
    setMobileNavActive(mNavPlaylists);
    openMobileDrawer();
});

if (mBtnLogout) mBtnLogout.addEventListener('click', (e) => {
    e.preventDefault();
    if (confirm('Log out of Tune4me?')) {
        localStorage.removeItem(STORAGE_USER);
        currentUser = null;
        updateAvatar();
        appContainer.style.display = 'none';
        authModal.style.display = 'flex';
    }
});

// Drawer close
if (mobileDrawerClose) mobileDrawerClose.addEventListener('click', closeMobileDrawer);
if (mobileDrawerOverlay) mobileDrawerOverlay.addEventListener('click', closeMobileDrawer);

// Drawer playlist items
function drawerNavigate(renderFn, activeNavId) {
    closeMobileDrawer();
    clearActiveNav();
    if (activeNavId) {
        const el = document.getElementById(activeNavId);
        if (el) el.classList.add('active');
    }
    setMobileNavActive(null); // clear mobile highlight
    setTimeout(renderFn, 350); // wait for drawer close animation
}

const mdFavorites = document.getElementById('md-nav-favorites');
const mdChill = document.getElementById('md-nav-chill');
const mdWorkout = document.getElementById('md-nav-workout');
const mdFocus = document.getElementById('md-nav-focus');
const mdDriving = document.getElementById('md-nav-driving');

if (mdFavorites) mdFavorites.addEventListener('click', (e) => { e.preventDefault(); drawerNavigate(renderFavoritesView, 'nav-favorites'); });
if (mdChill)     mdChill.addEventListener('click',     (e) => { e.preventDefault(); drawerNavigate(() => renderSmartMoodView('Chill'), 'nav-chill'); });
if (mdWorkout)   mdWorkout.addEventListener('click',   (e) => { e.preventDefault(); drawerNavigate(() => renderSmartMoodView('Workout'), 'nav-workout'); });
if (mdFocus)     mdFocus.addEventListener('click',     (e) => { e.preventDefault(); drawerNavigate(() => renderSmartMoodView('Focus'), 'nav-focus'); });
if (mdDriving)   mdDriving.addEventListener('click',   (e) => { e.preventDefault(); drawerNavigate(() => renderSmartMoodView('Driving'), 'nav-driving'); });

// Mobile inline search
if (searchInputInline) {
    searchInputInline.addEventListener('input', (e) => {
        renderSearchView(e.target.value);
    });
}

// Mobile menu button (hamburger) — shows playlists drawer
if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', () => {
    openMobileDrawer();
});

// ============================================
// CAR MODE HANDLERS
// ============================================

function openCarMode() {
    if (carModeOverlay) {
        carModeOverlay.classList.add('active');
        fullPlayerOverlay.classList.remove('open'); // Hide full player when car mode starts
        updateCarModeUI();
        lucide.createIcons({ root: carModeOverlay });
    }
}

function closeCarMode() {
    if (carModeOverlay) {
        carModeOverlay.classList.remove('active');
    }
}

function updateCarModeUI() {
    if (!currentSongId || !carModeOverlay.classList.contains('active')) return;
    
    const song = allSongs.find(s => s.id === currentSongId);
    if (!song) return;

    if (carTitle) carTitle.textContent = song.title;
    if (carArtist) carArtist.textContent = song.artist || 'Unknown Artist';
    if (carArt) carArt.src = song.thumbnail || 'assets/album_art.png';

    // Update Shuffle/Repeat buttons in Car Mode
    if (carShuffleBtn) {
        carShuffleBtn.classList.toggle('active', isShuffle);
    }
    if (carRepeatBtn) {
        carRepeatBtn.classList.toggle('active', repeatMode > 0);
        const icon = carRepeatBtn.querySelector('i');
        if (icon) {
            icon.setAttribute('data-lucide', repeatMode === 2 ? 'repeat-1' : 'repeat');
            lucide.createIcons({ root: carRepeatBtn });
        }
    }
}

if (fpCarModeBtn) fpCarModeBtn.addEventListener('click', openCarMode);
if (carModeExitBtn) carModeExitBtn.addEventListener('click', closeCarMode);

// Car Mode Controls
if (carPlayBtn) carPlayBtn.addEventListener('click', togglePlayPause);
if (carPrevBtn) carPrevBtn.addEventListener('click', playPrev);
if (carNextBtn) carNextBtn.addEventListener('click', playNext);
if (carShuffleBtn) carShuffleBtn.addEventListener('click', () => {
    toggleShuffle();
    updateCarModeUI();
});
if (carRepeatBtn) carRepeatBtn.addEventListener('click', () => {
    toggleRepeat();
    updateCarModeUI();
});


// Car Mode Progress Bar — tap to seek
if (carProgressBg) {
    carProgressBg.addEventListener('click', (e) => {
        if(!currentSongId || !audio.duration) return;
        const rect = carProgressBg.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        audio.currentTime = (clickX / rect.width) * audio.duration;
        savePlaybackState();
    });
}

init();
