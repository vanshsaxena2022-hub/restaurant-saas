require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
const pool = require("./db");

const app = express();

/* ===========================
   MIDDLEWARE
=========================== */
app.use(cors());
app.use(express.json());

app.get("/debug/env", (req, res) => {
  res.json({
    PUBLIC_URL: process.env.PUBLIC_URL,
    PORT: process.env.PORT,
    RENDER: process.env.RENDER
  });
});


/* ===========================
   DATABASE
=========================== */

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

        const baseUrl =
        process.env.RENDER_EXTERNAL_URL ||
        `http://localhost:${process.env.PORT || 4000}`;

           const qr = `${baseUrl}/menu/${restaurant_id}/${table_id}`;
        

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

    menu.rows.forEach(item => {
      itemsHtml += `
        <div style="margin-bottom:15px;padding:10px;border:1px solid #ddd">
          <b>${item.name}</b><br>
          ₹${item.price}<br>
          <select data-id="${item.id}">
            <option value="0">0</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
            <option value="5">5</option>
          </select>
        </div>
      `;
    });

    res.send(`
      <html>
      <body style="font-family:Arial">
        <h2>Menu</h2>

        <input id="name" placeholder="Your Name"><br><br>
        <input id="phone" placeholder="Phone"><br><br>

        ${itemsHtml}

        <button onclick="submitOrder()">Place Order</button>

        <script>
          async function submitOrder() {
            const name = document.getElementById("name").value;
            const phone = document.getElementById("phone").value;

            const items = [];
            document.querySelectorAll("select").forEach(sel => {
              const qty = sel.value;
              if (qty > 0) {
                items.push({
                  menu_item_id: sel.getAttribute("data-id"),
                  quantity: qty
                });
              }
            });

            const res = await fetch(window.location.origin + "/order/create", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                restaurant_id: "${restaurant_id}",
                table_id: "${table_id}",
                name,
                phone,
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
  } catch (err) {
    res.send("Menu error");
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
app.get("/dashboard/:restaurant_id", async (req, res) => {
  const { restaurant_id } = req.params;

  res.send(`
  <html>
  <head>
    <title>Kitchen Dashboard</title>
    <style>
      body { font-family: Arial; background:#f4f4f4; padding:20px; }
      .card { background:white; padding:15px; margin-bottom:12px; border-radius:6px; }
      .btn { padding:8px 12px; border:none; border-radius:5px; margin-right:8px; cursor:pointer; }
      .prep { background:orange; color:white; }
      .serve { background:green; color:white; }
      .wa { background:#25D366; color:white; text-decoration:none; padding:8px 12px; border-radius:5px; }
      .status { font-weight:bold; }
    </style>
  </head>
  <body>
    <h2>Live Orders</h2>
    <div id="orders"></div>

    <script>
      async function load(){
        const res = await fetch("/orders/${restaurant_id}");
        const data = await res.json();
        const box = document.getElementById("orders");
        box.innerHTML = "";

        data.forEach(o => {
          const div = document.createElement("div");
          div.className = "card";

          div.innerHTML = \`
            <b>Table:</b> \${o.table_number}<br>
            <b>Name:</b> \${o.customer_name}<br>
            <b>Status:</b> <span class="status">\${o.status}</span><br><br>

            <button class="btn prep" onclick="update('\${o.id}','preparing')">Preparing</button>
            <button class="btn serve" onclick="update('\${o.id}','served')">Served</button>

            \${o.can_message ? '<a class="wa" href="'+o.whatsapp_link+'" target="_blank">WhatsApp</a>' : ''}
          \`;

          box.appendChild(div);
        });
      }

      async function update(id, status){
        await fetch("/order/update-status", {
          method:"POST",
          headers:{ "Content-Type":"application/json" },
          body: JSON.stringify({ order_id:id, status })
        });
        load();
      }

      load();
      setInterval(load, 5000);
    </script>
  </body>
  </html>
  `);
});

/* ===========================
   START
=========================== */
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log("Running on", PORT));
