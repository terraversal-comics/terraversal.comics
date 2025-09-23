const { Client } = require("@notionhq/client");
const { NotionToMarkdown } = require("notion-to-md");
const fs = require('fs');

// 🚨 FINAL FIX: The Parent Page ID and Notion Secret are handled here
const parentPageId = "27458bf5c3a480e796b4ca0c2c209df1";
const notionSecret = process.env.NOTION_SECRET;

// Check to make sure the Notion Secret is actually present
if (!notionSecret) {
  console.error("❌ NOTION_SECRET environment variable is not set. Please add it to your GitHub Actions secrets.");
  process.exit(1);
}

const notion = new Client({ auth: notionSecret });
const n2m = new NotionToMarkdown({ notionClient: notion });

// Helper function to create clean filenames (slugs)
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
        
        // This is where the error happens. We'll use the correct ID format.
        const blocks = await notion.blocks.children.list({ block_id: parentPageId });
        
        const childPages = blocks.results.filter(block => block.type === 'child_page');

        if (childPages.length === 0) {
            console.log("❌ No child pages found in the parent page. Check your Notion permissions and page ID.");
            process.exit(1);
        }

        const contentDir = "./content";
        if (!fs.existsSync(contentDir)) {
            fs.mkdirSync(contentDir);
            console.log(`✅ Created directory: ${contentDir}`);
        } else {
            fs.readdirSync(contentDir).forEach(file => fs.unlinkSync(`${contentDir}/${file}`));
            console.log("✅ Cleared existing content directory.");
        }

        console.log(`📝 Found ${childPages.length} child pages. Converting...`);

        for (const page of childPages) {
            const pageTitle = page.child_page.title || "untitled-page";
            console.log(`Converting "${pageTitle}"...`);
            const mdblocks = await n2m.pageToMarkdown(page.id);
            let contentString = n2m.toMarkdownString(mdblocks).parent;

            let finalMarkdown = `---
title: "${pageTitle}"
date: ${new Date().toISOString()}
draft: false
---
`;

            if (contentString) {
                // Ensure content string starts with a newline after the front matter
                if (!contentString.startsWith('\n')) {
                    contentString = '\n' + contentString;
                }
                finalMarkdown += contentString;
            } else {
                console.log(`⚠️ WARNING: "${pageTitle}" has no content. Writing front matter only.`);
            }

            const fileName = `${createSlug(pageTitle)}.md`;
            fs.writeFileSync(`${contentDir}/${fileName}`, finalMarkdown, { encoding: 'utf8' });
            console.log(`✅ Saved "${pageTitle}" to ${fileName}`);
        }

        console.log("🥳 All pages converted and saved successfully! The Hugo build step will run next.");

    } catch (error) {
        console.error("❌ An error occurred during the conversion process:", error);
        process.exit(1);
    }
}

getNotionPages();
