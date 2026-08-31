import { readFile, writeFile } from "node:fs/promises";

const locale = process.env.BANNER_LOCALE ?? "en-US";
const translations = {
  "en-US": {
    clear: "Clear sky",
    cloudy: "Cloudy",
    rain: "Rain",
    "wind-rain": "Windy rain",
    storm: "Storm",
    snow: "Snow",
    updatedAt: "Updated at",
    location: "Porto Alegre - Brazil",
  },
};

const bannerPath = new URL("../banner.svg", import.meta.url);
const banner = await readFile(bannerPath, "utf8");
const weatherUrl = "https://api.open-meteo.com/v1/forecast?latitude=-30.0346&longitude=-51.2177&current=weather_code,temperature_2m,wind_speed_10m&timezone=America%2FSao_Paulo";
const windyRainThresholdKmh = 25;
const weatherResponse = await fetch(weatherUrl, {
  signal: AbortSignal.timeout(10_000),
});

function replaceRequired(source, pattern, replacement, label) {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const matches = [...source.matchAll(new RegExp(pattern.source, flags))];

  if (matches.length !== 1) {
    throw new Error(`Expected exactly one ${label} in banner.svg, found ${matches.length}`);
  }

  return source.replace(pattern, replacement);
}

function resolveAlert(weatherCode) {
  if (weatherCode >= 95) {
    return {
      state: "red",
      level: "RED ALERT",
      detail: "Severe thunderstorm and intense rain",
    };
  }

  if ((weatherCode >= 71 && weatherCode <= 77) || (weatherCode >= 85 && weatherCode <= 86)) {
    return {
      state: "orange",
      level: "ORANGE ALERT",
      detail: "Heavy rain or snow risk",
    };
  }

  if ((weatherCode >= 51 && weatherCode <= 67) || (weatherCode >= 80 && weatherCode <= 82)) {
    return {
      state: "yellow",
      level: "YELLOW ALERT",
      detail: "Heavy rain and gusty winds",
    };
  }

  return {
    state: "none",
    level: "",
    detail: "",
  };
}

function resolveWeatherState(weatherCode, windSpeed) {
  if (weatherCode >= 95) {
    return "storm";
  }

  if ((weatherCode >= 71 && weatherCode <= 77) || (weatherCode >= 85 && weatherCode <= 86)) {
    return "snow";
  }

  if (weatherCode >= 51 && weatherCode <= 82) {
    return windSpeed >= windyRainThresholdKmh ? "wind-rain" : "rain";
  }

  return weatherCode >= 1 ? "cloudy" : "clear";
}

if (!weatherResponse.ok) {
  throw new Error(`Open-Meteo responded with HTTP ${weatherResponse.status}`);
}

const weatherData = await weatherResponse.json();
const weatherCode = weatherData.current?.weather_code;
const temperature = weatherData.current?.temperature_2m;
const windSpeed = weatherData.current?.wind_speed_10m;

if (typeof weatherCode !== "number" || typeof temperature !== "number" || typeof windSpeed !== "number") {
  throw new Error("Open-Meteo response missing current weather data");
}

const hourText = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  hour12: false,
  timeZone: "America/Sao_Paulo",
}).format(new Date());
const hour = Number(hourText) % 24;
const timeState = hour < 5 || hour >= 19
  ? "night"
  : hour < 7
    ? "dawn"
    : hour < 17
      ? "day"
      : "sunset";

const weatherState = resolveWeatherState(weatherCode, windSpeed);

const alert = resolveAlert(weatherCode);
const text = translations[locale] ?? translations["en-US"];
const weatherDescription = text[weatherState];
const temperatureText = new Intl.NumberFormat(locale, {
  maximumFractionDigits: 1,
}).format(temperature);
const weatherSummary = `${weatherDescription} · ${temperatureText}°C`;
const generatedTime = new Intl.DateTimeFormat(locale, {
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "America/Sao_Paulo",
}).format(new Date());
const updatedAtText = `${text.updatedAt} ${generatedTime}`;

const timePattern = /github-time-(?:day|sunset|night|dawn)/;
const weatherPattern = /weather-(?:clear|cloudy|wind-rain|rain|storm|snow)/;
const alertPattern = /alert-(?:none|yellow|orange|red)/;
const temperaturePattern = /data-temperature="[^"]*"/;
const rootPattern = /<svg\b[^>]*>/;

const cityY = alert.state === "none" ? 87 : 133;
let updatedBanner = replaceRequired(banner, rootPattern, (rootTag) => {
  const rootPatterns = [timePattern, weatherPattern, alertPattern, temperaturePattern];

  for (const pattern of rootPatterns) {
    if (!pattern.test(rootTag)) {
      throw new Error(`Required state ${pattern} not found in the banner root element`);
    }
  }

  return rootTag
    .replace(/\s+lang="[^"]*"/, "")
    .replace(timePattern, `github-time-${timeState}`)
    .replace(weatherPattern, `weather-${weatherState}`)
    .replace(alertPattern, `alert-${alert.state}`)
    .replace(temperaturePattern, `data-temperature="${temperatureText}°C"`)
    .replace(/>$/, ` lang="${locale}">`);
}, "root <svg> element");

updatedBanner = replaceRequired(
  updatedBanner,
  /(<text id="weather-description"[^>]*>)[^<]*/,
  `$1${weatherSummary}`,
  "weather description",
);
updatedBanner = replaceRequired(
  updatedBanner,
  /(<text id="weather-time"[^>]*>)[^<]*/,
  `$1${updatedAtText}`,
  "update time",
);
updatedBanner = replaceRequired(
  updatedBanner,
  /(<text id="weather-alert-level"[^>]*>)[^<]*/,
  `$1${alert.level}`,
  "alert level",
);
updatedBanner = replaceRequired(
  updatedBanner,
  /(<text id="weather-alert-detail"[^>]*>)[^<]*/,
  `$1${alert.detail}`,
  "alert detail",
);
updatedBanner = replaceRequired(
  updatedBanner,
  /(<text id="weather-location"[^>]*?\sy=")[^"]*("[^>]*>)[^<]*/,
  `$1${cityY}$2${text.location}`,
  "weather location",
);

if (updatedBanner !== banner) {
  await writeFile(bannerPath, updatedBanner);
}

const alertLog = alert.level ? `, ${alert.level}` : "";
console.log(`Banner updated: ${weatherSummary}, ${updatedAtText}${alertLog} in Porto Alegre`);
