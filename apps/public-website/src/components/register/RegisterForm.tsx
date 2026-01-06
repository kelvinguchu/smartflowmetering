import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

export function RegisterForm() {
  const [subMeters, setSubMeters] = useState<string[]>([""]);

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

  return (
    <div className='container max-w-5xl mx-auto px-4 sm:px-8'>
      {/* Header */}
      <div className='text-center mb-8'>
        <h1 className='text-3xl md:text-4xl font-bold font-heading mb-2'>
          Register Your <span className='text-primary'>Property</span>
        </h1>
        <p className='text-muted-foreground'>
          Apply to register your meters with Ohm Kenya. Our team will review and
          activate your account.
        </p>
      </div>

      {/* Form */}
      <form className='space-y-8'>
        {/* Personal Information */}
        <div className='bg-card rounded-2xl border border-border/50 p-6 space-y-4'>
          <h2 className='text-lg font-bold font-heading'>
            Personal Information
          </h2>

          <div className='grid sm:grid-cols-2 gap-4'>
            <div className='space-y-2'>
              <Label htmlFor='firstName'>First Name *</Label>
              <Input id='firstName' placeholder='John' required />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='lastName'>Last Name *</Label>
              <Input id='lastName' placeholder='Doe' required />
            </div>
          </div>

          <div className='grid sm:grid-cols-2 gap-4'>
            <div className='space-y-2'>
              <Label htmlFor='phone'>Phone Number *</Label>
              <Input id='phone' type='tel' placeholder='0712345678' required />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='email'>Email Address *</Label>
              <Input
                id='email'
                type='email'
                placeholder='john@example.com'
                required
              />
            </div>
          </div>

          <div className='grid sm:grid-cols-2 gap-4'>
            <div className='space-y-2'>
              <Label htmlFor='idNumber'>ID Number *</Label>
              <Input id='idNumber' placeholder='12345678' required />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='kraPin'>KRA PIN *</Label>
              <Input id='kraPin' placeholder='A012345678B' required />
            </div>
          </div>
        </div>

        {/* Property Information */}
        <div className='bg-card rounded-2xl border border-border/50 p-6 space-y-4'>
          <h2 className='text-lg font-bold font-heading'>
            Property Information
          </h2>

          <div className='grid sm:grid-cols-2 gap-4'>
            <div className='space-y-2'>
              <Label htmlFor='county'>County *</Label>
              <Input id='county' placeholder='Nairobi' required />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='location'>Location / Address *</Label>
              <Input
                id='location'
                placeholder='Westlands, ABC Apartments'
                required
              />
            </div>
          </div>

          <div className='grid sm:grid-cols-2 gap-4'>
            <div className='space-y-2'>
              <Label>Building Type *</Label>
              <Select required>
                <SelectTrigger className='cursor-pointer'>
                  <SelectValue placeholder='Select type' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='residential' className='cursor-pointer'>
                    Residential
                  </SelectItem>
                  <SelectItem value='commercial' className='cursor-pointer'>
                    Commercial
                  </SelectItem>
                  <SelectItem value='industrial' className='cursor-pointer'>
                    Industrial
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-2'>
              <Label>Utility Type *</Label>
              <Select required>
                <SelectTrigger className='cursor-pointer'>
                  <SelectValue placeholder='Select utility' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='electricity' className='cursor-pointer'>
                    Electricity
                  </SelectItem>
                  <SelectItem value='water' className='cursor-pointer'>
                    Water
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Mother Meter Information */}
        <div className='bg-card rounded-2xl border border-border/50 p-6 space-y-4'>
          <h2 className='text-lg font-bold font-heading'>
            Mother Meter Details
          </h2>

          <div className='grid sm:grid-cols-2 gap-4'>
            <div className='space-y-2'>
              <Label htmlFor='motherMeter'>Mother Meter Number *</Label>
              <Input
                id='motherMeter'
                placeholder='KPLC meter number'
                required
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='initialReading'>Initial Reading *</Label>
              <Input
                id='initialReading'
                type='number'
                placeholder='0'
                required
              />
            </div>
          </div>

          <div className='grid sm:grid-cols-2 gap-4'>
            <div className='space-y-2'>
              <Label>Payment Mode *</Label>
              <Select required>
                <SelectTrigger className='cursor-pointer'>
                  <SelectValue placeholder='Select mode' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='prepaid' className='cursor-pointer'>
                    Prepaid
                  </SelectItem>
                  <SelectItem value='postpaid' className='cursor-pointer'>
                    Postpaid
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-2'>
              <Label>Installation Type *</Label>
              <Select required>
                <SelectTrigger className='cursor-pointer'>
                  <SelectValue placeholder='Select type' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='new' className='cursor-pointer'>
                    New Installation
                  </SelectItem>
                  <SelectItem value='existing' className='cursor-pointer'>
                    Existing Meters
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className='grid sm:grid-cols-2 gap-4'>
            <div className='space-y-2'>
              <Label>Who pays the KPLC bill? *</Label>
              <Select required>
                <SelectTrigger className='cursor-pointer'>
                  <SelectValue placeholder='Select' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='kplc' className='cursor-pointer'>
                    KPLC (Direct)
                  </SelectItem>
                  <SelectItem value='landlord' className='cursor-pointer'>
                    Landlord
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className='flex items-center gap-2 pt-6'>
              <Checkbox id='suppliesOther' className='cursor-pointer' />
              <Label
                htmlFor='suppliesOther'
                className='font-normal cursor-pointer'>
                Supplies power to other houses
              </Label>
            </div>
          </div>
        </div>

        {/* Sub-Meters */}
        <div className='bg-card rounded-2xl border border-border/50 p-6 space-y-4'>
          <div className='flex items-center justify-between'>
            <h2 className='text-lg font-bold font-heading'>
              Sub-Meter Numbers
            </h2>
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={addSubMeter}
              className='cursor-pointer'>
              + Add Meter
            </Button>
          </div>

          <div className='space-y-3'>
            {subMeters.map((meter, index) => (
              <div key={index} className='flex gap-2'>
                <Input
                  value={meter}
                  onChange={(e) => updateSubMeter(index, e.target.value)}
                  placeholder={`Sub-meter ${index + 1} number`}
                />
                {subMeters.length > 1 && (
                  <Button
                    type='button'
                    variant='outline'
                    size='icon'
                    onClick={() => removeSubMeter(index)}
                    className='cursor-pointer'>
                    ×
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Technician Information */}
        <div className='bg-card rounded-2xl border border-border/50 p-6 space-y-4'>
          <h2 className='text-lg font-bold font-heading'>
            Technician Details (Optional)
          </h2>

          <div className='grid sm:grid-cols-2 gap-4'>
            <div className='space-y-2'>
              <Label htmlFor='techName'>Technician Name</Label>
              <Input id='techName' placeholder='Full name' />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='techPhone'>Technician Phone</Label>
              <Input id='techPhone' type='tel' placeholder='0712345678' />
            </div>
          </div>
        </div>

        {/* Terms */}
        <div className='flex items-start gap-3'>
          <Checkbox id='terms' required className='cursor-pointer' />
          <Label
            htmlFor='terms'
            className='font-normal text-sm leading-relaxed cursor-pointer'>
            I accept the Terms and Conditions and confirm that all information
            provided is accurate. I understand that Ohm Kenya will review my
            application before activation.
          </Label>
        </div>

        {/* Submit */}
        <Button
          type='submit'
          size='lg'
          className='w-full bg-primary hover:bg-primary/90 rounded-full text-lg cursor-pointer'>
          Submit Application
        </Button>
      </form>
    </div>
  );
}
