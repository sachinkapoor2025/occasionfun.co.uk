export type AdminSectionId =
  | "overview"
  | "visitors"
  | "enquiries"
  | "conversations"
  | "notifications"
  | "marketing"
  | "knowledge"
  | "access";

export type AdminSection = {
  id: AdminSectionId;
  label: string;
  summary: string;
};

export const adminSections: readonly AdminSection[] = [
  {
    id: "overview",
    label: "Overview",
    summary: "What this panel can read today.",
  },
  {
    id: "visitors",
    label: "Visitors & Activity",
    summary: "Visitor records and consent.",
  },
  {
    id: "enquiries",
    label: "Enquiries",
    summary: "Contact form leads saved by the contact service.",
  },
  {
    id: "conversations",
    label: "Chatbot Conversations",
    summary: "Chat transcripts.",
  },
  {
    id: "notifications",
    label: "Email Notifications",
    summary: "Delivery results for enquiry notification emails. Recipients stay on the contact service.",
  },
  {
    id: "marketing",
    label: "Email Marketing",
    summary: "Campaigns and suppressions.",
  },
  {
    id: "knowledge",
    label: "Chatbot Knowledge",
    summary: "Information used by the chatbot.",
  },
  {
    id: "access",
    label: "Admin Access, Settings & Audit",
    summary: "Group, settings, and audit history.",
  },
];

export const overviewCounts = [
  {
    label: "Total visitors",
    detail: "No visitor store is connected. This panel does not count visits.",
  },
  {
    label: "Total enquiries",
    detail: "Counted from saved contact form leads when the administration API is available.",
  },
  {
    label: "Pending notifications",
    detail: "Saved leads whose notification email is still pending.",
  },
  {
    label: "Chatbot conversations",
    detail: "No chatbot service is deployed, so there are no conversations to count.",
  },
] as const;
