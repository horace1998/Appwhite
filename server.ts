import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { Client } from "@notionhq/client";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Notion API Proxy
  app.post("/api/notion/sync", async (req, res) => {
    const { apiKey, databaseId, entry } = req.body;
    
    const notionKey = apiKey || process.env.NOTION_API_KEY;
    const dbId = databaseId || process.env.NOTION_DATABASE_ID;

    if (!notionKey || !dbId) {
      return res.status(400).json({ error: "Missing Notion configuration" });
    }

    const notion = new Client({ auth: notionKey });

    try {
      const response = await notion.pages.create({
        parent: { database_id: dbId },
        properties: {
          Title: {
            title: [
              {
                text: {
                  content: `[SYNKIFY] ${entry.location?.name || 'Moment'}`,
                },
              },
            ],
          },
          Content: {
             rich_text: [
               {
                 text: {
                    content: entry.content || "",
                 }
               }
             ]
          },
          Lyrics: {
            rich_text: [
              {
                text: {
                  content: entry.lyrics || "",
                },
              },
            ],
          },
          Location: {
            rich_text: [
              {
                text: {
                  content: entry.location?.name || "Unknown",
                },
              },
            ],
          },
          "Aesthetic Status": {
            select: {
              name: entry.mood || "Standard",
            },
          },
        },
      });

      res.json({ success: true, id: response.id });
    } catch (error: any) {
      console.error("Notion Sync Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`SYNKIFY Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
