import { readFile, writeFile } from "node:fs/promises";

const bannerPath = new URL("../banner.svg", import.meta.url);
const banner = await readFile(bannerPath, "utf8");
const weatherUrl = "https://api.open-meteo.com/v1/forecast?latitude=-30.0346&longitude=-51.2177&current=weather_code,temperature_2m&timezone=America%2FSao_Paulo";
const weatherResponse = await fetch(weatherUrl);

if (!weatherResponse.ok) {
  throw new Error(`Open-Meteo respondeu com HTTP ${weatherResponse.status}`);
}

const weatherData = await weatherResponse.json();
const weatherCode = weatherData.current?.weather_code;
const temperature = weatherData.current?.temperature_2m;

if (typeof weatherCode !== "number" || typeof temperature !== "number") {
  throw new Error("Resposta da Open-Meteo sem dados atuais de clima");
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
const weatherDescription = {
  clear: "Céu limpo",
  cloudy: "Nublado",
  rain: "Chuva",
  storm: "Tempestade",
  snow: "Neve",
}[weatherState];
const localTime = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "America/Sao_Paulo",
}).format(new Date());

const timePattern = /github-time-(?:day|sunset|night|dawn)/;
const weatherPattern = /weather-(?:clear|cloudy|rain|storm|snow)/;

if (!timePattern.test(banner) || !weatherPattern.test(banner)) {
  throw new Error("Estados de horário ou clima não encontrados no banner.svg");
}

const updatedBanner = banner
  .replace(timePattern, `github-time-${timeState}`)
  .replace(weatherPattern, `weather-${weatherState}`)
  .replace(/data-temperature="[^"]*"/, `data-temperature="${temperature}°C"`)
  .replace(/(<text id="weather-description"[^>]*>)[^<]*/, `$1${weatherDescription}`)
  .replace(/(<text id="weather-time"[^>]*>)[^<]*/, `$1${localTime}`);

if (updatedBanner !== banner) {
  await writeFile(bannerPath, updatedBanner);
}

console.log(`Banner atualizado: ${weatherDescription}, ${temperature}°C, ${localTime} em Porto Alegre`);