"use client";

type Holiday = {
  title: string;
  date: string;
};

type Props = {
  holidays: Holiday[];
};

export default function HolidaysView({ holidays }: Props) {
  return (
    <div className="bg-white rounded-xl shadow p-6">
      <h2 className="text-xl font-semibold mb-4">Holidays 🎉</h2>

      {holidays.map((h, i) => (
        <div
          key={i}
          className="flex justify-between items-center border-b py-3 hover:bg-gray-50 px-2 rounded transition"
        >
          <span className="font-medium">🎊 {h.title}</span>

          <span className="text-gray-700">
            {new Date(h.date).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </span>
        </div>
      ))}
    </div>
  );
}
