import Link from "next/link";
import type { PolicyDocument } from "@/content/policies";

const statusLabel: Record<PolicyDocument["status"], string> = {
  published: "Available",
  "available-on-request": "Available on request",
  "not-yet-available": "Not yet available",
};

const statusClass: Record<PolicyDocument["status"], string> = {
  published: "bg-accent-soft text-accent",
  "available-on-request": "bg-slate-100 text-slate-700",
  "not-yet-available": "bg-slate-100 text-slate-500",
};

export function DocumentList({ documents }: { documents: PolicyDocument[] }) {
  return (
    <ul className="divide-y divide-slate-200 border-y border-slate-200">
      {documents.map((doc) => (
        <li
          key={doc.id}
          className="flex flex-col gap-3 py-5 sm:flex-row sm:items-start sm:justify-between"
        >
          <div className="max-w-2xl">
            <h3 className="text-lg text-navy-900">{doc.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              {doc.description}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
            <span
              className={`rounded px-2.5 py-1 text-xs font-semibold ${statusClass[doc.status]}`}
            >
              {statusLabel[doc.status]}
            </span>
            {doc.status === "published" && doc.href ? (
              <Link
                href={doc.href}
                className="text-sm font-semibold text-accent hover:text-accent-hover"
              >
                View document
              </Link>
            ) : null}
            {doc.status === "available-on-request" ? (
              <Link
                href="/contact?enquiryType=Public-sector%20procurement"
                className="text-sm font-semibold text-navy-900 hover:text-accent"
              >
                Request via contact
              </Link>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
