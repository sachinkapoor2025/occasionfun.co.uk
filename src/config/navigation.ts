export const companyNav = [
  { href: "/about", label: "About OccasionFun" },
  { href: "/technology-partner", label: "Technology Partner — DGV Group" },
  { href: "/how-we-work", label: "How We Work" },
] as const;

export const mainNav = [
  { href: "/", label: "Home" },
  { href: "/services", label: "Services" },
  { href: "/our-work", label: "Our Work" },
  { href: "/public-sector", label: "Public Sector" },
  { href: "/trust", label: "Trust" },
  { href: "/contact", label: "Contact" },
] as const;

/** Pages that sit directly in the header, in order, with Company inserted after Our Work. */
export const mainNavBeforeCompany = mainNav.slice(0, 3);
export const mainNavAfterCompany = mainNav.slice(3);

export const footerExplore = [
  { href: "/services", label: "Services" },
  { href: "/our-work", label: "Our Work" },
  { href: "/public-sector", label: "Public Sector" },
  { href: "/trust", label: "Trust" },
  { href: "/contact", label: "Contact" },
] as const;

export const legalNav = [
  { href: "/privacy", label: "Privacy" },
  { href: "/cookies", label: "Cookies" },
  { href: "/terms", label: "Terms" },
  { href: "/policies", label: "Policies" },
] as const;
