"use client";

function base64ToBlobUrl(base64: string): string {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const blob = new Blob([new Uint8Array(byteNumbers)], { type: "application/pdf" });
  return URL.createObjectURL(blob);
}

export function ViewLabelButton({ label }: { label: string }) {
  function handleClick() {
    window.open(base64ToBlobUrl(label), "_blank");
  }

  return (
    <button onClick={handleClick} className="text-sm font-medium text-blue-600 hover:underline">
      Bekijk label
    </button>
  );
}
