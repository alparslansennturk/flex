"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import KolajScreen from "@/app/components/dashboard/assignment/kolaj/KolajScreen";

function KolajPage() {
  const searchParams = useSearchParams();
  const taskId = searchParams.get("taskId") ?? "";
  return <KolajScreen taskId={taskId} />;
}

export default function Page() {
  return (
    <Suspense>
      <KolajPage />
    </Suspense>
  );
}
