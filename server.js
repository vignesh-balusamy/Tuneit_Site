require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cloudinary = require('cloudinary').v2;
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

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

// Setup Caches & DBs
const CACHE_FILE = path.join(__dirname, 'cache.json');
const USERS_FILE = path.join(__dirname, 'users.json');

let metadataCache = {};
if (fs.existsSync(CACHE_FILE)) {
    try { metadataCache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')); } catch (e) {}
}

let usersDB = {};
if (fs.existsSync(USERS_FILE)) {
    try { usersDB = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); } catch (e) {}
}

function saveCache() { fs.writeFileSync(CACHE_FILE, JSON.stringify(metadataCache, null, 2)); }
function saveUsers() { fs.writeFileSync(USERS_FILE, JSON.stringify(usersDB, null, 2)); }

// iTunes Fetcher
async function fetchOnlineMetadata(query) {
    if (metadataCache[query]) return metadataCache[query];
    try {
        const safeQuery = encodeURIComponent(query);
        const response = await fetch(`https://itunes.apple.com/search?term=${safeQuery}&entity=song&limit=1`);
        const data = await response.json();
        if (data.results && data.results.length > 0) {
            const track = data.results[0];
            const result = {
                title: track.trackName,
                artist: track.artistName,
                genre: track.primaryGenreName,
                thumbnail: track.artworkUrl100 ? track.artworkUrl100.replace('100x100', '600x600') : null
            };
            metadataCache[query] = result;
            saveCache();
            return result;
        }
    } catch (e) { console.error("iTunes API error:", query); }
    metadataCache[query] = null;
    saveCache();
    return null;
}

// --- AUTH ENDPOINTS ---
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const user = usersDB[username];
    
    if(!user) return res.status(401).json({success: false, error: "Invalid credentials"});
    
    // Verify hashed password
    const isMatch = bcrypt.compareSync(password, user.password);
    if(!isMatch) return res.status(401).json({success: false, error: "Invalid credentials"});
    
    res.json({ success: true, user: { username, likedSongs: user.likedSongs || [] } });
});

app.post('/api/sync-likes', (req, res) => {
    const { username, likedSongs } = req.body;
    if(usersDB[username]) {
        usersDB[username].likedSongs = likedSongs;
        saveUsers();
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false });
    }
});

// --- MUSIC ENDPOINTS ---
app.get('/api/songs', async (req, res) => {
  try {
    const result = await cloudinary.api.resources({ resource_type: 'video', max_results: 100, context: true, tags: true });
    const songsPromises = result.resources
      .filter(file => !file.public_id.startsWith('samples/'))
      .map(async file => {
        const parts = file.public_id.split('/');
        let rawName = parts[parts.length - 1] || 'Unknown';
        let cleanTitle = rawName.replace(/_/g, ' ').replace(/-/g, ' ').replace(/masstamilan\.fm/i, '').trim();

        let artist = file.context?.custom?.artist;
        let movie = file.context?.custom?.movie || 'Unknown Movie';
        
        const tLower = cleanTitle.toLowerCase();
        if (tLower.includes('thalapathy') || tLower.includes('selfie') || tLower.includes('thamarai') || tLower.includes('palaanadhu') || tLower.includes('aattama')) {
            artist = 'Vijay';
        }
        if (tLower.includes('selfie pulla')) movie = 'Kaththi';
        if (tLower.includes('thamarai')) movie = 'Vettaikaaran';
        if (tLower.includes('nenjangootil')) artist = 'Yuvan Shankar Raja';
        if (tLower.includes('dailamo')) artist = 'Silambarasan TR';

        let finalTitle = cleanTitle;
        let finalArtist = artist || 'Unknown Artist';
        let finalThumbnail = 'assets/album_art.png';
        let genre = 'World';

        const onlineData = await fetchOnlineMetadata(cleanTitle);
        if (onlineData) {
            finalTitle = onlineData.title || finalTitle;
            if(!artist) finalArtist = onlineData.artist || finalArtist;
            finalThumbnail = onlineData.thumbnail || finalThumbnail;
            genre = onlineData.genre || genre;
        }

        let smartMood = 'Chill'; 
        const gLower = genre.toLowerCase();
        
        if (gLower.includes('dance') || gLower.includes('electronic') || gLower.includes('hip-hop') || gLower.includes('rock') || tLower.includes('kacheri')) smartMood = 'Workout';
        else if (gLower.includes('soundtrack') || gLower.includes('classical') || gLower.includes('instrumental')) smartMood = 'Focus';
        else if (gLower.includes('pop') || gLower.includes('alternative') || gLower.includes('r&b') || gLower.includes('soul')) smartMood = 'Driving';

        return {
          id: file.public_id,
          title: finalTitle,
          url: file.secure_url,
          artist: finalArtist,
          movie: movie,
          genre: genre,
          mood: smartMood,
          duration: file.duration || 0,
          thumbnail: finalThumbnail
        };
    });

    const songs = await Promise.all(songsPromises);
    res.json({ success: true, songs });
  } catch (error) {
    console.error("Cloudinary Error:", error);
    res.status(500).json({ success: false, error: 'Failed to fetch songs' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
