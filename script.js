const { Client } = require("@notionhq/client");
const { NotionToMarkdown } = require("notion-to-md");
const fs = require('fs');

// 🚨🚨 1. PASTE YOUR PARENT PAGE ID HERE 🚨🚨
// This ID is for the main 'Terraversal Comics' page that contains all your blog posts.
const parentPageId = "27458bf5c3a480e796b4ca0f2c209df1"; 

// 2. Set up Notion Clients
const notion = new Client({ auth: process.env.NOTION_SECRET }); 
// 💥 FIX 1: Initialize N2M with skipFrontMatter: true. This should be the default, but we enforce it.
const n2m = new NotionToMarkdown({ 
    notionClient: notion,
    skipFrontMatter: true
});

// Helper function for creating clean filenames (slugs)
function createSlug(title) {
    // 1. Remove non-alphanumeric/non-space/non-hyphen characters
    // 2. Trim leading/trailing whitespace
    // 3. Replace all spaces and consecutive hyphens with a single hyphen
    // 4. Convert to lowercase
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

        // 4. Create and clear content directory (Hugo needs a fresh 'content' folder)
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
            // The title is stored in the 'child_page' property when listing children.
            const pageTitle = page.child_page.title || "untitled-page"; 
            
            console.log(`Converting "${pageTitle}"...`);
            
            // Get the Markdown blocks for the page's content
            const mdblocks = await n2m.pageToMarkdown(page.id);
            let contentString = n2m.toMarkdownString(mdblocks).parent;

            // 🚨 FIX 2: Manually construct the final Markdown file with required Front Matter.
            // The template string MUST NOT have a newline after the final '---'
            const frontMatter = `---
title: "${pageTitle}"
date: ${new Date().toISOString()}
draft: false
---`; // 👈 NO NEWLINE HERE!

            let finalMarkdown = frontMatter;

            // 🛑 SAFETY CHECK: Only append content if it exists
            if (contentString) {
                // Aggressively strip all leading/trailing whitespace/newlines from content string
                contentString = contentString.trim();

                // 💥 NUCLEAR FIX: Use regex to strip the entire ghost YAML code block.
                // This targets the multi-line structure including surrounding code fences.
                const yamlRegex = /^```?\s*---[\s\S]*?---[\s\S]*?```?\s*/i;
                contentString = contentString.replace(yamlRegex, '');

                // 🟢 FINAL CLEANUP: Re-trim and ensure no residual newlines/spaces at the start
                contentString = contentString.trim();
                contentString = contentString.replace(/^[\r\n]+/, '');
                
                // 🟢 FIX 3: Add a double newline for perfect separation.
                finalMarkdown += `\n\n${contentString}`; 
            } else {
                console.log(`⚠️ WARNING: "${pageTitle}" has no content. Writing front matter only.`);
            }

            // Save the Markdown to a new file in the content directory, forcing clean UTF-8 encoding
            // 🟢 FIX 4: Using the new, cleaner slug function to prevent double hyphens
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
