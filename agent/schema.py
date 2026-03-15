# Sent to Gemini on every request — keep this SHORT to save tokens

SCHEMA = """
PostgreSQL table: scada_readings

Columns:
  reading_date    DATE     (e.g. '2026-03-13')
  time_slot       TIME     (15-min slots: '00:00' to '23:45')
  frequency_hz    NUMERIC  (grid frequency, ideal = 50.0 Hz)
  demand_met_mw   INTEGER  (total demand)
  nuclear_mw      INTEGER
  wind_mw         INTEGER
  solar_mw        INTEGER
  hydro_mw        INTEGER
  gas_mw          INTEGER
  thermal_mw      INTEGER
  net_demand_mw   INTEGER
  total_gen_mw    INTEGER
  net_exchange_mw INTEGER  (positive=import, negative=export)
"""