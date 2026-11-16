export type RelatedService = {
  slug: string;
  distinction: string;
};

export type Service = {
  slug: string;
  title: string;
  shortTitle: string;
  /** One sentence for catalogue cards. Not the detail-page introduction. */
  cardText: string;
  /** What the service is, and what it is not. Used as the detail-page introduction. */
  introduction: string;
  covers: string[];
  challenges: string[];
  exampleDeliverables: string[];
  engagement: string;
  securityNotes: string;
  related: RelatedService[];
};

export const serviceGroups: Array<{ title: string; slugs: string[] }> = [
  {
    title: "Software and Web Development",
    slugs: ["software-development", "wordpress-web"],
  },
  {
    title: "Cloud, Infrastructure and DevOps",
    slugs: ["cloud-aws-devops"],
  },
  {
    title: "AI, Data and Automation",
    slugs: ["ai-solutions", "data-engineering"],
  },
  {
    title: "Quality Engineering and Testing",
    slugs: ["qa-test-automation"],
  },
  {
    title: "Cybersecurity",
    slugs: ["cybersecurity"],
  },
  {
    title: "Managed IT Services",
    slugs: ["managed-services"],
  },
];

export const services: Service[] = [
  {
    slug: "cloud-aws-devops",
    title: "Cloud, AWS and DevOps",
    shortTitle: "Cloud & DevOps",
    cardText:
      "Cloud environments, deployment automation and migration, with a practical focus on AWS.",
    introduction:
      "This service covers environment design, automation, migration and operational baselines. A data platform, a security review, or a standing support contract has its own service.",
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
      "Current state, constraints and acceptance criteria are agreed first, including which environments are in scope. Cost optimisation here means a review of the agreed environment, not a published saving.",
    securityNotes:
      "Access, logging, environment separation and change control are agreed for each engagement. Controls are scoped to the contract and data classification—not presented as a blanket certification claim.",
    related: [
      {
        slug: "data-engineering",
        distinction:
          "Pipelines, validation and reporting foundations, rather than the cloud environment itself.",
      },
      {
        slug: "cybersecurity",
        distinction:
          "Security review, remediation and secure configuration support, rather than building the environment.",
      },
      {
        slug: "managed-services",
        distinction:
          "Support defined in a contract after go-live, rather than the implementation work.",
      },
    ],
  },
  {
    slug: "software-development",
    title: "Software and application development",
    shortTitle: "Software development",
    cardText:
      "Custom web applications, APIs and business software, scoped around requirements and acceptance criteria.",
    introduction:
      "This service is for custom applications, APIs and modernisation of business software. A corporate or WordPress site is a separate service.",
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
      "Scope and assumptions are agreed before build. Demonstration, testing and handover follow what was agreed for that piece of work, not one pattern for every project.",
    securityNotes:
      "Secure development practices, dependency management and access controls are applied proportionately to the system and data involved.",
    related: [
      {
        slug: "wordpress-web",
        distinction:
          "Corporate and content-managed sites, rather than bespoke business applications.",
      },
      {
        slug: "ai-solutions",
        distinction:
          "An assistive feature with evaluation and human review, rather than the application as a whole.",
      },
      {
        slug: "qa-test-automation",
        distinction:
          "Test strategy and release evidence, rather than building the software.",
      },
    ],
  },
  {
    slug: "ai-solutions",
    title: "AI and intelligent solutions",
    shortTitle: "AI solutions",
    cardText:
      "Assistive features and workflow support, scoped with evaluation, testing and human oversight.",
    introduction:
      "We scope an assistive feature with evaluation and human review. We do not publish an AI product or a deployment record on this page.",
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
      "An implementation of an AI-assisted feature scoped to the agreed requirements",
      "Evaluation criteria and test evidence",
      "Operating guidance for human oversight",
    ],
    engagement:
      "Use-case fitness, data constraints and risk are agreed first. Work passes the evaluation gates set for that requirement. Nothing on this page is an unverified product claim.",
    securityNotes:
      "Data handling, model or service providers, logging and human review requirements are agreed contractually. We do not claim proprietary AI products or production deployments unless verified.",
    related: [
      {
        slug: "software-development",
        distinction:
          "The application or API as a whole, rather than one assistive feature.",
      },
      {
        slug: "data-engineering",
        distinction:
          "Pipelines and reporting foundations, rather than an assistive workflow.",
      },
    ],
  },
  {
    slug: "qa-test-automation",
    title: "QA and test automation",
    shortTitle: "QA & test automation",
    cardText:
      "Test strategy, functional and API testing, and evidence for an agreed release.",
    introduction:
      "This service is the test strategy and the evidence around a release. Building the application is scoped under software development.",
    covers: [
      "Test strategy and planning",
      "Functional and regression testing",
      "API testing",
      "Automated test suites",
      "CI-integrated testing",
      "Defect reporting and agreed test reports",
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
      "Defect reports and agreed test reports",
      "Regression packs for release readiness",
    ],
    engagement:
      "Test scope follows the risk and acceptance criteria of that release. The mix of manual and automated checks is agreed for the release model. Reports describe what was tested. They are not a performance claim.",
    securityNotes:
      "Test data handling, environment access and evidence retention follow the project's data-protection and security requirements.",
    related: [
      {
        slug: "software-development",
        distinction:
          "Building and changing the application, rather than the test evidence around it.",
      },
      {
        slug: "cloud-aws-devops",
        distinction:
          "Environments and deployment automation, rather than the test strategy.",
      },
    ],
  },
  {
    slug: "wordpress-web",
    title: "WordPress and web development",
    shortTitle: "WordPress & web",
    cardText:
      "Corporate and content-managed websites, including accessibility, performance and handover.",
    introduction:
      "This service is for content-managed corporate sites. It is not the route for a bespoke business application.",
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
      "Audience, content model and governance are confirmed first. The site is then delivered against the acceptance checks agreed for that build.",
    securityNotes:
      "Plugin hygiene, access roles, updates and backup expectations are defined in the engagement. No certification marks or client logos are used without permission.",
    related: [
      {
        slug: "software-development",
        distinction:
          "Custom applications and APIs, rather than a content-managed site.",
      },
      {
        slug: "managed-services",
        distinction:
          "Contracted support for an application or cloud environment, rather than maintenance agreed as part of a web build.",
      },
    ],
  },
  {
    slug: "data-engineering",
    title: "Data engineering and analytics",
    shortTitle: "Data engineering",
    cardText:
      "Data pipelines, validation and reporting foundations for an agreed set of sources.",
    introduction:
      "Pipelines, validation and reporting foundations sit here. This page does not describe a completed data warehouse or a measured improvement in data quality. The cloud environment is scoped separately when it is a distinct piece of work.",
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
      "Sources, targets, quality rules and ownership are defined before build. Validation evidence and handover notes belong to the scoped work. They are not a claim that data quality has already improved.",
    securityNotes:
      "Data classification, access, retention and any cross-border processing considerations are agreed before implementation proceeds.",
    related: [
      {
        slug: "cloud-aws-devops",
        distinction:
          "The cloud environment, automation and migration, rather than the pipelines.",
      },
      {
        slug: "ai-solutions",
        distinction:
          "An assistive feature with human review, rather than data movement and reporting.",
      },
    ],
  },
  {
    slug: "cybersecurity",
    title: "Cybersecurity and secure engineering",
    shortTitle: "Secure engineering",
    cardText:
      "Secure development, configuration review and remediation support. Not a certification or penetration-testing offer.",
    introduction:
      "This is review, remediation and secure-configuration support. It is not a second cloud-build offer, and it is not a certification or regulated penetration test.",
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
      "Scope follows the system, the sensitivity of the data and the obligations in that contract. Findings and remediation are reported to the client for the agreed scope.",
    securityNotes:
      "These are service capabilities, not claims of certification, accredited testing, CHECK status or regulated penetration-testing authority. Penetration testing and regulated services are not advertised unless the company is qualified, insured and authorised to provide them.",
    related: [
      {
        slug: "cloud-aws-devops",
        distinction:
          "Designing and implementing the cloud environment, rather than reviewing or remediating it.",
      },
      {
        slug: "software-development",
        distinction:
          "Building the application, rather than a security review of it.",
      },
    ],
  },
  {
    slug: "managed-services",
    title: "IT managed services and support",
    shortTitle: "Managed IT support",
    cardText:
      "Application and cloud support only where a contract defines hours, access, exclusions and reporting.",
    introduction:
      "Support is defined in the contract for that system. This page does not publish a rate card or a response-time promise.",
    covers: [
      "Application and cloud support",
      "Monitoring and incident coordination",
      "Maintenance and patching support",
      "Service reporting",
      "Support arrangements defined by the contract for that system",
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
      "Service reports covering what the contract asks to be reported",
    ],
    engagement:
      "Hours, access, exclusions and reporting are written into the contract before support starts. Response times are not published on this page.",
    securityNotes:
      "Access to production systems, privileged actions and notification duties are controlled according to the agreed support contract.",
    related: [
      {
        slug: "cloud-aws-devops",
        distinction:
          "Designing, automating or migrating an environment, rather than supporting it under contract.",
      },
      {
        slug: "software-development",
        distinction:
          "Building or changing an application, rather than supporting it after go-live.",
      },
      {
        slug: "wordpress-web",
        distinction:
          "A corporate site delivered as a web engagement, rather than a standing support contract.",
      },
    ],
  },
];

export function getServiceBySlug(slug: string): Service | undefined {
  return services.find((service) => service.slug === slug);
}

export function getAllServiceSlugs(): string[] {
  return services.map((service) => service.slug);
}

export function getRelatedServices(service: Service): Array<{
  slug: string;
  title: string;
  distinction: string;
}> {
  return service.related.flatMap((item) => {
    const related = getServiceBySlug(item.slug);
    return related
      ? [
          {
            slug: related.slug,
            title: related.title,
            distinction: item.distinction,
          },
        ]
      : [];
  });
}
