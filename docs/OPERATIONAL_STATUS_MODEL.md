# Order & Operational Status Model

Recommended order statuses:

- DRAFT
- QUOTE_PENDING
- QUOTED
- DEPOSIT_PENDING
- DEPOSIT_PAID
- PROCUREMENT_PENDING
- PROCUREMENT_IN_PROGRESS
- CUSTOMER_RECONFIRMATION_REQUIRED
- PURCHASED_GERMANY
- RECEIVED_GERMANY
- TRIP_PENDING
- TRIP_ASSIGNED
- IN_TRANSIT_TO_IRAN
- ARRIVED_IRAN
- BALANCE_DUE
- BALANCE_PAID
- LOCAL_DELIVERY_PENDING
- OUT_FOR_DELIVERY
- DELIVERED
- CANCELLED
- REFUND_PENDING
- REFUNDED

Do not expose raw enum names to customers.

Customer-friendly milestones:
1. سفارش ثبت شد
2. خرید از آلمان
3. دریافت در آلمان
4. آماده ارسال
5. در مسیر ایران
6. رسیدن به ایران
7. تسویه
8. تحویل

All transitions require explicit domain guards.
