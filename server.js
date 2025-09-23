import express from "express";
import { main } from "./liquidationBot.js"; // export main from your bot.js

const app = express();
const PORT = process.env.PORT || 3000;

// simple health check
app.get("/", (req, res) => res.send("🚀 Liquidation bot is running"));

app.listen(PORT, () => {
  console.log(`✅ Web server running on port ${PORT}`);
  main(); // start the bot once server is live
});
