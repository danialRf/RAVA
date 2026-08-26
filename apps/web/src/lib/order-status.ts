import type { OrderItemProcurementStatus, OrderStatus } from "@rava/domain";

const ORDER_STATUS_FA: Record<OrderStatus, string> = {
  DRAFT: "پیش‌نویس",
  QUOTE_PENDING: "در انتظار قیمت قطعی",
  QUOTED: "قیمت قطعی صادر شده",
  DEPOSIT_PENDING: "در انتظار پیش‌پرداخت",
  DEPOSIT_PAID: "پیش‌پرداخت تأیید شده",
  PROCUREMENT_PENDING: "پیش‌پرداخت تأیید شد؛ در صف تهیه",
  PROCUREMENT_IN_PROGRESS: "خرید از آلمان در حال انجام است",
  CUSTOMER_RECONFIRMATION_REQUIRED: "نیازمند تأیید دوباره شما",
  PURCHASED_GERMANY: "همه اقلام در آلمان خریداری شدند",
  RECEIVED_GERMANY: "در مرکز آلمان دریافت شد",
  TRIP_PENDING: "در انتظار تخصیص سفر",
  TRIP_ASSIGNED: "به سفر اختصاص یافت",
  IN_TRANSIT_TO_IRAN: "در مسیر ایران",
  ARRIVED_IRAN: "به ایران رسید",
  BALANCE_DUE: "در انتظار تسویه",
  BALANCE_PAID: "تسویه شد",
  LOCAL_DELIVERY_PENDING: "در صف ارسال داخلی",
  OUT_FOR_DELIVERY: "در حال تحویل",
  DELIVERED: "تحویل شد",
  CANCELLED: "لغو شد",
  REFUND_PENDING: "در انتظار بازپرداخت",
  REFUNDED: "بازپرداخت شد",
};

const PROCUREMENT_STATUS_FA: Record<OrderItemProcurementStatus, string> = {
  PENDING: "در صف تهیه",
  ASSIGNED: "در حال خرید",
  PURCHASED: "در آلمان خریداری شد",
  RECEIVED_GERMANY: "در مرکز آلمان دریافت شد",
  PACKED: "بسته‌بندی شد",
  UNAVAILABLE: "در منبع انتخابی ناموجود شد",
  CANCELLED: "لغو شد",
};

export function orderStatusFa(status: OrderStatus): string {
  return ORDER_STATUS_FA[status];
}

export function procurementStatusFa(
  status: OrderItemProcurementStatus,
): string {
  return PROCUREMENT_STATUS_FA[status];
}
