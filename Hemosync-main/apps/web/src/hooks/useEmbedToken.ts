import { useState, useEffect } from "react";
import { getEmbedToken } from "@/lib/api-client";

export interface EmbedTokenHook {
  embedUrl: string | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
}

export function useEmbedToken(): EmbedTokenHook {
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    setIsLoading(true);
    setError(null);

    getEmbedToken()
      .then((data) => {
        if (!cancelled) {
          setEmbedUrl(data.embedUrl);
          setToken(data.token);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to fetch embed token",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { embedUrl, token, isLoading, error };
}
