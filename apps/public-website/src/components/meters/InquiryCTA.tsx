import { Button } from "@/components/ui/button";
import { MdMail, MdPhone } from "react-icons/md";

export function InquiryCTA() {
  return (
    <section className='py-6 md:py-8'>
      <div className='container max-w-screen-2xl px-4 sm:px-8'>
        <div className='bg-foreground text-background rounded-3xl p-8 md:p-12 text-center'>
          <h2 className='text-2xl md:text-3xl font-bold font-heading mb-4'>
            Interested in this meter?
          </h2>
          <p className='text-background/70 mb-8 max-w-xl mx-auto'>
            Get in touch with our team to discuss pricing, installation, and how
            this meter can fit your property's needs.
          </p>

          <div className='flex flex-col sm:flex-row items-center justify-center gap-4'>
            <Button
              asChild
              size='lg'
              className='bg-primary hover:bg-primary/90'>
              <a
                href='mailto:inquiries@smartflowmetering.com'
                className='inline-flex items-center gap-1.5'>
                <MdMail />
                Email Us
              </a>
            </Button>
            <Button
              asChild
              size='lg'
              className='bg-white text-black hover:bg-white/90'>
              <a
                href='tel:+254725799783'
                className='inline-flex items-center gap-1.5'>
                <MdPhone />
                Call Us
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
