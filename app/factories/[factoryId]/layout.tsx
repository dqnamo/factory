"use client";

import {
  CircleNotchIcon,
  FadersHorizontalIcon,
  ListIcon,
  PlusIcon,
  XIcon,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { db } from "../../lib/instant";
import { cn } from "../../helpers/ui-helper";
import Button from "@/app/components/Button";
import RunStatusGrid from "@/app/components/RunStatusGrid";
import ContextMenu, { type ContextMenuItem } from "@/app/components/ContextMenu";
import { DateTime } from "luxon";
import {
  DetectiveIcon,
  FactoryIcon,
  GithubLogoIcon,
  NoteIcon,
  PlugsConnectedIcon,
} from "@phosphor-icons/react";
import { useState } from "react";

const COLORS = [
  "bg-blue-9",
  "bg-green-9",
  "bg-purple-9",
  "bg-amber-9",
  "bg-red-9",
  "bg-teal-9",
  "bg-pink-9",
  "bg-orange-9",
];

const ACTIVE_STATUSES = ["provisioning", "running", "idle"];
const CLOSED_STATUSES = ["completed", "failed"];

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function formatTime(ts: number) {
  return DateTime.fromMillis(ts).toRelative() ?? "";
}

export default function FactoryLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ factoryId: string; runId?: string }>();
  const pathname = usePathname();
  const { user } = db.useAuth();
  const [mobileRunsOpen, setMobileRunsOpen] = useState(false);

  const { data: factories } = db.useQuery({
    factoryUsers: {
      $: {
        where: {
          "user.id": user?.id ?? "",
        },
      },
      factory: {
        runs: {},
      },
    },
  });

  const { data: factoryData } = db.useQuery(
    params.factoryId
      ? {
          factories: {
            $: { where: { id: params.factoryId } },
            runs: {},
          },
        }
      : null,
  );

  const factoryList =
    factories?.factoryUsers
      .map((fu) => fu.factory)
      .flat()
      .filter(Boolean) ?? [];

  const currentFactory = factoryData?.factories[0];
  const allRuns = currentFactory?.runs ?? [];
  const activeRuns = allRuns.filter((r) => ACTIVE_STATUSES.includes(r.status ?? ""));
  const closedRuns = allRuns.filter((r) => CLOSED_STATUSES.includes(r.status ?? ""));
  const isSettingUp = currentFactory && !currentFactory.snapshotId;

  const currentFactoryIndex = factoryList.findIndex((f) => f.id === params.factoryId);
  const currentSection = SECTION_ITEMS.find((s) => s.match(params.factoryId, pathname));

  return (
    <div className="flex flex-row h-dvh w-full">
      {/* Desktop: factory icon rail */}
      <div className="hidden md:flex flex-col w-max p-2 gap-2 border-r border-grayscale-3">
        <Link
          href="/factories/new"
          className="size-9 border border-dashed border-grayscale-7 rounded-md bg-grayscale-1 hover:bg-grayscale-3 flex items-center justify-center text-grayscale-11 hover:text-grayscale-12 text-sm font-medium transition-colors"
        >
          <PlusIcon size={16} weight="bold" />
        </Link>

        {factoryList.map((factory, i) => {
          const isActive = factory.id === params.factoryId;
          const idleCount = (factory.runs ?? []).filter((r) => r.status === "idle").length;
          return (
            <div key={factory.id} className="relative">
              <Link
                href={`/factories/${factory.id}`}
                className={`size-9 rounded-md flex items-center justify-center text-white text-sm font-medium transition-all ${
                  COLORS[i % COLORS.length]
                } ${isActive ? "" : "grayscale hover:grayscale-0"}`}
                title={factory.name}
              >
                {getInitials(factory.name)}
              </Link>
              {idleCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-accent-9 text-white text-[10px] font-semibold flex items-center justify-center leading-none pointer-events-none">
                  {idleCount}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Desktop: section rail */}
      <SectionRail factoryId={params.factoryId} pathname={pathname} className="hidden md:flex" />

      {/* Desktop: run list sidebar */}
      <div className="hidden md:flex flex-col w-64 shrink-0 p-2 border-r border-grayscale-3 overflow-y-auto">
        <RunListContent
          factoryId={params.factoryId}
          runId={params.runId}
          isSettingUp={isSettingUp}
          activeRuns={activeRuns}
          closedRuns={closedRuns}
        />
      </div>

      {/* Main column: mobile chrome wraps around single content render */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Mobile: header */}
        <div className="flex md:hidden items-center justify-between px-3 py-2 border-b border-grayscale-3 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {currentFactory && (
              <div
                className={`size-7 rounded-md flex items-center justify-center text-white text-xs font-medium shrink-0 ${
                  COLORS[currentFactoryIndex >= 0 ? currentFactoryIndex % COLORS.length : 0]
                }`}
              >
                {getInitials(currentFactory.name)}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium text-grayscale-12 truncate">
                {currentFactory?.name ?? "Factory"}
              </p>
              <p className="text-[10px] text-grayscale-10">{currentSection?.label ?? ""}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileRunsOpen(!mobileRunsOpen)}
            className="size-8 flex items-center justify-center rounded-md text-grayscale-11 hover:bg-grayscale-2 transition-colors"
          >
            {mobileRunsOpen ? (
              <XIcon size={18} weight="bold" />
            ) : (
              <ListIcon size={18} weight="bold" />
            )}
          </button>
        </div>

        {/* Mobile: run list dropdown */}
        {mobileRunsOpen && (
          <div className="md:hidden border-b border-grayscale-3 bg-grayscale-1 overflow-y-auto max-h-[60dvh] shrink-0">
            <div className="p-2">
              <RunListContent
                factoryId={params.factoryId}
                runId={params.runId}
                isSettingUp={isSettingUp}
                activeRuns={activeRuns}
                closedRuns={closedRuns}
                onNavigate={() => setMobileRunsOpen(false)}
              />
            </div>

            {factoryList.length > 1 && (
              <div className="border-t border-grayscale-3 p-2">
                <p className="text-[10px] uppercase text-grayscale-10 font-mono font-semibold px-2 mb-1">
                  Factories
                </p>
                <div className="flex flex-row gap-1.5 px-2 pb-1">
                  {factoryList.map((factory, i) => {
                    const isActive = factory.id === params.factoryId;
                    return (
                      <Link
                        key={factory.id}
                        href={`/factories/${factory.id}`}
                        onClick={() => setMobileRunsOpen(false)}
                        className={`size-8 rounded-md flex items-center justify-center text-white text-xs font-medium transition-all ${
                          COLORS[i % COLORS.length]
                        } ${isActive ? "ring-2 ring-accent-9 ring-offset-1" : "grayscale"}`}
                      >
                        {getInitials(factory.name)}
                      </Link>
                    );
                  })}
                  <Link
                    href="/factories/new"
                    onClick={() => setMobileRunsOpen(false)}
                    className="size-8 border border-dashed border-grayscale-7 rounded-md flex items-center justify-center text-grayscale-11 text-xs"
                  >
                    <PlusIcon size={14} weight="bold" />
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Content area - rendered once for both mobile and desktop */}
        <div className="flex flex-1 min-h-0">{children}</div>

        {/* Mobile: bottom tab bar */}
        <MobileTabBar factoryId={params.factoryId} pathname={pathname} />
      </div>
    </div>
  );
}

function useRunContextMenu(
  run: { id: string; status?: string },
  factoryId: string,
): ContextMenuItem[] {
  const router = useRouter();
  const isClosed = CLOSED_STATUSES.includes(run.status ?? "");

  return [
    {
      type: "item",
      label: isClosed ? "Mark as incomplete" : "Mark as complete",
      onClick: () => {
        db.transact(
          db.tx.runs[run.id].update({
            status: isClosed ? "idle" : "completed",
          }),
        );
      },
    },
    { type: "separator" },
    {
      type: "item",
      label: "Delete run",
      variant: "danger",
      onClick: () => {
        db.transact(db.tx.runs[run.id].delete());
        router.push(`/factories/${factoryId}`);
      },
    },
  ];
}

function RunItem({
  run,
  factoryId,
  isActive,
  onNavigate,
}: {
  run: { id: string; name?: string; status?: string; createdAt?: number };
  factoryId: string;
  isActive: boolean;
  onNavigate?: () => void;
}) {
  const menuItems = useRunContextMenu(run, factoryId);

  return (
    <ContextMenu items={menuItems} className="rounded-md">
      <Link
        href={`/factories/${factoryId}/runs/${run.id}`}
        onClick={onNavigate}
        className={`flex flex-col px-2 py-1 rounded-md transition-colors ${
          isActive ? "bg-grayscale-3" : "hover:bg-grayscale-2"
        }`}
      >
        <div className="flex items-center gap-1.5">
          <p
            className={`text-sm truncate flex-1 ${
              isActive ? "text-grayscale-12" : "text-grayscale-11"
            }`}
          >
            {run.name || "Untitled run"}
          </p>
          <RunStatusGrid status={run.status ?? ""} />
        </div>
        {run.createdAt && (
          <p className="text-xs text-grayscale-10">{formatTime(run.createdAt)}</p>
        )}
      </Link>
    </ContextMenu>
  );
}

function RunListContent({
  factoryId,
  runId,
  isSettingUp,
  activeRuns,
  closedRuns,
  onNavigate,
}: {
  factoryId: string;
  runId?: string;
  isSettingUp: boolean | undefined;
  activeRuns: Array<{ id: string; name?: string; status?: string; createdAt?: number }>;
  closedRuns: Array<{ id: string; name?: string; status?: string; createdAt?: number }>;
  onNavigate?: () => void;
}) {
  if (isSettingUp) {
    return (
      <div className="flex items-center gap-2 px-2 py-3">
        <CircleNotchIcon size={14} weight="bold" className="text-grayscale-10 animate-spin" />
        <p className="text-xs text-grayscale-10">Setting up factory...</p>
      </div>
    );
  }

  return (
    <>
      <Button
        variant="secondary"
        className="w-full"
        href={`/factories/${factoryId}`}
        onClick={onNavigate}
      >
        <PlusIcon size={14} weight="bold" />
        <p>New Run</p>
      </Button>

      {activeRuns.length > 0 && (
        <div className="flex flex-col mt-2 gap-1">
          {activeRuns.map((run) => (
            <RunItem
              key={run.id}
              run={run}
              factoryId={factoryId}
              isActive={runId === run.id}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}

      {closedRuns.length > 0 && (
        <>
          <p className="text-xs uppercase px-2 text-grayscale-10 mt-4 font-mono font-semibold">
            Completed Runs
          </p>
          <div className="flex flex-col mt-2 gap-1">
            {closedRuns.map((run) => (
              <RunItem
                key={run.id}
                run={run}
                factoryId={factoryId}
                isActive={runId === run.id}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </>
      )}

      {activeRuns.length === 0 && closedRuns.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8">
          <p className="text-xs text-grayscale-10">No runs yet</p>
        </div>
      )}
    </>
  );
}

const SECTION_ITEMS = [
  {
    href: (id: string) => `/factories/${id}`,
    icon: FactoryIcon,
    id: "runs",
    label: "Runs",
    match: (id: string, path: string) =>
      path === `/factories/${id}` || path.startsWith(`/factories/${id}/runs/`),
  },
  {
    href: (id: string) => `/factories/${id}/mcp`,
    icon: PlugsConnectedIcon,
    id: "mcp",
    label: "MCP",
    match: (id: string, path: string) => path === `/factories/${id}/mcp`,
  },
  {
    href: (id: string) => `/factories/${id}/skills`,
    icon: NoteIcon,
    id: "skills",
    label: "Skills",
    match: (id: string, path: string) => path === `/factories/${id}/skills`,
  },
  {
    href: (id: string) => `/factories/${id}/github`,
    icon: GithubLogoIcon,
    id: "github",
    label: "GitHub",
    match: (id: string, path: string) => path === `/factories/${id}/github`,
  },
  {
    href: (id: string) => `/factories/${id}`,
    icon: DetectiveIcon,
    id: "inspector",
    label: "Inspector",
    match: () => false,
  },
  {
    href: (id: string) => `/factories/${id}`,
    icon: FadersHorizontalIcon,
    id: "settings",
    label: "Settings",
    match: (id: string, path: string) => path === `/factories/${id}/settings`,
  },
] as const;

const MOBILE_TAB_ITEMS = SECTION_ITEMS.filter((s) => s.id !== "inspector");

function SectionRail({
  factoryId,
  pathname,
  className,
}: { factoryId: string; pathname: string; className?: string }) {
  return (
    <nav
      className={cn("flex flex-col w-max p-2 gap-2 border-r border-grayscale-3", className)}
      aria-label="Factory sections"
    >
      {SECTION_ITEMS.map((section) => {
        const isActive = section.match(factoryId, pathname);
        const Icon = section.icon;

        return (
          <Link
            key={section.id}
            href={section.href(factoryId)}
            className={cn(
              "size-9 flex items-center justify-center rounded-md transition-colors group",
              isActive ? "bg-grayscale-3" : "bg-grayscale-1 hover:bg-grayscale-2",
            )}
            title={section.label}
          >
            <Icon
              size={20}
              weight="bold"
              className={cn(
                "transition-colors",
                isActive ? "text-accent-9" : "text-grayscale-10 group-hover:text-grayscale-12",
              )}
            />
          </Link>
        );
      })}
    </nav>
  );
}

function MobileTabBar({ factoryId, pathname }: { factoryId: string; pathname: string }) {
  return (
    <nav
      className="flex md:hidden items-center justify-around border-t border-grayscale-3 bg-grayscale-1 pb-safe shrink-0"
      aria-label="Factory sections"
    >
      {MOBILE_TAB_ITEMS.map((section) => {
        const isActive = section.match(factoryId, pathname);
        const Icon = section.icon;

        return (
          <Link
            key={section.id}
            href={section.href(factoryId)}
            className={cn(
              "flex flex-col items-center gap-0.5 py-2 px-3 min-w-0 transition-colors",
              isActive ? "text-accent-9" : "text-grayscale-10",
            )}
          >
            <Icon size={20} weight={isActive ? "fill" : "bold"} />
            <span className="text-[10px] font-medium truncate">{section.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
