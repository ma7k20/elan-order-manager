# ELAN AI and WhatsApp setup

Set the variables listed in `.env.example`. The Gemini base URL and API key are
provided by the workspace Gemini integration. Create a WhatsApp Cloud API app,
generate a permanent access token with messaging permission, and set its phone
number ID.

Also set `WHATSAPP_BUSINESS_ACCOUNT_ID` and `WHATSAPP_APP_SECRET`. The app secret
is required to verify Meta's `x-hub-signature-256` on every incoming POST.

In Meta, configure the callback URL as:

`https://YOUR_HOST/api/whatsapp/webhook`

Use the same value for the callback verify token and `WHATSAPP_VERIFY_TOKEN`,
then subscribe to `messages`. The webhook acknowledges Meta immediately,
processes only inbound text messages, and never logs message bodies or tokens.

The protected settings/status/test endpoints are under `/api/ai`. Conversation
inbox endpoints are under `/api/gemini`. Account managers are required to read
or change `/api/ai/settings`; all authenticated accounts can use the
conversation console and test chat.