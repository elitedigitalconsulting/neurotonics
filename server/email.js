'use strict';

/**
 * server/email.js
 *
 * Email notifications for the Neurotonics CMS.
 * Extends the existing nodemailer setup in index.js with order confirmation
 * and admin alert emails.
 *
 * Templates are stored in the `settings` table so admins can customise them
 * via the CMS. Variables are interpolated using {{variable}} syntax.
 */

const nodemailer = require('nodemailer');
const { getSetting } = require('./db');

// ---------------------------------------------------------------------------
// Transporter (reuses same config as stockist emails)
// ---------------------------------------------------------------------------
function createTransporter() {
  return nodemailer.createTransport({
    host:   process.env.EMAIL_HOST   || 'smtp.gmail.com',
    port:   parseInt(process.env.EMAIL_PORT || '587', 10),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER || '',
      pass: process.env.EMAIL_PASS || '',
    },
  });
}

const EMAIL_FROM = process.env.EMAIL_FROM || process.env.EMAIL_USER || 'noreply@neurotonics.com.au';

// ---------------------------------------------------------------------------
// Simple {{variable}} interpolation
// ---------------------------------------------------------------------------
function interpolate(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : ''
  );
}

// ---------------------------------------------------------------------------
// Format currency
// ---------------------------------------------------------------------------
function fmtAud(amount) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount);
}

// ---------------------------------------------------------------------------
// Build HTML items table for customer-facing email
// ---------------------------------------------------------------------------
function buildItemsTable(items) {
  if (!Array.isArray(items) || items.length === 0) return '<p>No items</p>';
  const rows = items
    .map(
      (item) =>
        `<tr>
          <td style="padding:6px 8px;">${escapeHtml(item.name || '')}</td>
          <td style="padding:6px 8px;text-align:center;">${item.quantity || 1}</td>
          <td style="padding:6px 8px;text-align:right;">${fmtAud(item.price || 0)}</td>
        </tr>`
    )
    .join('');
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
    </table>
  `.trim();
}

// ---------------------------------------------------------------------------
// Build plain text items list for admin alert
// ---------------------------------------------------------------------------
function buildItemsList(items) {
  if (!Array.isArray(items) || items.length === 0) return 'No items';
  return items.map((i) => `${i.name || 'Unknown'} x${i.quantity || 1} @ ${fmtAud(i.price || 0)}`).join(', ');
}

// ---------------------------------------------------------------------------
// HTML escape
// ---------------------------------------------------------------------------
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

// ---------------------------------------------------------------------------
// Format shipping address as single line
// ---------------------------------------------------------------------------
function formatAddress(addr) {
  if (!addr || typeof addr !== 'object') return '';
  const parts = [
    addr.fullName,
    addr.address1,
    addr.address2,
    addr.city,
    addr.state,
    addr.postcode,
    addr.country,
  ].filter(Boolean);
  return parts.join(', ');
}

// ---------------------------------------------------------------------------
// sendOrderConfirmation
// Sends confirmation email to the customer.
// ---------------------------------------------------------------------------
async function sendOrderConfirmation(order) {
  const notificationEmail = getSetting('notification_email') || EMAIL_FROM;
  const template = getSetting('order_confirmation_template') || '';

  if (!template || !order.customer_email) return;

  let items = [];
  try { items = JSON.parse(order.items); } catch { /* ignore */ }

  let shipping = {};
  try { shipping = JSON.parse(order.shipping); } catch { /* ignore */ }

  const vars = {
    customerName:   escapeHtml(order.customer_name || 'Valued Customer'),
    customerEmail:  escapeHtml(order.customer_email),
    orderNumber:    escapeHtml(order.order_number || '#' + order.id),
    itemsTable:     buildItemsTable(items),
    shippingLabel:  escapeHtml(shipping.name || shipping.zone || 'Standard'),
    shippingFee:    fmtAud(shipping.fee || 0),
    total:          fmtAud(order.total || 0),
    stripeSessionId: escapeHtml(order.stripe_session_id || ''),
  };

  const html = interpolate(template, vars);

  const transporter = createTransporter();
  await transporter.sendMail({
    from:    `"Neurotonics" <${notificationEmail}>`,
    to:      order.customer_email,
    subject: `Order Confirmed — ${order.order_number || '#' + order.id}`,
    html,
    text: `Hi ${order.customer_name},\n\nYour order has been confirmed. Total: ${fmtAud(order.total)}.\n\nThank you for choosing Neurotonics!`,
  });
}

// ---------------------------------------------------------------------------
// sendAdminOrderAlert
// Sends internal notification to the admin team.
// ---------------------------------------------------------------------------
async function sendAdminOrderAlert(order) {
  const adminEmail = getSetting('admin_notification_email') || 'admin@elitedigitalconsulting.com.au';
  const template   = getSetting('admin_alert_template') || '';

  if (!template) return;

  let items = [];
  try { items = JSON.parse(order.items); } catch { /* ignore */ }

  let addr = {};
  try { addr = JSON.parse(order.shipping_address); } catch { /* ignore */ }

  const vars = {
    customerName:    escapeHtml(order.customer_name || ''),
    customerEmail:   escapeHtml(order.customer_email || ''),
    customerPhone:   escapeHtml(order.customer_phone || ''),
    shippingAddress: escapeHtml(formatAddress(addr)),
    itemsList:       escapeHtml(buildItemsList(items)),
    total:           fmtAud(order.total || 0),
    stripeSessionId: escapeHtml(order.stripe_session_id || ''),
    orderId:         String(order.id || ''),
  };

  const html = interpolate(template, vars);

  const transporter = createTransporter();
  await transporter.sendMail({
    from:    `"Neurotonics System" <${EMAIL_FROM}>`,
    to:      adminEmail,
    subject: `New Order ${order.order_number || '#' + order.id} — ${order.customer_name} — ${fmtAud(order.total)}`,
    html,
    text: `New order received.\nCustomer: ${order.customer_name} <${order.customer_email}>\nTotal: ${fmtAud(order.total)}\nStripe: ${order.stripe_session_id}`,
  });
}

// ---------------------------------------------------------------------------
// sendPasswordResetEmail
// Sends a password reset link to the specified user.
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
    <p>You requested a password reset for your Neurotonics CMS account. Click the button below to set a new password. This link expires in <strong>1 hour</strong>.</p>
    <p style="text-align:center;margin:32px 0;">
      <a href="${resetUrl}"
         style="background:#2563eb;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">
        Reset Password
      </a>
    </p>
    <p style="font-size:13px;color:#718096;">If the button doesn't work, copy and paste this link into your browser:</p>
    <p style="font-size:13px;word-break:break-all;color:#2563eb;">${resetUrl}</p>
    <p style="font-size:13px;color:#718096;">If you didn't request a password reset, you can safely ignore this email.</p>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0;">
    <p style="font-size:12px;color:#718096;">Neurotonics CMS · ${escapeHtml(EMAIL_FROM)}</p>
  </div>
</div>
  `.trim();

  const transporter = createTransporter();
  await transporter.sendMail({
    from:    `"Neurotonics CMS" <${EMAIL_FROM}>`,
    to:      user.email,
    subject: 'Reset your Neurotonics CMS password',
    html,
    text: `Hi ${user.name || user.email},\n\nReset your password by visiting:\n${resetUrl}\n\nThis link expires in 1 hour.\n\nIf you didn't request this, you can ignore this email.`,
  });
}

// ---------------------------------------------------------------------------
// sendFulfillmentEmail
// Sent to the customer when their order is marked as fulfilled/shipped.
// ---------------------------------------------------------------------------
async function sendFulfillmentEmail(order) {
  if (!order.customer_email) return;

  const notificationEmail = getSetting('notification_email') || EMAIL_FROM;

  let shipping = {};
  try { shipping = JSON.parse(order.shipping); } catch { /* ignore */ }

  let addr = {};
  try { addr = JSON.parse(order.shipping_address); } catch { /* ignore */ }

  let items = [];
  try { items = JSON.parse(order.items); } catch { /* ignore */ }

  const trackingNumber = order.tracking_number || '';
  const carrier = order.carrier || '';
  const trackingLink = carrier.toLowerCase().includes('auspost')
    ? `https://auspost.com.au/mypost/track/#/search?searchTerm=${encodeURIComponent(trackingNumber)}`
    : trackingNumber ? `https://www.google.com/search?q=${encodeURIComponent(carrier + ' tracking ' + trackingNumber)}` : '';

  const html = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a202c;">
  <div style="background:#1a2e4a;padding:24px;border-radius:8px 8px 0 0;">
    <h1 style="color:#fff;margin:0;font-size:22px;">Your Order Has Been Shipped! 📦</h1>
  </div>
  <div style="background:#f7fafc;padding:24px;border-radius:0 0 8px 8px;">
    <p>Hi ${escapeHtml(order.customer_name || 'Valued Customer')},</p>
    <p>Great news! Your order <strong>${escapeHtml(order.order_number || '#' + order.id)}</strong> has been dispatched and is on its way to you.</p>

    ${trackingNumber ? `
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:16px 0;">
      <h3 style="margin:0 0 8px;font-size:14px;color:#4a5568;">Tracking Information</h3>
      ${carrier ? `<p style="margin:4px 0;"><strong>Carrier:</strong> ${escapeHtml(carrier)}</p>` : ''}
      <p style="margin:4px 0;"><strong>Tracking Number:</strong> ${escapeHtml(trackingNumber)}</p>
      ${trackingLink ? `<p style="margin:8px 0;"><a href="${trackingLink}" style="background:#1a2e4a;color:#fff;padding:8px 16px;border-radius:6px;text-decoration:none;font-size:13px;">Track Your Package</a></p>` : ''}
    </div>` : ''}

    <h3 style="font-size:14px;margin-top:16px;">Order Summary</h3>
    ${buildItemsTable(items)}
    <p><strong>Shipping to:</strong> ${escapeHtml(formatAddress(addr))}</p>
    <p><strong>Shipping method:</strong> ${escapeHtml(shipping.name || 'Standard Shipping')}</p>
    <p><strong>Order Total:</strong> ${fmtAud(order.total || 0)}</p>

    ${order.fulfillment_notes ? `<p><strong>Note:</strong> ${escapeHtml(order.fulfillment_notes)}</p>` : ''}

    <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0;">
    <p style="font-size:12px;color:#718096;">
      Questions? Contact us at <a href="mailto:support@neurotonics.com.au" style="color:#1a2e4a;">support@neurotonics.com.au</a><br>
      Neurotonics · Always read the label and follow the directions for use.
    </p>
  </div>
</div>`.trim();

  const transporter = createTransporter();
  await transporter.sendMail({
    from:    `"Neurotonics" <${notificationEmail}>`,
    to:      order.customer_email,
    subject: `Your Order ${order.order_number || '#' + order.id} Has Been Shipped`,
    html,
    text: `Hi ${order.customer_name},\n\nYour order has been shipped!\n${trackingNumber ? `Tracking: ${carrier ? carrier + ' — ' : ''}${trackingNumber}\n` : ''}Total: ${fmtAud(order.total)}\n\nThank you for choosing Neurotonics!`,
  });
}

// ---------------------------------------------------------------------------
// sendOrderStatusEmail
// Generic status-change notification to customer (cancelled, refunded, etc.)
// ---------------------------------------------------------------------------
async function sendOrderStatusEmail(order, newStatus) {
  if (!order.customer_email) return;

  const statusMessages = {
    cancelled: { subject: 'Your Order Has Been Cancelled', headline: 'Order Cancelled', body: 'Your order has been cancelled. If you paid, a refund will be processed within 3-5 business days.' },
    refunded:  { subject: 'Your Refund Has Been Processed', headline: 'Refund Processed', body: 'Your refund has been processed and will appear in your account within 3-5 business days.' },
  };

  const msg = statusMessages[newStatus];
  if (!msg) return;

  const notificationEmail = getSetting('notification_email') || EMAIL_FROM;

  const html = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a202c;">
  <div style="background:#1a2e4a;padding:24px;border-radius:8px 8px 0 0;">
    <h1 style="color:#fff;margin:0;font-size:22px;">${msg.headline}</h1>
  </div>
  <div style="background:#f7fafc;padding:24px;border-radius:0 0 8px 8px;">
    <p>Hi ${escapeHtml(order.customer_name || 'Valued Customer')},</p>
    <p>${msg.body}</p>
    <p><strong>Order:</strong> ${escapeHtml(order.order_number || '#' + order.id)}</p>
    <p><strong>Amount:</strong> ${fmtAud(order.total || 0)}</p>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0;">
    <p style="font-size:12px;color:#718096;">
      Questions? Contact us at <a href="mailto:support@neurotonics.com.au" style="color:#1a2e4a;">support@neurotonics.com.au</a><br>
      Neurotonics
    </p>
  </div>
</div>`.trim();

  const transporter = createTransporter();
  await transporter.sendMail({
    from:    `"Neurotonics" <${notificationEmail}>`,
    to:      order.customer_email,
    subject: msg.subject,
    html,
    text: `Hi ${order.customer_name},\n\n${msg.body}\nOrder: ${order.order_number || '#' + order.id}\nAmount: ${fmtAud(order.total)}\n\nNeurotonics`,
  });
}

module.exports = {
  sendOrderConfirmation,
  sendAdminOrderAlert,
  sendFulfillmentEmail,
  sendOrderStatusEmail,
  sendPasswordResetEmail,
  interpolate,
  escapeHtml,
};
