const { GoogleGenerativeAI } = require("@google/generative-ai");
const dotenv = require("dotenv");
const path = require("path");

// Load env
dotenv.config({ path: path.join(__dirname, '.env.local') });

async function run() {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-flash-lite-latest",
      tools: [{
        functionDeclarations: [
          { 
            name: "checkInEmployee", 
            description: "Check the employee in for attendance today.", 
            parameters: { type: "OBJECT", properties: {} } 
          }
        ]
      }]
    });

    const chat = model.startChat({
      history: []
    });

    console.log("Sending message that triggers function call...");
    const result = await chat.sendMessage("Please check me in.");
    
    console.log("Response Text:", result.response.text());
    
    // Check if functionCalls is a method or property
    console.log("Type of functionCalls:", typeof result.response.functionCalls);
    if (typeof result.response.functionCalls === "function") {
      console.log("Calling functionCalls():", result.response.functionCalls());
    } else {
      console.log("Accessing functionCalls property:", result.response.functionCalls);
    }
  } catch (err) {
    console.error("FAILED WITH ERROR:", err);
  }
}

run();
