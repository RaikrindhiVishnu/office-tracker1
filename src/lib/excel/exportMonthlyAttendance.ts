import ExcelJS from "exceljs";

type AttendanceType = "P" | "A" | "LOP" | "SL" | "H";

export const exportMonthlyAttendance = async ({
  monthLabel,
  year,
  month,
  users,
  monthlyAttendance,
  daysInMonth,
}: {
  monthLabel: string;
  year: number;
  month: number;
  users: any[];
  monthlyAttendance: Record<string, Record<string, AttendanceType>>;
  daysInMonth: number;
}) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(`${monthLabel} ${year}`);

  /* ===== HEADER ROW ===== */
  const header = [
    "Employee",
    "P",
    "A",
    "LOP",
    "Salary",
    "Net",
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  sheet.addRow(header);

  sheet.getRow(1).font = { bold: true };

  /* ===== DATA ROWS ===== */
  users.forEach((u) => {
    let present = 0;
    let absent = 0;
    let lop = 0;

    const dayValues = Array.from(
      { length: daysInMonth },
      (_, d) => {
        const day = d + 1;
        const dateStr = `${year}-${String(month + 1).padStart(
          2,
          "0"
        )}-${String(day).padStart(2, "0")}`;

        const status =
          monthlyAttendance[u.uid]?.[dateStr] ?? "P";

        if (status === "P") present++;
        if (status === "A") absent++;
        if (status === "LOP") lop++;

        return status;
      }
    );

    const salary = u.salary ?? 0;
    const perDay = salary / daysInMonth;
    const net = Math.round(perDay * present);

    sheet.addRow([
      u.name,
      present,
      absent,
      lop,
      salary,
      net,
      ...dayValues,
    ]);
  });

  /* ===== COLUMN WIDTHS ===== */
  sheet.columns.forEach((col) => {
    col.width = 14;
  });

  /* ===== DOWNLOAD ===== */
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${monthLabel}-${year}-Attendance.xlsx`;
  a.click();
  window.URL.revokeObjectURL(url);
};
