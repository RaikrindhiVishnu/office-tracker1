// src/components/notifications/NotificationAnalytics.tsx

"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Shield, TrendingUp, CheckCircle, AlertTriangle, Smartphone, Percent } from "lucide-react";

interface Stats {
  activeDevicesCount: number;
  totalNotifications: number;
  openRate: number;
  deliveryRate: number;
  successCount: number;
  failureCount: number;
}

interface ChartItem {
  name: string;
  value: number;
}

const COLORS = ["#4F46E5", "#06B6D4", "#F59E0B", "#10B981", "#EF4444", "#8B5CF6", "#64748B"];

export const NotificationAnalytics: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [categoryData, setCategoryData] = useState<ChartItem[]>([]);
  const [priorityData, setPriorityData] = useState<ChartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      if (!user) return;
      try {
        const idToken = await user.getIdToken();
        const response = await fetch("/api/notifications/analytics", {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        });

        if (!response.ok) {
          throw new Error("Failed to load analytics details.");
        }

        const data = await response.json();
        setStats(data.stats);
        setCategoryData(data.charts.categoryData);
        setPriorityData(data.charts.priorityData);
      } catch (err: any) {
        setError(err.message || "An unexpected error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [user]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 bg-white rounded-3xl border border-gray-100 shadow-sm animate-pulse">
        <p className="text-sm text-gray-500 font-medium">Gathering notifications statistics...</p>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="p-8 bg-red-50 text-red-800 rounded-3xl border border-red-200 flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 text-red-600" />
        <div>
          <h4 className="font-bold">Failed to load analytics</h4>
          <p className="text-xs text-red-600/80 mt-1">{error || "Data load error"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1 */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Active Devices</span>
            <h3 className="text-2xl font-extrabold text-gray-950 mt-1">{stats.activeDevicesCount}</h3>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Smartphone className="w-5 h-5" />
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Sent</span>
            <h3 className="text-2xl font-extrabold text-gray-950 mt-1">{stats.totalNotifications}</h3>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Open Rate</span>
            <h3 className="text-2xl font-extrabold text-gray-950 mt-1">{stats.openRate}%</h3>
          </div>
          <div className="p-3 bg-teal-50 text-teal-600 rounded-xl">
            <Percent className="w-5 h-5" />
          </div>
        </div>

        {/* Card 4 */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Delivery Rate</span>
            <h3 className="text-2xl font-extrabold text-gray-950 mt-1">{stats.deliveryRate}%</h3>
          </div>
          <div className="p-3 bg-green-50 text-green-600 rounded-xl">
            <CheckCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Chart Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Category breakdown */}
        <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm flex flex-col h-[380px]">
          <h4 className="text-sm font-bold text-gray-800 mb-6 flex items-center gap-2">
            <Shield className="w-4 h-4 text-indigo-500" />
            Alerts by Category
          </h4>
          <div className="flex-1 w-full min-h-0">
            {categoryData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-gray-400">
                No categorical statistics available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData}>
                  <XAxis dataKey="name" stroke="#94A3B8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: "#0F172A",
                      border: "none",
                      borderRadius: "12px",
                      color: "#FFF",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="value" fill="#4F46E5" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Priority breakdown */}
        <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm flex flex-col h-[380px]">
          <h4 className="text-sm font-bold text-gray-800 mb-6 flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-500" />
            Alerts by Priority
          </h4>
          <div className="flex-1 flex flex-col md:flex-row items-center gap-6 min-h-0">
            {priorityData.length === 0 ? (
              <div className="flex-1 h-full flex items-center justify-center text-xs text-gray-400">
                No priority statistics available
              </div>
            ) : (
              <>
                <div className="flex-1 h-full min-h-0 w-full md:w-auto">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={priorityData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {priorityData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "#0F172A",
                          border: "none",
                          borderRadius: "12px",
                          color: "#FFF",
                          fontSize: "12px",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-col gap-2 shrink-0 md:w-40 w-full px-4 md:px-0">
                  {priorityData.map((item, index) => (
                    <div key={item.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 text-gray-500 font-medium">
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span>{item.name}</span>
                      </div>
                      <span className="font-bold text-gray-900">{item.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
