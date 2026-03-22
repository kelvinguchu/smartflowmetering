export interface TenantMeterSummary {
  meterId: string;
  meterNumber: string;
  meterType: "electricity" | "gas" | "water";
  motherMeterId: string;
  motherMeterNumber: string;
  propertyId: string;
  propertyName: string;
}

export interface TenantAccessSummary extends TenantMeterSummary {
  id: string;
}
