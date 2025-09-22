const { Client } = require("@notionhq/client");
const { NotionToMarkdown } = require("notion-to-md");
const fs = require('fs');

// 🚨🚨 1. PASTE YOUR PARENT PAGE ID HERE 🚨🚨
// This ID is for the main 'Terraversal Comics' page that contains all your blog posts.
// This ID: 27458bf5c3a480e796b4ca0f2c209df1 is a PAGE ID, which is correct for this API call!
const parentPageId = "27458bf5c3a480e796b4ca0f2c209df1"; 

// 2. Set up Notion Clients
// It uses the NOTION_SECRET environment variable from your GitHub workflow.
const notion = new Client({ auth: process.env.NOTION_SECRET }); 
const n2m = new NotionToMarkdown({ notionClient: notion });

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
            const mdString = n2m.toMarkdownString(mdblocks).parent;

            // 🛑 SAFETY CHECK: Only write the file if content exists!
            if (mdString) {
                // Save the Markdown to a new file in the content directory
                const fileName = `${pageTitle.replace(/[^a-zA-Z0-9-]/g, "-").toLowerCase()}.md`;
                fs.writeFileSync(`${contentDir}/${fileName}`, mdString);
                console.log(`✅ Saved "${pageTitle}" to ${fileName}`);
            } else {
                console.log(`⚠️ WARNING: "${pageTitle}" has no readable content. Skipping file creation.`);
            }

            // 🚫 The line that caused the final crash was here. It's now GONE.

        }

        console.log("🥳 All pages converted and saved successfully! The Hugo build step will run next.");

    } catch (error) {
        console.error("❌ An error occurred during the conversion process:", error);
        console.error("Double-check your Notion secret and parent page ID. Also check if your integration has permission to VIEW the parent page.");
        process.exit(1);
    }
}

getNotionPages();
