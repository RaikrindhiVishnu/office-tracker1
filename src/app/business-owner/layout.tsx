export default function BusinessOwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ minHeight: "100vh", background: "#f5f7fa" }}>
      {/* Header */}
      <div
        style={{
          height: "60px",
          background: "#111827",
          color: "white",
          display: "flex",
          alignItems: "center",
          padding: "0 20px",
          fontWeight: "bold",
          fontSize: "18px",
        }}
      >
        Business Owner Panel
      </div>

      {/* Page Content */}
      <div style={{ padding: "24px" }}>
        {children}
      </div>
    </div>
  );
}