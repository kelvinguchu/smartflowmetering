import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  MotherMeterSection,
  PersonalInfoSection,
  PropertyInfoSection,
  SubMetersSection,
  TechnicianSection,
} from "./RegisterFormSections";

export function RegisterForm() {
  const [subMeters, setSubMeters] = useState<string[]>([""]);
  const [buildingType, setBuildingType] = useState<
    "residential" | "commercial" | "industrial" | ""
  >("");
  const [utilityType, setUtilityType] = useState<"electricity" | "water" | "">("");
  const [paymentMode, setPaymentMode] = useState<"prepaid" | "postpaid" | "">("");
  const [installationType, setInstallationType] = useState<"new" | "existing" | "">("");
  const [billPayer, setBillPayer] = useState<"kplc" | "landlord" | "">("");
  const [suppliesOtherHouses, setSuppliesOtherHouses] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<"success" | "error">("success");

  const addSubMeter = () => {
    setSubMeters([...subMeters, ""]);
  };

  const updateSubMeter = (index: number, value: string) => {
    const updated = [...subMeters];
    updated[index] = value;
    setSubMeters(updated);
  };

  const removeSubMeter = (index: number) => {
    if (subMeters.length > 1) {
      setSubMeters(subMeters.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    if (!buildingType || !utilityType || !paymentMode || !installationType || !billPayer) {
      setStatusType("error");
      setStatusMessage("Please fill all required selection fields.");
      return;
    }

    if (!termsAccepted) {
      setStatusType("error");
      setStatusMessage("You must accept terms and conditions before submitting.");
      return;
    }

    const formData = new FormData(event.currentTarget);
    const subMeterNumbers = formData
      .getAll("subMeterNumbers")
      .map((entry) => String(entry).trim())
      .filter(Boolean);

    const payload = {
      firstName: String(formData.get("firstName") ?? "").trim(),
      lastName: String(formData.get("lastName") ?? "").trim(),
      phoneNumber: String(formData.get("phoneNumber") ?? "").trim(),
      email: String(formData.get("email") ?? "").trim(),
      idNumber: String(formData.get("idNumber") ?? "").trim(),
      kraPin: String(formData.get("kraPin") ?? "").trim(),
      county: String(formData.get("county") ?? "").trim(),
      location: String(formData.get("location") ?? "").trim(),
      buildingType,
      utilityType,
      motherMeterNumber: String(formData.get("motherMeterNumber") ?? "").trim(),
      initialReading: Number(formData.get("initialReading") ?? "0"),
      paymentMode,
      subMeterNumbers,
      installationType,
      suppliesOtherHouses,
      billPayer,
      technicianName: String(formData.get("technicianName") ?? "").trim() || undefined,
      technicianPhone: String(formData.get("technicianPhone") ?? "").trim() || undefined,
      termsAccepted: true,
    };

    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const apiBase = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/g, "");
      const endpoint = `${apiBase}/api/applications`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setStatusType("error");
        setStatusMessage(result.error ?? "Failed to submit application.");
        return;
      }

      setStatusType("success");
      setStatusMessage(
        "Application submitted successfully. Our team will review and contact you."
      );
      event.currentTarget.reset();
      setSubMeters([""]);
      setBuildingType("");
      setUtilityType("");
      setPaymentMode("");
      setInstallationType("");
      setBillPayer("");
      setSuppliesOtherHouses(false);
      setTermsAccepted(false);
    } catch (error) {
      setStatusType("error");
      setStatusMessage(
        error instanceof Error ? error.message : "Failed to submit application."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className='container max-w-5xl mx-auto px-4 sm:px-8'>
      <div className='text-center mb-8'>
        <h1 className='text-3xl md:text-4xl font-bold font-heading mb-2'>
          Register Your <span className='text-primary'>Property</span>
        </h1>
        <p className='text-muted-foreground'>
          Apply to register your meters with Smart Flow Metering. Our team will
          review and activate your account.
        </p>
      </div>

      <form className="space-y-8" onSubmit={handleSubmit}>
        <PersonalInfoSection />
        <PropertyInfoSection
          buildingType={buildingType}
          utilityType={utilityType}
          onBuildingTypeChange={setBuildingType}
          onUtilityTypeChange={setUtilityType}
        />
        <SubMetersSection
          subMeters={subMeters}
          onAdd={addSubMeter}
          onUpdate={updateSubMeter}
          onRemove={removeSubMeter}
        />
        <TechnicianSection />

        <MotherMeterSection
          paymentMode={paymentMode}
          installationType={installationType}
          billPayer={billPayer}
          suppliesOtherHouses={suppliesOtherHouses}
          onPaymentModeChange={setPaymentMode}
          onInstallationTypeChange={setInstallationType}
          onBillPayerChange={setBillPayer}
          onSuppliesOtherHousesChange={setSuppliesOtherHouses}
        />

        <div className="flex items-start gap-3">
          <Checkbox
            id="terms"
            checked={termsAccepted}
            onCheckedChange={(checked) => setTermsAccepted(checked === true)}
            className="cursor-pointer"
          />
          <Label
            htmlFor="terms"
            className="font-normal text-sm leading-relaxed cursor-pointer"
          >
            I accept the Terms and Conditions and confirm that all information
            provided is accurate. I understand that Smart Flow Metering will
            review my application before activation.
          </Label>
        </div>

        {statusMessage && (
          <p
            className={
              statusType === "success"
                ? "text-sm text-green-600"
                : "text-sm text-red-600"
            }
          >
            {statusMessage}
          </p>
        )}

        <Button
          type="submit"
          size="lg"
          disabled={isSubmitting}
          className="w-full bg-primary hover:bg-primary/90 rounded-full text-lg cursor-pointer"
        >
          {isSubmitting ? "Submitting..." : "Submit Application"}
        </Button>
      </form>
    </div>
  );
}
