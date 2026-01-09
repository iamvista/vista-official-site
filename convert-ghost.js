
import fs from 'fs';
import path from 'path';
import TurndownService from 'turndown';

// Configuration
const EXPORT_FILE = 'ghost_export.json';
const OUTPUT_DIR = 'src/content/blog/ghost';
const DOMAIN = 'https://copywriting.vista.tw'; // Fallback for relative images

async function migrate() {
    console.log(`🚀 Starting migration from ${EXPORT_FILE}...`);

    // 1. Read JSON
    const rawData = fs.readFileSync(EXPORT_FILE, 'utf8');
    const ghostData = JSON.parse(rawData);

    // Ghost export structure: db[0].data
    const data = ghostData.db[0].data;
    const posts = data.posts;
    const tags = data.tags;
    const posts_tags = data.posts_tags;

    // 2. Map Tags (id -> name)
    const tagMap = {};
    tags.forEach(tag => {
        tagMap[tag.id] = tag.name;
    });

    // 3. Map Post Tags (post_id -> [tag_names])
    const postTagsMap = {};
    if (posts_tags) {
        posts_tags.forEach(pt => {
            if (!postTagsMap[pt.post_id]) postTagsMap[pt.post_id] = [];
            if (tagMap[pt.tag_id]) {
                postTagsMap[pt.post_id].push(tagMap[pt.tag_id]);
            }
        });
    }

    // 4. Setup Turndown
    const turndownService = new TurndownService({
        headingStyle: 'atx',
        codeBlockStyle: 'fenced'
    });

    // Ensure output dir
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    let count = 0;

    // 5. Process Posts
    posts.forEach(post => {
        // Skip pages if you only want posts (type='post')
        if (post.type !== 'post') return;
        // Skip drafts? (Optional: keep drafts)
        // if (post.status !== 'published') return;

        const title = post.title.replace(/"/g, '\\"'); // Escape quotes
        const slug = post.slug;
        const pubDate = new Date(post.published_at || post.created_at).toISOString();
        const description = (post.custom_excerpt || post.meta_description || '').replace(/"/g, '\\"').replace(/\n/g, ' ');
        const tagsList = postTagsMap[post.id] || [];

        // Image handling: make relative paths absolute
        let heroImage = post.feature_image;
        if (heroImage && heroImage.startsWith('/')) {
            heroImage = `${DOMAIN}${heroImage}`;
        }

        // Convert Content
        let markdown = turndownService.turndown(post.html || '');

        // Fix relative images in content
        markdown = markdown.replace(/!\[([^\]]*)\]\((\/[^)]+)\)/g, (match, alt, url) => {
            return `![${alt}](${DOMAIN}${url})`;
        });

        // 6. Construct Frontmatter
        const fileContent = `---
title: "${title}"
description: "${description}"
pubDate: "${pubDate}"
updatedDate: "${new Date(post.updated_at || post.created_at).toISOString()}"
${heroImage ? `heroImage: "${heroImage}"` : ''}
tags: ${JSON.stringify(tagsList)}
---

${markdown}
`;

        // 7. Write File
        fs.writeFileSync(path.join(OUTPUT_DIR, `${slug}.md`), fileContent);
        console.log(`✅ Converted: ${slug}`);
        count++;
    });

    console.log(`🎉 Migration complete! processing ${count} posts.`);
}

migrate().catch(console.error);
