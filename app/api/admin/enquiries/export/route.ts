import { guardAdmin, serverError } from "@/lib/admin-api";
import { enquiryStore } from "@/lib/enquiries/store";

const cell = (v: unknown) => {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // stop spreadsheet formula injection
  return `"${s.replace(/"/g, '""')}"`;
};

/** All enquiries as CSV (opens in Excel / Google Sheets). */
export async function GET(req: Request) {
  const denied = await guardAdmin(req);
  if (denied) return denied;
  try {
    const rows = await enquiryStore().list();
    const header = ["Received", "Status", "Name", "Phone", "Email", "Property", "Message", "Note", "Page"];
    const lines = [header.map(cell).join(",")].concat(
      rows.map((e) => [new Date(e.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }), e.status, e.name, e.phone, e.email, e.propertyTitle, e.message, e.note, e.pageUrl].map(cell).join(","))
    );
    return new Response("﻿" + lines.join("\r\n"), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="nivaas-enquiries-${new Date().toISOString().slice(0, 10)}.csv"`,
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    return serverError(err, "export enquiries");
  }
}
