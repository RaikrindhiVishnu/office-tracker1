import React from 'react';
import { View } from "@/types/View";
import type { Employee } from "@/types/Employee";

// interface Session {
//   checkIn: any;
//   checkOut: any | null;
// }

// interface Employee {
//   uid: string;
//   name: string;
//   email: string;
//   status: string;
//   totalMinutes: number;
//   sessions: Session[];
// }

interface User {
  uid: string;
  name: string;
  email: string;
  designation: string;
  accountType: string;
  salary?: number;
}

interface EmployeesViewProps {
  view: string;
  setView: React.Dispatch<React.SetStateAction<View>>;
  selectedEmployee: Employee | null;
  users: Employee[];
  setSelectedUser: React.Dispatch<
  React.SetStateAction<Employee | null>
>;

  deleteUser: (uid: string) => void;
  showAddUser: boolean;
  setShowAddUser: (show: boolean) => void;
  msg: string;
  name: string;
  setName: (name: string) => void;
  email: string;
  setEmail: (email: string) => void;
  password: string;
  setPassword: (password: string) => void;
  designation: string;
  setDesignation: (designation: string) => void;
  accountType: string;
  setAccountType: (accountType: string) => void;
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
  password,
  setPassword,
  designation,
  setDesignation,
  accountType,
  setAccountType,
  handleAddUser,
  creatingUser,
  formatTime,
  formatTotal,
}) => {
  return (
    <>
      {/* EMPLOYEE PROFILE */}
      {view === "profile" && selectedEmployee && (
        <div className="max-w-5xl mx-auto">
          <button
            onClick={() => setView("dashboard")}
            className="flex items-center gap-2 text-[#4f5665] hover:text-[#225c15] font-semibold mb-6 transition-colors group"
          >
            <svg
              className="w-5 h-5 group-hover:-translate-x-1 transition-transform"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Dashboard
          </button>

          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            {/* Header with gradient */}
            <div className="h-32 bg-[#193677]"></div>

            <div className="px-6 lg:px-8 pb-8">
              <div className="flex flex-col sm:flex-row items-start gap-6 -mt-16 mb-6">
                <div className="w-32 h-32 rounded-2xl bg-[#193677] flex items-center justify-center text-white text-4xl font-bold shadow-2xl border-4 border-white">
                  {selectedEmployee.name[0]?.toUpperCase()}
                </div>

                <div className="flex-1 pt-16 sm:pt-20">
                  <h2 className="text-3xl font-bold text-slate-900 mb-2">
                    {selectedEmployee.name}
                  </h2>
                  <p className="text-slate-500 mb-4">{selectedEmployee.email}</p>

                  <div className="flex flex-wrap gap-3">
                    <span
                      className={`px-4 py-2 rounded-xl text-sm font-bold shadow-sm ${
                        selectedEmployee.status === "ONLINE"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
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
                      <th className="px-4 lg:px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase">
                        Session
                      </th>
                      <th className="px-4 lg:px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase">
                        Check In
                      </th>
                      <th className="px-4 lg:px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase">
                        Check Out
                      </th>
                      <th className="px-4 lg:px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase">
                        Duration
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(selectedEmployee.sessions ?? []).map((s, i) => {
                      const start = s.checkIn.toDate().getTime();
                      const end = s.checkOut ? s.checkOut.toDate().getTime() : Date.now();
                      const mins = Math.floor((end - start) / 60000);

                      return (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="px-4 lg:px-6 py-4 font-semibold text-slate-900">
                            Session #{i + 1}
                          </td>
                          <td className="px-4 lg:px-6 py-4 text-slate-700">
                            {formatTime(s.checkIn)}
                          </td>
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
                          <td className="px-4 lg:px-6 py-4 font-bold text-indigo-600">
                            {formatTotal(mins)}
                          </td>
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

      {/* EMPLOYEES VIEW */}
      {view === "employees" && (
        <>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-slate-900">Employees</h2>

            <button
              onClick={() => setShowAddUser(true)}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-sm transition"
            >
              + Add Employee
            </button>
          </div>

          {/* Mobile Card View */}
          <div className="grid grid-cols-1 gap-4 lg:hidden">
            {users.map((u) => (
              <div
                key={u.uid}
                className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5"
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-14 h-14 rounded-xl bg-[#4f46e5] flex items-center justify-center text-white text-xl font-bold">
                    {u.name[0]?.toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-lg text-slate-900 truncate">{u.name}</h3>
                    <p className="text-sm text-slate-600 truncate">{u.email}</p>
                    <p className="text-sm text-slate-700 mt-1">
                      {u.designation} · {u.accountType}
                    </p>
                  </div>
                </div>

                {u.salary && (
                  <div className="mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="text-xs text-slate-500 font-medium mb-1">Monthly Salary</p>
                    <p className="text-lg font-bold text-slate-900">
                      ₹{u.salary.toLocaleString()}
                    </p>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setSelectedUser(u);
                      setView("employeeDetails");
                    }}
                    className="flex-1 px-4 py-2.5 bg-[#4f46e5] hover:bg-[#4338ca] text-white rounded-xl font-semibold transition shadow-sm"
                  >
                    View Details
                  </button>

                  <button
                    onClick={() => deleteUser(u.uid)}
                    className="flex-1 px-4 py-2.5 bg-[#e11d48] hover:bg-[#be123c] text-white rounded-xl font-semibold transition shadow-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden lg:block bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase">
                      Employee
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase">
                      Email
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase">
                      Designation
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase">
                      Account Type
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase">
                      Salary
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {users.map((u) => (
                    <tr key={u.uid} className="hover:bg-slate-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-[#575797] flex items-center justify-center text-white font-bold">
                            {u.name[0]?.toUpperCase()}
                          </div>
                          <span className="font-semibold text-slate-900">{u.name}</span>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-slate-700">{u.email}</td>
                      <td className="px-6 py-4 text-slate-700">{u.designation}</td>
                      <td className="px-6 py-4 text-slate-700">{u.accountType}</td>
                      <td className="px-6 py-4 font-semibold text-slate-900">
                        {u.salary ? `₹${u.salary.toLocaleString()}` : "—"}
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex gap-3 items-center">
                          {/* View Button */}
                          <button
                            title="View Employee"
                            onClick={() => {
                              setSelectedUser(u);
                              setView("employeeDetails");
                            }}
                            className="p-2 bg-indigo-500 hover:bg-indigo-700 rounded-lg transition shadow-sm"
                          >
                            <img
                              src="https://cdn-icons-png.flaticon.com/128/159/159604.png"
                              alt="view"
                              className="w-5 h-5 object-contain"
                            />
                          </button>

                          {/* Delete Button */}
                          <button
                            title="Delete Employee"
                            onClick={() => deleteUser(u.uid)}
                            className="p-2 bg-amber-600 hover:bg-red-600 rounded-lg transition shadow-sm"
                          >
                            <img
                              src="https://cdn-icons-png.flaticon.com/128/484/484662.png"
                              alt="delete"
                              className="w-5 h-5 object-contain"
                            />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ADD USER MODAL */}
      {showAddUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Dark Overlay */}
          <div
            onClick={() => setShowAddUser(false)}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />

          {/* Popup Card */}
          <div className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-2xl p-7 animate-[popup_.18s_ease]">
            {/* Header */}
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xl font-bold text-gray-800">Add User</h2>

              <button
                onClick={() => setShowAddUser(false)}
                className="text-gray-400 hover:text-gray-700 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {msg && <p className="mb-3 text-sm font-medium">{msg}</p>}

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

              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Temporary password"
                type="password"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-400 outline-none"
              />

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
                onChange={(e) => setAccountType(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5"
              >
                <option value="EMPLOYEE">Employee</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>

            <button
              onClick={handleAddUser}
              disabled={creatingUser}
              className="mt-5 w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-lg font-semibold disabled:opacity-60"
            >
              {creatingUser ? "Creating..." : "Add User"}
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default EmployeesView;