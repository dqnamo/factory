const GRID_CELLS = Array.from({ length: 9 }, (_, index) => index);

export default function LoadingStatesPage() {
  return (
    <div className="flex flex-col h-dvh w-full items-center justify-center">
      <div className="flex flex-row items-center justify-center gap-2">
        <div className="grid grid-cols-3 gap-px">
          {GRID_CELLS.map((cell) => (
            <div key={cell} className="w-[3px] h-[3px] bg-green-9"></div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-px">
          {GRID_CELLS.map((cell) => (
            <div key={cell} className="w-[3px] h-[3px] bg-blue-9"></div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-px">
          {GRID_CELLS.map((cell) => (
            <div key={cell} className="w-[3px] h-[3px] bg-grayscale-9"></div>
          ))}
        </div>
      </div>
    </div>
  );
}
