const steps = [
  {
    title: "Opportunity",
    text: "OccasionFun identifies a technology opportunity and decides whether to pursue it.",
  },
  {
    title: "Business engagement",
    text: "OccasionFun leads the bid, the client relationship and coordination of the project.",
  },
  {
    title: "Technical delivery",
    text: "DGV Group plans, designs, builds, tests and implements the agreed technical work.",
  },
  {
    title: "Handover",
    text: "OccasionFun coordinates acceptance, handover and any support that was agreed.",
  },
];

export function DeliveryModelDiagram() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
      <ol className="grid gap-8 md:grid-cols-2 xl:grid-cols-4">
        {steps.map((step, index) => (
          <li key={step.title} className="relative">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy-900 text-sm font-semibold text-white">
                <span className="sr-only">Summary step </span>
                {index + 1}
              </span>
              {index < steps.length - 1 ? (
                <span
                  aria-hidden="true"
                  className="hidden h-px flex-1 bg-slate-200 xl:block"
                />
              ) : null}
            </div>
            <h3 className="text-lg text-navy-900">{step.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              {step.text}
            </p>
          </li>
        ))}
      </ol>
      <p className="mt-6 text-xs leading-relaxed text-slate-500">
        OccasionFun Ltd and DGV Group are separate companies under common
        ownership. This is a summary of how they connect. It is not the full
        project lifecycle, not a contract, and not a certified management
        system.
      </p>
    </div>
  );
}
