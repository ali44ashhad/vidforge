import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
export default function CTASection({ images }: { images: string[] }) {
  return (
    <section className="mx-auto max-w-7xl px-5 py-10">
      <div className="grid items-center gap-8 overflow-hidden rounded-3xl bg-gradient-to-r from-[#7357FF] via-[#5f5bff] to-[#4776FF] p-8 text-white md:grid-cols-[1fr_1fr] md:p-12">
        <div>
          <h2 className="display text-3xl font-bold leading-tight md:text-5xl">Ready to start your creator journey?</h2>
          <p className="mt-4 text-lg text-white/85">Turn your ideas into complete videos and build your channel from one creator workspace.</p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row"><Link href="/signup" className="flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 font-semibold text-[#5B5AF7]">Create your first video <ArrowRight size={18} /></Link><a href="#templates" className="rounded-xl border border-white/40 px-5 py-3 text-center font-medium">Explore templates</a></div>
        </div>
        <div className="relative mx-auto hidden h-64 w-full max-w-md sm:block md:h-72">
          <Image src={images[1]} width={640} height={360} alt="" className="absolute right-0 top-0 w-3/5 rotate-3 rounded-xl border border-white/30 object-cover shadow-md" />
          <Image src={images[2]} width={640} height={360} alt="" className="absolute bottom-0 right-6 w-3/5 -rotate-2 rounded-xl border border-white/30 object-cover shadow-md" />
          <Image src={images[0]} width={480} height={640} alt="Creator" className="absolute left-0 top-6 w-[42%] -rotate-6 rounded-xl border border-white/30 object-cover shadow-md" />
        </div>
      </div>
    </section>
  );
}
