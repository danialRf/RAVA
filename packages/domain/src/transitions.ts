/**
 * Domain transition guards.
 *
 * Every state change in RAVA goes through one of these guards. They are pure
 * functions with no database or IO so they can be exhaustively unit tested and
 * reused identically by the web app, the worker, and the admin.
 */

import {
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  PURCHASE_TASK_STATUSES,
  QUOTE_STATUSES,
  TRIP_STATUSES,
  type OrderItemProcurementStatus,
  type OrderStatus,
  type PaymentStatus,
  type PurchaseTaskStatus,
  type QuoteStatus,
  type TripStatus,
} from "./enums";
import type { Toman } from "./money";

export class TransitionError extends Error {
  readonly from: string;
  readonly to: string;
  readonly reason: string;

  constructor(machine: string, from: string, to: string, reason: string) {
    super(`${machine}: ${from} → ${to} is not allowed (${reason})`);
    this.name = "TransitionError";
    this.from = from;
    this.to = to;
    this.reason = reason;
  }
}

export type TransitionMap<TState extends string> = Readonly<
  Record<TState, readonly TState[]>
>;

export interface StateMachine<TState extends string> {
  readonly name: string;
  /** States reachable from `from`, in declaration order. */
  nextStates(from: TState): readonly TState[];
  canTransition(from: TState, to: TState): boolean;
  /** Throws {@link TransitionError} instead of returning false. */
  assertTransition(from: TState, to: TState): void;
  isTerminal(state: TState): boolean;
}

export function createStateMachine<TState extends string>(
  name: string,
  transitions: TransitionMap<TState>,
): StateMachine<TState> {
  return {
    name,
    nextStates(from) {
      return transitions[from] ?? [];
    },
    canTransition(from, to) {
      return (transitions[from] ?? []).includes(to);
    },
    assertTransition(from, to) {
      if (from === to) {
        throw new TransitionError(name, from, to, "state is unchanged");
      }
      if (!(transitions[from] ?? []).includes(to)) {
        throw new TransitionError(name, from, to, "transition is not defined");
      }
    },
    isTerminal(state) {
      return (transitions[state] ?? []).length === 0;
    },
  };
}

/**
 * Order lifecycle.
 *
 * Cancellation before money is captured ends at CANCELLED. Once any payment
 * has been captured, the only exit is REFUND_PENDING → REFUNDED, so a captured
 * amount can never be dropped by a status change alone.
 */
const ORDER_TRANSITIONS: TransitionMap<OrderStatus> = {
  DRAFT: ["QUOTE_PENDING", "CANCELLED"],
  QUOTE_PENDING: ["QUOTED", "CANCELLED"],
  QUOTED: ["DEPOSIT_PENDING", "QUOTE_PENDING", "CANCELLED"],
  DEPOSIT_PENDING: ["DEPOSIT_PAID", "QUOTE_PENDING", "CANCELLED"],
  DEPOSIT_PAID: ["PROCUREMENT_PENDING", "REFUND_PENDING"],
  PROCUREMENT_PENDING: [
    "PROCUREMENT_IN_PROGRESS",
    "CUSTOMER_RECONFIRMATION_REQUIRED",
    "REFUND_PENDING",
  ],
  PROCUREMENT_IN_PROGRESS: [
    "PURCHASED_GERMANY",
    "CUSTOMER_RECONFIRMATION_REQUIRED",
    "REFUND_PENDING",
  ],
  CUSTOMER_RECONFIRMATION_REQUIRED: [
    "PROCUREMENT_PENDING",
    "PROCUREMENT_IN_PROGRESS",
    "REFUND_PENDING",
  ],
  PURCHASED_GERMANY: ["RECEIVED_GERMANY", "REFUND_PENDING"],
  RECEIVED_GERMANY: ["TRIP_PENDING", "REFUND_PENDING"],
  TRIP_PENDING: ["TRIP_ASSIGNED", "REFUND_PENDING"],
  TRIP_ASSIGNED: ["IN_TRANSIT_TO_IRAN", "TRIP_PENDING", "REFUND_PENDING"],
  IN_TRANSIT_TO_IRAN: ["ARRIVED_IRAN", "REFUND_PENDING"],
  ARRIVED_IRAN: ["BALANCE_DUE", "REFUND_PENDING"],
  BALANCE_DUE: ["BALANCE_PAID", "REFUND_PENDING"],
  BALANCE_PAID: ["LOCAL_DELIVERY_PENDING", "REFUND_PENDING"],
  LOCAL_DELIVERY_PENDING: ["OUT_FOR_DELIVERY", "REFUND_PENDING"],
  // A failed delivery attempt returns to the queue rather than ending the order.
  OUT_FOR_DELIVERY: ["DELIVERED", "LOCAL_DELIVERY_PENDING", "REFUND_PENDING"],
  DELIVERED: ["REFUND_PENDING"],
  CANCELLED: [],
  REFUND_PENDING: ["REFUNDED"],
  REFUNDED: [],
};

export const orderStateMachine = createStateMachine("order", ORDER_TRANSITIONS);

/** Money facts the order guard needs; all integer Toman. */
export interface OrderMoneyContext {
  readonly totalLockedToman: Toman;
  readonly depositRequiredToman: Toman;
  readonly depositPaidToman: Toman;
  readonly balanceDueToman: Toman;
  readonly balancePaidToman: Toman;
}

export interface TransitionDecision {
  readonly allowed: boolean;
  readonly reason?: string;
}

/**
 * Order transition guard including money invariants.
 *
 * Structural legality is not enough for an order: DEPOSIT_PAID must be backed
 * by captured money, and the balance milestones must be backed by the balance.
 */
export function evaluateOrderTransition(
  from: OrderStatus,
  to: OrderStatus,
  money: OrderMoneyContext,
): TransitionDecision {
  if (from === to) {
    return { allowed: false, reason: "state is unchanged" };
  }
  if (!orderStateMachine.canTransition(from, to)) {
    return { allowed: false, reason: "transition is not defined" };
  }

  if (
    to === "DEPOSIT_PAID" &&
    money.depositPaidToman < money.depositRequiredToman
  ) {
    return {
      allowed: false,
      reason: "captured deposit is below the required deposit",
    };
  }

  if (to === "BALANCE_PAID" && money.balancePaidToman < money.balanceDueToman) {
    return {
      allowed: false,
      reason: "captured balance is below the outstanding balance",
    };
  }

  if (
    to === "DELIVERED" &&
    money.depositPaidToman + money.balancePaidToman < money.totalLockedToman
  ) {
    return { allowed: false, reason: "order is not fully paid" };
  }

  if (
    to === "CANCELLED" &&
    money.depositPaidToman + money.balancePaidToman > 0n
  ) {
    return {
      allowed: false,
      reason: "captured payments require the refund path",
    };
  }

  return { allowed: true };
}

export function assertOrderTransition(
  from: OrderStatus,
  to: OrderStatus,
  money: OrderMoneyContext,
): void {
  const decision = evaluateOrderTransition(from, to, money);
  if (!decision.allowed) {
    throw new TransitionError("order", from, to, decision.reason ?? "rejected");
  }
}

/** Payments are append-only in spirit: a successful capture can only be reversed. */
const PAYMENT_TRANSITIONS: TransitionMap<PaymentStatus> = {
  INITIATED: ["PENDING_VERIFICATION", "SUCCEEDED", "FAILED", "CANCELLED"],
  PENDING_VERIFICATION: ["SUCCEEDED", "FAILED", "CANCELLED"],
  SUCCEEDED: ["REVERSED"],
  FAILED: [],
  CANCELLED: [],
  REVERSED: [],
};

export const paymentStateMachine = createStateMachine(
  "payment",
  PAYMENT_TRANSITIONS,
);

const ORDER_ITEM_PROCUREMENT_TRANSITIONS: TransitionMap<OrderItemProcurementStatus> =
  {
    PENDING: ["ASSIGNED", "UNAVAILABLE", "CANCELLED"],
    ASSIGNED: ["PURCHASED", "UNAVAILABLE", "PENDING", "CANCELLED"],
    PURCHASED: ["RECEIVED_GERMANY"],
    RECEIVED_GERMANY: ["PACKED"],
    PACKED: [],
    // An unavailable item can be re-sourced from another offer.
    UNAVAILABLE: ["PENDING", "CANCELLED"],
    CANCELLED: [],
  };

export const orderItemProcurementStateMachine = createStateMachine(
  "order-item-procurement",
  ORDER_ITEM_PROCUREMENT_TRANSITIONS,
);

const PURCHASE_TASK_TRANSITIONS: TransitionMap<PurchaseTaskStatus> = {
  OPEN: ["ASSIGNED", "CANCELLED"],
  ASSIGNED: ["IN_PROGRESS", "BLOCKED", "OPEN", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "BLOCKED", "CANCELLED"],
  BLOCKED: ["OPEN", "IN_PROGRESS", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export const purchaseTaskStateMachine = createStateMachine(
  "purchase-task",
  PURCHASE_TASK_TRANSITIONS,
);

const TRIP_TRANSITIONS: TransitionMap<TripStatus> = {
  PLANNED: ["COLLECTING", "CANCELLED"],
  COLLECTING: ["PACKED", "CANCELLED"],
  PACKED: ["DEPARTED", "COLLECTING"],
  DEPARTED: ["ARRIVED"],
  ARRIVED: ["DISTRIBUTED"],
  DISTRIBUTED: [],
  CANCELLED: [],
};

export const tripStateMachine = createStateMachine("trip", TRIP_TRANSITIONS);

const QUOTE_TRANSITIONS: TransitionMap<QuoteStatus> = {
  ACTIVE: ["EXPIRED", "CONSUMED", "CANCELLED"],
  EXPIRED: [],
  CONSUMED: [],
  CANCELLED: [],
};

export const quoteStateMachine = createStateMachine("quote", QUOTE_TRANSITIONS);

/**
 * Customer-facing milestone index (1-8) from docs/OPERATIONAL_STATUS_MODEL.md.
 * Raw enum names are never shown to customers; the UI renders the Persian label
 * for the returned index. `null` means the order has no public milestone yet.
 */
export function orderMilestone(status: OrderStatus): number | null {
  switch (status) {
    case "DRAFT":
    case "QUOTE_PENDING":
    case "QUOTED":
    case "DEPOSIT_PENDING":
      return null;
    case "DEPOSIT_PAID":
    case "PROCUREMENT_PENDING":
    case "PROCUREMENT_IN_PROGRESS":
    case "CUSTOMER_RECONFIRMATION_REQUIRED":
      return 1;
    case "PURCHASED_GERMANY":
      return 2;
    case "RECEIVED_GERMANY":
      return 3;
    case "TRIP_PENDING":
    case "TRIP_ASSIGNED":
      return 4;
    case "IN_TRANSIT_TO_IRAN":
      return 5;
    case "ARRIVED_IRAN":
      return 6;
    case "BALANCE_DUE":
    case "BALANCE_PAID":
      return 7;
    case "LOCAL_DELIVERY_PENDING":
    case "OUT_FOR_DELIVERY":
    case "DELIVERED":
      return 8;
    case "CANCELLED":
    case "REFUND_PENDING":
    case "REFUNDED":
      return null;
  }
}

/** Every state machine exposed by this module, used by coverage tests. */
export const ALL_STATE_MACHINES = [
  { machine: orderStateMachine, states: ORDER_STATUSES },
  { machine: paymentStateMachine, states: PAYMENT_STATUSES },
  { machine: purchaseTaskStateMachine, states: PURCHASE_TASK_STATUSES },
  { machine: tripStateMachine, states: TRIP_STATUSES },
  { machine: quoteStateMachine, states: QUOTE_STATUSES },
] as const;
