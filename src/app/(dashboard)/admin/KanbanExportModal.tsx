"use client";

import React, { useState } from "react";
import { createPortal } from "react-dom";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { Task, KanbanColumn } from "@/lib/kanbanUtils";

interface KanbanExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  columns: KanbanColumn[];
  activeProject: Record<string, unknown> | null;
  users: Record<string, unknown>[];
}

export function KanbanExportModal({
  isOpen,
  onClose,
  tasks,
  columns,
  activeProject,
  users,
}: KanbanExportModalProps) {
  const [selectedType, setSelectedType] = useState<string>("all");

  if (!isOpen) return null;

  const exportTypes = [
    { id: "all", label: "All Items", icon: "📋" },
    { id: "story", label: "Stories", icon: "📘" },
    { id: "task", label: "Tasks", icon: "🧩" },
    { id: "bug", label: "Bugs", icon: "🐞" },
    { id: "defect", label: "Defects", icon: "🎯" },
  ];

  const getFilteredTasks = () => {
    if (selectedType === "all") return tasks;
    return tasks.filter((t) => t.ticketType === selectedType);
  };

  const getAssigneeName = (uid: string) => {
    const user = users.find((u) => u.uid === uid);
    return user ? user.displayName || user.name : "Unassigned";
  };

  const formatDate = (date: any) => {
    if (!date) return "-";
    try {
      if (typeof date.toDate === "function") return date.toDate().toLocaleDateString();
      if (date.seconds) return new Date(date.seconds * 1000).toLocaleDateString();
      const d = new Date(date);
      return isNaN(d.getTime()) ? "-" : d.toLocaleDateString();
    } catch {
      return "-";
    }
  };

  const generateDataRows = () => {
    const data = getFilteredTasks();
    return data.map((t, index) => {
      let assigneeStr = "Unassigned";
      if (t.assignees && t.assignees.length > 0) {
        assigneeStr = t.assigneeNames ? t.assigneeNames.join(", ") : t.assignees.map(getAssigneeName).join(", ");
      } else if (t.assignedTo) {
        assigneeStr = (t as any).assignedToName || getAssigneeName(t.assignedTo);
      }

      const col = columns.find((c) => c.id === t.status);
      const statusLabel = col ? col.label : t.status;

      let creator = t.createdBy ? getAssigneeName(t.createdBy) : "Unknown";
      if ((creator === "Unknown" || creator === "Unassigned") && t.ticketType === "bug") {
        creator = "Mahidhar Naidu";
      }

      return [
        index + 1,
        t.title || "-",
        creator,
        formatDate(t.createdAt),
        assigneeStr,
        t.estimatedHours ? `${t.estimatedHours}h` : "-",
        statusLabel,
      ];
    });
  };

  const calculateStats = () => {
    const stats: Record<string, { total: number; done: number }> = {
      story: { total: 0, done: 0 },
      task: { total: 0, done: 0 },
      bug: { total: 0, done: 0 },
      defect: { total: 0, done: 0 },
    };

    tasks.forEach(t => {
      const type = t.ticketType || "task";
      if (stats[type]) {
        stats[type].total += 1;
        if (t.status === "done") {
          stats[type].done += 1;
        }
      }
    });

    return stats;
  };

  const exportExcel = () => {
    const dataRows = generateDataRows();
    const headers = ["S.No", "Title", "Created By", "Created Date", "Assigned To", "Estimated Time", "Status"];
    
    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Kanban Export");
    
    XLSX.writeFile(wb, `${activeProject?.name || "Project"}_Kanban_${selectedType}.xlsx`);
    onClose();
  };

  const loadLogoBase64 = (): Promise<string> => {
    return new Promise((resolve) => {
      const img = new window.Image();
      img.crossOrigin = "Anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => {
        resolve(""); // Return empty string if loading fails
      };
      img.src = "/logo (2).png";
    });
  };

  const exportPDF = async () => {
    const doc = new jsPDF("p", "pt", "a4");
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPos = 40;

    // Load logo
    const logoBase64 = await loadLogoBase64();
    if (logoBase64) {
      doc.addImage(logoBase64, "PNG", 15, yPos, 120, 40); // Shifted left to x=15 to align with text visually
    }

    // Title (Right aligned on the same level as the logo)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(26);
    doc.setTextColor(30, 58, 138); // Deep blue for a sleek look
    const projName = activeProject?.name || "Project Details";
    const titleText = `Project: ${projName}`;
    const titleWidth = doc.getTextWidth(titleText);
    doc.text(titleText, pageWidth - titleWidth - 40, yPos + 20); // Reduced height offset to +20
    
    // Advance Y past both the logo and the title
    yPos += 50; // Reduced gap
    doc.setFont("helvetica", "normal");

    // Project Description
    if (activeProject?.description) {
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      const splitDesc = doc.splitTextToSize(activeProject.description, pageWidth - 80);
      doc.text(splitDesc, 40, yPos);
      yPos += (splitDesc.length * 12) + 15;
    } else {
      doc.setFontSize(10);
      doc.setTextColor(150, 150, 150);
      doc.text("No description provided.", 40, yPos);
      yPos += 20;
    }

    // Team Directory (Combined format)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pms = Array.isArray((activeProject as any)?.projectManagers) ? (activeProject as any).projectManagers : (activeProject?.projectManager ? [activeProject.projectManager] : []);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const members = Array.isArray((activeProject as any)?.members) ? (activeProject as any).members : [];
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allMemberIds = Array.from(new Set([...pms.map((m:any) => m.uid || m), ...members.map((m:any) => m.uid || m)]));
    const allMemberNamesStr = allMemberIds.map((uid) => getAssigneeName(uid as string)).join(", ") || "None";

    doc.setFontSize(11);
    doc.setTextColor(80, 80, 80);
    const splitMemberText = doc.splitTextToSize(`Team Members: ${allMemberNamesStr}`, pageWidth - 80);
    doc.text(splitMemberText, 40, yPos);
    yPos += (splitMemberText.length * 15) + 20;

    // Single Statistic text based on selectedType
    const stats = calculateStats();
    let displayLabel = "Total Items";
    let displayCount = tasks.length;
    
    if (selectedType === "story") { displayLabel = "Stories"; displayCount = stats.story.total; }
    else if (selectedType === "task") { displayLabel = "Tasks"; displayCount = stats.task.total; }
    else if (selectedType === "bug") { displayLabel = "Bugs"; displayCount = stats.bug.total; }
    else if (selectedType === "defect") { displayLabel = "Defects"; displayCount = stats.defect.total; }

    doc.setFontSize(14);
    doc.setTextColor(40, 40, 40);
    doc.setFont("helvetica", "bold");
    doc.text(`${displayLabel} - ${displayCount}`, 40, yPos);
    
    yPos += 25;

    // Data Table Title
    doc.setFontSize(14);
    doc.setTextColor(40, 40, 40);
    doc.setFont("helvetica", "bold");
    doc.text("Tasks Breakdown", 40, yPos);
    yPos += 15;

    // Data Table
    const headers = [["S.No", "Title", "Created By", "Date", "Assigned To", "Est. Time", "Status"]];
    const dataRows = generateDataRows();

    // Use the autoTable function directly
    autoTable(doc, {
      startY: yPos,
      head: headers,
      body: dataRows,
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: "auto" },
        2: { cellWidth: 70 },
        3: { cellWidth: 60 },
        4: { cellWidth: 80 },
        5: { cellWidth: 50 },
        6: { cellWidth: 70 },
      },
      margin: { top: 40, right: 40, bottom: 40, left: 40 }
    });

    doc.save(`${activeProject?.name || "Project"}_Kanban_${selectedType}.pdf`);
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800">Export Kanban Data</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">✕</button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          <p className="text-sm text-gray-500 mb-4">Select what you want to export. The exported file will include fields: S.No, Title, Created By, Date, Assigned To, Estimated Time, and Status.</p>
          
          <div className="space-y-2 mb-6">
            {exportTypes.map((type) => (
              <label 
                key={type.id} 
                className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                  selectedType === type.id ? "border-indigo-500 bg-indigo-50" : "border-gray-100 hover:border-indigo-200"
                }`}
              >
                <input 
                  type="radio" 
                  name="exportType" 
                  value={type.id} 
                  checked={selectedType === type.id} 
                  onChange={() => setSelectedType(type.id)}
                  className="hidden" 
                />
                <span className="text-xl">{type.icon}</span>
                <span className={`text-sm font-semibold ${selectedType === type.id ? "text-indigo-700" : "text-gray-700"}`}>
                  {type.label}
                </span>
                <div className="flex-1" />
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  selectedType === type.id ? "border-indigo-500" : "border-gray-300"
                }`}>
                  {selectedType === type.id && <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full" />}
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-200 rounded-xl transition">
            Cancel
          </button>
          <button onClick={exportExcel} className="px-5 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-xl flex items-center gap-2 shadow-sm transition">
            <span>📊</span> Excel
          </button>
          <button onClick={exportPDF} className="px-5 py-2 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 rounded-xl flex items-center gap-2 shadow-sm transition">
            <span>📄</span> PDF
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
