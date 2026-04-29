import { getPlatformAPI } from "@platform-runtime";
import { createMessageRouter } from "./message-router";

const platform = getPlatformAPI();
const routeMessage = createMessageRouter(platform);

platform.messaging.onMessage((message) => routeMessage(message as never));
