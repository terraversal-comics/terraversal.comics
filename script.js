const { Client } = require("@notionhq/client");
const { NotionToMarkdown } = require("notion-to-md");
const fs = require('fs');

// 🚨🚨 1. PASTE YOUR PARENT PAGE ID HERE 🚨🚨
// This ID is for the main 'Terraversal Comics' page that contains all your blog posts.
const parentPageId = "27458bf5c3a480e796b4ca0f2c209df1";

// 2. Set up Notion Clients
const notion = new Client({ auth: process.env.NOTION_SECRET });
const n2m = new NotionToMarkdown({
    notionClient: notion,
    skipFrontMatter: true
});

// Helper function for creating clean filenames (slugs)
function createSlug(title) {
    return title
        .replace(/[^\w\s-]/g, "")
        .trim()
        .replace(/[-\s]+/g, "-")
        .toLowerCase();
}

// 3. Define the main function that fetches and converts pages
async function getNotionPages() {
    try {
        console.log("✅ Starting Notion to Markdown conversion from Parent Page...");

        const blocks = await notion.blocks.children.list({
            block_id: parentPageId,
        });

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

            // 🚨 FIX: Manually construct the final Markdown file with required Front Matter AND the summary separator.
            const frontMatter = `---
title: "${pageTitle}"
date: ${new Date().toISOString()}
draft: false
---
`; // 👈 Keep the trailing newline here!

            let finalMarkdown = frontMatter;

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
        console.error("Double-check your Notion secret and parent page ID.");
        process.exit(1);
    }
}

getNotionPages();
