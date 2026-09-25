// The precision check's stations (25 Sept 2026): 23 South African airports with a live METAR
// archive at the Iowa Environmental Mesonet (network ZA__ASOS), spread over every region Al named.
// Coordinates and elevations are IEM's.
export const STATIONS = [
  { id: 'FACT', name: 'Cape Town',        region: 'Western Cape',   lat: -33.967, lon: 18.600, elev: 42 },
  { id: 'FALW', name: 'Langebaanweg',     region: 'West Coast',     lat: -32.972, lon: 18.158, elev: 34 },
  { id: 'FAGG', name: 'George',           region: 'Garden Route',   lat: -34.006, lon: 22.379, elev: 193 },
  { id: 'FAPE', name: 'Gqeberha',         region: 'Eastern Cape',   lat: -33.984, lon: 25.611, elev: 60 },
  { id: 'FAEL', name: 'East London',      region: 'Eastern Cape',   lat: -33.036, lon: 27.826, elev: 125 },
  { id: 'FAUT', name: 'Mthatha',          region: 'Eastern Cape',   lat: -31.530, lon: 28.670, elev: 752 },
  { id: 'FALE', name: 'Durban',           region: 'KZN coast',      lat: -29.602, lon: 31.130, elev: 109 },
  { id: 'FARB', name: 'Richards Bay',     region: 'KZN coast',      lat: -28.741, lon: 32.092, elev: 28 , skip: 'no METAR in the archive for the period (16 reports)' },
  { id: 'FAPM', name: 'Pietermaritzburg', region: 'KZN inland',     lat: -29.649, lon: 30.399, elev: 729 , skip: 'no METAR in the archive for the period (10 reports)' },
  { id: 'FAOR', name: 'Johannesburg',     region: 'Highveld',       lat: -26.133, lon: 28.239, elev: 1690 },
  { id: 'FAWB', name: 'Pretoria',         region: 'Highveld',       lat: -25.654, lon: 28.224, elev: 1248 },
  { id: 'FAEO', name: 'Ermelo',           region: 'Highveld',       lat: -26.496, lon: 29.980, elev: 1737 , skip: 'one or two reports a day' },
  { id: 'FABL', name: 'Bloemfontein',     region: 'Free State',     lat: -29.093, lon: 26.302, elev: 1348 },
  { id: 'FABM', name: 'Bethlehem',        region: 'Free State',     lat: -28.248, lon: 28.336, elev: 1682 , skip: 'one or two reports a day' },
  { id: 'FACV', name: 'Calvinia',         region: 'Karoo',          lat: -31.482, lon: 19.762, elev: 1000 , skip: 'one or two reports a day' },
  { id: 'FADY', name: 'De Aar',           region: 'Karoo',          lat: -30.675, lon: 23.999, elev: 384 , skip: 'one or two reports a day' },
  { id: 'FAUP', name: 'Upington',         region: 'Northern Cape',  lat: -28.414, lon: 21.260, elev: 836 },
  { id: 'FAKM', name: 'Kimberley',        region: 'Northern Cape',  lat: -28.803, lon: 24.765, elev: 1192 },
  { id: 'FASB', name: 'Springbok',        region: 'Northern Cape',  lat: -29.672, lon: 17.887, elev: 990 , skip: 'one or two reports a day' },
  { id: 'FAMM', name: 'Mahikeng',         region: 'North West',     lat: -25.798, lon: 25.548, elev: 1277 },
  { id: 'FAKN', name: 'Mbombela',         region: 'Lowveld',        lat: -25.383, lon: 31.106, elev: 862 },
  { id: 'FAHS', name: 'Hoedspruit',       region: 'Lowveld',        lat: -24.367, lon: 31.033, elev: 500 },
  { id: 'FAPP', name: 'Polokwane',        region: 'Limpopo',        lat: -23.845, lon: 29.459, elev: 1242 },
];

// FAEL reports by day only (no night hours): scored for the day's high and daytime hours, not the low.
export const SCORED = STATIONS.filter((s) => !s.skip);

export const PERIOD = { from: '2025-01-01', to: '2026-09-24' };

// Real past forecasts (previous-runs API): the value each model gave for an hour from its latest
// run (day 0) and from the run 24 h earlier (day 1). Six models: Open-Meteo's own blend
// (best_match — production's Open-Meteo source), ECMWF, GFS (Pirate Weather's model), ICON,
// UK Met Office, Météo-France.
export const RUN_MODELS = ['best_match', 'ecmwf_ifs025', 'gfs_seamless', 'icon_seamless', 'ukmo_seamless', 'meteofrance_seamless'];
export const RUN_VARS = ['temperature_2m', 'temperature_2m_previous_day1', 'precipitation', 'precipitation_previous_day1', 'wind_speed_10m', 'wind_speed_10m_previous_day1', 'cloud_cover', 'dew_point_2m', 'weather_code'];

// The short-lead archive (historical-forecast API) for what previous-runs lacks: gusts,
// visibility (fog) and Open-Meteo's own rain probability.
export const HIST_MODELS = ['best_match', 'ecmwf_ifs025', 'gfs_seamless'];
export const HIST_VARS = ['wind_gusts_10m', 'visibility', 'precipitation_probability', 'weather_code', 'cloud_cover'];
