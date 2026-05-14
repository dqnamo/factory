export default function LoadingStatesPage() {
  return (
    <div className="flex flex-col h-dvh w-full items-center justify-center">
      <div className="flex flex-row items-center justify-center gap-2">
        <div className="grid grid-cols-3 gap-px">
          {Array.from({ length: 9 }).map((_, index) => (
            <div key={index} className="w-[3px] h-[3px] bg-green-9"></div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-px">
          {Array.from({ length: 9 }).map((_, index) => (
            <div key={index} className="w-[3px] h-[3px] bg-blue-9"></div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-px">
          {Array.from({ length: 9 }).map((_, index) => (
            <div key={index} className="w-[3px] h-[3px] bg-grayscale-9"></div>
          ))}
        </div>
      </div>
    </div>
  );
}
