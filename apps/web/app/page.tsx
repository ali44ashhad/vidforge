import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { catalog } from "@/lib/config";
import { LANGUAGES } from "@vidforge/shared";
import { faqs } from "@/lib/marketing";
import { getAssets } from "@/lib/assets";
import { visitorCountry } from "@/lib/geo";
import tutorials from "@/lib/tutorials.json";
import Navbar from "@/components/marketing/Navbar";
import Hero from "@/components/marketing/Hero";
import MetricStrip from "@/components/marketing/MetricStrip";
import OutputShowcase from "@/components/marketing/OutputShowcase";
import PlatformPillars from "@/components/marketing/PlatformPillars";
import JourneyRoadmap from "@/components/marketing/JourneyRoadmap";
import CreatorStories from "@/components/marketing/CreatorStories";
import TemplatesShowcase from "@/components/marketing/TemplatesShowcase";
import Academy from "@/components/marketing/Academy";
import FeatureGrid from "@/components/marketing/FeatureGrid";
import Pricing from "@/components/marketing/Pricing";
import FAQ from "@/components/marketing/FAQ";
import CTASection from "@/components/marketing/CTASection";
import Footer from "@/components/marketing/Footer";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Y2ube — AI YouTube Video Creator & Channel Growth Platform",
  description: "Create complete YouTube videos from a prompt with AI scripts, visuals, voiceovers, captions, thumbnails and SEO. Publish faster and build your channel with Y2ube.",
  alternates: { canonical: "https://y2ube.io/" },
  openGraph: { title: "Y2ube — Create videos. Build your channel. Reach monetization.", description: "From one prompt to a publish-ready YouTube video.", images: ["/assets/y2ube/gen/og.jpg"] },
};

export default async function LandingPage() {
  const user = await getUser();
  if (user) redirect("/dashboard");
  const { templates, plans } = await catalog();
  const A = getAssets();
  const country = await visitorCountry();
  const facts: [string, string][] = [[`${templates.length}`, "video formats with playbooks"], [`${LANGUAGES.length}`, "languages incl. Hindi & Punjabi"], ["60", "free credits at sign-up"], ["1-click", "YouTube publish & schedule"]];
  const faqSchema = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) };
  const appSchema = { "@context": "https://schema.org", "@type": "SoftwareApplication", name: "Y2ube", applicationCategory: "MultimediaApplication", operatingSystem: "Web", offers: { "@type": "Offer", price: "0", priceCurrency: "INR" } };
  return (
    <div className="min-h-screen">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([faqSchema, appSchema]) }} />
      <Navbar />
      <main>
        <Hero previewImage={A.outputDemo} demo={(tutorials.items as { id: string; url: string; title: string }[]).find((t) => t.id === "demo") ?? null} />
        <MetricStrip facts={facts} />
        <OutputShowcase image={A.outputDemo} video={(tutorials.items as { id: string; url: string }[]).find((t) => t.id === "showreel")?.url ?? null} />
        <PlatformPillars image={A.pillarPublish} />
        <JourneyRoadmap image={A.templates.documentary} />
        <CreatorStories />
        <TemplatesShowcase total={templates.length} images={A.templates} />
        <Academy images={A.academy} />
        <FeatureGrid />
        <Pricing plans={plans} country={country} />
        <FAQ />
        <CTASection images={A.cta} />
      </main>
      <Footer />
    </div>
  );
}
