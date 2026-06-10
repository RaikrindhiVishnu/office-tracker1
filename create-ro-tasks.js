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
const targetProjectId = "NQuK5kJH141rS6x6gTAW"; // Glc-regional officer

const data = [
  {
    title: "Story 1: Regional Officer Dashboard Layout UI",
    tasks: [
      "Create RO dashboard page structure.",
      "Design dashboard header and welcome section.",
      "Create sidebar navigation UI.",
      "Design page containers and grid layouts.",
      "Apply typography and spacing styles.",
      "Ensure responsive dashboard layout."
    ]
  },
  {
    title: "Story 2: Dashboard Statistics Cards UI",
    tasks: [
      "Create clearance rate card.",
      "Design verification queue card.",
      "Create active field deployment card.",
      "Design acreage cleared statistics card.",
      "Create pending checks card.",
      "Apply card shadows and status colors."
    ]
  },
  {
    title: "Story 3: Dashboard Progress & Activity UI",
    tasks: [
      "Create progress tracker section.",
      "Design regional audit progress cards.",
      "Create recent activity timeline UI.",
      "Design daily clearance pace card.",
      "Create scheduled site visit section.",
      "Design status indicators."
    ]
  },
  {
    title: "Story 4: Field Officer Deployment UI",
    tasks: [
      "Design field officer deployment calendar.",
      "Create active FO count card.",
      "Design team leader details card.",
      "Create weekly activity layout.",
      "Design deployment status indicators."
    ]
  },
  {
    title: "Story 5: Assigned Farmland List UI",
    tasks: [
      "Create assigned farmland page layout.",
      "Design search bar UI.",
      "Create filter dropdowns.",
      "Design farmland information cards.",
      "Display area, amount, and cost cards.",
      "Create View Details action button."
    ]
  },
  {
    title: "Story 6: Farmland Status Listing UI",
    tasks: [
      "Create approved farmland cards.",
      "Design pending farmland cards.",
      "Create in-review farmland cards.",
      "Design urgent status badges.",
      "Create high-value labels.",
      "Design farmland progress indicators."
    ]
  },
  {
    title: "Story 7: Requested Information List UI",
    tasks: [
      "Create requested information page.",
      "Design returned information cards.",
      "Create return reason section.",
      "Design agent information cards.",
      "Create returned status badges.",
      "Design view reason action button."
    ]
  },
  {
    title: "Story 8: Requested Information Details UI",
    tasks: [
      "Design returned case details page.",
      "Create issue summary section.",
      "Design comments display card.",
      "Create document list UI.",
      "Design timestamps and history section."
    ]
  },
  {
    title: "Story 9: Drafts Management UI",
    tasks: [
      "Create draft listing page.",
      "Design draft farmland cards.",
      "Create edit action button.",
      "Design continue process button.",
      "Create draft status labels.",
      "Apply consistent card styling."
    ]
  },
  {
    title: "Story 10: Farmland Summary Details UI",
    tasks: [
      "Create farmland summary page.",
      "Design primary asset details card.",
      "Create secondary asset details card.",
      "Design valuation summary.",
      "Create acreage information sections.",
      "Design agent details card."
    ]
  },
  {
    title: "Story 11: Customer Information UI",
    tasks: [
      "Create customer information layout.",
      "Design owner details card.",
      "Create family tree section.",
      "Design land details section.",
      "Create location and geo-reference cards.",
      "Design information labels and values."
    ]
  },
  {
    title: "Story 12: Land Images & Boundaries UI",
    tasks: [
      "Create land images gallery.",
      "Design landscape image cards.",
      "Create land shape section.",
      "Design water and electricity cards.",
      "Create trees and master plan sections.",
      "Design survey and boundary cards."
    ]
  },
  {
    title: "Story 13: Land Boundary Comments UI",
    tasks: [
      "Create East boundary card.",
      "Design West boundary card.",
      "Create North boundary card.",
      "Design South boundary card.",
      "Design comments sections.",
      "Create uploaded file cards."
    ]
  },
  {
    title: "Story 14: Valuation Documents UI",
    tasks: [
      "Create village map document card.",
      "Design sub-register document card.",
      "Create valuator report card.",
      "Design legal opinion report card.",
      "Create file preview cards.",
      "Apply document layout styling."
    ]
  },
  {
    title: "Story 15: Valuation Details UI",
    tasks: [
      "Design road approach section.",
      "Create recent transaction cards.",
      "Design geological advantages section.",
      "Create future plans UI.",
      "Design infrastructure cards.",
      "Create railway and airport connectivity sections."
    ]
  },
  {
    title: "Story 16: Agriculture & Report UI",
    tasks: [
      "Create agriculture report layout.",
      "Design agriculture officer report card.",
      "Create crop yielding report section.",
      "Design soil report card.",
      "Create crop information cards.",
      "Design groundwater details section."
    ]
  },
  {
    title: "Story 17: Agriculture Details & Submission UI",
    tasks: [
      "Create current cultivation section.",
      "Design future crops layout.",
      "Create maintenance details card.",
      "Design natural advantages section.",
      "Create disadvantages section.",
      "Design submission action area."
    ]
  },
  {
    title: "Story 18: Timeline & File View UI",
    tasks: [
      "Create activity timeline UI.",
      "Design date and time indicators.",
      "Create file attachment cards.",
      "Design uploaded file listing.",
      "Create comment history section.",
      "Design edit action button."
    ]
  },
  {
    title: "Story 19: Upload & Re-upload Document UI",
    tasks: [
      "Create drag-and-drop upload area.",
      "Design file selection component.",
      "Create uploaded file preview cards.",
      "Design file size and format information.",
      "Create cancel and save action buttons.",
      "Design re-upload layout."
    ]
  },
  {
    title: "Story 20: Common Components, Responsive UI & Design Fixes",
    tasks: [
      "Create common button components.",
      "Design input and textarea styles.",
      "Create dropdown components.",
      "Fix spacing and alignment issues.",
      "Optimize tablet responsiveness.",
      "Optimize mobile responsiveness.",
      "Perform UI consistency checks."
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
          createdBy: vishnuId,
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
