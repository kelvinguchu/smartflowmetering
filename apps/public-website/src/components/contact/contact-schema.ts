import { z } from "zod";

export const roleOptions = [
  { value: "landlord", label: "Landlord / Property Owner" },
  { value: "tenant", label: "Tenant" },
  { value: "property_manager", label: "Property Manager" },
  { value: "technician", label: "Technician / Installer" },
  { value: "other", label: "Other" },
] as const;

export const inquiryOptions = [
  { value: "meter_inquiry", label: "Meter Purchase Inquiry" },
  { value: "registration", label: "Landlord Registration Help" },
  { value: "token_issue", label: "Token Purchase Issue" },
  { value: "technical", label: "Technical Support" },
  { value: "partnership", label: "Partnership / Business Inquiry" },
  { value: "other", label: "Other" },
] as const;

export const contactSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z
    .string()
    .min(10, "Phone number must be at least 10 digits")
    .regex(/^[0-9+\s-]+$/, "Invalid phone number format"),
  email: z.email("Invalid email address").optional().or(z.literal("")),
  role: z.enum(roleOptions.map((item) => item.value) as [string, ...string[]], {
    message: "Please select your role",
  }),
  inquiryType: z.enum(
    inquiryOptions.map((item) => item.value) as [string, ...string[]],
    {
      message: "Please select an inquiry type",
    }
  ),
  message: z.string().min(10, "Message must be at least 10 characters"),
});

export type ContactFormData = z.infer<typeof contactSchema>;
