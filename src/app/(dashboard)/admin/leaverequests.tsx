"use client";

import { useState, useMemo } from "react";

interface LeaveRequest {
  id: string;
  uid: string; // 🔥 IMPORTANT
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
  users: any[]; // 🔥 pass users collection
  updateLeaveStatus: (id: string, status: "Approved" | "Rejected") => void;
}

export default function LeaveRequests({
  leaveRequests,
  users,
  updateLeaveStatus,
}: LeaveRequestsProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<"All" | "Pending" | "Approved" | "Rejected">("All");

  const itemsPerPage = 5;

  // 🔎 Filter Logic
  const filteredRequests = useMemo(() => {
  const search = searchQuery.toLowerCase();

  return leaveRequests.filter((leave) => {
    const matchesSearch =
      (leave.userName?.toLowerCase() ?? "").includes(search) ||
      (leave.userEmail?.toLowerCase() ?? "").includes(search) ||
      (leave.leaveType?.toLowerCase() ?? "").includes(search) ||
      (leave.reason?.toLowerCase() ?? "").includes(search);

    const matchesStatus =
      statusFilter === "All" || leave.status === statusFilter;

    return matchesSearch && matchesStatus;
  });
}, [leaveRequests, searchQuery, statusFilter]);


  // 📄 Pagination
  const totalPages = Math.ceil(filteredRequests.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedRequests = filteredRequests.slice(
    startIndex,
    startIndex + itemsPerPage
  );

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-200 overflow-hidden">
        {filteredRequests.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">📭</div>
            <div className="text-2xl font-bold text-gray-800">
              No leave requests
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#294661] text-white">
                    <th className="px-6 py-4 text-left text-sm font-bold uppercase">
                      Employee
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold uppercase">
                      Leave Type
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold uppercase">
                      From
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold uppercase">
                      To
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold uppercase">
                      Status
                    </th>
                    <th className="px-6 py-4 text-center text-sm font-bold uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-200">
                  {paginatedRequests.map((leave, index) => {
                    // 🔥 FIND USER FROM USERS COLLECTION
                    const employee = users.find(
                      (u) => u.uid === leave.uid
                    );

                    return (
                      <tr
                        key={leave.id}
                        className={`${
                          index % 2 === 0 ? "bg-gray-50" : "bg-white"
                        } hover:bg-purple-50 transition`}
                      >
                        {/* EMPLOYEE COLUMN */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full overflow-hidden shadow-lg">
                              {employee?.profilePhoto ? (
                                <img
                                  src={employee.profilePhoto}
                                  alt={leave.userName}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full bg-purple-600 flex items-center justify-center text-white font-bold">
                                  {leave.userName?.[0]?.toUpperCase() ?? "U"}
                                </div>
                              )}
                            </div>

                            <div>
                             <div className="font-semibold text-gray-900">
  {leave.userName || employee?.name || "Unknown User"}
</div>

<div className="text-sm text-gray-500">
  {leave.userEmail || employee?.email || "No Email"}
</div>

                            </div>
                          </div>
                        </td>

                        {/* Leave Type */}
                        <td className="px-6 py-4">
                          <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-semibold">
                            {leave.leaveType}
                          </span>
                        </td>

                        {/* From */}
                        <td className="px-6 py-4 text-gray-700">
                          {leave.fromDate}
                        </td>

                        {/* To */}
                        <td className="px-6 py-4 text-gray-700">
                          {leave.toDate}
                        </td>

                        {/* Status */}
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

                        {/* Actions */}
                        <td className="px-6 py-4 text-center">
                          {leave.status === "Pending" && (
                            <div className="flex justify-center gap-2">
                              <button
                                onClick={() =>
                                  updateLeaveStatus(leave.id, "Approved")
                                }
                                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm"
                              >
                                ✓
                              </button>
                              <button
                                onClick={() =>
                                  updateLeaveStatus(leave.id, "Rejected")
                                }
                                className="px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 text-sm"
                              >
                                ✕
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="bg-gray-50 px-6 py-4 border-t flex justify-between">
                <button
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-4 py-2 bg-[#3a2367] text-white rounded-lg disabled:opacity-40"
                >
                  Previous
                </button>

                <span className="text-sm">
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 bg-[#3a2367] text-white rounded-lg disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
