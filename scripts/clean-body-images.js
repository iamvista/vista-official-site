
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BLOG_DIR = path.join(__dirname, '../src/content/blog');

function main() {
    const files = fs.readdirSync(BLOG_DIR).filter(f => f.endsWith('.md'));
    let processedCount = 0;

    console.log(`Scanning ${files.length} files for broken body images...`);

    for (const file of files) {
        const filePath = path.join(BLOG_DIR, file);
        let content = fs.readFileSync(filePath, 'utf-8');

        // Regex to match markdown images pointing to copywriting.vista.tw
        // Pattern: !\[.*\]\(.*copywriting\.vista\.tw.*\)(.*)
        // Including optional caption text possibly on same line or title attr

        // Note: Markdown image is exclamation mark + brackets + parentheses.
        // We want to remove the whole tag.

        const regex = /!\[.*?\]\(.*copywriting\.vista\.tw.*?\)/g;

        if (regex.test(content)) {
            console.log(`[CLEANING] ${file}`);

            // Replace with empty string (or maybe a placeholder comment? No, user said delete)
            const newContent = content.replace(regex, '');

            // Double check for HTML img tags? <img src="...copywriting.vista.tw...">
            // Ghost sometimes exports HTML.
            const htmlRegex = /<img.*?src=['"].*copywriting\.vista\.tw.*?['"].*?>/g;
            const finalContent = newContent.replace(htmlRegex, '');

            if (content !== finalContent) {
                fs.writeFileSync(filePath, finalContent, 'utf-8');
                processedCount++;
            }
        }
    }

    console.log(`Done. Cleaned ${processedCount} files.`);
}

main();
