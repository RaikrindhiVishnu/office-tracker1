"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

/* ─── TYPES ─── */
export interface QuickFilterState {
  assignees: string[];
  priorities: string[];
  itemTypes: string[];
  statuses: string[];
  sprints: string[];
  tags: string[];
  startDate: string;
  endDate: string;
  dueDateRange: string;
  blockStatus: string;
}

export const EMPTY_FILTER: QuickFilterState = {
  assignees: [],
  priorities: [],
  itemTypes: [],
  statuses: [],
  sprints: [],
  tags: [],
  startDate: "",
  endDate: "",
  dueDateRange: "",
  blockStatus: "",
};

interface QuickFilterProps {
  projectMembers: any[];
  sprints: any[];
  columns: { id: string; label: string }[];
  allTags: string[];
  value: QuickFilterState;
  onChange: (f: QuickFilterState) => void;
}

/* ─── CONSTANTS ─── */
const PRIORITIES = ["Low", "Medium", "High", "Critical"];
const ITEM_TYPES = [
  { value: "story",  label: "Story",  icon: "📘" },
  { value: "task",   label: "Task",   icon: "🧩" },
  { value: "bug",    label: "Bug",    icon: "🐞" },
  { value: "defect", label: "Defect", icon: "🎯" },
];
const DUE_DATE_OPTIONS = [
  { value: "overdue",    label: "Overdue" },
  { value: "today",      label: "Today" },
  { value: "tomorrow",   label: "Tomorrow" },
  { value: "this_week",  label: "This Week" },
  { value: "next_7",     label: "Next 7 Days" },
  { value: "this_month", label: "This Month" },
];
const PRIORITY_CONFIG: Record<string, { color: string; bg: string; dot: string }> = {
  Low:      { color: "#16a34a", bg: "#f0fdf4", dot: "#22c55e" },
  Medium:   { color: "#d97706", bg: "#fffbeb", dot: "#f59e0b" },
  High:     { color: "#ea580c", bg: "#fff7ed", dot: "#f97316" },
  Critical: { color: "#dc2626", bg: "#fef2f2", dot: "#ef4444" },
};

/* ─── HELPER: count active filters ─── */
export function countActiveFilters(f: QuickFilterState): number {
  return (
    f.assignees.length +
    f.priorities.length +
    f.itemTypes.length +
    f.statuses.length +
    f.sprints.length +
    f.tags.length +
    (f.startDate ? 1 : 0) +
    (f.endDate ? 1 : 0) +
    (f.dueDateRange ? 1 : 0) +
    (f.blockStatus ? 1 : 0)
  );
}

/* ─── HELPER: apply filter to tasks ─── */
export function applyQuickFilter(tasks: any[], f: QuickFilterState, columns: { id: string; label: string }[]): any[] {
  return tasks.filter((t) => {
    if (f.assignees.length && !f.assignees.includes(t.assignedTo || "__unassigned__")) return false;
    if (f.priorities.length && !f.priorities.includes(t.priority)) return false;
    if (f.itemTypes.length && !f.itemTypes.includes(t.ticketType || "task")) return false;
    if (f.statuses.length && !f.statuses.includes(t.status)) return false;
    if (f.sprints.length && !f.sprints.includes(t.sprintId || "__backlog__")) return false;
    if (f.tags.length && !f.tags.some((tag) => t.tags?.includes(tag))) return false;
    if (f.blockStatus === "blocked" && (t.blockedBy?.length || 0) === 0) return false;
    if (f.blockStatus === "not_blocked" && (t.blockedBy?.length || 0) > 0) return false;
    if (f.dueDateRange) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const due = t.dueDate ? new Date(t.dueDate + "T12:00:00") : null;
      const doneColId = columns.find((c) => c.label.toLowerCase() === "done")?.id || "done";
      if (f.dueDateRange === "overdue") {
        if (!due || due >= today || t.status === doneColId) return false;
      } else if (f.dueDateRange === "today") {
        if (!due || due.toDateString() !== today.toDateString()) return false;
      } else if (f.dueDateRange === "tomorrow") {
        const tom = new Date(today); tom.setDate(tom.getDate() + 1);
        if (!due || due.toDateString() !== tom.toDateString()) return false;
      } else if (f.dueDateRange === "this_week") {
        const end = new Date(today); end.setDate(end.getDate() + 7);
        if (!due || due < today || due > end) return false;
      } else if (f.dueDateRange === "next_7") {
        const end = new Date(today); end.setDate(end.getDate() + 7);
        if (!due || due < today || due > end) return false;
      } else if (f.dueDateRange === "this_month") {
        if (!due || due.getMonth() !== today.getMonth() || due.getFullYear() !== today.getFullYear()) return false;
      }
    }
    return true;
  });
}

/* ─── SECTION HEADER ─── */
function SectionHeader({ label, icon }: { label: string; icon?: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-2">
      {icon && <span style={{ fontSize: 13 }}>{icon}</span>}
      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{label}</p>
    </div>
  );
}

/* ─── CHECKBOX ITEM ─── */
function CheckItem({
  checked, label, icon, dotColor, bg, color, onClick,
}: {
  checked: boolean; label: string; icon?: string;
  dotColor?: string; bg?: string; color?: string; onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition hover:bg-gray-50 select-none"
      style={{ background: checked ? (bg || "#eef2ff") : undefined }}
    >
      <div
        className="w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition"
        style={{
          background: checked ? "#6366f1" : "white",
          borderColor: checked ? "#6366f1" : "#d1d5db",
        }}
      >
        {checked && <span className="text-white" style={{ fontSize: 9, fontWeight: 900, lineHeight: 1 }}>✓</span>}
      </div>
      {dotColor && (
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: dotColor }} />
      )}
      {icon && <span style={{ fontSize: 14 }}>{icon}</span>}
      <span
        className="text-xs font-medium truncate"
        style={{ color: checked ? (color || "#4f46e5") : "#374151" }}
      >
        {label}
      </span>
    </div>
  );
}

/* ─── RADIO ITEM ─── */
function RadioItem({ selected, label, onClick }: { selected: boolean; label: string; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition hover:bg-gray-50 select-none"
      style={{ background: selected ? "#eef2ff" : undefined }}
    >
      <div
        className="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition"
        style={{ borderColor: selected ? "#6366f1" : "#d1d5db" }}
      >
        {selected && <div className="w-2 h-2 rounded-full" style={{ background: "#6366f1" }} />}
      </div>
      <span className="text-xs font-medium" style={{ color: selected ? "#4f46e5" : "#374151" }}>{label}</span>
    </div>
  );
}

/* ─── FILTER SECTION WRAPPER ─── */
function FilterSection({ children, minWidth = 160 }: { children: React.ReactNode; minWidth?: number }) {
  return (
    <div
      className="shrink-0 border-r border-gray-100 px-3 py-3"
      style={{ minWidth, maxWidth: 220 }}
    >
      {children}
    </div>
  );
}

/* ─── MAIN QUICK FILTER COMPONENT ─── */
export function QuickFilter({
  projectMembers,
  sprints,
  columns,
  allTags,
  value,
  onChange,
}: QuickFilterProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<QuickFilterState>(value);
  const [assigneeSearch, setAssigneeSearch] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0 });

  const activeCount = countActiveFilters(value);

  /* Sync draft when panel opens */
  useEffect(() => {
    if (open) setDraft({ ...value });
  }, [open]);

  /* Position panel below button */
  useEffect(() => {
    if (open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPanelPos({ top: rect.bottom + 6, left: Math.max(rect.left - 8, 8) });
    }
  }, [open]);

  /* Close on outside click */
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const toggle = <K extends keyof QuickFilterState>(
    key: K, val: string
  ) => {
    setDraft((prev) => {
      const arr = prev[key] as string[];
      return {
        ...prev,
        [key]: arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val],
      };
    });
  };

  const setRadio = <K extends keyof QuickFilterState>(key: K, val: string) => {
    setDraft((prev) => ({ ...prev, [key]: prev[key] === val ? "" : val }));
  };

  const handleApply = () => {
    onChange(draft);
    setOpen(false);
  };

  const handleReset = () => {
    const empty = { ...EMPTY_FILTER };
    setDraft(empty);
    onChange(empty);
  };

  const filteredMembers = projectMembers.filter((u) => {
    const name = (u.displayName || u.name || u.email?.split("@")[0] || "").toLowerCase();
    return name.includes(assigneeSearch.toLowerCase()) || (u.email || "").toLowerCase().includes(assigneeSearch.toLowerCase());
  });

  const panel = open ? createPortal(
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" style={{ background: "rgba(0,0,0,0.15)" }} onClick={() => setOpen(false)} />

      {/* Panel */}
      <div
        ref={panelRef}
        className="fixed z-50 bg-white rounded-2xl border border-gray-200"
        style={{
          top: panelPos.top,
          left: panelPos.left,
          maxWidth: "calc(100vw - 16px)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.14)",
          animation: "qfSlideIn 0.15s ease",
        }}
      >
        <style>{`
          @keyframes qfSlideIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        `}</style>

        {/* Panel header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 14 }}>🔍</span>
            <span className="text-sm font-black text-gray-800">Quick Filter</span>
            {countActiveFilters(draft) > 0 && (
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                {countActiveFilters(draft)} active
              </span>
            )}
          </div>
          <button onClick={() => setOpen(false)} className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 text-xs transition">✕</button>
        </div>

        {/* Scrollable filter columns */}
        <div className="flex overflow-x-auto" style={{ maxHeight: "480px" }}>

          {/* ── Assignee ── */}
          <FilterSection minWidth={170}>
            <SectionHeader label="Assignee" icon="👤" />
            <div className="relative mb-2">
              <input
                value={assigneeSearch}
                onChange={(e) => setAssigneeSearch(e.target.value)}
                placeholder="Search..."
                className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: 280 }}>
              <CheckItem
                checked={draft.assignees.includes("__unassigned__")}
                label="Unassigned"
                dotColor="#9ca3af"
                onClick={() => toggle("assignees", "__unassigned__")}
              />
              {filteredMembers.map((u) => {
                const name = u.displayName || u.name || u.email?.split("@")[0] || "Unknown";
                return (
                  <CheckItem
                    key={u.uid}
                    checked={draft.assignees.includes(u.uid)}
                    label={name}
                    dotColor="#6366f1"
                    onClick={() => toggle("assignees", u.uid)}
                  />
                );
              })}
            </div>
          </FilterSection>

          {/* ── Item Type ── */}
          <FilterSection minWidth={140}>
            <SectionHeader label="Item Type" icon="🏷️" />
            {ITEM_TYPES.map((t) => (
              <CheckItem
                key={t.value}
                checked={draft.itemTypes.includes(t.value)}
                label={t.label}
                icon={t.icon}
                onClick={() => toggle("itemTypes", t.value)}
              />
            ))}
          </FilterSection>

          {/* ── Priority ── */}
          <FilterSection minWidth={140}>
            <SectionHeader label="Priority" icon="⚡" />
            {PRIORITIES.map((p) => {
              const pc = PRIORITY_CONFIG[p];
              return (
                <CheckItem
                  key={p}
                  checked={draft.priorities.includes(p)}
                  label={p}
                  dotColor={pc.dot}
                  bg={pc.bg}
                  color={pc.color}
                  onClick={() => toggle("priorities", p)}
                />
              );
            })}
          </FilterSection>

          {/* ── Status ── */}
          <FilterSection minWidth={150}>
            <SectionHeader label="Item Status" icon="🔄" />
            <div className="overflow-y-auto" style={{ maxHeight: 280 }}>
              {columns.map((col) => (
                <CheckItem
                  key={col.id}
                  checked={draft.statuses.includes(col.id)}
                  label={col.label}
                  dotColor="#6366f1"
                  onClick={() => toggle("statuses", col.id)}
                />
              ))}
            </div>
          </FilterSection>

          {/* ── Sprints ── */}
          <FilterSection minWidth={180}>
            <SectionHeader label="Sprints" icon="🏃" />
            <div className="overflow-y-auto" style={{ maxHeight: 280 }}>
              <CheckItem
                checked={draft.sprints.includes("__backlog__")}
                label="Backlog (no sprint)"
                dotColor="#9ca3af"
                onClick={() => toggle("sprints", "__backlog__")}
              />
              {sprints.map((s) => {
                const now = new Date();
                let dotColor = "#d97706";
                if (s.status === "completed") dotColor = "#16a34a";
                else if (s.endDate && new Date(s.endDate) < now) dotColor = "#dc2626";
                else if (s.startDate && new Date(s.startDate) <= now) dotColor = "#2563eb";
                return (
                  <CheckItem
                    key={s.id}
                    checked={draft.sprints.includes(s.id)}
                    label={s.name}
                    dotColor={dotColor}
                    onClick={() => toggle("sprints", s.id)}
                  />
                );
              })}
            </div>
          </FilterSection>

          {/* ── Tags ── */}
          {allTags.length > 0 && (
            <FilterSection minWidth={150}>
              <SectionHeader label="Tags" icon="🔖" />
              <div className="overflow-y-auto" style={{ maxHeight: 280 }}>
                {allTags.map((tag) => (
                  <CheckItem
                    key={tag}
                    checked={draft.tags.includes(tag)}
                    label={`#${tag}`}
                    onClick={() => toggle("tags", tag)}
                  />
                ))}
              </div>
            </FilterSection>
          )}

          {/* ── Due Date ── */}
          <FilterSection minWidth={150}>
            <SectionHeader label="Due Date" icon="📅" />
            {DUE_DATE_OPTIONS.map((d) => (
              <RadioItem
                key={d.value}
                selected={draft.dueDateRange === d.value}
                label={d.label}
                onClick={() => setRadio("dueDateRange", d.value)}
              />
            ))}
            <div className="mt-3 space-y-1.5">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Custom Range</p>
              <input
                type="date"
                value={draft.startDate}
                onChange={(e) => setDraft((p) => ({ ...p, startDate: e.target.value, dueDateRange: "" }))}
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none"
              />
              <input
                type="date"
                value={draft.endDate}
                onChange={(e) => setDraft((p) => ({ ...p, endDate: e.target.value, dueDateRange: "" }))}
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none"
              />
            </div>
          </FilterSection>

          {/* ── Block Status ── */}
          <FilterSection minWidth={150}>
            <SectionHeader label="Block Status" icon="⛔" />
            <RadioItem
              selected={draft.blockStatus === "blocked"}
              label="Blocked"
              onClick={() => setRadio("blockStatus", "blocked")}
            />
            <RadioItem
              selected={draft.blockStatus === "not_blocked"}
              label="Not blocked"
              onClick={() => setRadio("blockStatus", "not_blocked")}
            />
          </FilterSection>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            {countActiveFilters(draft) > 0 && (
              <span className="font-semibold text-indigo-600">{countActiveFilters(draft)} filter{countActiveFilters(draft) !== 1 ? "s" : ""} selected</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="px-4 py-2 text-xs font-semibold text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-100 transition"
            >
              Reset
            </button>
            <button
              onClick={() => setOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-100 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="px-5 py-2 text-xs font-black text-white rounded-xl transition hover:opacity-90"
              style={{ background: "linear-gradient(135deg,#6366f1,#7c3aed)" }}
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  ) : null;

  return (
    <>
      {panel}
      <button
        ref={btnRef}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-xs border rounded-lg px-2.5 py-1.5 transition focus:outline-none"
        style={{
          background: open || activeCount > 0 ? "#eef2ff" : "white",
          borderColor: open || activeCount > 0 ? "#a5b4fc" : "#e5e7eb",
          color: open || activeCount > 0 ? "#4f46e5" : "#374151",
        }}
      >
        <span style={{ fontSize: 12 }}>🔍</span>
        <span className="font-semibold">Quick Filter</span>
        {activeCount > 0 && (
          <span
            className="text-[10px] font-black px-1.5 py-0.5 rounded-full"
            style={{ background: "#6366f1", color: "white" }}
          >
            {activeCount}
          </span>
        )}
        <span style={{ fontSize: 10, color: "#9ca3af" }}>{open ? "▴" : "▾"}</span>
      </button>
    </>
  );
}
