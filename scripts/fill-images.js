
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

// Fallback pool if specific search fails
const FALLBACK_KEYWORDS = [
    "minimalist office",
    "macbook coffee",
    "writing notebook",
    "business meeting",
    "abstract technology",
    "library books",
    "creative workspace",
    "modern desk",
    "startup team",
    "coding screen"
];

async function downloadImage(url, filepath) {
    // console.log("Downloading from", url);
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filepath);
        const req = https.get(url, (response) => {
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
    // console.log(`Searching for [${keyword}]`);
    try {
        const searchUrl = `https://unsplash.com/s/photos/${encodeURIComponent(keyword)}`;
        const res = await fetch(searchUrl);
        const html = await res.text();

        // Regex to find image URLs in Unsplash HTML
        // Note: Unsplash markup changes, but usually srcSet or JSON blob contains standard patterns
        // Looking for "https://images.unsplash.com/photo-"
        const regex = /https:\/\/images\.unsplash\.com\/photo-[\w-]+/g;
        const matches = html.match(regex);

        if (matches && matches.length > 0) {
            // Pick a random one from top 5 to vary it slightly
            // But prefer the first few for relevance
            const idx = Math.floor(Math.random() * Math.min(matches.length, 5));
            const baseUrl = matches[idx];
            // Append params to ensure valid image return
            return `${baseUrl}?ixlib=rb-4.0.3&w=1200&q=80&fm=jpg&crop=entropy&cs=srgb`;
        }
        return null;
    } catch (e) {
        // console.error(e);
        return null; // Fail silently
    }
}

async function main() {
    const files = fs.readdirSync(BLOG_DIR).filter(f => f.endsWith('.md'));
    let processedCount = 0;
    const MAX_FILES = 2000; // Process ALL files

    // console.log(`Scanning 196 files...`);

    for (const file of files) {
        if (processedCount >= MAX_FILES) break;

        const filePath = path.join(BLOG_DIR, file);
        let content = fs.readFileSync(filePath, 'utf-8');

        // Frontmatter checks
        const hasHeroImage = content.match(/heroImage:\s*['"]?(\S+)['"]?/);
        const currentImage = hasHeroImage ? hasHeroImage[1] : "";

        // Broken conditions
        const isBroken = !currentImage ||
            currentImage.includes('copywriting.vista.tw') ||
            currentImage.includes('content/images') && !currentImage.startsWith('/images/blog') ||
            currentImage === '""' ||
            currentImage === "''"; // Check empty explicitly

        if (isBroken) {
            console.log(`[FIXING] ${file}`);

            // 1. Try Tags
            let keyword = null;
            const tagsMatch = content.match(/tags:\s*\[(.*?)\]/);
            if (tagsMatch && tagsMatch[1]) {
                // Try first English tag if possible, or just first tag
                const tagList = tagsMatch[1].replace(/['"]/g, '').split(',').map(t => t.trim());
                if (tagList.length > 0) keyword = tagList[0];
            }

            // 2. Try Title (English words only)
            if (!keyword) {
                const titleMatch = content.match(/title:\s*['"](.+)['"]/);
                if (titleMatch) {
                    const eng = titleMatch[1].match(/[a-zA-Z]{3,}/);
                    if (eng) keyword = eng[0];
                }
            }

            // 3. Fallback
            if (!keyword) {
                keyword = FALLBACK_KEYWORDS[Math.floor(Math.random() * FALLBACK_KEYWORDS.length)];
            }

            // console.log(`  Keyword: ${keyword}`);

            // Attempt 1: Specific Keyword
            let imageUrl = await getUnsplashImage(keyword);

            // Attempt 2: Random Fallback if specific failed
            if (!imageUrl) {
                // console.log("  Specific search failed, trying fallback...");
                const fallback = FALLBACK_KEYWORDS[Math.floor(Math.random() * FALLBACK_KEYWORDS.length)];
                imageUrl = await getUnsplashImage(fallback);
            }

            if (imageUrl) {
                const slug = file.replace('.md', '');
                const imageName = `${slug}.jpg`;
                const localPath = path.join(PUBLIC_IMG_DIR, imageName);
                const publicPath = `/images/blog/${imageName}`;

                try {
                    await downloadImage(imageUrl, localPath);

                    // Replace Frontmatter
                    if (!hasHeroImage) {
                        content = content.replace(/(title:.*\n)/, `$1heroImage: "${publicPath}"\n`);
                    } else {
                        content = content.replace(/heroImage:[\s\S]*?\n/, `heroImage: "${publicPath}"\n`);
                    }

                    fs.writeFileSync(filePath, content, 'utf-8');
                    console.log(`  SUCCESS: > ${publicPath}`);
                    processedCount++;
                } catch (e) {
                    console.error(`  FAIL Download: ${e.message}`);
                }
            } else {
                console.error("  FAIL: No image source found even with fallbacks.");
            }

            // Sleep briefly to be nice to Unsplash
            await new Promise(r => setTimeout(r, 1000));
        }
    }

    if (processedCount === 0) {
        console.log("No broken images processed in this batch.");
    } else {
        console.log(`Batch Done. Fixed ${processedCount} posts.`);
    }
}

main();
