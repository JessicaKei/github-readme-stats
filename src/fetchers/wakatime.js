// @ts-check

import axios from "axios";
import { CustomError, MissingParamError } from "../common/error.js";

/**
 * Helper for mapping arrays (languages, editors, categories, operating_systems)
 *
 * @param {Array<any>} items Raw items array from GitHub JSON.
 * @returns {import("./types").WakaTimeData["languages"]} Formatted WakaTime data array.
 */
const mapItems = (items) => {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map((item) => ({
    digital: item.digital || "00:00",
    hours: Number(item.hours || Math.floor((item.total_seconds || 0) / 3600)),
    minutes: Number(
      item.minutes || Math.floor(((item.total_seconds || 0) % 3600) / 60),
    ),
    name: item.name || "Unknown",
    percent: Number(item.percent || 0),
    text: item.text || `${Math.round((item.total_seconds || 0) / 3600)} hrs`,
    total_seconds: Number(item.total_seconds || 0),
  }));
};

/**
 * GitHub data fetcher.
 *
 * @param {string} path Fetcher props.
 * @returns {Promise<import("./types").WakaTimeData>} WakaTime data response.
 */
const fetchFromGitHubStorage = async (path) => {
  const url = `https://raw.githubusercontent.com/${path}`;

  const headers = process.env.PAT_1
    ? { Authorization: `token ${process.env.PAT_1.trim()}` }
    : {};

  try {
    const { data } = await axios.get(url, { timeout: 4000, headers });

    if (!data || !data.languages) {
      throw new Error("Invalid JSON structure in GitHub file");
    }

    const totalSeconds = Number(data.grand_total?.total_seconds || 0);
    const humanTotal = data.grand_total?.text || "0 hrs";

    return {
      // Fill with data from the action (or set empty arrays if the action does not collect them)
      languages: mapItems(data.languages),
      categories: mapItems(data.categories),
      editors: mapItems(data.editors),
      operating_systems: mapItems(data.operating_systems),

      // General time statistics
      total_seconds: totalSeconds,
      total_seconds_including_other_language: totalSeconds,
      human_readable_total: humanTotal,
      human_readable_total_including_other_language: humanTotal,

      // Range (to display "all time" on the card)
      range: data.range?.text || "all time",

      // Default placeholders for fields that don't affect the rendering of the WakaTime card,
      // but are required by the WakaTimeData contract
      daily_average: 0,
      daily_average_including_other_language: 0,
      days_including_holidays: 0,
      days_minus_holidays: 0,
      holidays: 0,
      human_readable_daily_average: "0 mins",
      human_readable_daily_average_including_other_language: "0 mins",
      id: "custom-github-source",
      is_already_updating: false,
      is_coding_activity_visible: true,
      is_including_today: true,
      is_other_usage_visible: false,
      is_stuck: false,
      is_up_to_date: true,
      percent_calculated: 100,
      status: "ok",
      timeout: 15,
      user_id: "custom-user",
      username: "user",
      writes_only: false,
    };
  } catch (err) {
    throw err;
  }
};

/**
 * WakaTime data fetcher.
 *
 * @param {{username: string, api_domain: string }} props Fetcher props.
 * @returns {Promise<import("./types").WakaTimeData>} WakaTime data response.
 */
const fetchWakatimeStats = async ({ username, api_domain }) => {
  if (!username) {
    throw new MissingParamError(["username"]);
  }

  const gitHubApiDomainPrefix = "github/";

  if (api_domain && api_domain.startsWith(gitHubApiDomainPrefix)) {
    try {
      const filePath = api_domain.replace(gitHubApiDomainPrefix, "");
      return await fetchFromGitHubStorage(filePath);
    } catch (err) {
      throw err;
    }
  }

  try {
    const { data } = await axios.get(
      `https://${
        api_domain ? api_domain.replace(/\/$/gi, "") : "wakatime.com"
      }/api/v1/users/${username}/stats?is_including_today=true`,
    );

    return data.data;
  } catch (err) {
    if (err.response.status < 200 || err.response.status > 299) {
      throw new CustomError(
        `Could not resolve to a User with the login of '${username}'`,
        "WAKATIME_USER_NOT_FOUND",
      );
    }
    throw err;
  }
};

export { fetchWakatimeStats };
export default fetchWakatimeStats;
