export default function CategoryTabs({ categories, active, onSelect }) {
  return (
    <div style={{ display: "flex", overflowX: "auto", gap: 10 }}>
      <button onClick={() => onSelect("")}>All</button>
      {categories.map(c => (
        <button
          key={c}
          onClick={() => onSelect(c)}
          style={{ fontWeight: active === c ? "bold" : "normal" }}
        >
          {c}
        </button>
      ))}
    </div>
  );
}
