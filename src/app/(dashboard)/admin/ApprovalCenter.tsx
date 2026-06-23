"use client";
import React, { useState } from "react";
import AdminExpenseView from "./AdminExpenseView";
import AdminRegularizationRequestsView from "./AdminRegularizationRequestsView";
import LeaveRequests from "./leaverequests";
import AdminDailySheetsView from "./AdminDailySheetsView";

export default function ApprovalCenter() {
  const [activeTab, setActiveTab] = useState<"leave" | "regularization" | "expenses" | "timesheets">("leave");

  const tabs = [
    { id: "leave", label: "Leave Requests", icon: "🌴" },
    { id: "regularization", label: "Regularization", icon: "⏱️" },
    { id: "timesheets", label: "Timesheets", icon: "📅" },
    { id: "expenses", label: "Expense Claims", icon: "💰" }
  ];

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <h1 className="text-2xl font-bold text-slate-800">Approval Center</h1>
        <p className="text-sm text-slate-500 mt-1">Unified dashboard for all employee requests and approvals.</p>
        
        <div className="flex gap-2 mt-6 overflow-x-auto pb-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm transition whitespace-nowrap border ${
                activeTab === tab.id 
                  ? "bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm" 
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative">
        <div className="absolute inset-0 overflow-y-auto">
          {activeTab === "leave" && <div className="p-6 h-full"><LeaveRequests /></div>}
          {activeTab === "regularization" && <div className="p-6 h-full"><AdminRegularizationRequestsView /></div>}
          {activeTab === "timesheets" && <div className="h-full bg-white"><AdminDailySheetsView /></div>}
          {activeTab === "expenses" && <div className="p-6 h-full"><AdminExpenseView /></div>}
        </div>
      </div>
    </div>
  );
}
