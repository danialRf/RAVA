# RAVA Admin Operating System

Goal: sophisticated capability with simple workflows.

## 1. Admin navigation

- Overview
- Deal Inbox
- Catalog
- Offers
- Orders
- Procurement
- Trips
- Customers
- Product Requests
- Pricing
- Sources/Retailers
- Scrapers
- Content
- Publications
- Payments
- Documents
- Alerts
- Analytics
- Settings
- Audit Log

## 2. Overview

Show operational information, not vanity charts:

- deposits received,
- outstanding balances,
- orders awaiting procurement,
- procurement aging,
- items waiting for trip assignment,
- next trip capacity,
- payments needing review,
- product requests,
- scraper health,
- offers awaiting approval,
- FX provider status,
- today/7d/30d sales and projected margin.

## 3. Deal Inbox

Central automation queue.

Each candidate:
- image,
- raw title,
- normalized product candidate,
- retailer/seller,
- trust tier,
- current EUR price,
- reference/previous price,
- discount,
- stock,
- estimated RAVA price,
- projected margin,
- deal score,
- match confidence,
- content status.

Actions:
- approve & publish,
- approve draft,
- reject,
- merge with product,
- create product,
- request review,
- blacklist offer/seller,
- snooze.

Bulk actions with safeguards.

## 4. Catalog

Product editor:
- Persian title/description,
- original title,
- brand/category,
- variants,
- identifiers,
- attributes,
- weights,
- images,
- SEO,
- publication,
- pricing override,
- deposit override,
- shipping eligibility.

Preview mobile storefront.

## 5. Orders

Filters by status, age, trip, payment state.

Order detail:
- customer,
- quote snapshot,
- pricing breakdown,
- payment ledger,
- procurement tasks,
- source evidence,
- trip history,
- status history,
- notes,
- customer-visible notes,
- audit events.

High-risk actions require confirmation and reason.

## 6. Procurement

A buyer-friendly Germany workflow.

Queue:
- what to buy,
- where,
- source URL,
- expected source price,
- max allowed price,
- customer/order,
- deadline,
- variant details.

Buyer can:
- mark purchased,
- upload receipt,
- enter actual EUR price,
- mark unavailable,
- suggest alternate source.

Mobile-usable because buyer may use phone in store.

## 7. Trips

Create trip/drop:
- title/code,
- order window,
- departure/arrival range,
- capacity,
- status.

Assign purchased items.
Show estimated weight/capacity.

## 8. Pricing

- current FX rate + provider/freshness,
- manual override,
- global rules,
- category rules,
- brand rules,
- price bands,
- source-tier rules,
- transport classes,
- deposit rules,
- pricing simulator,
- change history.

## 9. Retailers/sources

Manage:
- domain,
- trust tier,
- marketplace status,
- crawl enabled,
- interval,
- adapter,
- seller policy,
- notes,
- health.

## 10. Scrapers

Per source:
- last run,
- next run,
- duration,
- pages/items processed,
- changes,
- failures,
- selector/parser version,
- run now,
- pause,
- logs.

Never expose secrets.

## 11. Content

Homepage section ordering.
Banners.
Editorial entries.
FAQs.
Authenticity page.
Trip announcements.

Draft/preview/publish.

## 12. Publication

For a product:
- website state,
- marketing card preview,
- Telegram caption,
- destination,
- scheduled time,
- publish/republish,
- external message ID.

Launch uses approval.
Later source-tier policies may enable auto-publication.

## 13. Payments

Gateway transactions:
- verified,
- pending,
- failed,
- reconciliation.

Card-to-card:
- receipt image,
- claimed amount,
- customer,
- reviewer,
- approve/reject,
- reason.

No finance action without audit log.

## 14. Customer CRM-lite

- profile/contact,
- orders,
- spend,
- requests,
- support notes,
- alerts,
- fraud/risk notes (private),
- notification consent.

Avoid invasive profiling.

## 15. Analytics

Useful:
- gross merchandise value,
- deposits,
- realized revenue,
- projected/realized margin,
- conversion,
- average order value,
- category/source performance,
- deal-to-order conversion,
- cancellation/refund,
- procurement time,
- delivery time,
- scraper yield.

## 16. UX rules

- list pages remember filters,
- keyboard accessible,
- bulk action bar appears only on selection,
- destructive action clearly separated,
- tables become cards/stacked rows on narrow screens,
- every status has human label + explanation,
- important queues show age/SLA.

The admin is an operating tool, not a visual showcase.
