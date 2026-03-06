import {
  TeamsActivityHandler,
  TurnContext,
  TaskModuleRequest,
  TaskModuleResponse,
  MessagingExtensionAction,
  MessagingExtensionActionResponse,
  CardFactory,
  ConversationState,
  MemoryStorage,
  DialogSet,
  DialogTurnStatus,
} from "botbuilder";
import { createRequestCard } from "./cards/requestCard.js";
import { createWelcomeCard } from "./cards/welcomeCard.js";
import { graphEnrichmentMiddleware } from "./middleware/graphEnrichment.js";
import { RequestDialog } from "./dialogs/requestDialog.js";

const DIALOG_STATE_PROPERTY = "dialogState";

export class HemoSyncBot extends TeamsActivityHandler {
  private readonly conversationState: ConversationState;
  private readonly dialogs: DialogSet;
  private readonly requestDialog: RequestDialog;

  constructor() {
    super();

    const storage = new MemoryStorage();
    this.conversationState = new ConversationState(storage);

    const dialogStateAccessor =
      this.conversationState.createProperty(DIALOG_STATE_PROPERTY);
    this.dialogs = new DialogSet(dialogStateAccessor);

    this.requestDialog = new RequestDialog();
    this.dialogs.add(this.requestDialog);

    this.use(graphEnrichmentMiddleware);

    // Handle inbound messages — route to the request dialog
    this.onMessage(async (context, next) => {
      await this.handleMessage(context);
      await next();
    });

    // Welcome new members when they join a conversation
    this.onMembersAdded(async (context, next) => {
      for (const member of context.activity.membersAdded ?? []) {
        if (member.id !== context.activity.recipient.id) {
          await context.sendActivity({
            attachments: [CardFactory.adaptiveCard(createWelcomeCard())],
          });
        }
      }
      await next();
    });
  }

  private async handleMessage(context: TurnContext): Promise<void> {
    const dc = await this.dialogs.createContext(context);
    const result = await dc.continueDialog();

    if (result.status === DialogTurnStatus.empty) {
      await dc.beginDialog(RequestDialog.id);
    }

    await this.conversationState.saveChanges(context, false);
  }

  override async onTeamsTaskModuleFetch(
    context: TurnContext,
    taskModuleRequest: TaskModuleRequest
  ): Promise<TaskModuleResponse> {
    const userProfile = context.turnState.get<UserProfile>("userProfile");

    return {
      task: {
        type: "continue",
        value: {
          title: "New Blood Request",
          height: 600,
          width: 600,
          card: CardFactory.adaptiveCard(
            createRequestCard(userProfile?.officeLocation)
          ),
        },
      },
    };
  }

  override async onTeamsTaskModuleSubmit(
    context: TurnContext,
    taskModuleRequest: TaskModuleRequest
  ): Promise<TaskModuleResponse> {
    const data = taskModuleRequest.data as TaskModuleSubmitData;

    if (data?.type === "SUBMIT_REQUEST") {
      const dc = await this.dialogs.createContext(context);
      await dc.beginDialog(RequestDialog.id, { formData: data });
      await this.conversationState.saveChanges(context, false);
    }

    return { task: { type: "message", value: "Request submitted." } };
  }

  override async run(context: TurnContext): Promise<void> {
    await super.run(context);
    await this.conversationState.saveChanges(context, false);
  }
}

export interface UserProfile {
  displayName: string;
  department: string;
  officeLocation: string;
}

interface TaskModuleSubmitData {
  type: string;
  bloodType?: string;
  component?: string;
  units?: number;
  urgency?: string;
  location?: string;
}
