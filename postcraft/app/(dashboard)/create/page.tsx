"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CreateWizard } from "@/components/create/wizard";
import { Spinner } from "@/components/ui/primitives";

function CreateWithParams() {
  const params = useSearchParams();
  return <CreateWizard preloadDesignId={params.get("design")} />;
}

export default function CreatePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-32">
          <Spinner className="w-6 h-6" />
        </div>
      }
    >
      <CreateWithParams />
    </Suspense>
  );
}
