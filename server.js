require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cloudinary = require('cloudinary').v2;
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '')));

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const CACHE_FILE = path.join(__dirname, 'cache.json');
const USERS_FILE = path.join(__dirname, 'users.json');
const MAPPINGS_FILE = path.join(__dirname, 'metadata_mappings.json');

let metadataCache = {};
if (fs.existsSync(CACHE_FILE)) {
    try { metadataCache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')); } catch (e) {}
}

let usersDB = {};
if (fs.existsSync(USERS_FILE)) {
    try { usersDB = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); } catch (e) {}
}

let metadataMappings = { actors: {}, composers: {} };
if (fs.existsSync(MAPPINGS_FILE)) {
    try { metadataMappings = JSON.parse(fs.readFileSync(MAPPINGS_FILE, 'utf8')); } catch (e) {}
}

function saveCache() { fs.writeFileSync(CACHE_FILE, JSON.stringify(metadataCache, null, 2)); }
function saveUsers() { fs.writeFileSync(USERS_FILE, JSON.stringify(usersDB, null, 2)); }

async function fetchOnlineMetadata(query) {
    if (metadataCache[query]) return metadataCache[query];

    const apiQuery = query
        .replace(/lyric(s)?|video|hq|hd|remix|official|full|original/gi, '')
        .replace(/masstamilan\.fm|masstamilan\.io|isaimini|starmusiq/gi, '')
        .replace(/[-_][a-zA-Z0-9]{6,10}$/i, '')
        .replace(/[-_]/g, ' ')
        .trim();

    try {
        const url = `https://itunes.apple.com/search?term=${encodeURIComponent(apiQuery + ' Tamil')}&entity=musicTrack&limit=1`;
        const response = await axios.get(url, { timeout: 5000 });
        if (response.data.results && response.data.results.length > 0) {
            const track = response.data.results[0];
            const data = {
                title: track.trackName,
                artist: track.artistName,
                album: track.collectionName,
                thumbnail: track.artworkUrl100 ? track.artworkUrl100.replace('100x100bb', '1000x1000bb') : 'assets/album_art.png',
                genre: track.primaryGenreName
            };
            metadataCache[query] = data;
            saveCache();
            return data;
        }
    } catch (e) {}

    return null;
}

// --- AUTH ENDPOINTS ---
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const user = usersDB[username];
    if(!user) return res.status(401).json({success: false, error: "Invalid credentials"});
    let isMatch = (password === user.password) || (bcrypt.compareSync(password, user.password));
    if(!isMatch) return res.status(401).json({success: false, error: "Invalid credentials"});
    res.json({ success: true, user: { username, likedSongs: user.likedSongs || [] } });
});

app.post('/api/sync-likes', (req, res) => {
    const { username, likedSongs } = req.body;
    if(usersDB[username]) {
        usersDB[username].likedSongs = likedSongs;
        saveUsers();
        res.json({ success: true });
    } else res.status(401).json({ success: false });
});

// --- MUSIC ENDPOINTS ---
app.get('/api/songs', async (req, res) => {
  const authHeader = req.headers['x-auth-user'];
  if (!authHeader) return res.status(401).json({ success: false });

  try {
    let allResources = [];
    let nextCursor = null;
    do {
      const response = await cloudinary.api.resources({ resource_type: 'video', max_results: 500, context: true, next_cursor: nextCursor });
      allResources = allResources.concat(response.resources);
      nextCursor = response.next_cursor;
    } while (nextCursor);

    const songs = await Promise.all(allResources
      .filter(file => !file.public_id.startsWith('samples/'))
      .map(async file => {
        const cleanName = file.public_id.split('/').pop().replace(/\.[^/.]+$/, "").replace(/[_-]/g, ' ').replace(/\s*MassTamilan.*/gi, '').trim();
        
        // Priority 1: Cloudinary Context (Now populated with 100% accurate ID3 tags via smart-sync)
        let title = file.context?.custom?.title || cleanName;
        let movie = file.context?.custom?.movie || 'Unknown Movie';
        let artist = file.context?.custom?.artist || 'Unknown Artist';
        let genre = file.context?.custom?.genre || 'Tamil Film';
        let thumbnail = file.context?.custom?.thumbnail || 'assets/album_art.png';
        let musicDirector = 'Unknown Composer';

        // Priority 2: Online Lookup (Only if context is missing)
        if (movie === 'Unknown Movie' || artist === 'Unknown Artist') {
            const online = await fetchOnlineMetadata(cleanName);
            if (online) {
                title = title === cleanName ? online.title : title;
                artist = artist === 'Unknown Artist' ? online.artist : artist;
                movie = movie === 'Unknown Movie' ? online.album : movie;
                thumbnail = thumbnail === 'assets/album_art.png' ? online.thumbnail : thumbnail;
                genre = online.genre || genre;
            }
        }

        // Apply Dynamic Actor/Composer Mappings
        let actorList = [];
        const mLower = movie.toLowerCase();
        const tLower = title.toLowerCase();

        for (const [actorName, movies] of Object.entries(metadataMappings.actors)) {
            if (movies.some(m => {
                const search = m.toLowerCase();
                return m.length <= 3 ? new RegExp(`\\b${search}\\b`, 'i').test(mLower + ' ' + tLower) : (mLower.includes(search) || tLower.includes(search));
            })) {
                if (!actorList.includes(actorName)) actorList.push(actorName);
            }
        }

        for (const [composerName, movies] of Object.entries(metadataMappings.composers)) {
            if (movies.some(m => mLower.includes(m.toLowerCase()))) {
                musicDirector = composerName;
                break;
            }
        }

        // Smart Mood Heuristics
        let mood = 'Chill';
        const gLower = genre.toLowerCase();
        if (gLower.includes('dance') || gLower.includes('electronic') || gLower.includes('hip-hop') || tLower.includes('theme') || tLower.includes('verithanam') || tLower.includes('mass')) mood = 'Workout';
        else if (gLower.includes('soundtrack') || gLower.includes('classical') || gLower.includes('focus')) mood = 'Focus';
        else if (gLower.includes('pop') || gLower.includes('tamil') || gLower.includes('film') || tLower.includes('dailamo') || tLower.includes('pulla') || tLower.includes('adada')) mood = 'Driving';
        else if (gLower.includes('soul') || tLower.includes('melody') || tLower.includes('love')) mood = 'Chill';

        return { id: file.public_id, title, artist, movie, musicDirector, actors: actorList.join(', '), url: file.secure_url, thumbnail, mood, genre };
      }));

    res.json({ success: true, songs });
  } catch (error) {
    res.status(500).json({ success: false });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
