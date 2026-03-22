export interface LandlordPropertySummary {
  id: string;
  location: string;
  name: string;
}

export interface LandlordMotherMeterSummary {
  id: string;
  motherMeterNumber: string;
  propertyId: string;
  type: "postpaid" | "prepaid";
}

export interface LandlordAccessSummary {
  customerId: string;
  motherMeters: LandlordMotherMeterSummary[];
  name: string;
  phoneNumber: string;
  properties: LandlordPropertySummary[];
  userId: string;
}
