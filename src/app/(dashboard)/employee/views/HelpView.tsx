"use client";

type Props = {
  querySubject: string;
  setQuerySubject: (v: string) => void;
  queryMessage: string;
  setQueryMessage: (v: string) => void;
  handleSubmitQuery: () => void;
  querySubmitting: boolean;
  queryMsg: string;
};

export default function HelpView({
  querySubject,
  setQuerySubject,
  queryMessage,
  setQueryMessage,
  handleSubmitQuery,
  querySubmitting,
  queryMsg,
}: Props) {
  return (
    <div className="bg-white rounded-xl shadow p-6 space-y-4">
      <h2 className="text-xl font-semibold">Help & Queries</h2>

      <input
        value={querySubject}
        onChange={(e) => setQuerySubject(e.target.value)}
        placeholder="Subject"
        className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:border-[#0b3a5a]"
      />

      <textarea
        value={queryMessage}
        onChange={(e) => setQueryMessage(e.target.value)}
        placeholder="Describe your issue..."
        rows={4}
        className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:border-[#0b3a5a]"
      />

      <button
        onClick={handleSubmitQuery}
        disabled={querySubmitting}
        className="px-6 py-3 bg-[#0b3a5a] text-white rounded-xl hover:bg-[#0a3350] disabled:opacity-50 transition font-medium shadow"
      >
        {querySubmitting ? "Submitting..." : "Submit Query"}
      </button>

      {queryMsg && (
        <p
          className={`text-sm ${
            queryMsg.includes("✅")
              ? "text-green-600"
              : "text-red-600"
          }`}
        >
          {queryMsg}
        </p>
      )}
    </div>
  );
}
