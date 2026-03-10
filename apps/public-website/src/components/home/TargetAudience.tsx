import {
  MdOutlineHome,
  MdOutlineStore,
  MdOutlineFactory,
  MdOutlineCheckCircle,
} from "react-icons/md";
import { cn } from "@/lib/utils";

const sectors = [
  {
    id: "residential",
    title: "Residential Buildings",
    tagline: "Smart living for modern communities",
    description:
      "Empower tenants and property managers with prepaid sub meters for precise, real-time consumption tracking. Our residential sub metering solutions eliminate billing disputes and improve collection efficiency.",
    details: [
      "Individual unit prepaid sub metering",
      "M-Pesa token payments for tenants",
      "Automated billing & notifications",
      "Leak detection & alerts",
    ],
    image: "/assets/residential-building.jpg",
    icon: MdOutlineHome,
    color: "text-orange-500",
  },
  {
    id: "commercial",
    title: "Commercial Complexes",
    tagline: "Efficient operations for business hubs",
    description:
      "Streamline utility management for shopping malls, office complexes, and mixed-use developments with prepaid sub meters. Ensure accurate cost allocation and recover utility expenses via token metering.",
    details: [
      "Multi-tariff sub meter management",
      "Common area cost allocation",
      "Peak load monitoring",
      "Integration with BMS",
    ],
    image: "/assets/commercial-building.jpg",
    icon: MdOutlineStore,
    color: "text-blue-500",
  },
  {
    id: "industrial",
    title: "Industrial Facilities",
    tagline: "High-capacity solutions for factories",
    description:
      "Prepaid 3-phase sub meters optimized for high-consumption environments. Monitor power quality, manage demand, and reduce operational costs with industrial-grade precision.",
    details: [
      "3-phase sub metering",
      "Power factor monitoring",
      "Demand side management",
      "Shift-based consumption analysis",
    ],
    image: "/assets/industrialfactory-building.jpg",
    icon: MdOutlineFactory,
    color: "text-slate-700",
  },
];

export function TargetAudience() {
  return (
    <section className='py-6 md:py-8 bg-background relative overflow-hidden'>
      <div className='container max-w-screen-2xl px-4 sm:px-8 space-y-8'>
        <div className='flex items-center justify-center gap-2 sm:gap-4 w-full'>
          <div className='h-0.5 bg-primary w-8 sm:w-12 md:w-24 lg:w-32 rounded-full' />
          <h2 className='text-2xl sm:text-3xl md:text-5xl font-bold tracking-tight font-heading text-center whitespace-nowrap'>
            Sectors <span className='text-primary'>We Serve</span>
          </h2>
          <div className='h-0.5 bg-primary w-8 sm:w-12 md:w-24 lg:w-32 rounded-full' />
        </div>

        <div className='space-y-12'>
          {sectors.map((sector, index) => (
            <div
              key={sector.id}
              className='bg-card rounded-3xl shadow-xl border border-border/50 p-3'>
              <div
                className={cn(
                  "grid lg:grid-cols-2 gap-3 h-full",
                  index % 2 !== 0 && "lg:grid-flow-dense",
                )}>
                {/* Image Section */}
                <div
                  className={cn(
                    "relative h-62.5 sm:h-87.5 lg:h-auto w-full overflow-hidden rounded-2xl",
                    index % 2 !== 0 && "lg:col-start-2",
                  )}>
                  <img
                    src={sector.image}
                    alt={sector.title}
                    className='h-full w-full object-cover transition-transform duration-700 hover:scale-105'
                  />
                  <div className='absolute inset-0 bg-black/10 hover:bg-transparent transition-colors duration-500' />
                </div>

                <div
                  className={cn(
                    "flex flex-col justify-center p-5 sm:p-8 lg:p-12 rounded-2xl h-full",
                    "bg-secondary/80 dark:bg-secondary/20",
                  )}>
                  <div className='space-y-6'>
                    <div className='flex items-center gap-3'>
                      <sector.icon size={28} className={sector.color} />
                      <span
                        className={cn(
                          "text-sm font-bold uppercase tracking-wider",
                          sector.color,
                        )}>
                        {sector.title}
                      </span>
                    </div>

                    <div>
                      <h3 className='text-xl sm:text-2xl lg:text-3xl font-bold font-heading mb-3'>
                        {sector.tagline}
                      </h3>
                      <p className='text-lg text-muted-foreground leading-relaxed'>
                        {sector.description}
                      </p>
                    </div>

                    <ul className='space-y-3 pt-4'>
                      {sector.details.map((detail, i) => (
                        <li key={i} className='flex items-start gap-3'>
                          <MdOutlineCheckCircle
                            className={cn(
                              "mt-1 text-xl shrink-0 opacity-80",
                              sector.color,
                            )}
                          />
                          <span className='font-medium text-foreground/90'>
                            {detail}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
