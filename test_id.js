const { Client } = require("@notionhq/client");
const dotenv = require('dotenv');

// Load environment variables (you might need to install 'dotenv' with `npm install dotenv`)
dotenv.config();

// Your parent page ID is already here
const parentPageId = "27458bf5c3a480e796b4ca0c2c209df1";
const notionSecret = "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";

// Set up the Notion client with your secret
const notion = new Client({ auth: notionSecret });

async function getPageInfo() {
    try {
        const response = await notion.blocks.retrieve({ block_id: parentPageId });
        console.log("✅ API call successful! Here is the response:");
        console.log(response);
    } catch (error) {
        console.error("❌ An error occurred during the API call:");
        console.error(error);
    }
}

getPageInfo();
