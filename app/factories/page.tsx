"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { db } from "../lib/instant";

export default function FactoriesPage() {
  const { isLoading, user } = db.useAuth();
  const router = useRouter();

  const { isLoading: isLoadingFactories, data: factories } = db.useQuery({
    factoryUsers: {
      $: {
        where: {
          "user.id": user?.id ?? "",
        },
      },
      factory: {},
    },
  });

  const factoryList = factories?.factoryUsers
    .flatMap((factoryUser) => factoryUser.factory)
    .filter((factory) => factory != null);

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/");
    }
  }, [isLoading, user, router]);

  useEffect(() => {
    if (isLoadingFactories) return;

    const firstFactory = factoryList?.[0];

    if (firstFactory) {
      router.replace(`/factories/${firstFactory.id}`);
    } else if (factoryList) {
      router.replace("/factories/new");
    }
  }, [isLoadingFactories, factoryList, router]);

  return null;
}
