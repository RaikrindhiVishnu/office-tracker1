"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

// ─── Types ────────────────────────────────────────────────────────────────────

type AssetType = "laptop" | "server" | "license" | "software";
type AssetStatus = "active" | "under_repair" | "retired";

interface ITAsset {
  id: string;
  name: string;
  type: AssetType;
  serialNumber: string;
  assignedTo: string;
  department: string;
  status: AssetStatus;
  purchaseCost: number;
  warrantyExpiry: string;
  createdAt: string;
}

const EMPTY_FORM = {
  name: "",
  type: "laptop" as AssetType,
  serialNumber: "",
  assignedTo: "",
  department: "IT",
  status: "active" as AssetStatus,
  purchaseCost: 0,
  warrantyExpiry: "",
};

const DEPARTMENTS = ["IT", "Engineering", "HR", "Finance", "Marketing", "Operations", "Sales"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysUntil(dateStr: string) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(dateStr).getTime() - today.getTime()) / 86400000);
}

function fmtDate(dateStr: string) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtCost(n: number) {
  return n ? `₹${n.toLocaleString("en-IN")}` : "—";
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ITAssetsPage() {
  const [assets, setAssets] = useState<ITAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  // Modal state
  const [showForm, setShowForm] = useState(false);
  const [editAsset, setEditAsset] = useState<ITAsset | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [repairNote, setRepairNote] = useState("");
  const [repairCost, setRepairCost] = useState(0);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Repair quick-log modal
  const [repairTarget, setRepairTarget] = useState<ITAsset | null>(null);
  const [repairQuickNote, setRepairQuickNote] = useState("");
  const [repairQuickCost, setRepairQuickCost] = useState(0);
  const [repairSaving, setRepairSaving] = useState(false);

  // Delete confirm
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // ─── Firebase: real-time listener ─────────────────────────────────────────

  useEffect(() => {
    const q = query(collection(db, "it_assets"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setAssets(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ITAsset)));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // ─── Firebase: create repair transaction ──────────────────────────────────

  async function createRepairTransaction(assetId: string, assetName: string, note: string, cost: number, department: string) {
    await addDoc(collection(db, "transactions"), {
  type: "expense",
  category: "repair",

  assetId,
  assetName,

  description: note,
  amount: cost,

  department,

  createdBy: user?.uid || "unknown",          // ✅ VERY IMPORTANT
  createdByName: user?.displayName || "User", // ✅ OPTIONAL BUT GOOD

  createdAt: new Date(),                     // ✅ better than toISOString()

  status: "pending",
});
  }

  // ─── Add / Edit ────────────────────────────────────────────────────────────

  function openAdd() {
    setEditAsset(null);
    setForm({ ...EMPTY_FORM });
    setRepairNote("");
    setRepairCost(0);
    setFormError("");
    setShowForm(true);
  }

  function openEdit(asset: ITAsset) {
    setEditAsset(asset);
    setForm({
      name: asset.name,
      type: asset.type,
      serialNumber: asset.serialNumber || "",
      assignedTo: asset.assignedTo || "",
      department: asset.department,
      status: asset.status,
      purchaseCost: asset.purchaseCost || 0,
      warrantyExpiry: asset.warrantyExpiry || "",
    });
    setRepairNote("");
    setRepairCost(0);
    setFormError("");
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.name.trim()) { setFormError("Asset name is required"); return; }
    if (!form.warrantyExpiry) { setFormError("Expiry / warranty date is required"); return; }
    if (form.status === "under_repair" && !repairNote.trim()) {
      setFormError("Repair note is required when status is Under Repair"); return;
    }
    setSaving(true); setFormError("");
    try {
      const now = new Date().toISOString();
      if (editAsset) {
        await updateDoc(doc(db, "it_assets", editAsset.id), { ...form, updatedAt: now });
        if (form.status === "under_repair" && repairNote) {
          await createRepairTransaction(editAsset.id, form.name, repairNote, repairCost, form.department);
        }
      } else {
        const ref = await addDoc(collection(db, "it_assets"), { ...form, createdAt: now, updatedAt: now });
        if (form.status === "under_repair" && repairNote) {
          await createRepairTransaction(ref.id, form.name, repairNote, repairCost, form.department);
        }
      }
      setShowForm(false);
    } catch (e: any) {
      setFormError(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  // ─── Delete ────────────────────────────────────────────────────────────────

  async function handleDelete() {
    if (!deleteId) return;
    await deleteDoc(doc(db, "it_assets", deleteId));
    setDeleteId(null);
  }

  // ─── Quick repair log ──────────────────────────────────────────────────────

  async function handleQuickRepair() {
    if (!repairTarget || !repairQuickNote.trim()) return;
    setRepairSaving(true);
    try {
      await updateDoc(doc(db, "it_assets", repairTarget.id), {
        status: "under_repair",
        updatedAt: new Date().toISOString(),
      });
      await createRepairTransaction(
        repairTarget.id, repairTarget.name,
        repairQuickNote, repairQuickCost, repairTarget.department
      );
      setRepairTarget(null);
      setRepairQuickNote("");
      setRepairQuickCost(0);
    } finally {
      setRepairSaving(false);
    }
  }

  // ─── Computed ──────────────────────────────────────────────────────────────

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const in30 = new Date(today); in30.setDate(in30.getDate() + 30);

  const alerts = assets.filter((a) => {
    if (!a.warrantyExpiry) return false;
    const d = new Date(a.warrantyExpiry);
    return d <= in30; // expired OR expiring within 30 days
  });

  const stats = {
    total: assets.length,
    active: assets.filter((a) => a.status === "active").length,
    underRepair: assets.filter((a) => a.status === "under_repair").length,
    retired: assets.filter((a) => a.status === "retired").length,
    value: assets.reduce((s, a) => s + (a.purchaseCost || 0), 0),
  };

  const filtered = assets.filter((a) => {
    if (typeFilter && a.type !== typeFilter) return false;
    if (statusFilter && a.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!`${a.name} ${a.serialNumber} ${a.assignedTo} ${a.department}`.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // ─── UI helpers ───────────────────────────────────────────────────────────

  const statusBadge = (s: AssetStatus) => {
    if (s === "active") return "bg-green-100 text-green-700";
    if (s === "under_repair") return "bg-amber-100 text-amber-700";
    return "bg-gray-100 text-gray-500";
  };
  const typeBadge = (t: AssetType) => {
    if (t === "laptop") return "bg-blue-100 text-blue-700";
    if (t === "server") return "bg-violet-100 text-violet-700";
    if (t === "license") return "bg-teal-100 text-teal-700";
    return "bg-indigo-100 text-indigo-700";
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">IT Assets</h1>
          <p className="text-sm text-gray-500">Track hardware, licenses & warranties</p>
        </div>
        <button onClick={openAdd}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          + Add Asset
        </button>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-amber-800 mb-2">
            ⏰ {alerts.length} license / warranty alert{alerts.length > 1 ? "s" : ""}
          </p>
          <div className="space-y-1">
            {alerts.map((a) => {
              const days = daysUntil(a.warrantyExpiry);
              return (
                <p key={a.id} className="text-xs text-amber-700">
                  <strong>{a.name}</strong> —{" "}
                  {days < 0 ? `expired ${Math.abs(days)}d ago` : days === 0 ? "expires today" : `expires in ${days}d`}
                  {" "}({fmtDate(a.warrantyExpiry)})
                </p>
              );
            })}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Total", value: stats.total, color: "text-gray-900" },
          { label: "Active", value: stats.active, color: "text-green-700" },
          { label: "Under Repair", value: stats.underRepair, color: "text-amber-700" },
          { label: "Retired", value: stats.retired, color: "text-gray-400" },
          { label: "Total Value", value: fmtCost(stats.value), color: "text-blue-700" },
        ].map((s) => (
          <div key={s.label} className="bg-gray-50 rounded-xl p-4">
            <p className={`text-2xl font-semibold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-52 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Search name, serial, user..."
          value={search} onChange={(e) => setSearch(e.target.value)}
        />
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Types</option>
          <option value="laptop">Laptop</option>
          <option value="server">Server</option>
          <option value="license">License</option>
          <option value="software">Software</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="under_repair">Under Repair</option>
          <option value="retired">Retired</option>
        </select>
        <span className="text-sm text-gray-400 self-center ml-auto">{filtered.length} result{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["Name", "Type", "Serial #", "Dept", "Assigned To", "Status", "Cost", "Expiry", "Actions"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-16 text-gray-400">No assets found</td></tr>
              ) : filtered.map((a) => {
                const days = a.warrantyExpiry ? daysUntil(a.warrantyExpiry) : null;
                const expiryClass = days === null ? "" : days < 0 ? "text-red-600 font-medium" : days <= 30 ? "text-amber-600 font-medium" : "text-gray-600";
                return (
                  <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{a.name}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeBadge(a.type)}`}>{a.type}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{a.serialNumber || "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{a.department}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{a.assignedTo || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(a.status)}`}>
                        {a.status === "under_repair" ? "Under Repair" : a.status.charAt(0).toUpperCase() + a.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{fmtCost(a.purchaseCost)}</td>
                    <td className={`px-4 py-3 whitespace-nowrap ${expiryClass}`}>
                      {fmtDate(a.warrantyExpiry)}
                      {days !== null && days < 0 && " ⚠"}
                      {days !== null && days >= 0 && days <= 30 && " ⏰"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-3">
                        <button onClick={() => openEdit(a)} className="text-blue-600 hover:text-blue-800 text-xs font-medium">Edit</button>
                        {a.status !== "under_repair" && (
                          <button onClick={() => { setRepairTarget(a); setRepairQuickNote(""); setRepairQuickCost(0); }}
                            className="text-amber-600 hover:text-amber-800 text-xs font-medium">Repair</button>
                        )}
                        <button onClick={() => setDeleteId(a.id)} className="text-red-500 hover:text-red-700 text-xs font-medium">Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Add / Edit Modal ─────────────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-base font-semibold">{editAsset ? "Edit Asset" : "Add IT Asset"}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>
            <div className="px-6 py-5 space-y-4">

              {/* Name */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Asset Name *</label>
                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. MacBook Pro 14-inch" />
              </div>

              {/* Type + Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Type *</label>
                  <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as AssetType })}>
                    <option value="laptop">Laptop</option>
                    <option value="server">Server</option>
                    <option value="license">License</option>
                    <option value="software">Software</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Status *</label>
                  <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as AssetStatus })}>
                    <option value="active">Active</option>
                    <option value="under_repair">Under Repair</option>
                    <option value="retired">Retired</option>
                  </select>
                </div>
              </div>

              {/* Serial (hardware only) */}
              {(form.type === "laptop" || form.type === "server") && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Serial Number</label>
                  <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })}
                    placeholder="SN-XXXX-XXXX" />
                </div>
              )}

              {/* Department + Assigned To */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Department</label>
                  <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
                    {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Assigned To (User ID)</label>
                  <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
                    placeholder="user@company.com" />
                </div>
              </div>

              {/* Cost + Expiry */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Purchase Cost (₹)</label>
                  <input type="number" min="0"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.purchaseCost} onChange={(e) => setForm({ ...form, purchaseCost: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    {form.type === "license" || form.type === "software" ? "License Expiry *" : "Warranty Expiry *"}
                  </label>
                  <input type="date"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.warrantyExpiry} onChange={(e) => setForm({ ...form, warrantyExpiry: e.target.value })} />
                </div>
              </div>

              {/* Repair fields — shown when status = under_repair */}
              {form.status === "under_repair" && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                  <p className="text-xs font-semibold text-amber-800">
                    🔧 An expense/repair transaction will be created automatically
                  </p>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Repair Notes *</label>
                    <textarea rows={3}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={repairNote} onChange={(e) => setRepairNote(e.target.value)}
                      placeholder="Describe the issue..." />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Repair Cost (₹)</label>
                    <input type="number" min="0"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={repairCost} onChange={(e) => setRepairCost(Number(e.target.value))} />
                  </div>
                </div>
              )}

              {formError && (
                <p className="text-red-600 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formError}</p>
              )}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t">
              <button onClick={() => setShowForm(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
                {saving ? "Saving..." : editAsset ? "Update" : "Add Asset"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Quick Repair Modal ───────────────────────────────────────────── */}
      {repairTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h2 className="text-base font-semibold">Log Repair</h2>
                <p className="text-xs text-gray-500 mt-0.5">{repairTarget.name}</p>
              </div>
              <button onClick={() => setRepairTarget(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Status → <strong>Under Repair</strong> + <strong>expense/repair</strong> transaction created automatically
              </p>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Repair Notes *</label>
                <textarea rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={repairQuickNote} onChange={(e) => setRepairQuickNote(e.target.value)}
                  placeholder="Describe the issue..." autoFocus />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Repair Cost (₹)</label>
                <input type="number" min="0"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={repairQuickCost} onChange={(e) => setRepairQuickCost(Number(e.target.value))} />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t">
              <button onClick={() => setRepairTarget(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
              <button onClick={handleQuickRepair} disabled={repairSaving || !repairQuickNote.trim()}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm hover:bg-amber-700 disabled:opacity-50">
                {repairSaving ? "Logging..." : "Log Repair"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm ───────────────────────────────────────────────── */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
            <h3 className="font-semibold text-gray-900 mb-1">Delete asset?</h3>
            <p className="text-sm text-gray-500 mb-5">This cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteId(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
              <button onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}