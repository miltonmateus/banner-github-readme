import { readFile, writeFile } from "node:fs/promises";

const locale = process.env.BANNER_LOCALE ?? "en-US";
const translations = {
  "pt-BR": {
    clear: "Céu limpo",
    cloudy: "Nublado",
    rain: "Chuva",
    storm: "Tempestade",
    snow: "Neve",
    updatedAt: "Atualizado em",
    location: "Porto Alegre - Brasil",
  },
  "en-US": {
    clear: "Clear sky",
    cloudy: "Cloudy",
    rain: "Rain",
    storm: "Storm",
    snow: "Snow",
    updatedAt: "Updated at",
    location: "Porto Alegre - Brazil",
  },
};

const bannerPath = new URL("../banner.svg", import.meta.url);
const banner = await readFile(bannerPath, "utf8");
const weatherUrl = "https://api.open-meteo.com/v1/forecast?latitude=-30.0346&longitude=-51.2177&current=weather_code,temperature_2m&timezone=America%2FSao_Paulo";
const weatherResponse = await fetch(weatherUrl);

if (!weatherResponse.ok) {
  throw new Error(`Open-Meteo responded with HTTP ${weatherResponse.status}`);
}

const weatherData = await weatherResponse.json();
const weatherCode = weatherData.current?.weather_code;
const temperature = weatherData.current?.temperature_2m;

if (typeof weatherCode !== "number" || typeof temperature !== "number") {
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

const weatherState = weatherCode >= 95
  ? "storm"
  : (weatherCode >= 71 && weatherCode <= 77) || (weatherCode >= 85 && weatherCode <= 86)
    ? "snow"
    : weatherCode >= 51 && weatherCode <= 82
      ? "rain"
      : weatherCode >= 1
        ? "cloudy"
        : "clear";

const text = translations[locale] ?? translations["pt-BR"];
const weatherDescription = text[weatherState];
const generatedTime = new Intl.DateTimeFormat(locale, {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "America/Sao_Paulo",
}).format(new Date());
const updatedAtText = `${text.updatedAt} ${generatedTime}`;

const timePattern = /github-time-(?:day|sunset|night|dawn)/;
const weatherPattern = /weather-(?:clear|cloudy|rain|storm|snow)/;

if (!timePattern.test(banner) || !weatherPattern.test(banner)) {
  throw new Error("Time or weather states not found in banner.svg");
}

const updatedBanner = banner
  .replace(/\s+lang="[^"]*"/g, "")
  .replace(/<svg\b([^>]*)>/, `<svg$1 lang="${locale}">`)
  .replace(timePattern, `github-time-${timeState}`)
  .replace(weatherPattern, `weather-${weatherState}`)
  .replace(/data-temperature="[^"]*"/, `data-temperature="${temperature}°C"`)
  .replace(/(<text id="weather-description"[^>]*>)[^<]*/, `$1${weatherDescription}`)
  .replace(/(<text id="weather-time"[^>]*>)[^<]*/, `$1${updatedAtText}`)
  .replace("Porto Alegre - Brasil", text.location)
  .replace("Porto Alegre - Brazil", text.location);

if (updatedBanner !== banner) {
  await writeFile(bannerPath, updatedBanner);
}

console.log(`Banner updated: ${weatherDescription}, ${temperature}°C, ${updatedAtText} in Porto Alegre`);