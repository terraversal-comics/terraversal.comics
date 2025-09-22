const { Client } = require("@notionhq/client");
const { NotionToMarkdown } = require("notion-to-md");
const fs = require('fs');

// 🚨🚨 1. PASTE YOUR PARENT PAGE ID HERE 🚨🚨
// This ID is for the main 'Terraversal Comics' page that contains all your blog posts.
const parentPageId = "27458bf5c3a480e796b4ca0f2c209df1"; 

// 2. Set up Notion Clients
const notion = new Client({ auth: process.env.NOTION_SECRET }); 
const n2m = new NotionToMarkdown({ notionClient: notion });

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

            // 🚨 FIX 4: Add a 'summary' field to the Front Matter. 
            // This forces Hugo to use a clean string for the RSS description, preventing the 
            // YAML Front Matter (and the messy N2M output) from leaking into the RSS feed.
            const frontMatter = `---
title: "${pageTitle}"
date: ${new Date().toISOString()}
draft: false
summary: "This is a post about ${pageTitle}. Read more on the site!" 
---`; // NO NEWLINE HERE!

            let finalMarkdown = frontMatter;

            // 🛑 SAFETY CHECK: Only append content if it exists
            if (contentString) {
                // Aggressively strip all leading/trailing whitespace/newlines from content string
                contentString = contentString.trim();

                // 🟢 ULTIMATE CLEANUP - STEP 1: Remove residual newlines/spaces at the start
                contentString = contentString.replace(/^[\r\n]+/, '');

                // If old messy YAML was still there, this will strip it out:
                if (contentString.startsWith("```")) {
                    contentString = contentString.replace(/^```(\w*\n)?/, "").replace(/```$/, "");
                }
                
                // 💥 CLEANUP - STEP 2: Remove any leading Markdown/HTML separators that N2M might be adding
                contentString = contentString.replace(/^(#+\s*)+/, '').trim(); // Remove leading Markdown headers (e.g. #, ##)
                contentString = contentString.replace(/^(---|\*\*\*|___)/, '').trim(); // Remove leading HR/separator in MD
                
                // 🟢 FIX 3: Explicitly add TWO newlines (\n\n) after the '---'. 
                finalMarkdown += `\n\n${contentString}`; 
            } else {
                console.log(`⚠️ WARNING: "${pageTitle}" has no content. Writing front matter only.`);
            }

            // Save the Markdown to a new file in the content directory, forcing clean UTF-8 encoding
            // 🟢 FIX 2: Using the new, cleaner slug function to prevent double hyphens
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
