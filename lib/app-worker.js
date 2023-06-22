import { AsyncLocalStorage } from "node:async_hooks";
import { existsSync, readFileSync } from "node:fs";
import { builtinModules } from "node:module";
import { join } from "node:path";
import { parentPort } from "node:worker_threads";
import invariant from "./invariant.js";
import app from "../app.js";
import { Transform, Writable } from "node:stream";

/**
 *
 * @param {ReadableStream} stream
 * @param {(message: string) => void} onMessage
 */
function streamToMessageChannel(stream, onMessage) {
  const forwardReader = stream.getReader();

  const textDecoder = new TextDecoder();

  function read() {
    forwardReader.read().then(({ done, value }) => {
      if (done) {
        onMessage("end");
      } else {
        onMessage(textDecoder.decode(value));
        read();
      }
    });
  }
  read();
}

// @ts-ignore
global.AsyncLocalStorage = AsyncLocalStorage;

class AppWorker {
  port;
  constructor(port) {
    this.port = port;
  }

  async handleMessage(message) {
    const { type, ...rest } = JSON.parse(message);
    switch (type) {
      case "fetch": {
        const { url } = rest;
        try {
          await app.serve({ port: 3001, dev: true });
          console.log(app.handle("react-rsc", "/"));

          const writableStream = new Writable({
            write(chunk, encoding, callback) {
              parentPort?.postMessage(
                JSON.stringify({
                  chunk: new TextDecoder().decode(chunk),
                  id: rest.id,
                })
              );
              callback();
            },
          });

          writableStream.on("finish", () => {
            parentPort?.postMessage(
              JSON.stringify({
                chunk: "end",
                id: rest.id,
              })
            );
          });
          // tranformStream.on("end", () => {
          //   console.log("ending");
          //   parentPort?.postMessage(
          //     JSON.stringify({
          //       chunk: "end",
          //       id: rest.id,
          //     })
          //   );
          // });

          pipe(writableStream);

          // streamToMessageChannel(stream, (msg) => {
          //   parentPort?.postMessage(
          //     JSON.stringify({ chunk: msg, id: rest.id })
          //   );
          // });
        } catch (e) {
          console.error(e);
        }
      }
    }
  }

  listen() {
    this.port.addListener("message", this.handleMessage.bind(this));
    this.port.postMessage("ready");
  }
}

invariant(parentPort, "parentPort is not defined");

const appWorker = new AppWorker(parentPort);
appWorker.listen();
