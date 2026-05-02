import { db } from "@/lib/firebase";
import { collection, addDoc, query, where, getDocs, Timestamp } from "firebase/firestore";

export interface InvoiceItem {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

export interface InvoiceData {
  companyId: string;
  clientId: string;
  clientName: string;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  total: number;
  status: "draft" | "sent" | "paid" | "overdue";
  dueDate: string;
  invoiceNumber: string;
}

export class InvoiceEngine {
  static async generateInvoice(companyId: string, data: Partial<InvoiceData>) {
    const subtotal = data.items?.reduce((sum, item) => sum + item.amount, 0) || 0;
    const tax = subtotal * 0.18; // 18% GST default
    const total = subtotal + tax;

    const invoice: Omit<InvoiceData, "id"> = {
      companyId,
      clientId: data.clientId || "general",
      clientName: data.clientName || "Client",
      items: data.items || [],
      subtotal,
      tax,
      total,
      status: data.status || "draft",
      dueDate: data.dueDate || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
    };

    const docRef = await addDoc(collection(db, "companies", companyId, "invoices"), {
      ...invoice,
      createdAt: new Date().toISOString(),
    });

    return { id: docRef.id, ...invoice };
  }

  static async getCompanyInvoices(companyId: string) {
    const q = query(collection(db, "companies", companyId, "invoices"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  static formatCurrency(amount: number) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(amount);
  }
}
