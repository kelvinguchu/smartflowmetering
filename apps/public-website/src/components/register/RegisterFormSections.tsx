import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type PropertyInfoProps = {
  buildingType: "residential" | "commercial" | "industrial" | "";
  utilityType: "electricity" | "water" | "";
  onBuildingTypeChange: (value: "residential" | "commercial" | "industrial") => void;
  onUtilityTypeChange: (value: "electricity" | "water") => void;
};

type MotherMeterProps = {
  paymentMode: "prepaid" | "postpaid" | "";
  installationType: "new" | "existing" | "";
  billPayer: "kplc" | "landlord" | "";
  suppliesOtherHouses: boolean;
  onPaymentModeChange: (value: "prepaid" | "postpaid") => void;
  onInstallationTypeChange: (value: "new" | "existing") => void;
  onBillPayerChange: (value: "kplc" | "landlord") => void;
  onSuppliesOtherHousesChange: (value: boolean) => void;
};

function FormSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card rounded-2xl border border-border/50 p-6 space-y-4">
      <h2 className="text-lg font-bold font-heading">{title}</h2>
      {children}
    </div>
  );
}

export function PersonalInfoSection() {
  return (
    <FormSection title="Personal Information">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="firstName">First Name *</Label>
          <Input id="firstName" name="firstName" placeholder="John" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Last Name *</Label>
          <Input id="lastName" name="lastName" placeholder="Doe" required />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="phone">Phone Number *</Label>
          <Input id="phone" name="phoneNumber" type="tel" placeholder="0712345678" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email Address *</Label>
          <Input id="email" name="email" type="email" placeholder="john@example.com" required />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="idNumber">ID Number *</Label>
          <Input id="idNumber" name="idNumber" placeholder="12345678" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="kraPin">KRA PIN *</Label>
          <Input id="kraPin" name="kraPin" placeholder="A012345678B" required />
        </div>
      </div>
    </FormSection>
  );
}

export function PropertyInfoSection(props: PropertyInfoProps) {
  return (
    <FormSection title="Property Information">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="county">County *</Label>
          <Input id="county" name="county" placeholder="Nairobi" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="location">Location / Address *</Label>
          <Input id="location" name="location" placeholder="Westlands, ABC Apartments" required />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Building Type *</Label>
          <Select
            value={props.buildingType}
            onValueChange={props.onBuildingTypeChange}
            required
          >
            <SelectTrigger className="cursor-pointer">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="residential" className="cursor-pointer">
                Residential
              </SelectItem>
              <SelectItem value="commercial" className="cursor-pointer">
                Commercial
              </SelectItem>
              <SelectItem value="industrial" className="cursor-pointer">
                Industrial
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Utility Type *</Label>
          <Select
            value={props.utilityType}
            onValueChange={props.onUtilityTypeChange}
            required
          >
            <SelectTrigger className="cursor-pointer">
              <SelectValue placeholder="Select utility" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="electricity" className="cursor-pointer">
                Electricity
              </SelectItem>
              <SelectItem value="water" className="cursor-pointer">
                Water
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </FormSection>
  );
}

export function MotherMeterSection(props: MotherMeterProps) {
  return (
    <FormSection title="Mother Meter Details">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="motherMeter">Mother Meter Number *</Label>
          <Input id="motherMeter" name="motherMeterNumber" placeholder="KPLC meter number" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="initialReading">Initial Reading *</Label>
          <Input id="initialReading" name="initialReading" type="number" min={0} placeholder="0" required />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Payment Mode *</Label>
          <Select value={props.paymentMode} onValueChange={props.onPaymentModeChange} required>
            <SelectTrigger className="cursor-pointer">
              <SelectValue placeholder="Select mode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="prepaid" className="cursor-pointer">
                Prepaid
              </SelectItem>
              <SelectItem value="postpaid" className="cursor-pointer">
                Postpaid
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Installation Type *</Label>
          <Select
            value={props.installationType}
            onValueChange={props.onInstallationTypeChange}
            required
          >
            <SelectTrigger className="cursor-pointer">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="new" className="cursor-pointer">
                New Installation
              </SelectItem>
              <SelectItem value="existing" className="cursor-pointer">
                Existing Meters
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Who pays the KPLC bill? *</Label>
          <Select value={props.billPayer} onValueChange={props.onBillPayerChange} required>
            <SelectTrigger className="cursor-pointer">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="kplc" className="cursor-pointer">
                KPLC (Direct)
              </SelectItem>
              <SelectItem value="landlord" className="cursor-pointer">
                Landlord
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 pt-6">
          <Checkbox
            id="suppliesOther"
            checked={props.suppliesOtherHouses}
            onCheckedChange={(checked) => props.onSuppliesOtherHousesChange(checked === true)}
            className="cursor-pointer"
          />
          <Label htmlFor="suppliesOther" className="font-normal cursor-pointer">
            Supplies power to other houses
          </Label>
        </div>
      </div>
    </FormSection>
  );
}

export function SubMetersSection({
  subMeters,
  onAdd,
  onUpdate,
  onRemove,
}: {
  subMeters: string[];
  onAdd: () => void;
  onUpdate: (index: number, value: string) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <FormSection title="Sub-Meter Numbers">
      <div className="flex items-center justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onAdd}
          className="cursor-pointer"
        >
          + Add Meter
        </Button>
      </div>

      <div className="space-y-3">
        {subMeters.map((meter, index) => (
          <div key={index} className="flex gap-2">
            <Input
              name="subMeterNumbers"
              value={meter}
              onChange={(e) => onUpdate(index, e.target.value)}
              placeholder={`Sub-meter ${index + 1} number`}
              required
            />
            {subMeters.length > 1 && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => onRemove(index)}
                className="cursor-pointer"
              >
                x
              </Button>
            )}
          </div>
        ))}
      </div>
    </FormSection>
  );
}

export function TechnicianSection() {
  return (
    <FormSection title="Technician Details (Optional)">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="techName">Technician Name</Label>
          <Input id="techName" name="technicianName" placeholder="Full name" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="techPhone">Technician Phone</Label>
          <Input id="techPhone" name="technicianPhone" type="tel" placeholder="0712345678" />
        </div>
      </div>
    </FormSection>
  );
}
