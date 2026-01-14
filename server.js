require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
const { Pool } = require("pg");

const app = express();

/* ===========================
   MIDDLEWARE
=========================== */
app.use(cors());
app.use(express.json());

/* ===========================
   DATABASE
=========================== */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

/* ===========================
   BOOT ROUTES
=========================== */
app.get("/", (req, res) => {
  res.send(`
    <h1>Restaurant SaaS is Live 🚀</h1>
    <p>API Status: OK</p>
    <ul>
      <li><a href="/health">/health</a></li>
      <li>/menu/{restaurant_id}/{table_id}</li>
      <li>/dashboard/{restaurant_id}</li>
    </ul>
  `);
});

app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "LIVE", time: new Date() });
  } catch (e) {
    res.status(500).json({ status: "DB_ERROR", error: e.message });
  }
});

/* ===========================
   RESTAURANT
=========================== */
app.post("/restaurant/signup", async (req, res) => {
  try {
    const { name, phone, email } = req.body;

    const r = await pool.query(
      `INSERT INTO restaurants(id,name,phone,email)
       VALUES($1,$2,$3,$4) RETURNING *`,
      [uuidv4(), name, phone, email]
    );

    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ===========================
   TABLE
=========================== */
app.post("/table/add", async (req, res) => {
  try {
    const { restaurant_id, table_number } = req.body;
    const table_id = uuidv4();

    const BASE_URL = process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 4000}`;

    const qr = `${BASE_URL}/menu/${restaurant_id}/${table_id}`;

    const table = await pool.query(
      "INSERT INTO tables (id, restaurant_id, table_number, qr_url) VALUES ($1,$2,$3,$4) RETURNING *",
      [table_id, restaurant_id, table_number, qr]
    );

    res.json(table.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
/* ===========================
   MENU
=========================== */
app.post("/menu/add", async (req, res) => {
  try {
    const { restaurant_id, name, price } = req.body;

    const i = await pool.query(
      `INSERT INTO menu_items(id,restaurant_id,name,price)
       VALUES($1,$2,$3,$4) RETURNING *`,
      [uuidv4(), restaurant_id, name, price]
    );

    res.json(i.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/menu/:restaurant_id/:table_id", async (req, res) => {
  try {
    const { restaurant_id, table_id } = req.params;

    const menu = await pool.query(
      "SELECT * FROM menu_items WHERE restaurant_id = $1",
      [restaurant_id]
    );

    let itemsHtml = "";
    let jsLines = "";

    menu.rows.forEach(item => {
      itemsHtml += `
        <div class="item">
          <b>${item.name}</b><br>
          ₹${item.price}<br>
          <select id="q_${item.id}">
            <option value="0">0</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
            <option value="5">5</option>
          </select>
        </div>
      `;

      jsLines += `
        const q_${item.id} = document.getElementById("q_${item.id}").value;
        if (q_${item.id} > 0) {
          items.push({ menu_item_id: "${item.id}", quantity: q_${item.id} });
        }
      `;
    });

    const html = `
    <html>
    <body>
      <h2>Menu</h2>
      <input id="name" placeholder="Your Name"/>
      <input id="phone" placeholder="Phone"/>

      ${itemsHtml}

      <button onclick="order()">Place Order</button>

      <script>
        async function order() {
          const items = [];
          ${jsLines}

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
          else alert(data.error);
        }
      </script>
    </body>
    </html>
    `;

    res.send(html);
  } catch (err) {
    res.status(500).send("Menu error");
  }
});


/* ===========================
   ORDER
=========================== */
app.post("/order/create", async (req, res) => {
  try {
    const { restaurant_id, table_id, name, phone, items } = req.body;

    if (!items.length) return res.json({ error: "No items" });

    const c = await pool.query(
      `INSERT INTO customers(id,name,phone,restaurant_id)
       VALUES($1,$2,$3,$4) RETURNING id`,
      [uuidv4(), name, phone, restaurant_id]
    );

    const o = await pool.query(
      `INSERT INTO orders(id,restaurant_id,table_id,customer_id,status)
       VALUES($1,$2,$3,$4,'new') RETURNING id`,
      [uuidv4(), restaurant_id, table_id, c.rows[0].id]
    );

    for (let i of items) {
      await pool.query(
        `INSERT INTO order_items(id,order_id,menu_item_id,quantity)
         VALUES($1,$2,$3,$4)`,
        [uuidv4(), o.rows[0].id, i.menu_item_id, i.quantity]
      );
    }

    res.json({ redirect: "/thank-you" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/thank-you", (req,res)=>{
  res.send("<h2>Order received</h2>");
});

/* ===========================
   DASHBOARD
=========================== */
app.get("/dashboard/:restaurant_id", async (req,res)=>{
  const {restaurant_id}=req.params;
  const r=await pool.query(`
    SELECT o.id,o.status,c.name,t.table_number,c.phone
    FROM orders o
    JOIN customers c ON o.customer_id=c.id
    JOIN tables t ON o.table_id=t.id
    WHERE o.restaurant_id=$1
    ORDER BY o.created_at DESC
  `,[restaurant_id]);

  let html="<h2>Orders</h2>";
  r.rows.forEach(o=>{
    const wa=`https://wa.me/91${o.phone}?text=Thanks for visiting!`;
    html+=`<div>Table ${o.table_number} - ${o.name} - ${o.status}
    <a href="${wa}" target="_blank">WhatsApp</a></div>`;
  });

  res.send(html);
});

/* ===========================
   START
=========================== */
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log("Running on", PORT));
