const admin = require('firebase-admin');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env.local') });

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');

if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      })
    });
}

const db = admin.firestore();

const vishnuId = "mbfGvKJ5YUUHyyD8x39HPFwq5wB3";
const vishnuName = "Raikrindhi vishnu";
const targetProjectId = "NC5bawFtdDoaqiMQxpCK"; // office tracker

const data = [
  {
    title: "Story 1: Admin Dashboard Layout & Navigation",
    tasks: [
      "Create admin dashboard main layout.",
      "Implement sidebar navigation menu.",
      "Add expandable/collapsible sidebar.",
      "Create top header section.",
      "Add company logo and branding.",
      "Display logged-in admin profile.",
      "Implement profile dropdown menu.",
      "Add quick navigation shortcuts.",
      "Create responsive dashboard layout.",
      "Optimize dashboard performance."
    ]
  },
  {
    title: "Story 2: Dashboard Statistics Cards",
    tasks: [
      "Create employee count card.",
      "Create active employees card.",
      "Create online/offline employee statistics.",
      "Display attendance summary.",
      "Display leave request count.",
      "Display project statistics.",
      "Display pending approvals count.",
      "Add card animations.",
      "Implement real-time data updates.",
      "Integrate dashboard statistics APIs."
    ]
  },
  {
    title: "Story 3: Employee Overview Dashboard",
    tasks: [
      "Display total employees list.",
      "Show new joining employees.",
      "Display employee department statistics.",
      "Show employee role distribution.",
      "Create employee status indicators.",
      "Add employee quick search.",
      "Add employee filtering options.",
      "Display employee profile preview."
    ]
  },
  {
    title: "Story 4: Attendance Monitoring Dashboard",
    tasks: [
      "Display employees checked-in today.",
      "Display employees absent today.",
      "Show late arrival reports.",
      "Display employee working hours.",
      "Show active sessions.",
      "Display live online employees.",
      "Create attendance summary graphs.",
      "Add attendance quick actions."
    ]
  },
  {
    title: "Story 5: Employee Live Tracking",
    tasks: [
      "Implement employee online status.",
      "Show currently active employees.",
      "Track employee login sessions.",
      "Display last active time.",
      "Add location tracking status.",
      "Display check-in/check-out status.",
      "Add real-time refresh mechanism."
    ]
  },
  {
    title: "Story 6: Announcement Dashboard Widget",
    tasks: [
      "Display latest announcements.",
      "Create announcement cards.",
      "Show announcement priority.",
      "Display announcement expiry date.",
      "Add \"View All\" navigation.",
      "Implement announcement notifications."
    ]
  },
  {
    title: "Story 7: Notifications Management",
    tasks: [
      "Create notification panel UI.",
      "Display unread notification count.",
      "Show notification history.",
      "Implement mark as read functionality.",
      "Add notification categories.",
      "Implement real-time notifications.",
      "Add notification filtering.",
      "Add notification deletion."
    ]
  },
  {
    title: "Story 8: Calendar & Event Dashboard",
    tasks: [
      "Create calendar widget.",
      "Display company holidays.",
      "Display upcoming events.",
      "Display employee birthdays.",
      "Add meeting reminders.",
      "Add event quick view.",
      "Implement calendar API integration."
    ]
  },
  {
    title: "Story 9: Recent Activity Timeline",
    tasks: [
      "Create activity timeline UI.",
      "Display employee activities.",
      "Show attendance updates.",
      "Show leave updates.",
      "Show project updates.",
      "Display timestamps.",
      "Add activity filtering."
    ]
  },
  {
    title: "Story 10: Quick Action Panel",
    tasks: [
      "Create quick action buttons.",
      "Add employee creation shortcut.",
      "Add project creation shortcut.",
      "Add announcement creation shortcut.",
      "Add leave approval shortcut.",
      "Add report generation shortcut."
    ]
  },
  {
    title: "Story 11: Dashboard Charts & Analytics",
    tasks: [
      "Create attendance charts.",
      "Create employee growth graphs.",
      "Create department-wise analytics.",
      "Create leave statistics charts.",
      "Display project progress charts.",
      "Add chart filters.",
      "Implement real-time analytics updates."
    ]
  },
  {
    title: "Story 12: Admin Search Functionality",
    tasks: [
      "Create global search bar.",
      "Implement employee search.",
      "Implement project search.",
      "Implement announcement search.",
      "Add search suggestions.",
      "Add recent search history."
    ]
  },
  {
    title: "Story 13: Dashboard Filters",
    tasks: [
      "Create date range filters.",
      "Create department filters.",
      "Create role filters.",
      "Create status filters.",
      "Implement filter reset option.",
      "Connect filters with APIs."
    ]
  },
  {
    title: "Story 14: Admin Profile Widget",
    tasks: [
      "Display admin information.",
      "Display profile image.",
      "Implement profile edit shortcut.",
      "Display admin role.",
      "Add account settings navigation."
    ]
  },
  {
    title: "Story 15: System Health Monitoring",
    tasks: [
      "Display server status.",
      "Show database connection status.",
      "Display API response status.",
      "Show storage usage.",
      "Display application version."
    ]
  },
  {
    title: "Story 16: Dashboard Settings",
    tasks: [
      "Enable widget customization.",
      "Allow card rearrangement.",
      "Save dashboard preferences.",
      "Add theme selection.",
      "Add dark/light mode switch."
    ]
  },
  {
    title: "Story 17: Dashboard Loading & Error Handling",
    tasks: [
      "Create skeleton loaders.",
      "Create empty state screens.",
      "Handle API failures.",
      "Add retry functionality.",
      "Display error messages."
    ]
  },
  {
    title: "Story 18: Dashboard Performance Optimization",
    tasks: [
      "Implement lazy loading.",
      "Optimize API calls.",
      "Implement caching.",
      "Reduce unnecessary renders.",
      "Optimize images and assets."
    ]
  },
  {
    title: "Story 19: Dashboard Security & Permissions",
    tasks: [
      "Restrict dashboard modules by role.",
      "Hide unauthorized widgets.",
      "Validate API permissions.",
      "Log admin actions.",
      "Prevent unauthorized access."
    ]
  },
  {
    title: "Story 20: Dashboard Testing & QA",
    tasks: [
      "Test dashboard UI.",
      "Test responsive design.",
      "Test API integrations.",
      "Validate real-time updates.",
      "Perform cross-browser testing.",
      "Verify accessibility standards."
    ]
  }
];

async function run() {
  console.log("Fetching existing tasks to determine next numbers...");
  const snap = await db.collection('projectTasks').where("projectId", "==", targetProjectId).get();
  let strMax = 0;
  let tskMax = 0;

  snap.forEach(doc => {
      const taskCode = doc.data().taskCode || "";
      if (taskCode.startsWith("STR-")) {
          const num = parseInt(taskCode.split("-")[1], 10) || 0;
          if (num > strMax) strMax = num;
      }
      if (taskCode.startsWith("TSK-")) {
          const num = parseInt(taskCode.split("-")[1], 10) || 0;
          if (num > tskMax) tskMax = num;
      }
  });

  console.log(`Starting with STR-${strMax+1} and TSK-${tskMax+1}`);

  for (const storyData of data) {
      strMax++;
      const storyCode = `STR-${String(strMax).padStart(3, "0")}`;
      
      const storyRef = await db.collection('projectTasks').add({
          title: storyData.title,
          taskCode: storyCode,
          projectId: targetProjectId,
          ticketType: "story",
          status: "new",
          priority: "Medium",
          assignedTo: vishnuId,
          assignedToName: vishnuName,
          assignedDate: new Date().toISOString(),
          createdBy: vishnuId, // assuming created by same user
          createdByName: vishnuName,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          actualHours: 0,
      });

      console.log(`Created Story: ${storyCode} - ${storyData.title}`);

      for (const taskTitle of storyData.tasks) {
          tskMax++;
          const taskCode = `TSK-${String(tskMax).padStart(3, "0")}`;

          await db.collection('projectTasks').add({
              title: taskTitle,
              taskCode: taskCode,
              projectId: targetProjectId,
              ticketType: "task",
              status: "new",
              priority: "Medium",
              parentStoryId: storyRef.id,
              parentStoryTitle: storyData.title,
              assignedTo: vishnuId,
              assignedToName: vishnuName,
              assignedDate: new Date().toISOString(),
              createdBy: vishnuId,
              createdByName: vishnuName,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              actualHours: 0,
          });

          console.log(`  Created Task: ${taskCode} - ${taskTitle}`);
      }
  }

  console.log("All stories and tasks created and assigned successfully!");
}

run().catch(console.error);
