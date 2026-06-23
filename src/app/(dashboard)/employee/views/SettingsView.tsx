"use client";

export default function SettingsView({ user }: any) {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-lg p-5">
        <h2 className="text-xl font-bold mb-3">Settings</h2>
        <div className="space-y-3">
          <div>
            <label className="block font-semibold text-sm mb-1.5">Email Notifications</label>
            <input type="checkbox" className="w-4 h-4" defaultChecked />
          </div>
          <div>
            <label className="block font-semibold text-sm mb-1.5">Theme</label>
            <select className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option>Light</option>
              <option>Dark</option>
            </select>
          </div>
          <button className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm">
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
