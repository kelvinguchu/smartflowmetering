export function TermsOfService() {
  return (
    <section className='py-6 md:py-8'>
      <div className='container max-w-4xl mx-auto px-4 sm:px-8'>
        {/* Header */}
        <div className='text-center mb-6 sm:mb-8'>
          <h1 className='text-2xl sm:text-3xl md:text-4xl font-bold font-heading mb-2'>
            Terms of <span className='text-primary'>Service</span>
          </h1>
          <p className='text-sm text-muted-foreground'>
            Last updated: January 2025
          </p>
        </div>

        {/* Content */}
        <div className='bg-card rounded-2xl border border-border/50 p-5 sm:p-8 space-y-6'>
          <section>
            <h2 className='text-lg sm:text-xl font-bold font-heading mb-3'>
              1. Acceptance of Terms
            </h2>
            <p className='text-muted-foreground leading-relaxed'>
              By accessing and using Smart Flow Metering Limited's services,
              including our prepaid utility metering platform, you agree to be
              bound by these Terms of Service. If you do not agree to these
              terms, please do not use our services.
            </p>
          </section>

          <section>
            <h2 className='text-lg sm:text-xl font-bold font-heading mb-3'>
              2. Description of Services
            </h2>
            <p className='text-muted-foreground leading-relaxed'>
              Smart Flow Metering Limited provides prepaid utility metering
              solutions for electricity, water, and gas. Our services include
              meter installation, token generation via M-Pesa, consumption
              monitoring, and utility management tools for landlords and
              tenants.
            </p>
          </section>

          <section>
            <h2 className='text-lg sm:text-xl font-bold font-heading mb-3'>
              3. User Responsibilities
            </h2>
            <ul className='text-muted-foreground leading-relaxed list-disc list-inside space-y-2'>
              <li>Provide accurate and complete registration information</li>
              <li>Maintain the confidentiality of your account details</li>
              <li>Use the services in compliance with applicable laws</li>
              <li>Promptly report any unauthorized use of your account</li>
              <li>
                Ensure meters are not tampered with or used for unauthorized
                purposes
              </li>
            </ul>
          </section>

          <section>
            <h2 className='text-lg sm:text-xl font-bold font-heading mb-3'>
              4. Payment Terms
            </h2>
            <p className='text-muted-foreground leading-relaxed'>
              All payments for utility tokens are processed via M-Pesa. Tokens
              are delivered instantly upon successful payment. A service
              commission may apply to each transaction. Minimum and maximum
              transaction limits are enforced as per our platform policies.
            </p>
          </section>

          <section>
            <h2 className='text-lg sm:text-xl font-bold font-heading mb-3'>
              5. Limitation of Liability
            </h2>
            <p className='text-muted-foreground leading-relaxed'>
              Smart Flow Metering Limited shall not be liable for any indirect,
              incidental, or consequential damages arising from the use of our
              services. We do not guarantee uninterrupted service and are not
              responsible for utility supply interruptions caused by third-party
              providers.
            </p>
          </section>

          <section>
            <h2 className='text-lg sm:text-xl font-bold font-heading mb-3'>
              6. Termination
            </h2>
            <p className='text-muted-foreground leading-relaxed'>
              We reserve the right to suspend or terminate your access to our
              services for violation of these terms, fraudulent activity, or any
              conduct we deem harmful to our platform or other users.
            </p>
          </section>

          <section>
            <h2 className='text-lg sm:text-xl font-bold font-heading mb-3'>
              7. Changes to Terms
            </h2>
            <p className='text-muted-foreground leading-relaxed'>
              We may update these Terms of Service from time to time. Continued
              use of our services after changes constitutes acceptance of the
              revised terms. We will notify users of significant changes via
              email or platform announcement.
            </p>
          </section>

          <section>
            <h2 className='text-lg sm:text-xl font-bold font-heading mb-3'>
              8. Contact Us
            </h2>
            <p className='text-muted-foreground leading-relaxed'>
              For any questions regarding these Terms of Service, please contact
              us at{" "}
              <a
                href='mailto:inquiries@smartmetering.africa'
                className='text-primary hover:underline'>
                inquiries@smartmetering.africa
              </a>{" "}
              or call{" "}
              <a
                href='tel:+254725101001'
                className='text-primary hover:underline'>
                +254 725 101001
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </section>
  );
}
