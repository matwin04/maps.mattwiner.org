import fs from 'fs';
import path from 'path';
import gtfsRealtime from 'gtfs-realtime';
import gtfsToGeoJSON from "gtfs-to-geojson";
import {
    importGtfs,
    openDb,
    closeDb,
    getAgencies,
    getRoutes,
    getStops,
    getStopsAsGeoJSON,
    getShapesAsGeoJSON
} from 'gtfs';

const config = JSON.parse(
    fs.readFileSync(new URL('./config.json', import.meta.url), 'utf8')
);

const agencies = config.agencies;

function deleteIfExists(filePath) {
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
}

function ensureDirectory(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function buildUrl(url, apiKey) {
    if (!apiKey) {
        return url;
    }

    const separator = url.includes('?') ? '&' : '?';

    return `${url}${separator}api_key=${apiKey}`;
}

async function downloadAgencyFeeds(agency) {
    try {
        const outputDir = `./public/feeds/${agency.agencyKey}`;

        ensureDirectory(outputDir);

        const vehicleFile = path.join(
            outputDir,
            'vehicle_positions.json'
        );

        const tripFile = path.join(
            outputDir,
            'trip_updates.json'
        );
        const staticFile = path.join(
            outputDir,
            'static.json'
        )

        deleteIfExists(vehicleFile);
        deleteIfExists(tripFile);
        deleteIfExists(staticFile);

        const vehicleUrl = buildUrl(
            agency.vehicleUrl,
            agency.apiKey
        );

        const tripUrl = buildUrl(
            agency.tripUrl,
            agency.apiKey
        );

        // Vehicle Positions
        await gtfsRealtime({
            agencyKey: agency.agencyKey,
            url: vehicleUrl,
            output: vehicleFile
        });
        await gtfsToGeoJSON({
            agencyKey: agency.agencyKey,
            url: agency.staticUrl,
        })

        console.log(
            `[${agency.agencyKey}] Vehicle Positions Download Successful`
        );

        // Trip Updates
        await gtfsRealtime({
            agencyKey: agency.agencyKey,
            url: tripUrl,
            output: tripFile
        });

        console.log(
            `[${agency.agencyKey}] Trip Updates Download Successful`
        );

    } catch (err) {
        console.error(`[${agency.agencyKey}]`, err);
    }
}

export async function downloadRealtime() {
    for (const agency of agencies) {
        await downloadAgencyFeeds(agency);
    }
}

// =============================================
// STATIC (node-gtfs)
// =============================================

function writeJson(filePath, data) {
    const tmp = `${filePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data));
    fs.renameSync(tmp, filePath);
}

async function downloadAgencyStatic(agency) {
    if (!agency.staticUrl) return;

    try {
        const outputDir = path.join(config.feedsDir, agency.agencyKey);
        const sqlitePath = path.join(config.dbDir, `${agency.agencyKey}.sqlite`);

        ensureDirectory(outputDir);
        ensureDirectory(config.dbDir);

        // Start from a clean database each import
        if (fs.existsSync(sqlitePath)) {
            try { closeDb(openDb({ sqlitePath })); } catch { /* not open */ }
            fs.unlinkSync(sqlitePath);
        }

        await importGtfs({
            sqlitePath,
            agencies: [{ url: agency.staticUrl }],
            verbose: false
        });

        console.log(`[${agency.agencyKey}] Static Import Successful`);

        const db = openDb({ sqlitePath });
        const opts = { db };

        writeJson(path.join(outputDir, 'agency.json'), getAgencies({}, [], [], opts));
        writeJson(path.join(outputDir, 'routes.json'), getRoutes({}, [], [], opts));
        writeJson(path.join(outputDir, 'stops.json'), getStops({}, [], [], opts));
        writeJson(path.join(outputDir, 'stops.geojson'), getStopsAsGeoJSON({}, opts));
        writeJson(path.join(outputDir, 'shapes.geojson'), getShapesAsGeoJSON({}, opts));

        console.log(`[${agency.agencyKey}] Static JSON Export Successful`);

    } catch (err) {
        console.error(`[${agency.agencyKey}] Static`, err);
    }
}

export async function downloadStatic() {
    for (const agency of agencies) {
        await downloadAgencyStatic(agency);
    }
}