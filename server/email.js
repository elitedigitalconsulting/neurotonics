'use strict';

/**
 * server/email.js
 *
 * Email notifications for the Neurotonics CMS.
 *
 * Provider priority:
 *   1. Resend  — set RESEND_API_KEY (free 3,000 emails/month, no SMTP timeout)
 *   2. SMTP    — set EMAIL_HOST + EMAIL_USER + EMAIL_PASS (e.g. Gmail App Password)
 *
 * If neither is configured the functions log a warning and return without error.
 */

const nodemailer = require('nodemailer');
const { getSetting } = require('./db');

// ---------------------------------------------------------------------------
// Provider detection
// ---------------------------------------------------------------------------
function getProvider() {
  if (process.env.RESEND_API_KEY) return 'resend';
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) return 'smtp';
  return null;
}

const EMAIL_FROM = process.env.EMAIL_FROM || process.env.EMAIL_USER || 'noreply@neurotonics.com.au';

// Warn at startup so the issue is visible in Render logs
if (!getProvider()) {
  console.warn(
    '[email] ⚠️  No email provider configured.\n' +
    '  Option A (recommended): Set RESEND_API_KEY in Render env vars.\n' +
    '  Option B: Set EMAIL_USER + EMAIL_PASS (Gmail App Password) in Render env vars.\n' +
    '  Emails will be silently skipped until one of these is configured.'
  );
}

// ---------------------------------------------------------------------------
// Send via Resend HTTP API
// ---------------------------------------------------------------------------
async function sendViaResend({ to, subject, html, text, replyTo }) {
  const { Resend } = require('resend');
  const resend = new Resend(process.env.RESEND_API_KEY);

  const from = process.env.RESEND_FROM_EMAIL ||
    (process.env.EMAIL_FROM ? process.env.EMAIL_FROM : 'Neurotonics <orders@neurotonics.com.au>');

  const payload = { from, to, subject, html, text };
  if (replyTo) payload.replyTo = replyTo;

  const { data, error } = await resend.emails.send(payload);
  if (error) throw new Error(`Resend error: ${error.message || JSON.stringify(error)}`);
  return data;
}

// ---------------------------------------------------------------------------
// Send via SMTP (nodemailer)
// ---------------------------------------------------------------------------
async function sendViaSmtp({ to, subject, html, text, replyTo }) {
  const transporter = nodemailer.createTransport({
    host:   process.env.EMAIL_HOST   || 'smtp.gmail.com',
    port:   parseInt(process.env.EMAIL_PORT || '587', 10),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    connectionTimeout: 10000,
    greetingTimeout:   5000,
    socketTimeout:     10000,
  });
  const mail = { from: `"Neurotonics" <${EMAIL_FROM}>`, to, subject, html, text };
  if (replyTo) mail.replyTo = replyTo;
  await transporter.sendMail(mail);
}

// ---------------------------------------------------------------------------
// Unified send function — selects provider automatically
// ---------------------------------------------------------------------------
async function sendEmail({ to, subject, html, text, replyTo }) {
  const provider = getProvider();
  if (!provider) {
    console.warn(`[email] Skipping email to ${to}: no provider configured (set RESEND_API_KEY or EMAIL_USER+EMAIL_PASS in Render).`);
    return;
  }
  try {
    if (provider === 'resend') {
      await sendViaResend({ to, subject, html, text, replyTo });
    } else {
      await sendViaSmtp({ to, subject, html, text, replyTo });
    }
    console.log(`[email] ✓ Sent "${subject}" to ${to} via ${provider}`);
  } catch (err) {
    console.error(`[email] ✗ Failed to send "${subject}" to ${to} via ${provider}: ${err.message}`);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Simple {{variable}} interpolation
// ---------------------------------------------------------------------------
function interpolate(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : ''
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function fmtAud(amount) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount || 0);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
}

function buildItemsTable(items) {
  if (!Array.isArray(items) || items.length === 0) return '<p>No items</p>';
  const rows = items.map(item =>
    `<tr>
      <td style="padding:6px 8px;">${escapeHtml(item.name || '')}</td>
      <td style="padding:6px 8px;text-align:center;">${item.quantity || 1}</td>
      <td style="padding:6px 8px;text-align:right;">${fmtAud(item.price || 0)}</td>
    </tr>`
  ).join('');
  return `
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:12px;">
      <thead>
        <tr style="background:#e2e8f0;">
          <th style="padding:6px 8px;text-align:left;">Item</th>
          <th style="padding:6px 8px;text-align:center;">Qty</th>
          <th style="padding:6px 8px;text-align:right;">Price</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`.trim();
}

function buildItemsList(items) {
  if (!Array.isArray(items) || items.length === 0) return 'No items';
  return items.map(i => `${i.name || 'Unknown'} x${i.quantity || 1} @ ${fmtAud(i.price || 0)}`).join(', ');
}

function formatAddress(addr) {
  if (!addr || typeof addr !== 'object') return '';
  return [addr.fullName, addr.address1, addr.address2, addr.city, addr.state, addr.postcode, addr.country]
    .filter(Boolean).join(', ');
}

function resolveAdminNotificationEmail() {
  return (
    getSetting('admin_notification_email') ||
    process.env.ORDER_NOTIFICATION_EMAIL ||
    process.env.STOCKIST_EMAIL ||
    'admin@elitedigitalconsulting.com.au'
  );
}

function buildDefaultAdminAlertHtml(vars) {
  return `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a202c;">
  <h2 style="color:#1a2e4a;">New Product Purchase — ${vars.orderNumber}</h2>
  <table style="border-collapse:collapse;width:100%;font-size:14px;">
    <tr><td style="padding:8px 12px;background:#f5f7fa;font-weight:bold;width:160px;">Order</td><td style="padding:8px 12px;">${vars.orderNumber}</td></tr>
    <tr><td style="padding:8px 12px;background:#f5f7fa;font-weight:bold;">Customer</td><td style="padding:8px 12px;">${vars.customerName}</td></tr>
    <tr><td style="padding:8px 12px;background:#f5f7fa;font-weight:bold;">Email</td><td style="padding:8px 12px;">${vars.customerEmail}</td></tr>
    <tr><td style="padding:8px 12px;background:#f5f7fa;font-weight:bold;">Phone</td><td style="padding:8px 12px;">${vars.customerPhone}</td></tr>
    <tr><td style="padding:8px 12px;background:#f5f7fa;font-weight:bold;">Shipping Address</td><td style="padding:8px 12px;">${vars.shippingAddress}</td></tr>
    <tr><td style="padding:8px 12px;background:#f5f7fa;font-weight:bold;">Items</td><td style="padding:8px 12px;">${vars.itemsList}</td></tr>
    <tr><td style="padding:8px 12px;background:#f5f7fa;font-weight:bold;">Total</td><td style="padding:8px 12px;">${vars.total}</td></tr>
    <tr><td style="padding:8px 12px;background:#f5f7fa;font-weight:bold;">Stripe ID</td><td style="padding:8px 12px;">${vars.stripeSessionId}</td></tr>
  </table>
  <p style="font-family:sans-serif;font-size:12px;color:#718096;margin-top:24px;">Triggered by a successful Stripe checkout/payment webhook.</p>
</div>`.trim();
}

// ---------------------------------------------------------------------------
// sendOrderConfirmation — sends to customer
// ---------------------------------------------------------------------------
async function sendOrderConfirmation(order) {
  if (!order.customer_email) return;
  const template = getSetting('order_confirmation_template') || '';
  if (!template) return;

  let items = []; try { items = JSON.parse(order.items); } catch { /* ignore */ }
  let shipping = {}; try { shipping = JSON.parse(order.shipping); } catch { /* ignore */ }

  const html = interpolate(template, {
    customerName:    escapeHtml(order.customer_name || 'Valued Customer'),
    customerEmail:   escapeHtml(order.customer_email),
    orderNumber:     escapeHtml(order.order_number || '#' + order.id),
    itemsTable:      buildItemsTable(items),
    shippingLabel:   escapeHtml(shipping.name || shipping.zone || 'Standard'),
    shippingFee:     fmtAud(shipping.fee || 0),
    total:           fmtAud(order.total || 0),
    stripeSessionId: escapeHtml(order.stripe_session_id || ''),
  });

  await sendEmail({
    to:      order.customer_email,
    subject: `Order Confirmed — ${order.order_number || '#' + order.id}`,
    html,
    text: `Hi ${order.customer_name},\n\nYour order ${order.order_number || '#' + order.id} has been confirmed.\nTotal: ${fmtAud(order.total)}\n\nThank you for choosing Neurotonics!`,
  });
}

// ---------------------------------------------------------------------------
// sendAdminOrderAlert — sends to admin
// ---------------------------------------------------------------------------
async function sendAdminOrderAlert(order) {
  const adminEmail = resolveAdminNotificationEmail();
  const template   = getSetting('admin_alert_template') || '';

  let items = []; try { items = JSON.parse(order.items); } catch { /* ignore */ }
  let addr  = {}; try { addr  = JSON.parse(order.shipping_address); } catch { /* ignore */ }

  const vars = {
    orderNumber:     escapeHtml(order.order_number || '#' + order.id),
    customerName:    escapeHtml(order.customer_name || ''),
    customerEmail:   escapeHtml(order.customer_email || ''),
    customerPhone:   escapeHtml(order.customer_phone || ''),
    shippingAddress: escapeHtml(formatAddress(addr)),
    itemsList:       escapeHtml(buildItemsList(items)),
    total:           fmtAud(order.total || 0),
    stripeSessionId: escapeHtml(order.stripe_session_id || ''),
    orderId:         String(order.id || ''),
  };

  const html = template ? interpolate(template, vars) : buildDefaultAdminAlertHtml(vars);

  await sendEmail({
    to:      adminEmail,
    replyTo: order.customer_email || undefined,
    subject: `New Product Purchase ${order.order_number || '#' + order.id} — ${order.customer_name} — ${fmtAud(order.total)}`,
    html,
    text: `New order received.\nOrder: ${order.order_number || '#' + order.id}\nCustomer: ${order.customer_name} <${order.customer_email}>\nTotal: ${fmtAud(order.total)}`,
  });
}

// ---------------------------------------------------------------------------
// sendFulfillmentEmail — sends tracking info to customer
// ---------------------------------------------------------------------------
async function sendFulfillmentEmail(order) {
  if (!order.customer_email) return;

  let shipping = {}; try { shipping = JSON.parse(order.shipping); } catch { /* ignore */ }
  let addr     = {}; try { addr     = JSON.parse(order.shipping_address); } catch { /* ignore */ }
  let items    = []; try { items    = JSON.parse(order.items); } catch { /* ignore */ }

  const trackingNumber = order.tracking_number || '';
  const carrier        = order.carrier || '';
  const trackingLink   = trackingNumber
    ? (carrier.toLowerCase().includes('auspost')
      ? `https://auspost.com.au/mypost/track/#/search?searchTerm=${encodeURIComponent(trackingNumber)}`
      : `https://www.google.com/search?q=${encodeURIComponent(carrier + ' tracking ' + trackingNumber)}`)
    : '';

  const html = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a202c;">
  <div style="background:#1a2e4a;padding:24px;border-radius:8px 8px 0 0;">
    <h1 style="color:#fff;margin:0;font-size:22px;">Your Order Has Been Shipped! 📦</h1>
  </div>
  <div style="background:#f7fafc;padding:24px;border-radius:0 0 8px 8px;">
    <p>Hi ${escapeHtml(order.customer_name || 'Valued Customer')},</p>
    <p>Great news! Your order <strong>${escapeHtml(order.order_number || '#' + order.id)}</strong> has been dispatched and is on its way.</p>
    ${trackingNumber ? `
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:16px 0;">
      <h3 style="margin:0 0 8px;font-size:14px;">Tracking Information</h3>
      ${carrier ? `<p style="margin:4px 0;"><strong>Carrier:</strong> ${escapeHtml(carrier)}</p>` : ''}
      <p style="margin:4px 0;"><strong>Tracking Number:</strong> ${escapeHtml(trackingNumber)}</p>
      ${trackingLink ? `<p style="margin:8px 0;"><a href="${trackingLink}" style="background:#1a2e4a;color:#fff;padding:8px 16px;border-radius:6px;text-decoration:none;font-size:13px;">Track Your Package →</a></p>` : ''}
    </div>` : ''}
    ${buildItemsTable(items)}
    <p><strong>Shipping to:</strong> ${escapeHtml(formatAddress(addr))}</p>
    <p><strong>Total:</strong> ${fmtAud(order.total || 0)}</p>
    ${order.fulfillment_notes ? `<p><em>${escapeHtml(order.fulfillment_notes)}</em></p>` : ''}
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0;">
    <p style="font-size:12px;color:#718096;">
      Questions? <a href="mailto:support@neurotonics.com.au">support@neurotonics.com.au</a><br>
      Neurotonics — Always read the label and follow the directions for use.
    </p>
  </div>
</div>`.trim();

  await sendEmail({
    to:      order.customer_email,
    subject: `Your Order ${order.order_number || '#' + order.id} Has Been Shipped`,
    html,
    text: `Hi ${order.customer_name},\n\nYour order has been shipped!\n${trackingNumber ? `Tracking: ${carrier ? carrier + ' — ' : ''}${trackingNumber}\n` : ''}Total: ${fmtAud(order.total)}\n\nNeurotonics`,
  });
}

// ---------------------------------------------------------------------------
// sendOrderStatusEmail — cancellation / refund notifications
// ---------------------------------------------------------------------------
async function sendOrderStatusEmail(order, newStatus) {
  if (!order.customer_email) return;
  const msgs = {
    cancelled: { subject: 'Your Order Has Been Cancelled',   body: 'Your order has been cancelled. If payment was taken, a refund will be processed within 3-5 business days.' },
    refunded:  { subject: 'Your Refund Has Been Processed',  body: 'Your refund has been processed and will appear in your account within 3-5 business days.' },
  };
  const msg = msgs[newStatus];
  if (!msg) return;

  const html = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a202c;">
  <div style="background:#1a2e4a;padding:24px;border-radius:8px 8px 0 0;">
    <h1 style="color:#fff;margin:0;font-size:22px;">${msg.subject}</h1>
  </div>
  <div style="background:#f7fafc;padding:24px;border-radius:0 0 8px 8px;">
    <p>Hi ${escapeHtml(order.customer_name || 'Valued Customer')},</p>
    <p>${msg.body}</p>
    <p><strong>Order:</strong> ${escapeHtml(order.order_number || '#' + order.id)}</p>
    <p><strong>Amount:</strong> ${fmtAud(order.total || 0)}</p>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0;">
    <p style="font-size:12px;color:#718096;">Neurotonics — <a href="mailto:support@neurotonics.com.au">support@neurotonics.com.au</a></p>
  </div>
</div>`.trim();

  await sendEmail({ to: order.customer_email, subject: msg.subject, html, text: `${msg.body}\nOrder: ${order.order_number || '#' + order.id}` });
}

// ---------------------------------------------------------------------------
// sendPasswordResetEmail
// ---------------------------------------------------------------------------
async function sendPasswordResetEmail(user, token, baseUrl) {
  const resetUrl = `${baseUrl}/admin/reset-password?token=${encodeURIComponent(token)}`;
  const html = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a202c;">
  <div style="background:#1a2e4a;padding:24px;border-radius:8px 8px 0 0;">
    <h1 style="color:#fff;margin:0;font-size:22px;">Reset Your Password</h1>
  </div>
  <div style="background:#f7fafc;padding:24px;border-radius:0 0 8px 8px;">
    <p>Hi ${escapeHtml(user.name || user.email)},</p>
    <p>Click the button below to reset your password. This link expires in <strong>1 hour</strong>.</p>
    <p style="text-align:center;margin:32px 0;">
      <a href="${resetUrl}" style="background:#2563eb;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">Reset Password</a>
    </p>
    <p style="font-size:13px;color:#718096;">Or copy this link: ${resetUrl}</p>
    <p style="font-size:13px;color:#718096;">If you didn't request this, ignore this email.</p>
  </div>
</div>`.trim();

  await sendEmail({ to: user.email, subject: 'Reset your Neurotonics CMS password', html,
    text: `Reset your password: ${resetUrl}\n\nThis link expires in 1 hour.` });
}

// ---------------------------------------------------------------------------
// emailStatus — returns the current provider config for diagnostics
// ---------------------------------------------------------------------------
function emailStatus() {
  const provider = getProvider();
  if (!provider) return { configured: false, provider: null, message: 'No email provider configured. Set RESEND_API_KEY or EMAIL_USER+EMAIL_PASS in Render.' };
  if (provider === 'resend') return { configured: true, provider: 'resend', from: process.env.RESEND_FROM_EMAIL || 'noreply@neurotonics.com.au' };
  return { configured: true, provider: 'smtp', host: process.env.EMAIL_HOST || 'smtp.gmail.com', user: process.env.EMAIL_USER };
}

module.exports = {
  sendEmail,
  sendOrderConfirmation,
  sendAdminOrderAlert,
  sendFulfillmentEmail,
  sendOrderStatusEmail,
  sendPasswordResetEmail,
  emailStatus,
  interpolate,
  escapeHtml,
};
