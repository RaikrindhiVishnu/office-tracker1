"use client";

import { useState } from "react";
import PayrollGenerator from "./PayrollGenerator";
import SalaryStructure from "./SalaryStructure";

interface User {
  uid?: string;
  name?: string;
  email?: string;
}

interface AccountsDashboardProps {
  selectedUser?: User | null;
}

type Tab = "payroll" | "accounts";

export default function AccountsDashboard({
  selectedUser,
}: AccountsDashboardProps) {
  const [activeTab, setActiveTab] = useState<Tab>("payroll");

  return (
    <div className="space-y-6">

      {/* Header */}
      

      {/* Tabs */}
      <div className="flex gap-2">
          <button
          onClick={() => setActiveTab("accounts")}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
            activeTab === "accounts"
              ? "bg-indigo-600 text-white"
              : "bg-white border border-gray-200 hover:bg-gray-50"
          }`}
        >
          Accounts
        </button>
        <button
          onClick={() => setActiveTab("payroll")}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
            activeTab === "payroll"
              ? "bg-indigo-600 text-white"
              : "bg-white border border-gray-200 hover:bg-gray-50"
          }`}
        >
          Payroll
        </button>

      
      </div>

      {/* Content */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4">

        {activeTab === "payroll" && (
          <PayrollGenerator />
        )}

        {activeTab === "accounts" && (
          <SalaryStructure />
        )}

      </div>
    </div>
  );
}