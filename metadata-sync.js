require('dotenv').config();
const cloudinary = require('cloudinary').v2;
const axios = require('axios');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

async function fetchOnlineMetadata(query) {
    // 1. Initial Cleaning
    const cleanQuery = query
        .replace(/lyric(s)?|video|hq|hd|remix|official|full|original/gi, '')
        .replace(/masstamilan\.fm|masstamilan\.io|isaimini|starmusiq/gi, '')
        .replace(/\s[a-z0-9]{6}$/i, '') // Remove 6-char random hashes at the end
        .replace(/[-_][a-zA-Z0-9]{6,10}$/i, '') // Remove longer random suffixes
        .replace(/[-_]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const searchAttempts = [
        cleanQuery,
        cleanQuery.split(/\s+/)[0].trim(),
        cleanQuery.split(/\s+/).slice(0, 2).join(' ').trim()
    ];

    for (const attempt of [...new Set(searchAttempts)]) {
        if (attempt.length < 3) continue;
        try {
            const url = `https://itunes.apple.com/search?term=${encodeURIComponent(attempt)}&entity=musicTrack&limit=1`;
            const response = await axios.get(url, { timeout: 5000 });
            if (response.data.results && response.data.results.length > 0) {
                const track = response.data.results[0];
                return {
                    title: track.trackName,
                    artist: track.artistName,
                    movie: track.collectionName,
                    thumbnail: track.artworkUrl100 ? track.artworkUrl100.replace('100x100bb', '1000x1000bb') : null,
                    genre: track.primaryGenreName
                };
            }
        } catch (e) {}
    }
    return null;
}

async function syncAllMetadata() {
    console.log("🚀 Starting Global Metadata Sync...");
    let nextCursor = null;
    let count = 0;

    do {
        const response = await cloudinary.api.resources({
            resource_type: 'video',
            max_results: 100,
            context: true,
            next_cursor: nextCursor
        });

        for (const file of response.resources) {
            count++;
            // Skip if already has full context
            if (file.context?.custom?.movie && file.context?.custom?.artist) {
                console.log(`[${count}] Skipping ${file.public_id} (Already tagged)`);
                continue;
            }

            const rawName = file.public_id.split('/').pop();
            let cleanTitle = rawName.replace(/\.[^/.]+$/, "").replace(/_/g, ' ').trim();
            
            console.log(`[${count}] Processing: ${cleanTitle}...`);
            try {
                const data = await fetchOnlineMetadata(cleanTitle);
                if (data) {
                    console.log(`   ✅ Found: ${data.title} from ${data.movie}`);
                    await cloudinary.api.update(file.public_id, {
                        resource_type: 'video',
                        context: {
                            title: data.title,
                            artist: data.artist,
                            movie: data.movie,
                            genre: data.genre,
                            thumbnail: data.thumbnail,
                            musicDirector: data.artist // Heuristic
                        }
                    });
                } else {
                    console.log(`   ❌ No metadata found for: ${cleanTitle}`);
                }
            } catch (err) {
                console.log(`   ⚠️ Error updating ${file.public_id}: ${err.message}`);
            }
        }
        nextCursor = response.next_cursor;
    } while (nextCursor);

    console.log("✨ Sync Complete!");
}

syncAllMetadata().catch(console.error);
