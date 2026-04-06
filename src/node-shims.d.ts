declare class Buffer {
  static from(value: string | Uint8Array): Buffer;
  static concat(list: readonly Buffer[]): Buffer;
  static isBuffer(value: unknown): value is Buffer;
  toString(encoding?: string): string;
}

declare const process: {
  env: NodeJS.ProcessEnv;
  cwd(): string;
};

declare namespace NodeJS {
  interface ProcessEnv {
    [key: string]: string | undefined;
  }
}

declare module 'node:http' {
  interface IncomingMessage extends AsyncIterable<Buffer | string> {
    method?: string;
    url?: string;
  }

  interface ServerResponse {
    statusCode: number;
    setHeader(name: string, value: string): void;
    end(chunk?: string): void;
  }

  interface AddressInfo {
    port: number;
  }

  interface Server {
    listen(port: number, callback?: () => void): Server;
  }

  export function createServer(
    listener: (request: IncomingMessage, response: ServerResponse) => void | Promise<void>
  ): Server;
}

declare module 'node:path' {
  export function resolve(...paths: string[]): string;
}

declare module 'node:fs/promises' {
  export function readFile(path: string, encoding: string): Promise<string>;
}
