import { AdminEmptyState, AdminPageHeader } from "../../../components/admin";
import {
  AdminFlash,
  AdminNotice,
  AdminStat,
  AdminStatGrid,
} from "../../../components/admin-ui";
import { AdminEntityStatus } from "../../../lib/admin-status";
import { adminQueries, requireAdmin } from "../../../server/admin";
import {
  assignOrderToTripAction,
  createTripAction,
  updateTripStatusAction,
} from "../actions";

const TRIP_STATUS_FA: Record<TripStatus, string> = {
  PLANNED: "برنامه‌ریزی‌شده",
  COLLECTING: "در حال جمع‌آوری",
  PACKED: "بسته‌بندی‌شده",
  DEPARTED: "حرکت‌کرده از آلمان",
  ARRIVED: "رسیده به ایران",
  DISTRIBUTED: "توزیع‌شده",
  CANCELLED: "لغوشده",
};

export default async function AdminTripsPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const user = await requireAdmin("TRIPS_READ");
  const [trips, awaitingOrders, query] = await Promise.all([
    adminQueries.trips(),
    adminQueries.ordersAwaitingTrip(),
    searchParams,
  ]);
  const writable = ["OWNER", "ADMIN", "BUYER_GERMANY"].includes(user.role);
  return (
    <>
      <AdminPageHeader
        eyebrow="سفرها"
        title="ظرفیت حمل آلمان تا ایران"
        copy="سفر، پنجره زمانی و ظرفیت را ثبت کنید؛ وزن نامعلوم به‌عنوان ظرفیت آزاد فرض نمی‌شود."
      />
      <AdminNotice title="ظرفیت محافظه‌کارانه" tone="warning">
        وزن نامعلوم ظرفیت آزاد تلقی نمی‌شود. تنها سفرهای برنامه‌ریزی‌شده یا در
        حال جمع‌آوری، سفارش جدید می‌پذیرند.
      </AdminNotice>
      <AdminFlash notice={query.notice} error={query.error} />
      <AdminStatGrid>
        <AdminStat
          label="سفرهای فعال"
          value={trips
            .filter(
              (trip) => !["DISTRIBUTED", "CANCELLED"].includes(trip.status),
            )
            .length.toLocaleString("fa-IR")}
          hint="در چرخه حمل"
          tone="info"
        />
        <AdminStat
          label="سفارش منتظر تخصیص"
          value={awaitingOrders.length.toLocaleString("fa-IR")}
          hint="پس از دریافت در آلمان"
          tone={awaitingOrders.length ? "warning" : "success"}
        />
      </AdminStatGrid>
      {writable && (
        <details className="admin-create-panel">
          <summary>ساخت سفر</summary>
          <form action={createTripAction} className="admin-form-grid">
            <label>
              کد لاتین
              <input name="code" dir="ltr" required />
            </label>
            <label>
              عنوان
              <input name="title" required />
            </label>
            <label>
              ظرفیت گرم
              <input name="capacityWeightGrams" type="number" min="1" />
            </label>
            <label>
              شروع حرکت
              <input name="departureWindowStart" type="datetime-local" />
            </label>
            <label>
              پایان حرکت
              <input name="departureWindowEnd" type="datetime-local" />
            </label>
            <label>
              شروع ورود
              <input name="arrivalWindowStart" type="datetime-local" />
            </label>
            <label>
              پایان ورود
              <input name="arrivalWindowEnd" type="datetime-local" />
            </label>
            <label className="wide">
              یادداشت
              <input name="notes" />
            </label>
            <button>ایجاد سفر</button>
          </form>
        </details>
      )}
      {trips.length === 0 ? (
        <AdminEmptyState>سفری برنامه‌ریزی نشده است.</AdminEmptyState>
      ) : (
        <section className="admin-record-list">
          {trips.map((t) => (
            <article className="admin-record static" key={t.id}>
              <div>
                <strong>{t.title}</strong>
                <small dir="ltr">{t.code}</small>
              </div>
              <span>
                {t.itemCount} قلم · {t.assignedWeightGrams} از{" "}
                {t.capacityWeightGrams ?? "نامعلوم"} گرم
              </span>
              <AdminEntityStatus status={t.status}>
                {TRIP_STATUS_FA[t.status]}
              </AdminEntityStatus>
              <form action={updateTripStatusAction}>
                <input type="hidden" name="id" value={t.id} />
                <select name="status" defaultValue="" required>
                  <option value="" disabled>
                    مرحله بعد را انتخاب کنید
                  </option>
                  {tripStateMachine.nextStates(t.status).map((v) => (
                    <option value={v} key={v}>
                      {TRIP_STATUS_FA[v]}
                    </option>
                  ))}
                </select>
                <button
                  disabled={!writable || tripStateMachine.isTerminal(t.status)}
                >
                  ثبت وضعیت
                </button>
              </form>
            </article>
          ))}
        </section>
      )}
      <section className="admin-create-panel">
        <h2>سفارش‌های آماده سفر</h2>
        {awaitingOrders.length === 0 ? (
          <p>سفارشی در انتظار تخصیص سفر نیست.</p>
        ) : trips.filter((trip) =>
            ["PLANNED", "COLLECTING"].includes(trip.status),
          ).length === 0 ? (
          <p>
            برای تخصیص ابتدا یک سفر برنامه‌ریزی‌شده یا در حال جمع‌آوری بسازید.
          </p>
        ) : (
          <div className="admin-record-list">
            {awaitingOrders.map((order) => (
              <form
                action={assignOrderToTripAction}
                className="admin-record static"
                key={order.id}
              >
                <input type="hidden" name="orderId" value={order.id} />
                <strong dir="ltr">{order.orderNumber}</strong>
                <span>
                  {order.customerName ?? "مشتری"} · {order.itemCount} قلم
                </span>
                <select name="tripId" aria-label="انتخاب سفر">
                  {trips
                    .filter((trip) =>
                      ["PLANNED", "COLLECTING"].includes(trip.status),
                    )
                    .map((trip) => (
                      <option value={trip.id} key={trip.id}>
                        {trip.title} ({trip.code})
                      </option>
                    ))}
                </select>
                <button disabled={!writable}>تخصیص سفر</button>
              </form>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
import { tripStateMachine, type TripStatus } from "@rava/domain";
