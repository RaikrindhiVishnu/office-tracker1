"use client";

import { useState, useEffect } from "react";
import ProtectedRoute from "@/components/common/ProtectedRoute";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp, collection, query, where, getDocs } from "firebase/firestore";

export default function AddUserPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // 🔥 NEW
  const [designation, setDesignation] = useState("Developer");
  const [accountType, setAccountType] = useState("EMPLOYEE");
  const [department, setDepartment] = useState("Frontend Team");
  const [reportingTo, setReportingTo] = useState("");
  const [leads, setLeads] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    async function fetchLeads() {
      try {
        const q = query(collection(db, "users"), where("accountType", "==", "LEAD"));
        const snapshot = await getDocs(q);
        const leadsData = snapshot.docs.map(d => ({ id: d.id, name: d.data().name }));
        setLeads(leadsData);
      } catch (err) {
        console.error("Failed to fetch leads", err);
      }
    }
    fetchLeads();
  }, []);

  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAddUser = async () => {
    if (!name || !email || !password) {
      setMsg("❌ Please fill all fields");
      return;
    }

    try {
      setLoading(true);
      setMsg("");

      const cred = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      await setDoc(doc(db, "users", cred.user.uid), {
        name,
        email,

        designation,        // 🔥 flexible role
        accountType,        // EMPLOYEE | LEAD | ADMIN
        department,
        reportingTo,

        enabled: true,
        createdAt: serverTimestamp(),
      });

      setMsg("✅ User created successfully");

      setName("");
      setEmail("");
      setPassword("");
      setDesignation("Developer");
      setAccountType("EMPLOYEE");
      setDepartment("Frontend Team");
      setReportingTo("");
    } catch (err: any) {
      setMsg(`❌ ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-[#062f33] via-[#0b4a52] to-[#062f33]">

        {/* Background blobs */}
        <div className="absolute top-[-120px] left-[-120px] w-[300px] h-[300px] bg-orange-500/30 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-[-120px] right-[-120px] w-[300px] h-[300px] bg-cyan-400/30 rounded-full blur-3xl animate-pulse delay-1000" />

        {/* Card */}
        <div className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-2xl p-8">
          <h1 className="text-2xl font-bold text-gray-800 mb-1">
            Add User Details
          </h1>
          <p className="text-gray-500 mb-6 text-sm">
            Please enter user details to create access
          </p>

          {msg && <p className="mb-4 text-sm">{msg}</p>}

          <div className="space-y-4">

            {/* Name */}
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-orange-400"
            />

            {/* Email */}
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              type="email"
              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-orange-400"
            />

            {/* Password */}
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Temporary password"
              type="password"
              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-orange-400"
            />

            {/* 🔹 Designation */}
            <select
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-orange-400"
            >
              <option>Developer</option>
              <option>Tester</option>
              <option>UI/UX Designer</option>
              <option>DevOps Engineer</option>
              <option>HR</option>
              <option>Manager</option>
              <option>Intern</option>
              <option>Support</option>
              <option>Data Analyst</option>
            </select> 

            {/* 🔹 Department */}
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-orange-400"
            >
              <option value="Frontend Team">Frontend Team</option>
              <option value="Backend Team">Backend Team</option>
              <option value="Testing Team">Testing Team</option>
              <option value="UI/UX Team">UI/UX Team</option>
              <option value="DevOps Team">DevOps Team</option>
              <option value="Sales">Sales</option>
              <option value="Operations">Operations</option>
              <option value="HR">HR</option>
            </select>

            {/* 🔹 Reporting To (Lead) */}
            <select
              value={reportingTo}
              onChange={(e) => setReportingTo(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-orange-400"
            >
              <option value="">No Reporting Lead (None)</option>
              {leads.map((lead) => (
                <option key={lead.id} value={lead.id}>
                  {lead.name}
                </option>
              ))}
            </select>

            {/* 🔹 Account Type */}
            <select
              value={accountType}
              onChange={(e) => setAccountType(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-orange-400"
            >
              <option value="EMPLOYEE">Employee</option>
              <option value="LEAD">Lead</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>

          <button
            onClick={handleAddUser}
            disabled={loading}
            className="mt-6 w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg disabled:opacity-60"
          >
            {loading ? "Creating user..." : "Add User"}
          </button>
        </div>
      </div>
    </ProtectedRoute>
  );
}
