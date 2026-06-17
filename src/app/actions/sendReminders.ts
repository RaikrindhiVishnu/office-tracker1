"use server";

export async function sendTimesheetRemindersAction() {
  try {
    const url = `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/cron/reminders?type=evening`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${process.env.SCHEDULER_SECRET || process.env.CRON_SECRET}`
      },
      cache: 'no-store'
    });

    const data = await res.json();
    return { success: true, data };
  } catch (error: any) {
    console.error("Error sending reminders:", error);
    return { success: false, error: error.message };
  }
}
