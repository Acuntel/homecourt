import { MarketingNav } from "@/components/marketing/marketing-nav";
import { MarketingFooter } from "@/components/marketing/footer";
import { Hero } from "@/components/marketing/hero";
import { FeatureGrid } from "@/components/marketing/feature-grid";

export default function MarketingHome() {
  return (
    <>
      <MarketingNav />
      <main id="main">
        <Hero />
        <FeatureGrid />
      </main>
      <MarketingFooter />
    </>
  );
}
