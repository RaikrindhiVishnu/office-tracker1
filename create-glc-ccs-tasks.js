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
const targetProjectId = "v55H3ZZlAYbebWEZpckm"; // GLC-CCS

const data = [
  {
    title: "Story 1: Master Data API Integration",
    description: "Integrate all Master Data APIs into CCS using RTK Query and connect dynamic master data across forms, filters, and dropdowns.\n\nAPIs Included\nPOST /master/get-all-master-data\nPOST /master/get-all-geo-master-data",
    tasks: [
      {
        title: "Task 1: Configure Master Data API Endpoint",
        description: "Create RTK Query endpoint and request handling for retrieving all master configuration data from the CCS backend."
      },
      {
        title: "Task 2: Configure Geo Master Data API Endpoint",
        description: "Create RTK Query endpoint and request handling for retrieving geographical master data including countries, states, districts, and mandals."
      },
      {
        title: "Task 3: Create Master Data Type Definitions",
        description: "Define TypeScript interfaces and response models for master data API responses."
      },
      {
        title: "Task 4: Create Geo Master Data Type Definitions",
        description: "Define TypeScript interfaces and response models for geographical master data structures."
      },
      {
        title: "Task 5: Integrate Master Data into Dropdown Components",
        description: "Connect API responses to dynamic dropdowns and selection components throughout the application."
      },
      {
        title: "Task 6: Implement Cascading Location Selection",
        description: "Populate State, District, and Mandal dropdowns based on selected parent geographical data."
      },
      {
        title: "Task 7: Add Loading and Error State Handling",
        description: "Implement loaders, empty states, and API error handling for all master data requests."
      },
      {
        title: "Task 8: Validate Master Data Integration",
        description: "Verify data mapping, dropdown population, filtering behavior, and API response accuracy."
      }
    ]
  },
  {
    title: "Story 2: Dashboard API Integration",
    description: "Integrate Dashboard APIs to display real-time farmland statistics, pipeline metrics, user information, screening outcomes, and recent activities.\n\nAPIs Included\nPOST /dashboard/get-all-farmland-details\nPOST /dashboard/pipeline-status\nPOST /dashboard/get-user-by-id\nPOST /dashboard/screening-outcomes\nPOST /dashboard/recent-activities",
    tasks: [
      {
        title: "Task 1: Integrate Farmland Summary API",
        description: "Connect dashboard summary cards with farmland count data and display real-time statistics."
      },
      {
        title: "Task 2: Integrate Pipeline Status API",
        description: "Retrieve and display pipeline screening percentages, completion metrics, and processing duration."
      },
      {
        title: "Task 3: Integrate User Details API",
        description: "Fetch user information by ID and display user-related details in dashboard components."
      },
      {
        title: "Task 4: Integrate Screening Outcomes API",
        description: "Display screening outcome statistics and trend analysis for the previous seven days."
      },
      {
        title: "Task 5: Integrate Recent Activities API",
        description: "Retrieve and display the latest five activities with proper formatting and timestamps."
      },
      {
        title: "Task 6: Create Dashboard Data Models",
        description: "Define TypeScript interfaces and response structures for all dashboard APIs."
      },
      {
        title: "Task 7: Connect Dashboard Widgets and Charts",
        description: "Bind API data to dashboard cards, graphs, charts, and activity sections."
      },
      {
        title: "Task 8: Implement Loading and Error Handling",
        description: "Add loaders, skeleton screens, fallback UI, and API error handling across dashboard modules."
      },
      {
        title: "Task 9: Validate Dashboard API Data",
        description: "Verify dashboard calculations, chart rendering, activity ordering, and overall data accuracy."
      }
    ]
  },
  {
    title: "Story 3: Assigned Farmlands API Integration",
    description: "Integrate Assigned Farmland APIs to support farmland listing, farmland details retrieval, and farmland approval workflow.\n\nAPIs Included\nPOST /assigned-farmlands/get-farmland-details\nPOST /assigned-farmlands/get-all-farmlands\nPOST /assigned-farmlands/approve-farmland",
    tasks: [
      {
        title: "Task 1: Integrate Get All Farmlands API",
        description: "Retrieve all assigned farmlands and support filtering, searching, and listing functionality."
      },
      {
        title: "Task 2: Integrate Farmland Details API",
        description: "Fetch detailed farmland and owner information using farmland ID and display detailed records."
      },
      {
        title: "Task 3: Integrate Approve Farmland API",
        description: "Implement farmland approval workflow and submit approval requests to the backend."
      },
      {
        title: "Task 4: Create Assigned Farmland Data Models",
        description: "Define TypeScript interfaces and response models for farmland, owner, and approval data."
      },
      {
        title: "Task 5: Connect Farmland Listing Screen",
        description: "Replace dummy data with live API responses and populate farmland listing components."
      },
      {
        title: "Task 6: Connect Farmland Detail View",
        description: "Display farmland details, owner information, status details, and land information from API data."
      },
      {
        title: "Task 7: Implement Approval Assignment Workflow",
        description: "Allow assignment of Field Officer (FO), Inspection Officer (IO), and Regional Officer (RO) during approval."
      },
      {
        title: "Task 8: Implement Filters and Search Functionality",
        description: "Connect filter controls and search inputs with backend filtering capabilities."
      },
      {
        title: "Task 9: Add Loading and Error Handling",
        description: "Implement loading indicators, empty states, validation messages, and API error handling."
      },
      {
        title: "Task 10: Validate Assigned Farmland Workflows",
        description: "Verify farmland listing, details retrieval, approval process, and assignment functionality with backend data."
      }
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
          description: storyData.description,
          taskCode: storyCode,
          projectId: targetProjectId,
          ticketType: "story",
          status: "new",
          priority: "Medium",
          assignedTo: vishnuId,
          assignedToName: vishnuName,
          assignedDate: new Date().toISOString(),
          createdBy: vishnuId, 
          createdByName: vishnuName,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          actualHours: 0,
      });

      console.log(`Created Story: ${storyCode} - ${storyData.title}`);

      for (const task of storyData.tasks) {
          tskMax++;
          const taskCode = `TSK-${String(tskMax).padStart(3, "0")}`;

          await db.collection('projectTasks').add({
              title: task.title,
              description: task.description,
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

          console.log(`  Created Task: ${taskCode} - ${task.title}`);
      }
  }

  console.log("All stories and tasks created and assigned successfully!");
}

run().catch(console.error);
