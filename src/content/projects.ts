export type DigitalProject = {
  name: string;
  href: string;
  description: string;
  image: string;
  imageWidth: number;
  imageHeight: number;
  alt: string;
};

export const digitalProjects: DigitalProject[] = [
  {
    name: "UsaRakhi.com",
    href: "https://usarakhi.com",
    description: "Online platform for Rakhi, festive gifts and celebrations.",
    image: "/work/usarakhi-website-preview.jpg",
    imageWidth: 1024,
    imageHeight: 682,
    alt: "UsaRakhi.com preview on a laptop and phone, showing a Diwali and Bhai Dooj gifts shop.",
  },
  {
    name: "BlossomPot.com",
    href: "https://blossompot.com",
    description: "Online gifting platform for flowers, cakes, bouquets and occasions.",
    image: "/work/blossompot-website-preview.jpg",
    imageWidth: 1024,
    imageHeight: 682,
    alt: "BlossomPot preview on a laptop and phone, showing a flowers, cakes and gifts shop.",
  },
  {
    name: "HalloweenReady.com",
    href: "https://halloweenready.com",
    description:
      "Online platform for Halloween decorations, costumes and party supplies.",
    image: "/work/halloweenready-website-preview.jpg",
    imageWidth: 1024,
    imageHeight: 682,
    alt: "HalloweenReady.com preview on a laptop and phone, showing Halloween costumes and decorations.",
  },
  {
    name: "SpicyCenter.com",
    href: "https://spicycenter.com",
    description: "Online platform for spices, masalas and food products.",
    image: "/work/spicycenter-website-preview.jpg",
    imageWidth: 1024,
    imageHeight: 682,
    alt: "SpicyCenter.com preview on a laptop and phone, showing an Indian spices shop.",
  },
];
