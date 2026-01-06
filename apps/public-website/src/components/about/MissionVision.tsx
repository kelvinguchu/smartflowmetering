import { MdLightbulb, MdVisibility } from "react-icons/md";

export function MissionVision() {
  return (
    <section className='py-6 md:py-8 bg-secondary/20'>
      <div className='container max-w-screen-2xl px-4 sm:px-8'>
        <div className='grid md:grid-cols-2 gap-8'>
          {/* Mission */}
          <div className='bg-card rounded-3xl p-5 sm:p-8 shadow-lg border border-border/50'>
            <div className='flex items-center gap-4 mb-4'>
              <div className='h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center'>
                <MdLightbulb className='text-2xl text-primary' />
              </div>
              <h2 className='text-xl sm:text-2xl font-bold font-heading'>
                Our Mission
              </h2>
            </div>
            <p className='text-muted-foreground leading-relaxed'>
              To empower every Kenyan landlord and tenant with accessible,
              reliable utility management—making electricity, water, and gas
              payments as simple as a single tap on your phone, regardless of
              where you are or what time it is.
            </p>
          </div>

          {/* Vision */}
          <div className='bg-card rounded-3xl p-5 sm:p-8 shadow-lg border border-border/50'>
            <div className='flex items-center gap-4 mb-4'>
              <div className='h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center'>
                <MdVisibility className='text-2xl text-primary' />
              </div>
              <h2 className='text-xl sm:text-2xl font-bold font-heading'>
                Our Vision
              </h2>
            </div>
            <p className='text-muted-foreground leading-relaxed'>
              A Kenya where no tenant ever sits in the dark waiting for
              electricity, and every landlord enjoys peace of mind knowing their
              properties are efficiently managed—building communities powered by
              trust, technology, and transparency.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
