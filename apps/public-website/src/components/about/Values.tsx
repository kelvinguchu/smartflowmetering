import { MdLightbulb, MdVisibility, MdGroups } from "react-icons/md";

export function Values() {
  return (
    <section className='py-6 md:py-8'>
      <div className='container max-w-screen-2xl px-4 sm:px-8'>
        <div className='text-center mb-8 sm:mb-12'>
          <h2 className='text-xl sm:text-2xl md:text-3xl font-bold font-heading'>
            What We Stand For
          </h2>
        </div>

        <div className='grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6'>
          <div className='text-center p-4 sm:p-6'>
            <div className='h-16 w-16 rounded-full bg-green-100 dark:bg-green-950/30 flex items-center justify-center mx-auto mb-4'>
              <MdGroups className='text-3xl text-green-600' />
            </div>
            <h3 className='text-lg font-bold font-heading mb-2'>
              Customer First
            </h3>
            <p className='text-sm text-muted-foreground'>
              Every feature we build starts with the needs of landlords and
              tenants in mind.
            </p>
          </div>

          <div className='text-center p-4 sm:p-6'>
            <div className='h-16 w-16 rounded-full bg-blue-100 dark:bg-blue-950/30 flex items-center justify-center mx-auto mb-4'>
              <MdLightbulb className='text-3xl text-blue-600' />
            </div>
            <h3 className='text-lg font-bold font-heading mb-2'>Simplicity</h3>
            <p className='text-sm text-muted-foreground'>
              We believe utility payments should be as easy as sending a text
              message.
            </p>
          </div>

          <div className='text-center p-4 sm:p-6'>
            <div className='h-16 w-16 rounded-full bg-orange-100 dark:bg-orange-950/30 flex items-center justify-center mx-auto mb-4'>
              <MdVisibility className='text-3xl text-orange-600' />
            </div>
            <h3 className='text-lg font-bold font-heading mb-2'>
              Transparency
            </h3>
            <p className='text-sm text-muted-foreground'>
              Clear pricing, real-time tracking, and honest communication at
              every step.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
