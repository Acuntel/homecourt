import { OnboardingProgress } from "@/components/onboarding/onboarding-progress";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex w-full flex-col gap-6">
      <OnboardingProgress />
      {children}
    </div>
  );
}
