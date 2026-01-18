export default function Cart({ cart, onPlace }) {
  if (!cart.length) return null;

  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);

  return (
    <div style={{
      position: "fixed",
      bottom: 0,
      width: "100%",
      background: "#16a34a",
      color: "white",
      padding: 15
    }}>
      <span>Total: ₹{total}</span>
      <button onClick={onPlace} style={{ float: "right" }}>
        Place Order
      </button>
    </div>
  );
}
