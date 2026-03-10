"use client";

import { useState } from "react";
import { useToast } from "./Toast";

// ─── Types ───

interface InvoiceItem {
  id: string;
  description: string;
  qty: string;
  unitPrice: string;
  amount: string;
}

interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  // Bill To
  clientName: string;
  clientTaxId: string;
  clientAddress: string;
  clientCity: string;
  clientCountry: string;
  clientEmail: string;
  // Items
  items: InvoiceItem[];
  currency: string;
  notes: string;
}

const uid = () => crypto.randomUUID();

const emptyItem = (): InvoiceItem => ({
  id: uid(),
  description: "",
  qty: "1",
  unitPrice: "",
  amount: "",
});

// ─── Logo loader ───

async function loadLogoBase64(): Promise<string | null> {
  try {
    const resp = await fetch("/LogoCruznegra.svg");
    const svgText = await resp.text();
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 120;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const img = new Image();
    const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    return new Promise((resolve) => {
      img.onload = () => {
        ctx.drawImage(img, 0, 0, 600, 120);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    });
  } catch {
    return null;
  }
}

// ─── PDF Generation ───

async function generateInvoicePDF(data: InvoiceData, addToast: (type: "success" | "error" | "info", msg: string) => void) {
  const jsPDF = (await import("jspdf")).default;
  const autoTableModule = await import("jspdf-autotable");
  const autoTable = autoTableModule.default;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const logoBase64 = await loadLogoBase64();

  const PW = doc.internal.pageSize.getWidth();
  const M = 15;
  const CW = PW - M * 2;

  const BLACK = [10, 10, 10] as const;
  const GRAY = [100, 100, 100] as const;
  const LIGHT_GRAY = [220, 220, 220] as const;
  const WHITE = [255, 255, 255] as const;

  const setColor = (c: readonly number[]) => doc.setTextColor(c[0], c[1], c[2]);

  let y = 15;

  // ─── Header: Logo + INVOICE title ───
  if (logoBase64) {
    doc.addImage(logoBase64, "PNG", M, y, 52, 10);
  } else {
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    setColor(BLACK);
    doc.text("CruzNegraDev LLC", M, y + 7);
  }

  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  setColor(BLACK);
  doc.text("INVOICE", PW - M, y + 8, { align: "right" });

  y = 32;

  // ─── Invoice meta (right side) ───
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  setColor(GRAY);
  const metaX = PW - M;
  doc.text(`Invoice Number: ${data.invoiceNumber}`, metaX, y, { align: "right" });
  y += 5;
  doc.text(`Invoice Date: ${data.invoiceDate}`, metaX, y, { align: "right" });
  y += 5;
  doc.text(`Due Date: ${data.dueDate}`, metaX, y, { align: "right" });

  y = 32;

  // ─── From / Bill To ───
  // FROM
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  setColor(GRAY);
  doc.text("From", M, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  setColor(BLACK);
  const fromLines = [
    "CruzNegraDev LLC",
    "1007 North Orange Street",
    "4th Floor, STE 229",
    "Wilmington, DE 19801",
    "United States",
    "EIN: 36-5126220",
  ];
  for (const line of fromLines) {
    doc.text(line, M, y);
    y += 4.5;
  }

  y += 4;

  // BILL TO
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  setColor(GRAY);
  doc.text("Bill To", M, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  setColor(BLACK);
  const billToLines = [
    data.clientName,
    data.clientTaxId ? `Tax ID: ${data.clientTaxId}` : "",
    data.clientAddress,
    data.clientCity,
    data.clientCountry,
    data.clientEmail,
  ].filter(Boolean);
  for (const line of billToLines) {
    doc.text(line, M, y);
    y += 4.5;
  }

  y += 8;

  // ─── Items table ───
  const tableHead = [["Description", "Qty", "Unit Price", "Amount"]];
  const tableBody = data.items
    .filter((i) => i.description.trim())
    .map((i) => [i.description, i.qty, formatMoney(i.unitPrice), formatMoney(i.amount)]);

  autoTable(doc, {
    startY: y,
    head: tableHead,
    body: tableBody,
    margin: { left: M, right: M },
    styles: {
      fontSize: 9,
      cellPadding: { top: 3, right: 4, bottom: 3, left: 4 },
      lineColor: [...LIGHT_GRAY],
      lineWidth: 0.3,
      textColor: [...BLACK],
      font: "helvetica",
    },
    headStyles: {
      fillColor: [...BLACK],
      textColor: [...WHITE],
      fontSize: 9,
      fontStyle: "bold",
    },
    bodyStyles: {
      fillColor: [...WHITE],
    },
    columnStyles: {
      0: { cellWidth: 90, halign: "left" },
      1: { cellWidth: 20, halign: "center" },
      2: { cellWidth: 35, halign: "right" },
      3: { cellWidth: 35, halign: "right" },
    },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  // ─── Total ───
  const total = data.items.reduce((sum, i) => sum + parseFloat(i.amount || "0"), 0);
  const totalStr = `${data.currency} ${total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  doc.setDrawColor(BLACK[0], BLACK[1], BLACK[2]);
  doc.setLineWidth(0.5);
  doc.line(PW - M - 80, y, PW - M, y);
  y += 6;

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  setColor(BLACK);
  doc.text("Total Amount Due", PW - M - 80, y);
  doc.text(totalStr, PW - M, y, { align: "right" });

  // ─── Notes ───
  if (data.notes.trim()) {
    y += 14;
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    setColor(GRAY);
    doc.text("Notes", M, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    setColor(BLACK);
    const noteLines = doc.splitTextToSize(data.notes, CW);
    doc.text(noteLines, M, y);
  }

  // ─── Footer ───
  const PH = doc.internal.pageSize.getHeight();
  doc.setFontSize(7.5);
  setColor(GRAY);
  doc.setFont("helvetica", "normal");
  doc.text(
    "CruzNegraDev LLC · 1007 N Orange St, 4th Floor, STE 229, Wilmington, DE 19801 · admin@cruznegradev.com",
    PW / 2,
    PH - 10,
    { align: "center" }
  );

  const fileName = `Invoice_${data.invoiceNumber.replace(/\s+/g, "_") || "draft"}.pdf`;
  doc.save(fileName);
  addToast("success", "Invoice generado");
}

function formatMoney(val: string): string {
  if (!val) return "";
  const num = parseFloat(val.replace(/,/g, ""));
  if (isNaN(num)) return val;
  return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── Component ───

export default function InvoiceTab() {
  const { addToast } = useToast();
  const [generating, setGenerating] = useState(false);
  const today = new Date().toISOString().split("T")[0];

  const [data, setData] = useState<InvoiceData>({
    invoiceNumber: "",
    invoiceDate: today,
    dueDate: "Due upon receipt",
    clientName: "",
    clientTaxId: "",
    clientAddress: "",
    clientCity: "",
    clientCountry: "",
    clientEmail: "",
    items: [emptyItem()],
    currency: "USD",
    notes: "",
  });

  const updateField = <K extends keyof InvoiceData>(key: K, val: InvoiceData[K]) =>
    setData((p) => ({ ...p, [key]: val }));

  const updateItem = (id: string, field: keyof InvoiceItem, val: string) => {
    setData((p) => ({
      ...p,
      items: p.items.map((i) => {
        if (i.id !== id) return i;
        const updated = { ...i, [field]: val };
        // Auto-calc amount
        if (field === "qty" || field === "unitPrice") {
          const qty = parseFloat(updated.qty || "0");
          const price = parseFloat(updated.unitPrice.replace(/,/g, "") || "0");
          if (!isNaN(qty) && !isNaN(price)) {
            updated.amount = (qty * price).toFixed(2);
          }
        }
        return updated;
      }),
    }));
  };

  const addItem = () => setData((p) => ({ ...p, items: [...p.items, emptyItem()] }));
  const removeItem = (id: string) => {
    if (data.items.length <= 1) return;
    setData((p) => ({ ...p, items: p.items.filter((i) => i.id !== id) }));
  };

  const total = data.items.reduce((sum, i) => sum + parseFloat(i.amount || "0"), 0);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await generateInvoicePDF(data, addToast);
    } catch (err) {
      console.error("Invoice PDF error:", err);
      addToast("error", "Error al generar el invoice");
    } finally {
      setGenerating(false);
    }
  };

  const canGenerate = data.clientName.trim() && data.items.some((i) => i.description.trim());

  // ─── Paste parser ───
  const [pasteText, setPasteText] = useState("");
  const [showPaste, setShowPaste] = useState(false);

  const parsePaste = () => {
    if (!pasteText.trim()) return;
    const lines = pasteText.split("\n").map((l) => l.trim()).filter(Boolean);

    // Try to extract fields from pasted text
    let name = "";
    let taxId = "";
    let email = "";
    let address = "";
    let city = "";
    let country = "";

    for (const line of lines) {
      if (line.match(/tax\s*id|ein|nif|cuit|rfc|rut|cnpj/i)) {
        taxId = line.replace(/^.*?:\s*/i, "").trim();
      } else if (line.match(/@/)) {
        email = line.trim();
      } else if (!name && !line.match(/^(from|bill\s*to|invoice|date|due)/i)) {
        name = line;
      } else if (name && !address && !line.match(/@/) && !line.match(/tax|ein|nif/i)) {
        address = line;
      } else if (address && !city && !line.match(/@/) && !line.match(/tax|ein|nif/i)) {
        city = line;
      } else if (city && !country && !line.match(/@/) && !line.match(/tax|ein|nif/i)) {
        country = line;
      }
    }

    setData((p) => ({
      ...p,
      clientName: name || p.clientName,
      clientTaxId: taxId || p.clientTaxId,
      clientEmail: email || p.clientEmail,
      clientAddress: address || p.clientAddress,
      clientCity: city || p.clientCity,
      clientCountry: country || p.clientCountry,
    }));
    setShowPaste(false);
    setPasteText("");
    addToast("success", "Datos del cliente importados");
  };

  const labelClass = "text-xs text-text-secondary mb-1 block";
  const inputClass = "input-premium w-full text-sm";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-text-primary tracking-tight">Invoice</h2>
          <p className="text-sm text-text-muted mt-1">
            Genera invoices profesionales en PDF
          </p>
        </div>
        <button
          onClick={() => setShowPaste(!showPaste)}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
            showPaste
              ? "bg-brand-mint text-text-dark"
              : "bg-brand-mint/15 text-brand-mint hover:bg-brand-mint/25"
          }`}
        >
          {showPaste ? "Cerrar" : "Pegar datos cliente"}
        </button>
      </div>

      {/* Paste panel */}
      {showPaste && (
        <div className="glass-card p-6" style={{ borderColor: "rgba(0,245,160,0.2)" }}>
          <p className="text-xs font-semibold text-brand-mint mb-2 uppercase tracking-wider">
            Importar datos del cliente
          </p>
          <p className="text-xs text-text-muted mb-3">
            Pega los datos del cliente (nombre, direccion, tax ID, email) y se van a completar automaticamente.
          </p>
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={"Nombre de la empresa\nTax ID: XXXX\nDireccion\nCiudad, Estado\nPais\nemail@ejemplo.com"}
            rows={6}
            className="input-premium w-full text-sm resize-y mb-3"
          />
          <div className="flex justify-end">
            <button
              onClick={parsePaste}
              disabled={!pasteText.trim()}
              className="px-5 py-2 bg-brand-mint hover:bg-brand-mint-dark disabled:bg-surface-border disabled:text-text-muted text-text-dark font-semibold rounded-lg transition-colors text-sm"
            >
              Importar
            </button>
          </div>
        </div>
      )}

      {/* Invoice info */}
      <div className="glass-card p-6">
        <p className="text-xs font-semibold text-brand-mint mb-4 uppercase tracking-wider">
          Datos del Invoice
        </p>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Invoice Number</label>
            <input className={inputClass} value={data.invoiceNumber} onChange={(e) => updateField("invoiceNumber", e.target.value)} placeholder="CN-2026-0001" />
          </div>
          <div>
            <label className={labelClass}>Invoice Date</label>
            <input className={inputClass} type="date" value={data.invoiceDate} onChange={(e) => updateField("invoiceDate", e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Due Date</label>
            <input className={inputClass} value={data.dueDate} onChange={(e) => updateField("dueDate", e.target.value)} placeholder="Due upon receipt" />
          </div>
        </div>
      </div>

      {/* Bill To */}
      <div className="glass-card p-6">
        <p className="text-xs font-semibold text-brand-mint mb-4 uppercase tracking-wider">
          Bill To
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Company / Client Name</label>
            <input className={inputClass} value={data.clientName} onChange={(e) => updateField("clientName", e.target.value)} placeholder="Acme Corp" />
          </div>
          <div>
            <label className={labelClass}>Tax ID / EIN</label>
            <input className={inputClass} value={data.clientTaxId} onChange={(e) => updateField("clientTaxId", e.target.value)} placeholder="ESB13843677" />
          </div>
          <div>
            <label className={labelClass}>Address</label>
            <input className={inputClass} value={data.clientAddress} onChange={(e) => updateField("clientAddress", e.target.value)} placeholder="123 Main Street" />
          </div>
          <div>
            <label className={labelClass}>City / State</label>
            <input className={inputClass} value={data.clientCity} onChange={(e) => updateField("clientCity", e.target.value)} placeholder="New York, NY 10001" />
          </div>
          <div>
            <label className={labelClass}>Country</label>
            <input className={inputClass} value={data.clientCountry} onChange={(e) => updateField("clientCountry", e.target.value)} placeholder="United States" />
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input className={inputClass} value={data.clientEmail} onChange={(e) => updateField("clientEmail", e.target.value)} placeholder="billing@acme.com" />
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-semibold text-brand-mint uppercase tracking-wider">
            Items
          </p>
          <div className="flex items-center gap-3">
            <label className="text-xs text-text-muted">Currency</label>
            <select
              value={data.currency}
              onChange={(e) => updateField("currency", e.target.value)}
              className="input-premium text-sm px-3 py-1"
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="ARS">ARS</option>
              <option value="BRL">BRL</option>
              <option value="GBP">GBP</option>
            </select>
          </div>
        </div>

        {/* Header */}
        <div className="grid grid-cols-[1fr_60px_100px_100px_32px] gap-2 mb-2">
          <span className="text-[10px] text-text-muted uppercase">Description</span>
          <span className="text-[10px] text-text-muted uppercase text-center">Qty</span>
          <span className="text-[10px] text-text-muted uppercase text-right">Unit Price</span>
          <span className="text-[10px] text-text-muted uppercase text-right">Amount</span>
          <span />
        </div>

        {data.items.map((item) => (
          <div key={item.id} className="grid grid-cols-[1fr_60px_100px_100px_32px] gap-2 mb-2">
            <input
              className={inputClass}
              value={item.description}
              onChange={(e) => updateItem(item.id, "description", e.target.value)}
              placeholder="Professional development services"
            />
            <input
              className={`${inputClass} text-center`}
              value={item.qty}
              onChange={(e) => updateItem(item.id, "qty", e.target.value)}
            />
            <input
              className={`${inputClass} text-right`}
              value={item.unitPrice}
              onChange={(e) => updateItem(item.id, "unitPrice", e.target.value)}
              placeholder="0.00"
            />
            <input
              className={`${inputClass} text-right`}
              value={item.amount}
              onChange={(e) => updateItem(item.id, "amount", e.target.value)}
              placeholder="0.00"
              readOnly
            />
            <button
              onClick={() => removeItem(item.id)}
              className="text-text-muted hover:text-red-400 transition-colors flex items-center justify-center"
              title="Eliminar"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        ))}

        <button
          onClick={addItem}
          className="text-xs text-brand-mint hover:text-brand-mint-dark transition-colors mt-2"
        >
          + Agregar item
        </button>

        {/* Total */}
        <div className="flex justify-end mt-4 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="text-right">
            <span className="text-xs text-text-muted mr-4">Total Amount Due</span>
            <span className="text-lg font-bold text-text-primary">
              {data.currency} {total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="glass-card p-6">
        <p className="text-xs font-semibold text-brand-mint mb-4 uppercase tracking-wider">
          Notes
        </p>
        <textarea
          value={data.notes}
          onChange={(e) => updateField("notes", e.target.value)}
          className="input-premium w-full text-sm resize-y"
          rows={3}
          placeholder="Payment terms, bank details, etc."
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => {
            setData({
              invoiceNumber: "",
              invoiceDate: today,
              dueDate: "Due upon receipt",
              clientName: "",
              clientTaxId: "",
              clientAddress: "",
              clientCity: "",
              clientCountry: "",
              clientEmail: "",
              items: [emptyItem()],
              currency: "USD",
              notes: "",
            });
          }}
          className="text-xs text-text-muted hover:text-text-secondary transition-colors"
        >
          Limpiar formulario
        </button>
        <button
          onClick={handleGenerate}
          disabled={!canGenerate || generating}
          className="px-6 py-2.5 bg-brand-mint hover:bg-brand-mint-dark disabled:bg-surface-border disabled:text-text-muted text-text-dark font-semibold rounded-lg transition-colors"
        >
          {generating ? "Generando..." : "Descargar Invoice PDF"}
        </button>
      </div>
    </div>
  );
}
