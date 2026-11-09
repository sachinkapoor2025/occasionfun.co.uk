export type Service = {
  slug: string;
  title: string;
  shortTitle: string;
  summary: string;
  covers: string[];
  challenges: string[];
  exampleDeliverables: string[];
  engagement: string;
  securityNotes: string;
};

export const services: Service[] = [
  {
    slug: "cloud-aws-devops",
    title: "Cloud, AWS and DevOps",
    shortTitle: "Cloud & DevOps",
    summary:
      "Architecture, implementation and operational support for cloud environments, with a practical focus on AWS, automation and reliable delivery.",
    covers: [
      "Cloud architecture and implementation",
      "AWS environment setup and configuration",
      "CI/CD and deployment automation",
      "Infrastructure as Code",
      "Monitoring, reliability and cost optimisation",
      "Cloud migration and operational support",
    ],
    challenges: [
      "Environments that are difficult to reproduce or govern",
      "Manual release processes that slow delivery",
      "Unclear ownership of cloud cost, reliability or security baselines",
      "Migrations that need careful sequencing and rollback options",
    ],
    exampleDeliverables: [
      "Target architecture and environment design notes",
      "Infrastructure as Code repositories and pipeline definitions",
      "Deployment runbooks and monitoring baselines",
      "Cost and reliability review recommendations",
    ],
    engagement:
      "We clarify current state, constraints and acceptance criteria, then agree an incremental delivery plan with named responsibilities, environments and review points.",
    securityNotes:
      "Access, logging, environment separation and change control are agreed for each engagement. Controls are scoped to the contract and data classification—not presented as a blanket certification claim.",
  },
  {
    slug: "software-development",
    title: "Software and application development",
    shortTitle: "Software development",
    summary:
      "Web applications, APIs and business software designed around clear requirements, maintainability and measurable acceptance criteria.",
    covers: [
      "Web application development",
      "API and integration development",
      "Application modernisation",
      "Custom business software",
      "Maintenance and enhancement",
    ],
    challenges: [
      "Legacy systems that are costly to change safely",
      "Integrations that break under evolving business processes",
      "Unclear product requirements and acceptance criteria",
      "Need for maintainable code with documented handover",
    ],
    exampleDeliverables: [
      "Requirement and acceptance criteria packs",
      "Application or API implementations with source control",
      "Test evidence and release notes",
      "Technical documentation and handover materials",
    ],
    engagement:
      "Discovery establishes scope and assumptions. Delivery proceeds through agreed iterations with demonstration, testing and client acceptance before handover.",
    securityNotes:
      "Secure development practices, dependency management and access controls are applied proportionately to the system and data involved.",
  },
  {
    slug: "ai-solutions",
    title: "AI and intelligent solutions",
    shortTitle: "AI solutions",
    summary:
      "Practical AI-enabled features and workflow support with human oversight, testing and clear limits on what automation should and should not do.",
    covers: [
      "AI-enabled application development",
      "Workflow automation",
      "Document and knowledge workflows",
      "Data-supported decision tools",
      "Responsible AI design, human oversight and testing",
    ],
    challenges: [
      "Manual processes that could benefit from assisted automation",
      "Document-heavy workflows needing structured extraction or routing",
      "Uncertainty about where AI is appropriate versus risky",
      "Need for evaluation, oversight and fail-safe behaviour",
    ],
    exampleDeliverables: [
      "Feasibility and risk assessment notes",
      "Prototype or production-ready AI-assisted features",
      "Evaluation criteria and test evidence",
      "Operating guidance for human oversight",
    ],
    engagement:
      "We start with use-case fitness, data constraints and risk. Solutions are scoped as capabilities with evaluation gates—not as unverified product claims.",
    securityNotes:
      "Data handling, model or service providers, logging and human review requirements are agreed contractually. We do not claim proprietary AI products or production deployments unless verified.",
  },
  {
    slug: "qa-test-automation",
    title: "QA and test automation",
    shortTitle: "QA & test automation",
    summary:
      "Test strategy, functional coverage and automation that helps teams release with clearer evidence and fewer regressions.",
    covers: [
      "Test strategy and planning",
      "Functional and regression testing",
      "API testing",
      "Automated test suites",
      "CI-integrated testing",
      "Defect reporting and quality metrics",
    ],
    challenges: [
      "Release risk without sufficient regression coverage",
      "Manual testing bottlenecks in CI/CD pipelines",
      "Unclear defect triage and quality reporting",
      "Need for API and end-to-end confidence before go-live",
    ],
    exampleDeliverables: [
      "Test strategy and coverage matrix",
      "Automated suites integrated with CI",
      "Defect reports and quality dashboards",
      "Regression packs for release readiness",
    ],
    engagement:
      "We align test scope to risk and acceptance criteria, then build the right mix of manual and automated checks for the release model.",
    securityNotes:
      "Test data handling, environment access and evidence retention follow the project's data-protection and security requirements.",
  },
  {
    slug: "wordpress-web",
    title: "WordPress and web development",
    shortTitle: "WordPress & web",
    summary:
      "Corporate websites and WordPress solutions with attention to accessibility, performance, maintainability and clear content ownership.",
    covers: [
      "Corporate websites",
      "WordPress development and customisation",
      "Responsive design",
      "Accessibility and performance improvements",
      "Website maintenance and support",
    ],
    challenges: [
      "Outdated sites that are hard to update or insecure to maintain",
      "Inconsistent branding and unclear content structure",
      "Performance or accessibility gaps",
      "Need for ongoing maintenance without vendor lock-in surprises",
    ],
    exampleDeliverables: [
      "Information architecture and page templates",
      "Implemented WordPress or web builds",
      "Accessibility and performance improvement notes",
      "Maintenance and update runbooks",
    ],
    engagement:
      "We confirm audience, content model and governance first, then deliver a responsive site with agreed acceptance checks and handover.",
    securityNotes:
      "Plugin hygiene, access roles, updates and backup expectations are defined in the engagement. No certification marks or client logos are used without permission.",
  },
  {
    slug: "data-engineering",
    title: "Data engineering and analytics",
    shortTitle: "Data engineering",
    summary:
      "Pipelines, transformation and reporting foundations that help organisations trust and use their data more effectively.",
    covers: [
      "Data pipelines and integrations",
      "Data transformation",
      "Data quality and validation",
      "Reporting and dashboard foundations",
      "Cloud data platform implementation",
    ],
    challenges: [
      "Fragmented data sources and brittle integrations",
      "Unreliable reporting due to weak validation",
      "Need for cloud data platforms with clear ownership",
      "Limited visibility into data quality issues",
    ],
    exampleDeliverables: [
      "Pipeline designs and implementation artefacts",
      "Transformation and validation rules",
      "Dashboard or reporting foundations",
      "Data dictionary and operational notes",
    ],
    engagement:
      "We define sources, targets, quality rules and ownership before building. Delivery includes validation evidence and handover documentation.",
    securityNotes:
      "Data classification, access, retention and any cross-border processing considerations are agreed before implementation proceeds.",
  },
  {
    slug: "cybersecurity",
    title: "Cybersecurity and secure engineering",
    shortTitle: "Secure engineering",
    summary:
      "Security-conscious engineering support focused on secure development, configuration and remediation—presented as service capability, not certification.",
    covers: [
      "Secure development practices",
      "Application security considerations",
      "Security reviews and remediation support",
      "Identity and access management implementation support",
      "Security-conscious cloud configuration",
    ],
    challenges: [
      "Applications shipped without proportionate security review",
      "Over-privileged access or weak credential handling",
      "Cloud configurations that drift from secure baselines",
      "Need for remediation support after findings are identified",
    ],
    exampleDeliverables: [
      "Secure design and review notes",
      "Remediation recommendations and tracked fixes",
      "IAM implementation support artefacts",
      "Configuration hardening checklists appropriate to the stack",
    ],
    engagement:
      "Scope is agreed against the system, data sensitivity and contractual obligations. Findings and remediation are handled transparently with the client.",
    securityNotes:
      "These are service capabilities, not claims of certification, accredited testing, CHECK status or regulated penetration-testing authority. Penetration testing and regulated services are not advertised unless the company is qualified, insured and authorised to provide them.",
  },
  {
    slug: "managed-services",
    title: "IT managed services and support",
    shortTitle: "Managed IT support",
    summary:
      "Application and cloud support arrangements defined by contract, with clear escalation, reporting and service expectations.",
    covers: [
      "Application and cloud support",
      "Monitoring and incident coordination",
      "Maintenance and patching support",
      "Service reporting",
      "Support arrangements defined by contract and agreed service levels",
    ],
    challenges: [
      "Systems that need steady operational attention after go-live",
      "Unclear incident ownership and escalation paths",
      "Patching and maintenance falling behind",
      "Need for proportionate reporting without unnecessary noise",
    ],
    exampleDeliverables: [
      "Support model and escalation matrix",
      "Monitoring and incident coordination procedures",
      "Maintenance schedules and change notes",
      "Service reports aligned to agreed metrics",
    ],
    engagement:
      "Support scope, hours, response expectations and exclusions are written into the statement of work or contract before service starts.",
    securityNotes:
      "Access to production systems, privileged actions and notification duties are controlled according to the agreed support contract.",
  },
];

export function getServiceBySlug(slug: string): Service | undefined {
  return services.find((service) => service.slug === slug);
}

export function getAllServiceSlugs(): string[] {
  return services.map((service) => service.slug);
}
