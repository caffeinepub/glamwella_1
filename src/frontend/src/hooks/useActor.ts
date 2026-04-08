import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { backendInterface } from "../backend";
import { createActorWithConfig } from "../config";
import { getSecretParameter } from "../utils/urlParams";
import { useInternetIdentity } from "./useInternetIdentity";

const ACTOR_QUERY_KEY = "actor";
export function useActor() {
  const { identity } = useInternetIdentity();
  const queryClient = useQueryClient();
  const actorQuery = useQuery<backendInterface>({
    queryKey: [ACTOR_QUERY_KEY, identity?.getPrincipal().toString()],
    queryFn: async () => {
      const isAuthenticated = !!identity;

      if (!isAuthenticated) {
        return await createActorWithConfig();
      }

      const actorOptions = {
        agentOptions: { identity },
      };

      const actor = await createActorWithConfig(actorOptions);
      const adminToken = getSecretParameter("caffeineAdminToken") || "";
      // Don't let access control init hang indefinitely — 5s timeout
      const timeout = new Promise<void>((resolve) => setTimeout(resolve, 5000));
      await Promise.race([
        actor._initializeAccessControlWithSecret(adminToken).catch((e) => {
          console.warn("Access control init failed (non-fatal):", e);
        }),
        timeout,
      ]);
      return actor;
    },
    staleTime: Number.POSITIVE_INFINITY,
    retry: 2,
    retryDelay: 1500,
    enabled: true,
  });

  useEffect(() => {
    if (actorQuery.data) {
      queryClient.invalidateQueries({
        predicate: (query) => !query.queryKey.includes(ACTOR_QUERY_KEY),
      });
      queryClient.refetchQueries({
        predicate: (query) => !query.queryKey.includes(ACTOR_QUERY_KEY),
      });
    }
  }, [actorQuery.data, queryClient]);

  return {
    actor: actorQuery.data || null,
    isFetching: actorQuery.isFetching,
    isError: actorQuery.isError,
    refetch: actorQuery.refetch,
  };
}
