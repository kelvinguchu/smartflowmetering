import { useState } from "react";
import { z } from "zod";
import { MdMail, MdPhone, MdLocationOn } from "react-icons/md";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const contactSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z
    .string()
    .min(10, "Phone number must be at least 10 digits")
    .regex(/^[0-9+\s-]+$/, "Invalid phone number format"),
  email: z.email("Invalid email address").optional().or(z.literal("")),
  role: z.enum(
    ["landlord", "tenant", "property_manager", "technician", "other"],
    { message: "Please select your role" },
  ),
  inquiryType: z.enum(
    [
      "meter_inquiry",
      "registration",
      "token_issue",
      "technical",
      "partnership",
      "other",
    ],
    { message: "Please select an inquiry type" },
  ),
  message: z.string().min(10, "Message must be at least 10 characters"),
});

type ContactFormData = z.infer<typeof contactSchema>;

export function ContactInfo() {
  const [formData, setFormData] = useState<Partial<ContactFormData>>({});
  const [errors, setErrors] = useState<
    Partial<Record<keyof ContactFormData, string>>
  >({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = contactSchema.safeParse(formData);

    if (!result.success) {
      const fieldErrors: Partial<Record<keyof ContactFormData, string>> = {};
      result.error.issues.forEach((issue) => {
        const field = issue.path[0] as keyof ContactFormData;
        fieldErrors[field] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsSubmitting(true);
    // Simulate submission
    setTimeout(() => {
      setIsSubmitting(false);
      setSubmitSuccess(true);
      setFormData({});
    }, 1000);
  };

  const updateField = (field: keyof ContactFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  if (submitSuccess) {
    return (
      <div className='container max-w-5xl mx-auto px-4 sm:px-8'>
        <div className='bg-card rounded-2xl border border-border/50 p-6 sm:p-8 md:p-12 text-center'>
          <div className='h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6'>
            <MdMail className='text-3xl text-green-600' />
          </div>
          <h2 className='text-2xl font-bold font-heading mb-2'>
            Message Sent!
          </h2>
          <p className='text-muted-foreground mb-6'>
            Thank you for contacting us. We'll get back to you shortly.
          </p>
          <Button
            onClick={() => setSubmitSuccess(false)}
            className='bg-primary hover:bg-primary/90 rounded-full cursor-pointer'>
            Send Another Message
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className='container max-w-5xl mx-auto px-4 sm:px-8'>
      {/* Header */}
      <div className='text-center mb-6 sm:mb-8'>
        <h1 className='text-2xl sm:text-3xl md:text-4xl font-bold font-heading mb-2'>
          Get in <span className='text-primary'>Touch</span>
        </h1>
        <p className='text-muted-foreground'>
          Have questions about our meters or services? We'd love to hear from
          you.
        </p>
      </div>
      {/* Contact Form */}
      <div className='bg-card rounded-2xl border border-border/50 p-6 md:p-8 mb-8 sm:mb-12'>
        <h2 className='text-xl font-bold font-heading mb-6'>
          Send us a message
        </h2>
        <form onSubmit={handleSubmit} className='space-y-6'>
          <div className='grid sm:grid-cols-2 gap-4'>
            <div className='space-y-2'>
              <Label htmlFor='name'>Full Name *</Label>
              <Input
                id='name'
                placeholder='John Doe'
                value={formData.name || ""}
                onChange={(e) => updateField("name", e.target.value)}
                className={errors.name ? "border-red-500" : ""}
              />
              {errors.name && (
                <p className='text-xs text-red-500'>{errors.name}</p>
              )}
            </div>
            <div className='space-y-2'>
              <Label htmlFor='phone'>Phone Number *</Label>
              <Input
                id='phone'
                type='tel'
                placeholder='0712345678'
                value={formData.phone || ""}
                onChange={(e) => updateField("phone", e.target.value)}
                className={errors.phone ? "border-red-500" : ""}
              />
              {errors.phone && (
                <p className='text-xs text-red-500'>{errors.phone}</p>
              )}
            </div>
          </div>

          <div className='grid sm:grid-cols-2 gap-4'>
            <div className='space-y-2'>
              <Label htmlFor='email'>Email Address</Label>
              <Input
                id='email'
                type='email'
                placeholder='john@example.com'
                value={formData.email || ""}
                onChange={(e) => updateField("email", e.target.value)}
                className={errors.email ? "border-red-500" : ""}
              />
              {errors.email && (
                <p className='text-xs text-red-500'>{errors.email}</p>
              )}
            </div>
            <div className='space-y-2'>
              <Label>I am a *</Label>
              <Select
                value={formData.role}
                onValueChange={(value) =>
                  updateField("role", value as ContactFormData["role"])
                }>
                <SelectTrigger
                  className={`cursor-pointer ${errors.role ? "border-red-500" : ""}`}>
                  <SelectValue placeholder='Select your role' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='landlord' className='cursor-pointer'>
                    Landlord / Property Owner
                  </SelectItem>
                  <SelectItem value='tenant' className='cursor-pointer'>
                    Tenant
                  </SelectItem>
                  <SelectItem
                    value='property_manager'
                    className='cursor-pointer'>
                    Property Manager
                  </SelectItem>
                  <SelectItem value='technician' className='cursor-pointer'>
                    Technician / Installer
                  </SelectItem>
                  <SelectItem value='other' className='cursor-pointer'>
                    Other
                  </SelectItem>
                </SelectContent>
              </Select>
              {errors.role && (
                <p className='text-xs text-red-500'>{errors.role}</p>
              )}
            </div>
          </div>

          <div className='space-y-2'>
            <Label>Inquiry Type *</Label>
            <Select
              value={formData.inquiryType}
              onValueChange={(value) =>
                updateField(
                  "inquiryType",
                  value as ContactFormData["inquiryType"],
                )
              }>
              <SelectTrigger
                className={`cursor-pointer ${errors.inquiryType ? "border-red-500" : ""}`}>
                <SelectValue placeholder='What can we help with?' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='meter_inquiry' className='cursor-pointer'>
                  Meter Purchase Inquiry
                </SelectItem>
                <SelectItem value='registration' className='cursor-pointer'>
                  Landlord Registration Help
                </SelectItem>
                <SelectItem value='token_issue' className='cursor-pointer'>
                  Token Purchase Issue
                </SelectItem>
                <SelectItem value='technical' className='cursor-pointer'>
                  Technical Support
                </SelectItem>
                <SelectItem value='partnership' className='cursor-pointer'>
                  Partnership / Business Inquiry
                </SelectItem>
                <SelectItem value='other' className='cursor-pointer'>
                  Other
                </SelectItem>
              </SelectContent>
            </Select>
            {errors.inquiryType && (
              <p className='text-xs text-red-500'>{errors.inquiryType}</p>
            )}
          </div>

          <div className='space-y-2'>
            <Label htmlFor='message'>Message *</Label>
            <Textarea
              id='message'
              placeholder='Tell us more about your inquiry. If you have a meter number or property details, please include them here...'
              rows={5}
              value={formData.message || ""}
              onChange={(e) => updateField("message", e.target.value)}
              className={errors.message ? "border-red-500" : ""}
            />
            {errors.message && (
              <p className='text-xs text-red-500'>{errors.message}</p>
            )}
          </div>

          <Button
            type='submit'
            size='lg'
            disabled={isSubmitting}
            className='w-full sm:w-auto bg-primary hover:bg-primary/90 rounded-full px-8 cursor-pointer disabled:opacity-50'>
            {isSubmitting ? "Sending..." : "Send Message"}
          </Button>
        </form>
      </div>

      {/* Contact Cards */}
      <div className='grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6'>
        <a
          href='mailto:inquiries@smartmetering.africa'
          className='bg-card rounded-2xl border border-border/50 p-6 text-center hover:shadow-lg transition-shadow cursor-pointer group'>
          <div className='h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4'>
            <MdMail className='text-2xl text-primary' />
          </div>
          <h3 className='font-bold font-heading mb-1'>Email Us</h3>
          <p className='text-sm text-muted-foreground group-hover:text-primary transition-colors'>
            inquiries@smartmetering.africa
          </p>
        </a>

        <a
          href='tel:+254725101001'
          className='bg-card rounded-2xl border border-border/50 p-6 text-center hover:shadow-lg transition-shadow cursor-pointer group'>
          <div className='h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4'>
            <MdPhone className='text-2xl text-primary' />
          </div>
          <h3 className='font-bold font-heading mb-1'>Call Us</h3>
          <p className='text-sm text-muted-foreground group-hover:text-primary transition-colors'>
            +254 725 101001
          </p>
        </a>

        <div className='bg-card rounded-2xl border border-border/50 p-6 text-center'>
          <div className='h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4'>
            <MdLocationOn className='text-2xl text-primary' />
          </div>
          <h3 className='font-bold font-heading mb-1'>Location</h3>
          <p className='text-sm text-muted-foreground'>Nairobi, Kenya</p>
        </div>
      </div>
    </div>
  );
}
