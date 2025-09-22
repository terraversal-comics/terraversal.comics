const { Client } = require("@notionhq/client");
const { NotionToMarkdown } = require("notion-to-md");
const fs = require('fs');

// 🚨 1. PASTE YOUR DATABASE ID HERE 🚨
// This is the long string before the '?' in your database URL.
const databaseId = "27458bf5c3a480e796b4ca0f2c209df1"; 

// 2. Set up Notion Clients
const notion = new Client({ auth: process.env.NOTION_SECRET }); // Make sure it's process.env.NOTION_SECRET
const n2m = new NotionToMarkdown({ notionClient: notion });

// 3. This is our debug script.
async function getNotionDebugData() {
    console.log("🔥 Starting DEBUG script...");
    console.log("🔥 Checking Notion token...");

    try {
        // This is a simple query to test if the token is valid.
        const tokenTest = await notion.users.list({});
        console.log("✅ Token is working! It returned user data.");
        console.log("🔥 Now querying database...");
        
        // This query fetches the first few pages of your database
        const response = await notion.databases.query({
            database_id: databaseId,
            page_size: 5, // We don't need all of them, just enough to debug
        });

        if (response.results.length === 0) {
            console.log("❌ No pages found in this database. Double-check your database ID.");
        } else {
            console.log("✅ Database query succeeded. Printing the properties of the first page:");
            
            // Print out the properties of the very first page it finds
            const firstPage = response.results[0];
            const propertyKeys = Object.keys(firstPage.properties);
            console.log("🔥 Found these properties (columns) in your database:");
            console.log(propertyKeys);
            console.log("🔥 Full JSON of the first page's properties:");
            console.log(JSON.stringify(firstPage.properties, null, 2));

            console.log("✅ DEBUG SCRIPT COMPLETE. Look for the property names above and tell me what they are.");
            // We force a crash here because this script is for debugging only.
            // A successful run would have an exit code of 0, but since we need to wait
            // for your input, we force it to fail.
            process.exit(1);
        }

    } catch (error) {
        console.error("❌ A Notion API error occurred! This most likely means your secret token is wrong or the database ID is incorrect.");
        console.error("❌ The specific error is:", error);
        process.exit(1);
    }
}

getNotionDebugData();
