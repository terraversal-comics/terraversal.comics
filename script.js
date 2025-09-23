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
            const mdblocks = await n2m.pageToMarkdown(page.id);
            let contentString = (n2m.toMarkdownString(mdblocks).body || []).join('\n');

            let summaryString = '';
            if (contentString) {
                const firstPeriod = contentString.indexOf('.');
                if (firstPeriod !== -1 && firstPeriod < 250) {
                    summaryString = contentString.substring(0, firstPeriod + 1).trim();
                } else {
                    summaryString = contentString.substring(0, 250).trim() + '...';
                }
            }

            let finalMarkdown = `---
title: "${pageTitle}"
date: ${new Date().toISOString()}
draft: false
description: ${JSON.stringify(summaryString)}
---
`;
            
            if (contentString) {
                finalMarkdown += `\n${contentString}`;
            }

            const fileName = `${createSlug(pageTitle)}.md`;
            fs.writeFileSync(`${contentDir}/${fileName}`, finalMarkdown, { encoding: 'utf8' });
        }

        console.log("🥳 All pages converted and saved successfully!");

    } catch (error) {
        console.error("❌ An error occurred during the conversion process:", error);
        process.exit(1);
    }
}

getNotionPages();
