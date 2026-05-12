require('dotenv').config();
const cloudinary = require('cloudinary').v2;
const mm = require('music-metadata');
const axios = require('axios');
const { Readable } = require('stream');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Sanitize a Cloudinary public_id to a clean, human-readable name
function cleanPublicId(rawId) {
    // Get just the base filename (strip folder prefix)
    const base = rawId.split('/').pop();
    // Remove trailing random hash added by Cloudinary (e.g. "_abc123xyz")
    // Pattern: underscore followed by 8-20 alphanumeric chars at end
    return base.replace(/_[a-z0-9]{8,20}$/i, '');
}

// Upload a raw image buffer to Cloudinary and return its URL
async function uploadEmbeddedArt(pictureData, publicId) {
    const artId = `thumbnails/${cleanPublicId(publicId)}`;
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { public_id: artId, overwrite: true, resource_type: 'image' },
            (err, result) => err ? reject(err) : resolve(result.secure_url)
        );
        Readable.from(Buffer.from(pictureData)).pipe(stream);
    });
}


async function syncMetadata() {
    console.log("Starting Smart Metadata Sync (Extracting Embedded ID3 Art)...\n");
    
    try {
        let allResources = [];
        let nextCursor = null;
        do {
            const response = await cloudinary.api.resources({
                resource_type: 'video', max_results: 500, next_cursor: nextCursor
            });
            allResources = allResources.concat(response.resources);
            nextCursor = response.next_cursor;
        } while (nextCursor);

        console.log(`Found ${allResources.length} files to process.\n`);

        let apiCallsUsed = 0;
        const API_LIMIT = 450; // Stay safely under 500

        for (const file of allResources) {
            if (file.public_id.startsWith('samples/')) continue;

            // Auto-pause if approaching rate limit
            if (apiCallsUsed >= API_LIMIT) {
                console.log(`\n⏸️  Approaching API rate limit (${apiCallsUsed} calls used).`);
                console.log(`   Waiting 60 minutes for limit to reset...`);
                await new Promise(resolve => setTimeout(resolve, 60 * 60 * 1000));
                apiCallsUsed = 0;
                console.log(`▶️  Resuming sync...\n`);
            }
            
            console.log(`Checking: ${file.public_id}`);
            
            try {
                // Download first 2MB to capture ID3 tags including embedded artwork
                const audioResponse = await axios({
                    method: 'get',
                    url: file.secure_url,
                    responseType: 'arraybuffer',
                    headers: { 'Range': 'bytes=0-2097151' }
                });

                const buffer = Buffer.from(audioResponse.data);
                const metadata = await mm.parseBuffer(buffer, { mimeType: 'audio/mpeg' });
                
                const clean = (str) => {
                    if (!str) return '';
                    return str
                        .replace(/\s*[-|]\s*MassTamilan\.(com|io|fm|net)/gi, '')
                        .replace(/\s*MassTamilan/gi, '')
                        .replace(/\s*Isaimini/gi, '')
                        .replace(/\s*Starmusiq/gi, '')
                        .replace(/\s*[-|]\s*$/g, '')
                        .trim();
                };

                let title = clean(metadata.common.title);
                let album = clean(metadata.common.album);
                let artist = clean(metadata.common.artist);
                const genre = metadata.common.genre?.map(clean).join(', ') || 'Tamil Film';
                const pictures = metadata.common.picture;

                if (!title && !album) {
                    console.log(`  ⚠️ No internal tags found. Skipping.\n`);
                    continue;
                }

                console.log(`  ✅ Title: ${title} | Movie: ${album} | Artist: ${artist}`);

                // *** THE REAL FIX: Use the artwork embedded inside the file ***
                let thumbnail = '';
                if (pictures && pictures.length > 0) {
                    try {
                        const pic = pictures[0];
                        thumbnail = await uploadEmbeddedArt(pic.data, file.public_id);
                        console.log(`  🎨 Uploaded embedded artwork to Cloudinary!`);
                    } catch (e) {
                        console.log(`  ⚠️ Could not upload embedded art: ${e.message}`);
                    }
                } else {
                    console.log(`  ⚠️ No embedded artwork in this file.`);
                }

                await cloudinary.api.update(file.public_id, {
                    resource_type: 'video',
                    context: {
                        title: title || '',
                        movie: album || '',
                        artist: artist || '',
                        genre: genre,
                        thumbnail: thumbnail || ''
                    }
                });
                apiCallsUsed++;
                console.log(`  💾 Cloudinary context updated! (API calls this hour: ${apiCallsUsed})\n`);

            } catch (err) {
                console.error(`  ❌ Failed: ${err.message}\n`);
            }
        }
        console.log("✅ Smart Sync Completed!");
    } catch (err) {
        console.error("Sync failed:", err);
    }
}

syncMetadata();
