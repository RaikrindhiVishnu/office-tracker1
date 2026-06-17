import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function run() {
  const secret = process.env.SCHEDULER_SECRET || process.env.CRON_SECRET;
  console.log("Sending request to http://localhost:3000/api/cron/reminders?type=evening ...");
  try {
    const res = await fetch("http://localhost:3000/api/cron/reminders?type=evening", {
      headers: {
        Authorization: `Bearer ${secret}`
      }
    });
    const data = await res.json();
    console.log("Response:", data);
  } catch (err) {
    console.error("Error:", err);
  }
}

run();
