const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config({ path: ".env.local" });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function run() {
  const models = await genAI.getModels();
  models.forEach(model => {
    console.log(model.name);
  });
}
run().catch(console.error);
