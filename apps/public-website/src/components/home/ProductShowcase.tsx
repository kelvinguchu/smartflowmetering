import { Button } from "@/components/ui/button";
import { MdArrowForward } from "react-icons/md";
import { cn } from "@/lib/utils";
import { products } from "@/data/products";
import { Link } from "@tanstack/react-router";

export function ProductShowcase() {
  return (
    <section className='py-6 md:py-8 bg-secondary/20'>
      <div className='container max-w-screen-2xl px-4 sm:px-8 space-y-12'>
        <div className='flex items-center justify-center gap-2 sm:gap-4 w-full'>
          <div className='h-0.5 bg-primary w-8 sm:w-12 md:w-24 lg:w-32 rounded-full' />
          <h2 className='text-2xl sm:text-3xl md:text-5xl font-bold tracking-tight font-heading text-center whitespace-nowrap'>
            Our <span className='text-primary'>Products</span>
          </h2>
          <div className='h-0.5 bg-primary w-8 sm:w-12 md:w-24 lg:w-32 rounded-full' />
        </div>

        <div className='grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8'>
          {products.map((product) => (
            <Link
              key={product.id}
              to='/meters/$meterId'
              params={{ meterId: product.id }}
              className='bg-card rounded-3xl shadow-xl border border-border/50 p-3 h-full transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 group'>
              <div className='flex flex-col h-full gap-3'>
                {/* Image Container */}
                <div className='relative aspect-4/3 w-full overflow-hidden rounded-2xl bg-white dark:bg-white/5'>
                  <div className='absolute bottom-4 left-4 z-10'>
                    <div
                      className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider bg-background/90 backdrop-blur-md border border-border/50 shadow-sm",
                        product.color
                      )}>
                      <product.icon className='text-sm' />
                      {product.type}
                    </div>
                  </div>

                  <img
                    src={product.image}
                    alt={product.name}
                    className='w-full h-full object-contain p-0 transition-transform duration-500 group-hover:scale-105'
                  />
                </div>

                {/* Content Container */}
                <div className='flex flex-col flex-1 p-6 rounded-2xl bg-secondary '>
                  <h3 className='text-xl font-bold font-heading mb-2 group-hover:text-primary transition-colors leading-tight'>
                    {product.name}
                  </h3>

                  <p className='text-sm text-muted-foreground line-clamp-2 mb-2'>
                    {product.description}
                  </p>

                  <div className='mt-auto pt-4 flex items-end justify-between border-t border-border/10'>
                    <div className='flex flex-col'>
                      <span className='text-[10px] text-muted-foreground uppercase font-bold tracking-wider'>
                        Starting at
                      </span>
                      <span className='text-xl font-bold text-foreground'>
                        KES {product.price}
                      </span>
                    </div>
                    <Button
                      size='icon'
                      className='rounded-full h-10 w-10 shrink-0 shadow-sm transition-all duration-300 group-hover:bg-primary group-hover:text-primary-foreground'>
                      <MdArrowForward className='text-lg' />
                    </Button>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
