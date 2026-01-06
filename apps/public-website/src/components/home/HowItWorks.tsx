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

const tenantSteps = [
  {
    id: 1,
    title: "Lipa na M-Pesa",
    description:
      "Go to your M-Pesa menu, select Pay Bill, and enter our Business Number.",
    icon: MdPayment,
    color: "text-green-500",
    bgColor: "bg-green-50 dark:bg-green-950/30",
    borderColor: "border-green-200 dark:border-green-900",
  },
  {
    id: 2,
    title: "Enter Details",
    description:
      "Enter your Meter Number as the Account Number, then the amount you wish to top up.",
    icon: MdAppRegistration,
    color: "text-blue-500",
    bgColor: "bg-blue-50 dark:bg-blue-950/30",
    borderColor: "border-blue-200 dark:border-blue-900",
  },
  {
    id: 3,
    title: "Receive Token",
    description:
      "You will receive a 20-digit token via SMS instantly. Enter it into your meter to get power.",
    icon: MdBolt,
    color: "text-orange-500",
    bgColor: "bg-orange-50 dark:bg-orange-950/30",
    borderColor: "border-orange-200 dark:border-orange-900",
  },
];

const landlordSteps = [
  {
    id: 1,
    title: "Apply Online",
    description:
      "Fill out the self-service form with your property and meter details. We'll review and activate your account.",
    icon: MdHome,
    color: "text-purple-500",
    bgColor: "bg-purple-50 dark:bg-purple-950/30",
    borderColor: "border-purple-200 dark:border-purple-900",
  },
  {
    id: 2,
    title: "Mother Meter Mgmt",
    description:
      "We monitor your main KPLC meter. Alerts are sent for refills or bills are automatically reconciled.",
    icon: MdPerson,
    color: "text-indigo-500",
    bgColor: "bg-indigo-50 dark:bg-indigo-950/30",
    borderColor: "border-indigo-200 dark:border-indigo-900",
  },
  {
    id: 3,
    title: "Track Revenue",
    description:
      "View real-time consumption and revenue from all your sub-meters through our dashboard.",
    icon: MdMonitorHeart,
    color: "text-teal-500",
    bgColor: "bg-teal-50 dark:bg-teal-950/30",
    borderColor: "border-teal-200 dark:border-teal-900",
  },
];

export function HowItWorks() {
  return (
    <section
      id='how-it-works'
      className='py-6 md:py-8 relative overflow-hidden'>
      {/* Background Decor */}
      <div className='absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] bg-[radial-gradient(circle_at_center,var(--primary-foreground)_0%,transparent_70%)] opacity-50 z-0 pointer-events-none' />

      <div className='container relative z-10 max-w-screen-2xl px-4 sm:px-8 space-y-8'>
        {/* Main Header */}
        <div className='flex items-center justify-center gap-4 w-full'>
          <div className='h-0.5 bg-primary w-12 md:w-24 lg:w-32 rounded-full' />
          <h2 className='text-3xl md:text-5xl font-bold tracking-tight font-heading text-center whitespace-nowrap'>
            How It <span className='text-primary'>Works</span>
          </h2>
          <div className='h-0.5 bg-primary w-12 md:w-24 lg:w-32 rounded-full' />
        </div>

        {/* Tenant Section */}
        <div className='relative w-full'>
          <div className='text-center mb-12 w-full'>
            <h3 className='text-2xl md:text-3xl font-bold font-heading inline-block relative'>
              For Tenants
              <div className='absolute -bottom-2 left-0 right-0 h-1 bg-primary/20 rounded-full' />
            </h3>
          </div>

          <div className='grid grid-cols-1 md:grid-cols-3 gap-8 relative'>
            {/* Connector Line (Desktop) */}
            <div className='hidden md:block absolute top-12 left-[16%] right-[16%] h-0.5 bg-linear-to-r from-border/0 via-border to-border/0 z-0' />

            {tenantSteps.map((step, index) => (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className='relative flex flex-col items-center text-center z-10 group'>
                {/* Icon Container with pulsing effect */}
                <div className='relative mb-6'>
                  <div
                    className={cn(
                      "absolute inset-0 rounded-full blur-xl opacity-20 group-hover:opacity-40 transition-opacity duration-500",
                      step.bgColor.replace("/30", "")
                    )}
                  />
                  <motion.div
                    whileHover={{ scale: 1.1, rotate: [0, -5, 5, 0] }}
                    transition={{ type: "spring", stiffness: 300 }}
                    className={cn(
                      "relative w-24 h-24 rounded-3xl flex items-center justify-center shadow-xl border-2 backdrop-blur-sm transition-all duration-300",
                      step.bgColor,
                      step.borderColor
                    )}>
                    <step.icon className={cn("text-4xl", step.color)} />
                    <div className='absolute -top-3 -right-3 w-8 h-8 rounded-full bg-background border border-border shadow-md flex items-center justify-center font-bold text-sm text-muted-foreground'>
                      {step.id}
                    </div>
                  </motion.div>
                </div>

                <h3 className='text-xl font-bold font-heading mb-3 group-hover:text-primary transition-colors duration-300'>
                  {step.title}
                </h3>

                <p className='text-muted-foreground leading-relaxed text-sm'>
                  {step.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Landlord Section */}
        <div className='relative w-full'>
          <div className='text-center mb-12 w-full'>
            <h3 className='text-2xl md:text-3xl font-bold font-heading inline-block relative'>
              For Landlords
              <div className='absolute -bottom-2 left-0 right-0 h-1 bg-primary/20 rounded-full' />
            </h3>
          </div>

          <div className='grid grid-cols-1 md:grid-cols-3 gap-8 relative'>
            {/* Connector Line (Desktop) */}
            <div className='hidden md:block absolute top-12 left-[16%] right-[16%] h-0.5 bg-linear-to-r from-border/0 via-border to-border/0 z-0' />

            {landlordSteps.map((step, index) => (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className='relative flex flex-col items-center text-center z-10 group'>
                {/* Icon Container with pulsing effect */}
                <div className='relative mb-6'>
                  <div
                    className={cn(
                      "absolute inset-0 rounded-full blur-xl opacity-20 group-hover:opacity-40 transition-opacity duration-500",
                      step.bgColor.replace("/30", "")
                    )}
                  />
                  <motion.div
                    whileHover={{ scale: 1.1, rotate: [0, -5, 5, 0] }}
                    transition={{ type: "spring", stiffness: 300 }}
                    className={cn(
                      "relative w-24 h-24 rounded-3xl flex items-center justify-center shadow-xl border-2 backdrop-blur-sm transition-all duration-300",
                      step.bgColor,
                      step.borderColor
                    )}>
                    <step.icon className={cn("text-4xl", step.color)} />
                    <div className='absolute -top-3 -right-3 w-8 h-8 rounded-full bg-background border border-border shadow-md flex items-center justify-center font-bold text-sm text-muted-foreground'>
                      {step.id}
                    </div>
                  </motion.div>
                </div>

                <h3 className='text-xl font-bold font-heading mb-3 group-hover:text-primary transition-colors duration-300'>
                  {step.title}
                </h3>

                <p className='text-muted-foreground leading-relaxed text-sm'>
                  {step.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
