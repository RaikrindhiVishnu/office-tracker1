"use client";

type Leave = {
  id: string;
  leaveType: string;
  fromDate: string;
  toDate: string;
  reason: string;
  status: "Pending" | "Approved" | "Rejected";
};

type Props = {
  leaveRequests: Leave[];
};

export default function LeaveHistoryView({
  leaveRequests,
}: Props) {
  const pending = leaveRequests.filter(l => l.status === "Pending").length;
  const approved = leaveRequests.filter(l => l.status === "Approved").length;
  const rejected = leaveRequests.filter(l => l.status === "Rejected").length;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard color="amber" label="Pending" value={pending} />
        <StatCard color="emerald" label="Approved" value={approved} />
        <StatCard color="rose" label="Rejected" value={rejected} />
      </div>

      {/* Requests */}
      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="text-xl font-semibold mb-4">
          My Leave Requests
        </h2>

        {leaveRequests.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="font-medium">No leave requests yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {leaveRequests.map((leave) => (
              <div
                key={leave.id}
                className="border-2 border-gray-200 rounded-xl p-4 hover:shadow-md transition"
              >
                <div className="flex gap-2 mb-3">
                  <Tag type={leave.leaveType} />
                  <Status status={leave.status} />
                </div>

                <div className="text-sm space-y-1">
                  <p>
                    <strong>From:</strong>{" "}
                    {new Date(leave.fromDate).toLocaleDateString("en-IN")}
                  </p>

                  <p>
                    <strong>To:</strong>{" "}
                    {new Date(leave.toDate).toLocaleDateString("en-IN")}
                  </p>

                  <p>
                    <strong>Reason:</strong> {leave.reason}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Small Components ---------- */

function StatCard({ color, label, value }: any) {
  return (
    <div
      className={`bg-${color}-50 rounded-xl p-6 border-2 border-${color}-200`}
    >
      <p className={`text-2xl font-bold text-${color}-700`}>
        {value}
      </p>
      <p className={`text-sm text-${color}-600 font-medium`}>
        {label}
      </p>
    </div>
  );
}

function Tag({ type }: any) {
  const styles: any = {
    Casual: "bg-blue-100 text-blue-700",
    Sick: "bg-yellow-100 text-yellow-700",
    LOP: "bg-purple-100 text-purple-700",
  };

  return (
    <span className={`px-3 py-1 rounded-lg text-sm font-semibold ${styles[type]}`}>
      {type}
    </span>
  );
}

function Status({ status }: any) {
  const styles: any = {
    Approved: "bg-green-100 text-green-700",
    Rejected: "bg-red-100 text-red-700",
    Pending: "bg-orange-100 text-orange-700",
  };

  return (
    <span className={`px-3 py-1 rounded-lg text-sm font-semibold ${styles[status]}`}>
      {status}
    </span>
  );
}
