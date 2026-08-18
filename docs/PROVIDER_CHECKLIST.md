# External Provider Checklist

Do not block development on these.

## FX
Requirements:
- direct EUR→Toman preferred,
- timestamped rate,
- API terms allow use,
- acceptable uptime,
- manual fallback.

Potential research candidates include open-market rate services. Do not choose solely because a webpage can be scraped.

## Iranian gateway
Owner must choose/obtain merchant credentials.
Code should use adapter interface.

## Card-to-card
Needs:
- bank account text/config,
- private receipt upload,
- manual reconciliation.

## SMS
Choose Iranian SMS vendor later.
Adapter must support OTP send status and limits.

## Google
Owner creates OAuth web client and callback URLs.

## Telegram
Owner creates bot and adds it as permitted publisher to channel.

## Storage
Local MinIO.
Production S3-compatible provider selected later.

## Email
Console/local dev.
SMTP/provider later.

## Search
Postgres first.
Typesense optional later.

## AI
Disabled launch.
Optional provider later.
