import type { Product } from "@/data/products";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { MdMail, MdPhone } from "react-icons/md";

interface MeterHeroProps {
  product: Product;
}

export function MeterHero({ product }: MeterHeroProps) {
  return (
    <section className='py-6 md:py-8'>
      <div className='container max-w-screen-2xl px-4 sm:px-8'>
        <div className='bg-card rounded-3xl shadow-xl border border-border/50 p-3'>
          <div className='grid lg:grid-cols-2 gap-3 h-full'>
            {/* Image Section */}
            <div className='relative h-62.5 sm:h-87.5 lg:h-auto w-full overflow-hidden rounded-2xl bg-white'>
              <img
                src={product.image}
                alt={product.name}
                className='h-full w-full object-contain p-8 transition-transform duration-700 hover:scale-105'
              />
              <div className='absolute top-4 left-4'>
                <div
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs uppercase font-bold tracking-wider bg-background/90 backdrop-blur-md border border-border/50 shadow-sm",
                    product.color,
                  )}>
                  <product.icon className='text-sm' />
                  {product.type}
                </div>
              </div>
            </div>

            {/* Content Section */}
            <div className='flex flex-col justify-center p-5 sm:p-8 lg:p-12 rounded-2xl bg-secondary/80'>
              <div className='space-y-6'>
                <div className='flex items-center gap-3'>
                  <product.icon size={28} className={product.color} />
                  <span
                    className={cn(
                      "text-sm font-bold uppercase tracking-wider",
                      product.color,
                    )}>
                    {product.tagline}
                  </span>
                </div>

                <div>
                  <h1 className='text-2xl sm:text-3xl lg:text-4xl font-bold font-heading mb-3'>
                    {product.name}
                  </h1>
                  <p className='text-base sm:text-lg text-muted-foreground leading-relaxed'>
                    {product.description}
                  </p>
                </div>

                <div className='pt-4 border-t border-border/30'>
                  <span className='text-sm text-muted-foreground'>
                    Starting at
                  </span>
                  <div className='text-2xl sm:text-3xl font-bold text-primary'>
                    KES {product.price}
                  </div>
                </div>

                <div className='flex flex-col sm:flex-row gap-3 pt-2'>
                  <Button
                    asChild
                    size='lg'
                    className='bg-primary hover:bg-primary/90 rounded-full'>
                    <a
                      href='mailto:inquiries@smartmetering.africa'
                      className='inline-flex items-center gap-1.5'>
                      <MdMail />
                      Email Us
                    </a>
                  </Button>
                  <Button
                    asChild
                    size='lg'
                    variant='outline'
                    className='rounded-full border-2'>
                    <a
                      href='tel:+254725101001'
                      className='inline-flex items-center gap-1.5'>
                      <MdPhone />
                      Call Us
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
