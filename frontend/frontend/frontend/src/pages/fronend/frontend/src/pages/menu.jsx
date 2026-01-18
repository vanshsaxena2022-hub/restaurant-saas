import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";

export default function Menu() {
  const { restaurantId, tableId } = useParams();
  const [menu, setMenu] = useState([]);
  const [cart, setCart] = useState([]);

  useEffect(() => {
    fetch(`https://restaurant-saas.onrender.com/menu/${restaurantId}/${tableId}`)
      .then(res => res.json())
      .then(data => setMenu(data))
      .catch(() => alert("Menu load failed"));
  }, []);

  const addToCart = (item, qty) => {
    setCart(prev => [...prev, { ...item, qty }]);
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Demo Cafe Menu</h2>

      {menu.map(item => (
        <div key={item.id} style={{ borderBottom: "1px solid #ddd", padding: 10 }}>
          <b>{item.name}</b> ₹{item.price}
          <select onChange={e => addToCart(item, e.target.value)}>
            <option value="0">Qty</option>
            {[1,2,3,4,5].map(n => <option key={n}>{n}</option>)}
          </select>
        </div>
      ))}

      {cart.length > 0 && (
        <button
          style={{ marginTop: 20 }}
          onClick={() => alert("Cart coming next step")}
        >
          Continue to Cart
        </button>
      )}
    </div>
  );
}
