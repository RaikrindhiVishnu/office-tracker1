"use client";

import React, { useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, getDocs, where, Timestamp } from "firebase/firestore";
import ReportPreview from "./ReportPreview";

export default function ReportBuilder() {
  const [date, setDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [department, setDepartment] = useState<string>("All");
  
  const [includeAttendance, setIncludeAttendance] = useState(true);
  const [includeWorkUpdates, setIncludeWorkUpdates] = useState(true);
  const [includeProjectProgress, setIncludeProjectProgress] = useState(true);
  const [includeLeaveDetails, setIncludeLeaveDetails] = useState(true);
  const [includeAI, setIncludeAI] = useState(true);
  const [includeNeedsAttention, setIncludeNeedsAttention] = useState(true);

  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);

  const departments = ["All", "Development", "Sales", "HR", "Marketing", "Design", "Management"];

  const handleGeneratePreview = async () => {
    setLoading(true);
    try {
      // 1. Fetch Users
      const usersSnap = await getDocs(collection(db, "users"));
      const usersData = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // 2. Fetch Attendance for the selected date
      const attSnap = await getDocs(query(
        collection(db, "attendance"),
        where("date", "==", date)
      ));
      
      const attData = attSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // 3. Fetch Work Updates
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const wuSnap = await getDocs(query(
        collection(db, "workUpdates"),
        where("createdAt", ">=", Timestamp.fromDate(startOfDay)),
        where("createdAt", "<=", Timestamp.fromDate(endOfDay))
      ));
      const wuData = wuSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // 4. Fetch Daily Sheets
      const dsSnap = await getDocs(query(
        collection(db, "dailySheets"),
        where("dateStr", "==", date)
      ));
      const dsData = dsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // 5. Fetch Leaves (Active on this date)
      const leavesSnap = await getDocs(query(
        collection(db, "leaveRequests"),
        where("status", "==", "Approved")
      ));
      const leavesData = leavesSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter((l: any) => {
        const from = new Date(l.fromDate).getTime();
        const to = new Date(l.toDate).getTime();
        const target = new Date(date).getTime();
        return target >= from && target <= to;
      });

      // Filter by department
      let filteredUsers = usersData;
      if (department !== "All") {
        filteredUsers = usersData.filter((u: any) => u.department === department);
      }

      setPreviewData({
        date,
        department,
        users: filteredUsers,
        attendance: attData,
        workUpdates: wuData,
        dailySheets: dsData,
        leaves: leavesData,
        config: {
          includeAttendance,
          includeWorkUpdates,
          includeProjectProgress,
          includeLeaveDetails,
          includeAI,
          includeNeedsAttention
        }
      });

    } catch (error) {
      console.error("Error generating report data", error);
      alert("Failed to gather report data");
    } finally {
      setLoading(false);
    }
  };

  if (previewData) {
    return <ReportPreview data={previewData} onBack={() => setPreviewData(null)} />;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Generate HR Daily Report</h2>
        <p className="text-sm text-gray-500 mt-1">Configure and generate a comprehensive PDF report for management.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Report Date</label>
            <input 
              type="date" 
              value={date} 
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Department Filter</label>
            <select 
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none"
            >
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-3">Include Sections</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <label className="flex items-center gap-3 p-3 border border-gray-100 rounded-xl cursor-pointer hover:bg-gray-50">
              <input type="checkbox" checked={includeAttendance} onChange={(e) => setIncludeAttendance(e.target.checked)} className="w-4 h-4 text-teal-600 rounded" />
              <span className="text-sm font-medium text-gray-700">Attendance Details</span>
            </label>
            <label className="flex items-center gap-3 p-3 border border-gray-100 rounded-xl cursor-pointer hover:bg-gray-50">
              <input type="checkbox" checked={includeWorkUpdates} onChange={(e) => setIncludeWorkUpdates(e.target.checked)} className="w-4 h-4 text-teal-600 rounded" />
              <span className="text-sm font-medium text-gray-700">Work Updates</span>
            </label>
            <label className="flex items-center gap-3 p-3 border border-gray-100 rounded-xl cursor-pointer hover:bg-gray-50">
              <input type="checkbox" checked={includeProjectProgress} onChange={(e) => setIncludeProjectProgress(e.target.checked)} className="w-4 h-4 text-teal-600 rounded" />
              <span className="text-sm font-medium text-gray-700">Project Progress</span>
            </label>
            <label className="flex items-center gap-3 p-3 border border-gray-100 rounded-xl cursor-pointer hover:bg-gray-50">
              <input type="checkbox" checked={includeNeedsAttention} onChange={(e) => setIncludeNeedsAttention(e.target.checked)} className="w-4 h-4 text-teal-600 rounded" />
              <span className="text-sm font-medium text-gray-700">Needs Attention</span>
            </label>
            <label className="flex items-center gap-3 p-3 border border-gray-100 rounded-xl cursor-pointer hover:bg-gray-50">
              <input type="checkbox" checked={includeLeaveDetails} onChange={(e) => setIncludeLeaveDetails(e.target.checked)} className="w-4 h-4 text-teal-600 rounded" />
              <span className="text-sm font-medium text-gray-700">Leave Details</span>
            </label>
            <label className="flex items-center gap-3 p-3 border border-gray-100 rounded-xl cursor-pointer hover:bg-gray-50">
              <input type="checkbox" checked={includeAI} onChange={(e) => setIncludeAI(e.target.checked)} className="w-4 h-4 text-teal-600 rounded" />
              <span className="text-sm font-medium text-gray-700">AI Summary</span>
            </label>
          </div>
        </div>

        <div className="pt-4 border-t border-gray-100 flex justify-end">
          <button 
            onClick={handleGeneratePreview}
            disabled={loading}
            className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {loading ? "Gathering Data..." : "Preview Report"}
            {!loading && <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>}
          </button>
        </div>
      </div>
    </div>
  );
}
