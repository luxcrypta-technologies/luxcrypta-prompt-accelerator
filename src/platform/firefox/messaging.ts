import type { MessageResponse } from "@/types/messages";
import type { PlatformMessaging } from "@/types/platform";

export const firefoxMessaging: PlatformMessaging = {
  async sendMessage<TReq, TRes>(message: TReq): Promise<TRes> {
    const response = (await browser.runtime.sendMessage(message)) as MessageResponse<TRes>;
    if (response && response.ok === false) {
      throw new Error(response.error);
    }
    return response && response.ok ? response.data : (response as TRes);
  },

  onMessage(handler: (message: unknown) => Promise<unknown> | unknown): void {
    browser.runtime.onMessage.addListener((message) =>
      Promise.resolve(handler(message))
        .then((data) => ({ ok: true, data }))
        .catch((error: unknown) => ({
          ok: false,
          error: error instanceof Error ? error.message : "Unknown extension error"
        }))
    );
  }
};
