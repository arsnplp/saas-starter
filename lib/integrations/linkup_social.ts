// lib/integrations/linkup_social.ts
const BASE = process.env.LINKUP_API_BASE || "https://api.linkupapi.com";
const KEY = process.env.LINKUP_API_KEY || "";
const MOCK = process.env.LINKUP_MOCK === "1"; // <- active les données factices

async function postJson<T>(path: string, body: unknown): Promise<T> {
    if (!KEY) {
        throw new Error("LINKUP_API_KEY manquante (vérifie .env et redémarre pnpm dev)");
    }

    const url = `${BASE}${path}`;
    const res = await fetch(url, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            "x-api-key": KEY,
        },
        body: JSON.stringify(body ?? {}),
        cache: "no-store",
    });

    if (!res.ok) {
        const txt = await res.text().catch(() => "");
        console.error("Linkup API error", res.status, txt);
        throw new Error(`Linkup API ${res.status}`);
    }
    return (await res.json()) as T;
}

type Reaction = { profileUrl?: string; name?: string | null };
type Comment  = { profileUrl?: string; name?: string | null; text?: string | null };

export async function fetchReactions(postUrl: string, total = 200): Promise<Reaction[]> {
    if (MOCK) {
        // 5 "likeurs" factices
        return Array.from({ length: 5 }, (_, i) => ({
            profileUrl: `https://www.linkedin.com/in/mock-user-${i + 1}`,
            name: `Mock User ${i + 1}`,
        }));
    }

    const data = await postJson<{ results: Reaction[] }>(
        "/v1/data/signals/posts/reactions",
        { post_url: postUrl, total_results: total }
    );
    return data.results ?? [];
}

export async function fetchComments(postUrl: string, total = 200): Promise<Comment[]> {
    if (MOCK) {
        // 2 commentaires factices
        return [
            { profileUrl: "https://www.linkedin.com/in/mock-user-3", name: "Mock User 3", text: "Top post!" },
            { profileUrl: "https://www.linkedin.com/in/mock-user-4", name: "Mock User 4", text: "Interested." },
        ];
    }

    const data = await postJson<{ results: Comment[] }>(
        "/v1/data/signals/posts/comments",
        { post_url: postUrl, total_results: total }
    );
    return data.results ?? [];
}
