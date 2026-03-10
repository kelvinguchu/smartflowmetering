import { motion } from "motion/react";
import {
  MdAppRegistration,
  MdPayment,
  MdMonitorHeart,
  MdPerson,
  MdHome,
  MdBolt,
} from "react-icons/md";
import { cn } from "@/lib/utils";

const tenantFeatures = [
  {
    title: "1. Lipa na M-Pesa",
    description:
      "Go to M-Pesa, select Pay Bill, and enter our Business Number.",
    icon: MdPayment,
    color: "from-emerald-500/20 to-green-500/10",
    iconColor: "text-emerald-500",
  },
  {
    title: "2. Enter Details",
    description: "Use your Meter Number as Account Number, and top-up amount.",
    icon: MdAppRegistration,
    color: "from-blue-500/20 to-sky-500/10",
    iconColor: "text-blue-500",
  },
  {
    title: "3. Receive Token",
    description:
      "Get a 20-digit token instantly via SMS to enter into your meter.",
    icon: MdBolt,
    color: "from-orange-500/20 to-amber-500/10",
    iconColor: "text-orange-500",
  },
];

const landlordFeatures = [
  {
    title: "1. Apply Online",
    description: "Fill the form with property details to get activated.",
    icon: MdHome,
    color: "from-purple-500/20 to-fuchsia-500/10",
    iconColor: "text-purple-500",
  },
  {
    title: "2. Mother Meter Management",
    description:
      "We monitor your main KPLC meter to alert for refills and reconcile bills automatically.",
    icon: MdPerson,
    color: "from-indigo-500/20 to-violet-500/10",
    iconColor: "text-indigo-500",
  },
  {
    title: "3. Track Revenue",
    description:
      "View real-time consumption across all your prepaid sub meters on the dashboard and via SMS.",
    icon: MdMonitorHeart,
    color: "from-teal-500/20 to-emerald-500/10",
    iconColor: "text-teal-500",
  },
];

export function HowItWorks() {
  return (
    <section
      id='how-it-works'
      className='py-24 bg-background relative border-t border-border/40'>
      <div className='container max-w-7xl mx-auto px-6 lg:px-12'>
        {/* Header */}
        <div className='flex items-center justify-center gap-6 mb-20'>
          <div className='h-px bg-border w-16 md:w-32' />
          <h2 className='text-3xl md:text-5xl font-extrabold tracking-tight whitespace-nowrap'>
            How It <span className='text-primary'>Works</span>
          </h2>
          <div className='h-px bg-border w-16 md:w-32' />
        </div>

        <div className='grid lg:grid-cols-2 gap-16 lg:gap-24'>
          {/* Tenants Column */}
          <div className='relative'>
            <div className='mb-10'>
              <h3 className='text-3xl font-bold'>For Tenants</h3>
            </div>

            <div className='space-y-8 relative'>
              {/* Connecting vertical line */}
              <div className='absolute left-8 top-10 bottom-10 w-px bg-border' />

              {tenantFeatures.map((step, i) => (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.15 }}
                  key={step.title}
                  className='relative flex gap-6 bg-card hover:bg-accent/30 p-6 rounded-2xl border border-border/50 transition-colors group z-10'>
                  {/* Icon Area */}
                  <div
                    className={cn(
                      "w-16 h-16 shrink-0 rounded-2xl flex items-center justify-center bg-linear-to-br border border-background shadow-sm",
                      step.color,
                    )}>
                    <step.icon className={cn("text-2xl", step.iconColor)} />
                  </div>

                  {/* Text */}
                  <div>
                    <h4 className='text-lg font-bold mb-2 group-hover:text-primary transition-colors'>
                      {step.title}
                    </h4>
                    <p className='text-muted-foreground leading-relaxed text-sm'>
                      {step.description}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Landlords Column */}
          <div className='relative'>
            <div className='mb-10'>
              <h3 className='text-3xl font-bold'>For Landlords</h3>
            </div>

            <div className='space-y-8 relative'>
              {/* Connecting vertical line */}
              <div className='absolute left-8 top-10 bottom-10 w-px bg-border' />

              {landlordFeatures.map((step, i) => (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.15 }}
                  key={step.title}
                  className='relative flex gap-6 bg-card hover:bg-accent/30 p-6 rounded-2xl border border-border/50 transition-colors group z-10'>
                  {/* Icon Area */}
                  <div
                    className={cn(
                      "w-16 h-16 shrink-0 rounded-2xl flex items-center justify-center bg-linear-to-br border border-background shadow-sm",
                      step.color,
                    )}>
                    <step.icon className={cn("text-2xl", step.iconColor)} />
                  </div>

                  {/* Text */}
                  <div>
                    <h4 className='text-lg font-bold mb-2 group-hover:text-primary transition-colors'>
                      {step.title}
                    </h4>
                    <p className='text-muted-foreground leading-relaxed text-sm'>
                      {step.description}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
