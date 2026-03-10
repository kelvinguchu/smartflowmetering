import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

export function Hero() {
  const [displayText, setDisplayText] = useState("ENTER TOKEN");
  const [cursorVisible, setCursorVisible] = useState(true);
  const isMountedRef = useRef(false);

  // Simulation Sequence
  useEffect(() => {
    isMountedRef.current = true;

    const sequence = async () => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!isMountedRef.current) return;

      // Reset
      setDisplayText("ENTER TOKEN");
      await new Promise((r) => setTimeout(r, 2000));
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!isMountedRef.current) return;

      // Type Token
      const token = "4512 8900 3321 5567 8901";
      setDisplayText("");

      for (const char of token) {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (!isMountedRef.current) return;
        setDisplayText((prev) => prev + char);
        // Random typing speed
        await new Promise((r) => setTimeout(r, Math.random() * 150 + 50));
      }

      await new Promise((r) => setTimeout(r, 500));
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!isMountedRef.current) return;

      // Success
      setDisplayText("CONNECTING...");
      await new Promise((r) => setTimeout(r, 1500));
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!isMountedRef.current) return;

      setDisplayText("SUCCESS: 50.0 Kwh");
      await new Promise((r) => setTimeout(r, 3000));

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (isMountedRef.current) {
        sequence(); // Loop
      }
    };

    sequence();

    // Blinking cursor
    const cursorInterval = setInterval(() => {
      setCursorVisible((v) => !v);
    }, 500);

    return () => {
      isMountedRef.current = false;
      clearInterval(cursorInterval);
    };
  }, []);

  return (
    <section className='relative h-screen overflow-hidden bg-background flex flex-col justify-center'>
      {/* Background Ambience */}
      <div className='absolute inset-0 z-0 overflow-hidden pointer-events-none'>
        {/* Rotating dashed circles */}
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
        {/* Blur effects */}
        <div className='absolute top-[-20%] right-[-10%] w-200 h-200 bg-primary/5 rounded-full blur-[120px]' />
        <div className='absolute bottom-[-10%] left-[-10%] w-150 h-150 bg-accent/5 rounded-full blur-[100px]' />
      </div>

      <div className='container relative z-10 w-full px-4 sm:px-8 flex h-full pt-16 items-center justify-center'>
        <div className='grid gap-8 lg:gap-8 lg:grid-cols-[1fr_auto] items-center'>
          {/* Left Column: Text Content */}
          <div className='flex flex-col justify-center space-y-6 lg:space-y-8 max-w-xl order-2 lg:order-1 text-center lg:text-left mx-auto lg:mx-0'>
            <div className='space-y-3 lg:space-y-4'>
              <h1 className='text-2xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl xl:text-6xl/tight'>
                Smart Utility Management <br />
                <span className='text-primary'>For Modern Living</span>
              </h1>
              <p className='text-muted-foreground text-base sm:text-lg lg:text-xl leading-relaxed max-w-xl mx-auto lg:mx-0'>
                Take control of electricity, water, and gas with our seamless
                prepaid metering platform. Automated billing, remote monitoring,
                and instant tokens.
              </p>
            </div>

            <div className='flex flex-col sm:flex-row gap-3 lg:gap-4 items-center justify-center lg:justify-start'>
              <Button
                asChild
                size='lg'
                className='w-50 sm:w-auto bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/25 text-base lg:text-lg px-6 lg:px-8 h-10 lg:h-12 rounded-full cursor-pointer transition-transform hover:-translate-y-0.5'>
                <Link to='/register'>Get Started</Link>
              </Button>
              <Button
                size='lg'
                variant='outline'
                className='w-50 sm:w-auto text-base lg:text-lg px-6 lg:px-8 h-10 lg:h-12 rounded-full border-2 hover:bg-secondary/50 cursor-pointer transition-transform hover:-translate-y-0.5'
                onClick={() => {
                  document
                    .getElementById("how-it-works")
                    ?.scrollIntoView({ behavior: "smooth" });
                }}>
                How It Works
              </Button>
            </div>
          </div>

          {/* Right Column: Calculator/Meter Graphic */}
          <div className='relative flex justify-center items-center order-1 lg:order-2 h-full max-h-[60vh] lg:max-h-none'>
            {/* Device Container */}
            <motion.div
              initial={{ opacity: 0, y: 30, rotateX: 10 }}
              animate={{ opacity: 1, y: 0, rotateX: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className='relative w-87.5 md:w-112.5 bg-slate-100 dark:bg-slate-900 rounded-[2rem] lg:rounded-[2.5rem] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.3)] border-4 border-slate-200 dark:border-slate-800 p-3 lg:p-5 flex flex-col gap-3 lg:gap-5 transform hover:scale-[1.01] transition-transform duration-500 scale-100 sm:scale-100 lg:scale-95 xl:scale-100 origin-center'
              style={{ perspective: 1000 }}>
              {/* Device Reflection/Gloss */}
              <div className='absolute inset-0 rounded-4xl lg:rounded-[2.5rem] bg-linear-to-tr from-white/40 to-transparent pointer-events-none' />

              {/* Header / Brand Area */}
              <div className='flex justify-between items-center px-1 lg:px-2'>
                <div className='flex gap-2 items-center'>
                  <div className='w-2 h-2 lg:w-2.5 lg:h-2.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]' />
                  <span className='text-[9px] lg:text-[10px] font-bold tracking-widest text-slate-400'>
                    SMART FLOW METERING
                  </span>
                </div>
                <div className='px-1.5 py-0.5 bg-slate-200 dark:bg-slate-800 rounded text-[0.5rem] lg:text-[0.55rem] font-mono text-slate-500'>
                  S/N: 8900231
                </div>
              </div>

              {/* LCD Screen */}
              <div className='bg-[#9ca3af] dark:bg-[#788583] rounded-lg lg:rounded-xl p-2.5 lg:p-3 shadow-inner border-4 border-slate-300 dark:border-slate-700 relative overflow-hidden'>
                <div className='absolute inset-0 bg-linear-to-b from-transparent to-black/5 pointer-events-none' />
                <div className='h-16 lg:h-20 flex flex-col justify-between font-mono'>
                  <div className='flex justify-between text-[0.6rem] lg:text-[0.65rem] text-slate-700 font-bold opacity-70'>
                    <span>L1</span>
                    <span>KwH</span>
                  </div>
                  <div className='text-right text-lg sm:text-xl lg:text-2xl font-bold text-slate-800 tracking-widest break-all leading-tight font-[monospace]'>
                    {displayText}
                    <span
                      className={`${cursorVisible ? "opacity-100" : "opacity-0"} inline-block w-1.5 h-4 lg:w-1.5 lg:h-5 bg-slate-800 ml-1 align-middle`}
                    />
                  </div>
                </div>
              </div>

              {/* Keypad Grid */}
              <div className='grid grid-cols-3 gap-2 px-1'>
                {[
                  "1",
                  "2",
                  "3",
                  "4",
                  "5",
                  "6",
                  "7",
                  "8",
                  "9",
                  "del",
                  "0",
                  "enter",
                ].map((key) => {
                  const isAction = key === "del" || key === "enter";
                  const getKeyDisplay = (k: string): string => {
                    if (k === "enter") return "↵";
                    if (k === "del") return "DEL";
                    return k;
                  };
                  const keyDisplay = getKeyDisplay(key);
                  return (
                    <motion.button
                      key={key}
                      whileTap={{ scale: 0.9 }}
                      className={`
                              h-10 lg:h-12 rounded-full font-bold text-base lg:text-lg shadow-md border-b-4 active:border-b-0 active:translate-y-1 transition-all
                              ${
                                isAction
                                  ? "bg-primary text-white border-primary/40" // Blue keys for actions
                                  : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700" // Standard keys
                              }
                              ${key === "enter" ? "bg-linear-to-r from-green-500 to-emerald-600 border-green-700" : ""}
                              ${key === "del" ? "bg-linear-to-r from-red-500 to-rose-600 border-red-700 text-sm" : ""}
                           `}>
                      {keyDisplay}
                    </motion.button>
                  );
                })}
              </div>

              {/* Bottom Slot */}
              <div className='mx-auto w-1/3 h-1 bg-slate-300 dark:bg-slate-700 rounded-full' />
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
