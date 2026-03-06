import { Middleware, TurnContext } from "botbuilder";
import { Client } from "@microsoft/microsoft-graph-client";
import type { UserProfile } from "../bot.js";

const USER_PROFILE_KEY = "userProfile";

/**
 * Fetches the calling user's Microsoft Graph profile on every turn and
 * attaches it to turnContext.turnState as `userProfile`.
 *
 * The profile includes displayName, department, and officeLocation.
 * department is used to pre-fill the hospitalId field on blood requests.
 */
export const graphEnrichmentMiddleware: Middleware = {
  async onTurn(context: TurnContext, next: () => Promise<void>): Promise<void> {
    const token = getTokenFromActivity(context);

    if (token) {
      try {
        const graphClient = Client.init({
          authProvider: (done) => {
            done(null, token);
          },
        });

        const user = await graphClient
          .api("/me")
          .select("displayName,department,officeLocation")
          .get() as GraphUser;

        const userProfile: UserProfile = {
          displayName: user.displayName ?? "",
          department: user.department ?? "",
          officeLocation: user.officeLocation ?? "",
        };

        context.turnState.set(USER_PROFILE_KEY, userProfile);
      } catch (err) {
        // Non-fatal: Graph enrichment failure should not block the turn.
        console.warn("[graphEnrichment] Failed to fetch user profile:", err);
      }
    }

    await next();
  },
};

function getTokenFromActivity(context: TurnContext): string | undefined {
  // Single Sign-On token is passed via the activity's channelData or value.
  const channelData = context.activity.channelData as Record<string, unknown> | undefined;
  if (channelData?.["ssoToken"] && typeof channelData["ssoToken"] === "string") {
    return channelData["ssoToken"];
  }

  const value = context.activity.value as Record<string, unknown> | undefined;
  if (value?.["token"] && typeof value["token"] === "string") {
    return value["token"];
  }

  return undefined;
}

interface GraphUser {
  displayName?: string;
  department?: string;
  officeLocation?: string;
}
