const express = require("express");
const cors = require("cors");

const app = express();

// Increase the JSON payload size limit to 50MB
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.use(
  cors({
    // origin: "https://label-printing.onrender.com",
    origin: "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

const labelRoutes = require("../src/Routes/TableRoute");
const printHistoryRoutes = require("../src/Routes/HistoryRoute");
const configRoutes = require("../src/Routes/ConfigRoute");
app.use("/api/labels", labelRoutes);
app.use("/api/print-history", printHistoryRoutes);
app.use("/api/config", configRoutes);

// If you actually have static files on this server that need serving
// If not, you can remove this block
app.use(
  express.static("public", {
    setHeaders: (res, path) => {
      if (path.endsWith(".css")) {
        res.setHeader("Content-Type", "text/css");
      }
      if (path.endsWith(".jpg") || path.endsWith(".jpeg")) {
        res.setHeader("Content-Type", "image/jpeg");
      }
      if (path.endsWith(".png")) {
        res.setHeader("Content-Type", "image/png");
      }
    },
  })
);

app.get("/", (req, res) => {
  return res.status(200).send({
    message: "ABB Project backend running successfully",
    status: true,
  });
});

module.exports = app;
