import { CaretDownIcon, MagicWandIcon, PaperPlaneTiltIcon } from "@phosphor-icons/react/dist/ssr";
import Button from "./Button";
import Image from "next/image";
export default function UIPreview() {
  return (
    <div className="h-full flex flex-row w-full">
      <div className="flex flex-col p-2 gap-2 border-r border-grayscale-3">
        <div className="bg-grayscale-3 size-6 flex items-center justify-center text-center aspect-square rounded">
          <p className="text-[11px] font-medium text-grayscale-11">HY</p>
        </div>
        <div className="bg-blue-4 size-6 flex items-center justify-center text-center aspect-square rounded">
          <p className="text-[11px] font-medium text-blue-9">FF</p>
        </div>
      </div>
      <div className="flex flex-col p-2 gap-2 border-r border-grayscale-3">
        <div className="bg-grayscale-3 size-6 flex items-center justify-center text-center aspect-square rounded">
          <p className="text-[11px] font-medium text-grayscale-11">HY</p>
        </div>
        <div className="bg-blue-4 size-6 flex items-center justify-center text-center aspect-square rounded">
          <p className="text-[11px] font-medium text-blue-9">FF</p>
        </div>
      </div>
      <div className="flex flex-col p-1 py-3 border-r border-grayscale-3 w-40 shrink-0 gap-2">
        <div className="flex flex-row justify-between px-1">
          <p className="text-[9px] text-grayscale-10 font-mono uppercase font-medium">
            Active Runs
          </p>
          <p className="text-[9px] text-grayscale-10 font-mono uppercase font-medium">3</p>
        </div>
        <div className="flex flex-col gap-px">
          <div className="flex flex-row justify-between px-1 py-0.5 rounded-md">
            <p className="text-[11px] text-grayscale-11">Changing the UI</p>
          </div>
          <div className="flex flex-row justify-between bg-grayscale-2 px-1 py-0.5 rounded">
            <p className="text-[11px] text-grayscale-11">Backend Changes</p>
          </div>
          <div className="flex flex-row justify-between px-1 py-0.5 rounded-md">
            <p className="text-[11px] text-grayscale-11">Security Fixes</p>
          </div>
        </div>

        <div className="flex flex-row justify-between px-1 mt-3">
          <p className="text-[9px] text-grayscale-10 font-mono uppercase font-medium">
            Completed Runs
          </p>
          <p className="text-[9px] text-grayscale-10 font-mono uppercase font-medium">2</p>
        </div>
        <div className="flex flex-col gap-px">
          <div className="flex flex-row justify-between px-1 py-0.5 rounded-md">
            <p className="text-[11px] text-grayscale-11">Changing the UI</p>
          </div>
          <div className="flex flex-row justify-between px-1 py-0.5 rounded-md">
            <p className="text-[11px] text-grayscale-11">Security Fixes</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col w-full h-full relative">
        <div className="max-w-3/5 mx-auto w-full h-full  flex flex-col py-4">
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-1">
              <div className="flex flex-row gap-1.5 items-center">
                <Image
                  src="/codex-logo.png"
                  alt="Codex"
                  width={16}
                  height={16}
                  className="invert w-3"
                />
                <p className="text-[10px] text-grayscale-11 font-mono">Codex</p>
              </div>
              <p className="text-[10px] text-grayscale-11">
                Nostrud ut quis in nisi do ea in est est. Qui non ex excepteur aute pariatur tempor
              </p>
              <div className="flex flex-row gap-1 items-center">
                <MagicWandIcon size={8} weight="fill" className="text-accent-9" />
                <p className="text-[9px] text-grayscale-11 ">Performed 2 actions</p>
                <CaretDownIcon size={8} weight="bold" className="text-grayscale-11" />
              </div>
              <p className="text-[10px] text-grayscale-11">
                Nostrud ut quis in nisi do ea in est est. Qui non ex excepteur aute pariatur tempor
                laborum qui voluptate laborum cillum aute. Ullamco ut excepteur voluptate id est
              </p>
            </div>
          </div>
          <div className="mt-auto w-full small-shadow bg-white border border-grayscale-3 rounded-lg shrink-0">
            <div className="p-2 h-20">
              <p className="text-[11px] text-grayscale-11">What do you want to build today?</p>
            </div>

            <div className="flex flex-row gap-2 p-1.5 justify-between">
              <div className="flex flex-row gap-1">
                <Button variant="secondary" classname="px-1.5 py-1 rounded-md">
                  <p className="text-[10px]">Attach</p>
                </Button>
              </div>
              <div className="flex flex-row gap-1">
                <Button variant="primary" classname="px-1.5 py-1 gap-1 rounded-md">
                  <PaperPlaneTiltIcon size={8} weight="fill" />
                  <p className="text-[10px]">Send</p>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
