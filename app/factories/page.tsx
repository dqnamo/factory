"use client";

import { db } from "../lib/instant";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

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
    .map((factoryUser) => factoryUser.factory)
    .flat()
    .filter(Boolean);

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/");
    }
  }, [isLoading, user, router]);

  useEffect(() => {
    if (isLoadingFactories) return;

    if (factoryList && factoryList.length > 0) {
      router.replace(`/factories/${factoryList[0].id}`);
    } else if (factoryList) {
      router.replace("/factories/new");
    }
  }, [isLoadingFactories, factoryList, router]);

  return null;
}
