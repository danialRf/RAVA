/* Product media can come from the configured S3-compatible public origin. */
/* eslint-disable @next/next/no-img-element */
import { hasAdminPermission } from "@rava/domain";
import Link from "next/link";

import { AdminEmptyState, AdminPageHeader } from "../../../components/admin";
import {
  AdminFlash,
  AdminStat,
  AdminStatGrid,
} from "../../../components/admin-ui";
import { AdminEntityStatus } from "../../../lib/admin-status";
import { adminQueries, requireAdmin } from "../../../server/admin";
import {
  archiveProductAction,
  createProductAction,
  updateProductAction,
} from "../actions";

const TRANSPORT_CLASSES = ["XS", "S", "M", "L", "BLOCKED"] as const;

export default async function AdminCatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const user = await requireAdmin("CATALOG_READ");
  const [items, options, query] = await Promise.all([
    adminQueries.catalog(),
    adminQueries.productFormOptions(),
    searchParams,
  ]);
  const writable = hasAdminPermission(user.role, "CATALOG_WRITE");
  const activeItems = items.filter((item) => item.status !== "ARCHIVED");
  return (
    <>
      <AdminPageHeader
        eyebrow="مدیریت فروشگاه"
        title="محصولات"
        copy="محصول جدید بسازید، عکس و مشخصاتش را وارد کنید و بعد از بررسی در سایت منتشر کنید."
      />
      <AdminFlash notice={query.notice} error={query.error} />
      <div className="admin-primary-toolbar">
        <div>
          <strong>کالاهای فروشگاه</strong>
          <span>همه کارهای روزمره محصول از همین صفحه انجام می‌شود.</span>
        </div>
        {writable && (
          <a
            className="admin-action-button"
            data-tone="primary"
            href="#new-product"
          >
            + افزودن محصول
          </a>
        )}
      </div>
      <AdminStatGrid>
        <AdminStat
          label="همه محصولات"
          value={activeItems.length.toLocaleString("fa-IR")}
        />
        <AdminStat
          label="منتشرشده"
          value={activeItems
            .filter((item) => item.status === "PUBLISHED")
            .length.toLocaleString("fa-IR")}
          tone="success"
        />
        <AdminStat
          label="پیش‌نویس"
          value={activeItems
            .filter((item) => item.status === "DRAFT")
            .length.toLocaleString("fa-IR")}
        />
        <AdminStat
          label="نیازمند بررسی"
          value={activeItems
            .filter((item) => item.status === "NEEDS_REVIEW")
            .length.toLocaleString("fa-IR")}
          tone="warning"
        />
      </AdminStatGrid>
      {writable && (
        <details
          className="admin-create-panel"
          id="new-product"
          open={activeItems.length === 0}
        >
          <summary>+ ساخت محصول جدید</summary>
          <form
            action={createProductAction}
            className="admin-form-grid"
            encType="multipart/form-data"
          >
            <label>
              نام فارسی
              <input
                name="titleFa"
                required
                minLength={2}
                maxLength={200}
                placeholder="مثلاً کفش آدیداس سامبا"
              />
            </label>
            <label>
              نام اصلی
              <input
                name="titleOriginal"
                dir="ltr"
                required
                minLength={2}
                maxLength={200}
                placeholder="Adidas Samba OG"
              />
            </label>
            <label>
              برند
              <select name="brandId" required>
                <option value="">انتخاب برند</option>
                {options.brands.map((brand) => (
                  <option value={brand.id} key={brand.id}>
                    {brand.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              دسته‌بندی
              <select name="categoryId" required>
                <option value="">انتخاب دسته</option>
                {options.categories.map((category) => (
                  <option value={category.id} key={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              کد داخلی کالا (SKU)
              <input
                name="skuInternal"
                dir="ltr"
                required
                minLength={2}
                placeholder="RAVA-SAMBA-001"
              />
            </label>
            <label>
              وزن به گرم
              <input
                name="weightGrams"
                type="number"
                min="1"
                placeholder="اختیاری"
              />
            </label>
            <label>
              رنگ
              <input name="color" placeholder="اختیاری" />
            </label>
            <label>
              سایز یا حجم
              <input name="size" placeholder="مثلاً 42 یا 100ml" />
            </label>
            <label>
              کلاس حمل
              <select name="transportClass" defaultValue="">
                <option value="">نامعلوم</option>
                {TRANSPORT_CLASSES.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label>
              عکس اصلی
              <input
                name="image"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                required
              />
            </label>
            <label className="wide">
              متن جایگزین عکس
              <input name="imageAlt" placeholder="توضیح کوتاه و واقعی تصویر" />
            </label>
            <label className="wide">
              توضیحات محصول
              <textarea name="descriptionFa" rows={5} />
            </label>
            <p className="admin-form-help wide">
              محصول ابتدا به‌صورت پیش‌نویس ذخیره می‌شود. بعد از بررسی می‌توانید
              آن را منتشر کنید.
            </p>
            <button className="button primary">ساخت محصول</button>
          </form>
        </details>
      )}
      {activeItems.length === 0 ? (
        <AdminEmptyState>
          هنوز محصولی ندارید. از دکمه «افزودن محصول» شروع کنید.
        </AdminEmptyState>
      ) : (
        <section className="admin-product-list">
          {activeItems.map((item) => (
            <details className="admin-product-card" key={item.id}>
              <summary>
                <span className="admin-product-thumb">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt="" />
                  ) : (
                    <span>بدون عکس</span>
                  )}
                </span>
                <span className="admin-product-title">
                  <strong>{item.titleFa}</strong>
                  <small dir="ltr">{item.titleOriginal}</small>
                  <small>
                    {item.brandName} · {item.categoryName}
                  </small>
                </span>
                <AdminEntityStatus status={item.status} />
                <span>{item.variantCount.toLocaleString("fa-IR")} تنوع</span>
              </summary>
              <form
                action={updateProductAction}
                className="admin-form-grid"
                encType="multipart/form-data"
              >
                <input type="hidden" name="id" value={item.id} />
                <label>
                  نام فارسی
                  <input
                    name="titleFa"
                    defaultValue={item.titleFa}
                    required
                    maxLength={200}
                  />
                </label>
                <label>
                  نام اصلی
                  <input
                    name="titleOriginal"
                    dir="ltr"
                    defaultValue={item.titleOriginal}
                    required
                  />
                </label>
                <label>
                  برند
                  <select name="brandId" defaultValue={item.brandId}>
                    {options.brands.map((brand) => (
                      <option value={brand.id} key={brand.id}>
                        {brand.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  دسته‌بندی
                  <select name="categoryId" defaultValue={item.categoryId}>
                    {options.categories.map((category) => (
                      <option value={category.id} key={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  وزن (گرم)
                  <input
                    name="weightGrams"
                    type="number"
                    min="1"
                    defaultValue={item.weightGrams ?? ""}
                  />
                </label>
                <label>
                  کلاس حمل
                  <select
                    name="transportClass"
                    defaultValue={item.transportClass ?? ""}
                  >
                    <option value="">نامعلوم</option>
                    {TRANSPORT_CLASSES.map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </label>
                <label>
                  وضعیت
                  <select name="status" defaultValue={item.status}>
                    <option value="DRAFT">پیش‌نویس</option>
                    <option value="NEEDS_REVIEW">نیازمند بررسی</option>
                    <option value="PUBLISHED">منتشرشده</option>
                  </select>
                </label>
                <label>
                  تعویض عکس
                  <input
                    name="image"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                  />
                </label>
                <label className="wide">
                  متن جایگزین عکس
                  <input name="imageAlt" defaultValue={item.titleFa} />
                </label>
                <label className="wide">
                  توضیحات فارسی
                  <textarea
                    name="descriptionFa"
                    rows={4}
                    defaultValue={item.descriptionFa ?? ""}
                  />
                </label>
                <div className="admin-action-row wide">
                  <button className="button primary">ذخیره تغییرات</button>
                  <Link
                    className="button secondary"
                    href={`/product/${item.slug}`}
                    target="_blank"
                  >
                    پیش‌نمایش در سایت
                  </Link>
                </div>
              </form>
              <form action={archiveProductAction} className="admin-danger-zone">
                <input type="hidden" name="id" value={item.id} />
                <p>
                  آرشیو، محصول را از فروش خارج می‌کند اما سابقه سفارش‌ها را نگه
                  می‌دارد.
                </p>
                <button className="button danger">آرشیو محصول</button>
              </form>
            </details>
          ))}
        </section>
      )}
    </>
  );
}
