const fs = require('fs');
const path = require('path');

const dashPath = path.join(__dirname, '..', 'src', 'components', 'mobile', 'MobileDashboard.tsx');
const adminPath = path.join(__dirname, '..', 'src', 'components', 'mobile', 'MobileAdminDashboard.tsx');

let dashContent = fs.readFileSync(dashPath, 'utf8');

// The dashContent is exactly the Employee Dashboard. We just need to change its name and inject the Admin tabs.

// 1. Rename components
dashContent = dashContent.replace(/export const MobileDashboard: React\.FC = \(\) => \{/, 'export const MobileAdminDashboard: React.FC = () => {');

// 2. Add admin imports to the top of the file
const adminImports = `
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
import EmployeesView from "../../app/(dashboard)/admin/employees";
import AdminBreakView from "@/components/AdminBreakView";
import LeaveRequests from "../../app/(dashboard)/admin/leaverequests";
`;
dashContent = dashContent.replace('import { MobileAttendance }', adminImports + '\\nimport { MobileAttendance }');

// 3. Inject Admin State and logic
const adminState = `
  // New States for Desktop Features
  const [messages, setMessages] = useState<any[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [monthlyDate, setMonthlyDate] = useState(new Date());
  const [monthlyAttendance, setMonthlyAttendance] = useState<any>({});
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [designation, setDesignation] = useState("");
  const [accountType, setAccountType] = useState<any>("EMPLOYEE");

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

  const getAutoStatus = ({ isHolidayDay }: any): any => isHolidayDay ? "H" : "A";
  const saveMonthlyAttendance = async (uid: string, dateStr: string, status: any) => {
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
  useEffect(() => { loadMessages(); }, []);
`;
dashContent = dashContent.replace('// Leave Request form states', adminState + '\\n  // Leave Request form states');

// 4. Update the ActiveTab type to include string (to support all tabs)
dashContent = dashContent.replace(
  `const [activeTab, setActiveTab] = useState<`,
  `const [activeTab, setActiveTab] = useState<string | `
);

// 5. Replace search dropdown apps array
const searchReplacement = `
                        const apps = [
                          { label: "Team", tab: "employees", icon: "👥", desc: "Manage employees" },
                          { label: "Projects", tab: "projects", icon: "📁", desc: "View timelines" },
                          { label: "Approvals", tab: "approvals", icon: "✅", desc: "Leave requests" },
                          { label: "Messages", tab: "messages", icon: "💬", desc: "Broadcasts" },
                          { label: "Tickets", tab: "queries", icon: "🎫", desc: "Employee queries" },
                          { label: "CRM", tab: "crm", icon: "📈", desc: "Leads" },
                          { label: "Billing", tab: "invoices", icon: "🧾", desc: "Invoices" },
                          { label: "Accounts", tab: "accounts", icon: "💰", desc: "Payroll" },
                          { label: "Assets", tab: "assets", icon: "💻", desc: "IT Assets" },
                          { label: "AI Hub", tab: "ai", icon: "🧠", desc: "Insights" },
                          { label: "Calendar", tab: "calendar", icon: "📅", desc: "Company Events" },
                          { label: "Reports", tab: "monthly", icon: "📑", desc: "Attendance Reports" },
                        ];
`;
dashContent = dashContent.replace(/const apps = \[[\s\S]*?\];/, searchReplacement.trim());

// 6. Replace Category Nav Tabs
const navTabsReplacement = `
            {/* ── CATEGORY NAV TABS ── */}
            <div className="bg-[#e0e7ff] px-3 pb-3 flex gap-2 overflow-x-auto hide-scrollbar">
              {([
                { label: "Home", tab: "home", icon: "🏠" },
                { label: "Team", tab: "employees", icon: "👥" },
                { label: "Projects", tab: "projects", icon: "📁" },
                { label: "Approvals", tab: "approvals", icon: "✅" },
                { label: "Messages", tab: "messages", icon: "💬" },
                { label: "Tickets", tab: "queries", icon: "🎫" },
                { label: "CRM", tab: "crm", icon: "📈" },
                { label: "Billing", tab: "invoices", icon: "🧾" },
                { label: "Accounts", tab: "accounts", icon: "💰" },
                { label: "Assets", tab: "assets", icon: "💻" },
                { label: "AI Hub", tab: "ai", icon: "🧠" },
                { label: "Calendar", tab: "calendar", icon: "📅" },
                { label: "Reports", tab: "monthly", icon: "📑" },
              ] as const).map((item) => (
                <button
                  key={item.tab}
                  onClick={() => setActiveTab(item.tab as any)}
                  className={\`flex flex-col items-center gap-1.5 shrink-0 px-4 py-2.5 rounded-2xl transition-all \${activeTab === item.tab ? "bg-white text-gray-900 font-black shadow-sm" : "bg-transparent text-gray-800 hover:bg-white/20 font-bold"}\`}
                >
                  <span className="text-base">{item.icon}</span>
                  <span className="text-[10px] font-bold tracking-wide">{item.label}</span>
                </button>
              ))}
            </div>
`;
dashContent = dashContent.replace(/\{\/\* ── CATEGORY NAV TABS ── \*\/\}([\s\S]*?)\<\/div>/, navTabsReplacement.trim());

// 7. Inject Admin Components at the bottom of the switch block
const adminComponents = \`
          {activeTab === "employees" && (
             <div className="px-2">
                <div className="bg-white rounded-2xl shadow-sm p-4 overflow-x-auto overflow-y-hidden mb-6">
                   <EmployeesView 
                      view="employees" setView={setActiveTab as any} selectedEmployee={selectedEmployee} users={users} 
                      setSelectedUser={setSelectedEmployee} deleteUser={() => alert("Please use desktop app to delete users.")} showAddUser={showAddUser} 
                      setShowAddUser={setShowAddUser} msg="" name={name} setName={setName} email={email} 
                      setEmail={setEmail} designation={designation} setDesignation={setDesignation} 
                      accountType={accountType} setAccountType={setAccountType} handleAddUser={() => alert("Please use desktop app to add users.")} 
                      creatingUser={false} formatTime={(ts: any) => ts?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || ""} 
                      formatTotal={(mins: number = 0) => \`\${Math.floor(mins / 60)}h \${mins % 60}m\`} 
                   />
                </div>
             </div>
          )}
          {activeTab === "approvals" && (
             <div className="px-2">
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-6">
                   <LeaveRequests />
                </div>
             </div>
          )}
          {activeTab === "queries" && (
             <div className="px-2 overflow-x-auto">
                {/* @ts-ignore */}
                <AdminQueriesView user={user} userData={userData} />
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

dashContent = dashContent.replace(/\{\/\* Bottom Navigation Menu \*\/\}/, adminComponents + '\\n        {/* Bottom Navigation Menu */}');

// 8. Replace Bottom Navigation
const bottomNavReplacement = \`
        {/* Admin Bottom Navigation */}
        <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-gray-200/60 pb-safe z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] max-w-lg mx-auto rounded-t-3xl">
          <div className="flex items-center justify-around px-2 py-2">
            <button onClick={() => setActiveTab("home")} className={\`flex flex-col items-center justify-center w-16 h-12 rounded-2xl transition-all \${activeTab === "home" ? "text-indigo-600 scale-110" : "text-gray-400 hover:bg-gray-50"}\`}>
              <span className="text-xl mb-0.5">🏠</span>
              <span className="text-[9px] font-bold tracking-widest uppercase">Home</span>
            </button>
            <button onClick={() => setActiveTab("employees")} className={\`flex flex-col items-center justify-center w-16 h-12 rounded-2xl transition-all \${activeTab === "employees" ? "text-indigo-600 scale-110" : "text-gray-400 hover:bg-gray-50"}\`}>
              <span className="text-xl mb-0.5">👥</span>
              <span className="text-[9px] font-bold tracking-widest uppercase">Team</span>
            </button>
            <button onClick={() => router.push("/admin")} className="flex flex-col items-center justify-center w-16 h-12 rounded-2xl text-gray-400 hover:bg-gray-50 transition-all">
              <span className="text-xl mb-0.5">💻</span>
              <span className="text-[9px] font-bold tracking-widest uppercase">Desktop</span>
            </button>
            <button onClick={() => setActiveTab("profile")} className={\`flex flex-col items-center justify-center w-16 h-12 rounded-2xl transition-all \${activeTab === "profile" ? "text-indigo-600 scale-110" : "text-gray-400 hover:bg-gray-50"}\`}>
              <span className="text-xl mb-0.5">👤</span>
              <span className="text-[9px] font-bold tracking-widest uppercase">Profile</span>
            </button>
          </div>
        </div>
\`;
dashContent = dashContent.replace(/\{\/\* Bottom Navigation Menu \*\/\}([\s\S]*?)\<\/div>\s*\<\/div>\s*\)\;/, bottomNavReplacement + '\\n      </div>\\n    </div>\\n  );');

// Remove Employee specific logic blocks that shouldn't be rendered if they overlap with active tabs
dashContent = dashContent.replace(/main className=\{\["home", "projects"[\s\S]*?\}/, 'main className={["home", "projects", "payslips", "profile", "leave", "help", "directory", "chat", "calendar", "employees", "approvals", "messages", "queries", "crm", "invoices", "accounts", "assets", "ai", "monthly"].includes(activeTab) ? "w-full pb-20" : "px-4 pt-6 max-w-lg mx-auto flex flex-col gap-6 pb-20"}');

fs.writeFileSync(adminPath, dashContent, 'utf8');
console.log("Updated MobileAdminDashboard.tsx perfectly!");
