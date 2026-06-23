"use client";
import { useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function AdminDocumentOCR() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreview(URL.createObjectURL(file));
      setResult(null);
    }
  };

  const processDocument = () => {
    if (!selectedFile) return;
    setIsProcessing(true);

    // Mock AI OCR extraction delay
    setTimeout(() => {
      // Return a mocked parsed document based on random logic
      const mockResult = {
        documentType: selectedFile.name.toLowerCase().includes("id") ? "ID Card" : "Tax Document (Form 16)",
        extractedText: "OFFICE TRACKER INC.\\nName: John Doe\\nEmployee ID: EMP-90210\\nDOB: 12-MAY-1990",
        parsedFields: {
          Name: "John Doe",
          "Employee ID": "EMP-90210",
          DOB: "12-MAY-1990",
          "Blood Group": "O+",
          Department: "Engineering"
        },
        confidenceScore: 0.94
      };
      setResult(mockResult);
      setIsProcessing(false);
    }, 2500);
  };

  const saveExtractedData = async () => {
    if (!result) return;
    try {
      await addDoc(collection(db, "extractedDocuments"), {
        ...result,
        fileName: selectedFile?.name,
        processedAt: serverTimestamp()
      });
      alert("Extracted data saved to database!");
      setSelectedFile(null);
      setPreview(null);
      setResult(null);
    } catch (err) {
      console.error("Error saving document:", err);
      alert("Failed to save.");
    }
  };

  return (
    <div style={{ padding: "32px", fontFamily: "'Inter', sans-serif", maxWidth: "1000px", margin: "0 auto" }}>
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: 800, color: "#0f172a", display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "32px" }}>🔍</span> Document OCR & Parsing
        </h1>
        <p style={{ color: "#64748b", marginTop: "8px" }}>Upload employee documents (ID cards, Tax Forms, Certificates) to automatically extract data using AI Vision.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "32px" }}>
        {/* Upload Section */}
        <div style={{ background: "#fff", borderRadius: "16px", padding: "24px", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "16px", color: "#334155" }}>Upload Document</h2>
          
          <label style={{
            display: "flex", flexDirection: "column", alignItems: "center", justifyItems: "center",
            padding: "40px 20px", border: "2px dashed #cbd5e1", borderRadius: "12px", background: "#f8fafc",
            cursor: "pointer", transition: "all 0.2s"
          }}
          onMouseEnter={(e) => e.currentTarget.style.borderColor = "#6366f1"}
          onMouseLeave={(e) => e.currentTarget.style.borderColor = "#cbd5e1"}
          >
            <span style={{ fontSize: "32px", marginBottom: "12px" }}>📂</span>
            <span style={{ fontSize: "14px", fontWeight: 600, color: "#6366f1" }}>Click to upload or drag and drop</span>
            <span style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px" }}>PNG, JPG, PDF up to 10MB</span>
            <input type="file" style={{ display: "none" }} accept="image/*,.pdf" onChange={handleFileChange} />
          </label>

          {preview && (
            <div style={{ marginTop: "24px" }}>
              <p style={{ fontSize: "12px", fontWeight: 700, color: "#64748b", marginBottom: "8px" }}>PREVIEW</p>
              <div style={{ border: "1px solid #e2e8f0", borderRadius: "12px", overflow: "hidden", height: "200px", background: "#f1f5f9", display: "flex", alignItems: "center", justifyItems: "center" }}>
                <img src={preview} alt="Preview" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
              </div>
              
              <button 
                onClick={processDocument}
                disabled={isProcessing}
                style={{
                  width: "100%", marginTop: "16px", padding: "12px", borderRadius: "10px", border: "none",
                  background: isProcessing ? "#94a3b8" : "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff",
                  fontSize: "14px", fontWeight: 700, cursor: isProcessing ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "8px"
                }}
              >
                {isProcessing ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    Processing with AI...
                  </>
                ) : "✨ Extract Data"}
              </button>
            </div>
          )}
        </div>

        {/* Results Section */}
        <div style={{ background: "#fff", borderRadius: "16px", padding: "24px", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "16px", color: "#334155" }}>Extraction Results</h2>
          
          {!result ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "300px", color: "#94a3b8" }}>
              <span style={{ fontSize: "40px", opacity: 0.5 }}>🤖</span>
              <p style={{ marginTop: "16px", fontSize: "14px" }}>Upload a document to see AI results</p>
            </div>
          ) : (
            <div className="animate-fade-in">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", padding: "12px", background: "#f8fafc", borderRadius: "8px" }}>
                <div>
                  <span style={{ fontSize: "12px", fontWeight: 700, color: "#64748b" }}>DOC TYPE</span>
                  <div style={{ fontSize: "14px", fontWeight: 800, color: "#0f172a" }}>{result.documentType}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: "12px", fontWeight: 700, color: "#64748b" }}>CONFIDENCE</span>
                  <div style={{ fontSize: "14px", fontWeight: 800, color: "#10b981" }}>{(result.confidenceScore * 100).toFixed(0)}%</div>
                </div>
              </div>

              <div style={{ marginBottom: "20px" }}>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "#64748b", display: "block", marginBottom: "8px" }}>PARSED FIELDS</span>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {Object.entries(result.parsedFields).map(([key, value]) => (
                    <div key={key} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "#f1f5f9", borderRadius: "6px" }}>
                      <span style={{ fontSize: "13px", fontWeight: 600, color: "#475569" }}>{key}</span>
                      <span style={{ fontSize: "13px", fontWeight: 800, color: "#0f172a" }}>{value as string}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: "24px" }}>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "#64748b", display: "block", marginBottom: "8px" }}>RAW TEXT</span>
                <div style={{ padding: "12px", background: "#1e293b", color: "#e2e8f0", borderRadius: "8px", fontSize: "12px", fontFamily: "monospace", whiteSpace: "pre-wrap" }}>
                  {result.extractedText}
                </div>
              </div>

              <button 
                onClick={saveExtractedData}
                style={{
                  width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #e2e8f0",
                  background: "#fff", color: "#0f172a", fontSize: "14px", fontWeight: 700, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
                }}
              >
                💾 Save to Database
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
