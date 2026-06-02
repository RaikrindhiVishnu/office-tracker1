const { GoogleGenerativeAI } = require("@google/generative-ai");
const dotenv = require("dotenv");
const path = require("path");

// Load .env.local
dotenv.config({ path: path.join(__dirname, '.env.local') });

async function test() {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    console.log("API Key loaded:", !!apiKey);
    if (!apiKey) {
      console.log("API Key is missing!");
      return;
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-flash-lite-latest" });
    const chat = model.startChat({
      history: [
        { role: "user", parts: [{ text: "Hello" }] },
        { role: "model", parts: [{ text: "Understood. I am ready to help." }] }
      ]
    });
    console.log("Sending message...");
    const result = await chat.sendMessage([{ text: "hello" }]);
    console.log("Success! Response:", result.response.text());
  } catch (err) {
    console.error("FAILED WITH ERROR:", err);
  }
}

test();
