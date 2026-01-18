export default function MenuItem({ item, onAdd }) {
  return (
    <div style={{ border: "1px solid #ddd", margin: 10, padding: 10 }}>
      <b>{item.name}</b> – ₹{item.price}
      <select onChange={e => onAdd(item, Number(e.target.value))}>
        <option value="0">Qty</option>
        {[1,2,3,4,5].map(n => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>
    </div>
  );
}
