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
const targetProjectId = "RcS6H5T4xU3yshkWYIG1"; // Verification Officer-2

const data = [
  {
    title: "Story 1: VO2 Dashboard Layout UI",
    tasks: [
      "Create dashboard page structure.",
      "Design dashboard header and title section.",
      "Create navigation menu tabs.",
      "Design responsive grid layout.",
      "Apply colors, typography, and spacing.",
      "Create reusable dashboard containers."
    ]
  },
  {
    title: "Story 2: Dashboard Statistics & Activity Cards UI",
    tasks: [
      "Design daily clearance status cards.",
      "Create weekly asset certification cards.",
      "Design total activity statistics cards.",
      "Create active review cards.",
      "Design immediate action queue cards.",
      "Add priority badges and status labels."
    ]
  },
  {
    title: "Story 3: Assigned, In-Progress & Completed Farmland Listing UI",
    tasks: [
      "Create farmland listing page layout.",
      "Design search and filter section.",
      "Create farmland information cards.",
      "Design location, amount, and area sections.",
      "Create progress and status badges.",
      "Design View Details and Resume Verification buttons."
    ]
  },
  {
    title: "Story 4: Farmland Details Common Layout UI",
    tasks: [
      "Create common details page template.",
      "Design farmland ID header.",
      "Create Go Back navigation button.",
      "Design section tabs.",
      "Create common information cards.",
      "Apply consistent spacing and alignment."
    ]
  },
  {
    title: "Story 5: Customer Information UI",
    tasks: [
      "Design customer information card.",
      "Create owner personal details layout.",
      "Design contact information section.",
      "Create land ownership details UI.",
      "Design labels, values, and information rows."
    ]
  },
  {
    title: "Story 6: Family Tree & Owner Profile UI",
    tasks: [
      "Create owner profile card.",
      "Design family member cards.",
      "Create father, mother, spouse, and children sections.",
      "Design relationship indicators.",
      "Apply card styling and spacing."
    ]
  },
  {
    title: "Story 7: Land Location & Geo Information UI",
    tasks: [
      "Design location details section.",
      "Create geo-reference information UI.",
      "Design map/location card.",
      "Create acquisition category section.",
      "Design coordinate display layout."
    ]
  },
  {
    title: "Story 8: Customer Approval & Comments UI",
    tasks: [
      "Design approval message section.",
      "Create comments textarea.",
      "Design Approve button.",
      "Design Turn Back button.",
      "Create action footer layout."
    ]
  },
  {
    title: "Story 9: Land Images & Landscape UI",
    tasks: [
      "Create image gallery layout.",
      "Design cover image cards.",
      "Create landscape view cards.",
      "Design image preview sections.",
      "Apply responsive image grid."
    ]
  },
  {
    title: "Story 10: Land Facilities & Master Plan UI",
    tasks: [
      "Design land shape information card.",
      "Create water facility UI.",
      "Create electricity facility UI.",
      "Design existing trees section.",
      "Create master plan document card."
    ]
  },
  {
    title: "Story 11: Survey & Boundary Details UI",
    tasks: [
      "Create survey report cards.",
      "Design private and government survey sections.",
      "Create East, West, North, and South boundary cards.",
      "Design comments display sections.",
      "Apply boundary information styling."
    ]
  },
  {
    title: "Story 12: Land & Boundary Approval UI",
    tasks: [
      "Create approval confirmation screen.",
      "Design remarks input section.",
      "Create approve action button.",
      "Design turnback action button.",
      "Apply consistent action layout."
    ]
  },
  {
    title: "Story 13: Valuation Documents UI",
    tasks: [
      "Create village map document card.",
      "Design sub-register value card.",
      "Create valuator report card.",
      "Design legal opinion document card.",
      "Create file preview layouts."
    ]
  },
  {
    title: "Story 14: Road, Transactions & Geological Details UI",
    tasks: [
      "Create road approach information card.",
      "Design recent transaction section.",
      "Create geological advantages UI.",
      "Design future plans section.",
      "Create disadvantages information layout."
    ]
  },
  {
    title: "Story 15: Infrastructure & Valuation Approval UI",
    tasks: [
      "Design upcoming infrastructure card.",
      "Create railway connectivity UI.",
      "Design airport connectivity section.",
      "Create valuation approval screen.",
      "Design comments and action buttons."
    ]
  },
  {
    title: "Story 16: Agriculture Reports & Documents UI",
    tasks: [
      "Create agriculture report page layout.",
      "Design agriculture officer report card.",
      "Create crop yielding report card.",
      "Design soil report document section.",
      "Apply file card styling."
    ]
  },
  {
    title: "Story 17: Crop, Water & Cultivation Details UI",
    tasks: [
      "Design crop details cards.",
      "Create groundwater information UI.",
      "Design current cultivation section.",
      "Create maintenance details UI.",
      "Design yield and returns information."
    ]
  },
  {
    title: "Story 18: Agriculture Final Approval UI",
    tasks: [
      "Create final approval screen.",
      "Design land rating component.",
      "Create audio attachment UI.",
      "Design comments section.",
      "Create submit action button."
    ]
  },
  {
    title: "Story 19: Verification Completion & Turnback UI",
    tasks: [
      "Create verification success screen.",
      "Design completion message card.",
      "Create turnback popup modal.",
      "Design reason input area.",
      "Create cancel and confirm actions."
    ]
  },
  {
    title: "Story 20: Common Components, Responsive UI & Design Fixes",
    tasks: [
      "Create reusable buttons and input components.",
      "Design text areas and dropdown styles.",
      "Optimize tablet responsiveness.",
      "Optimize mobile responsiveness.",
      "Fix alignment, spacing, and typography issues.",
      "Validate UI against Figma designs."
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
