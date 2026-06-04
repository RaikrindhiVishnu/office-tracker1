const fs = require("fs");
const path = require("path");

const filePath = path.join(
  __dirname,
  "..",
  "src",
  "components",
  "mobile",
  "MobileAdminDashboard.tsx"
);

let content = fs.readFileSync(filePath, "utf-8");

// 1. Add imports
const importsToAdd = `
import AdminQueriesView from "../../app/(dashboard)/admin/AdminQueriesView";
import ProjectManagement from "../../app/(dashboard)/admin/ProjectManagement";
import MessagesView from "../../app/(dashboard)/admin/meassages";
import MonthlyReport from "../../app/(dashboard)/admin/monthlyreport";
import CalendarView from "../../app/(dashboard)/admin/calendar";
import LeadsView from "../../app/(dashboard)/admin/LeadsView";
import InvoicesView from "../../app/(dashboard)/admin/InvoicesView";
import AccountsDashboard from "../../app/(dashboard)/admin/Accounts/AccountsDashboard";
import ITAssetsView from "../../app/(dashboard)/admin/it-assets/page";
import AIInsightsView from "../../app/(dashboard)/admin/AIInsightsView";
import { addDoc, serverTimestamp, orderBy, setDoc } from "firebase/firestore";
import type { AttendanceType } from "@/types/attendance";
`;

content = content.replace('import EmployeeDetails', importsToAdd + '\\nimport EmployeeDetails');

// 2. Add ActiveTab types
content = content.replace(
  `useState<"home" | "employees" | "employeeDetails" | "approvals" | "payroll" | "analytics" | "notifications">("home")`,
  `useState<string>("home")`
);

// 3. Add state variables inside the component
const stateVars = `
  // New States for Desktop Features
  const [projects, setProjects] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [monthlyDate, setMonthlyDate] = useState(new Date());
  const [monthlyAttendance, setMonthlyAttendance] = useState<any>({});
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarDate, setCalendarDate] = useState(new Date());

  // Constants for monthly report
  const DECLARED_HOLIDAYS: Record<string, { title: string }> = {
    "2026-01-01": { title: "New Year" },
    "2026-01-14": { title: "Pongal" },
    "2026-08-15": { title: "Independence Day" },
  };
  const isSunday = (y: number, m: number, d: number) => new Date(y, m, d).getDay() === 0;
  const isSecondSaturday = (y: number, m: number, d: number) => new Date(y, m, d).getDay() === 6 && Math.ceil(d / 7) === 2;
  const isFourthSaturday = (y: number, m: number, d: number) => new Date(y, m, d).getDay() === 6 && Math.ceil(d / 7) === 4;
  const isFifthSaturday = (y: number, m: number, d: number) => new Date(y, m, d).getDay() === 6 && Math.ceil(d / 7) === 5;
  const isHoliday = (dateStr: string) => DECLARED_HOLIDAYS[dateStr];

  const getAutoStatus = ({ dateStr, sessionsByDate, isHolidayDay }: any): AttendanceType => {
    if (isHolidayDay) return "H";
    return "A";
  };
  const saveMonthlyAttendance = async (uid: string, dateStr: string, status: AttendanceType) => {
    // simplified for mobile display
    const monthKey = \`\${monthlyDate.getFullYear()}-\${String(monthlyDate.getMonth() + 1).padStart(2, "0")}\`;
    await setDoc(doc(db, "monthlyAttendance", monthKey), { [uid]: { [dateStr]: status }, updatedAt: serverTimestamp() }, { merge: true });
  };
  const loadMessages = async () => {
    const snap = await getDocs(collection(db, "messages"));
    setMessages(snap.docs.map((d) => ({ id: d.id, text: d.data().text })));
  };
  const sendMessage = async () => {
    if (!newMsg.trim()) return;
    await addDoc(collection(db, "messages"), { text: newMsg, createdAt: serverTimestamp() });
    setNewMsg("");
    loadMessages();
  };

  useEffect(() => {
    if (!user) return;
    const projectsQuery = query(collection(db, "projects"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(projectsQuery, (snap) => {
      setProjects(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    loadMessages();
    return () => unsub();
  }, [user]);

`;

content = content.replace('const [name, setName] = useState("");', stateVars + '\\n  const [name, setName] = useState("");');

// 4. Expand Pills in renderHome()
const pillsReplacement = `
              {/* Horizontal Action Pills */}
              <div className="mt-6 flex items-center gap-3 overflow-x-auto no-scrollbar pb-2 relative z-10">
                <button onClick={() => setActiveTab("analytics")} className="shrink-0 flex items-center gap-2 bg-white/10 hover:bg-white/20 active:bg-white/30 backdrop-blur-md px-4 py-2.5 rounded-full border border-white/10 transition-all">
                  <span className="text-lg">📊</span>
                  <span className="text-white text-xs font-bold tracking-wide">Monitor</span>
                </button>
                <button onClick={() => setActiveTab("employees")} className="shrink-0 flex items-center gap-2 bg-white/10 hover:bg-white/20 active:bg-white/30 backdrop-blur-md px-4 py-2.5 rounded-full border border-white/10 transition-all">
                  <span className="text-lg">👥</span>
                  <span className="text-white text-xs font-bold tracking-wide">Team</span>
                </button>
                <button onClick={() => setActiveTab("approvals")} className="shrink-0 flex items-center gap-2 bg-white/10 hover:bg-white/20 active:bg-white/30 backdrop-blur-md px-4 py-2.5 rounded-full border border-white/10 transition-all relative">
                  <span className="text-lg">✅</span>
                  <span className="text-white text-xs font-bold tracking-wide">Approvals</span>
                  {pendingApprovals > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-[#111116]"></span>
                  )}
                </button>
                <button onClick={() => setActiveTab("projects")} className="shrink-0 flex items-center gap-2 bg-white/10 hover:bg-white/20 active:bg-white/30 backdrop-blur-md px-4 py-2.5 rounded-full border border-white/10 transition-all">
                  <span className="text-lg">📁</span>
                  <span className="text-white text-xs font-bold tracking-wide">Projects</span>
                </button>
                <button onClick={() => setActiveTab("queries")} className="shrink-0 flex items-center gap-2 bg-white/10 hover:bg-white/20 active:bg-white/30 backdrop-blur-md px-4 py-2.5 rounded-full border border-white/10 transition-all">
                  <span className="text-lg">🎫</span>
                  <span className="text-white text-xs font-bold tracking-wide">Tickets</span>
                </button>
                <button onClick={() => setActiveTab("messages")} className="shrink-0 flex items-center gap-2 bg-white/10 hover:bg-white/20 active:bg-white/30 backdrop-blur-md px-4 py-2.5 rounded-full border border-white/10 transition-all">
                  <span className="text-lg">💬</span>
                  <span className="text-white text-xs font-bold tracking-wide">Messages</span>
                </button>
                <button onClick={() => setActiveTab("crm")} className="shrink-0 flex items-center gap-2 bg-white/10 hover:bg-white/20 active:bg-white/30 backdrop-blur-md px-4 py-2.5 rounded-full border border-white/10 transition-all">
                  <span className="text-lg">📈</span>
                  <span className="text-white text-xs font-bold tracking-wide">CRM</span>
                </button>
                <button onClick={() => setActiveTab("invoices")} className="shrink-0 flex items-center gap-2 bg-white/10 hover:bg-white/20 active:bg-white/30 backdrop-blur-md px-4 py-2.5 rounded-full border border-white/10 transition-all">
                  <span className="text-lg">🧾</span>
                  <span className="text-white text-xs font-bold tracking-wide">Billing</span>
                </button>
                <button onClick={() => setActiveTab("accounts")} className="shrink-0 flex items-center gap-2 bg-white/10 hover:bg-white/20 active:bg-white/30 backdrop-blur-md px-4 py-2.5 rounded-full border border-white/10 transition-all">
                  <span className="text-lg">💰</span>
                  <span className="text-white text-xs font-bold tracking-wide">Accounts</span>
                </button>
                <button onClick={() => setActiveTab("assets")} className="shrink-0 flex items-center gap-2 bg-white/10 hover:bg-white/20 active:bg-white/30 backdrop-blur-md px-4 py-2.5 rounded-full border border-white/10 transition-all">
                  <span className="text-lg">💻</span>
                  <span className="text-white text-xs font-bold tracking-wide">Assets</span>
                </button>
                <button onClick={() => setActiveTab("ai")} className="shrink-0 flex items-center gap-2 bg-white/10 hover:bg-white/20 active:bg-white/30 backdrop-blur-md px-4 py-2.5 rounded-full border border-white/10 transition-all">
                  <span className="text-lg">🧠</span>
                  <span className="text-white text-xs font-bold tracking-wide">AI Hub</span>
                </button>
                <button onClick={() => setActiveTab("calendar")} className="shrink-0 flex items-center gap-2 bg-white/10 hover:bg-white/20 active:bg-white/30 backdrop-blur-md px-4 py-2.5 rounded-full border border-white/10 transition-all">
                  <span className="text-lg">📅</span>
                  <span className="text-white text-xs font-bold tracking-wide">Calendar</span>
                </button>
                <button onClick={() => setActiveTab("monthly")} className="shrink-0 flex items-center gap-2 bg-white/10 hover:bg-white/20 active:bg-white/30 backdrop-blur-md px-4 py-2.5 rounded-full border border-white/10 transition-all">
                  <span className="text-lg">📑</span>
                  <span className="text-white text-xs font-bold tracking-wide">Reports</span>
                </button>
              </div>
`;

content = content.replace(/<div className="mt-6 flex items-center gap-3 overflow-x-auto no-scrollbar pb-2 relative z-10">[\s\S]*?<\/div>/m, pillsReplacement.trim());

// 5. Add rendering for new tabs
const newComponents = \`
          {activeTab === "queries" && (
             <div className="px-2 overflow-x-auto">
                {/* @ts-ignore */}
                <AdminQueriesView user={user} userData={userData} />
             </div>
          )}
          {activeTab === "projects" && (
             <div className="px-2">
                <div className="bg-white rounded-2xl shadow-sm p-0 overflow-hidden mb-6 flex-1 flex flex-col min-h-0">
                  <ProjectManagement user={{ ...user, ...userData }} projects={projects} users={users} />
                </div>
             </div>
          )}
          {activeTab === "messages" && (
             <div className="px-2">
               <MessagesView view={activeTab} messages={messages} newMsg={newMsg} setNewMsg={setNewMsg} sendMessage={sendMessage} loadMessages={loadMessages} db={db} />
             </div>
          )}
          {activeTab === "crm" && (
             <div className="px-2 overflow-x-auto"><LeadsView /></div>
          )}
          {activeTab === "invoices" && (
             <div className="px-2 overflow-x-auto"><InvoicesView /></div>
          )}
          {activeTab === "accounts" && (
             <div className="px-2 overflow-x-auto"><AccountsDashboard /></div>
          )}
          {activeTab === "assets" && (
             <div className="px-2 overflow-x-auto"><ITAssetsView /></div>
          )}
          {activeTab === "ai" && (
             <div className="px-2 overflow-x-auto"><AIInsightsView /></div>
          )}
          {activeTab === "calendar" && (
             <div className="px-2 overflow-x-auto">
                <CalendarView showCalendar={showCalendar} setShowCalendar={setShowCalendar} calendarDate={calendarDate} setCalendarDate={setCalendarDate} isSunday={isSunday} isSecondSaturday={isSecondSaturday} isFourthSaturday={isFourthSaturday} isFifthSaturday={isFifthSaturday} isHoliday={isHoliday} />
             </div>
          )}
          {activeTab === "monthly" && (
             <div className="px-2 overflow-x-auto">
                <MonthlyReport db={db} users={users} monthlyDate={monthlyDate} setMonthlyDate={setMonthlyDate} monthlyAttendance={monthlyAttendance} setMonthlyAttendance={setMonthlyAttendance} sessionsByDate={{}} isHoliday={isHoliday} saveMonthlyAttendance={saveMonthlyAttendance as any} getAutoStatus={getAutoStatus} isSunday={isSunday} isSecondSaturday={isSecondSaturday} isFourthSaturday={isFourthSaturday} isFifthSaturday={isFifthSaturday} />
             </div>
          )}
\`;

content = content.replace('{activeTab === "payroll" && (', newComponents + '\\n          {activeTab === "payroll" && (');

fs.writeFileSync(filePath, content, "utf-8");
console.log("Successfully updated MobileAdminDashboard.tsx");
