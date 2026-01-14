require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
const pool = require("./db");

const app = express();
app.get("/", (req, res) => {
  res.send(`
    <h1>Restaurant SaaS is Live 🚀</h1>
    <p>API Status: OK</p>
    <p>Try these:</p>
    <ul>
      <li><a href="/health">/health</a></li>
      <li>/menu/{restaurant_id}</li>
      <li>/dashboard/{restaurant_id}</li>
    </ul>
  `);
});

app.get("/health", (req, res) => {
  res.json({ status: "LIVE", serverTime: new Date() });
});

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Restaurant SaaS</title>
        <style>
          body {
            margin:0;
            font-family: Arial, sans-serif;
            background:#0f172a;
            color:white;
            display:flex;
            justify-content:center;
            align-items:center;
            height:100vh;
          }
          .box {
            background:#020617;
            padding:50px;
            border-radius:14px;
            box-shadow:0 0 50px rgba(0,0,0,.6);
            text-align:center;
            max-width:500px;
          }
          h1 {
            margin-bottom:10px;
            color:#22c55e;
          }
          p {
            color:#cbd5f5;
            font-size:18px;
          }
          a {
            display:inline-block;
            margin-top:25px;
            padding:12px 25px;
            background:#22c55e;
            color:black;
            border-radius:8px;
            text-decoration:none;
            font-weight:bold;
          }
        </style>
      </head>
      <body>
        <div class="box">
          <h1>Restaurant QR Ordering</h1>
          <p>Scan • Order • Track • Review</p>
          <a href="/health">Check System</a>
        </div>
      </body>
    </html>
  `);
});

app.get("/health", (req, res) => {
  res.json({
    status: "LIVE",
    serverTime: new Date()
  });
});


// ------------------- HEALTH CHECK -------------------
app.get("/test-db", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ------------------- THANK YOU PAGE -------------------
app.get("/thank-you", (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Thank you</title>
      </head>
      <body style="font-family:Arial;text-align:center;padding:40px">
        <h1>Order Received</h1>
        <p>Your order has been sent to the kitchen.</p>
      </body>
    </html>
  `);
});


// ------------------- RESTAURANT SIGNUP -------------------
app.post("/restaurant/signup", async (req, res) => {
  try {
    const { name, phone, email } = req.body;

    const restaurant = await pool.query(
      "INSERT INTO restaurants (id, name, phone, email, created_at) VALUES ($1,$2,$3,$4,now()) RETURNING *",
      [uuidv4(), name, phone, email]
    );

    res.json(restaurant.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ------------------- ADD TABLE -------------------
app.post("/table/add", async (req, res) => {
  try {
    const { restaurant_id, table_number } = req.body;
    const table_id = uuidv4();

    const qr = `http://localhost:4000/menu/${restaurant_id}/${table_id}`;

    const table = await pool.query(
      "INSERT INTO tables (id, restaurant_id, table_number, qr_url) VALUES ($1,$2,$3,$4) RETURNING *",
      [table_id, restaurant_id, table_number, qr]
    );

    res.json(table.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ------------------- ADD MENU -------------------
app.post("/menu/add", async (req, res) => {
  try {
    const { restaurant_id, name, price, category } = req.body;

    const item = await pool.query(
      "INSERT INTO menu_items (id, restaurant_id, name, price, category, is_available) VALUES ($1,$2,$3,$4,$5,true) RETURNING *",
      [uuidv4(), restaurant_id, name, price, category]
    );

    res.json(item.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ------------------- GET MENU -------------------
app.get("/menu/:restaurant_id/:table_id", async (req, res) => {
  try {
    const { restaurant_id, table_id } = req.params;

    const menu = await pool.query(
      "SELECT * FROM menu_items WHERE restaurant_id = $1",
      [restaurant_id]
    );

    let html = `
    <html>
    <head>
      <title>Menu</title>
      <style>
        body { font-family: Arial; background:#f9f9f9; padding:20px; }
        .item { background:white; padding:15px; margin-bottom:10px; border-radius:8px; }
        .btn { background:black; color:white; padding:10px; width:100%; border:none; border-radius:5px; }
        input { width:100%; padding:8px; margin:5px 0; }
      </style>
    </head>
    <body>
      <h2>Menu</h2>

      <input id="name" placeholder="Your Name"/>
      <input id="phone" placeholder="Phone Number"/>

      <div id="menu">`;

    menu.rows.forEach(item => {
      html += `
        <div class="item">
          <b>${item.name}</b><br>
          ₹${item.price}<br>
          <select id="${item.id}" style="width:100%;padding:10px;margin-top:5px">
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

    html += `
      </div>
      <button class="btn" onclick="order()">Place Order</button>

      <script>
        async function order(){
          const items = [];
          ${menu.rows.map(i => `
            const q${i.id} = document.getElementById("${i.id}").value;
            if(q${i.id} > 0) items.push({ menu_item_id: "${i.id}", quantity: q${i.id} });
          `).join("")}

          const res = await fetch("/order/create", {
            method:"POST",
            headers:{ "Content-Type":"application/json" },
            body: JSON.stringify({
              restaurant_id: "${restaurant_id}",
              table_id: "${table_id}",
              name: document.getElementById("name").value,
              phone: document.getElementById("phone").value,
              items
            })
          });

          const data = await res.json();
          if(data.redirect) window.location = data.redirect;
          else alert(data.error);
        }
      </script>
    </body>
    </html>
    `;

    res.send(html);
  } catch (err) {
    res.send("Something went wrong");
  }
});


// ------------------- ORDER PROTECTION -------------------
app.post("/order/create", async (req, res) => {
  try {
    const { restaurant_id, table_id, name, phone, items } = req.body;

    if (!phone || phone.length !== 10) {
      return res.status(400).json({ error: "Invalid phone number" });
    }

    if (!items || items.length === 0) {
      return res.status(400).json({ error: "No items selected" });
    }

    const last = await pool.query(
      "SELECT * FROM order_locks WHERE table_id = $1 AND last_order_time > NOW() - INTERVAL '30 seconds'",
      [table_id]
    );

    if (last.rows.length > 0) {
      return res.status(400).json({ error: "Order already submitted. Please wait." });
    }

    await pool.query(
      "INSERT INTO order_locks (id, table_id) VALUES ($1,$2)",
      [uuidv4(), table_id]
    );

    const customer = await pool.query(
      "INSERT INTO customers (id, restaurant_id, name, phone, created_at) VALUES ($1,$2,$3,$4,now()) RETURNING id",
      [uuidv4(), restaurant_id, name, phone]
    );

    const order = await pool.query(
      "INSERT INTO orders (id, restaurant_id, table_id, customer_id, status, created_at) VALUES ($1,$2,$3,$4,'new',now()) RETURNING id",
      [uuidv4(), restaurant_id, table_id, customer.rows[0].id]
    );

    for (let item of items) {
      await pool.query(
        "INSERT INTO order_items (id, order_id, menu_item_id, quantity) VALUES ($1,$2,$3,$4)",
        [uuidv4(), order.rows[0].id, item.menu_item_id, item.quantity]
      );
    }

    res.json({ success: true, redirect: "/thank-you" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ------------------- UPDATE ORDER STATUS -------------------
app.post("/order/update-status", async (req, res) => {
  try {
    const { order_id, status } = req.body;

    if (!["preparing", "served"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    await pool.query(
      "UPDATE orders SET status = $1 WHERE id = $2",
      [status, order_id]
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ------------------- GET ORDERS -------------------
app.get("/orders/:restaurant_id", async (req, res) => {
  try {
    const { restaurant_id } = req.params;

    const orders = await pool.query(`
      SELECT o.id, o.status, o.created_at, c.name as customer_name, c.phone, t.table_number
      FROM orders o
      JOIN customers c ON o.customer_id = c.id
      JOIN tables t ON o.table_id = t.id
      WHERE o.restaurant_id = $1
      ORDER BY o.created_at DESC
    `, [restaurant_id]);

    const data = orders.rows.map(order => {
      const review = `http://localhost:4000/review/${order.id}`;

      const msg = `Hi ${order.customer_name}, thanks for visiting 😊

We'd love your feedback:
👉 ${review}

Reply here anytime for offers or reservations.`;

      const wa = order.status === "served"
        ? `https://wa.me/91${order.phone}?text=${encodeURIComponent(msg)}`
        : null;

      return {
        ...order,
        whatsapp_link: wa,
        review_link: review,
        can_message: order.status === "served"
      };
    });

    res.json(data);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ------------------- REVIEW TRACKING -------------------
app.get("/review/:order_id", async (req, res) => {
  try {
    const { order_id } = req.params;

    const order = await pool.query(
      "SELECT restaurant_id FROM orders WHERE id = $1",
      [order_id]
    );

    if (order.rows.length === 0) return res.send("Invalid link");

    await pool.query(
      "INSERT INTO reviews (id, order_id, restaurant_id) VALUES ($1,$2,$3)",
      [uuidv4(), order_id, order.rows[0].restaurant_id]
    );

    res.redirect("https://www.google.com/maps");

  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.get("/dashboard/:restaurant_id", async (req, res) => {
  const { restaurant_id } = req.params;

  res.send(`
    <html>
    <head>
      <title>Restaurant Dashboard</title>
      <style>
        body { font-family: Arial; background:#f4f4f4; padding:20px; }
        .card { background:white; padding:15px; margin-bottom:10px; border-radius:6px; }
        .btn { padding:6px 10px; margin-right:5px; cursor:pointer; border:none; border-radius:4px; }
        .serve { background:green; color:white; }
        .prep { background:orange; color:white; }
        .wa { background:#25D366; color:white; }
      </style>
    </head>
    <body>
      <h2>Orders</h2>
      <div id="orders"></div>

      <script>
        async function load() {
          const res = await fetch("/orders/${restaurant_id}");
          const data = await res.json();

          const el = document.getElementById("orders");
          el.innerHTML = "";

          data.forEach(o => {
            const div = document.createElement("div");
            div.className = "card";
            div.innerHTML = \`
              <b>Table:</b> \${o.table_number}<br>
              <b>Name:</b> \${o.customer_name}<br>
              <b>Status:</b> \${o.status}<br><br>

              <button class="btn prep" onclick="update('\${o.id}','preparing')">Preparing</button>
              <button class="btn serve" onclick="update('\${o.id}','served')">Served</button>
              \${o.whatsapp_link ? '<a class="btn wa" href="'+o.whatsapp_link+'" target="_blank">WhatsApp</a>' : ''}
            \`;
            el.appendChild(div);
          });
        }

        async function update(id, status) {
          await fetch("/order/update-status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ order_id: id, status })
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

app.get("/setup/:restaurant_id", async (req, res) => {
  const { restaurant_id } = req.params;

  res.send(`
    <html>
    <head>
      <title>Restaurant Setup</title>
      <style>
        body { font-family: Arial; background:#f5f5f5; padding:30px; }
        .box { background:white; padding:20px; max-width:400px; margin:auto; border-radius:8px; }
        input, button { width:100%; padding:10px; margin:8px 0; }
        button { background:black; color:white; border:none; }
      </style>
    </head>
    <body>
      <div class="box">
        <h2>Restaurant Setup</h2>

        <input id="name" placeholder="Restaurant Name"/>
        <input id="review" placeholder="Google Review Link"/>

        <button onclick="save()">Save</button>

        <script>
          async function save(){
            await fetch("/setup/save", {
              method:"POST",
              headers:{ "Content-Type":"application/json" },
              body: JSON.stringify({
                restaurant_id: "${restaurant_id}",
                name: document.getElementById("name").value,
                google_review_url: document.getElementById("review").value
              })
            });
            alert("Saved");
          }
        </script>
      </div>
    </body>
    </html>
  `);
});

app.post("/setup/save", async (req, res) => {
  try {
    const { restaurant_id, name, google_review_url } = req.body;

    await pool.query(
      "UPDATE restaurants SET name=$1, google_review_url=$2 WHERE id=$3",
      [name, google_review_url, restaurant_id]
    );

    res.json({ success:true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ------------------- GLOBAL ERROR HANDLER -------------------
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    error: "Something went wrong. Please ask staff for help."
  });
});

app.get("/menu/:restaurant_id", ...)
app.get("/dashboard/:restaurant_id", ...)
app.get("/orders/:restaurant_id", ...)


// ------------------- START SERVER -------------------
app.listen(4000, () => {
  console.log("Server running on port 4000");
});
