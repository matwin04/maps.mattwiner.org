const stopId = ($getenv("widget-param") || "us-ca-Metro-LosAngeles-Rail_801101S").trim();

const now = new Date().toISOString();

const url =
    `https://api.transitous.org/api/v6/stoptimes` +
    `?stopId=${encodeURIComponent(stopId)}` +
    `&time=${encodeURIComponent(now)}` +
    `&arriveBy=false` +
    `&n=10` +
    `&language=en`;
const result = await fetch(url);
const data = JSON.parse(result);

const stopTimes = data.stopTimes || [];

function formatTime(isoString) {
    if (!isoString) return "—";

    return new Date(isoString).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit"
    });
}

function delayColor(scheduled, realtime) {
    if (!scheduled || !realtime) return "grey";

    const delayMin = (new Date(realtime) - new Date(scheduled)) / 60000;

    if (delayMin < 0) return "blue";       // early
    if (delayMin > 10) return "red";       // very late
    if (delayMin > 3) return "orange";     // moderately late
    return "green";                        // on time (within 3 min)
}

$render(
    <vstack
        frame="max"
        padding="12"
        spacing="10"
    >
        <text font="title3">
            Departures
        </text>

        {stopTimes.slice(0, 4).map((item) => {
            const scheduled = item.place?.scheduledDeparture;
            const realtime = item.place?.departure || scheduled;

            return (
                <vstack spacing="2">
                    <hstack spacing="6">
                        <text font="headline">
                            {item.routeLongName || "—"}
                        </text>
                        <text font="subheadline" color="grey">
                            → {item.tripTo?.name?.trim() || "—"}
                        </text>
                    </hstack>

                    <hstack spacing="6">
                        <text font="caption" color="grey">
                            Sched {formatTime(scheduled)}
                        </text>
                        <text font="caption" color={delayColor(scheduled, realtime)}>
                            Live {formatTime(realtime)}
                        </text>
                    </hstack>
                </vstack>
            );
        })}
    </vstack>
);