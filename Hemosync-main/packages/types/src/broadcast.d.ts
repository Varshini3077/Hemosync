/**
 * Types governing the blood bank broadcast workflow.
 * A broadcast job fans out SMS/WhatsApp messages to multiple banks and
 * collects normalised replies within a configurable timeout window.
 */
import type { BloodBank, BroadcastResult } from "./blood.js";
/**
 * Represents a broadcast job dispatched to a set of blood banks for a
 * specific blood request. Created when a request enters BROADCASTING state.
 */
export interface BroadcastJob {
    /** ID of the originating BloodRequest. */
    readonly requestId: string;
    /** Ordered list of blood banks to contact (sorted by reliability × proximity). */
    readonly banks: readonly BloodBank[];
    /** Rendered SMS/WhatsApp message body sent to each bank. */
    readonly message: string;
    /** Timestamp when the messages were dispatched. */
    readonly sentAt: Date;
    /** How long (in milliseconds) to wait for replies before timing out. */
    readonly timeoutMs: number;
}
/**
 * A raw inbound reply from a blood bank, as received via SMS/WhatsApp webhook,
 * together with its normalised interpretation.
 */
export interface BankReply {
    /** ID of the originating BloodRequest (extracted from message context). */
    readonly requestId: string;
    /** ID of the blood bank whose number sent this reply. */
    readonly bankId: string;
    /** The unmodified message text received from the bank. */
    readonly rawMessage: string;
    /**
     * Machine-normalised version of the reply extracted by the NLP/regex layer.
     * `units` is only populated when reply === 'YES'.
     */
    readonly normalised: {
        readonly reply: "YES" | "NO" | "CHECK";
        readonly units?: number;
    };
    readonly receivedAt: Date;
}
/**
 * Aggregate status of a broadcast job, computed in real-time as replies
 * arrive and used to decide when the request can be marked CONFIRMED or FAILED.
 */
export interface BroadcastStatus {
    readonly requestId: string;
    /** Total number of banks messaged. */
    readonly totalSent: number;
    /** Number of banks that replied YES and confirmed supply. */
    readonly confirmed: number;
    /** Number of banks that replied NO. */
    readonly declined: number;
    /** Number of banks that have not yet replied (or replied CHECK). */
    readonly pending: number;
    /** Number of banks that did not reply within timeoutMs. */
    readonly timedOut: number;
    /**
     * The first bank that replied YES — used to notify the coordinator
     * immediately once supply is secured.
     */
    readonly firstConfirmation?: BroadcastResult;
}
//# sourceMappingURL=broadcast.d.ts.map