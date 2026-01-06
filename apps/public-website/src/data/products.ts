import { MdBolt, MdWaterDrop, MdPropane } from "react-icons/md";
import type { IconType } from "react-icons";

export interface Product {
  id: string;
  name: string;
  type: "Electricity" | "Water" | "Gas";
  tagline: string;
  description: string;
  features: string[];
  idealFor: string[];
  price: string;
  image: string;
  icon: IconType;
  color: string;
  bgColor: string;
  popular: boolean;
}

export const products: Product[] = [
  {
    id: "integrated",
    name: "Single-Phase Integrated",
    type: "Electricity",
    tagline: "The Compact Home Meter",
    description:
      "An all-in-one solution that combines affordability with reliability. Compact unit with keypad and meter in one. Tenants enter tokens directly on the device.",
    features: [
      "Low cost and affordable",
      "Easy installation",
      "Built-in tamper detection",
      "Direct keypad token entry",
      "LCD display for balance and usage",
    ],
    idealFor: [
      "Small apartments",
      "Single-room units (SQ)",
      "Student hostels",
      "Budget-conscious landlords",
    ],
    price: "4,500",
    image: "/products/integrated-electric.avif",
    icon: MdBolt,
    color: "text-orange-500",
    bgColor: "bg-orange-50 dark:bg-orange-950/20",
    popular: true,
  },
  {
    id: "split",
    name: "Single-Phase Split",
    type: "Electricity",
    tagline: "The Secure Split Meter",
    description:
      "Maximum security for landlords. The measurement unit stays locked in your electrical cabinet, while the tenant gets a wireless keypad (CIU) for convenience. Prevents bypass fraud effectively.",
    features: [
      "Anti-tamper design (meter locked in DB board)",
      "Separate Customer Interface Unit (CIU)",
      "PLC/RF communication between units",
      "Convenient for tenants",
      "Real-time usage monitoring",
    ],
    idealFor: [
      "Secure apartment blocks",
      "High-end residential properties",
      "Properties with history of tampering",
      "Commercial buildings",
    ],
    price: "7,500",
    image: "/products/split-electric.avif",
    icon: MdBolt,
    color: "text-orange-500",
    bgColor: "bg-orange-50 dark:bg-orange-950/20",
    popular: false,
  },
  {
    id: "water",
    name: "Intelligent Water Meter",
    type: "Water",
    tagline: "Smart Aqua",
    description:
      "Prepaid convenience for water. Smart valve-controlled meter that detects leaks early and stops you from chasing water bills. Auto-shutoff on zero credit protects your property.",
    features: [
      "Automatic valve control",
      "Leak detection alerts",
      "Auto-shutoff on zero credit",
      "Low battery alarms",
      "Precision measurement",
    ],
    idealFor: [
      "Residential compounds",
      "Commercial properties",
      "Properties with water wastage issues",
      "Gated communities",
    ],
    price: "12,500",
    image: "/products/water-prepaid.avif",
    icon: MdWaterDrop,
    color: "text-blue-500",
    bgColor: "bg-blue-50 dark:bg-blue-950/20",
    popular: true,
  },
  {
    id: "three-phase",
    name: "Three-Phase Meter",
    type: "Electricity",
    tagline: "The Commercial Powerhouse",
    description:
      "Handle high-voltage demands with precision. Heavy-duty metering for commercial and industrial loads. Ensure your commercial tenants pay exactly for what they use.",
    features: [
      "4-wire measurement",
      "Load balancing monitoring",
      "High accuracy Class 1",
      "Power factor measurement",
      "Maximum demand recording",
    ],
    idealFor: [
      "Shops and retail spaces",
      "Factories and workshops",
      "Large commercial buildings",
      "Industrial complexes",
    ],
    price: "18,500",
    image: "/products/3-phase-electric.avif",
    icon: MdBolt,
    color: "text-orange-500",
    bgColor: "bg-orange-50 dark:bg-orange-950/20",
    popular: false,
  },
  {
    id: "gas",
    name: "Smart Gas Meter",
    type: "Gas",
    tagline: "Safe and Precise",
    description:
      "Safe and precise metering for piped gas estates. Diaphragm residential meter with safety shutoff for peace of mind in your gas-powered property.",
    features: [
      "Safety shut-off valve",
      "Precision measurement",
      "Prepaid token support",
      "Low credit alerts",
      "Durable construction",
    ],
    idealFor: [
      "Piped gas estates",
      "Residential compounds with gas",
      "Apartments with centralized gas",
    ],
    price: "9,000",
    image: "/products/gas-prepaid.avif",
    icon: MdPropane,
    color: "text-green-600",
    bgColor: "bg-green-50 dark:bg-green-950/20",
    popular: false,
  },
];

export function getProductById(id: string): Product | undefined {
  return products.find((p) => p.id === id);
}
