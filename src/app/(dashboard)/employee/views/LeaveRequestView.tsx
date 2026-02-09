"use client";

type Props = {
  leaveType: string;
  setLeaveType: any;
  fromDate: string;
  setFromDate: any;
  toDate: string;
  setToDate: any;
  leaveReason: string;
  setLeaveReason: any;
  handleSubmitLeave: () => void;
  submitting: boolean;
  leaveMsg: string;
};

export default function LeaveRequestView(props: Props) {
  const {
    leaveType,
    setLeaveType,
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    leaveReason,
    setLeaveReason,
    handleSubmitLeave,
    submitting,
    leaveMsg,
  } = props;

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-xl shadow p-6 space-y-6">
      <h2 className="text-xl font-semibold">Apply for Leave</h2>

      {/* Leave Type */}
      <div className="grid grid-cols-3 gap-3">
        {["Casual", "Sick", "LOP"].map((type) => (
          <button
            key={type}
            onClick={() => setLeaveType(type)}
            className={`px-4 py-2 rounded-xl border-2 ${
              leaveType === type
                ? "bg-[#0b3a5a] text-white border-[#0b3a5a]"
                : "border-gray-300"
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Dates */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="border-2 rounded-lg px-4 py-2"
        />

        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="border-2 rounded-lg px-4 py-2"
        />
      </div>

      {/* Reason */}
      <textarea
        value={leaveReason}
        onChange={(e) => setLeaveReason(e.target.value)}
        rows={4}
        placeholder="Reason..."
        className="border-2 rounded-lg px-4 py-3 w-full"
      />

      {/* Submit */}
      <button
        onClick={handleSubmitLeave}
        disabled={submitting}
        className="w-full px-6 py-3 bg-[#0b3a5a] text-white rounded-xl"
      >
        {submitting ? "Submitting..." : "Submit Request"}
      </button>

      {leaveMsg && (
        <p className="text-sm">{leaveMsg}</p>
      )}
    </div>
  );
}
