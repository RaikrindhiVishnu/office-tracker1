"use client";

import React, { useEffect, useState } from "react";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { BrainCircuit, AlertTriangle, TrendingUp, Sparkles, Activity, Search, Frown, Users, CheckCircle, Clock } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import ReactMarkdown from "react-markdown";

interface WorkUpdate {
  id: string;
  uid: string;
  userName: string;
  projectName?: string;
  module?: string;
  ticketType?: string;
  todayTask: string;
  nextTask: string;
  blockers: string;
  status: string;
  productivity: string;
  priority?: string;
  eta?: string;
  completionPercent: number;
  createdAt: any;
}

export default function AIInsightsView() {
  const [updates, setUpdates] = useState<WorkUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [generatingSummary, setGeneratingSummary] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "workUpdates"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setUpdates(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkUpdate)));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const generateSummary = async () => {
    setGeneratingSummary(true);
    try {
      const res = await fetch("/api/ai/summary");
      const data = await res.json();
      if (data.summary) {
        setAiSummary(data.summary);
      } else {
        setAiSummary("Failed to generate summary.");
      }
    } catch (err) {
      console.error(err);
      setAiSummary("Error generating summary.");
    }
    setGeneratingSummary(false);
  };

  const getRecentUpdates = () => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return updates.filter(u => u.createdAt && u.createdAt.toDate() > sevenDaysAgo);
  };

  const recentUpdates = getRecentUpdates();

  // Smart Detection: Blocked, Stressed, Overloaded
  const blockedOrStressed = recentUpdates.filter(u => {
    const hasBlocker = u.blockers && u.blockers.toLowerCase() !== "none" && u.blockers.trim() !== "";
    const isStressed = u.productivity && (u.productivity.toLowerCase() === "stressed" || u.productivity.toLowerCase() === "burnout" || u.productivity.toLowerCase() === "low");
    const isBlocked = u.status && u.status.toLowerCase().includes("block");
    return hasBlocker || isStressed || isBlocked;
  });

  const uniqueAlerts = Array.from(new Map(blockedOrStressed.map(item => [item.uid, item])).values());

  const calculateProductivityScore = () => {
    if (recentUpdates.length === 0) return 0;
    const scores: Record<string, number> = {
      "High": 100, "Good": 90, "Normal": 70, "Low": 40, "Stressed": 20, "Burnout": 10
    };
    const totalScore = recentUpdates.reduce((sum, u) => sum + (scores[u.productivity || "Normal"] || 70), 0);
    return Math.round(totalScore / recentUpdates.length);
  };

  // Prepare data for Recharts (Trailing 7 days)
  const trendData = () => {
    const dataMap: Record<string, { date: string; score: number; count: number }> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      dataMap[dateStr] = { date: dateStr, score: 0, count: 0 };
    }

    recentUpdates.forEach(u => {
      if (!u.createdAt) return;
      const dateStr = u.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (dataMap[dateStr]) {
        const scores: Record<string, number> = { "High": 100, "Good": 90, "Normal": 70, "Low": 40, "Stressed": 20, "Burnout": 10 };
        dataMap[dateStr].score += (scores[u.productivity || "Normal"] || 70);
        dataMap[dateStr].count += 1;
      }
    });

    return Object.values(dataMap).map(d => ({
      date: d.date,
      Productivity: d.count > 0 ? Math.round(d.score / d.count) : 0
    }));
  };

  // Workload data (Bar chart)
  const workloadData = () => {
    const userMap: Record<string, number> = {};
    recentUpdates.forEach(u => {
      userMap[u.userName] = (userMap[u.userName] || 0) + 1;
    });
    return Object.entries(userMap).map(([name, tasks]) => ({ name: name.split(" ")[0], tasks })).sort((a, b) => b.tasks - a.tasks).slice(0, 10);
  };

  if (loading) {
    return (
      <div className="flex-1 p-6 md:p-8 flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <BrainCircuit className="w-10 h-10 text-fuchsia-500 animate-pulse" />
          <p className="text-slate-500 font-medium">AI is analyzing workforce data...</p>
        </div>
      </div>
    );
  }

  const teamScore = calculateProductivityScore();
  const activeEmployees = new Set(recentUpdates.map(u => u.uid)).size;

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50/50">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 bg-fuchsia-100 rounded-xl">
                <BrainCircuit className="w-6 h-6 text-fuchsia-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">AI Workforce Intelligence</h2>
            </div>
            <p className="text-slate-500">Actionable insights generated from team conversations and updates.</p>
          </div>
          <div className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-xl shadow-sm">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-semibold text-slate-700">Powered by Tracker AI</span>
          </div>
        </div>

        {/* Top KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-2 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10"><Activity className="w-16 h-16" /></div>
            <span className="text-sm font-semibold text-slate-500 relative z-10">Productivity Score</span>
            <div className="text-3xl font-black text-slate-900 relative z-10">{teamScore}%</div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 relative z-10">
              <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${teamScore}%` }}></div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-2">
            <span className="text-sm font-semibold text-slate-500 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-500" /> Active Employees
            </span>
            <div className="text-3xl font-black text-slate-900">{activeEmployees}</div>
            <p className="text-xs text-slate-500 mt-1">Submitted updates recently</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-2">
            <span className="text-sm font-semibold text-slate-500 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500" /> Risk Alerts
            </span>
            <div className="text-3xl font-black text-slate-900">{uniqueAlerts.length}</div>
            <p className="text-xs text-slate-500 mt-1">Blockers & stress detected</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-2">
            <span className="text-sm font-semibold text-slate-500 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-500" /> Total Tasks Handled
            </span>
            <div className="text-3xl font-black text-slate-900">{recentUpdates.length}</div>
            <p className="text-xs text-slate-500 mt-1">Extracted in last 7 days</p>
          </div>
        </div>

        {/* AI Daily Summary */}
        <div className="bg-linear-to-r from-[#0b3a5a] to-[#124d77] rounded-3xl p-6 md:p-8 text-white shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
          <div className="relative z-10 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
            <div className="flex-1">
              <h3 className="text-xl font-bold flex items-center gap-2 mb-2">
                <BrainCircuit className="w-6 h-6 text-fuchsia-300" />
                AI Daily Team Summary
              </h3>
              <div className="text-sm text-blue-100/90 leading-relaxed max-w-3xl prose prose-sm prose-invert">
                {generatingSummary ? (
                  <div className="flex items-center gap-3 py-2">
                    <span className="w-2 h-2 bg-fuchsia-400 rounded-full animate-bounce"></span>
                    <span className="w-2 h-2 bg-fuchsia-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-2 h-2 bg-fuchsia-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                    <span className="ml-2">Synthesizing team data...</span>
                  </div>
                ) : aiSummary ? (
                  <ReactMarkdown>{aiSummary}</ReactMarkdown>
                ) : (
                  <p>Click generate to compile today's updates into an executive summary.</p>
                )}
              </div>
            </div>
            <button 
              onClick={generateSummary}
              disabled={generatingSummary}
              className="bg-white text-[#0b3a5a] px-6 py-3 rounded-xl font-bold text-sm shadow-md hover:bg-slate-50 transition-colors disabled:opacity-50 shrink-0"
            >
              {aiSummary ? "Regenerate Summary" : "Generate Summary"}
            </button>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Productivity Trends */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
              Team Productivity Trend
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData()}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} domain={[0, 100]} />
                  <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Line type="monotone" dataKey="Productivity" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981', strokeWidth: 0 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Workload Distribution */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-500" />
              Employee Workload (Extracted Tasks)
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={workloadData()}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                  <RechartsTooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="tasks" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Smart Detection Alerts */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-500" />
            Needs Attention (AI Smart Alerts)
          </h3>
          
          {uniqueAlerts.length === 0 ? (
            <div className="bg-white rounded-2xl border border-emerald-100 p-8 flex flex-col items-center justify-center text-center shadow-sm">
              <div className="bg-emerald-50 p-4 rounded-full mb-4">
                <Sparkles className="w-8 h-8 text-emerald-500" />
              </div>
              <h4 className="text-lg font-bold text-slate-800 mb-1">Clear Skies</h4>
              <p className="text-slate-500 max-w-sm">No employees are currently showing signs of being blocked or overly stressed.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {uniqueAlerts.map(alert => (
                <div key={alert.id} className="bg-white rounded-2xl border border-rose-200 shadow-sm overflow-hidden flex flex-col">
                  <div className="bg-rose-50/50 p-4 border-b border-rose-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 font-bold">
                        {alert.userName.charAt(0)}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900">{alert.userName}</h4>
                        <span className="text-xs font-semibold text-rose-600 px-2 py-0.5 rounded-full bg-rose-100">Attention Required</span>
                      </div>
                    </div>
                    <span className="text-xs text-slate-400">
                      {alert.createdAt?.toDate().toLocaleDateString()}
                    </span>
                  </div>
                  <div className="p-5 flex-1 space-y-4">
                    {alert.blockers && alert.blockers.toLowerCase() !== "none" && (
                      <div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> AI Detected Blocker</span>
                        <p className="text-sm text-slate-700 bg-rose-50 p-3 rounded-lg border border-rose-100 font-medium">"{alert.blockers}"</p>
                      </div>
                    )}
                    {alert.productivity && (alert.productivity.toLowerCase() === "stressed" || alert.productivity.toLowerCase() === "burnout") && (
                      <div className="flex items-center gap-2 text-amber-600 bg-amber-50 p-3 rounded-lg border border-amber-100 text-sm font-medium">
                        <Frown className="w-4 h-4" />
                        AI Detected High Stress/Burnout Risk based on chat history.
                      </div>
                    )}
                    <div>
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Task They Are Stuck On</span>
                      <p className="text-sm text-slate-600">{alert.todayTask}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Detailed AI Extractions */}
        <div className="space-y-4 pt-6 border-t border-slate-200">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Search className="w-5 h-5 text-slate-400" />
            Detailed AI Task Extraction
          </h3>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">Employee</th>
                    <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">Project & Module</th>
                    <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Extracted Task</th>
                    <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">Type</th>
                    <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">Status</th>
                    <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">ETA</th>
                    <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {updates.slice(0, 15).map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4 text-sm font-bold text-slate-900 whitespace-nowrap">{u.userName}</td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md w-max">{u.projectName || 'General'}</span>
                          <span className="text-xs text-slate-500">{u.module || '-'}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-700 max-w-[250px]">{u.todayTask}</td>
                      <td className="py-3 px-4">
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${(u.ticketType || '').toLowerCase() === 'bug' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                          {u.ticketType || 'Task'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${(u.status || '').toLowerCase().includes('block') ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {u.status || 'N/A'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs font-medium text-slate-600 whitespace-nowrap flex items-center gap-1">
                        <Clock className="w-3 h-3"/> {u.eta || 'N/A'}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-400 whitespace-nowrap">{u.createdAt?.toDate().toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
