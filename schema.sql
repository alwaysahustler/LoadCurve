CREATE TABLE IF NOT EXISTS scada_readings (
    id              SERIAL PRIMARY KEY,
    reading_date    DATE        NOT NULL,
    time_slot       TIME        NOT NULL,
    frequency_hz    NUMERIC(5,2),
    demand_met_mw   INTEGER,
    nuclear_mw      INTEGER,
    wind_mw         INTEGER,
    solar_mw        INTEGER,
    hydro_mw        INTEGER,
    gas_mw          INTEGER,
    thermal_mw      INTEGER,
    others_mw       INTEGER,
    net_demand_mw   INTEGER,
    total_gen_mw    INTEGER,
    net_exchange_mw INTEGER,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (reading_date, time_slot)
);

CREATE INDEX IF NOT EXISTS idx_scada_date     ON scada_readings (reading_date);
CREATE INDEX IF NOT EXISTS idx_scada_datetime ON scada_readings (reading_date, time_slot);
