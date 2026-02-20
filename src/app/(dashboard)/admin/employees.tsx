import React, { useState, useMemo } from 'react';
import { View } from "@/types/View";
import type { EmployeeRow } from "@/types/EmployeeRow";

interface EmployeesViewProps {
  view: string;
  setView: React.Dispatch<React.SetStateAction<View>>;
  selectedEmployee: EmployeeRow | null;
  users: EmployeeRow[];   // 🔥 IMPORTANT
  setSelectedUser: React.Dispatch<React.SetStateAction<EmployeeRow | null>>;
  deleteUser: (uid: string) => void;
  showAddUser: boolean;
  setShowAddUser: (show: boolean) => void;
  msg: string;
  name: string;
  setName: (name: string) => void;
  email: string;
  setEmail: (email: string) => void;
  designation: string;
  setDesignation: (designation: string) => void;
  accountType: "EMPLOYEE" | "ADMIN";
  setAccountType: React.Dispatch<
  React.SetStateAction<"EMPLOYEE" | "ADMIN">
>;
  handleAddUser: () => void;
  creatingUser: boolean;
  formatTime: (timestamp: any) => string;
  formatTotal: (minutes?: number) => string;
}


const EmployeesView: React.FC<EmployeesViewProps> = ({
  view,
  setView,
  selectedEmployee,
  users,
  setSelectedUser,
  deleteUser,
  showAddUser,
  setShowAddUser,
  msg,
  name,
  setName,
  email,
  setEmail,
  designation,
  setDesignation,
  accountType,
  setAccountType,
  handleAddUser,
  creatingUser,
  formatTime,
  formatTotal,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"ALL" | "EMPLOYEE" | "ADMIN">("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const filteredUsers = useMemo(() => {
    const search = searchQuery.toLowerCase();
    return users.filter((u) => {
      const uName = u.name ?? "";
      const uEmail = u.email ?? "";
      const uDesignation = u.designation ?? "";

      const matchesSearch =
        uName.toLowerCase().includes(search) ||
        uEmail.toLowerCase().includes(search) ||
        uDesignation.toLowerCase().includes(search);

      const matchesFilter =
        filterType === "ALL" || u.accountType === filterType;

      return matchesSearch && matchesFilter;
    });
  }, [users, searchQuery, filterType]);

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

  const handleFilterChange = (type: "ALL" | "EMPLOYEE" | "ADMIN") => {
    setFilterType(type);
    setCurrentPage(1);
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
  };

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      }
    }
    return pages;
  };

  const employeeCount = users.filter(u => u.accountType === "EMPLOYEE").length;
  const adminCount = users.filter(u => u.accountType === "ADMIN").length;

  return (
    <>
      {/* ===================== EMPLOYEE PROFILE ===================== */}
      {view === "profile" && selectedEmployee && (
        <div className="max-w-5xl mx-auto">
          <button
            onClick={() => setView("dashboard")}
            className="flex items-center gap-2 text-[#4f5665] hover:text-[#225c15] font-semibold mb-6 transition-colors group"
          >
            <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </button>

          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="h-32 bg-[#193677]"></div>

            <div className="px-6 lg:px-8 pb-8">
              <div className="flex flex-col sm:flex-row items-start gap-6 -mt-16 mb-6">
                <div className="w-32 h-32 rounded-2xl overflow-hidden shadow-2xl border-4 border-white">
                  {selectedEmployee.profilePhoto ? (
                    <img src={selectedEmployee.profilePhoto} alt="Employee" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-[#193677] flex items-center justify-center text-white text-4xl font-bold">
                      {selectedEmployee.name[0]?.toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="flex-1 pt-16 sm:pt-20">
                  <h2 className="text-3xl font-bold text-slate-900 mb-2">{selectedEmployee.name}</h2>
                  <p className="text-slate-500 mb-4">{selectedEmployee.email}</p>
                  <div className="flex flex-wrap gap-3">
                    <span className={`px-4 py-2 rounded-xl text-sm font-bold shadow-sm ${
                      selectedEmployee.status === "ONLINE" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"
                    }`}>
                      {selectedEmployee.status}
                    </span>
                    <span className="px-4 py-2 rounded-xl text-sm font-bold bg-indigo-100 text-indigo-700 shadow-sm">
                      Total: {formatTotal(selectedEmployee.totalMinutes ?? 0)}
                    </span>
                  </div>
                </div>
              </div>

              <h3 className="text-xl font-bold text-slate-900 mb-4">Session Details</h3>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full">
                  <thead className="bg-gradient-to-r from-slate-50 to-slate-100">
                    <tr>
                      <th className="px-4 lg:px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase">Session</th>
                      <th className="px-4 lg:px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase">Check In</th>
                      <th className="px-4 lg:px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase">Check Out</th>
                      <th className="px-4 lg:px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(selectedEmployee.sessions ?? []).map((s, i) => {
                      const start = s.checkIn.toDate().getTime();
                      const end = s.checkOut ? s.checkOut.toDate().getTime() : Date.now();
                      const mins = Math.floor((end - start) / 60000);
                      return (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="px-4 lg:px-6 py-4 font-semibold text-slate-900">Session #{i + 1}</td>
                          <td className="px-4 lg:px-6 py-4 text-slate-700">{formatTime(s.checkIn)}</td>
                          <td className="px-4 lg:px-6 py-4">
                            {s.checkOut ? (
                              <span className="text-slate-700">{formatTime(s.checkOut)}</span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-semibold">
                                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                                In progress
                              </span>
                            )}
                          </td>
                          <td className="px-4 lg:px-6 py-4 font-bold text-indigo-600">{formatTotal(mins)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================== EMPLOYEES LIST ===================== */}
      {view === "employees" && (
        <>
          {/* Search + Filters + Add Button */}
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-4 lg:p-6 mb-6">
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-4">
              {/* Search */}
              <div className="relative w-full lg:w-80">
                <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search employees..."
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border-2 border-slate-200 rounded-xl focus:border-indigo-500 focus:outline-none transition-colors"
                />
              </div>

              {/* Filters */}
              <div className="flex gap-2 flex-1 lg:flex-initial">
                <button onClick={() => handleFilterChange("ALL")} className={`px-4 py-3 rounded-xl font-medium transition-all whitespace-nowrap ${filterType === "ALL" ? "bg-indigo-600 text-white shadow-lg" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
                  All ({users.length})
                </button>
                <button onClick={() => handleFilterChange("EMPLOYEE")} className={`px-4 py-3 rounded-xl font-medium transition-all whitespace-nowrap ${filterType === "EMPLOYEE" ? "bg-blue-600 text-white shadow-lg" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
                  Employees ({employeeCount})
                </button>
                <button onClick={() => handleFilterChange("ADMIN")} className={`px-4 py-3 rounded-xl font-medium transition-all whitespace-nowrap ${filterType === "ADMIN" ? "bg-purple-600 text-white shadow-lg" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
                  Admins ({adminCount})
                </button>
              </div>

              {/* Add Employee Button */}
              <button
                onClick={() => setShowAddUser(true)}
                className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-sm transition flex items-center justify-center gap-2 whitespace-nowrap lg:ml-auto"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Employee
              </button>
            </div>
          </div>

          {/* Mobile Cards */}
          <div className="grid grid-cols-1 gap-4 lg:hidden mb-6">
            {paginatedUsers.length > 0 ? (
              paginatedUsers.map((u) => (
                <div key={u.uid} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-14 h-14 rounded-xl overflow-hidden shadow-md">
                      {u.profilePhoto ? (
                        <img src={u.profilePhoto} alt={u.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-[#4f46e5] flex items-center justify-center text-white text-xl font-bold">
                          {(u.name || u.email || "U")[0]?.toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-lg text-slate-900 truncate">{u.name}</h3>
                      <p className="text-sm text-slate-600 truncate">{u.email}</p>
                      <p className="text-sm text-slate-700 mt-1">{u.designation} · {u.accountType}</p>
                    </div>
                  </div>
                  {u.salary !== undefined && (
                    <div className="mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <p className="text-xs text-slate-500 font-medium mb-1">Monthly Salary</p>
                      <p className="text-lg font-bold text-slate-900">₹{u.salary.toLocaleString()}</p>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button onClick={() => { setSelectedUser(u); setView("employeeDetails"); }} className="flex-1 px-4 py-2.5 bg-[#4f46e5] hover:bg-[#4338ca] text-white rounded-xl font-semibold transition shadow-sm">
                      View Details
                    </button>
                    <button onClick={() => deleteUser(u.uid)} className="flex-1 px-4 py-2.5 bg-[#e11d48] hover:bg-[#be123c] text-white rounded-xl font-semibold transition shadow-sm">
                      Delete
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
                <p className="text-slate-500">No employees found</p>
              </div>
            )}
          </div>

          {/* Desktop Table */}
          <div className="hidden lg:block bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase">Employee</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase">Email</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase">Designation</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase">Account Type</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase">Salary</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedUsers.length > 0 ? (
                    paginatedUsers.map((u) => (
                      <tr key={u.uid} className="hover:bg-slate-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg overflow-hidden shadow-sm">
                              {u.profilePhoto ? (
                                <img src={u.profilePhoto} alt={u.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full bg-[#575797] flex items-center justify-center text-white font-bold">
                                  {u.name?.charAt(0)?.toUpperCase() || u.email?.charAt(0)?.toUpperCase() || "U"}
                                </div>
                              )}
                            </div>
                            <span className="font-semibold text-slate-900">{u.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-700">{u.email}</td>
                        <td className="px-6 py-4 text-slate-700">{u.designation}</td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${u.accountType === "ADMIN" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                            {u.accountType}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-semibold text-slate-900">
                          {u.salary !== undefined ? `₹${u.salary.toLocaleString()}` : "—"}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-3 items-center">
                            <button title="View Employee" onClick={() => { setSelectedUser(u); setView("employeeDetails"); }} className="p-2 bg-indigo-500 hover:bg-indigo-700 rounded-lg transition shadow-sm">
                              <img src="https://cdn-icons-png.flaticon.com/128/159/159604.png" alt="view" className="w-5 h-5 object-contain" />
                            </button>
                            <button title="Delete Employee" onClick={() => deleteUser(u.uid)} className="p-2 bg-amber-600 hover:bg-red-600 rounded-lg transition shadow-sm">
                              <img src="https://cdn-icons-png.flaticon.com/128/484/484662.png" alt="delete" className="w-5 h-5 object-contain" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-500">No employees found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="border-t border-slate-200 bg-slate-50 px-6 py-4">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-sm text-slate-600">
                    Showing {startIndex + 1} - {Math.min(endIndex, filteredUsers.length)} of {filteredUsers.length} employees
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1} className={`px-3 py-2 rounded-lg font-medium transition-all ${currentPage === 1 ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-white border-2 border-slate-300 text-slate-700 hover:bg-slate-100"}`}>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <div className="flex items-center gap-1">
                      {getPageNumbers().map((page, index) => (
                        <button key={index} onClick={() => typeof page === 'number' && goToPage(page)} disabled={page === '...'} className={`min-w-[40px] px-3 py-2 rounded-lg font-medium transition-all ${page === currentPage ? "bg-indigo-600 text-white shadow-md" : page === '...' ? "bg-transparent text-slate-400 cursor-default" : "bg-white border-2 border-slate-300 text-slate-700 hover:bg-slate-100"}`}>
                          {page}
                        </button>
                      ))}
                    </div>
                    <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages} className={`px-3 py-2 rounded-lg font-medium transition-all ${currentPage === totalPages ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-white border-2 border-slate-300 text-slate-700 hover:bg-slate-100"}`}>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </button>
                  </div>
                  <div className="text-sm text-slate-600">Page {currentPage} of {totalPages}</div>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ===================== ADD USER MODAL ===================== */}
      {showAddUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div onClick={() => setShowAddUser(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

          <div className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-2xl p-7 animate-[popup_.18s_ease]">
            {/* Header */}
            <div className="flex justify-between items-center mb-5">
              <div>
                <h2 className="text-xl font-bold text-gray-800">Add Employee</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  Login credentials will be emailed automatically
                </p>
              </div>
              <button onClick={() => setShowAddUser(false)} className="text-gray-400 hover:text-gray-700 text-lg font-bold">✕</button>
            </div>

            {/* Message */}
            {msg && (
              <p className={`mb-4 text-sm font-medium p-3 rounded-lg ${
                msg.startsWith("✅")
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : msg.startsWith("❌")
                  ? "bg-red-50 text-red-700 border border-red-200"
                  : "bg-blue-50 text-blue-700 border border-blue-200"
              }`}>
                {msg}
              </p>
            )}

            <div className="space-y-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-400 outline-none"
              />

              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                type="email"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-400 outline-none"
              />

              {/* ✅ PASSWORD FIELD REMOVED — auto-generated */}

              <select
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5"
              >
                <option>Developer</option>
                <option>Tester</option>
                <option>UI/UX Designer</option>
                <option>DevOps Engineer</option>
                <option>HR</option>
                <option>Manager</option>
                <option>Intern</option>
                <option>Support</option>
                <option>Data Analyst</option>
              </select>

              <select
  value={accountType}
  onChange={(e) =>
    setAccountType(e.target.value as "EMPLOYEE" | "ADMIN")
  }
>
                <option value="EMPLOYEE">Employee</option>
                <option value="ADMIN">Admin</option>
              </select>

              {/* Info Box */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-700">
                  🔐 A secure temporary password will be auto-generated and sent to the employee's email. They will be required to change it on first login.
                </p>
              </div>
            </div>

            <button
              onClick={handleAddUser}
              disabled={creatingUser}
              className="mt-5 w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-lg font-semibold disabled:opacity-60 transition"
            >
              {creatingUser ? "Creating & Sending Email..." : "Create Employee"}
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default EmployeesView;