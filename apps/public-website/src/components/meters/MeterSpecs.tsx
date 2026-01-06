import type { Product } from "@/data/products";
import { MdOutlineCheckCircle } from "react-icons/md";
import { cn } from "@/lib/utils";

interface MeterSpecsProps {
  product: Product;
}

export function MeterSpecs({ product }: MeterSpecsProps) {
  return (
    <section className='py-6 md:py-8 bg-secondary/20'>
      <div className='container max-w-screen-2xl px-4 sm:px-8'>
        <div className='flex items-center justify-center gap-2 sm:gap-4 w-full mb-6 sm:mb-8'>
          <div className='h-0.5 bg-primary w-8 sm:w-12 md:w-24 lg:w-32 rounded-full' />
          <h2 className='text-xl sm:text-2xl md:text-3xl font-bold tracking-tight font-heading text-center'>
            Why Choose <span className='text-primary'>This Meter</span>
          </h2>
          <div className='h-0.5 bg-primary w-8 sm:w-12 md:w-24 lg:w-32 rounded-full' />
        </div>

        <div className='grid md:grid-cols-2 gap-6'>
          {/* Features */}
          <div className='bg-card rounded-3xl shadow-xl border border-border/50 p-3'>
            <div className='p-4 sm:p-6 lg:p-8 rounded-2xl bg-secondary/80 h-full'>
              <div className='flex items-center gap-3 mb-4 sm:mb-6'>
                <product.icon size={24} className={product.color} />
                <h3 className='text-lg sm:text-xl font-bold font-heading'>
                  Key Features
                </h3>
              </div>
              <ul className='space-y-4'>
                {product.features.map((feature, index) => (
                  <li key={index} className='flex items-start gap-3'>
                    <MdOutlineCheckCircle
                      className={cn("mt-0.5 text-xl shrink-0", product.color)}
                    />
                    <span className='font-medium text-foreground/90'>
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Ideal For */}
          <div className='bg-card rounded-3xl shadow-xl border border-border/50 p-3'>
            <div className='p-4 sm:p-6 lg:p-8 rounded-2xl bg-secondary/80 h-full'>
              <div className='flex items-center gap-3 mb-4 sm:mb-6'>
                <product.icon size={24} className={product.color} />
                <h3 className='text-lg sm:text-xl font-bold font-heading'>
                  Ideal For
                </h3>
              </div>
              <ul className='space-y-4'>
                {product.idealFor.map((use, index) => (
                  <li key={index} className='flex items-start gap-3'>
                    <MdOutlineCheckCircle
                      className={cn("mt-0.5 text-xl shrink-0", product.color)}
                    />
                    <span className='font-medium text-foreground/90'>
                      {use}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
