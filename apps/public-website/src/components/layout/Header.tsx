import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { MdKeyboardArrowDown, MdMenu, MdClose } from "react-icons/md";
import { products } from "@/data/products";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 w-full transition-all duration-300",
        isScrolled
          ? "border-b border-border/40 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 shadow-sm"
          : "border-transparent bg-transparent",
      )}>
      <div className='container flex h-20 max-w-screen-2xl items-center justify-between px-4 sm:px-8'>
        <div className='flex items-center gap-2 shrink-0'>
          <Link to='/' className='flex items-center cursor-pointer'>
            <img
              src='/logo-assets/PNG/logo-black-orange-horizontal.png'
              alt='Smart Flow Metering Limited Logo'
              className='h-10 w-auto object-contain sm:h-12'
            />
          </Link>
        </div>

        {/* Desktop Navigation */}
        <nav className='hidden md:flex items-center gap-8 text-base font-medium'>
          <Link
            to='/'
            className='transition-colors hover:text-primary cursor-pointer'>
            Home
          </Link>
          <Link
            to='/about'
            className='transition-colors hover:text-primary cursor-pointer'>
            About
          </Link>

          {/* Solutions Dropdown - Pure CSS Hover */}
          <div className='relative group'>
            <button className='flex items-center gap-1.5 transition-colors hover:text-primary cursor-pointer outline-none'>
              Solutions
              <MdKeyboardArrowDown className='text-xl transition-transform duration-200 group-hover:rotate-180' />
            </button>

            {/* Dropdown Menu */}
            <div className='absolute top-full -left-32 pt-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200'>
              <div className='bg-card/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-border/40 p-5 w-130'>
                {/* Group by type */}
                <div className='grid grid-cols-2 gap-4'>
                  {/* Electricity column */}
                  <div className='space-y-1.5'>
                    <span className='text-[0.7rem] font-bold uppercase tracking-widest text-muted-foreground/70 px-2'>
                      Electricity
                    </span>
                    {products
                      .filter((p) => p.type === "Electricity")
                      .map((product) => (
                        <Link
                          key={product.id}
                          to='/meters/$meterId'
                          params={{ meterId: product.id }}
                          className='flex items-start gap-3 px-2 py-2.5 rounded-xl hover:bg-accent/50 cursor-pointer transition-colors group/item'>
                          <div
                            className={cn(
                              "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                              product.bgColor,
                            )}>
                            <product.icon
                              className={cn("text-lg", product.color)}
                            />
                          </div>
                          <div className='min-w-0'>
                            <p className='text-sm font-semibold leading-tight group-hover/item:text-primary transition-colors'>
                              {product.name}
                            </p>
                            <p className='text-xs text-muted-foreground mt-0.5 leading-snug'>
                              {product.tagline}
                            </p>
                          </div>
                        </Link>
                      ))}
                  </div>

                  {/* Water & Gas column */}
                  <div className='space-y-1.5'>
                    <span className='text-[0.7rem] font-bold uppercase tracking-widest text-muted-foreground/70 px-2'>
                      Water & Gas
                    </span>
                    {products
                      .filter((p) => p.type === "Water" || p.type === "Gas")
                      .map((product) => (
                        <Link
                          key={product.id}
                          to='/meters/$meterId'
                          params={{ meterId: product.id }}
                          className='flex items-start gap-3 px-2 py-2.5 rounded-xl hover:bg-accent/50 cursor-pointer transition-colors group/item'>
                          <div
                            className={cn(
                              "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                              product.bgColor,
                            )}>
                            <product.icon
                              className={cn("text-lg", product.color)}
                            />
                          </div>
                          <div className='min-w-0'>
                            <p className='text-sm font-semibold leading-tight group-hover/item:text-primary transition-colors'>
                              {product.name}
                            </p>
                            <p className='text-xs text-muted-foreground mt-0.5 leading-snug'>
                              {product.tagline}
                            </p>
                          </div>
                        </Link>
                      ))}

                    {/* CTA */}
                    <div className='mt-3 pt-3 border-t border-border/30 px-2'>
                      <Link
                        to='/contact'
                        className='text-xs font-semibold text-primary hover:underline cursor-pointer'>
                        Need help choosing? Contact us &rarr;
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <Link
            to='/contact'
            className='transition-colors hover:text-primary cursor-pointer'>
            Contact
          </Link>
        </nav>

        <div className='flex items-center gap-4'>
          <Button
            asChild
            className='hidden sm:inline-flex bg-primary hover:bg-primary/90 text-white text-base shadow-lg shadow-primary/20 cursor-pointer'>
            <Link to='/register'>Register</Link>
          </Button>

          {/* Mobile Menu Button */}
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <button className='md:hidden p-2 cursor-pointer'>
                {isOpen ? (
                  <MdClose className='text-2xl' />
                ) : (
                  <MdMenu className='text-2xl' />
                )}
              </button>
            </SheetTrigger>
            <SheetContent side='right' className='p-0'>
              <SheetHeader className='p-4 border-b'>
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <nav className='flex flex-col p-4'>
                <Link
                  to='/'
                  onClick={() => setIsOpen(false)}
                  className='py-3 text-lg font-medium border-b border-border/30 cursor-pointer'>
                  Home
                </Link>
                <Link
                  to='/about'
                  onClick={() => setIsOpen(false)}
                  className='py-3 text-lg font-medium border-b border-border/30 cursor-pointer'>
                  About
                </Link>
                <Link
                  to='/contact'
                  onClick={() => setIsOpen(false)}
                  className='py-3 text-lg font-medium border-b border-border/30 cursor-pointer'>
                  Contact
                </Link>

                {/* Solutions */}
                <div className='py-3 border-b border-border/30'>
                  <span className='text-sm text-muted-foreground uppercase font-bold tracking-wider'>
                    Solutions
                  </span>
                  <div className='mt-2 space-y-1'>
                    {products.map((product) => (
                      <Link
                        key={product.id}
                        to='/meters/$meterId'
                        params={{ meterId: product.id }}
                        onClick={() => setIsOpen(false)}
                        className='flex items-center gap-2 py-2 cursor-pointer'>
                        <product.icon
                          className={cn("text-base", product.color)}
                        />
                        <span className='font-medium'>{product.name}</span>
                      </Link>
                    ))}
                  </div>
                </div>

                {/* Register Button */}
                <Button
                  asChild
                  className='mt-4 bg-primary hover:bg-primary/90 cursor-pointer'>
                  <Link to='/register' onClick={() => setIsOpen(false)}>
                    Register
                  </Link>
                </Button>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
