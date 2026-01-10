
import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BLOG_DIR = path.join(__dirname, '../src/content/blog');
const PUBLIC_IMG_DIR = path.join(__dirname, '../public/images/blog');

if (!fs.existsSync(PUBLIC_IMG_DIR)) {
    fs.mkdirSync(PUBLIC_IMG_DIR, { recursive: true });
}

// Curated Aesthetic Keywords (Warm, Minimalist, Professional, "Story", "Mind")
// Based on user feedback.
const CURATED_LIST = [
    "minimalist workspace warm",
    "coffee book aesthetic",
    "open notebook sunlight",
    "macbook pro desk minimalist",
    "creative studio light",
    "shadow play wall",
    "beige aesthetic office",
    "modern interior details",
    "reading corner warm",
    "dried flowers vase",
    "magazine flat lay",
    "typing laptop hands minimalist",
    "camera lens coffee",
    "abstract paper curves",
    "neutral tones business",
    "glass of water desk",
    "stationery arrangement",
    "morning light window",
    "mindfulness stones",
    "clean desk setup",
    "minimalist plant shadow",
    "white desk setup",
    "warm coffee shop table",
    "lifestyle flat lay",
    "modern architecture detail",
    "abstract beige texture",
    "minimalist home office",
    "creativity concept light",
    "stacked books aesthetic",
    "pen and paper ideas",
    "wooden desk texture",
    "minimalist technology",
    "sunlight on wall",
    "clean workspace setup",
    "coffee mug steam",
    "planning notebook pen",
    "abstract light shadow",
    "minimalist branding mockup",
    "ipad pro desk",
    "keyboard typing hands",
    "glasses on book",
    "ceramic vase flower",
    "calm morning routine",
    "productive workspace",
    "strategy meeting table",
    "whiteboard marker hand",
    "inspiration moodboard",
    "palette color swatches",
    "design thinking post it",
    "minimalist bookshelf",
    "warm light bulb",
    "texture paper close up",
    "fountain pen writing",
    "laptop screen code",
    "digital nomad cafe",
    "podcast microphone aesthetic",
    "headphones desk minimalist",
    "rainy window coffee",
    "abstract art gallery",
    "modern chair design",
    "succulent plant desk",
    "leather notebook texture",
    "typing mechanical keyboard",
    "lamp light night",
    "open book library",
    "magazine editorial spread",
    "tablet stylus drawing",
    "camera on table",
    "watch time concept",
    "hourglass sand",
    "compass map travel",
    "passport ticket travel",
    "suitcase airport minimalist",
    "meeting room glass",
    "brainstorming sticky notes",
    "project management chart",
    "data visualization screen",
    "code syntax dark mode",
    "server room lights abstract",
    "vr headset table",
    "robot hand touch",
    "ai artificial intelligence concept",
    "neural network abstract",
    "dna helix abstract",
    "medical research microscope",
    "telescope star gazing",
    "chess board game strategy",
    "puzzle pieces connecting",
    "light bulb idea glowing",
    "ladder climbing success",
    "mountain peak sunrise",
    "forest path fog",
    "ocean waves calm",
    "desert dunes texture",
    "city skyline dusk",
    "bridge architecture perspective",
    "skyscraper glass modern",
    "museum interior space",
    "coffee beans roasted",
    "tea ceremony matcha"
];

async function downloadImage(url, filepath) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filepath);
        https.get(url, (response) => {
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                downloadImage(response.headers.location, filepath).then(resolve).catch(reject);
                return;
            }
            if (response.statusCode !== 200) {
                reject(new Error(`Status ${response.statusCode}`));
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close(() => resolve(true));
            });
        }).on('error', (err) => {
            fs.unlink(filepath, () => { });
            reject(err);
        });
    });
}

async function getUnsplashImage(keyword) {
    try {
        const searchUrl = `https://unsplash.com/s/photos/${encodeURIComponent(keyword)}`;
        const res = await fetch(searchUrl);
        const html = await res.text();

        const regex = /https:\/\/images\.unsplash\.com\/photo-[\w-]+/g;
        const matches = html.match(regex);

        if (matches && matches.length > 0) {
            // Pick random mainly to vary slightly if keywords are same, 
            // but our keyword list is diverse enough.
            const idx = Math.floor(Math.random() * Math.min(matches.length, 5));
            const baseUrl = matches[idx];
            return baseUrl;
        }
        return null;
    } catch (e) {
        return null;
    }
}

async function main() {
    const files = fs.readdirSync(BLOG_DIR).filter(f => f.endsWith('.md'));
    let processedCount = 0;
    const MAX_FILES = 2000; // Process ALL

    console.log(`Re-generating images for ${files.length} files...`);

    for (const file of files) {
        if (processedCount >= MAX_FILES) break;

        const filePath = path.join(BLOG_DIR, file);
        let content = fs.readFileSync(filePath, 'utf-8');

        // Hash the slug to pick a consistent theme
        const slug = file.replace('.md', '');
        const hash = slug.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);

        // Use hash to pick keyword
        const keywordIndex = hash % CURATED_LIST.length;
        const keyword = CURATED_LIST[keywordIndex];

        // console.log(`[${slug}] Theme: "${keyword}"`);

        // Search Unsplash
        const imageUrl = await getUnsplashImage(keyword);

        if (imageUrl) {
            // Force 16:9 Crop
            const cleanUrl = imageUrl.split('?')[0];
            const finalUrl = `${cleanUrl}?ixlib=rb-4.0.3&w=1600&h=900&fit=crop&q=80&fm=jpg&cs=srgb`;

            const imageName = `${slug}.jpg`;
            const localPath = path.join(PUBLIC_IMG_DIR, imageName);
            const publicPath = `/images/blog/${imageName}`;

            try {
                // Determine if we need to download (Overwrite always based on new requirement)
                await downloadImage(finalUrl, localPath);

                // Update Frontmatter
                // Replaces existing heroImage or adds new
                const heroMatch = content.match(/heroImage:[\s\S]*?\n/);
                if (heroMatch) {
                    content = content.replace(/heroImage:[\s\S]*?\n/, `heroImage: "${publicPath}"\n`);
                } else {
                    // Insert if missing
                    content = content.replace(/(title:.*\n)/, `$1heroImage: "${publicPath}"\n`);
                }

                fs.writeFileSync(filePath, content, 'utf-8');
                console.log(`  UPDATED: ${slug} -> ${keyword}`);
                processedCount++;
            } catch (e) {
                console.error(`  FAIL ${slug}: ${e.message}`);
            }
            // Sleep slightly
            await new Promise(r => setTimeout(r, 200));
        } else {
            console.error(`  FAIL: No image for ${keyword}`);
        }
    }
    console.log(`Done. Updated ${processedCount} posts.`);
}

main();
