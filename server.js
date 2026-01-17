require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
const pool = require("./db");

const app = express();
app.use(cors());
app.use(express.json());

const BASE_URL =
  process.env.RENDER_EXTERNAL_URL ||
  `http://localhost:${process.env.PORT || 4000}`;

/* ===================== HEALTH ===================== */
app.get("/health", (req, res) => {
  res.json({ status: "LIVE", time: new Date() });
});

app.get("/test-db", async (req, res) => {
  try {
    const r = await pool.query("SELECT NOW()");
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ===================== RESTAURANT ===================== */
app.post("/restaurant/signup", async (req, res) => {
  try {
    const { name, phone, email } = req.body;
    const r = await pool.query(
      "INSERT INTO restaurants(id,name,phone,email) VALUES($1,$2,$3,$4) RETURNING *",
      [uuidv4(), name, phone, email]
    );
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/restaurant/set-password", async (req, res) => {
  try {
    const { restaurant_id, password } = req.body;
    await pool.query(
      "UPDATE restaurants SET dashboard_password=$1 WHERE id=$2",
      [password, restaurant_id]
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ===================== MENU ===================== */
app.post("/menu/add", async (req, res) => {
  try {
    const { restaurant_id, name, price, category } = req.body;
    const i = await pool.query(
      "INSERT INTO menu_items(id,restaurant_id,name,price,category,is_available) VALUES($1,$2,$3,$4,$5,true) RETURNING *",
      [uuidv4(), restaurant_id, name, price, category]
    );
    res.json(i.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ===================== TABLE ===================== */
app.post("/table/add", async (req, res) => {
  try {
    const { restaurant_id, table_number } = req.body;
    const table_id = uuidv4();
    const qr = `${BASE_URL}/menu/${restaurant_id}/${table_id}`;

    const t = await pool.query(
      "INSERT INTO tables(id,restaurant_id,table_number,qr_url) VALUES($1,$2,$3,$4) RETURNING *",
      [table_id, restaurant_id, table_number, qr]
    );
    res.json(t.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ===================== CUSTOMER MENU ===================== */
app.get("/menu/:restaurant_id/:table_id", async (req, res) => {
  const { restaurant_id, table_id } = req.params;
  const menu = await pool.query(
    "SELECT * FROM menu_items WHERE restaurant_id = $1",
    [restaurant_id]
  );

  let itemsHTML = "";

  menu.rows.forEach(item => {
    itemsHTML += `
      <div class="card">
        <div class="item-name">${item.name}</div>
        <div class="item-footer">
          <span class="price">₹${item.price}</span>
          <select data-id="${item.id}">
            <option value="0">Qty</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
            <option value="5">5</option>
          </select>
        </div>
      </div>
    `;
  });

  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>Demo Cafe Menu</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      margin: 0;
      font-family: Arial, sans-serif;
      background: #f8f8f8;
      padding-bottom: 90px;
    }
    .header {
      background: #111;
      color: #fff;
      padding: 16px;
      text-align: center;
      font-size: 20px;
      font-weight: bold;
    }
    .container {
      padding: 16px;
    }
    .card {
      background: #fff;
      padding: 14px;
      border-radius: 10px;
      margin-bottom: 12px;
      box-shadow: 0 4px 10px rgba(0,0,0,0.06);
    }
    .item-name {
      font-size: 17px;
      font-weight: 600;
      margin-bottom: 10px;
    }
    .item-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .price {
      font-size: 16px;
      font-weight: bold;
      color: #16a34a;
    }
    select {
      padding: 6px;
      border-radius: 6px;
      border: 1px solid #ccc;
    }
    .form {
      margin-bottom: 20px;
    }
    input {
      width: 100%;
      padding: 12px;
      margin-bottom: 10px;
      border-radius: 8px;
      border: 1px solid #ccc;
      font-size: 15px;
    }
    .order-btn {
      position: fixed;
      bottom: 0;
      left: 0;
      width: 100%;
      background: #16a34a;
      color: #fff;
      padding: 18px;
      font-size: 18px;
      font-weight: bold;
      border: none;
      cursor: pointer;
    }
  </style>
</head>
<body>

  <div class="header">Demo Cafe</div>

  <div class="container">
    <div class="form">
      <input id="name" placeholder="Your Name" />
      <input id="phone" placeholder="Phone Number" />
    </div>

    ${itemsHTML}
  </div>

  <button class="order-btn" onclick="placeOrder()">Place Order</button>

  <script>
    async function placeOrder() {
      const items = [];
      document.querySelectorAll("select").forEach(sel => {
        if (sel.value > 0) {
          items.push({
            menu_item_id: sel.dataset.id,
            quantity: sel.value
          });
        }
      });

      if (items.length === 0) {
        alert("Please select at least one item");
        return;
      }

      const res = await fetch("/order/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurant_id: "${restaurant_id}",
          table_id: "${table_id}",
          name: document.getElementById("name").value,
          phone: document.getElementById("phone").value,
          items
        })
      });

      const data = await res.json();
      if (data.redirect) window.location = data.redirect;
      else alert(data.error || "Order failed");
    }
  </script>

</body>
</html>
`);
});

/* ===================== ORDER ===================== */
app.post("/order/create", async (req, res) => {
  try {
    const { restaurant_id, table_id, name, phone, items } = req.body;
    if (!items.length) return res.json({ error: "No items" });

    const c = await pool.query(
      "INSERT INTO customers(id,name,phone,restaurant_id,created_at) VALUES($1,$2,$3,$4,now()) RETURNING id",
      [uuidv4(), name, phone, restaurant_id]
    );

    const o = await pool.query(
      "INSERT INTO orders(id,restaurant_id,table_id,customer_id,status,created_at) VALUES($1,$2,$3,$4,'new',now()) RETURNING id",
      [uuidv4(), restaurant_id, table_id, c.rows[0].id]
    );

    for (const i of items) {
      await pool.query(
        "INSERT INTO order_items(id,order_id,menu_item_id,quantity) VALUES($1,$2,$3,$4)",
        [uuidv4(), o.rows[0].id, i.menu_item_id, i.quantity]
      );
    }

    res.json({ redirect: "/thank-you" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/thank-you", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>Thank You</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: Arial;
      background:#0f172a;
      color:white;
      display:flex;
      justify-content:center;
      align-items:center;
      height:100vh;
      margin:0;
    }
    .box {
      background:#020617;
      padding:40px;
      border-radius:16px;
      text-align:center;
      box-shadow:0 0 40px rgba(0,0,0,.6);
      max-width:360px;
    }
    h1 { color:#22c55e; }
    p { color:#cbd5f5; font-size:16px; }
  </style>
</head>
<body>
  <div class="box">
    <h1>Order Received ✅</h1>
    <p>Your order has been sent to the kitchen.</p>
    <p>Please relax — we’ll serve you shortly ☕</p>
  </div>
</body>
</html>
  `);
});

/* ===================== KITCHEN API ===================== */
app.get("/orders/:restaurant_id", async (req, res) => {
  const q = await pool.query(`
    SELECT o.id,o.status,c.name as customer_name,c.phone,t.table_number
    FROM orders o
    JOIN customers c ON o.customer_id=c.id
    JOIN tables t ON o.table_id=t.id
    WHERE o.restaurant_id=$1 ORDER BY o.created_at DESC`,
    [req.params.restaurant_id]
  );

  const data = q.rows.map(o => {
    const review = `${BASE_URL}/review/${o.id}`;
    const msg = `Hi ${o.customer_name}, thanks for visiting 😊\nPlease review us:\n${review}`;
    return {
      ...o,
      whatsapp_link: o.status === "served"
        ? `https://wa.me/91${o.phone}?text=${encodeURIComponent(msg)}`
        : null
    };
  });

  res.json(data);
});

app.post("/order/update-status", async (req, res) => {
  await pool.query(
    "UPDATE orders SET status=$1 WHERE id=$2",
    [req.body.status, req.body.order_id]
  );
  res.json({ success: true });
});

/* ===================== REVIEW ===================== */
app.get("/review/:order_id", async (req, res) => {
  const o = await pool.query(
    "SELECT restaurant_id FROM orders WHERE id=$1",
    [req.params.order_id]
  );
  if (!o.rows.length) return res.send("Invalid link");

  await pool.query(
    "INSERT INTO reviews(id,order_id,restaurant_id,created_at) VALUES($1,$2,$3,now())",
    [uuidv4(), req.params.order_id, o.rows[0].restaurant_id]
  );

  res.redirect("https://www.google.com/maps");
});

/* ===================== LOGIN ===================== */
app.get("/login/:restaurant_id", (req, res) => {
  const restaurant_id = req.params.restaurant_id;
  res.send(`
<html>
<body style="text-align:center;padding:40px">
<h2>Dashboard Login</h2>
<input id="pass" type="password">
<br><br>
<button onclick="login()">Login</button>

<script>
async function login(){
  const res = await fetch("/login",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      restaurant_id:"${restaurant_id}",
      password:document.getElementById("pass").value
    })
  });
  const d = await res.json();
  if(d.success){
    localStorage.setItem("auth_${restaurant_id}","1");
    window.location="/dashboard/${restaurant_id}";
  } else alert("Wrong password");
}
</script>
</body>
</html>
`);
});

app.post("/login", async (req, res) => {
  const { restaurant_id, password } = req.body;
  const r = await pool.query(
    "SELECT dashboard_password FROM restaurants WHERE id=$1",
    [restaurant_id]
  );
  res.json({ success: r.rows.length && r.rows[0].dashboard_password === password });
});

/* ===================== DASHBOARD ===================== */
app.get("/dashboard/:restaurant_id", (req, res) => {
  const restaurant_id = req.params.restaurant_id;

  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>Kitchen Dashboard</title>
</head>
<body>

<h2>Kitchen Dashboard</h2>
<div id="orders">Loading...</div>

<script>
  const RESTAURANT_ID = "${restaurant_id}";
  const API = window.location.origin;

  if (!localStorage.getItem("auth_" + RESTAURANT_ID)) {
    window.location.href = "/login/" + RESTAURANT_ID;
  }

  async function loadOrders() {
    const res = await fetch(API + "/orders/" + RESTAURANT_ID);
    const data = await res.json();

    const box = document.getElementById("orders");
    box.innerHTML = "";

    if (!data.length) {
      box.innerHTML = "<p>No orders yet</p>";
      return;
    }

    data.forEach(o => {
      const div = document.createElement("div");
      div.innerHTML = \`
        <b>Table:</b> \${o.table_number}<br>
        <b>Name:</b> \${o.customer_name}<br>
        <b>Status:</b> \${o.status}<br><br>

        <button onclick="update('\${o.id}','preparing')">Preparing</button>
        <button onclick="update('\${o.id}','served')">Served</button>
        \${o.whatsapp_link ? '<a href="'+o.whatsapp_link+'" target="_blank">WhatsApp</a>' : ''}
        <hr>
      \`;
      box.appendChild(div);
    });
  }

  async function update(id, status) {
    await fetch(API + "/order/update-status", {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ order_id:id, status })
    });
    loadOrders();
  }

  loadOrders();
  setInterval(loadOrders, 5000);
</script>

</body>
</html>
`);
});
/* ===================== DEV TOOLS ===================== */
app.get("/_init/password", async (req, res) => {
  try {
    await pool.query(`
      ALTER TABLE restaurants
      ADD COLUMN IF NOT EXISTS dashboard_password TEXT
    `);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/_debug/restaurant/:id", async (req, res) => {
  try {
    const r = await pool.query(
      "SELECT id, dashboard_password FROM restaurants WHERE id=$1",
      [req.params.id]
    );
    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});



/* ===================== START ===================== */
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log("Running on", PORT));
