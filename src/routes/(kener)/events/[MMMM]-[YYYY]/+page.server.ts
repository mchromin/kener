import type { PageServerLoad } from "./$types";
import { error } from "@sveltejs/kit";
import { parse, isValid, getYear, getMonth, addMonths } from "date-fns";
import { GetPageByPathWithMonitors } from "$lib/server/controllers/controller.js";

const MIN_YEAR = 2023;

export const load: PageServerLoad = async ({ params, parent }) => {
  const parentData = await parent();

  // Parse month parameter (format: MMMM-YYYY e.g. "January-2026")
  const monthParam = `${params.MMMM}-${params.YYYY}`;

  let parsedDate: Date;
  try {
    parsedDate = parse(monthParam, "MMMM-yyyy", new Date());
    if (!isValid(parsedDate)) {
      throw error(404, "Invalid date format");
    }
  } catch (e) {
    throw error(404, "Invalid date format");
  }

  const year = getYear(parsedDate);
  const currentDate = new Date();
  const maxDate = addMonths(currentDate, 12);
  const maxYear = getYear(maxDate);

  if (year < MIN_YEAR || year > maxYear) {
    throw error(404, "Date out of allowed range");
  }

  if (year === maxYear && parsedDate > maxDate) {
    throw error(404, "Date out of allowed range");
  }

  // Calculate month timestamps.
  // Built explicitly in UTC: deriving them from startOfMonth()/endOfMonth() would anchor
  // the range to the server process timezone, shifting the window by its UTC offset and
  // dropping (or adding) events at the month boundary.
  const monthStartTs = Math.floor(Date.UTC(getYear(parsedDate), getMonth(parsedDate), 1, 0, 0, 0) / 1000);
  const monthEndTs = Math.floor(Date.UTC(getYear(parsedDate), getMonth(parsedDate) + 1, 1, 0, 0, 0) / 1000) - 1;

  return {
    ...{ monthParam, monthStartTs, monthEndTs },
  };
};
