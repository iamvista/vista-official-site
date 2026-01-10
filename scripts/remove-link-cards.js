
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const blogDir = path.join(__dirname, '../src/content/blog');

const files = fs.readdirSync(blogDir).filter(f => f.endsWith('.md'));

console.log(`Checking ${files.length} files...`);

let modifiedCount = 0;

files.forEach(file => {
    const filePath = path.join(blogDir, file);
    let content = fs.readFileSync(filePath, 'utf-8');

    // Regex to match the block:
    // [
    // 
    // Content
    // 
    // ](url)
    // We look for [ followed by newlines, content, ](http...)
    // Note: The structure seems to be `[\n\n...](url)`

    const regex = /\[\s*\n\s*[\s\S]*?\]\(http[^\)]+\)/g;

    // Check if header match (avoid normal links)
    // Normal links are [text](url) on same line usually.
    // The visual cards span multiple lines.

    if (regex.test(content)) {
        // Replace
        const newContent = content.replace(regex, '');
        if (newContent !== content) {
            fs.writeFileSync(filePath, newContent);
            console.log(`Cleaned: ${file}`);
            modifiedCount++;
        }
    }
});

console.log(`Done. Modified ${modifiedCount} files.`);
