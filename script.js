const { Client } = require("@notionhq/client");
const { NotionToMarkdown } = require("notion-to-md");
const fs = require('fs');

// 🚨🚨 1. PASTE YOUR PARENT PAGE ID HERE 🚨🚨
// This ID is for the main 'Terraversal Comics' page that contains all your blog posts.
const parentPageId = "27458bf5c3a480e796b4ca0f2c209df1"; 

// 2. Set up Notion Clients
const notion = new Client({ auth: process.env.NOTION_SECRET }); 
// Initialize N2M with skipFrontMatter: true
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

        // 🛑 CRITICAL: We list the content (children) of the Parent Page.
        const blocks = await notion.blocks.children.list({
            block_id: parentPageId, 
        });

        // We filter the list to only include blocks that are 'child_page' type (your blog posts).
        const childPages = blocks.results.filter(block => block.type === 'child_page');
        
        if (childPages.length === 0) {
            console.log("❌ No child pages found in the parent page. Check your Notion permissions and page ID.");
            process.exit(1);
        }

        // 4. Create and clear content directory
        const contentDir = "./content";
        if (!fs.existsSync(contentDir)) {
            fs.mkdirSync(contentDir);
            console.log(`✅ Created directory: ${contentDir}`);
        } else {
            // Clear out any old files to prevent duplicates
            fs.readdirSync(contentDir).forEach(file => fs.unlinkSync(`${contentDir}/${file}`));
            console.log("✅ Cleared existing content directory.");
        }

        console.log(`📝 Found ${childPages.length} child pages. Converting...`);

        // 5. Loop through each child page and convert it
        for (const page of childPages) {
            const pageTitle = page.child_page.title || "untitled-page"; 
            
            console.log(`Converting "${pageTitle}"...`);
            
            // Get the Markdown blocks for the page's content
            const mdblocks = await n2m.pageToMarkdown(page.id);
            let contentString = n2m.toMarkdownString(mdblocks).parent;

            // 🚨 FINAL FIX: Manually construct the final Markdown file with required Front Matter.
            // The final backtick must be IMMEDIATELY after the final '---' with NO newline inside the template string.
            const frontMatter = `---
title: "${pageTitle}"
date: ${new Date().toISOString()}
draft: false
---`;

            // 🟢 ULTIMATE CLEANUP - Strip any leading newlines/whitespace from the content
            if (contentString) {
                // Aggressively remove leading whitespace/newlines/BOMs from content
                contentString = contentString.replace(/^[\s\r\n\uFEFF\u00A0]+/, '');
            } else {
                contentString = ''; // Ensure it's not null/undefined
            }

            // Combine the front matter and the cleaned content.
            // The single '\n\n' guarantees a blank line between the final '---' 
            // and the content, which is what Hugo needs to separate them.
            const finalMarkdown = `${frontMatter}\n\n${contentString}`;
            
            // Save the Markdown to a new file in the content directory
            // ☢️ NUCLEAR CLEANUP: Aggressively remove ALL leading junk from the FINAL string 
            // to force the file to start with the three hyphens.
            const nuclearCleanedMarkdown = finalMarkdown.replace(/^[\s\r\n\uFEFF\u00A0]+/, '');
            
            const fileName = `${createSlug(pageTitle)}.md`;
            fs.writeFileSync(`${contentDir}/${fileName}`, nuclearCleanedMarkdown, { encoding: 'utf8' });
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
```eof
