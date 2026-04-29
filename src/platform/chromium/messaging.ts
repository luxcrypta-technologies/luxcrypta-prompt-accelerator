import type { MessageResponse } from "@/types/messages";
import type { PlatformMessaging } from "@/types/platform";

export const chromiumMessaging: PlatformMessaging = {
  sendMessage<TReq, TRes>(message: TReq): Promise<TRes> {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response: MessageResponse<TRes>) => {
        const error = chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }
        if (response && response.ok === false) {
          reject(new Error(response.error));
          return;
        }
        resolve(response && response.ok ? response.data : (response as TRes));
      });
    });
  },

  onMessage(handler: (message: unknown) => Promise<unknown> | unknown): void {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      Promise.resolve(handler(message))
        .then((data) => sendResponse({ ok: true, data }))
        .catch((error: unknown) => {
          const messageText = error instanceof Error ? error.message : "Unknown extension error";
          sendResponse({ ok: false, error: messageText });
        });
      return true;
    });
  }
};
