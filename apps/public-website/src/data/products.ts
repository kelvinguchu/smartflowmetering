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
    name: "Prepaid Integrated Sub Meter",
    type: "Electricity",
    tagline: "Compact Prepaid Sub Meter",
    description:
      "An affordable prepaid sub meter with keypad and meter in one compact unit. Tenants enter prepaid tokens directly on the device — the most popular token meter for Kenyan landlords.",
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
    name: "Prepaid Split Sub Meter",
    type: "Electricity",
    tagline: "Secure Prepaid Split Sub Meter",
    description:
      "Maximum security prepaid split meter for landlords. The measurement unit stays locked in your DB board, while the tenant gets a wireless keypad (CIU). The best tamper-proof sub meter in Kenya.",
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
    name: "Prepaid Water Sub Meter",
    type: "Water",
    tagline: "Prepaid Water Token Meter",
    description:
      "Prepaid water meter with smart valve control and leak detection. Tenants buy water tokens via M-Pesa. Auto-shutoff on zero credit protects your property from water wastage.",
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
    name: "Prepaid 3-Phase Sub Meter",
    type: "Electricity",
    tagline: "Commercial 3-Phase Sub Meter",
    description:
      "Heavy-duty prepaid 3-phase sub meter for commercial and industrial loads. Ensure your commercial tenants pay exactly for what they use with precision token metering.",
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
    name: "Prepaid Gas Sub Meter",
    type: "Gas",
    tagline: "Prepaid Gas Token Meter",
    description:
      "Prepaid gas meter for piped gas estates with safety shutoff valve. Tenants buy gas tokens via M-Pesa for precise, pay-as-you-go gas sub metering.",
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
