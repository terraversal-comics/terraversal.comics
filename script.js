const { Client } = require("@notionhq/client");
const { NotionToMarkdown } = require("notion-to-md");
const fs = require('fs');

// 🚨🚨 1. PASTE YOUR DATABASE ID HERE 🚨🚨
// This is the long string before the '?' in your database URL.
// Example: "a287c2b3e8114c0a8f89e1d1b9d4a41d"
const databaseId = "27458bf5c3a480e796b4ca0f2c209df1"; 

// 2. Set up Notion Clients
const notion = new Client({ auth: process.env.NOTION_SECRET }); 
const n2m = new NotionToMarkdown({ notionClient: notion });

// 3. Define the main function that fetches and converts pages
async function getNotionPages() {
    try {
        console.log("✅ Starting Notion to Markdown conversion...");

        // Query the database to get all pages
        const pages = await notion.databases.query({
            database_id: databaseId,
            // 🚨 We are not using a filter so we don't crash 🚨
        });

        if (pages.results.length === 0) {
            console.log("❌ No pages found in the database. Double-check your database ID.");
            process.exit(1);
        }

        // 4. Create a content directory if it doesn't exist
        const contentDir = "./content";
        if (!fs.existsSync(contentDir)) {
            fs.mkdirSync(contentDir);
            console.log(`✅ Created directory: ${contentDir}`);
        } else {
            // Clear out any old files to prevent duplicates
            fs.readdirSync(contentDir).forEach(file => fs.unlinkSync(`${contentDir}/${file}`));
            console.log("✅ Cleared existing content directory.");
        }

        console.log(`📝 Found ${pages.results.length} pages. Converting...`);

        // 5. Loop through each page and convert it
        for (const page of pages.results) {
            // Use the generic `title` property, which is always present
            const pageTitle = page.properties.title.title[0]?.plain_text || "untitled-page"; 
            
            console.log(`Converting "${pageTitle}"...`);
            
            // Get the Markdown blocks for the page's content
            const mdblocks = await n2m.pageToMarkdown(page.id);
            const mdString = n2m.toMarkdownString(mdblocks).parent;

            // Save the Markdown to a new file in the content directory
            const fileName = `${pageTitle.replace(/[^a-zA-Z0-9-]/g, "-").toLowerCase()}.md`;
            fs.writeFileSync(`${contentDir}/${fileName}`, mdString);

            console.log(`✅ Saved "${pageTitle}" to ${fileName}`);
        }

        console.log("🥳 All pages converted and saved successfully! The workflow should now continue.");

    } catch (error) {
        console.error("❌ An error occurred during the conversion process:", error);
        console.error("Double-check your Notion secret and database ID.");
        process.exit(1);
    }
}

getNotionPages();
