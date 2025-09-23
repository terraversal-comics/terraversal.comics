const { Client } = require("@notionhq/client");
const { NotionToMarkdown } = require("notion-to-md");
const fs = require('fs');

const parentPageId = "27458bf5c3a480e796b4ca0f2c209df1";
const notionSecret = process.env.NOTION_SECRET;

if (!notionSecret) {
    console.error("❌ NOTION_SECRET environment variable is not set.");
    process.exit(1);
}

const notion = new Client({ auth: notionSecret });
const n2m = new NotionToMarkdown({ notionClient: notion });

function createSlug(title) {
    return title
        .replace(/[^\w\s-]/g, "")
        .trim()
        .replace(/[-\s]+/g, "-")
        .toLowerCase();
}

async function getNotionPages() {
    try {
        console.log("✅ Starting Notion to Markdown conversion...");
        
        const blocks = await notion.blocks.children.list({ block_id: parentPageId });
        const childPages = blocks.results.filter(block => block.type === 'child_page');

        if (childPages.length === 0) {
            console.log("❌ No child pages found in the parent page.");
            process.exit(1);
        }

        const contentDir = "./content";
        if (!fs.existsSync(contentDir)) {
            fs.mkdirSync(contentDir);
        } else {
            fs.readdirSync(contentDir).forEach(file => fs.unlinkSync(`${contentDir}/${file}`));
        }

        for (const page of childPages) {
            const pageTitle = page.child_page.title || "untitled-page";
            console.log(`Converting "${pageTitle}"...`);

            // This line was the main issue. It's an array of markdown blocks, not a single string.
            const mdblocks = await n2m.pageToMarkdown(page.id);
            const mdString = n2m.toMarkdownString(mdblocks);
            let contentString = mdString.parent;

            // This line now correctly removes the unwanted frontmatter that was in the Notion page itself.
            contentString = contentString.replace(/^---\s*[\s\S]*?\s*---\s*/, '').trim();
            
            let summaryString = '';
            if (contentString) {
                const firstPeriod = contentString.indexOf('.');
                if (firstPeriod !== -1 && firstPeriod < 250) {
                    summaryString = contentString.substring(0, firstPeriod + 1).trim();
                } else {
                    summaryString = contentString.substring(0, 250).trim() + '...';
                }
            }

            // Remove the JSON.stringify and just use summaryString directly.
            const finalMarkdown = `---
title: "${pageTitle}"
date: ${new Date().toISOString()}
draft: false
description: "${summaryString.replace(/"/g, '\\"')}"
---
${contentString}\n`;
            
            const fileName = `${createSlug(pageTitle)}.md`;
            fs.writeFileSync(`${contentDir}/${fileName}`, finalMarkdown, { encoding: 'utf8' });
            console.log(`✅ Saved "${pageTitle}" to ${fileName}`);
        }

        console.log("🥳 All pages converted and saved successfully!");

    } catch (error) {
        console.error("❌ An error occurred during the conversion process:", error);
        process.exit(1);
    }
}

getNotionPages();
