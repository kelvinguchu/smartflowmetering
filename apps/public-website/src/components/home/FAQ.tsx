import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "How do I buy electricity tokens?",
    answer:
      "Open M-Pesa on your phone, select Pay Bill, enter our Business Number, then enter your Meter Number as the Account Number and the amount you wish to pay. You will receive a 20-digit token via SMS instantly.",
  },
  {
    question: "What is the minimum token purchase amount?",
    answer:
      "The minimum transaction amount is KES 30. Payments below this threshold will be rejected.",
  },
  {
    question: "How quickly will I receive my token?",
    answer:
      "Tokens are delivered via SMS within 3-8 seconds after your M-Pesa payment is confirmed.",
  },
  {
    question: "Do I need internet access to buy tokens?",
    answer:
      "No. The system works entirely via M-Pesa Paybill, which only requires basic M-Pesa access. No app or internet connection is needed.",
  },
  {
    question: "How do landlords get started with Smart Flow Metering?",
    answer:
      "Landlords can apply online by filling out a self-service form with property and meter details. Once reviewed and approved, your meters are activated and ready for tenant token purchases.",
  },
  {
    question: "What types of meters does Smart Flow Metering support?",
    answer:
      "We support prepaid meters for electricity, water, and gas from brands including Hexing, Stron, and Conlog.",
  },
  {
    question: "How are electricity units calculated?",
    answer:
      "Units are calculated based on the KPLC rate assigned to your meter. A 10% service commission is applied to the amount paid, and the remaining 90% is converted to kWh units.",
  },
];

export function FAQ() {
  return (
    <section className='py-6 md:py-8 bg-secondary/20'>
      <div className='container max-w-screen-2xl px-4 sm:px-8 space-y-8'>
        {/* Header */}
        <div className='flex items-center justify-center gap-2 sm:gap-4 w-full'>
          <div className='h-0.5 bg-primary w-8 sm:w-12 md:w-24 lg:w-32 rounded-full' />
          <h2 className='text-xl sm:text-2xl md:text-4xl lg:text-5xl font-bold tracking-tight font-heading text-center'>
            Frequently Asked <span className='text-primary'>Questions</span>
          </h2>
          <div className='h-0.5 bg-primary w-8 sm:w-12 md:w-24 lg:w-32 rounded-full' />
        </div>

        {/* Accordion */}
        <Accordion
          type='single'
          collapsible
          className='w-full max-w-3xl mx-auto'>
          {faqs.map((faq, index) => (
            <AccordionItem key={index} value={`item-${index}`}>
              <AccordionTrigger className='text-left text-base md:text-lg font-semibold'>
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className='text-muted-foreground'>
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
