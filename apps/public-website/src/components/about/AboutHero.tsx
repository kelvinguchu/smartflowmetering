export function AboutHero() {
  return (
    <section className='py-6 md:py-8'>
      <div className='container max-w-screen-2xl px-4 sm:px-8'>
        <div className='flex items-center justify-center gap-2 sm:gap-4 w-full mb-6 sm:mb-8'>
          <div className='h-0.5 bg-primary w-8 sm:w-12 md:w-24 lg:w-32 rounded-full' />
          <h1 className='text-2xl sm:text-3xl md:text-5xl font-bold tracking-tight font-heading text-center whitespace-nowrap'>
            About <span className='text-primary'>Us</span>
          </h1>
          <div className='h-0.5 bg-primary w-8 sm:w-12 md:w-24 lg:w-32 rounded-full' />
        </div>

        <p className='text-base sm:text-lg text-muted-foreground text-center max-w-3xl mx-auto leading-relaxed'>
          Founded in 2025, Smart Flow Metering Limited is dedicated to transforming
          utility management for landlords and tenants across Kenya.
        </p>
      </div>
    </section>
  );
}
