import { useEffect, useState } from "react";
import { fetchMenu, placeOrder } from "../services/api";
import CategoryTabs from "../components/CategoryTabs";
import MenuItem from "../components/MenuItem";
import Cart from "../components/Cart";

export default function Menu() {
  const [menu, setMenu] = useState([]);
  const [category, setCategory] = useState("");
  const [cart, setCart] = useState([]);

  // TEMP: replace later with URL params
  const restaurant_id = "DEMO_RESTAURANT_ID";
  const table_id = "DEMO_TABLE_ID";

  useEffect(() => {
    fetchMenu(restaurant_id).then(setMenu);
  }, []);

  const categories = [...new Set(menu.map(i => i.category))];

  const addToCart = (item, qty) => {
    setCart(prev => {
      const existing = prev.find(p => p.id === item.id);
      if (existing) {
        return prev.map(p =>
          p.id === item.id ? { ...p, qty } : p
        );
      }
      return [...prev, { ...item, qty }];
    });
  };

  const filtered = category
    ? menu.filter(i => i.category === category)
    : menu;

  return (
    <div>
      <h2 style={{ textAlign: "center" }}>Demo Cafe</h2>

      <CategoryTabs
        categories={categories}
        active={category}
        onSelect={setCategory}
      />

      {filtered.map(item => (
        <MenuItem key={item.id} item={item} onAdd={addToCart} />
      ))}

      <Cart
        cart={cart}
        onPlace={() =>
          placeOrder({
            restaurant_id,
            table_id,
            name: "Demo",
            phone: "9999999999",
            items: cart.map(c => ({
              menu_item_id: c.id,
              quantity: c.qty
            }))
          })
        }
      />
    </div>
  );
}
