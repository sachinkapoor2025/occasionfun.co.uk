const steps = [
  {
    title: "Client engagement",
    text: "Requirements, constraints and success criteria are clarified with the client.",
  },
  {
    title: "OCCASIONFUN LTD coordination",
    text: "Account ownership, delivery coordination and contractual responsibility sit with OCCASIONFUN LTD.",
  },
  {
    title: "Agreed engineering delivery",
    text: "Delivery resources are allocated for the engagement, including DGV where disclosed and approved.",
  },
  {
    title: "Assurance and handover",
    text: "Quality assurance, reporting, acceptance and documentation complete the delivery cycle.",
  },
];

export function DeliveryModelDiagram() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
      <ol className="grid gap-6 md:grid-cols-4">
        {steps.map((step, index) => (
          <li key={step.title} className="relative">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-navy-900 text-sm font-semibold text-white">
                {index + 1}
              </span>
              {index < steps.length - 1 ? (
                <span
                  aria-hidden="true"
                  className="hidden h-px flex-1 bg-slate-200 md:block"
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
        Illustrative delivery model only. This diagram does not represent a
        certified management system.
      </p>
    </div>
  );
}
