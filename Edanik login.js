const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("attendance.db");

db.run(`
    CREATE TABLE IF NOT EXISTS attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone TEXT,
        name TEXT,
        time TEXT,
        type TEXT,
        action TEXT,
        latitude REAL,
        longitude REAL,
        locationName TEXT,
        address TEXT,
        message TEXT,
        imageId TEXT,
        caption TEXT
    )
`);

db.run("ALTER TABLE attendance ADD COLUMN name TEXT", (err) => {
    if (err && !err.message.includes("duplicate column name")) {
        console.log(err.message);
    }
});
const axios = require("axios");
const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs");

const app = express();
app.use(bodyParser.json());

const VERIFY_TOKEN = "edanik123";

const staff = {
    "971561333473": "Muhannad Test Nurse"
};

app.get("/", (req, res) => {
    res.send("Edanik Nursing App Running");
});

app.get("/webhook", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
        console.log("Webhook verified!");
        return res.status(200).send(challenge);
    }

    res.sendStatus(403);
});

async function sendWhatsAppMessage(to, message) {
    try {
        await axios({
            method: "POST",
            url: "https://graph.facebook.com/v25.0/1701257314388468/messages",
            headers: {
                Authorization: "Bearer EAANJQgSYn7kBRkW1ezQQ1skpw7Qwjz0UP7h5Aly6h9ZBfQGw6XGLo72ZCdtAYhe9batZApU48Qmw07fGRz1R83ZCgxX7HzislV1Jj5UBQzlZB89x6wGSNZCvmmenDes9b5Dp7FnZAdOYc94aUOcT5UGuodDJUdd4zqOsGUyhr6gwVnfxnm2gibcjEUwijIOLAeTacZAZA3zJq2aCOIGQk24IOEs5yGh2LBzgc6B3ZCZCQvHkjbjKBkn0NohFtt4PS2sfVptluC1mrZBZAB7KfGzPExQUGs2nIdVWmNNcZD",
                "Content-Type": "application/json"
            },
            data: {
                messaging_product: "whatsapp",
                to: to,
                text: {
                    body: message
                }
            }
        });

        console.log("Reply sent!");

    } catch (error) {
        console.log("Reply failed:");
        console.log(error.response?.data || error.message);
    }
}

async function downloadWhatsAppImage(imageId) {
    try {
        const response = await axios({
            method: "GET",
            url: `https://graph.facebook.com/v25.0/${imageId}`,
            headers: {
                Authorization: "Bearer EAANJQgSYn7kBRkW1ezQQ1skpw7Qwjz0UP7h5Aly6h9ZBfQGw6XGLo72ZCdtAYhe9batZApU48Qmw07fGRz1R83ZCgxX7HzislV1Jj5UBQzlZB89x6wGSNZCvmmenDes9b5Dp7FnZAdOYc94aUOcT5UGuodDJUdd4zqOsGUyhr6gwVnfxnm2gibcjEUwijIOLAeTacZAZA3zJq2aCOIGQk24IOEs5yGh2LBzgc6B3ZCZCQvHkjbjKBkn0NohFtt4PS2sfVptluC1mrZBZAB7KfGzPExQUGs2nIdVWmNNcZD"
            }
        });

        const imageUrl = response.data.url;

        const imageResponse = await axios({
            method: "GET",
            url: imageUrl,
            responseType: "stream",
            headers: {
                Authorization: "Bearer EAANJQgSYn7kBRkW1ezQQ1skpw7Qwjz0UP7h5Aly6h9ZBfQGw6XGLo72ZCdtAYhe9batZApU48Qmw07fGRz1R83ZCgxX7HzislV1Jj5UBQzlZB89x6wGSNZCvmmenDes9b5Dp7FnZAdOYc94aUOcT5UGuodDJUdd4zqOsGUyhr6gwVnfxnm2gibcjEUwijIOLAeTacZAZA3zJq2aCOIGQk24IOEs5yGh2LBzgc6B3ZCZCQvHkjbjKBkn0NohFtt4PS2sfVptluC1mrZBZAB7KfGzPExQUGs2nIdVWmNNcZD"
            }
        });

        const filePath = `images/${imageId}.jpg`;

        const writer = fs.createWriteStream(filePath);

        imageResponse.data.pipe(writer);

        writer.on("finish", () => {
            console.log("Image saved:", filePath);
        });

    } catch (error) {
        console.log("Image download failed");
        console.log(error.response?.data || error.message);
    }
}

app.post("/webhook", (req, res) => {
    console.log("Webhook Received!");
    console.log(JSON.stringify(req.body, null, 2));

    const value = req.body.entry?.[0]?.changes?.[0]?.value;
    const message = value?.messages?.[0];

    if (!message) {
        return res.sendStatus(200);
    }

    const from =
        message.from ||
        value.contacts?.[0]?.wa_id ||
        "unknown";
    const messageType = message.type;
    const now = new Date().toISOString();

    let record = {
        phone: from,
        name: staff[from] || "Unknown Staff",
        time: now,
        type: messageType
    };

    if (messageType === "text") {
        const text = message.text.body.toLowerCase();
        console.log("TEXT RECEIVED:", text);

        if (text.includes("check in") || text.includes("checkin")) {
            record.action = "CHECK_IN_REQUEST";
            record.note = "Staff requested check-in";
            sendWhatsAppMessage(from, "Please share your location for check-in.");
        } else if (text.includes("check out")) {
            record.action = "CHECK_OUT_REQUEST";
            record.note = "Staff requested check-out";
        } else {
            record.action = "NORMAL_MESSAGE";
            record.message = message.text.body;
        }
    }

    if (messageType === "location") {
        record.action = "LOCATION_RECEIVED";
        record.latitude = message.location.latitude;
        record.longitude = message.location.longitude;
        record.locationName = message.location.name || "";
        record.address = message.location.address || "";

        sendWhatsAppMessage(
            from,
            `Attendance recorded successfully. Location received: ${record.latitude}, ${record.longitude}`
        );


    }

    if (messageType === "image") {
        record.action = "SELFIE_RECEIVED";

        record.imageId = message.image.id;
        downloadWhatsAppImage(record.imageId);
        record.caption = message.image.caption || "";

        sendWhatsAppMessage(
            from,
            "Selfie received successfully. Attendance completed."
        );
    }

    db.run(
        `INSERT INTO attendance 
    (phone, name, time, type, action, latitude, longitude, locationName, address, message, imageId, caption)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            record.phone,
            record.name,
            record.time,
            record.type,
            record.action || "",
            record.latitude || null,
            record.longitude || null,
            record.locationName || "",
            record.address || "",
            record.message || "",
            record.imageId || "",
            record.caption || ""
        ]
    );

    console.log("Saved Record:");
console.log(record);

res.sendStatus(200);
});


    app.get("/dashboard", (req, res) => {
        db.all("SELECT * FROM attendance ORDER BY id DESC", [], (err, rows) => {
            if (err) return res.send("Database error");

            let html = `
        <html>
        <head>
            <title>Edanik Attendance Dashboard</title>
            <meta http-equiv="refresh" content="10">
            <style>
                body {
                    font-family: Arial, sans-serif;
                    background: #f4f6f8;
                    padding: 30px;
                }
                    
                h1 {
                    color: #0f172a;
                }
                .cards {
                    display: flex;
                    gap: 20px;
                    margin-bottom: 25px;
                }
                .card {
                    background: white;
                    padding: 20px;
                    border-radius: 12px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
                    min-width: 180px;
                }
                .card h2 {
                    margin: 0;
                    font-size: 28px;
                    color: #2563eb;
                }
                .card p {
                    margin: 5px 0 0;
                    color: #64748b;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    background: white;
                    border-radius: 12px;
                    overflow: hidden;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
                }
                th {
                    background: #0f172a;
                    color: white;
                    padding: 12px;
                    text-align: left;
                }
                td {
                    padding: 12px;
                    border-bottom: 1px solid #e5e7eb;
                }
                .badge {
                    padding: 5px 10px;
                    border-radius: 999px;
                    font-size: 12px;
                    font-weight: bold;
                }
                .checkin {
                    background: #dbeafe;
                    color: #1d4ed8;
                }
                .location {
                    background: #dcfce7;
                    color: #166534;
                }
                .normal {
                    background: #f1f5f9;
                    color: #475569;
                }
                a {
                    color: #2563eb;
                    text-decoration: none;
                    font-weight: bold;
                }
            </style>
        </head>
        <body>
        <p>Live Dashboard - ${new Date().toLocaleString()}</p>
            <h1>Edanik Nursing Attendance Dashboard</h1>

            <a href="/export" style="display:inline-block;margin-bottom:20px;background:#2563eb;color:white;padding:10px 16px;border-radius:8px;text-decoration:none;">
    Download CSV Report
</a>

            <div class="cards">
                <div class="card">
                    <h2>${rows.length}</h2>
                    <p>Total Records</p>
                </div>
                <div class="card">
                    <h2>${rows.filter(r => r.action === "CHECK_IN_REQUEST").length}</h2>
                    <p>Check-ins</p>
                </div>
                <div class="card">
                    <h2>${rows.filter(r => r.action === "LOCATION_RECEIVED").length}</h2>
                    <p>Locations</p>
                </div>
            </div>

            <table>
                <tr>
                    <th>ID</th>
                    <th>Phone</th>
                    <th>Name</th>
                    <th>Time</th>
                    <th>Type</th>
                    <th>Action</th>
                    <th>Location</th>
                    <th>Address</th>
                    <th>Message</th>
                </tr>
        `;

            rows.forEach(row => {
                let badgeClass = "normal";
                if (row.action === "CHECK_IN_REQUEST") badgeClass = "checkin";
                if (row.action === "LOCATION_RECEIVED") badgeClass = "location";

                html += `
                <tr>
                    <td>${row.id}</td>
                    <td>${row.phone}</td>
                    <td>${row.name || "Unknown Staff"}</td>
                    <td>${row.time}</td>
                    <td>${row.type}</td>
                    <td><span class="badge ${badgeClass}">${row.action}</span></td>
                    <td>
                        ${row.latitude && row.longitude
                        ? `<a href="https://maps.google.com/?q=${row.latitude},${row.longitude}" target="_blank">Open Map</a>`
                        : ""
                    }
                    </td>
                    <td>${row.address || ""}</td>
                    <td>${row.message || ""}</td>
                </tr>
            `;
            });

            html += `
            </table>
        </body>
        </html>
        `;

            res.send(html);
        });
    });

    app.get("/export", (req, res) => {
        db.all("SELECT * FROM attendance ORDER BY id DESC", [], (err, rows) => {
            if (err) return res.send("Export error");

            let csv = "ID,Phone,Name,Time,Type,Action,Latitude,Longitude,Address,Message\n";

            rows.forEach(row => {
                csv += `${row.id},${row.phone},${row.name || ""},${row.time},${row.type},${row.action},${row.latitude || ""},${row.longitude || ""},"${row.address || ""}","${row.message || ""}"\n`;
            });

            res.header("Content-Type", "text/csv");
            res.attachment("attendance_report.csv");
            res.send(csv);
        });
    });

    app.listen(3000, () => {
        console.log("Server running on port 3000");
    });