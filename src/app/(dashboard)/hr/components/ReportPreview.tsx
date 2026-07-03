"use client";

import React, { useState, useEffect, useRef } from "react";

interface ReportPreviewProps {
  data: any;
  onBack: () => void;
}

export default function ReportPreview({ data, onBack }: ReportPreviewProps) {
  const [aiSummary, setAiSummary] = useState<string>("");
  const [loadingAi, setLoadingAi] = useState(false);
  const [aiError, setAiError] = useState(false);
  const fetchingRef = useRef(false);

  useEffect(() => {
    if (data.config.includeAI && !aiSummary && !fetchingRef.current) {
      generateAISummary();
    }
  }, [data.date]); // Regenerate when date changes

  const generateAISummary = async () => {
    try {
      fetchingRef.current = true;
      setLoadingAi(true);
      setAiError(false);
      
      const res = await fetch("/api/ai/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportData: data })
      });
      
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "Failed to generate AI summary");
      
      setAiSummary(resData.summary);
    } catch (err) {
      console.error("AI Error:", err);
      setAiError(true);
      setAiSummary("");
    } finally {
      setLoadingAi(false);
      fetchingRef.current = false;
    }
  };

  // ── Compute Metrics ──
  const totalEmployees = data.users.length;
  // Calculate attendance metrics
  let present = 0;
  let totalHours = 0;
  const attendanceRows = data.users.map((u: any) => {
    // Look for attendance records for this user (attendance docs use userId)
    const userAtt = data.attendance.filter((a: any) => a.uid === u.id || a.userId === u.id);
    // Rough calculation: if there's an attendance doc, count as present
    const isPresent = userAtt.length > 0;
    if (isPresent) present++;
    
    // Check if they submitted live work updates OR a daily sheet
    const hasUpdates = data.workUpdates.some((wu: any) => wu.uid === u.id) || data.dailySheets.some((ds: any) => ds.uid === u.id);
    
    return {
      name: u.name || u.email,
      department: u.department || "Unassigned",
      isPresent,
      hasUpdates,
      status: isPresent ? "Present" : "Absent"
    };
  });

  const absent = totalEmployees - present;
  const updatesSubmitted = attendanceRows.filter((r: any) => r.hasUpdates).length;

  return (
    <div className="max-w-5xl mx-auto">
      {/* Action Bar (Not Printed) */}
      <div className="flex items-center justify-between mb-6 print:hidden">
        <button onClick={onBack} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors">
          &larr; Back to Builder
        </button>
        <button onClick={() => window.print()} className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl shadow-sm transition-colors flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
          Save as PDF
        </button>
      </div>

      {/* ── REPORT CONTENT ── */}
      <div className="bg-white shadow-xl rounded-2xl p-8 print:shadow-none print:p-0 print:w-full">
        
        {/* Section 1: Header */}
        <div className="border-b-2 border-teal-600 pb-6 mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-black text-gray-900 tracking-tight">Daily Workforce Report</h1>
            <p className="text-xl text-teal-700 font-medium mt-1">Office Tracker HR Dashboard</p>
          </div>
          <div className="text-right text-sm text-gray-500 space-y-1">
            <p><strong>Report Date:</strong> {new Date(data.date).toLocaleDateString("en-US", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            <p><strong>Generated:</strong> {new Date().toLocaleString()}</p>
            <p><strong>Department:</strong> {data.department}</p>
          </div>
        </div>

        {/* Section 2: Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 page-break-avoid">
          <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl text-center">
            <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Total Employees</p>
            <p className="text-2xl font-black text-gray-900">{totalEmployees}</p>
          </div>
          <div className="bg-teal-50 border border-teal-100 p-4 rounded-xl text-center">
            <p className="text-teal-700 text-xs font-bold uppercase tracking-wider mb-1">Present</p>
            <p className="text-2xl font-black text-teal-700">{present}</p>
          </div>
          <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl text-center">
            <p className="text-rose-700 text-xs font-bold uppercase tracking-wider mb-1">Absent</p>
            <p className="text-2xl font-black text-rose-700">{absent}</p>
          </div>
          <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl text-center">
            <p className="text-indigo-700 text-xs font-bold uppercase tracking-wider mb-1">Updates Submitted</p>
            <p className="text-2xl font-black text-indigo-700">{updatesSubmitted}</p>
          </div>
        </div>

        {/* Section 3: Attendance Details */}
        {data.config.includeAttendance && (
          <div className="mb-10 page-break-avoid">
            <h2 className="text-xl font-bold text-gray-900 mb-4 border-b border-gray-200 pb-2 flex items-center gap-2">
              <span className="text-teal-600">👥</span> Attendance Details
            </h2>
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-200">
                  <th className="py-2 px-3 font-semibold text-gray-700 rounded-tl-lg">Employee</th>
                  <th className="py-2 px-3 font-semibold text-gray-700">Department</th>
                  <th className="py-2 px-3 font-semibold text-gray-700">Status</th>
                  <th className="py-2 px-3 font-semibold text-gray-700 rounded-tr-lg">Work Update</th>
                </tr>
              </thead>
              <tbody>
                {attendanceRows.map((r: any, i: number) => (
                  <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 px-3 font-medium text-gray-900">{r.name}</td>
                    <td className="py-2 px-3 text-gray-600">{r.department}</td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${r.status === 'Present' ? 'bg-teal-100 text-teal-700' : 'bg-rose-100 text-rose-700'}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      {r.hasUpdates ? <span className="text-teal-600 font-bold">Yes</span> : <span className="text-rose-500 font-bold">No</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Section 4: Work Updates */}
        {data.config.includeWorkUpdates && (
          <div className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4 border-b border-gray-200 pb-2 flex items-center gap-2">
              <span className="text-teal-600">📋</span> Employee Work Updates & Daily Sheets
            </h2>
            {data.workUpdates.length === 0 && data.dailySheets.length === 0 ? (
              <p className="text-gray-500 italic">No work updates logged for this date.</p>
            ) : (
              <div className="space-y-6">
                {/* We map users to show their updates gracefully */}
                {data.users.map((u: any) => {
                  const userUpdates = data.workUpdates.filter((wu: any) => wu.uid === u.id);
                  const userSheets = data.dailySheets.filter((ds: any) => ds.uid === u.id);
                  if (userUpdates.length === 0 && userSheets.length === 0) return null;

                  return (
                    <div key={u.id} className="bg-gray-50 border border-gray-200 rounded-xl p-4 page-break-avoid">
                      <h3 className="font-bold text-gray-900 text-lg mb-2">{u.name || u.email} <span className="text-sm font-normal text-gray-500">({u.department || 'Unassigned'})</span></h3>
                      
                      {userUpdates.length > 0 && (
                        <div className="mb-3">
                          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Live Updates</h4>
                          <div className="space-y-2">
                            {userUpdates.map((wu: any, i: number) => (
                              <div key={i} className="bg-white border border-gray-200 p-3 rounded-lg shadow-sm">
                                <div className="flex justify-between items-start mb-1">
                                  <p className="font-semibold text-sm text-gray-900">{wu.task}</p>
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-gray-100 text-gray-600">{wu.status}</span>
                                </div>
                                <p className="text-xs text-gray-600">{wu.notes}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {userSheets.length > 0 && (
                        <div>
                          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Daily Sheet Log</h4>
                          <div className="space-y-2">
                            {userSheets.map((ds: any, i: number) => (
                              <div key={i}>
                                {ds.tasks?.map((t: any, j: number) => (
                                  <div key={j} className="bg-white border border-gray-200 p-3 rounded-lg shadow-sm mb-2">
                                    <div className="flex justify-between items-start mb-1">
                                      <p className="font-semibold text-sm text-gray-900">[{t.project}] {t.taskTitle}</p>
                                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700">{t.hours} hrs</span>
                                    </div>
                                    <p className="text-xs text-gray-600 line-clamp-2">{t.description}</p>
                                    <div className="mt-2 flex gap-2">
                                      <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-medium">{t.category}</span>
                                      <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-medium">{t.status}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Section 5: Project Progress */}
        {data.config.includeProjectProgress && (
          <div className="mb-10 page-break-avoid">
            <h2 className="text-xl font-bold text-gray-900 mb-4 border-b border-gray-200 pb-2 flex items-center gap-2">
              <span className="text-teal-600">📈</span> Project-Wise Progress
            </h2>
            <p className="text-sm text-gray-600 mb-4">Aggregated from daily sheets.</p>
            {/* Compute project progress */}
            {(() => {
              const projMap: Record<string, { count: number, hours: number }> = {};
              data.dailySheets.forEach((ds: any) => {
                ds.tasks?.forEach((t: any) => {
                  if (!projMap[t.project]) projMap[t.project] = { count: 0, hours: 0 };
                  projMap[t.project].count++;
                  projMap[t.project].hours += (t.hours || 0);
                });
              });
              const projects = Object.entries(projMap);
              if (projects.length === 0) return <p className="text-sm text-gray-500 italic">No project data for this date.</p>;
              
              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {projects.map(([pName, pData], i) => (
                    <div key={i} className="border border-gray-200 p-4 rounded-xl bg-gray-50">
                      <h3 className="font-bold text-gray-900 text-lg mb-2">{pName}</h3>
                      <div className="flex justify-between text-sm text-gray-700">
                        <span>Tasks Worked On: <strong>{pData.count}</strong></span>
                        <span>Total Hours: <strong>{pData.hours}h</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {/* Section 6: Needs Attention */}
        {data.config.includeNeedsAttention && (
          <div className="mb-10 page-break-avoid">
            <h2 className="text-xl font-bold text-rose-600 mb-4 border-b border-rose-200 pb-2 flex items-center gap-2">
              <span>⚠️</span> Needs Attention
            </h2>
            <ul className="list-disc pl-5 space-y-2 text-sm text-gray-700">
              {attendanceRows.filter((r: any) => !r.hasUpdates && r.isPresent).map((r: any, i: number) => (
                <li key={i}><strong>{r.name}</strong> ({r.department}) was present but submitted no work updates.</li>
              ))}
              {attendanceRows.filter((r: any) => !r.isPresent).map((r: any, i: number) => (
                <li key={i}><strong>{r.name}</strong> ({r.department}) did not check in.</li>
              ))}
            </ul>
          </div>
        )}

        {/* Section 7: Leaves */}
        {data.config.includeLeaveDetails && (
          <div className="mb-10 page-break-avoid">
            <h2 className="text-xl font-bold text-gray-900 mb-4 border-b border-gray-200 pb-2 flex items-center gap-2">
              <span className="text-teal-600">🏖️</span> Leave & Availability
            </h2>
            {data.leaves.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No approved leaves for this date.</p>
            ) : (
              <ul className="list-disc pl-5 space-y-2 text-sm text-gray-700">
                {data.leaves.map((l: any, i: number) => (
                  <li key={i}><strong>{l.userName}</strong> is on {l.leaveType} leave. <em>(Reason: {l.reason})</em></li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Section 9: AI Summary */}
        {data.config.includeAI && (
          <div className="mb-10 bg-indigo-50 border border-indigo-100 p-6 rounded-xl page-break-avoid">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-indigo-900 flex items-center gap-2">
                <span>✨</span> AI-Generated Daily Summary
              </h2>
              {aiError && !loadingAi && (
                <button onClick={generateAISummary} className="px-3 py-1 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 text-xs font-bold rounded-md transition-colors print:hidden">
                  Retry
                </button>
              )}
            </div>
            {loadingAi ? (
              <p className="text-sm text-indigo-600 animate-pulse font-medium">Generating AI daily summary...</p>
            ) : aiError ? (
              <p className="text-sm text-rose-600">Failed to generate AI summary. Please try again.</p>
            ) : (
              <p className="text-sm text-indigo-800 leading-relaxed whitespace-pre-wrap">{aiSummary}</p>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-16 pt-6 border-t border-gray-200 text-center text-xs text-gray-400 pb-6 print:pb-0">
          <p>Confidential — Internal Use Only</p>
          <p>Generated by Office Tracker</p>
        </div>

      </div>

      <style jsx global>{`
        @media print {
          body { background: white !important; }
          /* Hide sidebar and top nav */
          aside, header, nav, .lg\\:hidden { display: none !important; }
          main { margin: 0 !important; padding: 0 !important; overflow: visible !important; }
          /* Ensure our report takes full width */
          .max-w-5xl { max-width: 100% !important; }
          /* Avoid page breaks inside important containers */
          .page-break-avoid { page-break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}
