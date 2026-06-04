const fs = require('fs');
const path = require('path');

const dashPath = path.join(__dirname, '..', 'src', 'components', 'mobile', 'MobileDashboard.tsx');
const adminPath = path.join(__dirname, '..', 'src', 'components', 'mobile', 'MobileAdminDashboard.tsx');

let dashContent = fs.readFileSync(dashPath, 'utf8');
let adminContent = fs.readFileSync(adminPath, 'utf8');

// The goal is to copy the UI structure of MobileDashboard into MobileAdminDashboard.
// However, since it's quite complex, maybe I should just manually reconstruct the renderHome function in AdminDashboard
// to match the MobileDashboard UI.

// Let's create a new Admin Home block.
const adminHomeReplacement = `
            {/* ── SEARCH BAR ── */}
            <div className="bg-[#e0e7ff] px-4 pt-3 pb-4 flex items-center gap-3 relative z-50 rounded-t-[24px]">
              <div className="flex-1 flex items-center gap-2.5 bg-white rounded-2xl px-4 py-3 shadow-[0_2px_12px_rgba(0,0,0,0.04)] relative overflow-hidden">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                  <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
                </svg>
                <div className="flex items-center overflow-hidden h-6 pointer-events-none">
                  <span className="text-[13px] text-gray-400 font-medium whitespace-nowrap">Search for &quot;</span>
                  <span className="text-[13px] text-indigo-600 font-bold whitespace-nowrap inline-block px-1">tools</span>
                  <span className="text-[13px] text-gray-400 font-medium">&quot;</span>
                </div>
              </div>
            </div>

            {/* ── CATEGORY NAV TABS ── */}
            <div className="bg-[#e0e7ff] px-3 pb-3 flex gap-2 overflow-x-auto no-scrollbar">
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

            <div className="bg-gradient-to-b from-[#f8f9fe] to-[#eff2fc] pt-2 pb-1">
              {/* ── GREETING HERO CARD & CHECK-IN/OUT ── */}
              <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="mx-4 mt-2 mb-3 text-white rounded-[24px] p-5 shadow-2xl shadow-indigo-900/20 relative overflow-hidden group"
              >
                {/* Cinematic Breathing Parallax Background */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-br from-[#0f172a] via-[#1e1b4b] to-[#4f46e5] z-0"
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                />

                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/3 translate-x-1/3 z-0 pointer-events-none mix-blend-overlay"></div>

                <div className="flex justify-between items-start mb-4 relative z-10">
                  <div>
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2, duration: 0.6 }}
                      className="inline-flex items-center gap-1.5 bg-white/10 border border-white/20 backdrop-blur-md px-2.5 py-1 rounded-full mb-1.5"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-green-400"></div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-white">Admin Hub 👋</span>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3, duration: 0.5 }}
                      className="text-[9px] font-bold text-white/70 uppercase tracking-widest mb-0.5"
                    >
                      {getGreeting()}
                    </motion.div>

                    <div className="overflow-hidden">
                      <motion.h2
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        transition={{ delay: 0.4, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                        className="text-3xl font-black tracking-tight drop-shadow-md"
                      >
                        {firstName}
                      </motion.h2>
                    </div>
                  </div>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="text-right mt-1"
                  >
                    <div className="text-xs font-black text-white/90">{new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                    <div className="text-[9px] font-semibold text-indigo-300 mt-0.5">Admin Mode</div>
                  </motion.div>
                </div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6, duration: 0.6, type: "spring" }}
                  className="bg-white/10 backdrop-blur-lg rounded-[16px] p-3 flex items-center justify-between border border-white shadow-lg relative z-10"
                >
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-indigo-200 uppercase tracking-wider">Live Team</span>
                    <span className="text-2xl font-black tracking-tight mt-0.5 tabular-nums leading-none">
                      {onlineCount}
                    </span>
                  </div>
                  <button
                    onClick={() => setActiveTab("employees")}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-950/20 active:scale-95 px-4 py-2.5 rounded-xl font-extrabold text-xs shadow-md transition-all duration-300 flex items-center gap-1.5"
                  >
                    <Users className="w-3.5 h-3.5" /> View Team
                  </button>
                </motion.div>
              </motion.div>
            </div>

            {/* ── LEAVE BALANCE INDICATOR (mapped to Approvals / Tickets) ── */}
            <div className="px-4 mb-4 mt-2">
              <div className="flex items-center gap-3">
                <div onClick={() => setActiveTab("approvals")} className="flex-1 bg-white rounded-3xl p-4 border border-gray-100 flex items-center justify-between shadow-sm cursor-pointer active:scale-95 transition-transform">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">✅</span>
                    <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Approvals</div>
                  </div>
                  <div className="text-base font-black text-gray-900">{pendingApprovals}</div>
                </div>
                <div onClick={() => setActiveTab("projects")} className="flex-1 bg-white rounded-3xl p-4 border border-gray-100 flex items-center justify-between shadow-sm cursor-pointer active:scale-95 transition-transform">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">📁</span>
                    <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Projects</div>
                  </div>
                  <div className="text-base font-black text-gray-900">{projects.length}</div>
                </div>
              </div>
            </div>
`;

// Now replace renderHome logic. We can actually just put this inside the activeTab === 'home' block directly in MobileAdminDashboard.tsx!

adminContent = adminContent.replace(/\{\/\* Welcome Banner for Home \*\/\}([\s\S]*?)\{\/\* Horizontal Action Pills \*\/\}([\s\S]*?)\<\/div>\s*\<\/div>\s*\)\}/, \`{/* Replaced with new Employee-style layout */}\n\${adminHomeReplacement}\`);

// Let's replace the header too!
const headerReplacement = \`
      {/* Global Branded Header — for all tabs except chat */}
      {activeTab !== "chat" && (
        <div className={\\\`px-4 pt-5 pb-3 flex items-center justify-between sticky top-0 z-40 \${isScrolled ? "bg-white shadow-sm border-b border-gray-200" : "bg-[#e0e7ff]"}\\\`}>
          <div className="flex items-center gap-2">
            <Image src="/logo-black.svg" alt="TGY CRM Logo" width={85} height={50} className="object-contain" priority />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setActiveTab("messages")} className="w-9 h-9 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center active:scale-90 transition-transform relative">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 2H4C2.9 2 2 2.9 2 4V16C2 17.1 2.9 18 4 18H7V22L11.6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2Z" fill="#3b82f6" fillOpacity="0.15" stroke="#3b82f6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="8" cy="11" r="1.2" fill="#3b82f6" />
                <circle cx="12" cy="11" r="1.2" fill="#3b82f6" />
                <circle cx="16" cy="11" r="1.2" fill="#3b82f6" />
              </svg>
            </button>
            <button onClick={() => setActiveTab("notifications")} className="w-9 h-9 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center active:scale-90 transition-transform relative">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
              </svg>
            </button>
            <button onClick={() => setActiveTab("profile")} className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center shadow-sm active:scale-90 transition-transform overflow-hidden">
              {userData?.profilePhoto && typeof userData.profilePhoto === "string"
                ? <img src={userData.profilePhoto} className="w-full h-full object-cover" alt="avatar" />
                : <span className="text-white font-black text-sm">{userData?.name?.charAt(0)?.toUpperCase() || "A"}</span>
              }
            </button>
          </div>
        </div>
      )}
\`;

adminContent = adminContent.replace(/\{\/\* Dynamic Header \*\/\}([\s\S]*?)\{\/\* Main Content Area \*\/\}/, headerReplacement + '\\n      {/* Main Content Area */}');

// Let's remove the old renderHome call.
adminContent = adminContent.replace(/{activeTab === "home" && renderHome\(\)}/, "");
adminContent = adminContent.replace(/const renderHome = \(\) => \(([\s\S]*?)\);\s*return \(/, "return (");

// Remove the white-theme bottom nav background to match
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
          <button onClick={handleLogout} className="flex flex-col items-center justify-center w-16 h-12 rounded-2xl text-rose-400 hover:bg-rose-50 transition-all">
            <span className="text-xl mb-0.5">🚪</span>
            <span className="text-[9px] font-bold tracking-widest uppercase">Logout</span>
          </button>
        </div>
      </div>
\`;
adminContent = adminContent.replace(/\{\/\* Admin Bottom Navigation \*\/\}([\s\S]*?)\<\/div>\s*\<\/div>\s*\)\;/m, bottomNavReplacement + '\\n      </div>\\n    </div>\\n  );');

fs.writeFileSync(adminPath, adminContent, 'utf8');
console.log("Updated MobileAdminDashboard.tsx");
