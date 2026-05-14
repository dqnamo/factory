const PIXELS = [
  [0, 1, 1],
  [1, 0, 0],
  [0, 1, 0],
  [1, 0, 0],
] as const;

const PIXEL_CELLS = PIXELS.flatMap((row, rowIndex) =>
  row.map((filled, columnIndex) => ({
    id: `${rowIndex}-${columnIndex}`,
    filled,
  })),
);

export default function Logo({ className, size = 16 }: { className?: string; size?: number }) {
  return (
    <div
      className={className}
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${PIXELS[0].length}, 1fr)`,
        width: "max-content",
      }}
    >
      {PIXEL_CELLS.map((cell) => (
        <div
          key={cell.id}
          style={{ width: size, height: size }}
          className={cell.filled ? "bg-accent-9" : "bg-transparent"}
        />
      ))}
    </div>
  );
}
