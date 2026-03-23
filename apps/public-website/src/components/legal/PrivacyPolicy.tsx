export function PrivacyPolicy() {
  return (
    <section className='py-6 md:py-8'>
      <div className='container max-w-4xl mx-auto px-4 sm:px-8'>
        {/* Header */}
        <div className='text-center mb-6 sm:mb-8'>
          <h1 className='text-2xl sm:text-3xl md:text-4xl font-bold font-heading mb-2'>
            Privacy <span className='text-primary'>Policy</span>
          </h1>
          <p className='text-sm text-muted-foreground'>
            Last updated: January 2025
          </p>
        </div>

        {/* Content */}
        <div className='bg-card rounded-2xl border border-border/50 p-5 sm:p-8 space-y-6'>
          <section>
            <h2 className='text-lg sm:text-xl font-bold font-heading mb-3'>
              1. Information We Collect
            </h2>
            <p className='text-muted-foreground leading-relaxed mb-3'>
              We collect information you provide directly to us, including:
            </p>
            <ul className='text-muted-foreground leading-relaxed list-disc list-inside space-y-2'>
              <li>Personal details (name, phone number, email, ID number)</li>
              <li>Property information (address, building type)</li>
              <li>Meter details and consumption data</li>
              <li>Payment transaction records via M-Pesa</li>
              <li>Communication preferences and support inquiries</li>
            </ul>
          </section>

          <section>
            <h2 className='text-lg sm:text-xl font-bold font-heading mb-3'>
              2. How We Use Your Information
            </h2>
            <ul className='text-muted-foreground leading-relaxed list-disc list-inside space-y-2'>
              <li>To provide and improve our metering services</li>
              <li>To process payments and generate utility tokens</li>
              <li>To send transaction confirmations and service alerts</li>
              <li>To respond to your inquiries and support requests</li>
              <li>To comply with legal obligations and prevent fraud</li>
            </ul>
          </section>

          <section>
            <h2 className='text-lg sm:text-xl font-bold font-heading mb-3'>
              3. Information Sharing
            </h2>
            <p className='text-muted-foreground leading-relaxed'>
              We do not sell your personal information. We may share your data
              with: M-Pesa/Safaricom for payment processing; property managers
              or landlords as necessary for service delivery; law enforcement
              when required by law; and service providers who assist in our
              operations under strict confidentiality agreements.
            </p>
          </section>

          <section>
            <h2 className='text-lg sm:text-xl font-bold font-heading mb-3'>
              4. Data Security
            </h2>
            <p className='text-muted-foreground leading-relaxed'>
              We implement industry-standard security measures to protect your
              personal information. This includes encrypted data transmission,
              secure servers, and access controls. However, no method of
              transmission over the internet is 100% secure.
            </p>
          </section>

          <section>
            <h2 className='text-lg sm:text-xl font-bold font-heading mb-3'>
              5. Data Retention
            </h2>
            <p className='text-muted-foreground leading-relaxed'>
              We retain your personal information for as long as your account is
              active or as needed to provide services. We may also retain data
              as required by law or for legitimate business purposes such as
              dispute resolution.
            </p>
          </section>

          <section>
            <h2 className='text-lg sm:text-xl font-bold font-heading mb-3'>
              6. Your Rights
            </h2>
            <ul className='text-muted-foreground leading-relaxed list-disc list-inside space-y-2'>
              <li>Access your personal data we hold</li>
              <li>Request correction of inaccurate information</li>
              <li>Request deletion of your data (where applicable)</li>
              <li>Opt out of marketing communications</li>
              <li>Lodge a complaint with relevant authorities</li>
            </ul>
          </section>

          <section>
            <h2 className='text-lg sm:text-xl font-bold font-heading mb-3'>
              7. Cookies and Tracking
            </h2>
            <p className='text-muted-foreground leading-relaxed'>
              Our website may use cookies and similar technologies to enhance
              your experience. These help us analyze usage patterns and improve
              our services. You can control cookie settings through your browser
              preferences.
            </p>
          </section>

          <section>
            <h2 className='text-lg sm:text-xl font-bold font-heading mb-3'>
              8. Contact Us
            </h2>
            <p className='text-muted-foreground leading-relaxed'>
              For privacy-related questions or to exercise your rights, contact
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
