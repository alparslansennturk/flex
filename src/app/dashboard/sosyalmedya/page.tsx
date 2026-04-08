"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import SocialScreen from "@/app/components/dashboard/assignment/social/SocialScreen";

function SosyalMedyaPage() {
  const searchParams = useSearchParams();
  const taskId = searchParams.get("taskId") ?? "";
  return <SocialScreen taskId={taskId} />;
}

export default function Page() {
  return (
    <Suspense>
      <SosyalMedyaPage />
    </Suspense>
  );
}
