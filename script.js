const { Client } = require("@notionhq/client");
const { NotionToMarkdown } = require("notion-to-md");
const fs = require('fs');

// 🚨 1. PASTE YOUR DATABASE ID HERE 🚨
// Get this ID from your Notion Database URL (it's the long string before the '?').
const databaseId = "PASTE_YOUR_DATABASE_ID_HERE"; 

// 2. Set up Notion Clients
const notion = new Client({ auth: process.env.NOTION_TOKEN });
const n2m = new NotionToMarkdown({ notionClient: notion });

// 3. Create the content directory if it doesn't exist
const contentDir = "content/posts";
if (!fs.existsSync(contentDir)) {
    fs.mkdirSync(contentDir, { recursive: true });
}

// 4. Main function to fetch, convert, and save pages
async function getNotionData() {
    console.log("Starting Notion data export...");

    // Query the database for all pages
    const response = await notion.databases.query({
        database_id: databaseId,
        filter: {
            property: "Status", // Assuming you have a Status property
            select: {
                equals: "Published", // Only fetch pages marked 'Published'
            },
        },
    });

    for (const page of response.results) {
        // Extract page title from the properties
        const pageTitle = page.properties.Name.title[0]?.plain_text || "untitled-page";
        const fileName = pageTitle.toLowerCase().replace(/[^a-z0-9]/g, '-');
        
        // Convert blocks to Markdown
        const mdblocks = await n2m.pageToMarkdown(page.id);
        const mdString = n2m.toMarkdownString(mdblocks);

        // --- Create Hugo Front Matter (Metadata) ---
        const frontMatter = 
`---
title: "${pageTitle.replace(/"/g, '\\"')}"
date: "${page.created_time}"
draft: false
---

`;
        
        // Save the file
        fs.writeFileSync(`${contentDir}/${fileName}.md`, frontMatter + mdString.parent);
        console.log(`✅ Exported: ${fileName}.md`);
    }
    console.log("Notion export complete!");
}

getNotionData().catch(err => {
    console.error("Notion Export Failed:", err);
    process.exit(1); // Force the Action to fail if the script fails
});
