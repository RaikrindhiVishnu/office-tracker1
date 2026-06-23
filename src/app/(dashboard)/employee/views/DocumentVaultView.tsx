"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface EmployeeDoc {
  id: string;
  name: string;
  type: string;
  url: string;
  createdAt: any;
  versions?: { url: string; createdAt: any; name: string }[];
}

import DocumentEditor from "./DocumentEditor";

export default function DocumentVaultView() {
  const { user, userData } = useAuth();
  const [tab, setTab] = useState<"documents" | "tax" | "idcard" | "live">("documents");
  const [docs, setDocs] = useState<EmployeeDoc[]>([]);
  const [taxDocs, setTaxDocs] = useState<EmployeeDoc[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsubDocs = onSnapshot(query(collection(db, "employeeDocs"), where("employeeId", "==", user.uid), where("category", "==", "general")), snap => {
      setDocs(snap.docs.map(d => ({ id: d.id, ...d.data() } as EmployeeDoc)));
    });
    const unsubTax = onSnapshot(query(collection(db, "employeeDocs"), where("employeeId", "==", user.uid), where("category", "==", "tax")), snap => {
      setTaxDocs(snap.docs.map(d => ({ id: d.id, ...d.data() } as EmployeeDoc)));
    });
    return () => { unsubDocs(); unsubTax(); };
  }, [user]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, category: "general" | "tax") => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    
    setUploading(true);
    try {
      const mockUrl = URL.createObjectURL(file);
      await addDoc(collection(db, "employeeDocs"), {
        employeeId: user.uid,
        name: file.name,
        type: file.type,
        url: mockUrl,
        category,
        createdAt: serverTimestamp(),
        versions: []
      });
    } finally {
      setUploading(false);
    }
  };

  const handleUpdateVersion = async (e: React.ChangeEvent<HTMLInputElement>, docToUpdate: EmployeeDoc) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const mockUrl = URL.createObjectURL(file);
      const oldVersion = {
        url: docToUpdate.url,
        createdAt: docToUpdate.createdAt,
        name: docToUpdate.name
      };

      await updateDoc(doc(db, "employeeDocs", docToUpdate.id), {
        url: mockUrl,
        name: file.name,
        type: file.type,
        createdAt: serverTimestamp(),
        versions: [...(docToUpdate.versions || []), oldVersion]
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this document?")) {
      await deleteDoc(doc(db, "employeeDocs", id));
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Documents Vault</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your personal, tax, and company documents securely.</p>
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        {(["documents", "live", "tax", "idcard"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-5 py-2.5 text-sm font-bold border-b-2 transition ${tab === t ? "border-blue-600 text-blue-700 bg-blue-50/50" : "border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50"}`}>
            {t === "documents" ? "My Documents" : t === "live" ? "Live Docs" : t === "tax" ? "Tax (Form 16)" : "ID Card"}
          </button>
        ))}
      </div>

      {tab === "idcard" && (
        <div className="flex flex-col items-center justify-center p-8">
          <div id="id-card" className="w-[300px] bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200 relative">
            <div className="h-24 bg-gradient-to-r from-blue-600 to-indigo-600 absolute top-0 left-0 right-0"></div>
            <div className="relative pt-12 pb-6 px-6 flex flex-col items-center text-center">
              <div className="w-24 h-24 bg-white rounded-full p-1 shadow-lg mb-4 z-10">
                <img src={(userData as any)?.profilePhoto || "https://img.icons8.com/bubbles/100/user-male.png"} alt="Profile" className="w-full h-full rounded-full object-cover" />
              </div>
              <h2 className="text-xl font-black text-gray-900 leading-tight">{(userData as any)?.name || user?.email}</h2>
              <p className="text-sm font-bold text-blue-600 mb-1">{(userData as any)?.designation || "Employee"}</p>
              <p className="text-xs text-gray-500 font-medium mb-6">{(userData as any)?.department || "Department"}</p>
              
              <div className="w-full bg-gray-50 rounded-xl p-3 text-left space-y-2 border border-gray-100">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500 font-semibold">EMP ID</span>
                  <span className="font-bold text-gray-900">{(userData as any)?.employeeId || "TBA"}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500 font-semibold">BLOOD</span>
                  <span className="font-bold text-red-600">{(userData as any)?.bloodGroup || "O+"}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500 font-semibold">DOB</span>
                  <span className="font-bold text-gray-900">{(userData as any)?.dateOfBirth || "--"}</span>
                </div>
              </div>
            </div>
            <div className="bg-gray-900 text-white text-[10px] text-center py-2 font-semibold">
              OFFICE TRACKER INC.
            </div>
          </div>
          <button className="mt-8 px-6 py-2.5 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700 transition" onClick={() => window.print()}>
            🖨️ Print ID Card
          </button>
        </div>
      )}

      {(tab === "documents" || tab === "tax") && (
        <div className="space-y-4">
          <div className="flex justify-end mb-4">
            <label className={`px-4 py-2 bg-blue-600 text-white font-bold rounded-xl shadow cursor-pointer hover:bg-blue-700 transition ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
              {uploading ? "Uploading..." : "+ Upload Document"}
              <input type="file" className="hidden" onChange={(e) => handleUpload(e, tab === "tax" ? "tax" : "general")} />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {(tab === "documents" ? docs : taxDocs).length === 0 ? (
              <div className="col-span-full py-12 text-center text-gray-400 bg-gray-50 rounded-2xl border border-dashed border-gray-300">
                <p className="text-3xl mb-2">📄</p>
                <p className="font-semibold text-sm">No documents uploaded yet.</p>
              </div>
            ) : (
              (tab === "documents" ? docs : taxDocs).map(doc => (
                <div key={doc.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between group hover:border-blue-300 transition">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center shrink-0">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{doc.name}</p>
                      <p className="text-[10px] text-gray-400 font-semibold">{new Date(doc.createdAt?.toDate?.() || Date.now()).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity items-center">
                    {doc.versions && doc.versions.length > 0 && (
                      <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded mr-1">v{doc.versions.length + 1}</span>
                    )}
                    <label className="p-1.5 text-green-600 hover:bg-green-50 rounded-md cursor-pointer" title="Upload New Version">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                      <input type="file" className="hidden" onChange={(e) => handleUpdateVersion(e, doc)} />
                    </label>
                    <a href={doc.url} target="_blank" download className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md" title="Download">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    </a>
                    <button onClick={() => handleDelete(doc.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-md">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
      
      {tab === "live" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-1">
          <DocumentEditor />
        </div>
      )}
    </div>
  );
}
