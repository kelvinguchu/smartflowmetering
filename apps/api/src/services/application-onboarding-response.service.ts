export interface MeterApplicationSummary {
  buildingType: "commercial" | "industrial" | "residential";
  county: string;
  createdAt: Date;
  email: string;
  fullName: string;
  id: string;
  location: string;
  motherMeterNumber: string;
  paymentMode: "postpaid" | "prepaid";
  phoneNumber: string;
  status: "approved" | "pending" | "rejected";
  subMeterCount: number;
  utilityType: "electricity" | "water";
}

export interface MeterApplicationSupportDetail extends MeterApplicationSummary {
  billPayer: "kplc" | "landlord";
  initialReading: string | null;
  installationType: "existing" | "new";
  subMeterNumbers: string[];
  suppliesOtherHouses: boolean;
  technicianName: string | null;
  technicianPhone: string | null;
}

export interface MeterApplicationAdminDetail
  extends MeterApplicationSupportDetail {
  idNumber: string;
  kraPin: string;
  termsAccepted: boolean;
}

export function toMeterApplicationSummary(application: {
  buildingType: "commercial" | "industrial" | "residential";
  county: string;
  createdAt: Date;
  email: string;
  firstName: string;
  id: string;
  lastName: string;
  location: string;
  motherMeterNumber: string;
  paymentMode: "postpaid" | "prepaid";
  phoneNumber: string;
  status: "approved" | "pending" | "rejected";
  subMeterNumbers: unknown;
  utilityType: "electricity" | "water";
}): MeterApplicationSummary {
  return {
    buildingType: application.buildingType,
    county: application.county,
    createdAt: application.createdAt,
    email: application.email,
    fullName: `${application.firstName} ${application.lastName}`.trim(),
    id: application.id,
    location: application.location,
    motherMeterNumber: application.motherMeterNumber,
    paymentMode: application.paymentMode,
    phoneNumber: application.phoneNumber,
    status: application.status,
    subMeterCount: getSubMeterNumbers(application.subMeterNumbers).length,
    utilityType: application.utilityType,
  };
}

export function toMeterApplicationSupportDetail(application: {
  billPayer: "kplc" | "landlord";
  buildingType: "commercial" | "industrial" | "residential";
  county: string;
  createdAt: Date;
  email: string;
  firstName: string;
  id: string;
  initialReading: string | null;
  installationType: "existing" | "new";
  lastName: string;
  location: string;
  motherMeterNumber: string;
  paymentMode: "postpaid" | "prepaid";
  phoneNumber: string;
  status: "approved" | "pending" | "rejected";
  subMeterNumbers: unknown;
  suppliesOtherHouses: boolean;
  technicianName: string | null;
  technicianPhone: string | null;
  utilityType: "electricity" | "water";
}): MeterApplicationSupportDetail {
  const subMeterNumbers = getSubMeterNumbers(application.subMeterNumbers);

  return {
    billPayer: application.billPayer,
    buildingType: application.buildingType,
    county: application.county,
    createdAt: application.createdAt,
    email: application.email,
    fullName: `${application.firstName} ${application.lastName}`.trim(),
    id: application.id,
    initialReading: application.initialReading,
    installationType: application.installationType,
    location: application.location,
    motherMeterNumber: application.motherMeterNumber,
    paymentMode: application.paymentMode,
    phoneNumber: application.phoneNumber,
    status: application.status,
    subMeterCount: subMeterNumbers.length,
    subMeterNumbers,
    suppliesOtherHouses: application.suppliesOtherHouses,
    technicianName: application.technicianName,
    technicianPhone: application.technicianPhone,
    utilityType: application.utilityType,
  };
}

export function toMeterApplicationAdminDetail(application: {
  billPayer: "kplc" | "landlord";
  buildingType: "commercial" | "industrial" | "residential";
  county: string;
  createdAt: Date;
  email: string;
  firstName: string;
  id: string;
  idNumber: string;
  initialReading: string | null;
  installationType: "existing" | "new";
  kraPin: string;
  lastName: string;
  location: string;
  motherMeterNumber: string;
  paymentMode: "postpaid" | "prepaid";
  phoneNumber: string;
  status: "approved" | "pending" | "rejected";
  subMeterNumbers: unknown;
  suppliesOtherHouses: boolean;
  technicianName: string | null;
  technicianPhone: string | null;
  termsAccepted: boolean;
  utilityType: "electricity" | "water";
}): MeterApplicationAdminDetail {
  return {
    ...toMeterApplicationSupportDetail(application),
    idNumber: application.idNumber,
    kraPin: application.kraPin,
    termsAccepted: application.termsAccepted,
  };
}

function getSubMeterNumbers(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}
