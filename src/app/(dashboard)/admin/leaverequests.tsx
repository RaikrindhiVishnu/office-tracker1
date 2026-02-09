"use client";

import { useState } from "react";

interface LeaveRequest {
  id: string;
  userName: string;
  userEmail: string;
  leaveType: string;
  fromDate: string;
  toDate: string;
  reason: string;
  status: "Pending" | "Approved" | "Rejected";
}

interface LeaveRequestsProps {
  leaveRequests: LeaveRequest[];
  updateLeaveStatus: (id: string, status: "Approved" | "Rejected") => void;
}

export default function LeaveRequests({
  leaveRequests,
  updateLeaveStatus,
}: LeaveRequestsProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  return (
    <div className="space-y-2">
      <div>
        {/* <h2 className="text-3xl font-bold text-purple-600 mb-2">
          Leave Management
        </h2> */}
        {/* <p className="text-gray-600">Review and manage employee leave requests</p> */}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
        <div className="bg-amber-50 p-6 rounded-2xl border-2 border-amber-200">
          <div className="text-4xl font-bold text-amber-600">
            {leaveRequests.filter((l) => l.status === "Pending").length}
          </div>
          <div className="text-amber-700 font-semibold mt-2">Pending</div>
        </div>
        <div className="bg-emerald-50 p-6 rounded-2xl border-2 border-emerald-200">
          <div className="text-4xl font-bold text-emerald-600">
            {leaveRequests.filter((l) => l.status === "Approved").length}
          </div>
          <div className="text-emerald-700 font-semibold mt-2">Approved</div>
        </div>
        <div className="bg-rose-50 p-6 rounded-2xl border-2 border-rose-200">
          <div className="text-4xl font-bold text-rose-600">
            {leaveRequests.filter((l) => l.status === "Rejected").length}
          </div>
          <div className="text-rose-700 font-semibold mt-2">Rejected</div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-200 overflow-hidden">
        {leaveRequests.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">📭</div>
            <div className="text-2xl font-bold text-gray-800 mb-2">
              No leave requests
            </div>
            <div className="text-gray-500">All caught up!</div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#294661] text-white">
                    <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider">
                      Employee
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider">
                      Leave Type
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider">
                      From Date
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider">
                      To Date
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider">
                      Reason
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-center text-sm font-bold uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {leaveRequests
                    .slice(
                      (currentPage - 1) * itemsPerPage,
                      currentPage * itemsPerPage
                    )
                    .map((leave, index) => (
                      <tr
                        key={leave.id}
                        className={`${
                          index % 2 === 0 ? "bg-gray-50" : "bg-white"
                        } hover:bg-purple-50 transition-colors`}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold shadow-lg">
                              {leave.userName[0]?.toUpperCase()}
                            </div>
                            <div>
                              <div className="font-semibold text-gray-900">
                                {leave.userName}
                              </div>
                              <div className="text-sm text-gray-500">
                                {leave.userEmail}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-semibold">
                            {leave.leaveType}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-700">
                          {new Date(leave.fromDate).toLocaleDateString(
                            "en-IN",
                            {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            }
                          )}
                        </td>
                        <td className="px-6 py-4 text-gray-700">
                          {new Date(leave.toDate).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td className="px-6 py-4">
                          <div
                            className="max-w-xs text-gray-700 text-sm truncate"
                            title={leave.reason}
                          >
                            {leave.reason}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-3 py-1 rounded-full text-sm font-semibold ${
                              leave.status === "Pending"
                                ? "bg-amber-100 text-amber-700"
                                : leave.status === "Approved"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-rose-100 text-rose-700"
                            }`}
                          >
                            {leave.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {leave.status === "Pending" && (
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() =>
                                  updateLeaveStatus(leave.id, "Approved")
                                }
                                className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-all shadow-md hover:shadow-lg text-sm"
                                title="Approve"
                              >
                                ✓
                              </button>
                              <button
                                onClick={() =>
                                  updateLeaveStatus(leave.id, "Rejected")
                                }
                                className="px-4 py-2 bg-rose-600 text-white rounded-lg font-semibold hover:bg-rose-700 transition-all shadow-md hover:shadow-lg text-sm"
                                title="Reject"
                              >
                                ✕
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {leaveRequests.length > itemsPerPage && (
              <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Showing{" "}
                  <span className="font-semibold">
                    {(currentPage - 1) * itemsPerPage + 1}
                  </span>{" "}
                  to{" "}
                  <span className="font-semibold">
                    {Math.min(currentPage * itemsPerPage, leaveRequests.length)}
                  </span>{" "}
                  of{" "}
                  <span className="font-semibold">{leaveRequests.length}</span>{" "}
                  requests
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      setCurrentPage((prev) => Math.max(1, prev - 1))
                    }
                    disabled={currentPage === 1}
                    className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                      currentPage === 1
                        ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                        : "bg-[#3a2367] text-white hover:bg-purple-700 shadow-md hover:shadow-lg"
                    }`}
                  >
                    Previous
                  </button>
                  <div className="flex items-center gap-2">
                    {Array.from(
                      {
                        length: Math.ceil(leaveRequests.length / itemsPerPage),
                      },
                      (_, i) => i + 1
                    ).map((page) => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`w-10 h-10 rounded-lg font-semibold transition-all ${
                          currentPage === page
                            ? "bg-[#e29860] text-white shadow-lg"
                            : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-300"
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() =>
                      setCurrentPage((prev) =>
                        Math.min(
                          Math.ceil(leaveRequests.length / itemsPerPage),
                          prev + 1
                        )
                      )
                    }
                    disabled={
                      currentPage ===
                      Math.ceil(leaveRequests.length / itemsPerPage)
                    }
                    className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                      currentPage ===
                      Math.ceil(leaveRequests.length / itemsPerPage)
                        ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                        : "bg-[#3a2367] text-white hover:bg-purple-700 shadow-md hover:shadow-lg"
                    }`}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}