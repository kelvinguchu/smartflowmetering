import { Link } from "@tanstack/react-router";
import { products } from "@/data/products";

export function Footer() {
  return (
    <footer className='border-t bg-foreground text-background'>
      <div className='container mx-auto px-4 py-12 sm:px-6 lg:px-8'>
        <div className='flex flex-col md:flex-row justify-between items-start gap-8'>
          <div className='space-y-4 max-w-xs'>
            <img
              src='/logo-assets/PNG/logo-white.png'
              alt='Smart Flow Metering Limited Logo'
              className='h-20 w-auto object-contain dark:hidden'
            />
            <img
              src='/logo-assets/PNG/logo-black.png'
              alt='Smart Flow Metering Limited Logo'
              className='hidden h-20 w-auto object-contain dark:block'
            />
            <p className='text-sm text-background/70'>
              Empowering landlords and property managers with seamless prepaid
              utility solutions.
            </p>
          </div>

          <div className='grid grid-cols-2 gap-8 sm:grid-cols-4'>
            <div className='space-y-3'>
              <h4 className='text-sm font-medium text-background'>Pages</h4>
              <ul className='space-y-2 text-sm text-background/70'>
                <li>
                  <Link to='/' className='hover:text-primary cursor-pointer'>
                    Home
                  </Link>
                </li>
                <li>
                  <Link
                    to='/about'
                    className='hover:text-primary cursor-pointer'>
                    About Us
                  </Link>
                </li>
                <li>
                  <Link
                    to='/contact'
                    className='hover:text-primary cursor-pointer'>
                    Contact
                  </Link>
                </li>
                <li>
                  <Link
                    to='/register'
                    className='hover:text-primary cursor-pointer'>
                    Register
                  </Link>
                </li>
              </ul>
            </div>
            <div className='space-y-3'>
              <h4 className='text-sm font-medium text-background'>Solutions</h4>
              <ul className='space-y-2 text-sm text-background/70'>
                {products.map((product) => (
                  <li key={product.id}>
                    <Link
                      to='/meters/$meterId'
                      params={{ meterId: product.id }}
                      className='hover:text-primary cursor-pointer'>
                      {product.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div className='space-y-3'>
              <h4 className='text-sm font-medium text-background'>Legal</h4>
              <ul className='space-y-2 text-sm text-background/70'>
                <li>
                  <Link
                    to='/privacy'
                    className='hover:text-primary cursor-pointer'>
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link
                    to='/terms'
                    className='hover:text-primary cursor-pointer'>
                    Terms of Service
                  </Link>
                </li>
              </ul>
            </div>
            <div className='space-y-3'>
              <h4 className='text-sm font-medium text-background'>Contact</h4>
              <ul className='space-y-2 text-sm text-background/70'>
                <li>
                  <a
                    href='mailto:inquiries@smartmetering.africa'
                    className='hover:text-primary cursor-pointer'>
                    inquiries@smartmetering.africa
                  </a>
                </li>
                <li>
                  <a
                    href='tel:+254725799783'
                    className='hover:text-primary cursor-pointer'>
                    +254 725 799 783
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className='mt-12 border-t border-background/20 pt-8 text-center text-sm text-background/70'>
          <p>
            &copy; {new Date().getFullYear()} Smart Flow Metering Limited. All rights
            reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
