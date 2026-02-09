"use client";

import { useState } from "react";
import SalaryStructure from "./SalaryStructure";
import PayrollGenerator from "./PayrollGenerator";
import PayslipHistory from "./PayslipHistory";

type Tab =
  | "salary"
  | "payroll"
  | "history";

export default function AccountsDashboard({
  selectedUser,
}: {
  selectedUser?: any;
}) {
  const [activeTab, setActiveTab] =
    useState<Tab>("salary");

  const TabButton = ({
    id,
    label,
  }: {
    id: Tab;
    label: string;
  }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`px-6 py-3 rounded-xl font-semibold transition ${
        activeTab === id
          ? "bg-indigo-600 text-white shadow"
          : "bg-gray-100 hover:bg-gray-200"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">
          Accounts & Payroll
        </h1>
        <p className="text-gray-600">
          Manage salaries, generate payroll, and
          download payslips.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-3">
        <TabButton
          id="salary"
          label="Salary Structure"
        />
        <TabButton
          id="payroll"
          label="Payroll Generator"
        />
        <TabButton
          id="history"
          label="Payslip History"
        />
      </div>

      {/* Content */}
      <div>
        {activeTab === "salary" && (
          <SalaryStructure
            selectedUser={selectedUser}
          />
        )}

        {activeTab === "payroll" && (
          <PayrollGenerator />
        )}

        {activeTab === "history" && (
          <PayslipHistory />
        )}
      </div>
    </div>
  );
}
