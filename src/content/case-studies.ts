export type CaseStudySection = {
  title: string;
  paragraphs: string[];
};

export type CaseStudy = {
  slug: string;
  name: string;
  summary: string;
  metaDescription: string;
  image: string;
  imageWidth: number;
  imageHeight: number;
  alt: string;
  capabilities: string[];
  sections: CaseStudySection[];
};

const deliveryContribution = [
  "OccasionFun works with Divit Global Ventures (DGV), its technology delivery partner, to deliver digital platforms and software solutions. This project demonstrates the team's capabilities in e-commerce engineering, application development and cloud-based technology delivery.",
  "The companies are separate legal entities under common ownership and work under a signed agreement. This page describes the technology delivered. It does not name a commissioning client, a budget, a date or a commercial result.",
];

export const caseStudies: CaseStudy[] = [
  {
    slug: "usarakhi",
    name: "UsaRakhi",
    summary:
      "A festive gifting e-commerce platform with a product catalogue, search, cart, checkout, payment integrations and an administration area for products, orders and leads.",
    metaDescription:
      "Case study of the UsaRakhi festive gifting platform: catalogue, search, checkout, Stripe and Razorpay, administration, and AWS serverless delivery.",
    image: "/work/usarakhi-website-preview.jpg",
    imageWidth: 1024,
    imageHeight: 682,
    alt: "UsaRakhi homepage preview showing festive gifting products and navigation.",
    capabilities: [
      "Catalogue and checkout",
      "Stripe and Razorpay",
      "Product and order admin",
      "AWS serverless",
    ],
    sections: [
      {
        title: "Project overview",
        paragraphs: [
          "UsaRakhi is a festive gifting e-commerce platform. Shoppers can browse a product catalogue, search for products, add items to a cart and complete checkout. The same application includes administration for products, categories, orders and customer leads.",
          "The public name of the project is UsaRakhi. The engineering work is a Next.js storefront with a TypeScript API on AWS serverless services.",
        ],
      },
      {
        title: "Business context",
        paragraphs: [
          "The platform is built for festive gifting commerce: presenting products, taking an order and recording the customer interest that sits around a purchase. It is a selected technology project delivered through the OccasionFun and DGV working relationship.",
          "This case study describes the implemented software. It does not describe a named client, a sales result or a delivery date.",
        ],
      },
      {
        title: "Project requirements",
        paragraphs: [
          "The application needed a structured catalogue, product search, a shopping cart and checkout, more than one payment route, and a way to capture customer leads. Operators needed to manage products, categories, orders and leads, including product data uploaded from a spreadsheet and product images.",
          "The public site also needed indexable pages, a sitemap, a robots file and product structured data so product pages can be described to search engines.",
        ],
      },
      {
        title: "Solution delivered",
        paragraphs: [
          "The delivered solution is a Next.js 15 storefront in React and TypeScript, with shared validation in Zod, and a serverless API. Shoppers use the catalogue, search, cart and checkout. Operators use the administration area for catalogue, order and lead work.",
          "Payments are integrated with Stripe and Razorpay. Authentication uses AWS Cognito. Application data is stored in DynamoDB and reached through Lambda and API Gateway. Media is stored in S3 and served through CloudFront.",
        ],
      },
      {
        title: "Main features and functionality",
        paragraphs: [
          "The storefront covers the festive gifting catalogue, product categories, product search, the shopping cart and checkout. Customer lead capture sits alongside the purchase path.",
          "Administration covers products, categories, orders and leads. Product operations include CSV product upload and image management. A documented vendor tracking integration is part of the platform, so order progress from a configured vendor can be recorded against the order.",
        ],
      },
      {
        title: "Technical architecture",
        paragraphs: [
          "The web application, a shared TypeScript package and the API are separate parts of one codebase. The storefront calls the API. The API runs as Lambda functions behind API Gateway. DynamoDB holds the commerce records. S3 holds images and CloudFront distributes them.",
          "Cognito handles authentication for the protected administration and account flows. Infrastructure is described as a serverless stack, with the application prepared for static hosting and a separate API.",
        ],
      },
      {
        title: "Technology stack",
        paragraphs: [
          "The storefront uses Next.js 15, React and TypeScript. Shared data shapes use Zod. Payments use Stripe and Razorpay. Identity uses AWS Cognito. Data, compute, API access, file storage and content delivery use DynamoDB, Lambda, API Gateway, S3 and CloudFront.",
        ],
      },
      {
        title: "Integrations and infrastructure",
        paragraphs: [
          "Stripe and Razorpay are both present as payment integrations. The vendor tracking integration is documented in the application so a vendor can post tracking information into the order record.",
          "Infrastructure pieces used by the application are Cognito, DynamoDB, Lambda, API Gateway, S3 and CloudFront. SEO support includes page metadata, a sitemap, a robots file and product structured data.",
        ],
      },
      {
        title: "Project delivery contribution",
        paragraphs: deliveryContribution,
      },
      {
        title: "Capabilities demonstrated",
        paragraphs: [
          "The project shows catalogue engineering, checkout, dual payment integration, lead capture, operational administration, spreadsheet import and image handling. It also shows serverless application design on AWS and the SEO structure of a product catalogue.",
          "Those are engineering and delivery capabilities. They are not a performance claim, a certification or a statement about a particular client's results.",
        ],
      },
    ],
  },
  {
    slug: "blossompot",
    name: "BlossomPot",
    summary:
      "A flower and gifting commerce platform with a country-aware catalogue, cart and checkout, coupons, order management and a vendor application workflow.",
    metaDescription:
      "Case study of the BlossomPot flower and gifting platform: country-aware catalogue, checkout, coupons, vendor approval, and AWS application delivery.",
    image: "/work/blossompot-website-preview.jpg",
    imageWidth: 1024,
    imageHeight: 682,
    alt: "BlossomPot homepage preview showing flower and gifting products.",
    capabilities: [
      "Flower and gift storefront",
      "Country-aware catalogue",
      "Vendor approval workflow",
      "Checkout and admin",
    ],
    sections: [
      {
        title: "Project overview",
        paragraphs: [
          "BlossomPot is a flower and gifting commerce platform. The storefront presents a product catalogue, a cart and checkout. An administration portal covers orders, coupons and vendors.",
          "The public name of the project is BlossomPot. The application is a Next.js storefront with AWS Lambda, DynamoDB and Cognito.",
        ],
      },
      {
        title: "Business context",
        paragraphs: [
          "The platform is built around flower and gifting commerce, including a marketplace-style fulfilment model in which vendors can apply, be approved and serve defined delivery areas. It is a selected technology project delivered through the OccasionFun and DGV working relationship.",
          "Sample products in the application are demonstration data. This case study does not present them as a live customer inventory, and it does not describe a named client or a commercial result.",
        ],
      },
      {
        title: "Project requirements",
        paragraphs: [
          "The application needed a flower and gifting catalogue that can be configured by country, a shopping cart and checkout, order management, coupons, and an administration portal.",
          "It also needed vendor delivery areas and a vendor path from application through to admin approval, so fulfilment can be organised as a marketplace rather than a single warehouse.",
        ],
      },
      {
        title: "Solution delivered",
        paragraphs: [
          "The delivered solution is a Next.js storefront and an admin portal on a serverless API. Catalogue configuration can vary by country. Checkout, orders and coupons are part of the commerce flow. Vendors apply, and an administrator approves them.",
          "Authentication uses Cognito. Application data uses DynamoDB, with Lambda providing the API. SEO audit tooling is included so catalogue pages can be checked for indexable structure.",
        ],
      },
      {
        title: "Main features and functionality",
        paragraphs: [
          "Shoppers use the flower and gifting catalogue, cart and checkout. Operators manage orders and coupons from the admin portal. The catalogue configuration is country-aware, so the product set can be set up for the markets the platform is configured to serve.",
          "Vendors have delivery areas. A vendor application is reviewed in the admin approval workflow before that vendor is part of fulfilment. The documented commerce scope is flowers and gifting.",
        ],
      },
      {
        title: "Technical architecture",
        paragraphs: [
          "The storefront and admin experience sit on Next.js. Commerce operations go through Lambda functions and DynamoDB tables for the BlossomPot application. Cognito protects account and administration access.",
          "The fulfilment model is marketplace-style: catalogue, vendor coverage and approval are separate parts of the same platform, rather than a single-merchant stock list.",
        ],
      },
      {
        title: "Technology stack",
        paragraphs: [
          "The storefront uses Next.js. Identity uses AWS Cognito. Data and API compute use DynamoDB and Lambda. SEO audit tooling is part of the project so metadata and indexable routes can be reviewed.",
        ],
      },
      {
        title: "Integrations and infrastructure",
        paragraphs: [
          "The platform integrates catalogue configuration, checkout, coupons, order management and the vendor approval workflow in one application. Vendor delivery areas define where an approved vendor can fulfil.",
          "Infrastructure used by the application includes Lambda, DynamoDB and Cognito. SEO audit tooling supports review of the public catalogue. This case study does not treat demonstration products as customer stock.",
        ],
      },
      {
        title: "Project delivery contribution",
        paragraphs: deliveryContribution,
      },
      {
        title: "Capabilities demonstrated",
        paragraphs: [
          "The project shows storefront engineering, country-aware catalogue configuration, coupon and order administration, and a vendor onboarding workflow with delivery areas. It also shows serverless application delivery and SEO review tooling.",
          "Those are engineering capabilities for a flower and gifting platform. They are not a claim about trading performance or a completed certification.",
        ],
      },
    ],
  },
  {
    slug: "spicycenter",
    name: "SpicyCenter",
    summary:
      "An Indian spice retail and wholesale platform with a structured catalogue, retail and bulk purchasing, a configurable shipping engine and spice knowledge modules.",
    metaDescription:
      "Case study of the SpicyCenter spice retail and wholesale platform: structured catalogue, bulk purchasing, shipping configuration, and AWS delivery.",
    image: "/work/spicycenter-website-preview.jpg",
    imageWidth: 1024,
    imageHeight: 682,
    alt: "SpicyCenter homepage preview showing an Indian spice retail catalogue.",
    capabilities: [
      "Structured spice catalogue",
      "Retail and bulk purchasing",
      "Configurable shipping",
      "Knowledge and wholesale",
    ],
    sections: [
      {
        title: "Project overview",
        paragraphs: [
          "SpicyCenter is an Indian spice retail and wholesale platform. The storefront presents a structured spice catalogue with varieties, grades and pack forms. Shoppers can buy through retail and bulk paths, with a cart and checkout.",
          "The public name of the project is SpicyCenter. The application uses Next.js 15, TypeScript, Zod and AWS services.",
        ],
      },
      {
        title: "Business context",
        paragraphs: [
          "The platform is built for spice commerce that has to describe a product more carefully than a generic shop: variety, grade, pack form, and whether the purchase is retail or bulk. Knowledge content sits beside the catalogue so a buyer can read about spices as well as order them.",
          "It is a selected technology project delivered through the OccasionFun and DGV working relationship. This page does not publish a product count, a customer list or a trading result.",
        ],
      },
      {
        title: "Project requirements",
        paragraphs: [
          "The application needed a structured spice catalogue, retail and bulk purchasing, cart and checkout, administration, and a shipping engine that can be configured rather than hard-coded to one rule.",
          "It also needed spice knowledge and encyclopaedia modules, wholesale functionality, a Spice Finder, and data structures for UK and EU food information. Those structures are part of the software. Filling them for a live food business is a separate operational task.",
        ],
      },
      {
        title: "Solution delivered",
        paragraphs: [
          "The delivered solution is a Next.js 15 and TypeScript storefront with Zod schemas for the spice model. Administration covers the catalogue and commerce records. Shipping rules are configurable. Wholesale and the Spice Finder are modules in the same platform.",
          "Data is stored in DynamoDB. API compute uses Lambda. Product images are processed through an S3 pipeline. SEO tooling supports the public catalogue pages.",
        ],
      },
      {
        title: "Main features and functionality",
        paragraphs: [
          "The catalogue records spice varieties, grades and pack forms, and supports both retail packs and bulk purchasing. Cart and checkout cover the purchase path. Administration covers catalogue and order operations.",
          "Spice knowledge and encyclopaedia modules, wholesale functionality and the Spice Finder extend the storefront beyond a flat product list. The shipping engine is configurable so delivery rules can be set for the business using the platform.",
        ],
      },
      {
        title: "Technical architecture",
        paragraphs: [
          "Shared Zod schemas define the spice, pack and purchasing model used by the storefront and the API. Lambda functions serve the commerce operations. DynamoDB stores the records. S3 is used in the image-processing pipeline.",
          "Food-information fields for UK and EU labelling exist in the data model. The software provides the structure. It does not, by itself, mean a food-law filing is complete or that market-price data has been populated.",
        ],
      },
      {
        title: "Technology stack",
        paragraphs: [
          "The application uses Next.js 15, TypeScript and Zod. AWS services in the delivery include DynamoDB, Lambda and S3 image processing. SEO tooling is part of the project for catalogue pages.",
        ],
      },
      {
        title: "Integrations and infrastructure",
        paragraphs: [
          "The shipping engine, wholesale module, Spice Finder and knowledge modules are integrated in the commerce application. Image processing uses S3. Catalogue and order data use DynamoDB through Lambda.",
          "UK and EU food-information fields are data structures in the product model. This case study does not claim that food-law compliance has been completed, or that market prices have been loaded.",
        ],
      },
      {
        title: "Project delivery contribution",
        paragraphs: deliveryContribution,
      },
      {
        title: "Capabilities demonstrated",
        paragraphs: [
          "The project shows domain modelling for a specialist catalogue, retail and bulk commerce, configurable shipping, content modules and serverless delivery with an image pipeline. It also shows how regulatory data can be structured in the product record without treating that structure as a finished compliance file.",
          "Those are engineering capabilities. They are not a published stock count or a claim about market data.",
        ],
      },
    ],
  },
  {
    slug: "halloweenready",
    name: "HalloweenReady",
    summary:
      "A seasonal e-commerce storefront with a product catalogue, cart and checkout, administration, reviews, wishlist, and Halloween guide content.",
    metaDescription:
      "Case study of the HalloweenReady seasonal storefront: catalogue, checkout, admin, reviews, wishlist, image optimisation, and AWS serverless delivery.",
    image: "/work/halloweenready-website-preview.jpg",
    imageWidth: 1024,
    imageHeight: 682,
    alt: "HalloweenReady homepage preview showing a seasonal product storefront.",
    capabilities: [
      "Seasonal storefront",
      "Cart and checkout",
      "Admin and orders",
      "Image optimisation",
    ],
    sections: [
      {
        title: "Project overview",
        paragraphs: [
          "HalloweenReady is a seasonal e-commerce storefront. Shoppers browse a product catalogue and categories, open product pages, use a cart and complete checkout. The application also includes administration, reviews, a wishlist, a blog and Halloween guide routes.",
          "The public name of the project is HalloweenReady. The storefront uses Next.js 15 and TypeScript, with AWS serverless services for data, compute, storage and authentication.",
        ],
      },
      {
        title: "Business context",
        paragraphs: [
          "The platform is built for a seasonal retail catalogue: products, merchandising content and the order path a shopper needs during a short selling season. Country and city configuration, plus shipping functionality, support how the store can be set up for the places it serves.",
          "It is a selected technology project delivered through the OccasionFun and DGV working relationship. This page does not name a client or a trading result.",
        ],
      },
      {
        title: "Project requirements",
        paragraphs: [
          "The application needed a product catalogue and categories, product pages, a shopping cart, checkout, administration and order management. It also needed country and city configuration, shipping functionality, reviews and a wishlist.",
          "Editorial routes were required for a blog and a Halloween guide. Product images needed optimisation, including WebP variants, and the public site needed generated SEO files.",
        ],
      },
      {
        title: "Solution delivered",
        paragraphs: [
          "The delivered solution is a Next.js 15 storefront with those commerce, content and account routes. Administration covers catalogue and order management. Country, city and shipping configuration are part of the application.",
          "Authentication uses Cognito. Records use DynamoDB. API compute uses Lambda. Images use S3 and CloudFront, with an image pipeline that writes WebP variants. SEO generation covers the public routes.",
        ],
      },
      {
        title: "Main features and functionality",
        paragraphs: [
          "Shoppers use the catalogue, categories, product pages, cart and checkout. They can save products to a wishlist and read reviews. Content routes cover the blog and the Halloween guide.",
          "Operators use the admin area for products and orders. Country and city records and the shipping functionality configure how the store is offered. Product images are optimised, including WebP variants.",
        ],
      },
      {
        title: "Technical architecture",
        paragraphs: [
          "The storefront is a Next.js application with route groups for the shop, account, content and administration. Commerce data is stored in DynamoDB and served through Lambda. Media is stored in S3 and delivered through CloudFront.",
          "Cognito covers authentication. An image-optimisation function prepares WebP variants for the catalogue. Sitemap and robots generation are part of the web application.",
        ],
      },
      {
        title: "Technology stack",
        paragraphs: [
          "The storefront uses Next.js 15 and TypeScript. AWS services used by this application include DynamoDB, Lambda, S3, CloudFront and Cognito. Image optimisation produces WebP variants. SEO generation is part of the web build.",
        ],
      },
      {
        title: "Integrations and infrastructure",
        paragraphs: [
          "Catalogue, checkout, reviews, wishlist, shipping and the editorial routes are functions of this application. Infrastructure for the storefront is DynamoDB, Lambda, S3, CloudFront and Cognito, with the image pipeline writing optimised variants.",
          "This case study describes the HalloweenReady application itself. It does not add payment or supplier connections that are not part of that application's confirmed scope.",
        ],
      },
      {
        title: "Project delivery contribution",
        paragraphs: deliveryContribution,
      },
      {
        title: "Capabilities demonstrated",
        paragraphs: [
          "The project shows a seasonal storefront, merchandising content, reviews and wishlist, order administration, shipping configuration and an image pipeline with WebP output. It also shows serverless delivery and SEO generation.",
          "Those are engineering capabilities. They are not a claim about seasonal sales performance.",
        ],
      },
    ],
  },
];

export function getAllCaseStudySlugs(): string[] {
  return caseStudies.map((study) => study.slug);
}

export function getCaseStudy(slug: string): CaseStudy | undefined {
  return caseStudies.find((study) => study.slug === slug);
}
