"use client";

import { HotTable } from "@handsontable/react";
import Handsontable from "handsontable";

type Props = {
  data: any[];
  onChange: (data: any[]) => void;
};

export default function PayrollExcelSheet({ data, onChange }: Props) {
  return (
    <HotTable
      data={data}
      colHeaders={true}
      rowHeaders={true}
      stretchH="all"
      licenseKey="non-commercial-and-evaluation"
      afterChange={(changes, source) => {
        if (source === "loadData" || !changes) return;
        onChange(data);
      }}
    />
  );
}
