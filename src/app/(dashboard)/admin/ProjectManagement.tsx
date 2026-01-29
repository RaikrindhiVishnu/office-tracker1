"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  updateDoc,
  doc,
  orderBy,
  query,
  addDoc,
  serverTimestamp,
  deleteDoc,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";

/* ================= TYPES ================= */

type Status = "new" | "dev" | "testing" | "reopen" | "done";

type Employee = {
  id: string;
  name: string;
  email: string;
  role: string;
};

type Ticket = {
  id: string;
  title: string;
  status: Status;
  assignedTo?: string; // employee ID
  updatedAt?: any;
};

/* ================= CONSTANTS ================= */

const STATUS_META: Record<
  Status,
  { label: string; className: string }
> = {
  new: {
    label: "New",
    className: "bg-blue-100 text-blue-700 border-blue-200",
  },
  dev: {
    label: "In Development",
    className: "bg-purple-100 text-purple-700 border-purple-200",
  },
  testing: {
    label: "Testing",
    className: "bg-yellow-100 text-yellow-700 border-yellow-200",
  },
  reopen: {
    label: "Reopened",
    className: "bg-orange-100 text-orange-700 border-orange-200",
  },
  done: {
    label: "Done",
    className: "bg-green-100 text-green-700 border-green-200",
  },
};

const STATUS_ORDER: Status[] = [
  "new",
  "dev",
  "testing",
  "reopen",
  "done",
];

/* ================= COMPONENT ================= */

export default function ProjectManagement() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [newTicketTitle, setNewTicketTitle] = useState("");
  const [newTicketAssignee, setNewTicketAssignee] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [deletingTicket, setDeletingTicket] = useState<string | null>(null);

  /* ================= LOAD DATA ================= */
  useEffect(() => {
    // Auth listener
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      setCurrentUser(user);
    });

    // Tickets listener
    const ticketsQuery = query(
      collection(db, "tickets"),
      orderBy("updatedAt", "desc")
    );
    const unsubscribeTickets = onSnapshot(ticketsQuery, (snap) => {
      setTickets(
        snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            title: data.title,
            status: data.status,
            assignedTo: data.assignedTo,
            updatedAt: data.updatedAt,
          };
        })
      );
    });

    // Employees listener
    const employeesQuery = query(
      collection(db, "employees"),
      orderBy("name", "asc")
    );
    const unsubscribeEmployees = onSnapshot(employeesQuery, (snap) => {
      setEmployees(
        snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            name: data.name,
            email: data.email,
            role: data.role,
          };
        })
      );
    });

    return () => {
      unsubscribeAuth();
      unsubscribeTickets();
      unsubscribeEmployees();
    };
  }, []);

  /* ================= CREATE TICKET ================= */
  const createTicket = async () => {
    if (!currentUser || !newTicketTitle.trim()) return;

    try {
      await addDoc(collection(db, "tickets"), {
        title: newTicketTitle.trim(),
        status: "new" as Status,
        assignedTo: newTicketAssignee || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setNewTicketTitle("");
      setNewTicketAssignee("");
      setShowNewTicket(false);
    } catch (error) {
      console.error("Failed to create ticket:", error);
    }
  };

  /* ================= FILTERED ================= */
  const filtered = useMemo(() => {
    return tickets.filter((t) => {
      const matchesSearch = t.title
        .toLowerCase()
        .includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === "all" ||
        t.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [tickets, search, statusFilter]);

  /* ================= UPDATE STATUS ================= */
  const updateStatus = async (
    ticketId: string,
    status: Status
  ) => {
    await updateDoc(doc(db, "tickets", ticketId), {
      status,
      updatedAt: serverTimestamp(),
    });
  };

  /* ================= UPDATE ASSIGNEE ================= */
  const updateAssignee = async (
    ticketId: string,
    assignedTo: string
  ) => {
    await updateDoc(doc(db, "tickets", ticketId), {
      assignedTo: assignedTo || null,
      updatedAt: serverTimestamp(),
    });
  };

  /* ================= DELETE TICKET ================= */
  const deleteTicket = async (ticketId: string) => {
    if (!confirm("Are you sure you want to delete this ticket?")) return;
    
    setDeletingTicket(ticketId);
    try {
      await deleteDoc(doc(db, "tickets", ticketId));
    } catch (error) {
      console.error("Failed to delete ticket:", error);
      alert("Failed to delete ticket. Please try again.");
    } finally {
      setDeletingTicket(null);
    }
  };

  /* ================= STATS ================= */
  const stats = useMemo(() => {
    const s: Record<Status, number> = {
      new: 0,
      dev: 0,
      testing: 0,
      reopen: 0,
      done: 0,
    };
    tickets.forEach((t) => s[t.status]++);
    return s;
  }, [tickets]);

  /* ================= HELPER ================= */
  const getEmployeeName = (employeeId?: string) => {
    if (!employeeId) return "Unassigned";
    const employee = employees.find((e) => e.id === employeeId);
    return employee ? employee.name : "Unknown";
  };

  /* ================= UI ================= */

  return (
    <div className="min-h-screen bg-white text-gray-800 p-6">
      {/* HEADER */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Project Management
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            {tickets.length} tickets · {stats.done} completed · {employees.length} employees
          </p>
        </div>

        <div className="flex gap-3">
          <button 
            onClick={() => setShowNewTicket(true)}
            className="bg-blue-600 hover:bg-blue-700 px-5 py-2.5 rounded-lg text-white font-medium shadow-sm transition-colors"
          >
            + New Ticket
          </button>
        </div>
      </div>

      {/* NEW TICKET MODAL */}
      {showNewTicket && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-gray-200 rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900">New Ticket</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">Title</label>
                <input
                  type="text"
                  placeholder="Enter ticket title..."
                  value={newTicketTitle}
                  onChange={(e) => setNewTicketTitle(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">Assign To</label>
                <select
                  value={newTicketAssignee}
                  onChange={(e) => setNewTicketAssignee(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Unassigned</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} - {emp.role}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t border-gray-200">
              <button
                onClick={createTicket}
                disabled={!newTicketTitle.trim()}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2.5 rounded-lg text-white font-medium transition-colors shadow-sm"
              >
                Create Ticket
              </button>
              <button
                onClick={() => {
                  setShowNewTicket(false);
                  setNewTicketTitle("");
                  setNewTicketAssignee("");
                }}
                className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STATUS STATS */}
      <div className="flex gap-6 text-sm mb-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
        {STATUS_ORDER.map((s) => (
          <div key={s} className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                STATUS_META[s].className
              }`}
            />
            <span className="text-gray-700 font-medium">
              {STATUS_META[s].label}: <span className="text-gray-900 font-semibold">{stats[s]}</span>
            </span>
          </div>
        ))}
      </div>

      {/* FILTER BAR */}
      <div className="flex gap-4 mb-6">
        <input
          placeholder="Search tickets..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-white border border-gray-300 rounded-lg px-4 py-2.5 w-80 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
        />

        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(
              e.target.value as Status | "all"
            )
          }
          className="bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
        >
          <option value="all">All Status</option>
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {STATUS_META[s].label}
            </option>
          ))}
        </select>
      </div>

      {/* TICKETS TABLE */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm mb-6">
        <div className="p-5 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Tickets</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="p-4 text-left font-semibold text-gray-700">ID</th>
              <th className="p-4 text-left font-semibold text-gray-700">Title</th>
              <th className="p-4 text-left font-semibold text-gray-700">Assigned To</th>
              <th className="p-4 text-left font-semibold text-gray-700">Status</th>
              <th className="p-4 text-left font-semibold text-gray-700">Updated</th>
              <th className="p-4 text-left font-semibold text-gray-700 w-24">Actions</th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((t, i) => (
              <tr
                key={t.id}
                className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
              >
                <td className="p-4 text-gray-600 font-mono text-xs">
                  TKT-{String(i + 1).padStart(3, "0")}
                </td>

                <td className="p-4 font-medium text-gray-900">
                  {t.title}
                </td>

                <td className="p-4">
                  <select
                    value={t.assignedTo || ""}
                    onChange={(e) => updateAssignee(t.id, e.target.value)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-white border border-gray-300 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Unassigned</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name}
                      </option>
                    ))}
                  </select>
                </td>

                <td className="p-4">
                  <select
                    value={t.status}
                    onChange={(e) =>
                      updateStatus(
                        t.id,
                        e.target.value as Status
                      )
                    }
                    className={`text-xs px-3 py-1.5 rounded-full font-medium border ${STATUS_META[t.status]?.className ?? "bg-gray-100 text-gray-700 border-gray-200"}`}
                  >
                    {STATUS_ORDER.map((s) => (
                      <option
                        key={s}
                        value={s}
                        className="bg-white"
                      >
                        {STATUS_META[s].label}
                      </option>
                    ))}
                  </select>
                </td>

                <td className="p-4 text-gray-600">
                  {t.updatedAt?.toDate
                    ? t.updatedAt
                        .toDate()
                        .toLocaleDateString()
                    : "--"}
                </td>

                <td className="p-4">
                  <button
                    onClick={() => deleteTicket(t.id)}
                    disabled={deletingTicket === t.id}
                    className="text-xs bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap shadow-sm"
                  >
                    {deletingTicket === t.id ? "Deleting..." : "Delete"}
                  </button>
                </td>
              </tr>
            ))}

            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="p-8 text-center text-gray-500"
                >
                  No tickets found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* EMPLOYEES TABLE
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="p-5 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Employees</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="p-4 text-left font-semibold text-gray-700">Name</th>
              <th className="p-4 text-left font-semibold text-gray-700">Email</th>
              <th className="p-4 text-left font-semibold text-gray-700">Role</th>
            </tr>
          </thead>

          <tbody>
            {employees.map((emp) => (
              <tr
                key={emp.id}
                className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
              >
                <td className="p-4 font-medium text-gray-900">
                  {emp.name}
                </td>

                <td className="p-4 text-gray-600">
                  {emp.email}
                </td>

                <td className="p-4">
                  <span className="text-xs px-3 py-1.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200 font-medium">
                    {emp.role}
                  </span>
                </td>
              </tr>
            ))}

            {employees.length === 0 && (
              <tr>
                <td
                  colSpan={3}
                  className="p-8 text-center text-gray-500"
                >
                  No employees found. Add employees to your Firebase "employees" collection.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div> */}
    </div>
  );
}