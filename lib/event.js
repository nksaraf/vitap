/**
 *
 * @param {Request} request
 * @param {{
 *    ip: string,
 *    platform: any,
 *    waitUntil: (promise: Promise<any>) => void,
 *    passThrough: () => void,
 * }} param1
 */
export class FetchEvent {
  type = "fetch";
  request;
  ip;
  platform;
  waitUntil;
  passThrough;
  url;
  method;
  locals;

  /**
   *
   * @param {Request} request
   * @param {{
   *    ip?: string,
   *    platform?: any,
   *    waitUntil?: (promise: Promise<any>) => void,
   *    passThrough?: () => void,
   * } | undefined} param1
   */
  constructor(
    request,
    {
      ip = undefined,
      platform = undefined,
      waitUntil = () => {},
      passThrough = () => {},
    } = {}
  ) {
    this.request = request;
    this.url = new URL(request.url, "https://example.com");
    this.method = request.method;
    this.locals = {};
    this.ip = ip;
    this.platform = platform;
    this.waitUntil = waitUntil;
    this.passThrough = passThrough;
  }
}
