// types/task.ts
export interface Task {
  id: string;
  title: string;

  projectId: string;
  createdBy: string;
  createdByName?: string | null;
  createdAt: any;

  status?: string;
  priority?: string;
  assignedTo?: string;

  ticketType?: string;
  tags?: string[];
  description?: string;
}

export const mockVO2Stories: Task[] = [
  {
    id: "vo2-s1",
    title: "VO2 Dashboard Layout UI",
    projectId: "vo2-project",
    createdBy: "system",
    createdAt: new Date().toISOString(),
    status: "new",
    priority: "High",
    ticketType: "story",
    description: "Tasks: Create dashboard page structure, Design header/title, Create nav tabs, Design responsive grid, Apply colors/spacing, Create containers.",
    tags: ["UI", "Dashboard"]
  },
  {
    id: "vo2-s2",
    title: "Dashboard Statistics & Activity Cards UI",
    projectId: "vo2-project",
    createdBy: "system",
    createdAt: new Date().toISOString(),
    status: "new",
    priority: "Medium",
    ticketType: "story",
    description: "Tasks: Design daily clearance cards, weekly asset cards, total activity statistics, active review cards, immediate action queue cards, add priority badges.",
    tags: ["UI", "Dashboard", "Cards"]
  },
  {
    id: "vo2-s3",
    title: "Assigned, In-Progress & Completed Farmland Listing UI",
    projectId: "vo2-project",
    createdBy: "system",
    createdAt: new Date().toISOString(),
    status: "new",
    priority: "High",
    ticketType: "story",
    description: "Tasks: Create listing page layout, Design search/filter, Create info cards, Design location/amount/area sections, Create progress badges, Design View Details buttons.",
    tags: ["UI", "Listing"]
  },
  {
    id: "vo2-s4",
    title: "Farmland Details Common Layout UI",
    projectId: "vo2-project",
    createdBy: "system",
    createdAt: new Date().toISOString(),
    status: "new",
    priority: "Medium",
    ticketType: "story",
    description: "Tasks: Create common details template, Design ID header, Create Go Back button, Design section tabs, Create common info cards, Apply consistent spacing.",
    tags: ["UI", "Layout"]
  },
  {
    id: "vo2-s5",
    title: "Customer Information UI",
    projectId: "vo2-project",
    createdBy: "system",
    createdAt: new Date().toISOString(),
    status: "new",
    priority: "High",
    ticketType: "story",
    description: "Tasks: Design customer info card, Create owner details layout, Design contact info section, Create land ownership details UI, Design labels/values rows.",
    tags: ["UI", "Customer"]
  },
  {
    id: "vo2-s6",
    title: "Family Tree & Owner Profile UI",
    projectId: "vo2-project",
    createdBy: "system",
    createdAt: new Date().toISOString(),
    status: "new",
    priority: "Low",
    ticketType: "story",
    description: "Tasks: Create owner profile card, Design family member cards, Create parent/spouse/children sections, Design relationship indicators, Apply styling.",
    tags: ["UI", "Profile"]
  },
  {
    id: "vo2-s7",
    title: "Land Location & Geo Information UI",
    projectId: "vo2-project",
    createdBy: "system",
    createdAt: new Date().toISOString(),
    status: "new",
    priority: "Medium",
    ticketType: "story",
    description: "Tasks: Design location details, Create geo-reference info UI, Design map/location card, Create acquisition category section, Design coordinate display.",
    tags: ["UI", "Map", "Location"]
  },
  {
    id: "vo2-s8",
    title: "Customer Approval & Comments UI",
    projectId: "vo2-project",
    createdBy: "system",
    createdAt: new Date().toISOString(),
    status: "new",
    priority: "Medium",
    ticketType: "story",
    description: "Tasks: Design approval message section, Create comments textarea, Design Approve/Turn Back buttons, Create action footer layout.",
    tags: ["UI", "Approval"]
  },
  {
    id: "vo2-s9",
    title: "Land Images & Landscape UI",
    projectId: "vo2-project",
    createdBy: "system",
    createdAt: new Date().toISOString(),
    status: "new",
    priority: "High",
    ticketType: "story",
    description: "Tasks: Create image gallery layout, Design cover image cards, Create landscape view cards, Design image preview sections, Apply responsive grid.",
    tags: ["UI", "Images"]
  },
  {
    id: "vo2-s10",
    title: "Land Facilities & Master Plan UI",
    projectId: "vo2-project",
    createdBy: "system",
    createdAt: new Date().toISOString(),
    status: "new",
    priority: "Low",
    ticketType: "story",
    description: "Tasks: Design land shape card, Create water/electricity facility UI, Design existing trees section, Create master plan document card.",
    tags: ["UI", "Facilities"]
  },
  {
    id: "vo2-s11",
    title: "Survey & Boundary Details UI",
    projectId: "vo2-project",
    createdBy: "system",
    createdAt: new Date().toISOString(),
    status: "new",
    priority: "Medium",
    ticketType: "story",
    description: "Tasks: Create survey report cards, Design private/government survey sections, Create boundary cards, Design comments display, Apply boundary styling.",
    tags: ["UI", "Survey"]
  },
  {
    id: "vo2-s12",
    title: "Land & Boundary Approval UI",
    projectId: "vo2-project",
    createdBy: "system",
    createdAt: new Date().toISOString(),
    status: "new",
    priority: "Medium",
    ticketType: "story",
    description: "Tasks: Create approval confirmation screen, Design remarks input, Create approve/turnback action buttons, Apply consistent action layout.",
    tags: ["UI", "Approval"]
  },
  {
    id: "vo2-s13",
    title: "Valuation Documents UI",
    projectId: "vo2-project",
    createdBy: "system",
    createdAt: new Date().toISOString(),
    status: "new",
    priority: "High",
    ticketType: "story",
    description: "Tasks: Create village map card, Design sub-register value card, Create valuator report card, Design legal opinion document card, Create file preview layouts.",
    tags: ["UI", "Valuation", "Documents"]
  },
  {
    id: "vo2-s14",
    title: "Road, Transactions & Geological Details UI",
    projectId: "vo2-project",
    createdBy: "system",
    createdAt: new Date().toISOString(),
    status: "new",
    priority: "Medium",
    ticketType: "story",
    description: "Tasks: Create road approach info card, Design recent transaction section, Create geological advantages/disadvantages UI, Design future plans section.",
    tags: ["UI", "Details"]
  },
  {
    id: "vo2-s15",
    title: "Infrastructure & Valuation Approval UI",
    projectId: "vo2-project",
    createdBy: "system",
    createdAt: new Date().toISOString(),
    status: "new",
    priority: "Medium",
    ticketType: "story",
    description: "Tasks: Design upcoming infrastructure card, Create railway/airport connectivity UI, Create valuation approval screen, Design comments and action buttons.",
    tags: ["UI", "Approval"]
  },
  {
    id: "vo2-s16",
    title: "Agriculture Reports & Documents UI",
    projectId: "vo2-project",
    createdBy: "system",
    createdAt: new Date().toISOString(),
    status: "new",
    priority: "High",
    ticketType: "story",
    description: "Tasks: Create agriculture report page layout, Design officer report card, Create crop yielding report card, Design soil report document section.",
    tags: ["UI", "Agriculture", "Documents"]
  },
  {
    id: "vo2-s17",
    title: "Crop, Water & Cultivation Details UI",
    projectId: "vo2-project",
    createdBy: "system",
    createdAt: new Date().toISOString(),
    status: "new",
    priority: "Medium",
    ticketType: "story",
    description: "Tasks: Design crop details cards, Create groundwater info UI, Design current cultivation section, Create maintenance UI, Design yield/returns info.",
    tags: ["UI", "Agriculture"]
  },
  {
    id: "vo2-s18",
    title: "Agriculture Final Approval UI",
    projectId: "vo2-project",
    createdBy: "system",
    createdAt: new Date().toISOString(),
    status: "new",
    priority: "Medium",
    ticketType: "story",
    description: "Tasks: Create final approval screen, Design land rating component, Create audio attachment UI, Design comments section, Create submit action button.",
    tags: ["UI", "Approval"]
  },
  {
    id: "vo2-s19",
    title: "Verification Completion & Turnback UI",
    projectId: "vo2-project",
    createdBy: "system",
    createdAt: new Date().toISOString(),
    status: "new",
    priority: "High",
    ticketType: "story",
    description: "Tasks: Create verification success screen, Design completion message card, Create turnback popup modal, Design reason input area, Create cancel/confirm actions.",
    tags: ["UI", "Completion"]
  },
  {
    id: "vo2-s20",
    title: "Common Components, Responsive UI & Design Fixes",
    projectId: "vo2-project",
    createdBy: "system",
    createdAt: new Date().toISOString(),
    status: "new",
    priority: "High",
    ticketType: "story",
    description: "Tasks: Create reusable buttons/inputs, Design text areas/dropdowns, Optimize tablet/mobile responsiveness, Fix alignment/spacing, Validate UI.",
    tags: ["UI", "Components", "Responsive"]
  }
];