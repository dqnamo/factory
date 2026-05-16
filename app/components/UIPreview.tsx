import {
  FactoryIcon,
  FadersHorizontalIcon,
  GithubLogoIcon,
  NoteIcon,
  PaperPlaneTiltIcon,
  PlugsConnectedIcon,
  PlusIcon,
} from "@phosphor-icons/react/dist/ssr";

const SECTION_ICONS = [
  { id: "factory", Icon: FactoryIcon, active: true },
  { id: "mcp", Icon: PlugsConnectedIcon, active: false },
  { id: "notes", Icon: NoteIcon, active: false },
  { id: "github", Icon: GithubLogoIcon, active: false },
  { id: "settings", Icon: FadersHorizontalIcon, active: false },
];

const GRID_CELLS = Array.from({ length: 9 }, (_, index) => index);

function StatusDots({ color }: { color: string }) {
  return (
    <div className="grid grid-cols-3 gap-px shrink-0">
      {GRID_CELLS.map((cell) => (
        <div key={cell} className={`w-[2px] h-[2px] rounded-none ${color}`} />
      ))}
    </div>
  );
}

export default function UIPreview() {
  return (
    <div className="h-full flex flex-row w-full text-[11px]">
      {/* Factory icon rail */}
      <div className="flex flex-col p-1.5 gap-1.5 border-r border-grayscale-3">
        <div className="size-6 border border-dashed border-grayscale-6 rounded flex items-center justify-center text-grayscale-10">
          <PlusIcon size={9} weight="bold" />
        </div>
        <div className="size-6 bg-blue-9 rounded flex items-center justify-center relative">
          <p className="text-[8px] font-semibold text-white leading-none">FF</p>
          <span className="absolute -top-0.5 -right-0.5 min-w-[10px] h-[10px] px-[2px] rounded-full bg-accent-9 text-white text-[6px] font-bold flex items-center justify-center leading-none">
            2
          </span>
        </div>
        <div className="size-6 bg-green-9 rounded flex items-center justify-center grayscale">
          <p className="text-[8px] font-semibold text-white leading-none">AC</p>
        </div>
      </div>

      {/* Section rail */}
      <div className="flex flex-col p-1.5 gap-1.5 border-r border-grayscale-3">
        {SECTION_ICONS.map(({ id, Icon, active }) => (
          <div
            key={id}
            className={`size-6 rounded flex items-center justify-center ${
              active ? "bg-grayscale-3" : "bg-grayscale-1"
            }`}
          >
            <Icon
              size={12}
              weight="bold"
              className={active ? "text-accent-9" : "text-grayscale-9"}
            />
          </div>
        ))}
      </div>

      {/* Run list sidebar */}
      <div className="flex flex-col p-1.5 border-r border-grayscale-3 w-36 shrink-0 gap-1.5">
        <div className="flex flex-row items-center justify-center gap-1 px-1.5 py-1 rounded-md border border-b-2 border-grayscale-4 bg-grayscale-1 text-grayscale-12">
          <PlusIcon size={8} weight="bold" />
          <p className="text-[9px] font-medium">New Run</p>
        </div>

        <div className="flex flex-col gap-px mt-0.5">
          <div className="flex flex-row items-center gap-1 px-1.5 py-0.5 rounded bg-grayscale-3">
            <p className="text-[9px] text-grayscale-12 flex-1 truncate">Auth page redesign</p>
            <StatusDots color="bg-accent-9" />
          </div>
          <div className="flex flex-row items-center gap-1 px-1.5 py-0.5 rounded">
            <p className="text-[9px] text-grayscale-11 flex-1 truncate">Backend API fixes</p>
            <StatusDots color="bg-blue-9" />
          </div>
          <div className="flex flex-row items-center gap-1 px-1.5 py-0.5 rounded">
            <p className="text-[9px] text-grayscale-11 flex-1 truncate">Add MCP support</p>
            <StatusDots color="bg-accent-9" />
          </div>
        </div>

        <p className="text-[8px] uppercase text-grayscale-9 font-mono font-semibold px-1.5 mt-2">
          Completed
        </p>
        <div className="flex flex-col gap-px">
          <div className="flex flex-row items-center gap-1 px-1.5 py-0.5 rounded">
            <p className="text-[9px] text-grayscale-11 flex-1 truncate">Setup CI pipeline</p>
            <StatusDots color="bg-green-9" />
          </div>
          <div className="flex flex-row items-center gap-1 px-1.5 py-0.5 rounded">
            <p className="text-[9px] text-grayscale-11 flex-1 truncate">Fix login bug</p>
            <StatusDots color="bg-green-9" />
          </div>
        </div>
      </div>

      {/* Main content: run detail view */}
      <div className="flex flex-col w-full h-full relative">
        {/* Run header bar */}
        <div className="flex items-center justify-between gap-1 px-2 py-1.5 border-b border-grayscale-3">
          <div className="flex items-center gap-1.5">
            <p className="text-[10px] font-medium text-grayscale-12">Auth page redesign</p>
            <StatusDots color="bg-accent-9" />
          </div>
          <div className="px-1.5 py-0.5 rounded border border-b-2 border-grayscale-4 bg-grayscale-1">
            <p className="text-[8px] font-medium text-grayscale-12">Mark Completed</p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-hidden">
          <div className="max-w-[65%] mx-auto py-2 px-2 flex flex-col gap-2">
            {/* User message */}
            <div className="flex flex-col gap-0.5 self-end max-w-[80%]">
              <p className="text-[7px] font-mono font-semibold text-grayscale-9 uppercase text-right">
                You
              </p>
              <p className="text-[9px] text-grayscale-12 text-right">
                Redesign the auth page with a magic code flow and modern styling
              </p>
            </div>

            {/* System event */}
            <div className="flex items-center gap-1 px-1.5 py-0.5">
              <div className="size-1 rounded-full bg-grayscale-8" />
              <p className="text-[7px] font-mono text-grayscale-9">Cursor Agent · claude-4-opus</p>
            </div>

            {/* Tool calls */}
            <div className="flex items-center gap-1 px-1.5 py-0.5">
              <div className="size-1 rounded-full bg-accent-9" />
              <p className="text-[7px] font-mono text-grayscale-9">Read auth/page.tsx</p>
            </div>
            <div className="flex items-center gap-1 px-1.5 py-0.5">
              <div className="size-1 rounded-full bg-accent-9" />
              <p className="text-[7px] font-mono text-grayscale-9">Edit auth/page.tsx</p>
            </div>

            {/* Agent message */}
            <div className="flex flex-col gap-0.5 self-start max-w-[85%]">
              <p className="text-[7px] font-mono font-semibold text-grayscale-9 uppercase">Agent</p>
              <p className="text-[9px] text-grayscale-12 leading-relaxed">
                I&apos;ve redesigned the auth page with a magic code login flow. The new design
                includes an email input, code verification step, and modern minimal styling.
              </p>
            </div>

            {/* Completed event */}
            <div className="flex items-center gap-1 px-1.5 py-0.5">
              <div className="size-1 rounded-full bg-green-9" />
              <p className="text-[7px] font-mono text-grayscale-9">Completed in 12.4s</p>
            </div>
          </div>
        </div>

        {/* Follow-up input */}
        <div className="px-2 pb-2">
          <div className="small-shadow flex flex-col bg-white rounded-lg border border-grayscale-3 max-w-[65%] mx-auto">
            <div className="p-1.5 h-8">
              <p className="text-[9px] text-grayscale-8">Send a follow-up message...</p>
            </div>
            <div className="flex flex-row gap-1 p-1 justify-end">
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-grayscale-12">
                <PaperPlaneTiltIcon size={7} weight="fill" className="text-grayscale-1" />
                <p className="text-[8px] font-medium text-grayscale-1">Send</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
