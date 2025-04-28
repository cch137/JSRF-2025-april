declare module "puppeteer" {
  export interface Browser {
    close(): Promise<void>;
    newPage(): Promise<Page>;
  }

  export interface Page {
    goto(url: string): Promise<void>;
    evaluate<T>(fn: () => T): Promise<T>;
    waitForFunction(fn: string): Promise<void>;
  }

  export function launch(options: {
    headless: boolean;
    args: string[];
  }): Promise<Browser>;
}
