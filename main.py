"""
NLDC FastAPI Backend
====================
Serves load curve data from Neon Postgres to the React frontend.

Run:
    uvicorn main:app --reload

Endpoints:
    GET /load-curve?date=2026-03-13
    GET /load-curve?from=2026-03-07&to=2026-03-13
    GET /dates                        <- list all dates in DB
    GET /summary?date=2026-03-13      <- peak, min, avg demand
"""

import os
from datetime import date, datetime
from typing import Optional

import psycopg2
import psycopg2.extras
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

app = FastAPI(title="NLDC Grid API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# SQL agent
from agent_api import router as agent_router
app.include_router(agent_router)


def get_conn():
    return psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)


# ── endpoints ─────────────────────────────────────────────────────────────────

@app.get("/dates")
def list_dates():
    """All dates available in the database."""
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT reading_date, COUNT(*) as slots
                FROM scada_readings
                GROUP BY reading_date
                ORDER BY reading_date DESC
            """)
            return cur.fetchall()


@app.get("/load-curve")
def load_curve(
    date: Optional[str]  = Query(None, description="Single date YYYY-MM-DD"),
    from_: Optional[str] = Query(None, alias="from", description="Start date YYYY-MM-DD"),
    to:    Optional[str] = Query(None, description="End date YYYY-MM-DD"),
):
    """
    Returns 15-min SCADA data.
    Use ?date= for a single day, or ?from=&to= for a range.
    """
    if date:
        sql = """
            SELECT
                reading_date, time_slot,
                frequency_hz, demand_met_mw,
                nuclear_mw, wind_mw, solar_mw,
                hydro_mw, gas_mw, thermal_mw,
                net_demand_mw, total_gen_mw, net_exchange_mw
            FROM scada_readings
            WHERE reading_date = %s
            ORDER BY time_slot
        """
        params = (date,)

    elif from_ and to:
        sql = """
            SELECT
                reading_date, time_slot,
                frequency_hz, demand_met_mw,
                nuclear_mw, wind_mw, solar_mw,
                hydro_mw, gas_mw, thermal_mw,
                net_demand_mw, total_gen_mw, net_exchange_mw
            FROM scada_readings
            WHERE reading_date BETWEEN %s AND %s
            ORDER BY reading_date, time_slot
        """
        params = (from_, to)

    else:
        raise HTTPException(status_code=400, detail="Pass ?date= or ?from=&to=")

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            rows = cur.fetchall()

    if not rows:
        raise HTTPException(status_code=404, detail="No data found for the given date(s)")

    # Convert time_slot (timedelta from postgres) to "HH:MM" string
    result = []
    for row in rows:
        r = dict(row)
        ts = r["time_slot"]
        if hasattr(ts, "seconds"):
            h, rem = divmod(ts.seconds, 3600)
            m = rem // 60
            r["time_slot"] = f"{h:02d}:{m:02d}"
        r["reading_date"] = str(r["reading_date"])
        result.append(r)

    return result


@app.get("/summary")
def summary(date: str = Query(..., description="Date YYYY-MM-DD")):
    """Full power engineering metrics for a given day."""
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                WITH base AS (
                    SELECT
                        reading_date,
                        demand_met_mw,
                        solar_mw,
                        wind_mw,
                        hydro_mw,
                        thermal_mw,
                        nuclear_mw,
                        gas_mw,
                        total_gen_mw,
                        frequency_hz
                    FROM scada_readings
                    WHERE reading_date = %s
                )
                SELECT
                    reading_date,

                    -- Demand metrics
                    MAX(demand_met_mw)                                      AS peak_demand_mw,
                    MIN(demand_met_mw)                                      AS min_demand_mw,
                    ROUND(AVG(demand_met_mw))                               AS avg_demand_mw,

                    -- Energy consumed (MU) — each slot is 15 min = 0.25 hr
                    ROUND(SUM(demand_met_mw) * 0.25 / 1000, 2)             AS energy_consumed_mu,

                    -- Load factor = avg load / peak load (higher = better utilisation)
                    ROUND(AVG(demand_met_mw)::numeric / NULLIF(MAX(demand_met_mw), 0), 4) AS load_factor,

                    -- Diversity factor = sum of individual peaks / coincident peak
                    -- Approximated as peak_total_gen / avg_total_gen
                    ROUND(MAX(total_gen_mw)::numeric / NULLIF(AVG(total_gen_mw), 0), 4)   AS diversity_factor,

                    -- Utilisation factor = peak demand / installed capacity proxy (max gen seen)
                    ROUND(MAX(demand_met_mw)::numeric / NULLIF(MAX(total_gen_mw), 0), 4)  AS utilisation_factor,

                    -- Loss factor = 1 - (energy_demand / energy_generated)
                    ROUND(1 - (SUM(demand_met_mw)::numeric / NULLIF(SUM(total_gen_mw), 0)), 4) AS loss_factor,

                    -- Generation mix
                    ROUND(AVG(solar_mw))                                    AS avg_solar_mw,
                    ROUND(AVG(wind_mw))                                     AS avg_wind_mw,
                    ROUND(AVG(hydro_mw))                                    AS avg_hydro_mw,
                    ROUND(AVG(thermal_mw))                                  AS avg_thermal_mw,
                    ROUND(AVG(nuclear_mw))                                  AS avg_nuclear_mw,
                    ROUND(AVG(gas_mw))                                      AS avg_gas_mw,
                    MAX(solar_mw)                                           AS peak_solar_mw,
                    MAX(wind_mw)                                            AS peak_wind_mw,

                    -- Renewable share
                    ROUND((AVG(solar_mw) + AVG(wind_mw) + AVG(hydro_mw))::numeric
                          / NULLIF(AVG(total_gen_mw), 0) * 100, 1)         AS renewable_pct,

                    -- Frequency
                    ROUND(AVG(frequency_hz), 4)                            AS avg_frequency_hz,
                    MIN(frequency_hz)                                       AS min_frequency_hz,
                    MAX(frequency_hz)                                       AS max_frequency_hz,

                    COUNT(*)                                                AS slots
                FROM base
                GROUP BY reading_date
            """, (date,))
            row = cur.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="No data for this date")

    r = dict(row)
    r["reading_date"] = str(r["reading_date"])
    return r