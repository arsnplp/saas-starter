"use client";

import { useState } from "react";

export default function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);

    async function handleCopy() {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            // rien : si le navigateur bloque, on ne plante pas l'UI
        }
    }

    return (
        <button
            type="button"
            onClick={handleCopy}
            className="text-xs border rounded px-2 py-1"
            aria-label="Copier le message"
            title="Copier le message"
        >
            {copied ? "Copié ✓" : "Copier"}
        </button>
    );
}
