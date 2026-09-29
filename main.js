import express from "express";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { engine } from "express-handlebars";
import { fileURLToPath } from "url";
import session from 'express-session';
import { downloadRealtime, downloadStatic } from "./realtime.js";
dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VIEWS_DIR = path.join(__dirname, "views");
const PARTIALS_DIR = path.join(VIEWS_DIR, "partials");
const DB_PATH = path.join(__dirname, "public", "data.db");
const FEEDS_DIR = path.join(__dirname, "public", "feeds");
const REALTIME_STALE_MS = 5 * 60 * 1000; // realtime older than 5 min = stale

// =============================================
// DATABASE INITIALIZATION
// ======

// =============================================
// FEED STATUS
// =============================================

function readJson(filePath) {
    try {
        return JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch {
        return null;
    }
}

function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function timeAgo(ms) {
    const s = Math.round((Date.now() - ms) / 1000);
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.round(s / 60)}m ago`;
    if (s < 86400) return `${Math.round(s / 3600)}h ago`;
    return `${Math.round(s / 86400)}d ago`;
}

function formatTime(ms) {
    return new Date(ms).toLocaleString("en-US", {
        timeZone: "America/Los_Angeles",
        dateStyle: "short",
        timeStyle: "medium",
    });
}

function getFeedStatus() {
    if (!fs.existsSync(FEEDS_DIR)) return [];

    return fs
        .readdirSync(FEEDS_DIR, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => {
            const key = d.name;
            const dir = path.join(FEEDS_DIR, key);

            const staticDir = path.join(dir, "static");
            const realtimeDir = path.join(dir, "realtime");

            const files = ["static", "realtime"].flatMap((sub) => {
                const subDir = path.join(dir, sub);
                if (!fs.existsSync(subDir)) return [];
                return fs
                    .readdirSync(subDir)
                    .filter((f) => !f.endsWith(".tmp"))
                    .sort()
                    .map((name) => {
                        const stat = fs.statSync(path.join(subDir, name));
                        return {
                            name: `${sub}/${name}`,
                            url: `/public/feeds/${key}/${sub}/${name}`,
                            size: formatSize(stat.size),
                            mtime: stat.mtimeMs,
                        };
                    });
            });

            const agency = readJson(path.join(staticDir, "agency.json"));
            const routes = readJson(path.join(staticDir, "routes.json"));
            const stops = readJson(path.join(staticDir, "stops.json"));
            const vehicles = readJson(path.join(realtimeDir, "vehicles.geojson"));

            const rtFile = files.find((f) => f.name === "realtime/vehicle_positions.json");
            const hasStatic = Array.isArray(routes);
            const hasRealtime = Boolean(rtFile);
            const lastUpdated = files.length ? Math.max(...files.map((f) => f.mtime)) : null;

            let status = "ok";
            if (!files.length) status = "missing";
            else if (rtFile && Date.now() - rtFile.mtime > REALTIME_STALE_MS) status = "stale";

            return {
                agencyKey: key,
                agencyName: (Array.isArray(agency) && agency[0]?.agency_name) || key,
                hasStatic,
                hasRealtime,
                routeCount: hasStatic ? routes.length : null,
                stopCount: Array.isArray(stops) ? stops.length : null,
                vehicleCount: vehicles?.features ? vehicles.features.length : null,
                lastUpdated: lastUpdated ? formatTime(lastUpdated) : null,
                lastUpdatedAgo: lastUpdated ? timeAgo(lastUpdated) : null,
                status,
                files,
            };
        });
}

// =============================================
// VIEW & STATIC CONFIG
// =============================================

app.engine("html", engine({ extname: ".html", defaultLayout: false, partialsDir: PARTIALS_DIR }));
app.set("view engine", "html");
app.set("views", VIEWS_DIR);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/public", express.static(path.join(__dirname, "public")));
app.use("/views", express.static(path.join(__dirname, "views")));
app.use(
    session({
        secret: process.env.SESSION_SECRET || "thing-secret",
        resave: false,
        saveUninitialized: true,
    })
);

// =============================================
// PAGE ROUTES
// =============================================

app.get("/", (req, res) => {
    res.render("index", { feeds: getFeedStatus() });
});
app.get("/reload", async (req, res) => {
    await downloadRealtime();
    res.redirect("/");
});
app.get("/reload-static", async (req, res) => {
    await downloadStatic();
    res.redirect("/");
});
app.get("/transit", async (req, res) => {
    res.render("map");
});

app.get("/bikes", async (req, res) => {
    res.render("bikes");
});

app.get("/departures", async (req, res) => {
    res.render("station");
});

app.get("/about", (req, res) => {
    res.render("about");
});

if (!process.env.VERCEL && !process.env.NOW_REGION) {
    const PORT = process.env.PORT || 8088;
    app.listen(PORT, () => {
        console.log(`Server running: http://localhost:${PORT}`);
        console.log(`Database: ${DB_PATH}`);
    });
}

export default app;