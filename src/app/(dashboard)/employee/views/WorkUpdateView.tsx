"use client";

type Props = {
  task: string;
  setTask: (val: string) => void;
  notes: string;
  setNotes: (val: string) => void;
  handleSaveUpdate: () => void;
  saving: boolean;
  msg: string;
};

export default function WorkUpdateView({
  task,
  setTask,
  notes,
  setNotes,
  handleSaveUpdate,
  saving,
  msg,
}: Props) {
  return (
    <div className="bg-white rounded-xl shadow p-6 space-y-4">
      <h2 className="text-xl font-semibold">Work Update</h2>

      {/* Task Input */}
      <input
        value={task}
        onChange={(e) => setTask(e.target.value)}
        placeholder="What are you working on?"
        className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:border-[#0b3a5a]"
      />

      {/* Notes */}
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes or progress details..."
        rows={4}
        className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:border-[#0b3a5a]"
      />

      {/* Save Button */}
      <button
        onClick={handleSaveUpdate}
        disabled={saving}
        className="px-6 py-3 bg-[#0b3a5a] text-white rounded-xl hover:bg-[#0a3350] disabled:opacity-50 transition font-medium shadow"
      >
        {saving ? "Saving..." : "Save Update"}
      </button>

      {/* Message */}
      {msg && <p className="text-sm text-gray-600">{msg}</p>}
    </div>
  );
}
