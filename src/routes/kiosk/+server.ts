import type { RequestHandler } from "./$types";
import kiosk from "./kiosk.html?raw";

export const GET: RequestHandler = () =>
  new Response(kiosk, { headers: { "Content-Type": "text/html; charset=utf-8" } });
