"use client";

import React, { useMemo, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Avatar } from "@/app/(dashboard)/employee/views/DashboardView";

interface Employee {
  id: string;
  uid?: string;
  name?: string;
  displayName?: string;
  email?: string;
  profilePhoto?: string;
  designation?: string;
  department?: string;
}

interface OrgChartProps {
  employees: Employee[];
  onClose: () => void;
}

const T = {
  primary: "#2563eb",
  bg: "#f8fafc",
  card: "#ffffff",
  text: "#0f172a",
  text2: "#475569",
  border: "#e2e8f0",
};

export default function OrgChart({ employees, onClose }: OrgChartProps) {
  // Group employees by department/team
  const teams = useMemo(() => {
    const groups: Record<string, Employee[]> = {
      "CEO and COO": [],
      "Leads": [],
      "App & Mobile Team": [],
      "Frontend Team": [],
      "Backend Team": [],
      "UI/UX Design": [],
      "QA & Testing": [],
      "Business Analysts": [],
      "AI Developers": [],
      "HR & Operations": [],
      "9DS": [],
    };

    // Ensure Katnam Phani Krishna is added as CEO if not present in the list
    const hasCeo = employees.some((e) => {
      const name = (e.name || e.displayName || "").toLowerCase();
      return name.includes("phani krishna") || name.includes("katnam phani krishna");
    });

    if (!hasCeo) {
      groups["CEO and COO"].push({
        id: "ceo_phani_krishna",
        name: "Katnam Phani Krishna",
        designation: "CEO",
        department: "Executive",
        profilePhoto: "",
      });
    }

    employees.forEach((emp) => {
      const dept = (emp.department || "").toLowerCase();
      const desig = (emp.designation || "").toLowerCase();
      const name = (emp.name || emp.displayName || "").toLowerCase();

      // Put Nani Naidu / Creative Director / 3D Artist in 9DS
      if (dept.includes("9ds") || desig.includes("creative director") || desig.includes("3d artist") || name.includes("naninaidu") || desig.includes("9ds")) {
        groups["9DS"].push(emp);
      } 
      // Put Phanikumar and C-levels in Executive
      else if (name.includes("phanikumar") || name.includes("phani krishna") || name.includes("katnam phani krishna") || desig.includes("ceo") || desig.includes("founder") || desig.includes("chief") || desig.includes("director")) {
        if (name.includes("phani krishna") || name.includes("katnam phani krishna")) {
          groups["CEO and COO"].push({
            ...emp,
            designation: "CEO"
          });
        } else {
          groups["CEO and COO"].push(emp);
        }
      } 
      // Move Villa Satish to App & Mobile Team
      else if (name.includes("villa satish") || name === "satish") {
        groups["App & Mobile Team"].push(emp);
      }
      // Move Tharun to AI Developers
      else if (name === "tharun") {
        groups["AI Developers"].push(emp);
      }
      // Put Amrutha Varshini / Business Analysts in their own separate team
      // Be careful not to use "ba" blindly, or it catches "backend"!
      else if (name.includes("amrutha varshini") || desig.includes("business analyst") || desig === "ba") {
        groups["Business Analysts"].push(emp);
      }
      // Move Harish Kollati to Frontend Team instead of Leads
      else if (name.includes("harish kollati") || name.includes("harish")) {
        groups["Frontend Team"].push(emp);
      }
      else if (desig.includes("manager") || desig.includes("lead")) {
        groups["Leads"].push(emp);
      } else if (desig.includes("app") || dept.includes("app") || desig.includes("mobile") || dept.includes("mobile") || desig.includes("android") || desig.includes("ios") || desig.includes("flutter")) {
        groups["App & Mobile Team"].push(emp);
      } else if (dept.includes("frontend") || desig.includes("frontend") || desig.includes("react") || desig.includes("ui dev")) {
        groups["Frontend Team"].push(emp);
      } else if (dept.includes("backend") || desig.includes("backend") || desig.includes("node") || desig.includes("java") || desig.includes("python")) {
        groups["Backend Team"].push(emp);
      } else if (dept.includes("ai") || desig.includes("ai") || dept.includes("data") || desig.includes("data") || desig.includes("machine learning")) {
        groups["AI Developers"].push(emp);
      } else if (dept.includes("design") || desig.includes("design") || desig.includes("ui/ux") || desig.includes("figma")) {
        groups["UI/UX Design"].push(emp);
      } else if (dept.includes("qa") || desig.includes("qa") || dept.includes("test") || desig.includes("test")) {
        groups["QA & Testing"].push(emp);
      } else if (dept.includes("hr") || desig.includes("hr") || dept.includes("ops") || desig.includes("operations") || desig.includes("admin")) {
        groups["HR & Operations"].push(emp);
      } else {
        // Mover others under QA
        groups["QA & Testing"].push(emp);
      }
    });

    // Remove empty groups, but keep AI Developers so the column appears
    Object.keys(groups).forEach(key => {
      if (groups[key].length === 0 && key !== "AI Developers") delete groups[key];
    });

    // Sort specific Frontend Engineers to the top of the Frontend Team column
    if (groups["Frontend Team"]) {
      groups["Frontend Team"].sort((a, b) => {
        const nameA = (a.name || a.displayName || "").toLowerCase();
        const nameB = (b.name || b.displayName || "").toLowerCase();

        const isATop = nameA.includes("harish") || nameA.includes("bathini") || nameA.includes("ramu") || nameA.includes("raikrindhi") || nameA.includes("vishnu");
        const isBTop = nameB.includes("harish") || nameB.includes("bathini") || nameB.includes("ramu") || nameB.includes("raikrindhi") || nameB.includes("vishnu");

        if (isATop && !isBTop) return -1;
        if (!isATop && isBTop) return 1;
        return 0;
      });
    }

    return groups;
  }, [employees]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal Container - Full width */}
      <div className="relative w-[98vw] max-w-[1920px] h-[96vh] max-h-[96vh] bg-slate-50 rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-slate-200">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 shrink-0 z-20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl shadow-sm border border-blue-100">
              🏢
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800 tracking-tight">Organization Chart</h2>
              <p className="text-xs font-medium text-slate-500">Teams & Departments Overview</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content (The Chart) */}
        <div className="flex-1 overflow-hidden p-2 sm:p-4 bg-slate-50 flex items-start justify-center">
          {/* We scale the content container significantly to guarantee it fits in one screen. Origin is top center so it scales down neatly */}
          <div className="min-w-max flex flex-col items-center transform scale-[0.60] sm:scale-[0.70] md:scale-[0.75] lg:scale-[0.80] origin-top">

            {/* Top Company Node */}
            <div className="relative flex flex-col items-center">
              <div className="px-6 py-2 bg-white border-2 border-slate-800 text-slate-800 rounded-xl shadow-md font-bold text-base z-10">
                Our Company
              </div>
              {/* Vertical line dropping from company */}
              <div className="w-0.5 h-6 bg-slate-300"></div>
            </div>

            {/* CEO and COO Level */}
            {teams["CEO and COO"] && (
              <div className="relative flex flex-col items-center">
                {/* CEO Team Header Box */}
                <div className="px-4 py-1.5 bg-slate-800 text-white rounded-lg shadow-sm font-bold text-xs z-10 border border-slate-700 whitespace-nowrap">
                  CEO and COO
                  <span className="ml-1.5 inline-flex items-center justify-center bg-slate-600 text-[9px] px-1.5 py-0.5 rounded-full">
                    {teams["CEO and COO"].length}
                  </span>
                </div>

                {/* Vertical line dropping from header to horizontal line */}
                <div className="w-0.5 h-5 bg-slate-300 -z-10"></div>

                {/* CEO Cards Side by Side - auto width so long titles appear fully */}
                <div className="flex justify-center gap-12 z-10 w-full relative pt-0 -mt-1">
                  {teams["CEO and COO"].map((emp, index, arr) => (
                    <div key={emp.id} className="relative flex flex-col items-center">
                      {/* Horizontal connector line above each CEO card */}
                      {arr.length > 1 && (
                        <div 
                          className="absolute top-0 h-0.5 bg-slate-300 -z-10"
                          style={{
                            left: index === 0 ? "50%" : "0",
                            right: index === arr.length - 1 ? "50%" : "0"
                          }}
                        />
                      )}
                      
                      {/* Vertical line connecting horizontal connector to the card */}
                      <div className="w-0.5 h-4 bg-slate-300 -z-10"></div>

                      <div className="w-auto min-w-[160px] px-4 bg-white border border-blue-200 rounded-xl shadow-sm p-2 flex items-center gap-3">
                        <div className="shrink-0">
                          <Avatar name={emp.name || emp.displayName || emp.email?.split("@")[0] || "?"} size={28} photo={emp.profilePhoto} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs font-bold text-slate-800 text-blue-700 whitespace-normal">
                            {emp.name || emp.displayName || emp.email?.split("@")[0]}
                          </h4>
                          <p className="text-[10px] font-medium text-blue-500/80 uppercase tracking-wider mt-0.5 whitespace-normal">
                            {emp.designation === "CEO" ? "Chief Executive Officer" : (emp.designation || "Employee")}
                          </p>
                        </div>
                      </div>

                      {/* Vertical line dropping from the bottom of each card to the horizontal line below */}
                      <div className="w-0.5 h-8 bg-slate-300 -z-10"></div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Teams Row */}
            <div className="relative flex justify-center -mt-2 pt-0 w-full z-10">

              {Object.entries(teams).filter(([t]) => t !== "CEO and COO").map(([teamName, members], i, arr) => (
                <div key={teamName} className="relative flex flex-col items-center px-1 sm:px-1.5 md:px-2">

                  {/* Perfect edge-to-edge horizontal connector for each column */}
                  {arr.length > 1 && (
                    <div
                      className="absolute top-0 h-0.5 bg-slate-300 -z-10"
                      style={{
                        left: i === 0 ? "50%" : "0",
                        right: i === arr.length - 1 ? "50%" : "0"
                      }}
                    />
                  )}

                  {/* Small vertical tick connecting horizontal line to team box */}
                  <div className="w-0.5 h-4 bg-slate-300 -z-10"></div>

                  {/* Team Header Box */}
                  <div className="px-3 py-1.5 bg-slate-800 text-white rounded-md shadow-sm font-bold text-[11px] z-10 border border-slate-700 whitespace-nowrap mb-4 relative">
                    {teamName}
                    <span className="ml-1.5 inline-flex items-center justify-center bg-slate-600 text-[9px] px-1.5 py-0.5 rounded-full">
                      {members.length}
                    </span>
                  </div>

                  {/* Vertical spine for the members list */}
                  <div className="relative flex flex-col gap-2 before:absolute before:top-0 before:bottom-4 before:left-4 before:w-0.5 before:bg-slate-200">
                    {members.map((emp) => (
                      <div key={emp.id} className="relative flex items-center pl-8 z-10">
                        {/* Horizontal branch from spine to card */}
                        <div className="absolute left-4 top-1/2 w-4 h-0.5 bg-slate-200 -translate-y-1/2 -z-10"></div>

                        {/* Member Card - Much more compact */}
                        <div className="w-40 bg-white border border-slate-200 rounded-lg shadow-sm hover:shadow-md transition-shadow p-1.5 flex items-center gap-2 group">
                          <div className="shrink-0">
                            <Avatar name={emp.name || emp.displayName || emp.email?.split("@")[0] || "?"} size={24} photo={emp.profilePhoto} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="text-[10px] font-bold text-slate-800 truncate group-hover:text-blue-600 transition-colors">
                              {emp.name || emp.displayName || emp.email?.split("@")[0]}
                            </h4>
                            <p className="text-[8px] font-medium text-slate-500 truncate uppercase tracking-wider mt-0.5">
                              {emp.designation || "Employee"}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
