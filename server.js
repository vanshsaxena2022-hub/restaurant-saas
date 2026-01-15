require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
const pool = require("./db");

const app = express();
app.use(cors());
app.use(express.json());

const BASE_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 4000}`;

/* ===================== HEALTH ===================== */
app.get("/health", (req,res)=>{
  res.json({status:"LIVE", time:new Date()});
});

app.get("/test-db", async (req,res)=>{
  try {
    const r = await pool.query("SELECT NOW()");
    res.json(r.rows[0]);
  } catch(e){
    res.status(500).json({error:e.message});
  }
});

/* ===================== RESTAURANT ===================== */
app.post("/restaurant/signup", async (req,res)=>{
  try{
    const {name, phone, email} = req.body;
    const r = await pool.query(
      "INSERT INTO restaurants(id,name,phone,email) VALUES($1,$2,$3,$4) RETURNING *",
      [uuidv4(), name, phone, email]
    );
    res.json(r.rows[0]);
  }catch(e){
    res.status(500).json({error:e.message});
  }
});

/* ===================== MENU ===================== */
app.post("/menu/add", async (req,res)=>{
  try{
    const {restaurant_id, name, price, category} = req.body;
    const i = await pool.query(
      "INSERT INTO menu_items(id,restaurant_id,name,price,category,is_available) VALUES($1,$2,$3,$4,$5,true) RETURNING *",
      [uuidv4(), restaurant_id, name, price, category]
    );
    res.json(i.rows[0]);
  }catch(e){
    res.status(500).json({error:e.message});
  }
});

/* ===================== TABLE (QR) ===================== */
app.post("/table/add", async (req,res)=>{
  try{
    const {restaurant_id, table_number} = req.body;
    const table_id = uuidv4();
    const qr = `${BASE_URL}/menu/${restaurant_id}/${table_id}`;

    const t = await pool.query(
      "INSERT INTO tables(id,restaurant_id,table_number,qr_url) VALUES($1,$2,$3,$4) RETURNING *",
      [table_id, restaurant_id, table_number, qr]
    );
    res.json(t.rows[0]);
  }catch(e){
    res.status(500).json({error:e.message});
  }
});

/* ===================== CUSTOMER MENU ===================== */
app.get("/menu/:restaurant_id/:table_id", async (req,res)=>{
  const {restaurant_id, table_id} = req.params;
  const menu = await pool.query("SELECT * FROM menu_items WHERE restaurant_id=$1", [restaurant_id]);

  let html = `<html><body><h2>Menu</h2>
    <input id="name" placeholder="Your Name"><br><br>
    <input id="phone" placeholder="Phone"><br><br>`;

  menu.rows.forEach(i=>{
    html += `<div>
      <b>${i.name}</b> ₹${i.price}
      <select data-id="${i.id}">
        <option>0</option><option>1</option><option>2</option><option>3</option><option>4</option>
      </select>
    </div><br>`;
  });

  html += `<button onclick="order()">Place Order</button>
  <script>
    async function order(){
      const items=[];
      document.querySelectorAll("select").forEach(s=>{
        if(s.value>0) items.push({menu_item_id:s.dataset.id, quantity:s.value});
      });
      const res = await fetch("/order/create",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          restaurant_id:"${restaurant_id}",
          table_id:"${table_id}",
          name:document.getElementById("name").value,
          phone:document.getElementById("phone").value,
          items
        })
      });
      const d=await res.json();
      if(d.redirect) window.location=d.redirect; else alert(d.error);
    }
  </script></body></html>`;

  res.send(html);
});

/* ===================== CREATE ORDER ===================== */
app.post("/order/create", async (req,res)=>{
  try{
    const {restaurant_id, table_id, name, phone, items} = req.body;
    if(!items.length) return res.json({error:"No items"});

    const c = await pool.query(
      "INSERT INTO customers(id,name,phone,restaurant_id,created_at) VALUES($1,$2,$3,$4,now()) RETURNING id",
      [uuidv4(), name, phone, restaurant_id]
    );

    const o = await pool.query(
      "INSERT INTO orders(id,restaurant_id,table_id,customer_id,status,created_at) VALUES($1,$2,$3,$4,'new',now()) RETURNING id",
      [uuidv4(), restaurant_id, table_id, c.rows[0].id]
    );

    for(const i of items){
      await pool.query(
        "INSERT INTO order_items(id,order_id,menu_item_id,quantity) VALUES($1,$2,$3,$4)",
        [uuidv4(), o.rows[0].id, i.menu_item_id, i.quantity]
      );
    }

    res.json({redirect:"/thank-you"});
  }catch(e){
    res.status(500).json({error:e.message});
  }
});

app.get("/thank-you",(req,res)=>{
  res.send("<h2>Order Received</h2>");
});

/* ===================== KITCHEN ===================== */
app.get("/orders/:restaurant_id", async (req,res)=>{
  const q = await pool.query(`
    SELECT o.id,o.status,c.name as customer_name,c.phone,t.table_number
    FROM orders o
    JOIN customers c ON o.customer_id=c.id
    JOIN tables t ON o.table_id=t.id
    WHERE o.restaurant_id=$1 ORDER BY o.created_at DESC`,[req.params.restaurant_id]);

  const data = q.rows.map(o=>{
    const review = `${BASE_URL}/review/${o.id}`;
    const msg = `Hi ${o.customer_name}, thanks for visiting 😊\nPlease review us:\n${review}`;
    return {
      ...o,
      whatsapp_link: o.status==="served"?`https://wa.me/91${o.phone}?text=${encodeURIComponent(msg)}`:null,
      can_message:o.status==="served"
    };
  });
  res.json(data);
});

app.post("/order/update-status", async (req,res)=>{
  await pool.query("UPDATE orders SET status=$1 WHERE id=$2",[req.body.status, req.body.order_id]);
  res.json({success:true});
});

app.get("/review/:order_id", async (req,res)=>{
  const o = await pool.query("SELECT restaurant_id FROM orders WHERE id=$1",[req.params.order_id]);
  if(!o.rows.length) return res.send("Invalid");
  await pool.query("INSERT INTO reviews(id,order_id,restaurant_id,created_at) VALUES($1,$2,$3,now())",
    [uuidv4(), req.params.order_id, o.rows[0].restaurant_id]);
  res.redirect("https://www.google.com/maps");
});

/* ===================== DASHBOARD ===================== */
app.get("/dashboard/:restaurant_id",(req,res)=>{
  res.send(`<html><body><h2>Kitchen</h2><div id="o"></div>
  <script>
    async function load(){
      const d=await fetch("/orders/${req.params.restaurant_id}").then(r=>r.json());
      document.getElementById("o").innerHTML=d.map(o=>\`
        <div>
        Table \${o.table_number} - \${o.customer_name} - \${o.status}
        <button onclick="u('\${o.id}','preparing')">Preparing</button>
        <button onclick="u('\${o.id}','served')">Served</button>
        \${o.whatsapp_link?'<a href="'+o.whatsapp_link+'" target="_blank">WhatsApp</a>':''}
        </div>\`).join("");
    }
    async function u(id,s){await fetch("/order/update-status",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({order_id:id,status:s})});load();}
    setInterval(load,3000);load();
  </script></body></html>`);
});

/* ===================== ROOT ===================== */
app.get("/",(req,res)=>res.json({status:"Restaurant SaaS LIVE"}));

/* ===================== START ===================== */
const PORT = process.env.PORT || 4000;
app.listen(PORT, ()=>console.log("Running on",PORT));
