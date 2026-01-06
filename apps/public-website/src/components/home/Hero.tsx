import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { MdBolt, MdWaterDrop, MdCheck, MdBarChart } from "react-icons/md";

import { motion } from "motion/react";

export function Hero() {
  return (
    <section className='relative overflow-hidden bg-background'>
      {/* CSS Graphic Background with Motion */}
      <div className='absolute inset-0 z-0 overflow-hidden pointer-events-none'>
        {/* Deep Background Elements - Bottom Layer */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
          className='absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full border-[3px] border-primary border-dashed opacity-20'
        />
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 80, repeat: Infinity, ease: "linear" }}
          className='absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full border-[3px] border-secondary border-dashed opacity-20'
        />
        <motion.div
          animate={{
            y: [0, -40, 0],
            x: [0, 20, 0],
            opacity: [0.5, 0.8, 0.5],
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          className='absolute top-[20%] left-[10%] w-32 h-32 bg-primary/40 rounded-full blur-2xl'
        />
        <motion.div
          animate={{
            y: [0, 60, 0],
            x: [0, -30, 0],
            opacity: [0.5, 0.8, 0.5],
          }}
          transition={{
            duration: 18,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 2,
          }}
          className='absolute bottom-[30%] right-[20%] w-48 h-48 bg-secondary/40 rounded-full blur-[50px]'
        />

        <motion.div
          animate={{
            x: [0, 100, 0],
            y: [0, -50, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "linear",
          }}
          className='absolute left-[20%] top-0 h-[800px] w-[800px] -translate-x-1/2 -translate-y-[20%] rounded-full bg-primary/5 blur-[120px]'
        />
        <motion.div
          animate={{
            x: [0, -70, 0],
            y: [0, 100, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "linear",
          }}
          className='absolute right-0 top-[20%] h-[600px] w-[600px] translate-x-1/3 rounded-full bg-secondary/30 blur-[100px] opacity-60'
        />
        <motion.div
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          className='absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 blur-[150px] rounded-full'
        />
      </div>

      {/* Container with min-height matching viewport minus header */}
      <div className='container relative z-10 max-w-screen-2xl px-4 sm:px-8 flex min-h-screen pt-16 md:pt-28 items-center'>
        <div className='grid gap-8 lg:grid-cols-2 lg:gap-12 items-center w-full py-8 md:py-12'>
          {/* Mobile: Graphic first, then text. Desktop: Text left, graphic right */}
          <div className='flex flex-col justify-center space-y-6 max-w-[65ch] order-2 lg:order-1'>
            <div className='space-y-4'>
              <h1 className='text-4xl font-extrabold tracking-tight sm:text-5xl xl:text-6xl/none font-heading'>
                Smart Utility Management for{" "}
                <span className='text-primary'>Modern Living</span>
              </h1>
              <p className='text-muted-foreground md:text-xl leading-relaxed'>
                Take control of electricity, water, and gas with our seamless
                prepaid metering platform. Automated billing, remote monitoring,
                and instant tokens.
              </p>
            </div>

            <div className='flex flex-col sm:flex-row gap-4'>
              <Button
                asChild
                size='lg'
                className='bg-primary hover:bg-primary/90 text-white shadow-xl shadow-primary/20 text-lg px-8 h-12 rounded-full cursor-pointer'>
                <Link to='/register'>Register</Link>
              </Button>
              <Button
                size='lg'
                variant='outline'
                className='text-lg px-8 h-12 rounded-full border-2 hover:bg-secondary/50 cursor-pointer'
                onClick={() => {
                  document
                    .getElementById("how-it-works")
                    ?.scrollIntoView({ behavior: "smooth" });
                }}>
                How It Works
              </Button>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className='relative mx-auto w-full max-w-[500px] lg:max-w-none flex flex-col justify-center items-center lg:items-end order-1 lg:order-2'>
            {/* Abstract back glow for depth since card is gone */}
            <div className='absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-contain bg-center opacity-20 pointer-events-none radial-gradient(circle, var(--primary) 0%, transparent 70%)' />

            <div className='relative w-full max-w-[500px] space-y-6'>
              {/* Floating Chart Element */}
              <motion.div
                animate={{ y: [0, -15, 0] }}
                transition={{
                  duration: 6,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className='bg-card rounded-2xl shadow-2xl border border-border/50 p-6 relative overflow-hidden transform hover:scale-[1.02] transition-transform duration-500'>
                <div className='absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl -z-10' />
                <div className='flex justify-between items-center mb-6'>
                  <div className='h-4 w-32 bg-foreground/10 rounded-full' />
                  <div className='h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary'>
                    <MdBarChart className='text-xl' />
                  </div>
                </div>
                <div className='flex items-end justify-between h-40 gap-2'>
                  {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
                    <motion.div
                      key={i}
                      initial={{ height: 0 }}
                      animate={{ height: `${h}%` }}
                      transition={{ duration: 0.8, delay: i * 0.1 }}
                      className='w-full bg-primary rounded-t-sm'
                      style={{ opacity: 0.6 + i * 0.05 }}
                    />
                  ))}
                </div>
              </motion.div>

              {/* Floating Grid Elements */}
              <div className='grid grid-cols-2 gap-4'>
                <motion.div
                  animate={{ y: [0, 10, 0] }}
                  transition={{
                    duration: 5,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: 1,
                  }}
                  className='h-24 bg-card rounded-2xl shadow-xl border border-border/50 p-4 flex flex-col justify-between hover:-translate-y-1 transition-transform duration-300'>
                  <div className='flex justify-between items-start'>
                    <div className='h-10 w-10 rounded-xl bg-orange-100 flex items-center justify-center text-primary text-xl'>
                      <MdBolt size={24} />
                    </div>
                    <div className='h-2 w-8 bg-green-500/20 rounded-full' />
                  </div>
                  <div className='h-3 w-20 bg-foreground/10 rounded-full' />
                </motion.div>
                <motion.div
                  animate={{ y: [0, -10, 0] }}
                  transition={{
                    duration: 5.5,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: 0.5,
                  }}
                  className='h-24 bg-card rounded-2xl shadow-xl border border-border/50 p-4 flex flex-col justify-between hover:-translate-y-1 transition-transform duration-300'>
                  <div className='flex justify-between items-start'>
                    <div className='h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-500 text-xl'>
                      <MdWaterDrop size={24} />
                    </div>
                    <div className='h-2 w-8 bg-green-500/20 rounded-full' />
                  </div>
                  <div className='h-3 w-20 bg-foreground/10 rounded-full' />
                </motion.div>
              </div>

              {/* Floating Success Badge */}
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className='hidden sm:block absolute right-0 sm:-right-4 top-1/2 -translate-y-1/2 bg-card p-4 rounded-xl shadow-xl border border-border'>
                <div className='flex items-center gap-3'>
                  <div className='h-10 w-10 rounded-full bg-green-100 flex items-center justify-center text-green-600'>
                    <MdCheck size={20} />
                  </div>
                  <div>
                    <div className='h-2 w-20 bg-foreground/10 rounded-full mb-1' />
                    <div className='h-2 w-12 bg-foreground/5 rounded-full' />
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
