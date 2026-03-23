"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import BookScreen from "@/app/components/dashboard/assignment/kitap/BookScreen";

function KitapPage() {
  const searchParams = useSearchParams();
  const taskId = searchParams.get("taskId") ?? "";
  return <BookScreen taskId={taskId} />;
}

export default function Page() {
  return (
    <Suspense>
      <KitapPage />
    </Suspense>
  );
}
