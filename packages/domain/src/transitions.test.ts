import { describe, expect, it } from "vitest";

import { ORDER_STATUSES, type OrderStatus } from "./enums";
import {
  ALL_STATE_MACHINES,
  assertOrderTransition,
  evaluateOrderTransition,
  orderItemProcurementStateMachine,
  orderMilestone,
  orderStateMachine,
  paymentStateMachine,
  purchaseTaskStateMachine,
  quoteStateMachine,
  TransitionError,
  tripStateMachine,
  type OrderMoneyContext,
} from "./transitions";

const unpaid: OrderMoneyContext = {
  totalLockedToman: 10_000_000n,
  depositRequiredToman: 3_500_000n,
  depositPaidToman: 0n,
  balanceDueToman: 6_500_000n,
  balancePaidToman: 0n,
};

const depositPaid: OrderMoneyContext = {
  ...unpaid,
  depositPaidToman: 3_500_000n,
};

const fullyPaid: OrderMoneyContext = {
  ...depositPaid,
  balancePaidToman: 6_500_000n,
};

describe("state machine integrity", () => {
  // The registry is heterogeneous, so each machine is checked through a
  // uniformly typed view rather than through the union of all machines.
  const machines: readonly {
    readonly name: string;
    readonly states: readonly string[];
    readonly nextStates: (state: string) => readonly string[];
    readonly isTerminal: (state: string) => boolean;
  }[] = ALL_STATE_MACHINES.map((entry) => ({
    name: entry.machine.name,
    states: entry.states,
    nextStates: (state: string) =>
      entry.machine.nextStates(state as never) as readonly string[],
    isTerminal: (state: string) => entry.machine.isTerminal(state as never),
  }));

  it("declares only known targets and never a self transition", () => {
    for (const machine of machines) {
      for (const state of machine.states) {
        for (const target of machine.nextStates(state)) {
          expect(machine.states, machine.name).toContain(target);
          expect(target, machine.name).not.toBe(state);
        }
      }
    }
  });

  it("gives every machine at least one terminal state", () => {
    for (const machine of machines) {
      const terminals = machine.states.filter((state) =>
        machine.isTerminal(state),
      );
      expect(terminals.length, machine.name).toBeGreaterThan(0);
    }
  });

  it("refuses a self transition", () => {
    expect(() => orderStateMachine.assertTransition("DRAFT", "DRAFT")).toThrow(
      TransitionError,
    );
  });
});

describe("order transitions", () => {
  it("walks the full happy path", () => {
    const happyPath: readonly OrderStatus[] = [
      "DRAFT",
      "QUOTE_PENDING",
      "QUOTED",
      "DEPOSIT_PENDING",
      "DEPOSIT_PAID",
      "PROCUREMENT_PENDING",
      "PROCUREMENT_IN_PROGRESS",
      "PURCHASED_GERMANY",
      "RECEIVED_GERMANY",
      "TRIP_PENDING",
      "TRIP_ASSIGNED",
      "IN_TRANSIT_TO_IRAN",
      "ARRIVED_IRAN",
      "BALANCE_DUE",
      "BALANCE_PAID",
      "LOCAL_DELIVERY_PENDING",
      "OUT_FOR_DELIVERY",
      "DELIVERED",
    ];

    for (let index = 0; index < happyPath.length - 1; index += 1) {
      const from = happyPath[index] as OrderStatus;
      const to = happyPath[index + 1] as OrderStatus;
      expect(orderStateMachine.canTransition(from, to)).toBe(true);
      expect(evaluateOrderTransition(from, to, fullyPaid).allowed).toBe(true);
    }
  });

  it("rejects skipping procurement", () => {
    expect(
      orderStateMachine.canTransition("DEPOSIT_PAID", "PURCHASED_GERMANY"),
    ).toBe(false);
    expect(() =>
      assertOrderTransition("DEPOSIT_PAID", "PURCHASED_GERMANY", depositPaid),
    ).toThrow(TransitionError);
  });

  it("rejects moving backwards through the shipping chain", () => {
    expect(
      orderStateMachine.canTransition("ARRIVED_IRAN", "IN_TRANSIT_TO_IRAN"),
    ).toBe(false);
  });

  it("requires captured money before DEPOSIT_PAID", () => {
    const decision = evaluateOrderTransition(
      "DEPOSIT_PENDING",
      "DEPOSIT_PAID",
      unpaid,
    );
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toMatch(/deposit/);

    expect(
      evaluateOrderTransition("DEPOSIT_PENDING", "DEPOSIT_PAID", depositPaid)
        .allowed,
    ).toBe(true);
  });

  it("requires the balance before BALANCE_PAID", () => {
    expect(
      evaluateOrderTransition("BALANCE_DUE", "BALANCE_PAID", depositPaid)
        .allowed,
    ).toBe(false);
    expect(
      evaluateOrderTransition("BALANCE_DUE", "BALANCE_PAID", fullyPaid).allowed,
    ).toBe(true);
  });

  it("never marks an underpaid order as delivered", () => {
    expect(
      evaluateOrderTransition("OUT_FOR_DELIVERY", "DELIVERED", depositPaid)
        .allowed,
    ).toBe(false);
  });

  it("forces captured payments through the refund path", () => {
    expect(evaluateOrderTransition("QUOTED", "CANCELLED", unpaid).allowed).toBe(
      true,
    );
    // DEPOSIT_PAID has no direct CANCELLED edge at all.
    expect(orderStateMachine.canTransition("DEPOSIT_PAID", "CANCELLED")).toBe(
      false,
    );
    expect(
      orderStateMachine.canTransition("DEPOSIT_PAID", "REFUND_PENDING"),
    ).toBe(true);
    expect(
      evaluateOrderTransition("REFUND_PENDING", "REFUNDED", depositPaid)
        .allowed,
    ).toBe(true);
  });

  it("blocks cancellation once money is captured on a still-cancellable state", () => {
    const decision = evaluateOrderTransition("DEPOSIT_PENDING", "CANCELLED", {
      ...unpaid,
      depositPaidToman: 1n,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toMatch(/refund/);
  });

  it("allows a failed delivery attempt to return to the queue", () => {
    expect(
      orderStateMachine.canTransition(
        "OUT_FOR_DELIVERY",
        "LOCAL_DELIVERY_PENDING",
      ),
    ).toBe(true);
  });

  it("keeps delivered orders refundable and terminalizes cancellations/refunds", () => {
    expect(orderStateMachine.canTransition("DELIVERED", "REFUND_PENDING")).toBe(
      true,
    );
    for (const status of ["CANCELLED", "REFUNDED"] as const) {
      expect(orderStateMachine.isTerminal(status)).toBe(true);
    }
  });
});

describe("order milestones", () => {
  it("maps every status without throwing", () => {
    for (const status of ORDER_STATUSES) {
      const milestone = orderMilestone(status);
      if (milestone !== null) {
        expect(milestone).toBeGreaterThanOrEqual(1);
        expect(milestone).toBeLessThanOrEqual(8);
      }
    }
  });

  it("hides pre-payment and cancelled states from the public timeline", () => {
    expect(orderMilestone("QUOTED")).toBeNull();
    expect(orderMilestone("REFUNDED")).toBeNull();
    expect(orderMilestone("DEPOSIT_PAID")).toBe(1);
    expect(orderMilestone("DELIVERED")).toBe(8);
  });

  it("never moves a milestone backwards along the happy path", () => {
    const path: readonly OrderStatus[] = [
      "DEPOSIT_PAID",
      "PURCHASED_GERMANY",
      "RECEIVED_GERMANY",
      "TRIP_PENDING",
      "IN_TRANSIT_TO_IRAN",
      "ARRIVED_IRAN",
      "BALANCE_DUE",
      "DELIVERED",
    ];
    const milestones = path.map((status) => orderMilestone(status) ?? 0);
    const sorted = [...milestones].sort((a, b) => a - b);
    expect(milestones).toEqual(sorted);
  });
});

describe("payment transitions", () => {
  it("allows verification and capture", () => {
    expect(
      paymentStateMachine.canTransition("INITIATED", "PENDING_VERIFICATION"),
    ).toBe(true);
    expect(
      paymentStateMachine.canTransition("PENDING_VERIFICATION", "SUCCEEDED"),
    ).toBe(true);
  });

  it("only allows a reversal after success", () => {
    expect(paymentStateMachine.nextStates("SUCCEEDED")).toEqual(["REVERSED"]);
    expect(paymentStateMachine.canTransition("FAILED", "SUCCEEDED")).toBe(
      false,
    );
    expect(paymentStateMachine.isTerminal("REVERSED")).toBe(true);
  });
});

describe("procurement and logistics transitions", () => {
  it("re-sources an unavailable item instead of dead-ending it", () => {
    expect(
      orderItemProcurementStateMachine.canTransition("UNAVAILABLE", "PENDING"),
    ).toBe(true);
  });

  it("requires a purchase before receipt in Germany", () => {
    expect(
      orderItemProcurementStateMachine.canTransition(
        "ASSIGNED",
        "RECEIVED_GERMANY",
      ),
    ).toBe(false);
    expect(
      orderItemProcurementStateMachine.canTransition(
        "PURCHASED",
        "RECEIVED_GERMANY",
      ),
    ).toBe(true);
  });

  it("cannot cancel a purchased item by status alone", () => {
    expect(
      orderItemProcurementStateMachine.canTransition("PURCHASED", "CANCELLED"),
    ).toBe(false);
  });

  it("moves a trip only forwards once departed", () => {
    expect(tripStateMachine.canTransition("DEPARTED", "ARRIVED")).toBe(true);
    expect(tripStateMachine.canTransition("DEPARTED", "PACKED")).toBe(false);
    expect(tripStateMachine.canTransition("ARRIVED", "CANCELLED")).toBe(false);
  });

  it("lets a blocked purchase task resume", () => {
    expect(purchaseTaskStateMachine.canTransition("BLOCKED", "OPEN")).toBe(
      true,
    );
    expect(
      purchaseTaskStateMachine.canTransition("BLOCKED", "IN_PROGRESS"),
    ).toBe(true);
    expect(purchaseTaskStateMachine.isTerminal("COMPLETED")).toBe(true);
  });

  it("expires or consumes a quote exactly once", () => {
    expect(quoteStateMachine.nextStates("ACTIVE")).toEqual([
      "EXPIRED",
      "CONSUMED",
      "CANCELLED",
    ]);
    expect(quoteStateMachine.isTerminal("CONSUMED")).toBe(true);
    expect(quoteStateMachine.canTransition("EXPIRED", "ACTIVE")).toBe(false);
  });
});
