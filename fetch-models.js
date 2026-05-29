const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config({ path: ".env.local" });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function checkModels() {
  try {
    // The SDK might not have a getModels method directly if it's old, let's just fetch it via REST
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
    const data = await response.json();
    console.log("AVAILABLE MODELS:");
    data.models.forEach(m => console.log(m.name));
  } catch (err) {
    console.error("Error fetching models:", err);
  }
}

checkModels();
