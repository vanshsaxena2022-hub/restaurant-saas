const API_BASE =
  import.meta.env.VITE_API_URL || "https://restaurant-saas.onrender.com";

export async function fetchMenu(restaurant_id) {
  const res = await fetch(`${API_BASE}/menu-data/${restaurant_id}`);
  return res.json();
}

export async function placeOrder(payload) {
  const res = await fetch(`${API_BASE}/order/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return res.json();
}
