/** @typedef {import('node:net').Socket & { encrypted?: boolean }} PossiblyEncryptedSocket  */

/** @typedef {Omit<import('node:http').IncomingMessage, "socket"> & { ip?: string; protocol?: string; socket?: PossiblyEncryptedSocket; }} DecoratedRequest  */
import { Readable, promises } from "node:stream";

import { FetchEvent } from "../event.js";

// function fixStacktrace(/** @type {Error} */ err) {
// 	err.stack = err.stack?.replaceAll("/@fs/", "/");
// 	viteServer.ssrFixStacktrace(err);
// }

// TODO: Support the newer `Forwarded` standard header
function getForwardedHeader(
  /** @type {DecoratedRequest} */ req,
  /** @type {string} */ name
) {
  return (String(req.headers["x-forwarded-" + name]) || "")
    .split(",", 1)[0]
    .trim();
}

/**
 *
 * @param {DecoratedRequest} req
 * @param {import('http').ServerResponse} res
 */
export async function handleNodeRequest(req, res, handler, context) {
  /**
   * @param {number} status
   * @param {string} message
   */
  function renderError(status, message) {
    res.statusCode = status;
    res.end(message);
  }

  try {
    const origin = process.env.ORIGIN,
      trustProxy = process.env.TRUST_PROXY === "1",
      alwaysCallNext = true;

    let { protocol, host } = origin
      ? new URL(origin)
      : {
          protocol: undefined,
          host: undefined,
        };

    if (protocol) {
      protocol = protocol.slice(0, -1);
    }

    protocol =
      protocol ||
      req.protocol ||
      (trustProxy && getForwardedHeader(req, "proto")) ||
      (req.socket?.encrypted && "https") ||
      "http";

    host =
      host ||
      (trustProxy && getForwardedHeader(req, "host")) ||
      req.headers.host;

    if (!host) {
      console.warn(
        "Could not automatically determine the origin host, using 'localhost'. " +
          "Use the 'origin' option or the 'ORIGIN' environment variable to set the origin explicitly."
      );
      host = "localhost";
    }

    const ip =
      req.ip ||
      (trustProxy && getForwardedHeader(req, "for")) ||
      req.socket?.remoteAddress ||
      "";

    let headers = req.headers;
    if (headers[":method"]) {
      headers = Object.fromEntries(
        Object.entries(headers).filter(([key]) => !key.startsWith(":"))
      );
    }

    const request = new Request(protocol + "://" + host + req.url, {
      method: req.method,
      // @ts-expect-error: Node has no headers
      headers,
      // @ts-expect-error: Node has no headers
      body:
        req.method === "GET" || req.method === "HEAD"
          ? undefined
          : req.socket // Deno has no req.socket and can't convert req to ReadableStream
          ? req
          : // Convert to a ReadableStream for Deno
            new ReadableStream({
              start(controller) {
                req.on("data", (chunk) => controller.enqueue(chunk));
                req.on("end", () => controller.close());
                req.on("error", (err) => controller.error(err));
              },
            }),
      duplex: "half",
    });

    const event = new FetchEvent(request, {
      ip,
      passThrough: () => {},
      waitUntil: () => {},
      platform: {
        name: "node",
        request: req,
        response: res,
      },
    });

    const response = await handler(event, context);

    if (!response) {
      renderError(404, "Not found");
      return;
    }

    /** @type {Readable | null} */
    const body =
      response.body instanceof Readable
        ? response.body
        : response.body instanceof ReadableStream &&
          typeof Readable.fromWeb === "function"
        ? Readable.fromWeb(response.body)
        : response.body
        ? Readable.from(response.body)
        : null;

    res.statusCode = response.status;
    for (const [key, value] of response.headers) {
      if (key === "set-cookie") {
        const setCookie = response.headers.getSetCookie();
        res.setHeader("set-cookie", setCookie);
      } else {
        res.setHeader(key, value);
      }
    }

    if (body) {
      body.pipe(res, { end: true });
      await promises.finished(res);
    } else {
      res.setHeader("content-length", "0");
      res.end();
    }

    // const module = await this.app.moduleLoader.load("virtual:entry-dev");
    // await module.default(req, res, () => {
    // 	if (!res.writableEnded) renderError(404, "Not found");
    // });
    // const event = await createFetchEvent(req, res);
    // this.handleEvent();
  } catch (err) {
    if (err instanceof Error) {
      // fixStacktrace(err);
      renderError(500, err.stack || err.message);
    } else {
      renderError(500, "Unknown error");
    }
  }
}
