import { MdLocationOn, MdMail, MdPhone } from "react-icons/md";

export function ContactCards() {
  return (
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
        href='tel:+254725799783'
        className='bg-card rounded-2xl border border-border/50 p-6 text-center hover:shadow-lg transition-shadow cursor-pointer group'>
        <div className='h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4'>
          <MdPhone className='text-2xl text-primary' />
        </div>
        <h3 className='font-bold font-heading mb-1'>Call Us</h3>
        <p className='text-sm text-muted-foreground group-hover:text-primary transition-colors'>
          +254 725 799 783
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
  );
}
